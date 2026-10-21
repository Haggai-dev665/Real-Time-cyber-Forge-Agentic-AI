const fs = require('fs');
const path = require('path');

// A desktop page's source: its HTML followed by the page scripts it loads from
// scripts/pages and scripts/components. The code was moved out of the HTML so
// the desktop CSP needs no 'unsafe-inline' (SEC-05); source checks read both,
// so a check that something is absent cannot pass on the HTML alone.
function readPage(file) {
  const html = fs.readFileSync(file, 'utf8');
  if (!file.endsWith('.html')) return html;
  const scripts = [...html.matchAll(/<script src="([^"]*scripts\/(?:pages|components)\/[^"]+\.js)"><\/script>/g)]
    .map(match => fs.readFileSync(path.resolve(path.dirname(file), match[1]), 'utf8'));
  return [html, ...scripts].join('\n');
}

module.exports = { readPage };
