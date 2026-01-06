const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { analyzePageData } = require('./analysisService');
const { detectThreats } = require('./threatService');
const { logActivity } = require('../utils/logger');

class WebSocketManager {
  constructor() {
    this.clients = new Map();
    this.desktopClients = new Map();
    this.mobileClients = new Map();
  }

  setupWebSocketServer(wss, clientsMap) {
    this.clients = clientsMap;

    wss.on('connection', (ws, request) => {
      const clientId = uuidv4();
      const clientInfo = {
        id: clientId,
        socket: ws,
        type: 'unknown',
        connectedAt: new Date(),
        lastActivity: new Date(),
        ip: request.socket.remoteAddress
      };

      this.clients.set(clientId, clientInfo);
      
      logActivity('info', `New WebSocket connection: ${clientId} from ${clientInfo.ip}`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection_established',
        clientId: clientId,
        timestamp: new Date().toISOString(),
        message: 'Connected to Cyber Forge AI Backend'
      }));

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      // Handle client disconnect
      ws.on('close', (code, reason) => {
        const client = this.clients.get(clientId);
        if (client) {
          if (client.type === 'desktop') {
            this.desktopClients.delete(clientId);
          } else if (client.type === 'mobile') {
            this.mobileClients.delete(clientId);
          }
          this.clients.delete(clientId);
          
          logActivity('info', `Client disconnected: ${clientId} (${client.type})`);
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });

      // Ping/pong for connection health
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
        if (this.clients.has(clientId)) {
          this.clients.get(clientId).lastActivity = new Date();
        }
      });
    });

    // Health check interval
    setInterval(() => {
      wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    console.log('✅ WebSocket server initialized');
  }

  async handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date();

    switch (message.type) {
      case 'identify':
        await this.handleIdentification(clientId, message);
        break;
      
      case 'desktop_connected':
        await this.handleDesktopConnection(clientId, message);
        break;
      
      case 'mobile_connected':
        await this.handleMobileConnection(clientId, message);
        break;
      
      case 'page_visit':
        await this.handlePageVisit(clientId, message);
        break;
      
      case 'analysis_request':
        await this.handleAnalysisRequest(clientId, message);
        break;
      
      case 'threat_scan':
        await this.handleThreatScan(clientId, message);
        break;
      
      case 'request_data':
        await this.handleDataRequest(clientId, message);
        break;
      
      case 'setting_update':
        await this.handleSettingUpdate(clientId, message);
        break;
      
      case 'heartbeat':
        await this.handleHeartbeat(clientId, message);
        break;
      
      case 'authenticate':
        await this.handleAuthentication(clientId, message);
        break;
      
      case 'connection_established':
        // Acknowledge connection establishment
        client.socket.send(JSON.stringify({
          type: 'connection_acknowledged',
          timestamp: new Date().toISOString()
        }));
        break;
      
      default:
        console.log(`Unknown message type: ${message.type} from client ${clientId}`);
    }
  }

  async handleIdentification(clientId, message) {
    const client = this.clients.get(clientId);
    const clientType = message.client_type;
    
    client.type = clientType;
    client.version = message.version;
    client.platform = message.platform;

    if (clientType === 'desktop') {
      this.desktopClients.set(clientId, client);
    } else if (clientType === 'mobile') {
      this.mobileClients.set(clientId, client);
    }

    // Send acknowledgment
    client.socket.send(JSON.stringify({
      type: 'identification_confirmed',
      clientType: clientType,
      timestamp: new Date().toISOString()
    }));

    logActivity('info', `Client identified: ${clientId} as ${clientType}`);
  }

  async handleAuthentication(clientId, message) {
    const client = this.clients.get(clientId);
    
    // Store authentication info
    client.userId = message.userId;
    client.token = message.token;
    client.authenticated = true;

    // Send authentication confirmation
    client.socket.send(JSON.stringify({
      type: 'authentication_confirmed',
      userId: message.userId,
      timestamp: new Date().toISOString()
    }));

    logActivity('info', `Client authenticated: ${clientId} as user ${message.userId}`);
  }

  async handleDesktopConnection(clientId, message) {
    const client = this.clients.get(clientId);
    client.type = 'desktop';
    this.desktopClients.set(clientId, client);

    // Send current system status
    client.socket.send(JSON.stringify({
      type: 'system_status',
      data: {
        connectedClients: this.clients.size,
        mobileClients: this.mobileClients.size,
        timestamp: new Date().toISOString()
      }
    }));
  }

  async handleMobileConnection(clientId, message) {
    const client = this.clients.get(clientId);
    client.type = 'mobile';
    this.mobileClients.set(clientId, client);

    // Notify desktop clients about mobile connection
    this.broadcastToDesktops({
      type: 'mobile_connected',
      data: {
        mobileClientId: clientId,
        deviceInfo: message.device_info,
        timestamp: new Date().toISOString()
      }
    });
  }

  async handlePageVisit(clientId, message) {
    const pageData = message.data;
    
    try {
      // Analyze page for security threats
      const analysisResult = await analyzePageData(pageData);
      
      // Store analysis result (would typically go to database)
      const result = {
        url: pageData.url,
        timestamp: pageData.timestamp,
        analysis: analysisResult,
        clientId: clientId
      };

      // Send analysis back to desktop client
      const client = this.clients.get(clientId);
      if (client && client.type === 'desktop') {
        client.socket.send(JSON.stringify({
          type: 'analysis_result',
          data: result
        }));
      }

      // Forward to mobile clients
      this.broadcastToMobiles({
        type: 'page_analyzed',
        data: {
          url: pageData.url,
          riskLevel: analysisResult.riskLevel,
          timestamp: pageData.timestamp
        }
      });

      // Check for threats
      if (analysisResult.hasThreats) {
        await this.handleThreatDetection(clientId, analysisResult);
      }

    } catch (error) {
      console.error('Error analyzing page visit:', error);
    }
  }

  async handleAnalysisRequest(clientId, message) {
    const client = this.clients.get(clientId);
    
    // Simulate analysis data
    const analysisData = {
      totalPages: Math.floor(Math.random() * 1000) + 100,
      securePages: Math.floor(Math.random() * 800) + 50,
      riskyPages: Math.floor(Math.random() * 50) + 5,
      blockedPages: Math.floor(Math.random() * 10) + 1,
      recentPages: [
        {
          url: 'https://example.com',
          riskLevel: 'low',
          isSecure: true,
          timestamp: new Date().toISOString()
        },
        {
          url: 'https://suspicious-site.com',
          riskLevel: 'medium',
          isSecure: false,
          timestamp: new Date().toISOString()
        }
      ],
      patterns: [
        {
          name: 'Suspicious Domain Pattern',
          description: 'Detected patterns in domain names that may indicate phishing',
          severity: 'medium'
        }
      ]
    };

    client.socket.send(JSON.stringify({
      type: 'analysis_data',
      data: analysisData
    }));
  }

  async handleThreatScan(clientId, message) {
    const client = this.clients.get(clientId);
    
    // Simulate threat detection
    setTimeout(() => {
      const threats = [
        {
          id: uuidv4(),
          type: 'Malicious URL',
          description: 'Detected access to known malicious domain',
          severity: 'high',
          url: 'malicious-example.com',
          timestamp: new Date().toISOString()
        }
      ];

      client.socket.send(JSON.stringify({
        type: 'threats_detected',
        data: threats
      }));
    }, 2000);
  }

  async handleDataRequest(clientId, message) {
    const client = this.clients.get(clientId);
    const dataType = message.data_type;

    let responseData = {};

    switch (dataType) {
      case 'dashboard':
        responseData = {
          pagesMonitored: Math.floor(Math.random() * 500) + 100,
          threatsDetected: Math.floor(Math.random() * 20) + 5,
          riskScore: Math.floor(Math.random() * 100),
          aiInsights: Math.floor(Math.random() * 50) + 10
        };
        break;
      
      case 'threats':
        responseData = [
          {
            id: uuidv4(),
            type: 'Phishing Attempt',
            description: 'Suspicious login page detected',
            severity: 'medium',
            timestamp: new Date().toISOString()
          }
        ];
        break;
      
      default:
        responseData = { message: 'Unknown data type requested' };
    }

    client.socket.send(JSON.stringify({
      type: `${dataType}_data`,
      data: responseData
    }));
  }

  async handleSettingUpdate(clientId, message) {
    const { setting, value } = message;
    
    // Store setting update (would typically go to database)
    logActivity('info', `Setting updated for client ${clientId}: ${setting} = ${value}`);
    
    const client = this.clients.get(clientId);
    client.socket.send(JSON.stringify({
      type: 'setting_updated',
      setting: setting,
      value: value,
      timestamp: new Date().toISOString()
    }));
  }

  async handleThreatDetection(clientId, analysisResult) {
    const threatAlert = {
      type: 'threat_alert',
      data: {
        url: analysisResult.url,
        threats: analysisResult.threats,
        severity: analysisResult.severity,
        timestamp: new Date().toISOString()
      }
    };

    // Alert desktop client
    const client = this.clients.get(clientId);
    if (client && client.type === 'desktop') {
      client.socket.send(JSON.stringify(threatAlert));
    }

    // Alert mobile clients
    this.broadcastToMobiles(threatAlert);
  }

  async handleHeartbeat(clientId, message) {
    const client = this.clients.get(clientId);
    if (client) {
      // Update last activity
      client.lastActivity = new Date();
      
      // Send heartbeat response
      client.socket.send(JSON.stringify({
        type: 'heartbeat_response',
        timestamp: new Date().toISOString(),
        clientId: clientId
      }));
    }
  }

  broadcastToDesktops(message) {
    this.desktopClients.forEach(client => {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(message));
      }
    });
  }

  broadcastToMobiles(message) {
    this.mobileClients.forEach(client => {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(message));
      }
    });
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      desktopClients: this.desktopClients.size,
      mobileClients: this.mobileClients.size,
      timestamp: new Date().toISOString()
    };
  }
}

const wsManager = new WebSocketManager();

function setupWebSocketServer(wss, clients) {
  wsManager.setupWebSocketServer(wss, clients);
}

module.exports = { setupWebSocketServer, wsManager };