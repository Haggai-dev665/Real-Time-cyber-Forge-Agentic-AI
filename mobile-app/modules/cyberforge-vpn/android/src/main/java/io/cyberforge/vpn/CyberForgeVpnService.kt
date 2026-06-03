package io.cyberforge.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import java.net.Socket
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The capture tunnel. Establishes a TUN interface that claims all traffic, then
 * uses [Tun2Socks] to forward every TCP flow into a localhost [SocksServer] that
 * feeds the [MitmProxy] (which decrypts TLS with the CyberForge root CA and
 * captures full request/response payloads). Captured flows are published on
 * [CaptureBus]; the JS layer streams them to the backend for the signed-in user.
 *
 * Connectivity safety: if the native tun2socks library isn't bundled we do NOT
 * route traffic (which would black-hole the device) — we report a clear error.
 */
class CyberForgeVpnService : VpnService() {

    companion object {
        const val ACTION_START = "io.cyberforge.vpn.START"
        const val ACTION_STOP = "io.cyberforge.vpn.STOP"
        const val EXTRA_BACKEND = "backendUrl"
        const val EXTRA_TOKEN = "token"
        const val EXTRA_USER = "userId"

        private const val CHANNEL_ID = "cyberforge_capture"
        private const val NOTIF_ID = 0x6217
        private const val MTU = 1500

        @Volatile var isRunning = false; private set
    }

    private var tun: ParcelFileDescriptor? = null
    private var socks: SocksServer? = null
    private var forwarderThread: Thread? = null
    private val stopping = AtomicBoolean(false)
    private lateinit var ca: CertificateAuthority

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { teardown(); return START_NOT_STICKY }
            else -> startCapture()
        }
        return START_STICKY
    }

    private fun startCapture() {
        if (isRunning) return
        stopping.set(false)
        CaptureBus.setState(VpnStatus.PREPARING, caInstalled = caTrusted())
        startForegroundNotification()

        ca = CertificateAuthority(applicationContext)

        // MITM + SOCKS hand-off. `protect` keeps the proxy's upstream sockets
        // off the tunnel so traffic doesn't loop back into ourselves.
        val proxy = MitmProxy(ca) { sock: Socket -> protect(sock) }
        val socksServer = SocksServer(proxy) { _ -> null }
        socksServer.start()
        socks = socksServer

        if (!Tun2Socks.isAvailable()) {
            CaptureBus.setState(
                VpnStatus.ERROR, caTrusted(),
                "Native capture library (libtun2socks.so) is not bundled in this build. " +
                    "Add it under modules/cyberforge-vpn/android/src/main/jniLibs/."
            )
            // Tear down the half-started pieces; never route traffic we can't carry.
            socksServer.stop(); socks = null
            stopForeground(STOP_FOREGROUND_REMOVE); stopSelf()
            return
        }

        val pfd = buildTun() ?: run {
            CaptureBus.setState(VpnStatus.ERROR, caTrusted(), "Failed to establish VPN interface.")
            stopSelf(); return
        }
        tun = pfd

        forwarderThread = Thread({
            runCatching {
                Tun2Socks.start(pfd.fd, MTU, "127.0.0.1", socksServer.port)
            }
        }, "cf-tun2socks").also { it.start() }

        isRunning = true
        CaptureBus.resetCounters()
        CaptureBus.setState(VpnStatus.RUNNING, caTrusted())
    }

    private fun buildTun(): ParcelFileDescriptor? {
        val builder = Builder()
            .setSession("CyberForge Capture")
            .setMtu(MTU)
            .addAddress("10.7.0.2", 32)
            .addRoute("0.0.0.0", 0)        // claim all IPv4
            .addDnsServer("1.1.1.1")
        // Never capture our own app — avoids feedback loops with backend pushes.
        runCatching { builder.addDisallowedApplication(packageName) }
        return builder.establish()
    }

    private fun caTrusted(): Boolean = TrustState.isInstalled(applicationContext)

    private fun teardown() {
        if (stopping.getAndSet(true)) return
        CaptureBus.setState(VpnStatus.STOPPING, caTrusted())
        isRunning = false
        runCatching { if (Tun2Socks.isAvailable()) Tun2Socks.stop() }
        runCatching { forwarderThread?.interrupt() }
        runCatching { socks?.stop() }
        runCatching { tun?.close() }
        tun = null; socks = null
        CaptureBus.setState(VpnStatus.IDLE, caTrusted())
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        teardown()
        super.onDestroy()
    }

    override fun onRevoke() {
        // The user (or another VPN app) revoked our tunnel.
        teardown()
        super.onRevoke()
    }

    // ── foreground notification (required for a long-running VpnService) ──
    private fun startForegroundNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Network Capture", NotificationManager.IMPORTANCE_LOW)
                    .apply { description = "CyberForge is capturing device traffic." }
            )
        }
        val stopIntent = PendingIntent.getService(
            this, 1, Intent(this, CyberForgeVpnService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val notif: Notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("CyberForge capture active")
            .setContentText("Inspecting device network traffic")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopIntent)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, notif, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }
}
