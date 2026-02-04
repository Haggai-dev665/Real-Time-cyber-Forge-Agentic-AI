import { motion } from 'framer-motion'
import { Shield, ArrowDown } from 'lucide-react'
import { NetworkAnimation } from './animations/NetworkAnimation'

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0 z-0">
        <NetworkAnimation />
      </div>

      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-cyber-950/60 z-10" />

      <div className="container-section relative z-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center lg:text-left"
          >
            {/* Status Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyber-900/80 border border-cyber-700 rounded-full mb-6"
            >
              <span className="status-dot status-dot-active" />
              <span className="text-sm font-mono text-cyber-300">
                System Active • Real-time Protection Enabled
              </span>
            </motion.div>

            <h1 className="heading-primary text-white mb-6">
              Autonomous Security.{' '}
              <span className="text-status-safe">Always Watching.</span>
            </h1>

            <p className="text-body max-w-xl mx-auto lg:mx-0 mb-8">
              CyberForge is a real-time agentic cybersecurity platform that monitors your 
              browser, analyzes web traffic, and detects threats autonomously. 
              No configuration required. No blind spots.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a href="#download" className="btn-primary">
                <Shield className="w-5 h-5" />
                Download CyberForge
              </a>
              <a href="#capabilities" className="btn-secondary">
                Explore Capabilities
              </a>
            </div>

            {/* Terminal Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-12 p-4 bg-cyber-900/80 border border-cyber-800 rounded-lg font-mono text-sm text-left max-w-md mx-auto lg:mx-0"
            >
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-cyber-800">
                <div className="w-3 h-3 rounded-full bg-status-danger" />
                <div className="w-3 h-3 rounded-full bg-status-warning" />
                <div className="w-3 h-3 rounded-full bg-status-safe" />
                <span className="ml-2 text-cyber-500 text-xs">cyberforge-agent</span>
              </div>
              <div className="space-y-1">
                <p className="text-status-safe">$ cyberforge --status</p>
                <p className="text-cyber-400">Agent: <span className="text-status-safe">ACTIVE</span></p>
                <p className="text-cyber-400">Threats Blocked: <span className="text-white">2,847</span></p>
                <p className="text-cyber-400">Last Scan: <span className="text-white">2ms ago</span></p>
              </div>
            </motion.div>
          </motion.div>

          {/* Animation Area */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:block relative"
          >
            <ThreatDetectionVisual />
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex flex-col items-center gap-2 text-cyber-500"
          >
            <span className="text-xs font-medium">Scroll to explore</span>
            <ArrowDown className="w-4 h-4" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function ThreatDetectionVisual() {
  return (
    <div className="relative w-full aspect-square max-w-lg mx-auto">
      {/* Central Shield */}
      <motion.div
        animate={{ 
          boxShadow: [
            '0 0 20px rgba(16, 185, 129, 0.2)',
            '0 0 40px rgba(16, 185, 129, 0.4)',
            '0 0 20px rgba(16, 185, 129, 0.2)',
          ]
        }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-cyber-900 border-2 border-status-safe rounded-2xl flex items-center justify-center"
      >
        <Shield className="w-16 h-16 text-status-safe" />
      </motion.div>

      {/* Orbiting Threats */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <OrbitingNode key={i} index={i} />
      ))}

      {/* Scan Lines */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
        className="absolute inset-0"
      >
        <div className="absolute top-1/2 left-1/2 w-full h-0.5 -translate-y-1/2 origin-left bg-status-safe/10" />
      </motion.div>

      {/* Circular Grid */}
      {[1, 2, 3].map((ring) => (
        <div
          key={ring}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-cyber-800/50 rounded-full"
          style={{
            width: `${ring * 100 + 100}px`,
            height: `${ring * 100 + 100}px`,
          }}
        />
      ))}
    </div>
  )
}

function OrbitingNode({ index }: { index: number }) {
  const isDetected = index % 3 === 0
  const radius = 120 + (index % 3) * 50
  const duration = 10 + index * 2
  const delay = index * 0.5

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration, ease: 'linear', delay }}
      className="absolute top-1/2 left-1/2"
      style={{ width: radius * 2, height: radius * 2, marginLeft: -radius, marginTop: -radius }}
    >
      <motion.div
        className={`absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full ${
          isDetected ? 'bg-status-danger' : 'bg-status-safe'
        }`}
        animate={isDetected ? { scale: [1, 1.5, 1] } : {}}
        transition={{ repeat: Infinity, duration: 0.5 }}
      />
    </motion.div>
  )
}
