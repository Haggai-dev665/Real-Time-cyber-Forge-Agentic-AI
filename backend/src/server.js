require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

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
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Compression and logging
    this.app.use(compression());
    this.app.use(morgan('combined'));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
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

    // WebSocket endpoint info
    this.app.get('/ws/info', (req, res) => {
      res.json({
        message: 'WebSocket server running',
        endpoint: '/ws',
        connectedClients: this.clients.size,
        protocol: 'ws'
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found'
      });
    });

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