/* ============================================================
   CyberForge — self-host the UI webfonts.

   Downloads the Google-hosted woff2 files for Space Grotesk +
   JetBrains Mono into desktop/ui/fonts/ and writes a local
   desktop/ui/styles/fonts.css that references them — so the
   packaged app renders identically to `tauri dev` and works
   completely offline (no Google Fonts CDN dependency).

   Run once (or whenever you change the font set / weights):
       node desktop/scripts/download-fonts.js
   ============================================================ */
const https = require('https');
const fs = require('fs');
const path = require('path');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';
// Keep these weights in sync with what the UI actually uses.
const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700' +
  '&family=JetBrains+Mono:wght@400;500;600;700&display=swap';

const uiDir = path.resolve(__dirname, '..', 'ui');
const fontsDir = path.join(uiDir, 'fonts');
const outCss = path.join(uiDir, 'styles', 'fonts.css');

function get(url, asBuffer) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': UA } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(get(res.headers.location, asBuffer));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve(asBuffer ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8'))
        );
      })
      .on('error', reject);
  });
}

(async () => {
  fs.mkdirSync(fontsDir, { recursive: true });
  let css = await get(CSS_URL, false);
  const urls = [...new Set(css.match(/https:\/\/[^)\s]+\.woff2/g) || [])];
  if (!urls.length) throw new Error('No woff2 URLs found in the Google Fonts CSS.');
  console.log('Found ' + urls.length + ' font files; downloading…');
  let i = 0;
  for (const u of urls) {
    const slug = (u.match(/\/s\/([a-z0-9]+)\//) || [, 'font'])[1];
    const name = slug + '-' + i + '.woff2';
    const buf = await get(u, true);
    // Keep a copy of the raw woff2 for reference / regeneration…
    fs.writeFileSync(path.join(fontsDir, name), buf);
    // …but EMBED it inline as a base64 data URI so the stylesheet is fully
    // self-contained — it then renders identically in dev and in a packaged
    // build with zero separate font requests (no asset-path/CSP surprises).
    css = css.split(u).join('data:font/woff2;base64,' + buf.toString('base64'));
    i++;
  }
  const banner =
    '/* CyberForge - self-hosted fonts (Space Grotesk + JetBrains Mono), inlined as\n' +
    '   base64 data URIs so the app renders identically in dev and in a packaged\n' +
    '   build with no Google Fonts CDN and no separate font files to resolve.\n' +
    '   Regenerate: node desktop/scripts/download-fonts.js */\n';
  fs.writeFileSync(outCss, banner + css);
  const kb = Math.round(Buffer.byteLength(banner + css) / 1024);
  console.log('Wrote self-contained ' + path.relative(process.cwd(), outCss) + ' (' + kb + ' KB, ' + i + ' fonts inlined).');
})().catch((e) => {
  console.error('download-fonts failed:', e.message);
  process.exit(1);
});
