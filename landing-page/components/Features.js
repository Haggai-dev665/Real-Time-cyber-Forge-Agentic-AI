import { motion } from 'framer-motion'
import { 
  ShieldCheckIcon,
  CpuChipIcon,
  EyeIcon,
  BoltIcon,
  ChartBarIcon,
  DevicePhoneMobileIcon
} from '@heroicons/react/24/outline'

export default function Features() {
  const features = [
    {
      icon: ShieldCheckIcon,
      title: 'Real-Time Threat Detection',
      description: 'Advanced AI algorithms continuously monitor your browsing activity to identify and alert you about potential security threats instantly.',
      color: 'from-red-500 to-pink-500'
    },
    {
      icon: CpuChipIcon,
      title: 'AI-Powered Analysis',
      description: 'Machine learning models analyze browsing patterns, detect anomalies, and provide intelligent security recommendations.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: EyeIcon,
      title: 'Browser Monitoring',
      description: 'Comprehensive monitoring of all web pages visited with detailed security analysis and risk assessment.',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: BoltIcon,
      title: 'Instant Alerts',
      description: 'Get immediate notifications about suspicious websites, malware threats, and potential security breaches.',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      icon: ChartBarIcon,
      title: 'Security Analytics',
      description: 'Detailed reports and visualizations of your security posture with actionable insights and recommendations.',
      color: 'from-purple-500 to-indigo-500'
    },
    {
      icon: DevicePhoneMobileIcon,
      title: 'Cross-Platform Sync',
      description: 'Desktop and mobile applications work together to provide seamless security monitoring across all your devices.',
      color: 'from-teal-500 to-cyan-500'
    }
  ]

  return (
    <section id="features" className="py-20 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-black/20"></div>
      
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
            Powerful <span className="text-gradient">Security Features</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Our comprehensive cybersecurity platform combines cutting-edge AI technology 
            with real-time monitoring to keep you safe online.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              whileHover={{ y: -10 }}
              className="glass-effect rounded-xl p-6 hover-lift group"
            >
              {/* Icon */}
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className={`w-16 h-16 rounded-lg bg-gradient-to-r ${feature.color} p-3 mb-4 group-hover:cyber-glow transition-all duration-300`}
              >
                <feature.icon className="w-full h-full text-white" />
              </motion.div>

              {/* Content */}
              <h3 className="text-xl font-bold text-white mb-3 group-hover:text-cyber-blue transition-colors duration-300">
                {feature.title}
              </h3>
              <p className="text-gray-300 leading-relaxed">
                {feature.description}
              </p>

              {/* Hover Effect */}
              <motion.div
                initial={{ scaleX: 0 }}
                whileHover={{ scaleX: 1 }}
                className="h-1 bg-gradient-to-r from-cyber-blue to-transparent mt-4 origin-left"
              />
            </motion.div>
          ))}
        </div>

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
              Ready to Secure Your Digital Life?
            </h3>
            <p className="text-gray-300 mb-6">
              Join thousands of users who trust Cyber Forge AI to protect their online activities.
            </p>
            <motion.a
              href="#download"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block bg-cyber-blue hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg cyber-glow hover-lift transition-all duration-300"
            >
              Get Started Today
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}