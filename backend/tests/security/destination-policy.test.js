// A scan cannot be aimed at an internal or private destination, in any address
// form, and such a target is refused before anything is sent to the scanner
// (SEC-04, OWASP SSRF prevention). Resolution is stubbed: no test touches DNS.
jest.mock('axios', () => {
  const instance = { post: jest.fn(), get: jest.fn() };
  return { create: jest.fn(() => instance), post: jest.fn(), get: jest.fn(), __instance: instance };
});

const axios = require('axios');
const { checkDestination, isPublicAddress } = require('../../src/services/destinationPolicy');
const { WebScraperAPIService } = require('../../src/services/WebScraperAPIService');

// a resolver with fixed answers; an unknown name does not resolve
const ANSWERS = {
  'example.org': ['93.184.215.14'],
  'phish.example.net': ['203.0.113.50', '2001:db8::50'],
  'rebind.example.com': ['127.0.0.1'],
  'metadata.example.com': ['169.254.169.254'],
  'split.example.com': ['93.184.215.14', '10.0.0.5'],
  'v6private.example.com': ['fd12:3456::1'],
  'mapped.example.com': ['::ffff:192.168.1.10']
};
const lookup = async host => {
  if (!ANSWERS[host]) throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' });
  return ANSWERS[host];
};
const check = url => checkDestination(url, { lookup });

describe('addresses written directly', () => {
  test.each([
    'http://127.0.0.1/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://0177.0.0.1/', 'http://0.0.0.0/',
    'http://10.1.2.3/', 'http://172.16.0.1/', 'http://172.31.255.255/', 'http://192.168.0.10:8080/admin',
    'http://100.64.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://224.0.0.1/', 'http://255.255.255.255/',
    'http://[::1]/', 'http://[::]/', 'http://[fe80::1]/', 'http://[fc00::1]/', 'http://[fd00:ec2::254]/',
    'http://[::ffff:127.0.0.1]/', 'http://[::ffff:7f00:1]/', 'http://[::ffff:169.254.169.254]/', 'http://[64:ff9b::a00:1]/', 'http://[ff02::1]/'
  ])('%s is refused', async url => {
    const verdict = await check(url);
    expect(verdict).toMatchObject({ allowed: false, code: 'DESTINATION_PRIVATE' });
  });

  test.each([
    'http://93.184.215.14/', 'https://8.8.8.8/', 'http://198.51.100.7/login', 'http://172.32.0.1/', 'http://[2606:4700::1111]/'
  ])('%s is allowed', async url => {
    expect(await check(url)).toMatchObject({ allowed: true, resolved: true });
  });
});

describe('names', () => {
  test.each([
    'http://localhost/', 'http://LOCALHOST:3000/', 'http://api.localhost/', 'http://printer.local/', 'http://metadata.google.internal/computeMetadata/v1/',
    'http://router.home.arpa/', 'http://intranet/', 'http://nas.lan/', 'http://localhost./'
  ])('%s is an internal name and refused', async url => {
    expect(await check(url)).toMatchObject({ allowed: false, code: 'DESTINATION_INTERNAL_NAME' });
  });

  test.each([
    ['rebind.example.com', 'to loopback'],
    ['metadata.example.com', 'to the cloud metadata address'],
    ['split.example.com', 'to one public and one private address'],
    ['v6private.example.com', 'to a unique-local IPv6 address'],
    ['mapped.example.com', 'to an IPv4 private address written as IPv6']
  ])('a public-looking name that resolves %s (%s) is refused', async host => {
    expect(await check(`https://${host}/login`)).toMatchObject({ allowed: false, code: 'DESTINATION_RESOLVES_PRIVATE' });
  });

  test('a public name is allowed, with what it resolved to', async () => {
    expect(await check('https://phish.example.net/verify')).toEqual({
      allowed: true, url: 'https://phish.example.net/verify', addresses: ['203.0.113.50', '2001:db8::50'], resolved: true
    });
  });

  test('a name that does not resolve is allowed: the scanner will fail to load it and say so', async () => {
    expect(await check('https://gone.example.test/')).toMatchObject({ allowed: true, resolved: false, addresses: [] });
  });
});

describe('schemes and credentials', () => {
  test.each([
    ['file:///etc/passwd', 'DESTINATION_SCHEME'], ['ftp://example.org/', 'DESTINATION_SCHEME'], ['gopher://example.org/', 'DESTINATION_SCHEME'],
    ['javascript:alert(1)', 'DESTINATION_SCHEME'], ['data:text/html,hi', 'DESTINATION_SCHEME'],
    ['http://user:pass@example.org/', 'DESTINATION_CREDENTIALS'], ['http://admin@example.org/', 'DESTINATION_CREDENTIALS'],
    ['not a url', 'DESTINATION_INVALID'], ['', 'DESTINATION_INVALID']
  ])('%s is refused (%s)', async (url, code) => {
    expect(await check(url)).toMatchObject({ allowed: false, code });
  });
});

test('isPublicAddress agrees with the URL checks and refuses what it cannot read', () => {
  expect(isPublicAddress('93.184.215.14')).toBe(true);
  expect(isPublicAddress('192.168.1.1')).toBe(false);
  expect(isPublicAddress('::1')).toBe(false);
  expect(isPublicAddress('not-an-address')).toBe(false);
});

describe('the scanner client', () => {
  const env = { WEBSCRAPER_API_URL: 'https://scanner.example.test', WEBSCRAPER_API_KEY: 'test-key' };

  test.each([
    'http://169.254.169.254/latest/meta-data/iam/', 'http://localhost:8080/admin', 'https://rebind.example.com/', 'file:///etc/passwd'
  ])('refuses %s without sending anything to the scanner', async target => {
    const service = new WebScraperAPIService(env, { lookup });
    const result = await service.scrapeWebsite(target);
    expect(result).toMatchObject({ success: false, status: 'refused' });
    expect(result.error).toMatch(/^not scanned: /);
    expect(result.coverage.rendered_page).toMatchObject({ status: 'skipped' });
    expect(axios.__instance.post).not.toHaveBeenCalled();
    expect(axios.__instance.get).not.toHaveBeenCalled();
  });

  test('refuses an internal target as such even when no scanner is configured', async () => {
    const service = new WebScraperAPIService({ WEBSCRAPER_API_URL: 'https://scanner.example.test' }, { lookup });
    expect(await service.scrapeWebsite('http://169.254.169.254/latest/meta-data/'))
      .toMatchObject({ success: false, status: 'refused', error_code: 'DESTINATION_PRIVATE' });
    expect(await service.scrapeWebsite('https://phish.example.net/verify'))
      .toMatchObject({ success: false, status: 'unavailable', error_code: 'SCRAPER_NOT_CONFIGURED' });
  });

  test('sends a public address on to the scanner', async () => {
    axios.__instance.post.mockResolvedValueOnce({ status: 503, data: { success: false, error: { code: 'BUSY', message: 'busy' } } });
    const service = new WebScraperAPIService(env, { lookup });
    await service.scrapeWebsite('https://phish.example.net/verify');
    expect(axios.__instance.post).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/scans$/), expect.objectContaining({ url: 'https://phish.example.net/verify' }), expect.any(Object));
  });
});
