import { motion } from 'framer-motion'
import { 
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  HeartIcon
} from '@heroicons/react/24/outline'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  const footerLinks = {
    product: [
      { name: 'Features', href: '#features' },
      { name: 'How It Works', href: '#how-it-works' },
      { name: 'Download', href: '#download' },
      { name: 'Roadmap', href: '#' }
    ],
    support: [
      { name: 'Documentation', href: '#' },
      { name: 'API Reference', href: '#' },
      { name: 'Community', href: '#' },
      { name: 'Contact', href: '#contact' }
    ],
    company: [
      { name: 'About', href: '#' },
      { name: 'Blog', href: '#' },
      { name: 'Careers', href: '#' },
      { name: 'Privacy', href: '#' }
    ],
    legal: [
      { name: 'Terms of Service', href: '#' },
      { name: 'Privacy Policy', href: '#' },
      { name: 'License', href: '#' },
      { name: 'Security', href: '#' }
    ]
  }

  return (
    <footer id="contact" className="relative py-20 bg-black/50 backdrop-blur-sm">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-cyber-radial opacity-20"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Contact Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-16"
        >
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Get in <span className="text-gradient">Touch</span>
            </h2>
            <p className="text-xl text-gray-300">
              Have questions? We'd love to hear from you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: EnvelopeIcon,
                title: 'Email',
                content: 'support@cyberforge.ai',
                link: 'mailto:support@cyberforge.ai'
              },
              {
                icon: PhoneIcon,
                title: 'Phone',
                content: '+1 (555) 123-4567',
                link: 'tel:+15551234567'
              },
              {
                icon: MapPinIcon,
                title: 'Office',
                content: 'San Francisco, CA',
                link: '#'
              }
            ].map((contact, index) => (
              <motion.a
                key={index}
                href={contact.link}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="glass-effect rounded-lg p-6 text-center hover-lift group"
              >
                <contact.icon className="h-8 w-8 text-cyber-blue mx-auto mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-white font-semibold mb-2">{contact.title}</h3>
                <p className="text-gray-300 group-hover:text-cyber-blue transition-colors">
                  {contact.content}
                </p>
              </motion.a>
            ))}
          </div>
        </motion.div>

        {/* Footer Links */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12"
        >
          {/* Logo and Description */}
          <div className="col-span-2 md:col-span-1">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center space-x-2 mb-4"
            >
              <div className="w-8 h-8 bg-cyber-blue rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">CF</span>
              </div>
              <span className="text-xl font-bold text-gradient">Cyber Forge AI</span>
            </motion.div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Advanced cybersecurity platform powered by AI and machine learning 
              for real-time threat detection and protection.
            </p>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-white font-semibold mb-4 capitalize">
                {category}
              </h3>
              <ul className="space-y-3">
                {links.map((link, index) => (
                  <li key={index}>
                    <motion.a
                      href={link.href}
                      whileHover={{ x: 5 }}
                      className="text-gray-400 hover:text-cyber-blue transition-colors text-sm"
                    >
                      {link.name}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        {/* Newsletter Signup */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="glass-effect rounded-xl p-8 mb-12"
        >
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">
              Stay Updated
            </h3>
            <p className="text-gray-300">
              Get the latest updates on cybersecurity threats and product releases.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyber-blue transition-colors"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-cyber-blue hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 cyber-glow"
            >
              Subscribe
            </motion.button>
          </div>
        </motion.div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10"
        >
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <p className="text-gray-400 text-sm">
              © {currentYear} Cyber Forge AI. All rights reserved.
            </p>
          </div>

          <div className="flex items-center space-x-6">
            {/* Social Links */}
            {[
              { name: 'GitHub', href: '#', icon: '💻' },
              { name: 'Twitter', href: '#', icon: '🐦' },
              { name: 'Discord', href: '#', icon: '💬' },
              { name: 'LinkedIn', href: '#', icon: '💼' }
            ].map((social, index) => (
              <motion.a
                key={index}
                href={social.href}
                whileHover={{ scale: 1.2, y: -2 }}
                whileTap={{ scale: 0.9 }}
                className="text-gray-400 hover:text-cyber-blue transition-colors text-xl"
                title={social.name}
              >
                {social.icon}
              </motion.a>
            ))}
          </div>
        </motion.div>

        {/* Made with Love */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 1 }}
          className="text-center mt-8"
        >
          <p className="text-gray-500 text-sm flex items-center justify-center space-x-1">
            <span>Made with</span>
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <HeartIcon className="h-4 w-4 text-red-500" />
            </motion.span>
            <span>for a safer digital world</span>
          </p>
        </motion.div>
      </div>
    </footer>
  )
}