require('dotenv').config();
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
const { errorHandler } = require('./middleware/errorHandler');
const { auth } = require('./middleware/auth');

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
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://cyberforge-ddd97655464f.herokuapp.com']
        : process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Compression and logging
    this.app.use(compression());
    this.app.use(morgan('combined'));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Serve static files in production (simple static files, not Next.js)
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static(path.join(__dirname, '../public')));
    }
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

    // Serve a simple landing page in production
    if (process.env.NODE_ENV === 'production') {
      // API routes should be handled before the catch-all
      this.app.get('/', (req, res) => {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>CyberForge API</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; background: #0a0a0a; color: #fff; }
              .container { max-width: 600px; margin: 0 auto; text-align: center; }
              .logo { color: #a4bd99; font-size: 2em; margin-bottom: 20px; }
              .status { background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .endpoint { background: #2a2a2a; padding: 10px; margin: 10px 0; border-radius: 4px; font-family: monospace; }
              a { color: #a4bd99; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="logo">🛡️ CyberForge API</h1>
              <p>AI-Powered Cybersecurity Platform - Backend Services</p>
              
              <div class="status">
                <h3>✅ API Status: Online</h3>
                <p>Backend services are running and ready to accept connections.</p>
              </div>
              
              <h3>Available Endpoints:</h3>
              <div class="endpoint"><strong>GET</strong> /health - Health check</div>
              <div class="endpoint"><strong>POST</strong> /api/auth/login - Authentication</div>
              <div class="endpoint"><strong>POST</strong> /api/threats/scan - Threat scanning</div>
              <div class="endpoint"><strong>GET</strong> /api/cyberforge-ml/health - ML service health</div>
              <div class="endpoint"><strong>WebSocket</strong> /ws - Real-time communication</div>
              
              <p style="margin-top: 30px;">
                <a href="/health">Check API Health</a> | 
                <a href="/api">API Documentation</a>
              </p>
            </div>
          </body>
          </html>
        `);
      });
      
      this.app.get('*', (req, res) => {
        // Check if this is an API request
        if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'The requested API endpoint was not found'
          });
        }
        // Redirect to home page for any other routes
        res.redirect('/');
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
      // Connect to external services
      await connectDatabase();
      await connectRedis();

      // Start HTTP/WebSocket server
      this.server.listen(this.port, () => {
        console.log(`🚀 Cyber Forge Backend Server running on port ${this.port}`);
        console.log(`📡 WebSocket server available at ws://localhost:${this.port}/ws`);
        console.log(`🏥 Health check available at http://localhost:${this.port}/health`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
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