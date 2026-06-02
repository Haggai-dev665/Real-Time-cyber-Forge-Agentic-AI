const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const rendererDir = path.join(repoRoot, 'desktop-app', 'src', 'renderer');
const screensDir = path.join(rendererDir, 'screens');
const templatePath = path.join(rendererDir, 'dashboard.html');
const outputMapPath = path.join(rendererDir, 'screen-page-map.md');

const template = fs.readFileSync(templatePath, 'utf8');
const screenFiles = fs.readdirSync(screensDir).filter(f => f.endsWith('.js'));

const screenBaseNames = screenFiles.map(f => f.replace(/\.js$/, ''));
const screenSet = new Set(screenBaseNames);

function resolveHref(screenId) {
  if (screenSet.has(screenId)) return `${screenId}.html`;
  if (screenSet.has(`${screenId}-screen`)) return `${screenId}-screen.html`;
  if (screenSet.has(`${screenId}-page`)) return `${screenId}-page.html`;
  return 'operational-page.html';
}

function updateSidebarHrefs(html) {
  return html.replace(/<a([^>]*?)data-screen="([^"]+)"([^>]*?)>/g, (match, pre, screenId, post) => {
    const attrs = `${pre} ${post}`.replace(/\s+href="[^"]*"/g, '');
    const href = resolveHref(screenId);
    return `<a${attrs} href="${href}" data-screen="${screenId}">`;
  });
}

function stripScreenScripts(html) {
  return html
    .replace(/\n\s*<script src="screens\/[^"]+"><\/script>/g, '')
    .replace(/\n\s*<script src="screens\/[^"]+"\s*><\/script>/g, '');
}

function setVendorLibs(html, uses) {
  let out = html;
  if (!uses.leaflet) {
    out = out
      .replace(/\n\s*<link rel="stylesheet" href="https:\/\/unpkg\.com\/leaflet[^\n]+>/g, '')
      .replace(/\n\s*<script src="https:\/\/unpkg\.com\/leaflet[^\n]+><\/script>/g, '');
  }
  if (!uses.three) {
    out = out
      .replace(/\n\s*<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js[^\n]+><\/script>/g, '')
      .replace(/\n\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/three[^\n]+><\/script>/g, '');
  }
  if (!uses.chart) {
    out = out.replace(/\n\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js"><\/script>/g, '');
  }
  return out;
}

function detectLibs(js) {
  return {
    leaflet: /\bleaflet\b|\bL\./i.test(js),
    three: /\bTHREE\b|OrbitControls|three\b/i.test(js),
    chart: /\bChart\b|chartjs|chart\.js/i.test(js)
  };
}

function needsTodo(js) {
  return !/(getElementById|querySelector|innerHTML|classList|createElement)/.test(js);
}

function insertScreenScript(html, screenFile) {
  const marker = '<!-- Main App (lightweight initializer with delegation stubs) -->';
  const scriptTag = `    <script src="screens/${screenFile}"></script>`;
  if (html.includes(marker)) {
    return html.replace(marker, `${scriptTag}\n\n    ${marker}`);
  }
  return html.replace('</body>', `${scriptTag}\n</body>`);
}

function insertTodo(html, screenBase) {
  const todo = `\n                    <!-- TODO: Screen layout hooks for ${screenBase}.js if required by DOM selectors -->`;
  return html.replace(/<div id="screen-container" class="cf-split-view">/, (m) => `${m}${todo}`);
}

const mappingRows = [];
const missingScreens = [];

screenFiles.forEach((screenFile) => {
  const base = screenFile.replace(/\.js$/, '');
  const htmlName = `${base}.html`;
  const jsPath = path.join(screensDir, screenFile);
  const jsContent = fs.readFileSync(jsPath, 'utf8');
  const libs = detectLibs(jsContent);

  let html = template;
  html = updateSidebarHrefs(html);
  html = stripScreenScripts(html);
  html = setVendorLibs(html, libs);
  html = insertScreenScript(html, screenFile);

  if (needsTodo(jsContent)) {
    html = insertTodo(html, base);
    missingScreens.push(screenFile);
  }

  const outPath = path.join(rendererDir, htmlName);
  fs.writeFileSync(outPath, html, 'utf8');
  mappingRows.push(`| ${screenFile} | ${htmlName} |`);
});

const mapHeader = [
  '# Screen JS to HTML Map',
  '',
  '| Screen JS | HTML Page |',
  '| --- | --- |'
];

const mapNotes = missingScreens.length
  ? ['','## Notes','', 'The following screens do not include obvious DOM selectors; verify required containers and add hooks if needed:', '', ...missingScreens.map(f => `- ${f}`)]
  : ['','## Notes','', 'All screens include DOM selectors or layout hooks.'];

fs.writeFileSync(outputMapPath, [...mapHeader, ...mappingRows, ...mapNotes].join('\n'), 'utf8');

console.log(`Generated ${screenFiles.length} screen pages.`);
console.log(`Mapping written to ${outputMapPath}`);
