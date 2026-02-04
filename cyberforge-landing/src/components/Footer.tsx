import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Shield, 
  Download, 
  Github, 
  Twitter, 
  Mail,
  ExternalLink,
  Monitor,
  Apple,
  Smartphone
} from 'lucide-react'

type OS = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown'

function detectOS(): OS {
  if (typeof window === 'undefined') return 'unknown'
  
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  if (userAgent.includes('android')) return 'android'
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios'
  if (platform.includes('mac') || userAgent.includes('mac')) return 'macos'
  if (platform.includes('win') || userAgent.includes('win')) return 'windows'
  if (platform.includes('linux') || userAgent.includes('linux')) return 'linux'
  
  return 'unknown'
}

const osLabels: Record<OS, { name: string; icon: React.ReactNode }> = {
  windows: { name: 'Windows', icon: <Monitor className="w-4 h-4" /> },
  macos: { name: 'macOS', icon: <Apple className="w-4 h-4" /> },
  linux: { name: 'Linux', icon: <Monitor className="w-4 h-4" /> },
  android: { name: 'Android', icon: <Smartphone className="w-4 h-4" /> },
  ios: { name: 'iOS', icon: <Smartphone className="w-4 h-4" /> },
  unknown: { name: 'Your Device', icon: <Download className="w-4 h-4" /> },
}

const footerLinks = {
  product: [
    { label: 'Features', href: '#capabilities' },
    { label: 'Download', href: '#download' },
    { label: 'Documentation', href: '#' },
    { label: 'Changelog', href: '#' },
  ],
  resources: [
    { label: 'API Reference', href: '#' },
    { label: 'Security Blog', href: '#' },
    { label: 'Threat Research', href: '#' },
    { label: 'ML Models', href: '#' },
  ],
  company: [
    { label: 'About', href: '#' },
    { label: 'Open Source', href: '#' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
  ],
}

const socialLinks = [
  { icon: <Github className="w-5 h-5" />, href: 'https://github.com', label: 'GitHub' },
  { icon: <Twitter className="w-5 h-5" />, href: 'https://twitter.com', label: 'Twitter' },
  { icon: <Mail className="w-5 h-5" />, href: 'mailto:contact@cyberforge.dev', label: 'Email' },
]

export function Footer() {
  const [detectedOS, setDetectedOS] = useState<OS>('unknown')

  useEffect(() => {
    setDetectedOS(detectOS())
  }, [])

  const currentOS = osLabels[detectedOS]

  return (
    <footer className="bg-cyber-950 border-t border-cyber-800">
      {/* Final CTA */}
      <div className="section-padding pb-8">
        <div className="container-section">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Start Protecting Your Systems Today
            </h2>
            <p className="text-cyber-400 max-w-xl mx-auto mb-8">
              Join thousands of users and organizations who trust CyberForge 
              for real-time threat detection and autonomous protection.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#download" className="btn-primary text-lg px-8 py-4">
                {currentOS.icon}
                <span>Download for {currentOS.name}</span>
              </a>
              <a 
                href="#" 
                className="flex items-center gap-2 px-8 py-4 rounded-xl border border-cyber-700 
                  text-cyber-300 hover:border-cyber-500 hover:text-white transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View Documentation</span>
              </a>
            </div>
          </motion.div>

          {/* Footer Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-t border-cyber-800">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-1">
              <a href="#" className="flex items-center gap-2 mb-4">
                <Shield className="w-7 h-7 text-status-safe" />
                <span className="text-xl font-bold text-white">CyberForge</span>
              </a>
              <p className="text-sm text-cyber-500 mb-4">
                Agentic AI-powered security for the modern digital environment.
              </p>
              <div className="flex gap-3">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="p-2 rounded-lg bg-cyber-800 text-cyber-400 hover:text-white 
                      hover:bg-cyber-700 transition-colors"
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Links Columns */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
                Product
              </h4>
              <ul className="space-y-2">
                {footerLinks.product.map((link) => (
                  <li key={link.label}>
                    <a 
                      href={link.href}
                      className="text-sm text-cyber-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
                Resources
              </h4>
              <ul className="space-y-2">
                {footerLinks.resources.map((link) => (
                  <li key={link.label}>
                    <a 
                      href={link.href}
                      className="text-sm text-cyber-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
                Company
              </h4>
              <ul className="space-y-2">
                {footerLinks.company.map((link) => (
                  <li key={link.label}>
                    <a 
                      href={link.href}
                      className="text-sm text-cyber-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-cyber-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-cyber-600">
              © {new Date().getFullYear()} CyberForge. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-cyber-600">
              <span className="status-dot status-dot-active" />
              <span>All systems operational</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
