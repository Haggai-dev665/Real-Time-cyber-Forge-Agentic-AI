jest.mock('../../src/services/memoryService', () => ({ memoryService: {} }));
jest.mock('../../src/models', () => ({ Analysis: jest.fn(), Threat: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn() }));

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const express = require('express');
const { getMLServiceUrl } = require('../../src/config/ml.config');
const { serve } = require('../helpers/http');

test('defaults to the deployed Space and retired aliases cannot select a different host', () => {
  expect(getMLServiceUrl({})).toBe('https://che237-cyberforge.hf.space');
  expect(getMLServiceUrl({ AI_SERVICE_URL: 'http://localhost:8001', HF_SPACE_URL: 'http://localhost:8002' }))
    .toBe(getMLServiceUrl({}));
});

test('normalizes the canonical URL while preserving an explicit path prefix', () => {
  expect(getMLServiceUrl({ ML_SERVICE_URL: ' https://ml.example.test/services/ml/// ' }))
    .toBe('https://ml.example.test/services/ml');
  expect(getMLServiceUrl({ ML_SERVICE_URL: 'http://127.0.0.1:8001/' })).toBe('http://127.0.0.1:8001');
});

test.each(['', ' ', 'localhost:8001', 'file:///secret', 'https://user:secret@ml.example.test',
  'https://ml.example.test?token=secret', 'https://ml.example.test#secret'])('rejects malformed ML configuration %# without echoing secrets', value => {
  expect(() => getMLServiceUrl({ ML_SERVICE_URL: value })).toThrow('ML_SERVICE_URL must be');
  try { getMLServiceUrl({ ML_SERVICE_URL: value }); } catch (error) {
    expect(error.message).not.toContain('secret');
  }
});

test('invalid ML configuration aborts startup before service initialization', () => {
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../../src/server.js')], {
    cwd: __dirname,
    env: { ...process.env, ML_SERVICE_URL: 'file:///secret' },
    encoding: 'utf8', timeout: 5000
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('ML_SERVICE_URL must be');
  expect(result.stdout).not.toMatch(/Appwrite|Datadog|MongoDB|running on port/);
});

test('ML clients send real HTTP requests to the single configured destination', async () => {
  const app = express();
  const calls = [];
  app.use(express.json());
  app.use('/ml', (req, res) => {
    calls.push(`${req.method} ${req.path}`);
    res.json({ source: 'configured-ml', status: 'ok' });
  });
  const fixture = await serve(app);
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  process.env.ML_SERVICE_URL = `${fixture.url}/ml/`;
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:1';
  process.env.HF_SPACE_URL = 'http://127.0.0.1:2';
  try {
    const { MLService } = require('../../src/services/mlService');
    const { MLServiceClient } = require('../../src/services/mlServiceClient');
    const { CyberForgeMLService } = require('../../src/services/cyberforgeMLService');
    const { AnalysisService } = require('../../src/services/analysisService');
    const AIAnalysisService = require('../../src/services/ai/AIAnalysisService');
    const { threatService } = require('../../src/services/threatService');
    expect((await new MLService().checkHealth()).status.source).toBe('configured-ml');
    expect((await new MLServiceClient().healthCheck()).source).toBe('configured-ml');
    expect((await new CyberForgeMLService().classifyUrlPhishing('https://example.com')).source).toBe('configured-ml');
    expect((await new AnalysisService().performAIAnalysis({ url: 'https://example.com' })).source).toBe('configured-ml');
    expect(new AIAnalysisService().mlServiceUrl).toBe(`${fixture.url}/ml`);
    expect(threatService.mlServiceUrl).toBe(`${fixture.url}/ml`);
    expect(calls).toEqual(['GET /health', 'GET /health', 'POST /api/v2/url-classify', 'POST /analyze-url']);
  } finally {
    delete process.env.ML_SERVICE_URL;
    delete process.env.AI_SERVICE_URL;
    delete process.env.HF_SPACE_URL;
    log.mockRestore();
    await fixture.close();
  }
});

test('backend clients cannot reintroduce independent ML environment variables or fallback hosts', () => {
  const root = path.resolve(__dirname, '../../src');
  const visit = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? visit(filename) : filename.endsWith('.js') ? [filename] : [];
  });
  for (const filename of visit(root)) {
    if (filename === path.join(root, 'config', 'ml.config.js')) continue;
    const source = fs.readFileSync(filename, 'utf8');
    expect({ file: path.relative(root, filename), independentHost: /process\.env\.(?:AI_SERVICE_URL|ML_SERVICE_URL|HF_SPACE_URL)|https?:\/\/localhost:8001|https:\/\/che237-cyberforge\.hf\.space/.test(source) })
      .toEqual({ file: path.relative(root, filename), independentHost: false });
  }
});
