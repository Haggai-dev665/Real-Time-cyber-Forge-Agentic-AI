package io.cyberforge.vpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.security.KeyChain
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS-facing bridge for the CyberForge capture engine. Forwards [CaptureBus]
 * events to JS (`onFlow` / `onState`) and exposes the lifecycle the TS wrapper
 * (`src/native/vpn.ts`) calls: CA trust, VpnService consent, start/stop.
 */
class CyberForgeVpnModule : Module() {

    companion object {
        private const val REQ_PREPARE = 0x7001
        private const val REQ_INSTALL = 0x7002
    }

    private var pendingPrepare: Promise? = null
    private var pendingInstall: Promise? = null

    // Bridges service-side capture events to JS events.
    private val busListener = object : CaptureBus.Listener {
        override fun onFlow(flow: CapturedFlow) {
            runCatching { sendEvent("onFlow", flow.toMap()) }
        }
        override fun onState(status: VpnStatus, flowCount: Int, caInstalled: Boolean, error: String?) {
            runCatching {
                sendEvent("onState", mapOf(
                    "status" to status.wire,
                    "flowCount" to flowCount,
                    "caInstalled" to caInstalled,
                    "error" to error,
                ))
            }
        }
    }

    private val context get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    private val activity: Activity? get() = appContext.currentActivity

    override fun definition() = ModuleDefinition {
        Name("CyberForgeVpn")
        Events("onFlow", "onState")

        OnCreate { CaptureBus.addListener(busListener) }
        OnDestroy { CaptureBus.removeListener(busListener) }

        AsyncFunction("getCaPem") {
            CertificateAuthority(context).rootCertPem()
        }

        AsyncFunction("isCaInstalled") {
            TrustState.isInstalled(context)
        }

        AsyncFunction("getState") {
            mapOf(
                "status" to (if (CyberForgeVpnService.isRunning) VpnStatus.RUNNING.wire else CaptureBus.status.wire),
                "flowCount" to CaptureBus.flowCount,
                "caInstalled" to TrustState.isInstalled(context),
                "error" to CaptureBus.lastError,
            )
        }

        // Launch the OS "install a CA certificate" dialog with our root cert.
        AsyncFunction("installCa") { promise: Promise ->
            val act = activity ?: return@AsyncFunction promise.reject("E_NO_ACTIVITY", "No foreground activity", null)
            val der = CertificateAuthority(context).rootCertDer()
            val intent = KeyChain.createInstallIntent().apply {
                putExtra(KeyChain.EXTRA_CERTIFICATE, der)
                putExtra(KeyChain.EXTRA_NAME, "CyberForge Capture Root CA")
            }
            pendingInstall = promise
            act.runOnUiThread { act.startActivityForResult(intent, REQ_INSTALL) }
        }

        // Trigger the Android VPN consent dialog (no-op if already granted).
        AsyncFunction("prepare") { promise: Promise ->
            val intent = VpnService.prepare(context)
            if (intent == null) {
                promise.resolve(true)
            } else {
                val act = activity ?: return@AsyncFunction promise.reject("E_NO_ACTIVITY", "No foreground activity", null)
                pendingPrepare = promise
                act.runOnUiThread { act.startActivityForResult(intent, REQ_PREPARE) }
            }
        }

        AsyncFunction("start") { opts: Map<String, Any?> ->
            val intent = Intent(context, CyberForgeVpnService::class.java).apply {
                action = CyberForgeVpnService.ACTION_START
                putExtra(CyberForgeVpnService.EXTRA_BACKEND, opts["backendUrl"] as? String)
                putExtra(CyberForgeVpnService.EXTRA_TOKEN, opts["token"] as? String)
                putExtra(CyberForgeVpnService.EXTRA_USER, opts["userId"] as? String)
            }
            ContextCompat.startForegroundService(context, intent)
            true
        }

        AsyncFunction("stop") {
            val intent = Intent(context, CyberForgeVpnService::class.java)
                .setAction(CyberForgeVpnService.ACTION_STOP)
            context.startService(intent)
            true
        }

        OnActivityResult { _, payload ->
            when (payload.requestCode) {
                REQ_PREPARE -> {
                    val granted = payload.resultCode == Activity.RESULT_OK
                    pendingPrepare?.resolve(granted)
                    pendingPrepare = null
                }
                REQ_INSTALL -> {
                    val ok = payload.resultCode == Activity.RESULT_OK
                    if (ok) TrustState.setInstalled(context, true)
                    pendingInstall?.resolve(ok)
                    pendingInstall = null
                }
            }
        }
    }
}
