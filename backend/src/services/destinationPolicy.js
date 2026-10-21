/**
 * Which addresses the backend will have fetched for a user (SEC-04, F19).
 *
 * A URL a user asks to scan is sent to the rendered-page scanner, which loads
 * it. This policy runs first, in the backend, so a scan cannot be aimed at an
 * internal or private destination, and an internal host name is never handed
 * to the outside service at all. The scanner applies its own check as well;
 * this one does not rely on it.
 *
 * Refused:
 *   - schemes other than http and https, and credentials in the URL;
 *   - host names that are internal by definition: localhost, *.localhost,
 *     *.local, *.internal, *.home.arpa, and names with no dot;
 *   - IP addresses that are not public, in any form the URL parser accepts
 *     (it turns 2130706433, 0x7f000001 and 0177.0.0.1 into 127.0.0.1): IPv4
 *     loopback, private, carrier-grade NAT, link-local (including the cloud
 *     metadata address 169.254.169.254), multicast and reserved; IPv6
 *     loopback, unspecified, link-local, unique-local, multicast, and IPv4
 *     addresses written as IPv6;
 *   - names that resolve to any such address.
 *
 * A name that does not resolve is allowed: the scanner will fail to load it
 * and say so. The check is made when the request is sent. The scanner
 * resolves the name again when it connects, so a name that changes its answer
 * in between (DNS rebinding) is the scanner's own check to stop.
 */
const dns = require('dns');
const net = require('net');

const LOOKUP_TIMEOUT_MS = 3000;

const INTERNAL_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan', '.intranet', '.corp'];

// [first address as a number, prefix length]
const BLOCKED_V4 = [
  ['0.0.0.0', 8],        // "this network"
  ['10.0.0.0', 8],       // private
  ['100.64.0.0', 10],    // carrier-grade NAT
  ['127.0.0.0', 8],      // loopback
  ['169.254.0.0', 16],   // link-local, cloud metadata
  ['172.16.0.0', 12],    // private
  ['192.0.0.0', 24],     // IETF protocol assignments
  ['192.168.0.0', 16],   // private
  ['198.18.0.0', 15],    // benchmarking
  ['224.0.0.0', 4],      // multicast
  ['240.0.0.0', 4],      // reserved, broadcast
].map(([address, bits]) => [v4ToNumber(address), bits]);

function v4ToNumber(address) {
  return address.split('.').reduce((total, part) => (total * 256) + Number(part), 0);
}

function blockedV4(address) {
  const value = v4ToNumber(address);
  return BLOCKED_V4.some(([start, bits]) => Math.floor(value / 2 ** (32 - bits)) === Math.floor(start / 2 ** (32 - bits)));
}

/** The eight 16-bit groups of an IPv6 address. */
function v6Groups(address) {
  let text = address.toLowerCase();
  // a trailing dotted IPv4 part becomes two groups
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const n = v4ToNumber(dotted[1]);
    text = text.slice(0, -dotted[1].length) + `${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`;
  }
  const [head, tail] = text.split('::');
  const left = head ? head.split(':') : [];
  const right = tail !== undefined && tail ? tail.split(':') : [];
  const missing = 8 - left.length - right.length;
  const groups = [...left, ...Array(Math.max(0, missing)).fill('0'), ...right].map(group => parseInt(group || '0', 16));
  return groups.length === 8 && groups.every(Number.isFinite) ? groups : null;
}

function blockedV6(address) {
  const g = v6Groups(address);
  if (!g) return true; // not understood: not allowed
  const allZero = g.every(x => x === 0);
  if (allZero) return true;                                                     // ::
  if (g.slice(0, 7).every(x => x === 0) && g[7] === 1) return true;            // ::1
  if ((g[0] & 0xffc0) === 0xfe80) return true;                                  // fe80::/10 link-local
  if ((g[0] & 0xfe00) === 0xfc00) return true;                                  // fc00::/7 unique-local
  if ((g[0] & 0xff00) === 0xff00) return true;                                  // ff00::/8 multicast
  // IPv4 written as IPv6: ::ffff:a.b.c.d (mapped), ::a.b.c.d (compatible), 64:ff9b::a.b.c.d (NAT64)
  const embedded = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  if (g.slice(0, 5).every(x => x === 0) && (g[5] === 0xffff || g[5] === 0)) return blockedV4(embedded);
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every(x => x === 0)) return blockedV4(embedded);
  return false;
}

/** Whether an IP address (v4 or v6, without brackets) may be fetched. */
function isPublicAddress(address) {
  const kind = net.isIP(address);
  if (kind === 4) return !blockedV4(address);
  if (kind === 6) return !blockedV6(address);
  return false;
}

function systemLookup(hostname) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('lookup timed out'), { code: 'ETIMEOUT' })), LOOKUP_TIMEOUT_MS);
    dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      clearTimeout(timer);
      if (error) reject(error); else resolve(addresses.map(entry => entry.address));
    });
  });
}

const refuse = (code, reason) => ({ allowed: false, code, reason });

/**
 * Decide whether a URL may be fetched.
 * @param {string} rawUrl
 * @param {{ lookup?: (hostname: string) => Promise<string[]> }} [options] - the resolver; tests pass their own
 * @returns {Promise<{ allowed: true, url: string, addresses: string[], resolved: boolean } | { allowed: false, code: string, reason: string }>}
 */
async function checkDestination(rawUrl, { lookup = systemLookup } = {}) {
  let url;
  try {
    url = new URL(String(rawUrl).trim());
  } catch (_) {
    return refuse('DESTINATION_INVALID', 'not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return refuse('DESTINATION_SCHEME', 'only http and https addresses are scanned');
  if (url.username || url.password) return refuse('DESTINATION_CREDENTIALS', 'addresses with a user name or password are not scanned');

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const literal = host.startsWith('[') ? host.slice(1, -1) : host;
  if (net.isIP(literal)) {
    return isPublicAddress(literal)
      ? { allowed: true, url: url.href, addresses: [literal], resolved: true }
      : refuse('DESTINATION_PRIVATE', 'the address is internal, private or reserved');
  }
  if (!host || host === 'localhost' || !host.includes('.') || INTERNAL_SUFFIXES.some(suffix => host.endsWith(suffix))) {
    return refuse('DESTINATION_INTERNAL_NAME', 'the host name is an internal one');
  }

  let addresses;
  try {
    addresses = await lookup(host);
  } catch (_) {
    // Not resolvable here: the scanner will not load it either, and will say so.
    return { allowed: true, url: url.href, addresses: [], resolved: false };
  }
  if (addresses.some(address => !isPublicAddress(address))) {
    return refuse('DESTINATION_RESOLVES_PRIVATE', 'the host name resolves to an internal, private or reserved address');
  }
  return { allowed: true, url: url.href, addresses, resolved: true };
}

module.exports = { checkDestination, isPublicAddress };
