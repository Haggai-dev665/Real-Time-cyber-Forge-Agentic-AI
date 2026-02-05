import { motion } from 'framer-motion'
import { ArrowLeft, Code, Key, Lock, Globe, Database, Terminal } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

const endpoints = [
  {
    method: 'GET',
    path: '/api/health',
    description: 'Check API health status',
    auth: false,
  },
  {
    method: 'POST',
    path: '/api/auth/login',
    description: 'Authenticate user and get JWT token',
    auth: false,
  },
  {
    method: 'POST',
    path: '/api/auth/register',
    description: 'Register a new user account',
    auth: false,
  },
  {
    method: 'GET',
    path: '/api/threats',
    description: 'Get list of detected threats',
    auth: true,
  },
  {
    method: 'POST',
    path: '/api/threats/scan',
    description: 'Initiate a new threat scan',
    auth: true,
  },
  {
    method: 'GET',
    path: '/api/analysis/report',
    description: 'Get security analysis report',
    auth: true,
  },
  {
    method: 'POST',
    path: '/api/ai/analyze',
    description: 'AI-powered security analysis',
    auth: true,
  },
  {
    method: 'GET',
    path: '/api/otx/pulse',
    description: 'Get threat intelligence from OTX',
    auth: true,
  },
]

const codeExamples = {
  authentication: `// Authentication Example
const response = await fetch('https://cyberforge-ddd97655464f.herokuapp.com/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'your-password'
  })
});

const { token } = await response.json();
// Use this token in subsequent requests`,
  threatScan: `// Threat Scan Example
const response = await fetch('https://cyberforge-ddd97655464f.herokuapp.com/api/threats/scan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    target: 'example.com',
    scanType: 'full'
  })
});

const result = await response.json();
console.log(result.threats);`,
  websocket: `// WebSocket Connection Example
const ws = new WebSocket('wss://cyberforge-ddd97655464f.herokuapp.com/ws');

ws.onopen = () => {
  console.log('Connected to CyberForge');
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'threats'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Threat detected:', data);
};`
}

export function ApiReference() {
  return (
    <div className="min-h-screen bg-cyber-950 bg-grid">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-cyber-950/90 backdrop-blur-md border-b border-cyber-800">
        <div className="container-section">
          <nav className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center gap-2 group">
              <img src={logo} alt="CyberForge" className="w-10 h-10" />
            </Link>
            <Link to="/" className="flex items-center gap-2 text-cyber-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-20">
        <div className="container-section">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyber-800/50 border border-cyber-700 mb-6">
              <Code className="w-4 h-4 text-status-safe" />
              <span className="text-sm text-cyber-300">API Reference</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              CyberForge API
            </h1>
            <p className="text-xl text-cyber-400 max-w-2xl mx-auto">
              Integrate CyberForge's powerful security features into your applications
              with our comprehensive REST API.
            </p>
          </motion.div>

          {/* Base URL */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6 mb-8"
          >
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white mb-4">
              <Globe className="w-5 h-5 text-status-safe" />
              Base URL
            </h2>
            <code className="block p-4 bg-cyber-800/50 rounded-xl text-status-safe font-mono">
              https://cyberforge-ddd97655464f.herokuapp.com
            </code>
          </motion.div>

          {/* Authentication */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6 mb-8"
          >
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white mb-4">
              <Key className="w-5 h-5 text-status-safe" />
              Authentication
            </h2>
            <p className="text-cyber-400 mb-4">
              Most endpoints require authentication using a JWT token. Include the token in the Authorization header:
            </p>
            <code className="block p-4 bg-cyber-800/50 rounded-xl text-cyber-300 font-mono">
              Authorization: Bearer YOUR_JWT_TOKEN
            </code>
          </motion.div>

          {/* Endpoints */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6 mb-8"
          >
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white mb-6">
              <Database className="w-5 h-5 text-status-safe" />
              Endpoints
            </h2>
            <div className="space-y-4">
              {endpoints.map((endpoint) => (
                <div key={endpoint.path} className="p-4 bg-cyber-800/30 rounded-xl">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-lg font-mono text-sm font-bold ${
                      endpoint.method === 'GET' ? 'bg-blue-500/20 text-blue-400' :
                      endpoint.method === 'POST' ? 'bg-green-500/20 text-green-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {endpoint.method}
                    </span>
                    <code className="text-white font-mono">{endpoint.path}</code>
                    {endpoint.auth && (
                      <span className="flex items-center gap-1 text-xs text-cyber-500">
                        <Lock className="w-3 h-3" />
                        Auth Required
                      </span>
                    )}
                  </div>
                  <p className="text-cyber-400 text-sm">{endpoint.description}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Code Examples */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-cyber-900/50 border border-cyber-800 rounded-2xl p-6"
          >
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white mb-6">
              <Terminal className="w-5 h-5 text-status-safe" />
              Code Examples
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-3">Authentication</h3>
                <pre className="p-4 bg-cyber-800/50 rounded-xl overflow-x-auto">
                  <code className="text-sm text-cyber-300 font-mono whitespace-pre">{codeExamples.authentication}</code>
                </pre>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-3">Threat Scan</h3>
                <pre className="p-4 bg-cyber-800/50 rounded-xl overflow-x-auto">
                  <code className="text-sm text-cyber-300 font-mono whitespace-pre">{codeExamples.threatScan}</code>
                </pre>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-3">WebSocket Connection</h3>
                <pre className="p-4 bg-cyber-800/50 rounded-xl overflow-x-auto">
                  <code className="text-sm text-cyber-300 font-mono whitespace-pre">{codeExamples.websocket}</code>
                </pre>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
