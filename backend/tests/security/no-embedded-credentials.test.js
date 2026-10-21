// A key belongs in the environment. This repository is public, so a key written
// into a source file is disclosed the moment it is pushed (finding F31: an OTX
// key was the fallback in services/otx.js, and another sat in two desktop pages).
jest.mock('axios', () => ({ get: jest.fn() }));

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const repoRoot = path.join(__dirname, '..', '..', '..');
const SOURCE_DIRS = ['backend/src', 'desktop/ui', 'desktop/src-tauri/src', 'mobile-app/src'];
const EXTENSIONS = ['.js', '.ts', '.tsx', '.rs', '.html'];
const SKIPPED = /[\\/](node_modules|vendor|target|dist|build)[\\/]/;

function sourceFiles() {
  const found = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (SKIPPED.test(full + path.sep)) continue;
      if (entry.isDirectory()) walk(full);
      else if (EXTENSIONS.includes(path.extname(entry.name))) found.push(full);
    }
  };
  for (const dir of SOURCE_DIRS) {
    const full = path.join(repoRoot, dir);
    if (fs.existsSync(full)) walk(full);
  }
  return found;
}

// A name that says "credential", then an assignment or a fallback, then a long literal.
const NAMED_LITERAL = /(key|secret|token|password|passwd|credential)\w*['"]?\s*(=|:|\|\||\?\?)\s*['"`][A-Za-z0-9_\-+/=.]{32,}['"`]/i;

test('no source file assigns a long literal to something named like a credential', () => {
  const offenders = [];
  for (const file of sourceFiles()) {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
      if (NAMED_LITERAL.test(line)) offenders.push(`${path.relative(repoRoot, file)}:${index + 1}`);
    });
  }
  expect(offenders).toEqual([]);
});

test('the check recognises the forms a key was written in', () => {
  const sample = 'a'.repeat(64);
  expect(NAMED_LITERAL.test(`this.apiKey = process.env.OTX_API_KEY || '${sample}';`)).toBe(true);
  expect(NAMED_LITERAL.test(`const OTX_API_KEY = '${sample}';`)).toBe(true);
  expect(NAMED_LITERAL.test(`{ "client_secret": "${sample}" }`)).toBe(true);
  expect(NAMED_LITERAL.test("this.apiKey = (process.env.OTX_API_KEY || '').trim();")).toBe(false);
  expect(NAMED_LITERAL.test("const token = req.headers.authorization;")).toBe(false);
});

test('the desktop app sends no OTX key: it asks the backend', () => {
  const desktop = path.join(repoRoot, 'desktop');
  if (!fs.existsSync(desktop)) return;
  for (const page of ['ui/pages/loading.html', 'ui/pages/threat-globe.html']) {
    expect(require('../helpers/desktopPage').readPage(path.join(desktop, page))).not.toMatch(/OTX_API_KEY|apiKey\s*:/);
  }
  const command = fs.readFileSync(path.join(desktop, 'src-tauri/src/agent.rs'), 'utf8').replace(/\r\n/g, '\n')
    .match(/pub async fn otx_fetch\([\s\S]*?\n}\n/);
  expect(command).not.toBeNull();
  expect(command[0]).not.toMatch(/api_key|X-OTX-API-KEY|otx\.alienvault\.com/);
  expect(command[0]).toMatch(/\/api\/otx\/pulses/);
});

describe('the OTX service without a key', () => {
  let otx;
  const saved = process.env.OTX_API_KEY;
  beforeAll(() => {
    delete process.env.OTX_API_KEY;
    jest.isolateModules(() => { otx = require('../../src/services/otx'); });
  });
  afterAll(() => {
    otx.stopPolling();
    if (saved === undefined) delete process.env.OTX_API_KEY; else process.env.OTX_API_KEY = saved;
  });

  test('has no key of its own', () => {
    expect(otx.apiKey).toBe('');
  });

  test('refuses every call to OTX, and sends nothing', async () => {
    for (const call of [
      () => otx.getSubscribedPulses(),
      () => otx.searchPulses('malware'),
      () => otx.getIndicatorDetails('IPv4', '203.0.113.9'),
      () => otx.getRecentThreats()
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'OTX_NOT_CONFIGURED' });
    }
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('does not start polling', () => {
    expect(otx.startPolling(1000)).toBe(false);
    expect(otx.pollingInterval).toBeNull();
  });
});

describe('the OTX service with a key', () => {
  let otx;
  const saved = process.env.OTX_API_KEY;
  beforeAll(() => {
    process.env.OTX_API_KEY = 'key-from-the-environment';
    jest.isolateModules(() => { otx = require('../../src/services/otx'); });
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.OTX_API_KEY; else process.env.OTX_API_KEY = saved;
  });
  beforeEach(() => axios.get.mockReset());

  test('sends the key it was given', async () => {
    axios.get.mockResolvedValue({ data: { results: [] } });
    await otx.getSubscribedPulses();
    expect(axios.get.mock.calls[0][1].headers['X-OTX-API-KEY']).toBe('key-from-the-environment');
  });

  test('a failed read is a failure, not an empty list of threats', async () => {
    axios.get.mockRejectedValue(new Error('Request failed with status code 504'));
    await expect(otx.getRecentThreats()).rejects.toThrow('504');
  });

  test('gives no coordinates it did not look up and no destination it does not know', () => {
    const events = otx.transformPulseToThreatEvents({
      id: 'pulse-1', name: 'Test pulse', created: '2026-10-01T00:00:00', tags: [],
      indicators: [{ type: 'IPv4', indicator: '203.0.113.9', created: '2026-10-01T00:00:00' }]
    });
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.origin).toMatchObject({ ip: '203.0.113.9', country: null, lat: null, lon: null });
      expect(event.destination).toBeNull();
    }
    const source = fs.readFileSync(require.resolve('../../src/services/otx'), 'utf8');
    expect(source).not.toMatch(/Math\.random/);
  });
});
