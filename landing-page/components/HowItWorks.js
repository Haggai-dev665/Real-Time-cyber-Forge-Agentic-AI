import { motion } from 'framer-motion'
import { 
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  CloudIcon,
  ArrowRightIcon 
} from '@heroicons/react/24/outline'

export default function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Install Desktop App',
      description: 'Download and install the Cyber Forge AI desktop application on your computer. The app runs quietly in the background.',
      icon: ComputerDesktopIcon,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      number: '02',
      title: 'AI Begins Monitoring',
      description: 'Our advanced AI algorithms start analyzing your browsing patterns in real-time, learning your normal behavior.',
      icon: CloudIcon,
      color: 'from-purple-500 to-pink-500'
    },
    {
      number: '03',
      title: 'Connect Mobile App',
      description: 'Install the mobile companion app to receive alerts and view security insights on the go.',
      icon: DevicePhoneMobileIcon,
      color: 'from-green-500 to-emerald-500'
    },
    {
      number: '04',
      title: 'Stay Protected',
      description: 'Receive instant alerts about threats, view detailed security reports, and get AI-powered recommendations.',
      icon: ArrowRightIcon,
      color: 'from-orange-500 to-red-500'
    }
  ]

  return (
    <section id="how-it-works" className="py-20 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-transparent"></div>
      
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
            How <span className="text-gradient">It Works</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Get started with Cyber Forge AI in just a few simple steps and experience 
            next-generation cybersecurity protection.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="space-y-12">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              className={`flex flex-col ${
                index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
              } items-center gap-8 lg:gap-16`}
            >
              {/* Content */}
              <div className="flex-1 text-center lg:text-left">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="glass-effect rounded-xl p-8"
                >
                  {/* Step Number */}
                  <div className={`inline-block text-6xl font-black text-transparent bg-gradient-to-r ${step.color} bg-clip-text mb-4`}>
                    {step.number}
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                    {step.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-gray-300 text-lg leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>
              </div>

              {/* Icon/Visual */}
              <div className="flex-1 flex justify-center">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-r ${step.color} p-8 cyber-glow`}
                >
                  <step.icon className="w-full h-full text-white" />
                </motion.div>
              </div>

              {/* Connection Line (hidden on mobile) */}
              {index < steps.length - 1 && (
                <motion.div
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: (index + 1) * 0.3 }}
                  className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 w-px h-20 bg-gradient-to-b from-cyber-blue to-transparent"
                  style={{ 
                    top: `${(index + 1) * 300}px`,
                    zIndex: -1 
                  }}
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* Bottom Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-center mt-20"
        >
          <div className="glass-effect rounded-xl p-8 max-w-3xl mx-auto">
            <h3 className="text-3xl font-bold text-white mb-4">
              Advanced AI Protection in Minutes
            </h3>
            <p className="text-gray-300 text-lg mb-8">
              Our intelligent system adapts to your browsing habits and provides 
              personalized security recommendations powered by machine learning.
            </p>
            
            {/* Feature Pills */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {[
                'Zero Configuration',
                'Real-time Protection',
                'AI Learning',
                'Cross-Platform'
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.05 }}
                  className="glass-effect rounded-full px-4 py-2 text-sm font-medium text-cyber-blue"
                >
                  {feature}
                </motion.div>
              ))}
            </div>

            <motion.a
              href="#download"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block bg-cyber-blue hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-lg cyber-glow hover-lift transition-all duration-300"
            >
              Start Your Protection Journey
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}