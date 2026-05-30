require('dotenv').config();

// Initialize Datadog tracer FIRST (before any other imports)
const { initializeDatadog } = require('./config/datadog.config');
initializeDatadog();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { setupWebSocketServer } = require('./services/websocket');
const { connectDatabase } = require('./services/database');
const { connectRedis } = require('./services/redis');
const { appwriteService } = require('./services/appwriteService');
const { datadogMetrics } = require('./services/datadogMetrics');
const authRoutes = require('./routes/auth');
const analysisRoutes = require('./routes/analysis');
const threatRoutes = require('./routes/threats');
const aiRoutes = require('./routes/ai');
const webScrapingRoutes = require('./routes/web-scraping');
const domainIntelligenceRoutes = require('./routes/domain-intelligence');
const threatHuntingRoutes = require('./routes/threat-hunting');
const mlTrainingRoutes = require('./routes/ml-training');
const mlRoutes = require('./routes/mlRoutes');
const featuresRoutes = require('./routes/features');
const otxRoutes = require('./routes/otx');
const childPagesRoutes = require('./routes/child-pages');
const agentRoutes = require('./routes/agentRoutes');
const browserIntelligenceRoutes = require('./routes/browser-intelligence');
const distributedRoutes = require('./routes/distributed');
const policyRoutes = require('./routes/policy');
const auditRoutes = require('./routes/audit');
const sandboxRoutes = require('./routes/sandbox');
const orchestratorRoutes = require('./routes/orchestrator');
const memoryRoutes = require('./routes/memory');
const { errorHandler } = require('./middleware/errorHandler');
const { auth } = require('./middleware/auth');
const logger = require('./utils/logger');

class CyberForgeServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.port = process.env.PORT || 8000;
    this.clients = new Map(); // Store connected clients
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    // Trust proxy (required for Heroku / any reverse-proxy so that
    // express-rate-limit can read X-Forwarded-For correctly)
    this.app.set('trust proxy', 1);

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable for development
      crossOriginEmbedderPolicy: false
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use('/api/', limiter);

    // CORS
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'tauri://localhost',
      'http://tauri.localhost',
      'https://tauri.localhost'
    ];

    const configuredOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
      : [];

    const productionOrigins = ['https://cyberforge-ddd97655464f.herokuapp.com'];

    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [...productionOrigins, ...configuredOrigins, ...defaultOrigins]
      : [...defaultOrigins, ...configuredOrigins];

    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests without origin (curl, mobile apps, server-to-server)
        if (!origin) {
          return callback(null, true);
        }

        const isLoopbackOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

        if (isLoopbackOrigin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true
    }));

    // Compression and logging
    this.app.use(compression());
    this.app.use(morgan('combined'));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Note: Static file serving is configured in setupRoutes() for production
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/analysis', analysisRoutes); // Remove global auth - let routes handle their own auth
    this.app.use('/api/threats', threatRoutes);    // Remove global auth - let routes handle their own auth
    this.app.use('/api/ai', aiRoutes);             // Remove global auth for all AI routes
    this.app.use('/api/scraping', webScrapingRoutes);
    this.app.use('/api/domain-intel', domainIntelligenceRoutes);
    this.app.use('/api/threat-hunting', threatHuntingRoutes);
    this.app.use('/api/ml', mlTrainingRoutes);
    this.app.use('/api/cyberforge-ml', mlRoutes);  // CyberForge ML prediction API
    this.app.use('/api/otx', otxRoutes);           // OTX threat intelligence
    this.app.use('/api/agent', agentRoutes);       // TODO 1: Agent control and management
    this.app.use('/api/browser-intelligence', browserIntelligenceRoutes); // TODO 2: Browser Intelligence Engine
    this.app.use('/api/distributed', distributedRoutes); // TODO 4: Distributed Intelligence
    this.app.use('/api/policy', policyRoutes);           // TODO 5: Policy Engine
    this.app.use('/api/audit', auditRoutes);             // TODO 6: Audit Trail
    this.app.use('/api/sandbox', sandboxRoutes);         // Sandbox: IOC + MITRE + evidence locker
    this.app.use('/api/orchestrator', orchestratorRoutes); // 8-agent orchestrator
    this.app.use('/api/memory', memoryRoutes);           // Vector memory (local-first RAG sync)

    // Features routes (requests, intercepts, workflows, automations, findings, etc.)
    this.app.use('/api', featuresRoutes);
    
    // Child pages routes (browser monitor, scan modes, real-time intel, AI agent, etc.)
    this.app.use('/api', childPagesRoutes);

    // WebSocket endpoint info
    this.app.get('/ws/info', (req, res) => {
      res.json({
        message: 'WebSocket server running',
        endpoint: '/ws',
        connectedClients: this.clients.size,
        protocol: 'ws'
      });
    });

    // Serve the built cyberforge-landing page in production
    if (process.env.NODE_ENV === 'production') {
      // Serve static files from the built landing page (output by Vite into backend/public)
      const landingPath = path.join(__dirname, '../public');
      
      // Static files with explicit MIME types
      this.app.use('/assets', express.static(path.join(landingPath, 'assets'), {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
          } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
          } else if (filePath.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
          } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
          } else if (filePath.endsWith('.svg')) {
            res.setHeader('Content-Type', 'image/svg+xml');
          }
        }
      }));
      
      // Serve root-level static files (favicon, robots.txt, etc.)
      this.app.use(express.static(landingPath, { index: false }));
      
      // API status endpoint
      this.app.get('/api/status', (req, res) => {
        res.json({
          status: 'CyberForge API Online',
          message: 'AI-Powered Cybersecurity Platform - Backend Services',
          endpoints: [
            'GET /health - Health check',
            'POST /api/auth/login - Authentication', 
            'POST /api/threats/scan - Threat scanning',
            'GET /api/cyberforge-ml/health - ML service health'
          ]
        });
      });
      
      // Catch-all handler: serve index.html for any non-API/non-asset routes
      this.app.get('*', (req, res) => {
        // Don't catch API requests or WebSocket
        if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'The requested API endpoint was not found'
          });
        }
        
        // Don't catch static asset requests that already failed
        if (req.path.startsWith('/assets/')) {
          return res.status(404).send('Asset not found');
        }
        
        // Serve the React app for SPA routing
        const indexPath = path.join(landingPath, 'index.html');
        const fs = require('fs');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(503).json({
            error: 'Landing page not built',
            message: 'Run "cd cyberforge-landing && npm run build" to generate the landing page.',
            expected: indexPath
          });
        }
      });
    } else {
      // 404 handler for development
      this.app.use('*', (req, res) => {
        res.status(404).json({
          error: 'Not Found',
          message: 'The requested resource was not found'
        });
      });
    }

    // Error handling middleware
    this.app.use(errorHandler);
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({
      server: this.server,
      path: '/ws'
    });

    setupWebSocketServer(this.wss, this.clients);
  }

  async start() {
    try {
      // Initialize Appwrite service (TODO 1: Control Plane)
      logger.info('🔐 Initializing Appwrite control plane...');
      await appwriteService.initialize();

      // Initialize Datadog metrics (TODO 1: Observability)
      logger.info('📊 Initializing Datadog metrics...');
      datadogMetrics.initialize();

      // Connect to external services
      await connectDatabase();
      await connectRedis();

      // Start HTTP/WebSocket server
      this.server.listen(this.port, () => {
        console.log(`🚀 Cyber Forge Backend Server running on port ${this.port}`);
        console.log(`📡 WebSocket server available at ws://localhost:${this.port}/ws`);
        console.log(`🏥 Health check available at http://localhost:${this.port}/health`);
        console.log(`🤖 Agent API available at http://localhost:${this.port}/api/agent`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`✅ TODO 1: Control plane and agent system initialized`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    console.log('🔄 Graceful shutdown initiated...');
    
    // Stop all agents
    const { agentManager } = require('./agent/AgentManager');
    await agentManager.stopAllAgents();

    // Close Datadog metrics client
    datadogMetrics.close();

    // Close WebSocket connections
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Server shutting down');
      }
    });

    // Close HTTP server
    this.server.close(() => {
      console.log('✅ Server shutdown complete');
      process.exit(0);
    });
  }

  // Broadcast message to all connected clients
  broadcast(message) {
    const data = JSON.stringify(message);
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // Send message to specific client
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  // Get server statistics
  getStats() {
    return {
      connectedClients: this.clients.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}

// Create and start server
const server = new CyberForgeServer();
server.start().catch(console.error);

module.exports = server;