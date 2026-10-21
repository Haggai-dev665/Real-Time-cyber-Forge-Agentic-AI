// Build the cyberforge CLI and place it where Tauri bundles sidecars from:
// src-tauri/binaries/cyberforge-<target triple>[.exe]. Run by `npm run build`
// before `tauri build --config src-tauri/tauri.cli.conf.json`, which installs
// it beside the app as `cyberforge` (V2-01). The binaries folder is build
// output and is not tracked.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tauri = join(dirname(fileURLToPath(import.meta.url)), '..', 'src-tauri');
const triple = process.env.TAURI_ENV_TARGET_TRIPLE
  || execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/^host: (\S+)$/m)[1];
const exe = triple.includes('windows') ? '.exe' : '';
const args = ['build', '-p', 'cyberforge-cli', '--release'];
if (process.env.TAURI_ENV_TARGET_TRIPLE) args.push('--target', triple);

execFileSync('cargo', args, { cwd: tauri, stdio: 'inherit' });
const built = join(tauri, 'target', ...(process.env.TAURI_ENV_TARGET_TRIPLE ? [triple] : []), 'release', `cyberforge${exe}`);
mkdirSync(join(tauri, 'binaries'), { recursive: true });
copyFileSync(built, join(tauri, 'binaries', `cyberforge-${triple}${exe}`));
console.log(`cyberforge CLI ready for bundling: binaries/cyberforge-${triple}${exe}`);
