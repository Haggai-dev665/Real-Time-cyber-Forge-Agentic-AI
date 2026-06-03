package io.cyberforge.vpn

import android.content.Context
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

/**
 * Tracks whether the CyberForge root CA is trusted by the device. Reliable
 * detection of a *user-installed* CA is awkward, so we combine two signals: a
 * persisted flag set when the user completes the install dialog, and a
 * best-effort scan of the platform trust managers for our CA's subject.
 */
object TrustState {
    private const val PREF = "cf_vpn"
    private const val KEY = "ca_installed"
    private const val CA_CN = "CyberForge Capture Root CA"

    fun isInstalled(ctx: Context): Boolean {
        if (ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).getBoolean(KEY, false)) return true
        return scanTrust()
    }

    fun setInstalled(ctx: Context, value: Boolean) {
        ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().putBoolean(KEY, value).apply()
    }

    private fun scanTrust(): Boolean = runCatching {
        val tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        tmf.init(null as java.security.KeyStore?)
        tmf.trustManagers
            .filterIsInstance<X509TrustManager>()
            .any { tm -> tm.acceptedIssuers.any { it.subjectX500Principal.name.contains(CA_CN) } }
    }.getOrDefault(false)
}
