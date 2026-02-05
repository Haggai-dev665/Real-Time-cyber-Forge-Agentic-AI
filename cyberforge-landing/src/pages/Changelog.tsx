import { motion } from 'framer-motion'
import { ArrowLeft, GitBranch, Star, GitPullRequest, Calendar, Tag, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

const releases = [
  {
    version: '1.2.0',
    date: 'February 2026',
    type: 'Feature Release',
    highlights: [
      'Added support for macOS ARM64 (Apple Silicon)',
      'New AI-powered threat prediction engine',
      'Improved real-time browser monitoring',
      'Enhanced dashboard with new visualizations',
    ],
    improvements: [
      'Reduced memory usage by 30%',
      'Faster startup time',
      'Better dark mode support',
    ],
    fixes: [
      'Fixed WebSocket reconnection issues',
      'Resolved false positive alerts for trusted domains',
      'Fixed crash on Windows 11 with certain antivirus software',
    ]
  },
  {
    version: '1.1.0',
    date: 'January 2026',
    type: 'Feature Release',
    highlights: [
      'Introduced Agentic AI autonomous protection',
      'New threat intelligence dashboard',
      'Added Linux AppImage support',
      'Real-time collaboration features',
    ],
    improvements: [
      'Improved ML model accuracy',
      'Enhanced API response times',
      'Better notification system',
    ],
    fixes: [
      'Fixed memory leak in long-running sessions',
      'Resolved UI freezing on large datasets',
      'Fixed certificate validation issues',
    ]
  },
  {
    version: '1.0.0',
    date: 'December 2025',
    type: 'Major Release',
    highlights: [
      'Initial public release',
      'Cross-platform desktop application',
      'Real-time threat detection',
      'AI-powered security analysis',
    ],
    improvements: [],
    fixes: []
  },
]

export function Changelog() {
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
              <GitBranch className="w-4 h-4 text-status-safe" />
              <span className="text-sm text-cyber-300">Changelog</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              What's New in CyberForge
            </h1>
            <p className="text-xl text-cyber-400 max-w-2xl mx-auto">
              Track all the latest features, improvements, and bug fixes in each release.
            </p>
          </motion.div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-cyber-800" />
            
            {releases.map((release, index) => (
              <motion.div
                key={release.version}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative pl-20 pb-12"
              >
                {/* Version Badge */}
                <div className="absolute left-0 w-16 h-16 rounded-xl bg-cyber-900 border border-cyber-700 flex items-center justify-center">
                  <Tag className="w-6 h-6 text-status-safe" />
                </div>
                
                <div className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6">
                  <div className="flex flex-wrap items-center gap-4 mb-4">
                    <h2 className="text-2xl font-bold text-white">v{release.version}</h2>
                    <span className="px-3 py-1 rounded-full bg-status-safe/10 text-status-safe text-sm">
                      {release.type}
                    </span>
                    <span className="flex items-center gap-1 text-cyber-500 text-sm">
                      <Calendar className="w-4 h-4" />
                      {release.date}
                    </span>
                  </div>
                  
                  {release.highlights.length > 0 && (
                    <div className="mb-6">
                      <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-3">
                        <Star className="w-5 h-5 text-yellow-500" />
                        Highlights
                      </h3>
                      <ul className="space-y-2">
                        {release.highlights.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-cyber-300">
                            <ArrowRight className="w-4 h-4 text-status-safe mt-1 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {release.improvements.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-white mb-3">Improvements</h3>
                      <ul className="space-y-2">
                        {release.improvements.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-cyber-400">
                            <span className="text-blue-400">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {release.fixes.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Bug Fixes</h3>
                      <ul className="space-y-2">
                        {release.fixes.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-cyber-400">
                            <span className="text-green-400">✓</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* GitHub Link */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center mt-8"
          >
            <a 
              href="https://github.com/Haggai-dev665/Real-Time-cyber-Forge-Agentic-AI/releases"
              target="_blank"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyber-800/50 border border-cyber-700 text-cyber-300 hover:text-white hover:border-cyber-500 transition-all"
            >
              <GitPullRequest className="w-5 h-5" />
              View all releases on GitHub
            </a>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
