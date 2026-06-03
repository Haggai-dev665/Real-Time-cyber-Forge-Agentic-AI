package io.cyberforge.vpn

import android.content.Context
import android.util.Base64
import org.bouncycastle.asn1.x500.X500Name
import org.bouncycastle.asn1.x509.BasicConstraints
import org.bouncycastle.asn1.x509.Extension
import org.bouncycastle.asn1.x509.GeneralName
import org.bouncycastle.asn1.x509.GeneralNames
import org.bouncycastle.asn1.x509.KeyUsage
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter
import org.bouncycastle.cert.jcajce.JcaX509ExtensionUtils
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder
import java.io.File
import java.math.BigInteger
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Security
import java.security.cert.X509Certificate
import java.util.Date
import java.util.concurrent.ConcurrentHashMap
import javax.net.ssl.KeyManagerFactory

/**
 * The on-device Certificate Authority for the TLS MITM.
 *
 * On first use it generates a long-lived root CA (key + self-signed cert) and
 * stores it in a password-protected PKCS#12 keystore in the app's private files
 * dir. `installIntentData()` hands the public cert to the OS "install a CA
 * certificate" flow so the user can trust it. For each upstream host the proxy
 * connects to, [leafKeyManagers] mints a short-lived leaf certificate signed by
 * the root, so the device's apps see a valid certificate chain.
 */
class CertificateAuthority(private val context: Context) {

    companion object {
        private const val KEYSTORE_FILE = "cyberforge_ca.p12"
        private const val KS_PASS = "cyberforge" // local file in private storage
        private const val ROOT_ALIAS = "cyberforge-root"
        private const val CN = "CyberForge Capture Root CA"
        init { Security.addProvider(BouncyCastleProvider()) }
    }

    private val leafCache = ConcurrentHashMap<String, Array<javax.net.ssl.KeyManager>>()
    private lateinit var rootCert: X509Certificate
    private lateinit var rootKey: PrivateKey

    init { loadOrCreateRoot() }

    private fun ksFile(): File = File(context.filesDir, KEYSTORE_FILE)

    private fun loadOrCreateRoot() {
        val ks = KeyStore.getInstance("PKCS12")
        if (ksFile().exists()) {
            ksFile().inputStream().use { ks.load(it, KS_PASS.toCharArray()) }
            rootKey = ks.getKey(ROOT_ALIAS, KS_PASS.toCharArray()) as PrivateKey
            rootCert = ks.getCertificate(ROOT_ALIAS) as X509Certificate
            return
        }
        val kp = keyPair()
        rootCert = buildRootCert(kp)
        rootKey = kp.private
        ks.load(null, null)
        ks.setKeyEntry(ROOT_ALIAS, kp.private, KS_PASS.toCharArray(), arrayOf(rootCert))
        ksFile().outputStream().use { ks.store(it, KS_PASS.toCharArray()) }
    }

    private fun keyPair(): KeyPair =
        KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()

    private fun buildRootCert(kp: KeyPair): X509Certificate {
        val now = System.currentTimeMillis()
        val notBefore = Date(now - 24L * 60 * 60 * 1000)
        val notAfter = Date(now + 3650L * 24 * 60 * 60 * 1000) // ~10 years
        val name = X500Name("CN=$CN, O=CyberForge, OU=Capture")
        val builder = JcaX509v3CertificateBuilder(
            name, BigInteger.valueOf(now), notBefore, notAfter, name, kp.public
        )
        val extUtils = JcaX509ExtensionUtils()
        builder.addExtension(Extension.basicConstraints, true, BasicConstraints(true))
        builder.addExtension(
            Extension.keyUsage, true,
            KeyUsage(KeyUsage.keyCertSign or KeyUsage.cRLSign or KeyUsage.digitalSignature)
        )
        builder.addExtension(
            Extension.subjectKeyIdentifier, false,
            extUtils.createSubjectKeyIdentifier(kp.public)
        )
        val signer = JcaContentSignerBuilder("SHA256WithRSAEncryption")
            .setProvider("BC").build(kp.private)
        return JcaX509CertificateConverter().setProvider("BC")
            .getCertificate(builder.build(signer))
    }

    /** DER bytes of the root certificate, for KeyChain.createInstallIntent(). */
    fun rootCertDer(): ByteArray = rootCert.encoded

    /** PEM text of the root certificate, for display / manual install. */
    fun rootCertPem(): String {
        val b64 = Base64.encodeToString(rootCert.encoded, Base64.NO_WRAP)
        val body = b64.chunked(64).joinToString("\n")
        return "-----BEGIN CERTIFICATE-----\n$body\n-----END CERTIFICATE-----\n"
    }

    /** KeyManagers presenting a freshly minted leaf cert for [host], chained to root. */
    fun leafKeyManagers(host: String): Array<javax.net.ssl.KeyManager> =
        leafCache.getOrPut(host) {
            val kp = keyPair()
            val leaf = buildLeafCert(host, kp)
            val ks = KeyStore.getInstance("PKCS12")
            ks.load(null, null)
            ks.setKeyEntry("leaf", kp.private, KS_PASS.toCharArray(), arrayOf(leaf, rootCert))
            val kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm())
            kmf.init(ks, KS_PASS.toCharArray())
            kmf.keyManagers
        }

    private fun buildLeafCert(host: String, kp: KeyPair): X509Certificate {
        val now = System.currentTimeMillis()
        val notBefore = Date(now - 24L * 60 * 60 * 1000)
        val notAfter = Date(now + 397L * 24 * 60 * 60 * 1000) // <= 398 days (CA/B forum)
        val subject = X500Name("CN=$host, O=CyberForge Capture")
        val builder = JcaX509v3CertificateBuilder(
            X500Name(rootCert.subjectX500Principal.name),
            BigInteger.valueOf(now + host.hashCode().toLong()),
            notBefore, notAfter, subject, kp.public
        )
        builder.addExtension(Extension.basicConstraints, false, BasicConstraints(false))
        builder.addExtension(
            Extension.subjectAlternativeName, false,
            GeneralNames(GeneralName(GeneralName.dNSName, host))
        )
        val signer = JcaContentSignerBuilder("SHA256WithRSAEncryption")
            .setProvider("BC").build(rootKey)
        return JcaX509CertificateConverter().setProvider("BC")
            .getCertificate(builder.build(signer))
    }
}
