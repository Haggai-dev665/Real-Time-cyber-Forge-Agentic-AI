import { motion } from 'framer-motion'
import { ArrowLeft, Shield, Eye, Database, Lock, Server, Globe, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

const sections = [
  {
    title: 'Information We Collect',
    icon: <Database className="w-6 h-6" />,
    content: [
      'Account information (email, username) when you register',
      'Usage data and analytics to improve our services',
      'Threat data and security events for analysis (anonymized)',
      'Device information for compatibility and support',
    ]
  },
  {
    title: 'How We Use Your Information',
    icon: <Eye className="w-6 h-6" />,
    content: [
      'Provide and maintain CyberForge services',
      'Improve threat detection and security analysis',
      'Send important security alerts and updates',
      'Respond to your support requests',
    ]
  },
  {
    title: 'Data Security',
    icon: <Lock className="w-6 h-6" />,
    content: [
      'All data is encrypted in transit and at rest',
      'We use industry-standard security practices',
      'Regular security audits and penetration testing',
      'Limited employee access to user data',
    ]
  },
  {
    title: 'Data Sharing',
    icon: <Server className="w-6 h-6" />,
    content: [
      'We never sell your personal information',
      'Anonymized threat data may be shared with security partners',
      'Data may be shared if required by law',
      'Third-party services are carefully vetted',
    ]
  },
  {
    title: 'Your Rights',
    icon: <Shield className="w-6 h-6" />,
    content: [
      'Access and download your personal data',
      'Request deletion of your account and data',
      'Opt out of non-essential data collection',
      'Update your information at any time',
    ]
  },
  {
    title: 'International Data',
    icon: <Globe className="w-6 h-6" />,
    content: [
      'Data may be processed in multiple countries',
      'We comply with GDPR for EU users',
      'Appropriate safeguards for international transfers',
      'Local data protection laws are respected',
    ]
  },
]

export function Privacy() {
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
              <Shield className="w-4 h-4 text-status-safe" />
              <span className="text-sm text-cyber-300">Privacy Policy</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Your Privacy Matters
            </h1>
            <p className="text-xl text-cyber-400 max-w-2xl mx-auto">
              We're committed to protecting your privacy while providing world-class security.
            </p>
            <p className="text-sm text-cyber-500 mt-4">Last updated: February 2026</p>
          </motion.div>

          {/* Key Points */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-status-safe/10 border border-status-safe/30 rounded-2xl p-6 mb-12"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
              <Check className="w-5 h-5 text-status-safe" />
              Key Points
            </h2>
            <ul className="space-y-2 text-cyber-300">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-status-safe mt-1 shrink-0" />
                We never sell your personal information
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-status-safe mt-1 shrink-0" />
                All data is encrypted and securely stored
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-status-safe mt-1 shrink-0" />
                You can delete your data at any time
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-status-safe mt-1 shrink-0" />
                We only collect what's necessary for security
              </li>
            </ul>
          </motion.div>

          {/* Policy Sections */}
          <div className="space-y-8">
            {sections.map((section, index) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
              >
                <h2 className="flex items-center gap-3 text-xl font-semibold text-white mb-4">
                  <div className="p-2 rounded-lg bg-cyber-800/50 text-status-safe">
                    {section.icon}
                  </div>
                  {section.title}
                </h2>
                <ul className="space-y-3">
                  {section.content.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-cyber-400">
                      <span className="text-status-safe mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-12 text-center"
          >
            <p className="text-cyber-400 mb-4">
              Have questions about our privacy practices?
            </p>
            <a href="mailto:privacy@cyberforge.dev" className="btn-secondary">
              Contact Privacy Team
            </a>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
