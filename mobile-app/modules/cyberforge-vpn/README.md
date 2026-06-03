# cyberforge-vpn (local Expo module)

On-device network capture for CyberForge Mobile: an Android `VpnService` that
routes all traffic through an on-device TLS **MITM** proxy and captures full
HTTP request/response payloads, then streams them to the app (and the backend,
for the signed-in user).

> **Android only. Custom dev/EAS build only.** This module is autolinked by Expo
> but is **not** present in Expo Go. iOS is intentionally unimplemented (it would
> need an Apple Network Extension entitlement + App Group).

## How it fits together

```
VpnService (TUN, full route)
   │  raw IP packets
   ▼
Tun2Socks  ──►  SocksServer (localhost SOCKS5)  ──►  MitmProxy
   (libtun2socks.so)        original dst host:port        │ leaf cert from CertificateAuthority
                                                          │ decrypt → capture → re-encrypt upstream
                                                          ▼
                                                   CaptureBus ──► CyberForgeVpnModule ──► JS (onFlow/onState)
                                                                                              │
                                                                                              ▼ src/native/vpn.ts → VpnContext
                                                                                   batched POST /api/network-capture/ingest
```

- `CertificateAuthority.kt` — generates the CyberForge root CA (BouncyCastle),
  exports it for the user to trust, and mints per-host leaf certs.
- `MitmProxy.kt` — terminates TLS with the leaf cert, parses HTTP, relays to the
  real server, and emits a `CapturedFlow`.
- `SocksServer.kt` — localhost SOCKS5 front-end; the clean hand-off from the
  tunnel to the MITM engine.
- `CyberForgeVpnService.kt` — the `VpnService` lifecycle + foreground service.
- `CyberForgeVpnModule.kt` — the JS bridge (events + start/stop/CA/consent).

## Build steps

1. **Add the tun2socks native library.** This module ships everything except the
   raw packet→SOCKS engine, which is conventionally a vendored `.so` rather than
   hand-rolled Kotlin. Drop a build of [hev-socks5-tunnel] or badvpn `tun2socks`
   (exposing `Tun2Socks.start(tunFd, mtu, socksHost, socksPort)` / `stop()` via
   JNI) into:

   ```
   modules/cyberforge-vpn/android/src/main/jniLibs/<abi>/libtun2socks.so
   ```

   Until it is present the service refuses to route traffic (so it never
   black-holes the device) and reports a clear error to the UI.

2. **Make a dev build** (not Expo Go):

   ```
   cd mobile-app
   npx expo prebuild -p android
   npx expo run:android        # or: eas build -p android --profile preview
   ```

3. **On the device:** open *More → Network Capture*, tap **Install root CA** and
   trust it (Settings → Security → Encrypt credentials / install certificate),
   then **Start capture** and accept the VPN consent dialog.

## Privacy

All capture is on-device. Decrypted bodies are previewed/redacted (Authorization,
Cookie, Set-Cookie stripped) before leaving the device, and only the signed-in
user's records are synced. The root CA private key never leaves the phone's
private storage.

[hev-socks5-tunnel]: https://github.com/heiher/hev-socks5-tunnel
