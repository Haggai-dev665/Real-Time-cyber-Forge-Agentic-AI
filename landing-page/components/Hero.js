import { motion } from 'framer-motion'
import { ShieldCheckIcon, SparklesIcon } from '@heroicons/react/24/outline'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-cyber-radial"></div>
      <div className="absolute inset-0 opacity-20">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-cyber-blue rounded-full"
            animate={{
              x: [0, Math.random() * 1000],
              y: [0, Math.random() * 1000],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 10 + 5,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
            style={{
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Hero Content */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center space-x-2 glass-effect rounded-full px-4 py-2"
          >
            <SparklesIcon className="h-5 w-5 text-cyber-blue" />
            <span className="text-sm font-medium">AI-Powered Cybersecurity</span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-black leading-tight"
          >
            <span className="block text-white">Real-Time</span>
            <span className="block text-gradient cyber-text-glow animate-glow">
              Cyber Forge AI
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed"
          >
            Advanced cybersecurity platform that uses machine learning and agentic AI 
            to analyze your browsing patterns in real-time, providing comprehensive 
            threat detection and security insights.
          </motion.p>

          {/* Feature Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-wrap justify-center gap-6 text-sm"
          >
            {[
              { icon: ShieldCheckIcon, text: 'Real-time Threat Detection' },
              { icon: SparklesIcon, text: 'AI-Powered Analysis' },
              { icon: ShieldCheckIcon, text: 'Cross-Platform Security' },
            ].map((feature, index) => (
              <div key={index} className="flex items-center space-x-2 glass-effect rounded-lg px-3 py-2">
                <feature.icon className="h-4 w-4 text-cyber-blue" />
                <span className="text-white">{feature.text}</span>
              </div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8"
          >
            <motion.a
              href="#download"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-cyber-blue hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-lg text-lg cyber-glow hover-lift transition-all duration-300"
            >
              Download Now
            </motion.a>
            <motion.a
              href="#features"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="glass-effect hover:bg-white/20 text-white font-bold py-4 px-8 rounded-lg text-lg hover-lift transition-all duration-300"
            >
              Learn More
            </motion.a>
          </motion.div>
        </motion.div>

        {/* Floating Elements */}
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-20 left-10 w-16 h-16 bg-cyber-blue/20 rounded-full blur-xl"
        />
        <motion.div
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 6, repeat: Infinity, delay: 1 }}
          className="absolute bottom-20 right-10 w-24 h-24 bg-purple-500/20 rounded-full blur-xl"
        />
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center"
        >
          <div className="w-1 h-3 bg-cyber-blue rounded-full mt-2 animate-cyber-pulse"></div>
        </motion.div>
      </motion.div>
    </section>
  )
}