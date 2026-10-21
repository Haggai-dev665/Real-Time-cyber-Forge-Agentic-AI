// Android capture is offered only in a build that can capture (finding F16):
// the native module must be linked and its packet engine must have loaded.
const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '..', '..', '..');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');

test('the native module reports whether the packet engine loaded', () => {
  const module = read('mobile-app/modules/cyberforge-vpn/android/src/main/java/io/cyberforge/vpn/CyberForgeVpnModule.kt');
  expect(module).toMatch(/Function\("engineAvailable"\)\s*\{\s*Tun2Socks\.isAvailable\(\)\s*\}/);
  const engine = read('mobile-app/modules/cyberforge-vpn/android/src/main/java/io/cyberforge/vpn/Tun2Socks.kt');
  expect(engine).toMatch(/System\.loadLibrary\("tun2socks"\)/);
});

test('capture counts as available only with the module and the engine', () => {
  const vpn = read('mobile-app/src/native/vpn.ts');
  expect(vpn).toMatch(/Platform\.OS !== 'android' \? 'not_android' : native === null \? 'module_missing' : !engineLoaded\(native\) \? 'engine_missing' : null;/);
  expect(vpn).toMatch(/export const isSupported = unavailableReason === null;/);
  // an older native build without the function counts as having no engine
  expect(vpn).toMatch(/typeof module\.engineAvailable === 'function' && module\.engineAvailable\(\) === true/);
});

test('capture is featured, and described as available, only when it is', () => {
  const sections = read('mobile-app/src/data/sections.ts');
  expect(sections).toMatch(/import \{ isSupported as captureAvailable \} from '\.\.\/native\/vpn';/);
  expect(sections).toMatch(/\.\.\.\(captureAvailable \? \['vpn'\] : \[\]\)/);
  expect(sections).toMatch(/sub: captureAvailable \? 'on-device capture' : 'not available in this build'/);
  const screen = read('mobile-app/app/capture.tsx');
  expect(screen).toContain('UNAVAILABLE_TEXT[unavailableReason]');
});

test('the engine library is not in the repository yet, so no build here advertises capture', () => {
  // When libtun2socks.so is added (plan section 8, M6), this test is replaced by the capture release gate.
  const jni = path.join(repo, 'mobile-app', 'modules', 'cyberforge-vpn', 'android', 'src', 'main', 'jniLibs');
  const libraries = fs.existsSync(jni)
    ? fs.readdirSync(jni, { recursive: true }).filter(name => String(name).endsWith('libtun2socks.so'))
    : [];
  expect(libraries).toEqual([]);
});
