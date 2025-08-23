import { motion } from 'framer-motion'
import { useState } from 'react'
import { 
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  CloudArrowDownIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

export default function Download() {
  const [selectedPlatform, setSelectedPlatform] = useState('desktop')

  const platforms = {
    desktop: {
      title: 'Desktop Application',
      subtitle: 'For Windows, macOS, and Linux',
      icon: ComputerDesktopIcon,
      downloads: [
        { name: 'Windows', version: 'v1.0.0', size: '85.2 MB', link: '#' },
        { name: 'macOS', version: 'v1.0.0', size: '92.1 MB', link: '#' },
        { name: 'Linux', version: 'v1.0.0', size: '78.5 MB', link: '#' }
      ],
      features: [
        'Real-time browser monitoring',
        'AI-powered threat detection',
        'Security analytics dashboard',
        'WebSocket mobile connectivity'
      ]
    },
    mobile: {
      title: 'Mobile Application',
      subtitle: 'For iOS and Android devices',
      icon: DevicePhoneMobileIcon,
      downloads: [
        { name: 'iOS App Store', version: 'v1.0.0', size: '45.2 MB', link: '#' },
        { name: 'Google Play', version: 'v1.0.0', size: '42.8 MB', link: '#' },
        { name: 'APK Direct', version: 'v1.0.0', size: '38.5 MB', link: '#' }
      ],
      features: [
        'Connect to desktop app',
        'Real-time security alerts',
        'Analysis viewing interface',
        'Cross-platform synchronization'
      ]
    }
  }

  return (
    <section id="download" className="py-20 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-black/40"></div>
      <div className="absolute inset-0 bg-cyber-radial opacity-30"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Download <span className="text-gradient">Cyber Forge AI</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Get started with our comprehensive cybersecurity platform. 
            Choose your platform and begin protecting your digital life today.
          </p>
        </motion.div>

        {/* Platform Selector */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex justify-center mb-12"
        >
          <div className="glass-effect rounded-lg p-2 flex">
            {Object.entries(platforms).map(([key, platform]) => (
              <button
                key={key}
                onClick={() => setSelectedPlatform(key)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-md transition-all duration-300 ${
                  selectedPlatform === key
                    ? 'bg-cyber-blue text-white'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <platform.icon className="h-5 w-5" />
                <span className="font-medium">{platform.title}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Download Content */}
        <motion.div
          key={selectedPlatform}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          {/* Platform Info */}
          <div className="space-y-8">
            <div>
              <h3 className="text-3xl font-bold text-white mb-2">
                {platforms[selectedPlatform].title}
              </h3>
              <p className="text-xl text-gray-300">
                {platforms[selectedPlatform].subtitle}
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <h4 className="text-xl font-semibold text-white">Key Features:</h4>
              <ul className="space-y-3">
                {platforms[selectedPlatform].features.map((feature, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center space-x-3"
                  >
                    <CheckCircleIcon className="h-5 w-5 text-cyber-blue flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* System Requirements */}
            <div className="glass-effect rounded-lg p-6">
              <h4 className="text-lg font-semibold text-white mb-3">System Requirements:</h4>
              <div className="text-gray-300 text-sm space-y-1">
                {selectedPlatform === 'desktop' ? (
                  <>
                    <p>• Operating System: Windows 10+, macOS 10.15+, Ubuntu 18.04+</p>
                    <p>• Memory: 4GB RAM minimum, 8GB recommended</p>
                    <p>• Storage: 200MB available space</p>
                    <p>• Network: Internet connection required</p>
                  </>
                ) : (
                  <>
                    <p>• iOS 13.0+ or Android 8.0+</p>
                    <p>• 2GB RAM minimum</p>
                    <p>• 100MB available storage</p>
                    <p>• WiFi or cellular data connection</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Downloads */}
          <div className="space-y-6">
            {platforms[selectedPlatform].downloads.map((download, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="glass-effect rounded-lg p-6 hover-lift group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-xl font-semibold text-white group-hover:text-cyber-blue transition-colors">
                      {download.name}
                    </h4>
                    <p className="text-gray-400 text-sm">
                      {download.version} • {download.size}
                    </p>
                  </div>
                  <CloudArrowDownIcon className="h-8 w-8 text-cyber-blue" />
                </div>
                
                <motion.a
                  href={download.link}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="block w-full bg-cyber-blue hover:bg-blue-600 text-white text-center font-bold py-3 px-6 rounded-lg transition-all duration-300 cyber-glow"
                >
                  Download Now
                </motion.a>
              </motion.div>
            ))}

            {/* Additional Info */}
            <div className="glass-effect rounded-lg p-6 border border-cyber-blue/30">
              <div className="text-center">
                <h4 className="text-lg font-semibold text-white mb-2">Need Help?</h4>
                <p className="text-gray-300 text-sm mb-4">
                  Check out our installation guides and documentation.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="#"
                    className="flex-1 text-center glass-effect hover:bg-white/10 text-white py-2 px-4 rounded-lg transition-all duration-300"
                  >
                    Installation Guide
                  </a>
                  <a
                    href="#"
                    className="flex-1 text-center glass-effect hover:bg-white/10 text-white py-2 px-4 rounded-lg transition-all duration-300"
                  >
                    Documentation
                  </a>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center mt-16"
        >
          <div className="glass-effect rounded-xl p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-4">
              Free and Open Source
            </h3>
            <p className="text-gray-300 mb-6">
              Cyber Forge AI is completely free to use and open source. 
              Join our community and contribute to the future of cybersecurity.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#"
                className="glass-effect hover:bg-white/10 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300"
              >
                View on GitHub
              </a>
              <a
                href="#"
                className="glass-effect hover:bg-white/10 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300"
              >
                Join Community
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}