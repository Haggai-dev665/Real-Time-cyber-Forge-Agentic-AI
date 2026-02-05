import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, Shield, AlertTriangle, Eye, Lock, Cpu, Globe } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

const articles = [
  {
    title: 'Understanding Zero-Day Vulnerabilities',
    excerpt: 'Learn how zero-day exploits work and how CyberForge\'s AI detects them before they cause damage.',
    date: 'February 2026',
    category: 'Threat Research',
    icon: <AlertTriangle className="w-6 h-6" />,
    readTime: '8 min read'
  },
  {
    title: 'The Rise of AI-Powered Cyber Attacks',
    excerpt: 'Exploring how threat actors are leveraging AI and how to defend against these advanced attacks.',
    date: 'January 2026',
    category: 'Threat Intelligence',
    icon: <Cpu className="w-6 h-6" />,
    readTime: '12 min read'
  },
  {
    title: 'Browser Security Best Practices',
    excerpt: 'A comprehensive guide to securing your web browsing with CyberForge\'s monitoring features.',
    date: 'January 2026',
    category: 'Security Guide',
    icon: <Globe className="w-6 h-6" />,
    readTime: '6 min read'
  },
  {
    title: 'Protecting Against Phishing Attacks',
    excerpt: 'How CyberForge\'s ML models detect and prevent sophisticated phishing attempts in real-time.',
    date: 'December 2025',
    category: 'Threat Research',
    icon: <Eye className="w-6 h-6" />,
    readTime: '10 min read'
  },
  {
    title: 'Encryption Standards in 2026',
    excerpt: 'An overview of modern encryption standards and how CyberForge ensures your data remains secure.',
    date: 'December 2025',
    category: 'Security Guide',
    icon: <Lock className="w-6 h-6" />,
    readTime: '7 min read'
  },
  {
    title: 'Building a Security-First Culture',
    excerpt: 'Tips for organizations to foster security awareness and leverage tools like CyberForge effectively.',
    date: 'November 2025',
    category: 'Best Practices',
    icon: <Shield className="w-6 h-6" />,
    readTime: '9 min read'
  },
]

export function SecurityBlog() {
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
              <BookOpen className="w-4 h-4 text-status-safe" />
              <span className="text-sm text-cyber-300">Security Blog</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Security Insights & Research
            </h1>
            <p className="text-xl text-cyber-400 max-w-2xl mx-auto">
              Stay informed with the latest security research, threat intelligence,
              and best practices from the CyberForge team.
            </p>
          </motion.div>

          {/* Featured Article */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-cyber-900 to-cyber-950 border border-cyber-700 rounded-2xl p-8 mb-12"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-status-safe/10 text-status-safe text-sm mb-4">
              Featured
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              The Future of Autonomous Cybersecurity
            </h2>
            <p className="text-cyber-400 mb-6 max-w-3xl">
              How agentic AI systems like CyberForge are revolutionizing the way we approach
              threat detection and response. From real-time analysis to autonomous remediation,
              discover what the next generation of security looks like.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-cyber-500">February 2026</span>
              <span className="text-cyber-500">•</span>
              <span className="text-cyber-500">15 min read</span>
              <a href="#" className="ml-auto btn-primary">
                Read Article
              </a>
            </div>
          </motion.div>

          {/* Article Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article, index) => (
              <motion.article
                key={article.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6 hover:border-cyber-700 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-cyber-800/50 text-cyber-400 group-hover:text-status-safe transition-colors">
                    {article.icon}
                  </div>
                  <span className="text-xs text-cyber-500 uppercase tracking-wider">
                    {article.category}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-status-safe transition-colors">
                  {article.title}
                </h3>
                <p className="text-sm text-cyber-400 mb-4">
                  {article.excerpt}
                </p>
                <div className="flex items-center justify-between text-xs text-cyber-500">
                  <span>{article.date}</span>
                  <span>{article.readTime}</span>
                </div>
              </motion.article>
            ))}
          </div>

          {/* Newsletter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-16 text-center bg-cyber-900/50 border border-cyber-800 rounded-2xl p-8"
          >
            <h3 className="text-2xl font-bold text-white mb-4">
              Subscribe to Security Updates
            </h3>
            <p className="text-cyber-400 mb-6 max-w-xl mx-auto">
              Get the latest threat intelligence and security research delivered to your inbox.
            </p>
            <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-xl bg-cyber-800/50 border border-cyber-700 text-white placeholder-cyber-500 focus:outline-none focus:border-status-safe"
              />
              <button type="submit" className="btn-primary whitespace-nowrap">
                Subscribe
              </button>
            </form>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
