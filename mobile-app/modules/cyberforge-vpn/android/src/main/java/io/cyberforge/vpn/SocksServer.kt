package io.cyberforge.vpn

import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Minimal localhost SOCKS5 server that is the hand-off point between the packet
 * tunnel and the [MitmProxy]. The tun2socks forwarder converts every TCP flow
 * leaving the TUN into a SOCKS5 CONNECT to here; we read the requested original
 * destination (host/IP + port) from the SOCKS handshake and pass the connection
 * straight to the MITM engine. Only CONNECT is supported (no auth, localhost
 * only), which is all a transparent tunnel needs.
 */
class SocksServer(
    private val proxy: MitmProxy,
    private val hostForIp: (String) -> String?,
) {
    private val pool = Executors.newCachedThreadPool()
    private val running = AtomicBoolean(false)
    private var server: ServerSocket? = null
    var port: Int = 0; private set

    fun start() {
        if (running.getAndSet(true)) return
        val ss = ServerSocket(0, 128, InetAddress.getByName("127.0.0.1"))
        server = ss
        port = ss.localPort
        pool.execute {
            while (running.get()) {
                val client = try { ss.accept() } catch (_: Exception) { break }
                pool.execute { runCatching { serve(client) } }
            }
        }
    }

    fun stop() {
        running.set(false)
        runCatching { server?.close() }
        pool.shutdownNow()
    }

    private fun serve(client: Socket) {
        val cin = client.getInputStream()
        val cout = client.getOutputStream()

        // ── greeting: VER, NMETHODS, METHODS… → reply "no auth" ──
        val ver = cin.read()
        if (ver != 0x05) { client.close(); return }
        val nMethods = cin.read()
        repeat(maxOf(0, nMethods)) { cin.read() }
        cout.write(byteArrayOf(0x05, 0x00)); cout.flush()

        // ── request: VER CMD RSV ATYP DST.ADDR DST.PORT ──
        if (cin.read() != 0x05) { client.close(); return }
        val cmd = cin.read()
        cin.read() // RSV
        val atyp = cin.read()
        val (host, ipLiteral) = when (atyp) {
            0x01 -> { // IPv4
                val a = ByteArray(4); readFully(cin, a)
                val ip = a.joinToString(".") { (it.toInt() and 0xFF).toString() }
                (hostForIp(ip) ?: ip) to ip
            }
            0x03 -> { // domain
                val len = cin.read()
                val d = ByteArray(len); readFully(cin, d)
                String(d, Charsets.US_ASCII) to null
            }
            0x04 -> { // IPv6
                val a = ByteArray(16); readFully(cin, a)
                val ip = InetAddress.getByAddress(a).hostAddress ?: "::"
                (hostForIp(ip) ?: ip) to ip
            }
            else -> { client.close(); return }
        }
        val p1 = cin.read(); val p2 = cin.read()
        val port = ((p1 and 0xFF) shl 8) or (p2 and 0xFF)

        if (cmd != 0x01) { // only CONNECT
            cout.write(byteArrayOf(0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0)); cout.flush()
            client.close(); return
        }

        // Success reply (bound addr 0.0.0.0:0 — fine for a transparent tunnel).
        cout.write(byteArrayOf(0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0)); cout.flush()

        // Hand the now-established client stream to the MITM engine. `ipLiteral`
        // is kept for capture metadata when we only had an IP.
        proxy.handle(client, host, port, null)
    }

    private fun readFully(input: java.io.InputStream, buf: ByteArray) {
        var off = 0
        while (off < buf.size) {
            val r = input.read(buf, off, buf.size - off)
            if (r < 0) break
            off += r
        }
    }
}
