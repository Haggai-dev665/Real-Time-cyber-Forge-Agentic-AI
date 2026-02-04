import { motion } from 'framer-motion'
import { 
  Eye, 
  Brain, 
  Zap, 
  Clock, 
  RefreshCw, 
  ArrowRight 
} from 'lucide-react'

const agentCapabilities = [
  {
    icon: <Eye className="w-6 h-6" />,
    title: 'Always Observing',
    description: 'Continuous monitoring of all system activity, network traffic, and browser behavior without human intervention.',
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'Always Learning',
    description: 'ML models continuously adapt to new threats and your unique usage patterns to minimize false positives.',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Instant Response',
    description: 'Autonomous threat mitigation in milliseconds. Blocks, quarantines, and alerts before damage occurs.',
  },
]

const taskFlow = [
  { label: 'Detect', status: 'complete' },
  { label: 'Analyze', status: 'complete' },
  { label: 'Classify', status: 'active' },
  { label: 'Respond', status: 'pending' },
  { label: 'Learn', status: 'pending' },
]

export function AgenticAI() {
  return (
    <section id="agentic-ai" className="section-padding">
      <div className="container-section">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="heading-secondary text-white mb-4">
            Agentic AI Architecture
          </h2>
          <p className="text-body max-w-2xl mx-auto">
            CyberForge operates as an autonomous agent—constantly running, observing, 
            and protecting without requiring your attention.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Agent Visualization */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="bg-cyber-900/50 border border-cyber-700 rounded-2xl p-8 relative overflow-hidden">
              <AgentVisualization />
            </div>
          </motion.div>

          {/* Right: Capabilities */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            {agentCapabilities.map((cap, index) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="flex gap-4"
              >
                <div className="p-3 rounded-xl bg-cyber-800 text-status-info flex-shrink-0 h-fit">
                  {cap.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{cap.title}</h3>
                  <p className="text-cyber-400 leading-relaxed">{cap.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Task Flow Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16"
        >
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold text-white mb-2">Autonomous Task Pipeline</h3>
            <p className="text-cyber-400">Real-time threat processing without human intervention</p>
          </div>

          <div className="bg-cyber-900/50 border border-cyber-700 rounded-2xl p-8">
            <div className="flex flex-wrap justify-center items-center gap-4">
              {taskFlow.map((task, index) => (
                <div key={task.label} className="flex items-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className={`px-6 py-3 rounded-lg font-medium transition-all
                      ${task.status === 'complete' 
                        ? 'bg-status-safe/20 text-status-safe border border-status-safe/30' 
                        : task.status === 'active'
                        ? 'bg-status-info/20 text-status-info border border-status-info/30'
                        : 'bg-cyber-800 text-cyber-500 border border-cyber-700'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      {task.status === 'active' && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </motion.div>
                      )}
                      {task.status === 'complete' && (
                        <Clock className="w-4 h-4" />
                      )}
                      <span>{task.label}</span>
                    </div>
                  </motion.div>
                  
                  {index < taskFlow.length - 1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 + 0.05 }}
                    >
                      <ArrowRight className="w-5 h-5 mx-2 text-cyber-600" />
                    </motion.div>
                  )}
                </div>
              ))}
            </div>

            {/* Processing Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-cyber-700">
              {[
                { label: 'Events/sec', value: '2,847' },
                { label: 'Avg Response', value: '12ms' },
                { label: 'Threats Blocked', value: '1.2M' },
                { label: 'Uptime', value: '99.99%' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="text-center"
                >
                  <div className="text-2xl font-bold text-white font-mono">{stat.value}</div>
                  <div className="text-sm text-cyber-500">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function AgentVisualization() {
  return (
    <div className="h-80 relative">
      <svg viewBox="0 0 300 250" className="w-full h-full">
        {/* Central Agent Core */}
        <motion.g>
          <circle cx="150" cy="125" r="40" fill="#1e293b" stroke="#3b82f6" strokeWidth="3" />
          <motion.circle
            cx="150" cy="125" r="50" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4"
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
          <motion.circle
            cx="150" cy="125" r="60" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.5"
            animate={{ rotate: -360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Brain Icon in Center */}
          <motion.g
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Brain x="134" y="109" width="32" height="32" className="text-status-info" />
          </motion.g>
        </motion.g>

        {/* Observation Beams */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const rad = (angle * Math.PI) / 180
          const x2 = 150 + 100 * Math.cos(rad)
          const y2 = 125 + 100 * Math.sin(rad)
          return (
            <motion.line
              key={i}
              x1="150" y1="125" x2={x2} y2={y2}
              stroke="#22c55e" strokeWidth="1" opacity="0.3"
              animate={{ 
                opacity: [0.1, 0.4, 0.1],
                x2: [x2, 150 + 110 * Math.cos(rad), x2],
                y2: [y2, 125 + 110 * Math.sin(rad), y2],
              }}
              transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
            />
          )
        })}

        {/* Sensor Nodes */}
        {[
          { x: 50, y: 60, label: 'Network' },
          { x: 250, y: 60, label: 'Browser' },
          { x: 50, y: 190, label: 'Files' },
          { x: 250, y: 190, label: 'Processes' },
        ].map((node, i) => (
          <g key={i}>
            <motion.circle
              cx={node.x} cy={node.y} r="25" fill="#1e293b" stroke="#334155" strokeWidth="2"
              animate={{ stroke: ['#334155', '#22c55e', '#334155'] }}
              transition={{ duration: 3, delay: i * 0.8, repeat: Infinity }}
            />
            <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#94a3b8" fontSize="9">
              {node.label}
            </text>
            
            {/* Data Flow to Center */}
            <motion.circle
              r="4" fill="#22c55e"
              animate={{
                cx: [node.x, 150],
                cy: [node.y, 125],
                opacity: [1, 0],
              }}
              transition={{ duration: 1.5, delay: i * 0.5, repeat: Infinity }}
            />
          </g>
        ))}

        {/* Status Indicator */}
        <g>
          <rect x="120" y="210" width="60" height="24" rx="12" fill="#22c55e" opacity="0.2" />
          <motion.circle
            cx="135" cy="222" r="4" fill="#22c55e"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <text x="155" y="226" fill="#22c55e" fontSize="10" fontWeight="500">ACTIVE</text>
        </g>

        {/* Alert Burst */}
        <motion.g
          animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 4, delay: 2, repeat: Infinity }}
        >
          <circle cx="230" cy="100" r="8" fill="#ef4444" />
          <circle cx="230" cy="100" r="15" fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.5" />
        </motion.g>
      </svg>
    </div>
  )
}
