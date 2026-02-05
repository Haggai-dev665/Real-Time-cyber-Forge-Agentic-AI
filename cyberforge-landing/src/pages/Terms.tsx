import { motion } from 'framer-motion'
import { ArrowLeft, FileText, Check, AlertTriangle, Scale, Shield, Globe, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

export function Terms() {
  return (
    <div className="min-h-screen bg-cyber-950 bg-grid">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-cyber-950/90 backdrop-blur-md border-b border-cyber-800">
        <div className="container-section">
          <nav className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center gap-2 group">
              <img src={logo} alt="CyberForge" className="w-10 h-10" />
            </Link>
            <Link to="/" className="flex items-center gap-2 text-cyber-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-20">
        <div className="container-section max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyber-800/50 border border-cyber-700 mb-6">
              <FileText className="w-4 h-4 text-status-safe" />
              <span className="text-sm text-cyber-300">Terms of Service</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Terms of Service
            </h1>
            <p className="text-xl text-cyber-400 max-w-2xl mx-auto">
              Please read these terms carefully before using CyberForge.
            </p>
            <p className="text-sm text-cyber-500 mt-4">Last updated: February 2026</p>
          </motion.div>

          {/* Terms Content */}
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
            >
              <h2 className="flex items-center gap-3 text-xl font-semibold text-white mb-4">
                <Scale className="w-5 h-5 text-status-safe" />
                1. Acceptance of Terms
              </h2>
              <p className="text-cyber-400 leading-relaxed">
                By accessing or using CyberForge ("the Service"), you agree to be bound by these Terms of Service. 
                If you disagree with any part of these terms, you may not access the Service. 
                These terms apply to all users, including individual users and organizations.
              </p>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
            >
              <h2 className="flex items-center gap-3 text-xl font-semibold text-white mb-4">
                <Check className="w-5 h-5 text-status-safe" />
                2. Use License
              </h2>
              <p className="text-cyber-400 leading-relaxed mb-4">
                CyberForge grants you a limited, non-exclusive, non-transferable license to use the Service for personal 
                or internal business purposes. This license is subject to the following conditions:
              </p>
              <ul className="space-y-2 text-cyber-400">
                <li className="flex items-start gap-2">
                  <span className="text-status-safe">•</span>
                  You may not modify, reverse engineer, or decompile the software
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-status-safe">•</span>
                  You may not use the Service for any illegal purposes
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-status-safe">•</span>
                  You may not attempt to bypass security features
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-status-safe">•</span>
                  You may not use the Service to harm others or their systems
                </li>
              </ul>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
            >
              <h2 className="flex items-center gap-3 text-xl font-semibold text-white mb-4">
                <Shield className="w-5 h-5 text-status-safe" />
                3. User Responsibilities
              </h2>
              <p className="text-cyber-400 leading-relaxed mb-4">
                As a user of CyberForge, you are responsible for:
              </p>
              <ul className="space-y-2 text-cyber-400">
                <li className="flex items-start gap-2">
                  <span className="text-status-safe">•</span>
                  Maintaining the security of your account credentials
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-status-safe">•</span>
                  Ensuring compliance with applicable laws and regulations
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-status-safe">•</span>
                  Reporting any security vulnerabilities responsibly
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-status-safe">•</span>
                  Not sharing your account with unauthorized parties
                </li>
              </ul>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
            >
              <h2 className="flex items-center gap-3 text-xl font-semibold text-white mb-4">
                <AlertTriangle className="w-5 h-5 text-status-safe" />
                4. Disclaimer of Warranties
              </h2>
              <p className="text-cyber-400 leading-relaxed">
                CyberForge is provided "as is" without warranty of any kind. While we strive to provide reliable 
                security protection, we cannot guarantee that the Service will detect all threats or be error-free. 
                You acknowledge that no security solution is 100% effective and use the Service at your own risk.
              </p>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
            >
              <h2 className="flex items-center gap-3 text-xl font-semibold text-white mb-4">
                <Globe className="w-5 h-5 text-status-safe" />
                5. Open Source Components
              </h2>
              <p className="text-cyber-400 leading-relaxed">
                CyberForge includes open source components that are subject to their respective licenses. 
                The use of these components is governed by those licenses. A full list of open source 
                components and their licenses is available in our GitHub repository.
              </p>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
            >
              <h2 className="flex items-center gap-3 text-xl font-semibold text-white mb-4">
                <FileText className="w-5 h-5 text-status-safe" />
                6. Modifications to Terms
              </h2>
              <p className="text-cyber-400 leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of significant 
                changes via email or through the Service. Continued use of the Service after changes 
                constitutes acceptance of the new terms.
              </p>
            </motion.section>
          </div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 text-center bg-cyber-900/50 border border-cyber-800 rounded-2xl p-8"
          >
            <Mail className="w-12 h-12 text-cyber-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Questions?</h3>
            <p className="text-cyber-400 mb-4">
              If you have any questions about these Terms of Service, please contact us.
            </p>
            <a href="mailto:legal@cyberforge.dev" className="btn-secondary">
              Contact Legal Team
            </a>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
