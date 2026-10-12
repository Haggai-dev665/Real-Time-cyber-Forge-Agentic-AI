// The landing page is static. "Building" it means copying it to the directory
// the backend serves in production, with the page itself renamed to index.html.
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'cyberforge-landing');
const target = path.join(__dirname, '..', 'backend', 'public');

fs.mkdirSync(target, { recursive: true });
const copied = fs.readdirSync(source, { withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => {
    const name = entry.name === 'cyberforge.html' ? 'index.html' : entry.name;
    fs.copyFileSync(path.join(source, entry.name), path.join(target, name));
    return name;
  });

console.log(`Landing page synced to backend/public: ${copied.sort().join(', ')}`);
