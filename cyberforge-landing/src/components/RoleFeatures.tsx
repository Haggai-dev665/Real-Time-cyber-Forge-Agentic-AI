import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, 
  UserCog, 
  Shield, 
  Check,
  Activity,
  Bell,
  Settings,
  Terminal,
  Database,
  Lock,
  Zap,
  Search
} from 'lucide-react'
import { ReactNode } from 'react'

interface Role {
  id: string
  icon: ReactNode
  title: string
  subtitle: string
  description: string
  features: string[]
  animation: ReactNode
  level: 1 | 2 | 3
}

const roles: Role[] = [
  {
    id: 'user',
    icon: <User className="w-6 h-6" />,
    title: 'Regular User',
    subtitle: 'Set and Forget Protection',
    description: 'Install once and let CyberForge handle everything. Get notified only when action is needed.',
    features: [
      'Automatic threat blocking',
      'Real-time protection status',
      'Simple notification alerts',
      'One-click quarantine actions',
      'Automatic updates',
    ],
    animation: <RegularUserAnimation />,
    level: 1,
  },
  {
    id: 'admin',
    icon: <UserCog className="w-6 h-6" />,
    title: 'System Admin',
    subtitle: 'Complete Visibility & Control',
    description: 'Full access to logs, settings, and network-wide deployment. Manage security policies across your infrastructure.',
    features: [
      'Centralized dashboard',
      'Custom security policies',
      'Network-wide deployment',
      'Detailed activity logs',
      'Integration APIs',
      'Scheduled scans',
    ],
    animation: <AdminAnimation />,
    level: 2,
  },
  {
    id: 'expert',
    icon: <Shield className="w-6 h-6" />,
    title: 'Security Expert',
    subtitle: 'Deep Analysis & Custom Models',
    description: 'Access raw data, train custom ML models, and integrate with your existing security stack.',
    features: [
      'Raw packet inspection',
      'Custom ML model training',
      'SIEM/SOAR integration',
      'Threat hunting tools',
      'IOC management',
      'Custom detection rules',
      'API access to all data',
    ],
    animation: <ExpertAnimation />,
    level: 3,
  },
]

