#!/usr/bin/env node
// Real, authenticated calls through the same ML client used by the desktop route.
// Supply ML_SERVICE_KEY via environment; no credential or user data is printed.
const assert = require('node:assert/strict');
const { cyberforgeML: service } = require('../src/services/cyberforgeMLService');
const { engineOfSpaceAnswer } = require('../src/services/answerEngine');

async function main() {
  assert(process.env.ML_SERVICE_KEY, 'ML_SERVICE_KEY must be supplied in the process environment');
  const expectedModel = process.env.CYBERFORGE_EXPECT_MODEL;
  const cases = [
    ['csrf', 'How should a server prevent CSRF on a state-changing request?', /token/i],
    ['mfa-fatigue', 'Explain MFA fatigue and what to do about repeated approval requests.', /prompt|request|approval/i],
    ['heartbleed', 'Which historical release fixed Heartbleed in OpenSSL 1.0.1?', /1\.0\.1g/i]
  ];
  const results = [];
  for (const [topic, query, fact] of cases) {
    const response = await service.securityChat(query, 240, 50);
    assert.equal(response.answered, true, `${topic}: service did not answer (${response.status || 'HTTP ok'}; ${response.error || 'no error detail'})`);
    assert.match(response.response, fact, `${topic}: expected fact missing`);
    assert(response.references?.some(ref => ref.id === topic), `${topic}: primary reference missing`);
    if (expectedModel) assert.equal(response.model_id, expectedModel);
    const engine = engineOfSpaceAnswer(response);
    assert(['ml-service-model', 'ml-service-reference'].includes(engine.id));
    results.push({ topic, model: response.model_id, engine: engine.id,
      grounding: response.grounding.mode, elapsedMs: response.elapsed_ms });
  }
  console.log(JSON.stringify({ passed: true, results }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
