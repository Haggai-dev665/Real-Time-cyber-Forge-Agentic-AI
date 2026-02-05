import { motion } from 'framer-motion'
import { ArrowLeft, Search, Brain, AlertTriangle, Shield, Network, Database, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

const researchAreas = [
  {
    title: 'Malware Analysis',
    description: 'Deep analysis of emerging malware families, their behavior patterns, and detection strategies.',
    icon: <AlertTriangle className="w-8 h-8" />,
    stats: '2,847 samples analyzed',
  },
  {
    title: 'Phishing Detection',
    description: 'ML-powered detection of phishing campaigns, social engineering tactics, and credential theft.',
    icon: <Shield className="w-8 h-8" />,
    stats: '99.7% detection rate',
  },
  {
    title: 'Network Anomaly Detection',
    description: 'Identifying suspicious network patterns, lateral movement, and data exfiltration attempts.',
    icon: <Network className="w-8 h-8" />,
    stats: 'Real-time monitoring',
  },
  {
    title: 'Threat Intelligence',
    description: 'Aggregating and correlating threat data from multiple sources for actionable insights.',
    icon: <Database className="w-8 h-8" />,
    stats: '50M+ IOCs tracked',
  },
]

const recentFindings = [
  {
    title: 'New Ransomware Variant Targeting macOS',
    severity: 'Critical',
    date: 'Feb 3, 2026',
    description: 'A new ransomware family has been discovered targeting macOS systems through malicious DMG files.',
  },
  {
    title: 'Cryptocurrency Mining Botnet Expansion',
    severity: 'High',
    date: 'Feb 1, 2026',
    description: 'Cryptomining botnet "NightMiner" has expanded to target enterprise Linux servers.',
  },
  {
    title: 'Supply Chain Attack on NPM Packages',
    severity: 'High',
    date: 'Jan 28, 2026',
    description: 'Multiple popular NPM packages compromised with credential-stealing code.',
  },
  {
    title: 'DNS Tunneling Technique Evolution',
    severity: 'Medium',
    date: 'Jan 25, 2026',
    description: 'New DNS tunneling techniques detected that bypass traditional detection methods.',
  },
]

export function ThreatResearch() {
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
        <div className="container-section">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyber-800/50 border border-cyber-700 mb-6">
              <Search className="w-4 h-4 text-status-safe" />
              <span className="text-sm text-cyber-300">Threat Research</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Threat Research Lab
            </h1>
            <p className="text-xl text-cyber-400 max-w-2xl mx-auto">
              Our dedicated security research team continuously analyzes emerging threats
              to keep CyberForge ahead of attackers.
            </p>
          </motion.div>

          {/* Research Areas */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {researchAreas.map((area, index) => (
              <motion.div
                key={area.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6 hover:border-cyber-700 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-status-safe/10 text-status-safe">
                    {area.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2">{area.title}</h3>
                    <p className="text-cyber-400 mb-3">{area.description}</p>
                    <span className="text-sm text-status-safe">{area.stats}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Recent Findings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
          >
            <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6">
              <TrendingUp className="w-6 h-6 text-status-safe" />
              Recent Threat Findings
            </h2>
            <div className="space-y-4">
              {recentFindings.map((finding) => (
                <div
                  key={finding.title}
                  className="p-4 bg-cyber-800/30 rounded-xl hover:bg-cyber-800/50 transition-colors cursor-pointer"
                >
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-white">{finding.title}</h3>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      finding.severity === 'Critical' ? 'bg-red-500/20 text-red-400' :
                      finding.severity === 'High' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {finding.severity}
                    </span>
                    <span className="text-xs text-cyber-500 ml-auto">{finding.date}</span>
                  </div>
                  <p className="text-sm text-cyber-400">{finding.description}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ML Models Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 bg-gradient-to-br from-cyber-900 to-cyber-950 border border-cyber-700 rounded-2xl p-8"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-xl bg-status-safe/10 text-status-safe">
                <Brain className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">ML Models</h2>
                <p className="text-cyber-400">Our machine learning models powering threat detection</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-cyber-800/30 rounded-xl">
                <h4 className="text-white font-medium mb-1">Malware Classifier</h4>
                <p className="text-sm text-cyber-500">99.3% accuracy</p>
              </div>
              <div className="p-4 bg-cyber-800/30 rounded-xl">
                <h4 className="text-white font-medium mb-1">Phishing Detector</h4>
                <p className="text-sm text-cyber-500">99.7% accuracy</p>
              </div>
              <div className="p-4 bg-cyber-800/30 rounded-xl">
                <h4 className="text-white font-medium mb-1">Anomaly Detection</h4>
                <p className="text-sm text-cyber-500">Real-time inference</p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
