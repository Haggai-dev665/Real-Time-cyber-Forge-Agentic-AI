// V2-ML01: the ML Space runs no uploaded code, notebooks or uploaded models,
// and answers only the backend (service key) except for its health check.
// The Space is not run here: its source is checked statically, and its request
// gate is driven through tests/helpers/ml_gate_harness.py, which takes only the
// gate's definitions from app.py (importing app.py would load the models).
jest.mock('../../src/services/memoryService', () => ({ memoryService: {} }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const express = require('express');
const { serve } = require('../helpers/http');

const SPACE = path.resolve(__dirname, '../../../ml-services/hf_space_deploy');
const APP = fs.readFileSync(path.join(SPACE, 'app.py'), 'utf8');
const KEY = 'k'.repeat(24) + 'Test-Key_0123456789';

describe('the Space source', () => {
  test('has no Gradio UI, notebook runner, uploaded-data training or uploaded-model inference', () => {
    expect(APP).not.toMatch(/^\s*import gradio|^\s*from gradio|\bgr\.|mount_gradio_app/m);
    expect(APP).not.toMatch(/nbconvert|nbformat|\bexec\(|\beval\(|run_notebook_cell|execute_notebook/);
    expect(APP).not.toMatch(/train_model_from_data|run_inference\(|UploadFile|\bFile\(|\bForm\(/);
    expect(APP).toMatch(/^app = api$/m);
  });

  test('loads models only inside the model loader, from the model repository and the image', () => {
    const loader = APP.slice(APP.indexOf('class MLModelLoader'), APP.indexOf('\nml_loader = MLModelLoader()'));
    expect(loader.length).toBeGreaterThan(1000);
    const outside = APP.replace(loader, '');
    expect(outside).not.toMatch(/joblib\.load|pickle\.load|torch\.load/);
    expect(loader).not.toMatch(/request|body\[|body\.get/);
  });

  test('gates every route but / and /health behind the service key, and the two training routes behind the owner', () => {
    expect(APP).toMatch(/^PUBLIC_PATHS = \{"\/", "\/health"\}$/m);
    expect(APP).toMatch(/^OWNER_PATHS = \{"\/api\/admin\/train", "\/api\/admin\/train\/status"\}$/m);
    const routes = [...APP.matchAll(/^@api\.(get|post|put|delete|patch)\("([^"]+)"/gm)].map(m => m[2]);
    expect(routes.length).toBeGreaterThan(20);
    for (const route of routes.filter(r => r.startsWith('/api/admin/'))) {
      const handler = APP.slice(APP.indexOf(`("${route}")`)).split(/\n@api\./)[0];
      expect({ route, ownerChecked: /owner_token, request\)/.test(handler) }).toEqual({ route, ownerChecked: true });
    }
    // Added after CORS, so it runs first, before every route.
    expect(APP.indexOf('api.add_middleware(ServiceGate)')).toBeGreaterThan(APP.indexOf('api.add_middleware(\n    CORSMiddleware'));
    expect(APP).toMatch(/hmac\.compare_digest/);
    expect(APP).toMatch(/ML_SERVICE_KEY = os\.environ\.get\("ML_SERVICE_KEY", ""\)/);
  });

  test('the image no longer installs Gradio, notebook tools or a Jupyter kernel', () => {
    const requirements = fs.readFileSync(path.join(SPACE, 'requirements.txt'), 'utf8');
    const dockerfile = fs.readFileSync(path.join(SPACE, 'Dockerfile'), 'utf8');
    expect(requirements).not.toMatch(/^(gradio|nbconvert|nbformat|nest_asyncio)\b/im);
    expect(dockerfile).not.toMatch(/ipykernel|gradio/i);
  });
});

function python() {
  for (const candidate of ['python', 'python3']) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  return null;
}
const PYTHON = python();
const gate = (key, max) => {
  const result = spawnSync(PYTHON, ['-I', path.resolve(__dirname, '../helpers/ml_gate_harness.py'), path.join(SPACE, 'app.py'), key, String(max)], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe('');
  return JSON.parse(result.stdout);
};

(PYTHON ? describe : describe.skip)('the Space request gate (needs Python; no ML code is run)', () => {
  test('with a key set: only the backend reaches inference, health stays public, the owner routes check for themselves', () => {
    const r = gate(KEY, 1024);
    for (const name of ['inference_without_key', 'inference_with_wrong_key', 'docs_without_key', 'openapi_without_key', 'removed_gradio_api_without_key']) {
      expect({ name, ...r[name] }).toEqual({ name, status: 401, reached: false, code: 'SERVICE_KEY_REQUIRED' });
    }
    for (const name of ['inference_with_key', 'health_without_key', 'landing_without_key', 'admin_train_without_key', 'preflight_without_key']) {
      expect({ name, status: r[name].status, reached: r[name].reached }).toEqual({ name, status: 200, reached: true });
    }
  });

  test('bodies over the limit are refused whether or not they state their length', () => {
    const r = gate(KEY, 1024);
    expect(r.stated_length_over_limit).toEqual({ status: 413, reached: false, code: 'BODY_TOO_LARGE' });
    expect(r.streamed_body_over_limit).toMatchObject({ status: 413, code: 'BODY_TOO_LARGE' });
    expect(r.body_at_limit.status).toBe(200);
    expect(r.bad_content_length).toEqual({ status: 400, reached: false, code: 'BAD_CONTENT_LENGTH' });
  });

  test('with no key configured, gated routes refuse (503) instead of running open', () => {
    const r = gate('', 1024);
    expect(r.inference_with_key).toEqual({ status: 503, reached: false, code: 'SERVICE_KEY_NOT_CONFIGURED' });
    expect(r.health_without_key.status).toBe(200);
  });
});

describe('the backend', () => {
  afterEach(() => {
    delete process.env.ML_SERVICE_URL;
    delete process.env.ML_SERVICE_KEY;
  });

  test('a malformed key is refused without being echoed', () => {
    const { getMLServiceKey } = require('../../src/config/ml.config');
    expect(getMLServiceKey({})).toBe('');
    expect(getMLServiceKey({ ML_SERVICE_KEY: '' })).toBe('');
    expect(getMLServiceKey({ ML_SERVICE_KEY: ` ${KEY} ` })).toBe(KEY);
    for (const value of ['short-secret', 'has spaces in the secret value 0123456789', 'x'.repeat(257)]) {
      expect(() => getMLServiceKey({ ML_SERVICE_KEY: value })).toThrow('ML_SERVICE_KEY must be');
      try { getMLServiceKey({ ML_SERVICE_KEY: value }); } catch (error) { expect(error.message).not.toContain('secret'); }
    }
  });

  test('a malformed key aborts startup', () => {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../../src/server.js')], {
      cwd: __dirname, env: { ...process.env, ML_SERVICE_KEY: 'short-secret' }, encoding: 'utf8', timeout: 5000
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ML_SERVICE_KEY must be');
    expect(result.stderr + result.stdout).not.toContain('short-secret');
  });

  test('every ML client sends the key to the ML service, and no request elsewhere carries it', async () => {
    const seen = [];
    const app = express();
    app.use(express.json());
    app.use((req, res) => {
      seen.push({ path: req.path, key: req.get('X-CyberForge-Service-Key') || null });
      res.json({ status: 'ok', source: 'fixture', response: 'answer' });
    });
    const fixture = await serve(app);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.ML_SERVICE_URL = `${fixture.url}/ml`;
    process.env.ML_SERVICE_KEY = KEY;
    try {
      const axios = require('axios');
      const { MLService } = require('../../src/services/mlService');
      const { MLServiceClient } = require('../../src/services/mlServiceClient');
      const { CyberForgeMLService } = require('../../src/services/cyberforgeMLService');
      const { LLMFallbackChain } = require('../../src/services/llmFallbackChain');
      await new MLService().checkHealth();
      await new MLServiceClient().healthCheck();
      await new CyberForgeMLService().classifyUrlPhishing('https://example.com');
      await new LLMFallbackChain()._callSpace('hello', 16, 5000);
      await axios.post(`${fixture.url}/ml/analyze-url`, { url: 'https://example.com' });
      await axios.get(`${fixture.url}/ml-lookalike/health`);
      await axios.get(`${fixture.url}/elsewhere`);
      expect(seen.filter(s => s.path.startsWith('/ml/')).map(s => s.key)).toEqual([KEY, KEY, KEY, KEY, KEY]);
      expect(seen.filter(s => !s.path.startsWith('/ml/'))).toEqual([
        { path: '/ml-lookalike/health', key: null }, { path: '/elsewhere', key: null }]);
    } finally {
      log.mockRestore();
      await fixture.close();
    }
  });

  test('without a key, no key header is sent', async () => {
    const seen = [];
    const app = express();
    app.use((req, res) => { seen.push(req.get('X-CyberForge-Service-Key') || null); res.json({ status: 'ok' }); });
    const fixture = await serve(app);
    process.env.ML_SERVICE_URL = `${fixture.url}/ml`;
    try {
      await require('axios').get(`${fixture.url}/ml/health`);
      expect(seen).toEqual([null]);
    } finally {
      await fixture.close();
    }
  });
});
