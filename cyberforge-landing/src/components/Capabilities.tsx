import { motion } from 'framer-motion'
import { 
  Globe, 
  Network, 
  Brain, 
  Shield, 
  FileSearch, 
  Eye 
} from 'lucide-react'
import { ReactNode } from 'react'

interface Capability {
  icon: ReactNode
  title: string
  description: string
  animation: ReactNode
}

const capabilities: Capability[] = [
  {
    icon: <Globe className="w-6 h-6" />,
    title: 'Browser Monitoring',
    description: 'Real-time surveillance of browser activity. Detects malicious scripts, phishing attempts, and suspicious redirects before they execute.',
    animation: <BrowserMonitorAnimation />,
  },
  {
    icon: <Network className="w-6 h-6" />,
    title: 'Traffic Inspection',
    description: 'Deep packet analysis of all network traffic. Identifies command-and-control communications and data exfiltration attempts.',
    animation: <TrafficInspectionAnimation />,
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'AI-Powered Scanning',
    description: 'Twelve specialized ML models analyze behavior patterns. Detects zero-day threats that signature-based systems miss.',
    animation: <AIScanningAnimation />,
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Threat Intelligence',
    description: 'Continuous integration with global threat feeds. Cross-references activity against known attack patterns and IOCs.',
    animation: <ThreatIntelAnimation />,
  },
  {
    icon: <FileSearch className="w-6 h-6" />,
    title: 'File Analysis',
    description: 'Sandboxed execution and static analysis of suspicious files. Behavioral fingerprinting prevents sophisticated malware.',
    animation: <FileAnalysisAnimation />,
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: 'Background Protection',
    description: 'Continuous monitoring even when idle. Agentic AI operates autonomously to maintain security posture 24/7.',
    animation: <BackgroundProtectionAnimation />,
  },
]

export function Capabilities() {
  return (
    <section id="capabilities" className="section-padding">
      <div className="container-section">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="heading-secondary text-white mb-4">
            Security Capabilities
          </h2>
          <p className="text-body max-w-2xl mx-auto">
            A comprehensive security layer powered by machine learning. 
            Each capability works in concert to provide defense in depth.
          </p>
        </motion.div>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((capability, index) => (
            <motion.div
              key={capability.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <CapabilityCard capability={capability} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CapabilityCard({ capability }: { capability: Capability }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      className="card card-hover h-full"
    >
      {/* Animation Area */}
      <div className="h-32 mb-4 relative overflow-hidden rounded-lg bg-cyber-900/50">
        {capability.animation}
      </div>

      {/* Content */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-cyber-800 text-status-info flex-shrink-0">
          {capability.icon}
        </div>
        <div>
          <h3 className="font-semibold text-white mb-2">{capability.title}</h3>
          <p className="text-sm text-cyber-400 leading-relaxed">
            {capability.description}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// Animation Components

function BrowserMonitorAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 120 80" className="w-full h-full p-4">
        {/* Browser Window */}
        <rect x="10" y="10" width="100" height="60" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="1" />
        <rect x="10" y="10" width="100" height="10" rx="4" fill="#334155" />
        <circle cx="18" cy="15" r="2" fill="#ef4444" />
        <circle cx="26" cy="15" r="2" fill="#f59e0b" />
        <circle cx="34" cy="15" r="2" fill="#22c55e" />
        
        {/* Content Lines */}
        <motion.rect
          x="20" y="28" width="40" height="3" rx="1" fill="#475569"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.rect
          x="20" y="36" width="60" height="3" rx="1" fill="#475569"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, delay: 0.3, repeat: Infinity }}
        />
        
        {/* Scanning Line */}
        <motion.line
          x1="15" y1="25" x2="105" y2="25"
          stroke="#3b82f6" strokeWidth="2"
          animate={{ y1: [25, 65, 25], y2: [25, 65, 25] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Threat Detection */}
        <motion.circle
          cx="70" cy="45" r="6"
          fill="transparent" stroke="#ef4444" strokeWidth="2"
          animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
        />
      </svg>
    </div>
  )
}

function TrafficInspectionAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 120 80" className="w-full h-full p-4">
        {/* Network Nodes */}
        <circle cx="20" cy="40" r="8" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
        <circle cx="100" cy="40" r="8" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
        
        {/* Inspection Box */}
        <rect x="45" y="25" width="30" height="30" rx="4" fill="#1e293b" stroke="#22c55e" strokeWidth="2" />
        <motion.path
          d="M52 40 L58 46 L68 34"
          stroke="#22c55e" strokeWidth="2" fill="none" strokeLinecap="round"
          animate={{ pathLength: [0, 1, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        
        {/* Data Packets */}
        {[0, 1, 2].map((i) => (
          <motion.rect
            key={i}
            x="20" y="38" width="8" height="4" rx="1" fill="#3b82f6"
            animate={{ x: [20, 45, 75, 100] }}
            transition={{ duration: 2, delay: i * 0.7, repeat: Infinity }}
          />
        ))}
        
        {/* Connection Lines */}
        <line x1="28" y1="40" x2="45" y2="40" stroke="#334155" strokeWidth="1" strokeDasharray="4" />
        <line x1="75" y1="40" x2="92" y2="40" stroke="#334155" strokeWidth="1" strokeDasharray="4" />
      </svg>
    </div>
  )
}

function AIScanningAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 120 80" className="w-full h-full p-4">
        {/* Neural Network Nodes */}
        {/* Input Layer */}
        {[20, 35, 50, 65].map((y, i) => (
          <motion.circle
            key={`in-${i}`}
            cx="20" cy={y} r="4" fill="#3b82f6"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
          />
        ))}
        
        {/* Hidden Layer */}
        {[25, 40, 55].map((y, i) => (
          <motion.circle
            key={`hid-${i}`}
            cx="60" cy={y} r="5" fill="#8b5cf6"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, delay: 0.5 + i * 0.2, repeat: Infinity }}
          />
        ))}
        
        {/* Output Node */}
        <motion.circle
          cx="100" cy="40" r="6" fill="#22c55e"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        
        {/* Connections */}
        {[20, 35, 50, 65].map((y1, i) =>
          [25, 40, 55].map((y2, j) => (
            <motion.line
              key={`c1-${i}-${j}`}
              x1="24" y1={y1} x2="55" y2={y2}
              stroke="#334155" strokeWidth="1"
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 1.5, delay: (i + j) * 0.1, repeat: Infinity }}
            />
          ))
        )}
        {[25, 40, 55].map((y, i) => (
          <motion.line
            key={`c2-${i}`}
            x1="65" y1={y} x2="94" y2="40"
            stroke="#334155" strokeWidth="1"
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 1.5, delay: 0.8 + i * 0.1, repeat: Infinity }}
          />
        ))}
      </svg>
    </div>
  )
}

function ThreatIntelAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 120 80" className="w-full h-full p-4">
        {/* Globe */}
        <circle cx="60" cy="40" r="25" fill="none" stroke="#334155" strokeWidth="1" />
        <ellipse cx="60" cy="40" rx="25" ry="10" fill="none" stroke="#334155" strokeWidth="1" />
        <ellipse cx="60" cy="40" rx="10" ry="25" fill="none" stroke="#334155" strokeWidth="1" />
        
        {/* Threat Points */}
        {[
          { x: 45, y: 30, color: '#ef4444' },
          { x: 75, y: 35, color: '#f59e0b' },
          { x: 55, y: 55, color: '#ef4444' },
          { x: 70, y: 50, color: '#22c55e' },
        ].map((point, i) => (
          <motion.g key={i}>
            <motion.circle
              cx={point.x} cy={point.y} r="3" fill={point.color}
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, delay: i * 0.5, repeat: Infinity }}
            />
            <motion.circle
              cx={point.x} cy={point.y} r="6" fill="none" stroke={point.color}
              animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, delay: i * 0.5, repeat: Infinity }}
            />
          </motion.g>
        ))}
        
        {/* Data Feeds */}
        <motion.path
          d="M15 40 L35 40" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4"
          animate={{ strokeDashoffset: [0, -8] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
        />
        <motion.path
          d="M85 40 L105 40" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4"
          animate={{ strokeDashoffset: [0, 8] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
        />
      </svg>
    </div>
  )
}

function FileAnalysisAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 120 80" className="w-full h-full p-4">
        {/* File Icon */}
        <path d="M35 15 L55 15 L65 25 L65 65 L35 65 Z" fill="#1e293b" stroke="#334155" strokeWidth="2" />
        <path d="M55 15 L55 25 L65 25" fill="none" stroke="#334155" strokeWidth="2" />
        
        {/* File Lines */}
        <rect x="40" y="32" width="20" height="2" rx="1" fill="#475569" />
        <rect x="40" y="38" width="15" height="2" rx="1" fill="#475569" />
        <rect x="40" y="44" width="18" height="2" rx="1" fill="#475569" />
        
        {/* Sandbox Box */}
        <rect x="75" y="20" width="35" height="40" rx="4" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="4" />
        <text x="92" y="42" textAnchor="middle" fill="#8b5cf6" fontSize="8" fontFamily="monospace">
          SANDBOX
        </text>
        
        {/* Analysis Arrow */}
        <motion.path
          d="M68 40 L72 40" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"
          animate={{ x: [0, 3, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <motion.polygon
          points="72,37 78,40 72,43" fill="#22c55e"
          animate={{ x: [0, 3, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        
        {/* Status Indicator */}
        <motion.circle
          cx="100" cy="18" r="4" fill="#22c55e"
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </svg>
    </div>
  )
}

function BackgroundProtectionAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 120 80" className="w-full h-full p-4">
        {/* Shield */}
        <motion.path
          d="M60 15 L80 22 L80 45 Q80 60 60 70 Q40 60 40 45 L40 22 Z"
          fill="#1e293b" stroke="#22c55e" strokeWidth="2"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        
        {/* Eye */}
        <ellipse cx="60" cy="38" rx="12" ry="8" fill="none" stroke="#3b82f6" strokeWidth="2" />
        <motion.circle
          cx="60" cy="38" r="4" fill="#3b82f6"
          animate={{ cx: [57, 63, 57] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        
        {/* Pulse Rings */}
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx="60" cy="42" r="25" fill="none" stroke="#22c55e" strokeWidth="1"
            animate={{ 
              scale: [1, 2, 2], 
              opacity: [0.5, 0, 0] 
            }}
            transition={{ 
              duration: 3, 
              delay: i * 1, 
              repeat: Infinity 
            }}
          />
        ))}
        
        {/* 24/7 Badge */}
        <rect x="85" y="55" width="25" height="12" rx="2" fill="#22c55e" />
        <text x="97" y="64" textAnchor="middle" fill="#0a0f1c" fontSize="8" fontWeight="bold" fontFamily="monospace">
          24/7
        </text>
      </svg>
    </div>
  )
}
