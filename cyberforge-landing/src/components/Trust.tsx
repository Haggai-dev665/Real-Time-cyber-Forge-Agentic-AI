import { motion } from 'framer-motion'
import { 
  Lock, 
  Server, 
  Eye, 
  Cpu, 
  Database, 
  Cloud 
} from 'lucide-react'

const trustPillars = [
  {
    icon: <Lock className="w-6 h-6" />,
    title: 'Privacy First',
    description: 'Your data never leaves your device without explicit consent. All analysis runs locally by default.',
  },
  {
    icon: <Server className="w-6 h-6" />,
    title: 'Local Processing',
    description: 'Core ML models run entirely on your hardware. Cloud features are opt-in and encrypted end-to-end.',
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: 'Transparent AI',
    description: 'Every decision is explainable. Access detailed logs showing exactly why threats were flagged.',
  },
]

const techStack = [
  { icon: <Cpu className="w-5 h-5" />, label: '12 ML Models' },
  { icon: <Database className="w-5 h-5" />, label: 'Local Inference' },
  { icon: <Cloud className="w-5 h-5" />, label: 'Optional Cloud Sync' },
]

export function Trust() {
  return (
    <section id="trust" className="section-padding bg-cyber-900/30">
      <div className="container-section">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="heading-secondary text-white mb-4">
            Built on Trust
          </h2>
          <p className="text-body max-w-2xl mx-auto">
            Security software must be trustworthy. CyberForge is designed with 
            privacy and transparency as core principles, not afterthoughts.
          </p>
        </motion.div>

        {/* Trust Pillars */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {trustPillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="text-center"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyber-800 border border-cyber-700 
                  flex items-center justify-center text-status-safe"
              >
                {pillar.icon}
              </motion.div>
              <h3 className="text-xl font-semibold text-white mb-2">{pillar.title}</h3>
              <p className="text-cyber-400 leading-relaxed">{pillar.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Architecture Diagram */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-cyber-900/50 border border-cyber-700 rounded-2xl p-8"
        >
          <h3 className="text-xl font-semibold text-white text-center mb-8">
            Privacy-Preserving Architecture
          </h3>

          <div className="relative h-64">
            <ArchitectureDiagram />
          </div>

          {/* Tech Stack Tags */}
          <div className="flex flex-wrap justify-center gap-4 mt-8 pt-8 border-t border-cyber-700">
            {techStack.map((tech, i) => (
              <motion.div
                key={tech.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyber-800 border border-cyber-700"
              >
                <span className="text-status-info">{tech.icon}</span>
                <span className="text-sm text-cyber-300">{tech.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Open Source Note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-cyber-500 text-sm">
            CyberForge ML models are trained on open datasets. 
            <a href="#" className="text-status-info hover:underline ml-1">
              View our methodology →
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  )
}

function ArchitectureDiagram() {
  return (
    <svg viewBox="0 0 400 200" className="w-full h-full">
      {/* Your Device Box */}
      <rect x="20" y="20" width="180" height="160" rx="8" fill="#1e293b" stroke="#22c55e" strokeWidth="2" />
      <text x="110" y="45" textAnchor="middle" fill="#22c55e" fontSize="12" fontWeight="600">
        YOUR DEVICE
      </text>
      
      {/* Local Components */}
      <g>
        {/* ML Engine */}
        <rect x="40" y="60" width="70" height="40" rx="4" fill="#0a0f1c" stroke="#3b82f6" strokeWidth="1" />
        <Cpu x="60" y="72" width="16" height="16" className="text-status-info" />
        <text x="75" y="92" textAnchor="middle" fill="#94a3b8" fontSize="8">ML Engine</text>
        
        {/* Data Store */}
        <rect x="120" y="60" width="70" height="40" rx="4" fill="#0a0f1c" stroke="#f59e0b" strokeWidth="1" />
        <Database x="142" y="72" width="16" height="16" className="text-amber-500" />
        <text x="155" y="92" textAnchor="middle" fill="#94a3b8" fontSize="8">Local Data</text>
        
        {/* Agent */}
        <rect x="80" y="115" width="70" height="40" rx="4" fill="#0a0f1c" stroke="#8b5cf6" strokeWidth="1" />
        <motion.circle
          cx="115" cy="130" r="8" fill="#8b5cf6" opacity="0.3"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <text x="115" y="133" textAnchor="middle" fill="#8b5cf6" fontSize="6">AI</text>
        <text x="115" y="148" textAnchor="middle" fill="#94a3b8" fontSize="8">Agent</text>
      </g>
      
      {/* Connection Lines Inside */}
      <motion.path
        d="M75 100 L75 115 M155 100 L155 115 L150 115"
        fill="none" stroke="#334155" strokeWidth="1"
        strokeDasharray="4"
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Firewall/Encryption Barrier */}
      <rect x="210" y="50" width="20" height="100" rx="4" fill="#22c55e" opacity="0.2" />
      <motion.g>
        {[60, 80, 100, 120, 140].map((y, i) => (
          <motion.rect
            key={i}
            x="215" y={y} width="10" height="4" rx="1" fill="#22c55e"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
          />
        ))}
      </motion.g>
      <Lock x="212" y="45" width="16" height="12" className="text-status-safe" />
      
      {/* Optional Cloud Box */}
      <rect x="240" y="60" width="140" height="80" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="1" strokeDasharray="4" />
      <text x="310" y="85" textAnchor="middle" fill="#64748b" fontSize="10">
        OPTIONAL CLOUD
      </text>
      <text x="310" y="100" textAnchor="middle" fill="#475569" fontSize="8">
        (Encrypted, Opt-in)
      </text>
      
      {/* Cloud Features */}
      <g>
        <circle cx="280" cy="120" r="15" fill="#0a0f1c" stroke="#334155" strokeWidth="1" />
        <Cloud x="272" y="112" width="16" height="16" className="text-cyber-500" />
        
        <circle cx="340" cy="120" r="15" fill="#0a0f1c" stroke="#334155" strokeWidth="1" />
        <Server x="332" y="112" width="16" height="16" className="text-cyber-500" />
      </g>
      
      {/* Data Flow Arrow (Optional) */}
      <motion.path
        d="M230 100 L240 100"
        fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"
        strokeDasharray="4"
        animate={{ strokeDashoffset: [0, -8] }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      
      {/* Legend */}
      <g>
        <rect x="20" y="190" width="8" height="8" rx="2" fill="#22c55e" />
        <text x="32" y="197" fill="#64748b" fontSize="8">Protected Local</text>
        
        <rect x="120" y="190" width="8" height="8" rx="2" fill="none" stroke="#334155" strokeDasharray="2" />
        <text x="132" y="197" fill="#64748b" fontSize="8">Optional Cloud</text>
      </g>
    </svg>
  )
}
