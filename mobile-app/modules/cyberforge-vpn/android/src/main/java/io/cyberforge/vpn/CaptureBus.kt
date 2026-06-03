package io.cyberforge.vpn

import java.util.concurrent.CopyOnWriteArrayList

/** One captured network flow (post-MITM when the body was decryptable). */
data class CapturedFlow(
    val id: String,
    val ts: Long,
    val host: String,
    val scheme: String,
    val method: String? = null,
    val path: String? = null,
    val url: String? = null,
    val ip: String? = null,
    val port: Int? = null,
    val status: Int? = null,
    val mime: String? = null,
    val reqBytes: Long = 0,
    val respBytes: Long = 0,
    val durationMs: Long = 0,
    val app: String? = null,
    val decrypted: Boolean = false,
    val reqHeaders: Map<String, String>? = null,
    val respHeaders: Map<String, String>? = null,
    val reqBodyPreview: String? = null,
    val respBodyPreview: String? = null,
    val flags: List<String> = emptyList(),
) {
    fun toMap(): Map<String, Any?> = mapOf(
        "id" to id,
        "ts" to ts,
        "host" to host,
        "scheme" to scheme,
        "method" to method,
        "path" to path,
        "url" to url,
        "ip" to ip,
        "port" to port,
        "status" to status,
        "mime" to mime,
        "reqBytes" to reqBytes,
        "respBytes" to respBytes,
        "durationMs" to durationMs,
        "app" to app,
        "decrypted" to decrypted,
        "reqHeaders" to reqHeaders,
        "respHeaders" to respHeaders,
        "reqBodyPreview" to reqBodyPreview,
        "respBodyPreview" to respBodyPreview,
        "flags" to flags,
    )
}

enum class VpnStatus(val wire: String) {
    IDLE("idle"), PREPARING("preparing"), RUNNING("running"),
    STOPPING("stopping"), ERROR("error");
}

/**
 * Process-wide pub/sub between the [CyberForgeVpnService] (producer) and the
 * [CyberForgeVpnModule] (consumer that forwards events to JS). Decoupling them
 * this way means the service can run and capture even if the JS module is
 * temporarily torn down, and the module just re-attaches its listener.
 */
object CaptureBus {
    interface Listener {
        fun onFlow(flow: CapturedFlow)
        fun onState(status: VpnStatus, flowCount: Int, caInstalled: Boolean, error: String?)
    }

    private val listeners = CopyOnWriteArrayList<Listener>()

    @Volatile var status: VpnStatus = VpnStatus.IDLE
        private set
    @Volatile var flowCount: Int = 0
        private set
    @Volatile var lastError: String? = null
        private set

    fun addListener(l: Listener) { listeners.addIfAbsent(l) }
    fun removeListener(l: Listener) { listeners.remove(l) }

    fun emitFlow(flow: CapturedFlow) {
        flowCount += 1
        listeners.forEach { runCatching { it.onFlow(flow) } }
    }

    fun setState(status: VpnStatus, caInstalled: Boolean, error: String? = null) {
        this.status = status
        this.lastError = error
        listeners.forEach { runCatching { it.onState(status, flowCount, caInstalled, error) } }
    }

    fun resetCounters() { flowCount = 0 }
}
