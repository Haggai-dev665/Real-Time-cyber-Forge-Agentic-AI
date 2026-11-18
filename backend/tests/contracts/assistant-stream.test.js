// The assistant's streamed answer (POST /api/cyberforge-ml/v2/security-chat/stream):
// the backend relays the ML service's reasoning and answer as they are written,
// labels the engine on the final answer, says plainly when the model did not
// answer, and passes on only a bounded, cleaned conversation history.
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));

const http = require('http');
const { Readable } = require('stream');
const express = require('express');
const User = require('../../src/models/User');
const { cyberforgeML } = require('../../src/services/cyberforgeMLService');
const { signSessionToken } = require('../../src/services/sessionTokens');

const member = { _id: '507f1f77bcf86cd799439011', role: 'user', isActive: true, activity: {}, isLocked: () => false, save: jest.fn() };
const sse = events => events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');
// split a string into pieces of the given sizes, so events cross chunk boundaries
const pieces = (text, size) => { const out = []; for (let i = 0; i < text.length; i += size) out.push(Buffer.from(text.slice(i, i + size))); return out; };
const upstream = (text, size = 7) => ({ status: 200, headers: { 'content-type': 'text/event-stream' }, data: Readable.from(pieces(text, size)) });

let server, base;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(require('compression')());
  app.use('/api/cyberforge-ml', require('../../src/routes/mlRoutes'));
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
beforeEach(() => { jest.restoreAllMocks(); User.findById.mockResolvedValue(member); });

async function stream(body, auth = true) {
  const response = await fetch(`${base}/api/cyberforge-ml/v2/security-chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip', ...(auth ? { Authorization: `Bearer ${signSessionToken(member)}` } : {}) },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const events = text.split('\n\n').filter(Boolean).map(block => JSON.parse(block.replace(/^data: /, '')));
  return { response, events };
}

test('reasoning and answer are relayed as they arrive, and the final answer names its engine', async () => {
  const spy = jest.spyOn(cyberforgeML, 'securityChatStream').mockResolvedValue(upstream(sse([
    { type: 'thinking', delta: 'The user asks about ' }, { type: 'thinking', delta: 'phishing.' },
    { type: 'answer', delta: '**Phishing** is ' }, { type: 'answer', delta: 'a scam.' },
    { type: 'final', result: { response: '**Phishing** is a scam.', model: 'local-llm', source: 'space_local_llamacpp', model_id: 'unsloth/Qwen3.5-2B-GGUF', thinking: 'The user asks about phishing.', thinking_ms: 900, grounding: { mode: 'retrieved_context' } } }
  ])));
  const { response, events } = await stream({ query: 'What is phishing?' });
  expect(response.headers.get('content-type')).toMatch(/^text\/event-stream/);
  expect(response.headers.get('cache-control')).toMatch(/no-transform/);
  expect(response.headers.get('content-encoding')).toBeNull();
  expect(events.map(e => e.type)).toEqual(['thinking', 'thinking', 'answer', 'answer', 'final']);
  expect(events.filter(e => e.type === 'answer').map(e => e.delta).join('')).toBe('**Phishing** is a scam.');
  expect(events[4].result).toMatchObject({ response: '**Phishing** is a scam.', thinking_ms: 900, engine: { id: 'ml-service-model' } });
  expect(spy).toHaveBeenCalledWith('What is phishing?', expect.objectContaining({ think: 'auto', history: [] }));
});

test('the conversation history is bounded and cleaned, and an unknown thinking mode becomes "auto"', async () => {
  const spy = jest.spyOn(cyberforgeML, 'securityChatStream').mockResolvedValue(upstream(sse([{ type: 'final', result: { response: 'ok', model: 'local-llm' } }])));
  const history = [...Array(12)].map((_, i) => ({ role: i % 2 ? 'assistant' : 'system', content: `turn ${i} ${'x'.repeat(i === 11 ? 5000 : 0)}` }));
  history.push({ role: 'user', content: '   ' }, { role: 'user', content: 42 }, null);
  await stream({ query: 'And then?', history, think: 'please' });
  const sent = spy.mock.calls[0][1];
  expect(sent.think).toBe('auto');
  expect(sent.history.length).toBe(5);
  expect(sent.history.every(t => ['user', 'assistant'].includes(t.role))).toBe(true);
  expect(Math.max(...sent.history.map(t => t.content.length))).toBe(2000);
});

test('when the model does not finish, the final event says so instead of streaming stock text', async () => {
  jest.spyOn(cyberforgeML, 'securityChatStream').mockResolvedValue(upstream(sse([
    { type: 'answer', delta: 'Partial' }, { type: 'final', result: { answered: false, response: null, error: 'local LLM is busy with another request' } }
  ])));
  const { events } = await stream({ query: 'What is a DGA?' });
  expect(events.at(-1).result).toMatchObject({ answered: false, reason: 'local LLM is busy with another request', engine: { id: 'ml-service-no-answer' } });
});

test('a stream that ends early, or an ML service that cannot be reached, ends with an explicit no-answer', async () => {
  jest.spyOn(cyberforgeML, 'securityChatStream').mockResolvedValueOnce(upstream(sse([{ type: 'answer', delta: 'Half an ans' }])));
  let { events } = await stream({ query: 'q' });
  expect(events.at(-1).result).toMatchObject({ answered: false, reason: 'the answer stopped before it was finished' });
  jest.spyOn(cyberforgeML, 'securityChatStream').mockRejectedValueOnce(new Error('ECONNREFUSED'));
  ({ events } = await stream({ query: 'q' }));
  expect(events).toHaveLength(1);
  expect(events[0].result).toMatchObject({ answered: false, reason: 'the ML service could not be reached' });
  jest.spyOn(cyberforgeML, 'securityChatStream').mockResolvedValueOnce({ status: 503, data: Readable.from([]) });
  ({ events } = await stream({ query: 'q' }));
  expect(events[0].result.reason).toBe('the ML service answered 503');
});

test('an ML service that answers with plain JSON (no streaming) is passed on as the final answer', async () => {
  const json = JSON.stringify({ response: 'Phishing is a scam.', model: 'local-llm', source: 'space_local_llamacpp', model_id: 'm' });
  jest.spyOn(cyberforgeML, 'securityChatStream').mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'application/json' }, data: Readable.from(pieces(json, 5)) });
  let { events } = await stream({ query: 'What is phishing?' });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ type: 'final', result: { response: 'Phishing is a scam.', engine: { id: 'ml-service-model' } } });
  jest.spyOn(cyberforgeML, 'securityChatStream').mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'application/json' }, data: Readable.from([Buffer.from('{"answered":false,"response":null,"error":"local LLM is still loading"}')]) });
  ({ events } = await stream({ query: 'q' }));
  expect(events[0].result).toMatchObject({ answered: false, reason: 'local LLM is still loading' });
});

test('the route needs a signed-in user and a question', async () => {
  const spy = jest.spyOn(cyberforgeML, 'securityChatStream');
  const anonymous = await fetch(`${base}/api/cyberforge-ml/v2/security-chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"query":"hi"}' });
  expect(anonymous.status).toBe(401);
  const empty = await fetch(`${base}/api/cyberforge-ml/v2/security-chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signSessionToken(member)}` }, body: '{}' });
  expect(empty.status).toBe(400);
  expect(spy).not.toHaveBeenCalled();
});
