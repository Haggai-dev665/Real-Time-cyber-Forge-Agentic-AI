// The desktop's Google sign-in uses state and PKCE (RFC 8252, RFC 7636), and the
// backend's code exchange requires the verifier (authentication.test.js).
const fs = require('fs');
const path = require('path');

const agent = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'desktop', 'src-tauri', 'src', 'agent.rs'), 'utf8');
const flow = agent.slice(agent.indexOf('pub async fn auth_google'), agent.indexOf('// 6) flatten + persist'));

test('the consent request carries a random state and an S256 PKCE challenge', () => {
  expect(flow).toMatch(/let state_value = crate::oauth::random_token\(32\)\?;/);
  expect(flow).toMatch(/let verifier = crate::oauth::random_token\(32\)\?;/);
  expect(flow).toMatch(/&state=\{\}&code_challenge=\{\}&code_challenge_method=S256/);
});

test('the callback is taken only with the same state, compared whole', () => {
  expect(flow).toMatch(/crate::oauth::parse_callback\(path, urldecode\)/);
  expect(flow).toMatch(/if !crate::oauth::same_secret\(&returned, &state_value\)/);
});

test('the verifier goes to the backend with the code', () => {
  expect(flow).toMatch(/"code_verifier": verifier/);
});
