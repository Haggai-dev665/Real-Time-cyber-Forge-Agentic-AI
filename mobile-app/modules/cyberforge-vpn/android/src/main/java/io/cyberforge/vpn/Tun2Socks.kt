package io.cyberforge.vpn

/**
 * JNI bridge to the bundled tun2socks engine that converts raw TUN packets into
 * SOCKS5 connections (the same proven approach PCAPdroid / NetGuard use, rather
 * than hand-rolling a userspace TCP/IP stack in Kotlin). It forwards every flow
 * leaving the tunnel to our localhost [SocksServer], which feeds the [MitmProxy].
 *
 * The native library (`libtun2socks.so`, e.g. a build of hev-socks5-tunnel or
 * badvpn-tun2socks) must be added under `android/src/main/jniLibs/<abi>/`. Until
 * it is present, [isAvailable] is false and the service reports a clear error
 * instead of silently black-holing the device's traffic.
 */
object Tun2Socks {
    @Volatile private var loaded = false

    init {
        loaded = try {
            System.loadLibrary("tun2socks")
            true
        } catch (_: Throwable) {
            false
        }
    }

    fun isAvailable(): Boolean = loaded

    /**
     * Start forwarding. [tunFd] is the VpnService TUN descriptor; all TCP is
     * routed to socks5://socksHost:socksPort. Blocks on a native loop until
     * [stop] is called, so callers run it on a dedicated thread.
     */
    external fun start(tunFd: Int, mtu: Int, socksHost: String, socksPort: Int): Int

    /** Signal the native loop to exit. */
    external fun stop()
}