export function RoleFeatures() {
  const [activeRole, setActiveRole] = useState<string>('user')

  const currentRole = roles.find((r) => r.id === activeRole)!

  return (
    <section id="roles" className="section-padding bg-cyber-900/30">
      <div className="container-section">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="heading-secondary text-white mb-4">
            Built for Every Skill Level
          </h2>
          <p className="text-body max-w-2xl mx-auto">
            Whether you're a casual user or a security researcher, CyberForge 
            adapts to your needs with progressively deeper capabilities.
          </p>
        </motion.div>

        {/* Role Selector */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {roles.map((role) => (
            <motion.button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl transition-all duration-300
                ${activeRole === role.id 
                  ? 'bg-cyber-700 border-2 border-status-info text-white' 
                  : 'bg-cyber-800/50 border-2 border-cyber-700 text-cyber-400 hover:border-cyber-500'
                }`}
            >
              <div className={activeRole === role.id ? 'text-status-info' : ''}>
                {role.icon}
              </div>
              <div className="text-left">
                <div className="font-semibold">{role.title}</div>
                <div className="text-xs opacity-70">Level {role.level}</div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Active Role Display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeRole}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid lg:grid-cols-2 gap-8 items-center"
          >
            {/* Animation Panel */}
            <div className="order-2 lg:order-1">
              <div className="bg-cyber-900/50 border border-cyber-700 rounded-2xl p-8 h-80 relative overflow-hidden">
                {currentRole.animation}
              </div>
            </div>

            {/* Features Panel */}
            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-cyber-800 text-status-info">
                  {currentRole.icon}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{currentRole.title}</h3>
                  <p className="text-status-info">{currentRole.subtitle}</p>
                </div>
              </div>

              <p className="text-cyber-400 mb-6 text-lg">
                {currentRole.description}
              </p>

              {/* Power Level Indicator */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-status-warning" />
                  <span className="text-sm text-cyber-400">Capability Level</span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={`h-2 flex-1 rounded-full transition-colors ${
                        level <= currentRole.level 
                          ? 'bg-status-info' 
                          : 'bg-cyber-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Features List */}
              <ul className="space-y-3">
                {currentRole.features.map((feature, index) => (
                  <motion.li
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <Check className="w-5 h-5 text-status-safe flex-shrink-0" />
                    <span className="text-cyber-300">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

// Animation Components

function RegularUserAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Protected User */}
        <motion.circle
          cx="100" cy="100" r="50" fill="#1e293b" stroke="#22c55e" strokeWidth="3"
        />
        
        {/* Shield Icon */}
        <motion.path
          d="M100 70 L120 78 L120 100 Q120 115 100 125 Q80 115 80 100 L80 78 Z"
          fill="#22c55e" opacity="0.3" stroke="#22c55e" strokeWidth="2"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        
        {/* Check Mark */}
        <motion.path
          d="M90 98 L97 105 L112 88"
          fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
          animate={{ pathLength: [0, 1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
        />
        
        {/* Protection Ring */}
        <motion.circle
          cx="100" cy="100" r="65" fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="8 4"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Status Indicators */}
        <g>
          <motion.circle
            cx="100" cy="30" r="8" fill="#22c55e"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <Bell x="96" y="26" width="8" height="8" />
        </g>
        
        {/* Blocked Threats */}
        {[45, 135, 225, 315].map((angle, i) => {
          const rad = (angle * Math.PI) / 180
          const x = 100 + 80 * Math.cos(rad)
          const y = 100 + 80 * Math.sin(rad)
          return (
            <motion.g key={i}>
              <motion.circle
                cx={x} cy={y} r="6" fill="#ef4444"
                animate={{ 
                  cx: [x, 100 + 60 * Math.cos(rad), x],
                  cy: [y, 100 + 60 * Math.sin(rad), y],
                  opacity: [0.8, 0, 0.8]
                }}
                transition={{ duration: 3, delay: i * 0.8, repeat: Infinity }}
              />
            </motion.g>
          )
        })}
      </svg>
    </div>
  )
}

function AdminAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Central Dashboard */}
        <rect x="60" y="50" width="80" height="60" rx="4" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
        
        {/* Dashboard Content */}
        <rect x="68" y="58" width="30" height="20" rx="2" fill="#22c55e" opacity="0.3" />
        <rect x="102" y="58" width="30" height="20" rx="2" fill="#f59e0b" opacity="0.3" />
        <rect x="68" y="82" width="64" height="20" rx="2" fill="#3b82f6" opacity="0.3" />
        
        {/* Activity Bars */}
        {[0, 1, 2, 3].map((i) => (
          <motion.rect
            key={i}
            x={72 + i * 15} y="88" width="8" height="10" rx="1" fill="#3b82f6"
            animate={{ height: [6, 14, 6], y: [92, 84, 92] }}
            transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
          />
        ))}
        
        {/* Connected Endpoints */}
        {[
          { x: 30, y: 80, label: 'PC-1' },
          { x: 170, y: 80, label: 'PC-2' },
          { x: 50, y: 150, label: 'PC-3' },
          { x: 150, y: 150, label: 'PC-4' },
        ].map((endpoint, i) => (
          <g key={i}>
            <motion.line
              x1="100" y1="80" x2={endpoint.x} y2={endpoint.y}
              stroke="#334155" strokeWidth="1" strokeDasharray="4"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, delay: i * 0.5, repeat: Infinity }}
            />
            <motion.circle
              cx={endpoint.x} cy={endpoint.y} r="12" fill="#1e293b" stroke="#22c55e" strokeWidth="2"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, delay: i * 0.5, repeat: Infinity }}
            />
            <Activity x={endpoint.x - 6} y={endpoint.y - 6} width="12" height="12" className="text-status-safe" />
          </g>
        ))}
        
        {/* Settings Gear */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: '100px 130px' }}
        >
          <circle cx="100" cy="130" r="15" fill="#1e293b" stroke="#8b5cf6" strokeWidth="2" />
          <Settings x="92" y="122" width="16" height="16" className="text-purple-500" />
        </motion.g>
      </svg>
    </div>
  )
}

function ExpertAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Terminal Window */}
        <rect x="20" y="20" width="100" height="80" rx="4" fill="#0a0f1c" stroke="#22c55e" strokeWidth="2" />
        <rect x="20" y="20" width="100" height="12" rx="4" fill="#22c55e" opacity="0.2" />
        
        {/* Terminal Content */}
        <motion.g>
          {['> analyze --deep', '> model train', '> export iocs'].map((cmd, i) => (
            <motion.text
              key={i}
              x="28" y={45 + i * 15} fill="#22c55e" fontSize="8" fontFamily="monospace"
              animate={{ opacity: [0, 1] }}
              transition={{ duration: 0.5, delay: i * 0.8 }}
            >
              {cmd}
            </motion.text>
          ))}
        </motion.g>
        
        {/* Data Flow */}
        <motion.path
          d="M120 60 Q140 60 140 80 Q140 100 160 100"
          fill="none" stroke="#3b82f6" strokeWidth="2"
          strokeDasharray="4"
          animate={{ strokeDashoffset: [0, -16] }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        
        {/* ML Model Box */}
        <rect x="130" y="120" width="60" height="50" rx="4" fill="#1e293b" stroke="#8b5cf6" strokeWidth="2" />
        <text x="160" y="140" textAnchor="middle" fill="#8b5cf6" fontSize="8" fontFamily="monospace">ML MODEL</text>
        
        {/* Neural Network Mini */}
        {[135, 150, 165].map((x, i) => (
          <motion.circle
            key={i}
            cx={x} cy="155" r="4" fill="#8b5cf6"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
          />
        ))}
        
        {/* Database */}
        <g>
          <ellipse cx="50" cy="130" rx="20" ry="8" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
          <rect x="30" y="130" width="40" height="25" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
          <ellipse cx="50" cy="155" rx="20" ry="8" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
          <Database x="42" y="135" width="16" height="16" className="text-amber-500" />
        </g>
        
        {/* Search/Hunt Icon */}
        <motion.g
          animate={{ x: [0, 10, 0], y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <circle cx="160" cy="50" r="12" fill="#1e293b" stroke="#ef4444" strokeWidth="2" />
          <Search x="152" y="42" width="16" height="16" className="text-red-500" />
        </motion.g>
        
        {/* Connection Lines */}
        <motion.line
          x1="50" y1="120" x2="50" y2="100"
          stroke="#f59e0b" strokeWidth="1" strokeDasharray="4"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.line
          x1="130" y1="145" x2="80" y2="145"
          stroke="#8b5cf6" strokeWidth="1" strokeDasharray="4"
          animate={{ strokeDashoffset: [0, -8] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
        />
      </svg>
    </div>
  )
}
