// The one-line summary shown with a scan is cut from the chat model's answer.
// That answer is often a few short bullet points, and the summary must never
// come out empty (it once came out as a single full stop).
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { mlServiceClient } = require('../../src/services/mlServiceClient');

const ml = { category: 'phishing', confidence: 0.91 };
const summary = text => mlServiceClient.extractSummary(text, ml);

test('prose is cut to its first statements', () => {
  expect(summary('This URL imitates a bank sign-in page. It is served from a raw IP address. Do not enter credentials. Report it to your security team.'))
    .toBe('This URL imitates a bank sign-in page. It is served from a raw IP address. Do not enter credentials.');
});

test('bullet points are read as statements, and the risk line is left out', () => {
  const answer = 'Risk Level: High\n- Raw IP address in place of a domain\n- "paypal.com" appears in the path, not the host\n- The page is served without HTTPS\n- Reputation is unverified';
  expect(summary(answer)).toBe('Raw IP address in place of a domain. "paypal.com" appears in the path, not the host. The page is served without HTTPS.');
  expect(summary('**Risk Level:** Low\n\n* Nothing specific was checked for this address')).toBe('Nothing specific was checked for this address.');
});

test.each([
  ['Risk Level: Low'],
  ['- Low\n- ok'],
  ['Unverified.'],
  ['Low. No. Ok.'],
  ['   \n  ']
])('a very short answer (%j) still gives a summary with words in it', answer => {
  const result = summary(answer);
  expect(result).toMatch(/[A-Za-z]{2,}/);
  expect(result.length).toBeGreaterThan(2);
});

test('no answer at all falls back to what the models found', () => {
  expect(summary('')).toBe('phishing threat detected with 91% confidence');
  expect(summary('   \n  ')).toBe('phishing threat detected with 91% confidence.'.replace(/\.$/, ''));
});

test('a long answer is cut at 300 characters', () => {
  const result = summary(`${'This sentence is here to make the answer long enough to need cutting '.repeat(8)}.`);
  expect(result.length).toBe(300);
  expect(result.endsWith('...')).toBe(true);
});
