// Every assistant answer says which engine produced it, worked out from what
// the answering side reported, and no label names a model that nothing runs
// (F28, plan section 15).
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));

const fs = require('fs');
const path = require('path');
const express = require('express');
const axios = require('axios');
const User = require('../../src/models/User');
const { engineOfSpaceAnswer, ENGINES } = require('../../src/services/answerEngine');
const { llmFallbackChain } = require('../../src/services/llmFallbackChain');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

const repo = path.join(__dirname, '..', '..', '..');
const { readPage } = require('../helpers/desktopPage');
const read = relative => readPage(path.join(repo, relative));

// what the ML service's chat route returns, by path
const SPACE_MODEL = { response: 'Phishing is…', model: 'local-llm', source: 'space_local_llamacpp', model_id: 'unsloth/Qwen3.5-2B-GGUF' };
const SPACE_RULES = { response: '## CyberForge ML Security Analysis', model_used: 'cyberforge-ml-fallback', confidence: 0.4 };
// the model was asked and did not finish (the ML service's chat route since V2-ML02)
const SPACE_NO_ANSWER = { response: null, answered: false, error: 'local LLM returned no text', model: 'local-llm', source: 'space_local_llamacpp', model_id: 'unsloth/Qwen3.5-2B-GGUF' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('the ML service\'s answers are named for what produced them', () => {
  expect(engineOfSpaceAnswer(SPACE_MODEL)).toEqual({
    id: 'ml-service-model', kind: 'language-model', where: 'CyberForge Analysis Agents', model: 'unsloth/Qwen3.5-2B-GGUF',
    label: 'Qwen3.5-2B (open-source, in the CyberForge Analysis Agents)'
  });
  expect(engineOfSpaceAnswer(SPACE_RULES)).toMatchObject({ id: 'ml-service-rules', kind: 'fixed-text' });
  expect(engineOfSpaceAnswer({ model: 'cyberforge-kb' })).toMatchObject({ id: 'backend-knowledge-base', kind: 'fixed-text' });
  expect(engineOfSpaceAnswer({ response: 'x' })).toMatchObject({ id: 'unknown', label: 'Agent not reported' });
  expect(engineOfSpaceAnswer(null).id).toBe('unknown');
});

describe('the backend chain used for scan summaries', () => {
  test('an answer from the ML service\'s model is labelled as that model, not "ZySec"', async () => {
    axios.post.mockResolvedValue({ data: SPACE_MODEL });
    const answer = await llmFallbackChain.ask('What is phishing?');
    expect(answer).toMatchObject({ text: 'Phishing is…', source: 'ml-service-model', model: 'unsloth/Qwen3.5-2B-GGUF' });
    expect(answer.engine.label).toBe('Qwen3.5-2B (open-source, in the CyberForge Analysis Agents)');
    expect(JSON.stringify(answer)).not.toMatch(/zysec/i);
  });

  test('the ML service\'s rule-based summary is labelled as fixed text, not as a model', async () => {
    axios.post.mockResolvedValue({ data: SPACE_RULES });
    const answer = await llmFallbackChain.ask('Explain this URL');
    expect(answer.engine).toMatchObject({ kind: 'fixed-text', id: 'ml-service-rules' });
  });

  test('with nothing answering, the template text says no model answered', async () => {
    axios.post.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const answer = await llmFallbackChain.ask('Explain this URL');
    expect(answer).toMatchObject({ source: 'heuristic-fallback', engine: ENGINES.template() });
    expect(answer.engine.label).toMatch(/no language model answered/);
  });
});

describe('the chat route the desktop falls back to', () => {
  let client;
  const member = { _id: '507f1f77bcf86cd799439011', role: 'user', isActive: true, activity: {}, isLocked: () => false, save: jest.fn() };
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/cyberforge-ml', require('../../src/routes/mlRoutes'));
    client = await serve(app);
  });
  afterAll(() => client.close());
  const ask = () => client.request('/api/cyberforge-ml/v2/security-chat', {
    method: 'POST', headers: { Authorization: `Bearer ${signSessionToken(member)}` }, body: { query: 'What is a DGA?' }
  });

  test.each([
    ['the ML service\'s model answers', () => axios.post.mockResolvedValue({ data: SPACE_MODEL }), 'ml-service-model'],
    ['only its rule-based summary answers', () => axios.post.mockResolvedValue({ data: SPACE_RULES }), 'ml-service-rules'],
    ['its model is asked and does not finish', () => axios.post.mockResolvedValue({ data: SPACE_NO_ANSWER }), 'ml-service-no-answer'],
    ['the ML service does not answer', () => axios.post.mockRejectedValue(new Error('timeout')), 'backend-knowledge-base']
  ])('when %s, the answer names that engine', async (label, arrange, id) => {
    User.findById.mockResolvedValue(member);
    arrange();
    const response = await ask();
    expect(response.status).toBe(200);
    expect(response.body.engine.id).toBe(id);
    expect(typeof response.body.engine.label).toBe('string');
  });
});

