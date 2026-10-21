/**
 * Remove credentials from an address before it leaves the phone, keeping the
 * page it names.
 *
 * The same rules as the desktop's `redact_url` and the backend's
 * `utils/redactUrl.js`, checked against the same examples
 * (backend/tests/security/fixtures/redact-url-vectors.json):
 *   - a query or fragment parameter whose name says it is a credential or a
 *     one-time code (token, secret, password, session, code, state, key, …);
 *   - any value shaped like a token whatever it is called: a JWT, or a long
 *     unbroken run of letters and digits (text with spaces does not count);
 *   - such a token used as a path segment;
 *   - `user:password@` in the address.
 */
const REDACTED = '[redacted]';
const SECRET_PARTS = ['token', 'secret', 'passw', 'pwd', 'apikey', 'api_key', 'session', 'signature', 'credential', 'jwt', 'saml', 'oauth', 'authorization'];
const SECRET_WHOLE = new Set(['key', 'code', 'sig', 'ticket', 'state', 'nonce', 'auth', 'sid', 'otp', 'pass', 'pin', 'code_challenge', 'code_verifier', 'assertion']);

function isSecretParameter(name: string): boolean {
  const n = name.toLowerCase();
  return SECRET_PARTS.some((part) => n.includes(part)) || SECRET_WHOLE.has(n);
}

function looksLikeSecret(value: string): boolean {
  if (value.startsWith('eyJ') && value.length >= 40 && value.includes('.')) return true;
  return (
    value.length >= 48 &&
    !value.includes('+') &&
    !value.includes('%20') &&
    /^[A-Za-z0-9_\-.~%/=]+$/.test(value) &&
    /[0-9]/.test(value) &&
    /[A-Za-z]/.test(value)
  );
}

function redactPairs(pairs: string): string {
  return pairs
    .split('&')
    .map((pair) => {
      const at = pair.indexOf('=');
      if (at < 0) return pair;
      const name = pair.slice(0, at);
      const value = pair.slice(at + 1);
      return value && (isSecretParameter(name) || looksLikeSecret(value)) ? `${name}=${REDACTED}` : pair;
    })
    .join('&');
}

function splitOnce(text: string, separator: string): [string, string | null] {
  const at = text.indexOf(separator);
  return at < 0 ? [text, null] : [text.slice(0, at), text.slice(at + separator.length)];
}

export function redactUrl(url: string | null | undefined): string {
  const text = url == null ? '' : String(url);
  const [beforeFragment, fragment] = splitOnce(text, '#');
  const [location, query] = splitOnce(beforeFragment, '?');
  const [first, afterScheme] = splitOnce(location, '://');
  const scheme = afterScheme === null ? null : first;
  const rest = afterScheme === null ? location : afterScheme;
  const slash = rest.indexOf('/');
  const authority = slash < 0 ? rest : rest.slice(0, slash);
  const path = slash < 0 ? '' : rest.slice(slash);

  let out = scheme === null ? '' : `${scheme}://`;
  const at = authority.lastIndexOf('@');
  out += scheme !== null && at >= 0 ? authority.slice(at + 1) : authority;
  out += path
    .split('/')
    .map((segment) => (looksLikeSecret(segment) ? REDACTED : segment))
    .join('/');
  if (query !== null) out += `?${redactPairs(query)}`;
  if (fragment !== null) {
    // "#access_token=…&id_token=…" is how some sign-in flows return tokens
    out += `#${fragment.includes('=') ? redactPairs(fragment) : looksLikeSecret(fragment) ? REDACTED : fragment}`;
  }
  return out;
}
