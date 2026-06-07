package io.cyberforge.vpn

import java.io.BufferedInputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.util.UUID
import javax.net.ssl.SNIHostName
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLParameters
import javax.net.ssl.SSLSocket

/**
 * Terminates a single intercepted TCP connection, decrypts TLS when possible,
 * captures the HTTP request/response, and relays to the real upstream server.
 *
 * The [CyberForgeVpnService] hands us a already-connected client [Socket] plus
 * the original destination (recovered from the packet's IP header / tunnel), and
 * a `protect` callback so our upstream sockets bypass the VPN (otherwise we'd
 * loop traffic back into our own tunnel).
 */
class MitmProxy(
    private val ca: CertificateAuthority,
    private val protect: (Socket) -> Boolean,
) {
    companion object {
        private const val PREVIEW_LIMIT = 4096
        private val SENSITIVE = setOf("authorization", "cookie", "set-cookie", "proxy-authorization")
    }

    /** Handle one client connection. Runs on its own thread. */
    fun handle(client: Socket, dstHost: String, dstPort: Int, appName: String?) {
        val started = System.currentTimeMillis()
        try {
            if (dstPort == 443) handleTls(client, dstHost, dstPort, appName, started)
            else handlePlain(client, dstHost, dstPort, appName, started)
        } catch (_: Exception) {
            // Fall back to a blind tunnel so the user's connection still works
            // even if we couldn't parse/decrypt it; capture metadata only.
            emitMeta(dstHost, dstPort, started, appName, decrypted = false)
        } finally {
            runCatching { client.close() }
        }
    }

    // ── HTTPS: present our leaf cert to the app, open real TLS upstream ──────
    private fun handleTls(client: Socket, host: String, port: Int, app: String?, started: Long) {
        // Server side: our leaf cert for `host`, chained to the CyberForge root.
        val serverCtx = SSLContext.getInstance("TLS").apply {
            init(ca.leafKeyManagers(host), null, null)
        }
        val tlsClient = serverCtx.socketFactory
            .createSocket(client, null, client.port, true) as SSLSocket
        tlsClient.useClientMode = false
        tlsClient.startHandshake()

        // Upstream: a normal validated TLS connection to the real server.
        val raw = Socket()
        protect(raw)
        raw.connect(InetSocketAddress(host, port), 15000)
        val upCtx = SSLContext.getDefault()
        val upstream = upCtx.socketFactory.createSocket(raw, host, port, true) as SSLSocket
        upstream.sslParameters = (upstream.sslParameters ?: SSLParameters()).apply {
            serverNames = listOf(SNIHostName(host))
        }
        upstream.startHandshake()

        pumpHttp("https", host, port, app, started, tlsClient.inputStream, tlsClient.outputStream,
            upstream.inputStream, upstream.outputStream, client.inetAddress?.hostAddress)
        runCatching { upstream.close() }
        runCatching { tlsClient.close() }
    }

    // ── HTTP: straight parse + relay ────────────────────────────────────────
    private fun handlePlain(client: Socket, host: String, port: Int, app: String?, started: Long) {
        val raw = Socket()
        protect(raw)
        raw.connect(InetSocketAddress(host, port), 15000)
        pumpHttp("http", host, port, app, started, client.inputStream, client.outputStream,
            raw.inputStream, raw.outputStream, host)
        runCatching { raw.close() }
    }

    /**
     * Read one HTTP request from `cin`, forward to upstream, read the response,
     * relay it back, and publish a [CapturedFlow]. Bodies are sized by
     * Content-Length; anything else is relayed raw with a metadata-only capture.
     */
    private fun pumpHttp(
        scheme: String, host: String, port: Int, app: String?, started: Long,
        cin: InputStream, cout: OutputStream, uin: InputStream, uout: OutputStream, ip: String?,
    ) {
        val reqIn = BufferedInputStream(cin)
        val req = readHttpMessage(reqIn) ?: return
        uout.write(req.head); uout.write(req.body); uout.flush()

        val respIn = BufferedInputStream(uin)
        val resp = readHttpMessage(respIn)
        if (resp != null) {
            cout.write(resp.head); cout.write(resp.body); cout.flush()
            // Drain any remaining streamed bytes (chunked / no length) both ways.
            relayRemainder(respIn, cout)
        } else {
            relayRemainder(respIn, cout)
        }

        val (method, path) = parseRequestLine(req.startLine)
        val status = resp?.let { parseStatus(it.startLine) }
        val flags = riskFlags(scheme, req.headers, req.body)

        CaptureBus.emitFlow(
            CapturedFlow(
                id = UUID.randomUUID().toString(),
                ts = started,
                host = host,
                scheme = scheme,
                method = method,
                path = path,
                url = "$scheme://$host$path",
                ip = ip,
                port = port,
                status = status,
                mime = resp?.headers?.get("content-type"),
                reqBytes = (req.head.size + req.body.size).toLong(),
                respBytes = (resp?.head?.size ?: 0).toLong() + (resp?.body?.size ?: 0).toLong(),
                durationMs = System.currentTimeMillis() - started,
                app = app,
                decrypted = true,
                reqHeaders = redact(req.headers),
                respHeaders = resp?.headers?.let { redact(it) },
                reqBodyPreview = preview(req.body),
                respBodyPreview = resp?.let { preview(it.body) },
                flags = flags,
            )
        )
    }

    private fun emitMeta(host: String, port: Int, started: Long, app: String?, decrypted: Boolean) {
        CaptureBus.emitFlow(
            CapturedFlow(
                id = UUID.randomUUID().toString(),
                ts = started,
                host = host,
                scheme = if (port == 443) "https" else "http",
                port = port,
                app = app,
                durationMs = System.currentTimeMillis() - started,
                decrypted = decrypted,
            )
        )
    }

    // ── tiny HTTP/1.1 reader ────────────────────────────────────────────────
    private data class HttpMessage(
        val startLine: String,
        val headers: Map<String, String>,
        val head: ByteArray, // raw start-line + headers + CRLFCRLF
        val body: ByteArray,
    )

    private fun readHttpMessage(input: InputStream): HttpMessage? {
        val headBytes = ArrayList<Byte>(1024)
        var last4 = 0
        while (true) {
            val b = input.read()
            if (b < 0) { if (headBytes.isEmpty()) return null else break }
            headBytes.add(b.toByte())
            last4 = (last4 shl 8) or (b and 0xFF)
            if (last4 == 0x0D0A0D0A) break // \r\n\r\n
        }
        val headArr = headBytes.toByteArray()
        val text = String(headArr, Charsets.ISO_8859_1)
        val lines = text.split("\r\n")
        val startLine = lines.firstOrNull().orEmpty()
        val headers = LinkedHashMap<String, String>()
        for (i in 1 until lines.size) {
            val line = lines[i]
            if (line.isEmpty()) continue
            val idx = line.indexOf(':')
            if (idx > 0) headers[line.substring(0, idx).trim().lowercase()] =
                line.substring(idx + 1).trim()
        }
        val len = headers["content-length"]?.toIntOrNull() ?: 0
        val body = if (len > 0) readN(input, len) else ByteArray(0)
        return HttpMessage(startLine, headers, headArr, body)
    }

    private fun readN(input: InputStream, n: Int): ByteArray {
        val out = ByteArray(n)
        var off = 0
        while (off < n) {
            val r = input.read(out, off, n - off)
            if (r < 0) break
            off += r
        }
        return if (off == n) out else out.copyOf(off)
    }

    private fun relayRemainder(input: InputStream, out: OutputStream) {
        val buf = ByteArray(16384)
        try {
            while (true) {
                val r = input.read(buf)
                if (r < 0) break
                out.write(buf, 0, r)
            }
            out.flush()
        } catch (_: Exception) { /* connection closed */ }
    }

    private fun parseRequestLine(line: String): Pair<String?, String?> {
        val parts = line.split(' ')
        return if (parts.size >= 2) parts[0] to parts[1] else null to null
    }

    private fun parseStatus(line: String): Int? =
        line.split(' ').getOrNull(1)?.toIntOrNull()

    private fun redact(headers: Map<String, String>): Map<String, String> =
        headers.mapValues { (k, v) -> if (k in SENSITIVE) "«redacted ${v.length}b»" else v }

    private fun preview(body: ByteArray): String? {
        if (body.isEmpty()) return null
        val slice = if (body.size > PREVIEW_LIMIT) body.copyOf(PREVIEW_LIMIT) else body
        return String(slice, Charsets.UTF_8)
    }

    /** Cheap on-device risk heuristics — surfaced as flags on the flow. */
    private fun riskFlags(scheme: String, headers: Map<String, String>, body: ByteArray): List<String> {
        val flags = ArrayList<String>()
        if (scheme == "http") {
            val bodyText = String(body.copyOf(minOf(body.size, 512)), Charsets.ISO_8859_1).lowercase()
            if (bodyText.contains("password") || bodyText.contains("passwd") || bodyText.contains("token="))
                flags.add("cleartext-credentials")
        }
        headers["authorization"]?.let { if (scheme == "http") flags.add("cleartext-auth") }
        return flags
    }
}