test('no screen or command names an engine that did not answer', () => {
  // the desktop's direct path names itself as the user's own-token feature
  const ml = read('desktop/src-tauri/src/ml.rs');
  expect(ml).toMatch(/fn your_token_engine\(/);
  expect((ml.match(/"engine": your_token_engine\(&model\)/g) || []).length).toBe(2);
  // pages show the reported engine instead of a fixed "DeepSeek"
  const assistant = read('desktop/ui/pages/ai-assistance.html');
  expect(assistant).not.toMatch(/id="modelBadge">DeepSeek</);
  expect(assistant).not.toMatch(/id="ctxModel">DeepSeek</);
  expect(assistant).toMatch(/CF\.engineNoteHTML\(/);
  expect(read('desktop/ui/scripts/cf-header.js')).not.toMatch(/DeepSeek-V3<\/span>/);
  expect(read('desktop/ui/pages/agent-core.html')).toMatch(/CF\.engineLabel\(o\.body\)/);
  // and the backend no longer calls anything "ZySec"
  for (const file of ['backend/src/services/llmFallbackChain.js', 'backend/src/routes/mlRoutes.js']) {
    const code = read(file).split('\n').filter(line => !/^\s*(\*|\/\/)/.test(line)).join('\n');
    expect(code).not.toMatch(/zysec/i);
  }
});

describe('when the model does not finish', () => {
  test('the chat route says so, with the reason, instead of offering stock text', () => {
    const route = read('backend/src/routes/mlRoutes.js');
    expect(route).toMatch(/if \(result && result\.answered === false\) \{[\s\S]*?engine: ENGINES\.noAnswer\(\)/);
    expect(ENGINES.noAnswer()).toMatchObject({ id: 'ml-service-no-answer', kind: 'fixed-text', model: null });
    // the ML service no longer returns its keyword summary as a chat answer
    const space = read('ml-services/hf_space_deploy/app.py');
    const chat = space.slice(space.indexOf('@api.post("/api/v2/security-chat")')).split(/\n@api\./)[0];
    expect(chat).not.toContain('reasoning_service._fallback');
    expect(chat).toContain('"answered": False');
  });

  test('callers give the model the time their own timeout allows', () => {
    expect(read('backend/src/services/cyberforgeMLService.js')).toMatch(/time_budget_s: timeBudgetS/);
    expect(read('backend/src/services/llmFallbackChain.js')).toMatch(/time_budget_s: Math\.max\(5, Math\.floor\(timeoutMs \/ 1000\) - 8\)/);
    const space = read('ml-services/hf_space_deploy/app.py');
    expect(space).toMatch(/budget = int_field\(body, "time_budget_s", int\(LOCAL_LLM_TIME_BUDGET_S\), 5, int\(LOCAL_LLM_MAX_TIME_BUDGET_S\)\)/);
  });
});


describe('a person waiting on the assistant goes first', () => {
  const { spawnSync } = require('child_process');
  const python = ['python', 'python3'].find(c => spawnSync(c, ['--version']).status === 0);

  test('the assistant marks its questions interactive; background explanations do not', () => {
    expect(read('backend/src/services/cyberforgeMLService.js')).toContain("priority: 'interactive'");
    expect(read('backend/src/services/llmFallbackChain.js')).not.toContain('interactive');
    const space = read('ml-services/hf_space_deploy/app.py');
    expect(space).toContain('interactive = text_field(body, "priority") == "interactive"');
  });

  (python ? test : test.skip)('on the ML service, a question takes the model from background work (fake model, no ML run)', () => {
    const result = spawnSync(python, ['-I', path.join(__dirname, '..', 'helpers', 'ml_llm_priority_harness.py'), path.join(repo, 'ml-services', 'hf_space_deploy', 'app.py')], { encoding: 'utf8', timeout: 60000 });
    expect(result.stderr).toBe('');
    const r = JSON.parse(result.stdout);
    // a running background generation stops at its next chunk and the question is answered
    expect(r.question_during_background).toMatchObject({ answered: true, background_truncated: true });
    expect(r.question_during_background.waited_s).toBeLessThan(1);
    expect(r.question_during_background.background_tokens).toBeLessThan(30);
    // while a question waits, background work does not start; the waiting question is then answered
    expect(r.background_while_question_waits).toBe('local LLM is busy with another request');
    expect(r.waiting_question).toBeNull();
    // a question that cannot get the model says so after its wait, which leaves time to answer
    expect(r.question_refused_error).toBe('local LLM is busy with another request');
    expect(r.question_refused_after_s).toBeGreaterThanOrEqual(4.5);
    expect(r.background_alone.answered).toBe(true);
  });
});
