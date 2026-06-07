/* ============================================================
   CyberForge — inline the bundled webfonts as base64 data URIs.

   Rewrites desktop/ui/styles/fonts.css so every @font-face `src`
   embeds the woff2 bytes inline (data:font/woff2;base64,...). This
   makes the fonts 100% self-contained: as long as fonts.css loads
   (it's a local stylesheet on every page), the fonts load — no
   separate file requests, no asset-path/protocol resolution, so it
   works identically in `tauri dev` and in a packaged build.

   Run after download-fonts.js (or any time the woff2 change):
       node desktop/scripts/inline-fonts.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const uiDir = path.resolve(__dirname, '..', 'ui');
const cssPath = path.join(uiDir, 'styles', 'fonts.css');
const stylesDir = path.dirname(cssPath);

let css = fs.readFileSync(cssPath, 'utf8');

let inlined = 0;
css = css.replace(/url\(([^)]+\.woff2)\)/g, (m, ref) => {
  let p = ref.trim().replace(/^['"]|['"]$/g, '');
  if (p.startsWith('data:')) return m; // already inlined
  const file = path.resolve(stylesDir, p);
  if (!fs.existsSync(file)) {
    console.warn('  ! missing woff2, left as-is:', p);
    return m;
  }
  const b64 = fs.readFileSync(file).toString('base64');
  inlined++;
  return "url(data:font/woff2;base64," + b64 + ")";
});

fs.writeFileSync(cssPath, css);
const kb = Math.round(Buffer.byteLength(css) / 1024);
console.log('Inlined ' + inlined + ' font reference(s); fonts.css is now ' + kb + ' KB and fully self-contained.');
