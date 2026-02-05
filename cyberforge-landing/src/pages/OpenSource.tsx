import { motion } from 'framer-motion'
import { ArrowLeft, Github, Star, GitFork, Users, Code, Heart, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

const repos = [
  {
    name: 'Real-Time-cyber-Forge-Agentic-AI',
    description: 'Main CyberForge repository - AI-powered cybersecurity platform with real-time threat detection',
    language: 'TypeScript',
    stars: '1.2k',
    forks: '234',
    url: 'https://github.com/Haggai-dev665/Real-Time-cyber-Forge-Agentic-AI'
  },
]

const contributionAreas = [
  {
    title: 'Core Platform',
    description: 'Help improve the main CyberForge application, including the Electron desktop app and backend services.',
    skills: ['TypeScript', 'Node.js', 'Electron', 'React'],
  },
  {
    title: 'ML Models',
    description: 'Contribute to our machine learning models for threat detection, anomaly analysis, and predictive security.',
    skills: ['Python', 'TensorFlow', 'PyTorch', 'scikit-learn'],
  },
  {
    title: 'Documentation',
    description: 'Help make CyberForge more accessible by improving our documentation, tutorials, and guides.',
    skills: ['Technical Writing', 'Markdown', 'API Documentation'],
  },
  {
    title: 'Security Research',
    description: 'Contribute threat intelligence, malware analysis, and security research to improve detection capabilities.',
    skills: ['Malware Analysis', 'Reverse Engineering', 'Threat Intelligence'],
  },
]

export function OpenSource() {
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
              <Github className="w-4 h-4 text-status-safe" />
              <span className="text-sm text-cyber-300">Open Source</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Built by the Community
            </h1>
            <p className="text-xl text-cyber-400 max-w-2xl mx-auto">
              CyberForge is open source and community-driven. Join us in building
              the future of accessible cybersecurity.
            </p>
          </motion.div>

          {/* Main CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-cyber-900 to-cyber-950 border border-cyber-700 rounded-2xl p-8 mb-12 text-center"
          >
            <Github className="w-16 h-16 text-white mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Star us on GitHub</h2>
            <p className="text-cyber-400 mb-6 max-w-xl mx-auto">
              Support the project by giving us a star. It helps others discover CyberForge
              and motivates our contributors.
            </p>
            <a
              href="https://github.com/Haggai-dev665/Real-Time-cyber-Forge-Agentic-AI"
              target="_blank"
              className="inline-flex items-center gap-2 btn-primary text-lg px-8 py-4"
            >
              <Star className="w-5 h-5" />
              Star on GitHub
            </a>
          </motion.div>

          {/* Repositories */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-12"
          >
            <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6">
              <Code className="w-6 h-6 text-status-safe" />
              Repositories
            </h2>
            <div className="space-y-4">
              {repos.map((repo) => (
                <a
                  key={repo.name}
                  href={repo.url}
                  target="_blank"
                  className="block bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6 hover:border-cyber-700 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white group-hover:text-status-safe transition-colors flex items-center gap-2">
                        {repo.name}
                        <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                      <p className="text-cyber-400 mt-1">{repo.description}</p>
                      <div className="flex items-center gap-4 mt-4">
                        <span className="flex items-center gap-1 text-sm text-cyber-500">
                          <span className="w-3 h-3 rounded-full bg-blue-500" />
                          {repo.language}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-cyber-500">
                          <Star className="w-4 h-4" />
                          {repo.stars}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-cyber-500">
                          <GitFork className="w-4 h-4" />
                          {repo.forks}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </motion.div>

          {/* How to Contribute */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-12"
          >
            <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6">
              <Users className="w-6 h-6 text-status-safe" />
              How to Contribute
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {contributionAreas.map((area) => (
                <div
                  key={area.title}
                  className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
                >
                  <h3 className="text-lg font-semibold text-white mb-2">{area.title}</h3>
                  <p className="text-cyber-400 mb-4">{area.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {area.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1 rounded-lg bg-cyber-800/50 text-xs text-cyber-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Community */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-8 text-center"
          >
            <Heart className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Join Our Community</h2>
            <p className="text-cyber-400 mb-6 max-w-xl mx-auto">
              Connect with other contributors, get help, share ideas, and stay updated
              on the latest CyberForge developments.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://github.com/Haggai-dev665/Real-Time-cyber-Forge-Agentic-AI/discussions"
                target="_blank"
                className="btn-secondary"
              >
                <Github className="w-4 h-4" />
                GitHub Discussions
              </a>
              <a href="mailto:contact@cyberforge.dev" className="btn-secondary">
                Contact Us
              </a>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
