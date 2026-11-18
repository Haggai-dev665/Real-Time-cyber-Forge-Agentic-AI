#!/usr/bin/env node
// Live check that every ML-service feature the desktop app uses answers through
// the backend's own clients (the same code the desktop's backend routes run).
// Supply ML_SERVICE_KEY via the environment; no credential or user data is printed.
//
//   ML_SERVICE_KEY=... node scripts/check-ml-integration.js [path-to-a-windows-program]
//
// Each check prints one line: PASS / FAIL, the feature, the desktop screen that
// uses it, and the time it took. Exit code 1 when any check fails.
const fs = require('fs');
const assert = require('node:assert/strict');
const { cyberforgeML } = require('../src/services/cyberforgeMLService');
const fileMalware = require('../src/services/fileMalwareScan');
const { fetchReport } = require('../src/services/mlCapabilityReport');
const { engineOfSpaceAnswer } = require('../src/services/answerEngine');

const PHISH = 'http://paypal-secure-login.confirm-account.ru/webscr?cmd=login';

async function readStream(response) {
  const events = [];
  let buffer = '';
  for await (const chunk of response.data) {
    buffer += chunk.toString('utf8');
    let at;
    while ((at = buffer.indexOf('\n\n')) >= 0) {
      const line = buffer.slice(0, at).split('\n').find(l => l.startsWith('data: '));
      buffer = buffer.slice(at + 2);
      if (line) events.push(JSON.parse(line.slice(6)));
    }
  }
  return events;
}

const CHECKS = [
  ['ML service status', 'status bar, loading screen', async () => {
    const s = await cyberforgeML.transformerStatus();
    assert(!s.error, s.error);
    const llm = s?.reasoning_llm?.local || {};
    assert(llm.loaded, 'chat model not loaded');
    return `chat model ${llm.repo} on ${llm.accelerator}`;
  }],
  ['Capability report', 'Model capabilities page', async () => {
    const r = await fetchReport({ timeoutMs: 20000 });
    assert(r.available !== false, r.reason || 'unavailable');
    const n = (r.capabilities || []).length;
    assert(n > 0, 'no capabilities listed');
    return `${n} capabilities`;
  }],
  ['BERT URL classifier', 'Analyze (deep scan), agents', async () => {
    const r = await cyberforgeML.classifyUrlPhishing(PHISH);
    assert(!r.error, r.error);
    assert(typeof r.threat_score === 'number' || typeof r.confidence === 'number', 'no score');
    return `${r.prediction} (${r.confidence})`;
  }],
  ['DGA detector', 'Browser Activity, agents', async () => {
    const r = await cyberforgeML.detectDga('xjw3k9qpl2vz7.com');
    assert(!r.error, r.error);
    return `${r.is_threat ? 'generated' : 'legitimate'} (${r.confidence})`;
  }],
  ['Deep scan (URL models + BERT + DGA)', 'Analyze', async () => {
    const r = await cyberforgeML.urlEnrich(PHISH);
    assert(!r.error, r.error);
    return `risk ${r.risk_level} (${r.risk_score}), with BERT, DGA and ML components`;
  }],
  ['IOC scan', 'Analyze', async () => {
    const r = await cyberforgeML.iocScan({ url: PHISH, domain: 'confirm-account.ru', ip: '185.220.101.1' });
    assert(!r.error, r.error);
    return `keys: ${Object.keys(r).slice(0, 5).join(', ')}`;
  }],
  ['Assistant (JSON)', 'Agent panel, Agent Core', async () => {
    const r = await cyberforgeML.securityChat('What is credential stuffing?', 400, 45, { think: 'off' });
    assert.equal(r.answered, true, r.error || 'not answered');
    return `${engineOfSpaceAnswer(r).id}, ${r.grounding?.mode}, ${r.elapsed_ms} ms`;
  }],
  ['Assistant (streamed, with thinking and history)', 'AI Assistant', async () => {
    const response = await cyberforgeML.securityChatStream('And how do I protect my accounts from it?', {
      history: [{ role: 'user', content: 'What is credential stuffing?' },
                { role: 'assistant', content: 'Credential stuffing uses leaked username and password pairs from one site to sign in to others.' }],
      think: 'auto', maxTokens: 600
    });
    assert.equal(response.status, 200, `HTTP ${response.status}`);
    assert.match(String(response.headers['content-type']), /event-stream/, 'not a stream (old ML service code?)');
    const events = await readStream(response);
    const kinds = new Set(events.map(e => e.type));
    const final = events.find(e => e.type === 'final');
    assert(final, 'no final event');
    assert.equal(final.result.answered, true, final.result.error || 'not answered');
    assert(kinds.has('answer'), 'no streamed answer text');
    return `${events.length} events (${[...kinds].join(', ')}), thought ${final.result.thinking_ms ?? 0} ms, ${final.result.history_turns} history turns`;
  }],
  ['File malware model', 'Analyze (file scan)', async (programPath) => {
    if (!programPath) return 'skipped: no program path given';
    const r = await fileMalware.scanFile(fs.readFileSync(programPath), { timeoutMs: 90000 });
    assert(r && r.status !== 'unavailable', (r && (r.reason || r.error)) || 'unavailable');
    return `${r.verdict ?? r.label ?? r.status} (${r.score ?? r.probability ?? '?'})`;
  }],
];

async function main() {
  assert(process.env.ML_SERVICE_KEY, 'ML_SERVICE_KEY must be supplied in the process environment');
  const program = process.argv[2];
  let failed = 0;
  for (const [name, screen, run] of CHECKS) {
    const t = Date.now();
    try {
      const detail = await run(program);
      console.log(`PASS  ${name.padEnd(46)} ${String(Date.now() - t).padStart(6)} ms  [${screen}]  ${detail}`);
    } catch (error) {
      failed++;
      console.log(`FAIL  ${name.padEnd(46)} ${String(Date.now() - t).padStart(6)} ms  [${screen}]  ${String(error.message).slice(0, 200)}`);
    }
  }
  console.log(failed ? `${failed} of ${CHECKS.length} checks failed` : `all ${CHECKS.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
