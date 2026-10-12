const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(filename) : filename.endsWith('.js') ? [filename] : [];
  });
}

const files = ['src', 'scripts', 'tests'].flatMap(directory =>
  javascriptFiles(path.join(__dirname, '..', directory))
);
for (const filename of files) {
  const result = spawnSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    if (result.error) console.error(result.error.message);
    process.exit(result.status || 1);
  }
}
console.log(`Syntax checked ${files.length} backend JavaScript files.`);
