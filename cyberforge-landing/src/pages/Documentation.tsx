import { motion } from 'framer-motion'
import { ArrowLeft, Book, Code, Terminal, Shield, Zap, Database, Globe } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

const sections = [
  {
    title: 'Getting Started',
    icon: <Zap className="w-6 h-6" />,
    items: [
      { title: 'Installation Guide', description: 'Download and install CyberForge on Windows, macOS, or Linux' },
      { title: 'Quick Start', description: 'Get up and running in under 5 minutes' },
      { title: 'System Requirements', description: 'Minimum and recommended specifications' },
    ]
  },
  {
    title: 'Core Features',
    icon: <Shield className="w-6 h-6" />,
    items: [
      { title: 'Real-time Threat Detection', description: 'How CyberForge monitors and detects threats' },
      { title: 'AI Agent System', description: 'Understanding the autonomous AI agents' },
      { title: 'Browser Security', description: 'Protecting your web browsing sessions' },
    ]
  },
  {
    title: 'API Reference',
    icon: <Code className="w-6 h-6" />,
    items: [
      { title: 'REST API', description: 'Complete REST API documentation' },
      { title: 'WebSocket Events', description: 'Real-time event subscriptions' },
      { title: 'Authentication', description: 'API keys and OAuth integration' },
    ]
  },
  {
    title: 'Advanced Configuration',
    icon: <Terminal className="w-6 h-6" />,
    items: [
      { title: 'Custom Rules', description: 'Creating custom detection rules' },
      { title: 'Integration Guides', description: 'Connecting with SIEM and other tools' },
      { title: 'Enterprise Setup', description: 'Multi-user and organization configuration' },
    ]
  },
]

export function Documentation() {
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
              <Book className="w-4 h-4 text-status-safe" />
              <span className="text-sm text-cyber-300">Documentation</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              CyberForge Documentation
            </h1>
            <p className="text-xl text-cyber-400 max-w-2xl mx-auto">
              Everything you need to know about setting up, configuring, and using CyberForge
              for maximum protection.
            </p>
          </motion.div>

          {/* Documentation Sections */}
          <div className="grid md:grid-cols-2 gap-8">
            {sections.map((section, index) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-status-safe/10 text-status-safe">
                    {section.icon}
                  </div>
                  <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                </div>
                <ul className="space-y-4">
                  {section.items.map((item) => (
                    <li key={item.title}>
                      <a href="#" className="block p-4 rounded-xl bg-cyber-800/30 hover:bg-cyber-800/50 transition-colors group">
                        <h3 className="text-white font-medium group-hover:text-status-safe transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-sm text-cyber-500 mt-1">{item.description}</p>
                      </a>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-16 text-center"
          >
            <h3 className="text-lg font-semibold text-white mb-6">Quick Links</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="#" className="px-6 py-3 rounded-xl bg-cyber-800/50 border border-cyber-700 text-cyber-300 hover:text-white hover:border-cyber-500 transition-all">
                <Database className="w-4 h-4 inline mr-2" />
                API Reference
              </a>
              <a href="#" className="px-6 py-3 rounded-xl bg-cyber-800/50 border border-cyber-700 text-cyber-300 hover:text-white hover:border-cyber-500 transition-all">
                <Globe className="w-4 h-4 inline mr-2" />
                Community Forum
              </a>
              <a href="https://github.com/Haggai-dev665/Real-Time-cyber-Forge-Agentic-AI" target="_blank" className="px-6 py-3 rounded-xl bg-cyber-800/50 border border-cyber-700 text-cyber-300 hover:text-white hover:border-cyber-500 transition-all">
                <Code className="w-4 h-4 inline mr-2" />
                GitHub Repository
              </a>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
