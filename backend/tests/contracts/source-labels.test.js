// Static analysis, public threat intelligence and the user's own incidents are
// labelled as what they are (DET-03, DET-04; checklist "labeled distinctly").
const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '..', '..', '..');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');

function files(dir, pattern) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(repo, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...files(rel, pattern));
    else if (pattern.test(entry.name)) out.push(rel);
  }
  return out;
}
const desktopUi = files('desktop/ui', /\.(html|js)$/).filter(f => !f.includes('/vendor/'));
const phone = [...files('mobile-app/src', /\.(ts|tsx)$/), ...files('mobile-app/app', /\.(ts|tsx)$/)];

test('public intelligence is never called a live attack', () => {
  for (const file of [...desktopUi, ...phone, 'README.md']) {
    expect({ file, found: /live attack|attacks\/min|attack map|worldwide attacks/i.test(read(file)) }).toEqual({ file, found: false });
  }
});

test('the desktop globe names its source and keeps the user\'s own events in their own panel', () => {
  const html = read('desktop/ui/pages/threat-globe.html');
  const js = read('desktop/ui/scripts/pages/threat-globe.js');
  expect(html).toContain('Public intelligence · AlienVault OTX');
  expect(html).toContain('not activity on your devices');
  expect(html).toContain('id="ownStream"');
  // each pulse shows its own publication age; nothing cycles with invented seconds
  expect(js).toMatch(/el\.querySelector\('\.when'\)\.textContent=ago\(p\.at\);/);
  expect(js).not.toMatch(/setInterval\(streamNext/);
  // the account's scans, threats and alerts go to the separate panel
  expect(js).toMatch(/function liveAtk\(label,sub,sev\)\{ var stream=ownStream;/);
});

test('no page header shows a fixed threat count', () => {
  for (const file of desktopUi.filter(f => f.endsWith('.js'))) {
    expect({ file, fixed: /buildHeader\(\{[^}]*threats:'\d+'/.test(read(file)) }).toEqual({ file, fixed: false });
  }
});

test('the phone globe shows public items and the account\'s events apart, with only the values given', () => {
  const globe = read('mobile-app/app/(tabs)/globe.tsx');
  expect(globe).toContain('<SecLabel>On your account · live</SecLabel>');
  expect(globe).toContain('<SecLabel>Public intelligence · AlienVault OTX</SecLabel>');
  // no severity or time is filled in for an item that has none
  expect(globe).not.toMatch(/severity: \(d\.severity as string\) \|\| 'high'/);
  expect(globe).not.toMatch(/Date\.now\(\) - i \*/);
  expect(read('mobile-app/src/sections/DataSections.tsx')).toContain('<SecLabel>Public threat intelligence · AlienVault OTX</SecLabel>');
});

test('the sandbox is static analysis, and its MITRE tiles are hints with a reason', () => {
  // no visible text promises detonation or a sandbox VM
  for (const file of desktopUi.filter(f => f.endsWith('.html'))) {
    const visible = read(file).replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
    const text = visible.match(/>[^<]*</g) || [];
    expect({ file, detonation: text.filter(t => /detonat/i.test(t)) }).toEqual({ file, detonation: [] });
  }
  expect(read('desktop/ui/scripts/installer.js')).not.toMatch(/detonat/i);
  for (const file of phone) expect({ file, found: /detonat/i.test(read(file)) }).toEqual({ file, found: false });

  const analyzer = read('desktop/ui/scripts/pages/analyzer.js');
  expect(analyzer).toContain("if(phishWhy) signals.push('Possible phishing technique, not confirmed: '+phishWhy[0]");
  expect(analyzer).toContain("if(evadeWhy) signals.push('Possible evasion technique, not confirmed: '+evadeWhy[0]");
  expect(read('desktop/ui/pages/analyzer.html')).toContain('not confirmed techniques');
  expect(read('desktop/ui/scripts/pages/sandbox.js')).toContain("location.replace('analyzer.html'");
});

test('no certification or capability is claimed that the product does not have', () => {
  for (const file of [...desktopUi, ...phone, 'README.md']) {
    expect({ file, found: /SOC ?2|hardware-key MFA/i.test(read(file)) }).toEqual({ file, found: false });
  }
});

test('reports never count public intelligence as a scan, risk or action', () => {
  const shared = read('desktop/ui/scripts/cyberforge-shared.js');
  expect(shared).toMatch(/var own=inWin\.filter\(function\(m\)\{ return !isIntel\(m\); \}\);/);
  for (const name of ['scans', 'actions', 'risks']) expect(shared).toMatch(new RegExp(`var ${name}=own\\.filter\\(`));
  expect(shared).toContain('not activity seen on this computer, and not to be reported as an incident');
});
