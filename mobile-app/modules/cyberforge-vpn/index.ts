/**
 * Local Expo module: CyberForge VPN capture engine (Android).
 *
 * The app talks to this through the typed wrapper in `src/native/vpn.ts`
 * (which calls `requireNativeModule('CyberForgeVpn')`), so this file only needs
 * to make the module discoverable to Expo autolinking. It is intentionally a
 * no-op on platforms where the native module isn't built.
 */
export {};
