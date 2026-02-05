import { motion } from 'framer-motion'
import { ArrowLeft, Users, Target, Award, Github, Linkedin, Twitter, Globe } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

const stats = [
  { label: 'Active Users', value: '10,000+' },
  { label: 'Threats Blocked', value: '2.5M+' },
  { label: 'Countries', value: '50+' },
  { label: 'Uptime', value: '99.9%' },
]

const values = [
  {
    title: 'Security First',
    description: 'We believe everyone deserves robust security tools, not just enterprises with big budgets.',
  },
  {
    title: 'Open Innovation',
    description: 'Our core is open source, enabling community contribution and transparency.',
  },
  {
    title: 'AI for Defense',
    description: 'We leverage AI to protect, not attack, making the digital world safer for everyone.',
  },
  {
    title: 'User Privacy',
    description: 'Your data is yours. We collect only what\'s necessary and never sell your information.',
  },
]

const team = [
  {
    name: 'Haggai',
    role: 'Founder & Lead Developer',
    bio: 'Security researcher and AI enthusiast with a passion for democratizing cybersecurity.',
    links: {
      github: 'https://github.com/Haggai-dev665',
      linkedin: '#',
      twitter: '#',
    }
  },
]

export function About() {
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
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyber-800/50 border border-cyber-700 mb-6">
              <Users className="w-4 h-4 text-status-safe" />
              <span className="text-sm text-cyber-300">About Us</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Building the Future of Cybersecurity
            </h1>
            <p className="text-xl text-cyber-400 max-w-2xl mx-auto">
              CyberForge is an open-source initiative to bring enterprise-grade security
              powered by AI to everyone.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold text-status-safe mb-1">{stat.value}</div>
                <div className="text-sm text-cyber-400">{stat.label}</div>
              </div>
            ))}
          </motion.div>

          {/* Mission */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-cyber-900 to-cyber-950 border border-cyber-700 rounded-2xl p-8 mb-16"
          >
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-6 h-6 text-status-safe" />
              <h2 className="text-2xl font-bold text-white">Our Mission</h2>
            </div>
            <p className="text-lg text-cyber-300 leading-relaxed">
              We believe that advanced cybersecurity should be accessible to everyone, not just
              large corporations. CyberForge combines cutting-edge AI with intuitive design to
              provide real-time protection against evolving digital threats. Our goal is to
              create a safer digital environment where individuals and organizations can operate
              with confidence.
            </p>
          </motion.div>

          {/* Values */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-16"
          >
            <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6">
              <Award className="w-6 h-6 text-status-safe" />
              Our Values
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {values.map((value) => (
                <div
                  key={value.title}
                  className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
                >
                  <h3 className="text-lg font-semibold text-white mb-2">{value.title}</h3>
                  <p className="text-cyber-400">{value.description}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Team */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6">
              <Users className="w-6 h-6 text-status-safe" />
              The Team
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {team.map((member) => (
                <div
                  key={member.name}
                  className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
                >
                  <div className="w-20 h-20 rounded-full bg-cyber-800 flex items-center justify-center text-3xl text-status-safe mb-4">
                    {member.name[0]}
                  </div>
                  <h3 className="text-lg font-semibold text-white">{member.name}</h3>
                  <p className="text-sm text-status-safe mb-2">{member.role}</p>
                  <p className="text-sm text-cyber-400 mb-4">{member.bio}</p>
                  <div className="flex gap-3">
                    <a href={member.links.github} target="_blank" className="text-cyber-500 hover:text-white transition-colors">
                      <Github className="w-5 h-5" />
                    </a>
                    <a href={member.links.linkedin} className="text-cyber-500 hover:text-white transition-colors">
                      <Linkedin className="w-5 h-5" />
                    </a>
                    <a href={member.links.twitter} className="text-cyber-500 hover:text-white transition-colors">
                      <Twitter className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              ))}
              
              {/* Join the Team Card */}
              <div className="bg-cyber-900/50 border border-dashed border-cyber-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                <Globe className="w-12 h-12 text-cyber-600 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Join Our Team</h3>
                <p className="text-sm text-cyber-400 mb-4">
                  We're always looking for passionate security researchers and developers.
                </p>
                <a href="mailto:contact@cyberforge.dev" className="btn-secondary text-sm">
                  Get in Touch
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
