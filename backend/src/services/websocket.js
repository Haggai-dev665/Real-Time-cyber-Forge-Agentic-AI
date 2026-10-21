const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { analyzePageData } = require('./analysisService');

// Requests this service accepts but has nothing behind. Each used to be
// answered with random totals, a made-up threat, or a confirmation that a
// setting had been saved. Each is now answered as unsupported, with the reason.
const UNSUPPORTED_REQUESTS = {
  analysis_request: 'this service keeps no browsing totals to report',
  threat_scan: 'no scan is run over this socket',
  request_data: 'dashboard and threat figures are not served over this socket',
  setting_update: 'settings sent over this socket are not stored'
};
const { detectThreats } = require('./threatService');
const { logActivity } = require('../utils/logger');
const otxService = require('./otx');
const { verifySessionToken } = require('./sessionTokens');

// A socket that has not presented a valid session within this time is closed.
const AUTH_DEADLINE_MS = 10 * 1000;
// Close codes in the application range: 4401 not authenticated, 4403 session ended.
const CLOSE_UNAUTHENTICATED = 4401;
const CLOSE_SESSION_ENDED = 4403;

/**
 * Every socket belongs to one signed-in account. A client proves who it is with
 * its session token, either in the Authorization header when it connects or in
 * an `authenticate` message; nothing else is accepted from it until then, and
 * nothing is sent to it that belongs to another account.
 */
class WebSocketManager {
  constructor() {
    this.clients = new Map();
    this.desktopClients = new Map();
    this.mobileClients = new Map();
    this.otxInitialized = false;
    this.authDeadlineMs = AUTH_DEADLINE_MS;
  }

  isAuthenticated(client) {
    return Boolean(client && client.userId) && Date.now() < client.expiresAt;
  }

  /** Bind a socket to the account its session token proves. False if it does not verify. */
  bindSession(client, token) {
    try {
      const decoded = verifySessionToken(token);
      client.userId = decoded.userId;
      client.expiresAt = decoded.exp * 1000;
      client.authenticated = true;
      clearTimeout(client.authTimer);
      return true;
    } catch (_) {
      return false;
    }
  }

  setupWebSocketServer(wss, clientsMap) {
    this.clients = clientsMap;

    wss.on('connection', (ws, request) => {
      const clientId = uuidv4();
      const clientInfo = {
        id: clientId,
        socket: ws,
        type: 'unknown',
        userId: null,
        expiresAt: 0,
        connectedAt: new Date(),
        lastActivity: new Date(),
        ip: request.socket.remoteAddress
      };

      this.clients.set(clientId, clientInfo);

      const header = request.headers.authorization;
      if (typeof header === 'string' && header.startsWith('Bearer ') && !this.bindSession(clientInfo, header.slice(7))) {
        this.clients.delete(clientId);
        ws.close(CLOSE_UNAUTHENTICATED, 'invalid session');
        return;
      }
      clientInfo.authTimer = setTimeout(() => {
        if (!this.isAuthenticated(clientInfo)) ws.close(CLOSE_UNAUTHENTICATED, 'authentication required');
      }, this.authDeadlineMs);
      if (clientInfo.authTimer.unref) clientInfo.authTimer.unref();

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
          clearTimeout(client.authTimer);
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

    // Health check interval. It also ends sockets whose session has run out.
    const health = setInterval(() => {
      this.clients.forEach((client) => {
        if (client.userId && !this.isAuthenticated(client)) {
          client.socket.close(CLOSE_SESSION_ENDED, 'session expired');
        }
      });
      wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
    if (health.unref) health.unref();
    wss.on('close', () => clearInterval(health));

    console.log('✅ WebSocket server initialized');
    
    // Initialize OTX threat streaming
    this.initializeOTXStreaming();
  }

  initializeOTXStreaming() {
    if (this.otxInitialized) return;
    
    console.log('🌐 Starting OTX threat intelligence streaming...');
    
    // Listen for new threats from OTX service
    otxService.on('threat', (threatEvent) => {
      // Broadcast threat to all connected dashboard clients
      this.broadcastThreat(threatEvent);
    });
    
    // Start polling OTX API every 30 seconds
    otxService.startPolling(30000);
    
    this.otxInitialized = true;
    console.log('✅ OTX threat streaming initialized');
  }

  /**
   * Send a threat event. Public OTX intelligence carries no account and goes to
   * every signed-in client; a threat that names an account goes to that account.
   */
  broadcastThreat(threatEvent) {
    const message = JSON.stringify({
      type: 'otx_threat',
      threat: threatEvent,
      timestamp: new Date().toISOString()
    });
    const owner = threatEvent && threatEvent.userId != null ? String(threatEvent.userId) : null;

    this.clients.forEach((client) => {
      if (!this.isAuthenticated(client) || (owner && client.userId !== owner)) return;
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(message);
      }
    });
  }

  /** Send to one account's signed-in sockets in `group`. With no owner, to nobody. */
  sendToOwner(group, message, userId) {
    if (userId == null) return;
    const owner = String(userId);
    const payload = JSON.stringify(message);
    group.forEach(client => {
      if (client.userId === owner && this.isAuthenticated(client) && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(payload);
      }
    });
  }

  async sendInitialThreats(clientId) {
    try {
      const recentThreats = await otxService.getRecentThreats(20);
      const client = this.clients.get(clientId);
      
      if (client && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify({
          type: 'initial_threats',
          threats: recentThreats,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Error sending initial threats:', error);
    }
  }

  async handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
      throw new Error('A message must be an object with a type');
    }

    client.lastActivity = new Date();

    // Nothing is accepted from a socket before it has proved who it is.
    if (message.type !== 'authenticate' && !this.isAuthenticated(client)) {
      client.socket.send(JSON.stringify({
        type: 'error',
        code: 'unauthenticated',
        message: 'Send an authenticate message with a valid session token first'
      }));
      if (client.userId) client.socket.close(CLOSE_SESSION_ENDED, 'session expired');
      return;
    }

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
      case 'threat_scan':
      case 'request_data':
      case 'setting_update':
        this.answerUnsupported(clientId, message.type);
        break;
      
      case 'heartbeat':
        await this.handleHeartbeat(clientId, message);
        break;
      
      case 'authenticate':
        await this.handleAuthentication(clientId, message);
        break;
      
      case 'request_initial_threats':
        await this.sendInitialThreats(clientId);
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
    const clientType = ['desktop', 'mobile'].includes(message.client_type) ? message.client_type : 'unknown';

    client.type = clientType;
    client.version = message.version;
    client.platform = message.platform;

    this.desktopClients.delete(clientId);
    this.mobileClients.delete(clientId);
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

    // The account is the one the token proves. A `userId` in the message is
    // ignored, and the token itself is not kept.
    if (!this.bindSession(client, message.token)) {
      client.socket.send(JSON.stringify({
        type: 'authentication_failed',
        timestamp: new Date().toISOString()
      }));
      client.socket.close(CLOSE_UNAUTHENTICATED, 'invalid session');
      return;
    }

    // Send authentication confirmation
    client.socket.send(JSON.stringify({
      type: 'authentication_confirmed',
      userId: client.userId,
      timestamp: new Date().toISOString()
    }));

    logActivity('info', `Client authenticated: ${clientId} as user ${client.userId}`);
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

    // Notify this account's desktop clients about the mobile connection
    this.broadcastToDesktops({
      type: 'mobile_connected',
      data: {
        mobileClientId: clientId,
        deviceInfo: message.device_info,
        timestamp: new Date().toISOString()
      }
    }, client.userId);
  }

  async handlePageVisit(clientId, message) {
    const pageData = message.data;
    if (!pageData || typeof pageData !== 'object') return;

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

      // Forward to this account's mobile clients
      this.broadcastToMobiles({
        type: 'page_analyzed',
        data: {
          url: pageData.url,
          riskLevel: analysisResult.riskLevel,
          timestamp: pageData.timestamp
        }
      }, client && client.userId);

      // Check for threats
      if (analysisResult.hasThreats) {
        await this.handleThreatDetection(clientId, analysisResult);
      }

    } catch (error) {
      console.error('Error analyzing page visit:', error);
    }
  }

  /** Say that a request was understood and that nothing carries it out. */
  answerUnsupported(clientId, request) {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.socket.send(JSON.stringify({
      type: 'unsupported',
      request,
      reason: UNSUPPORTED_REQUESTS[request],
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

    // Alert this account's mobile clients
    this.broadcastToMobiles(threatAlert, client && client.userId);
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

  /** Send to the desktop clients of one account. */
  broadcastToDesktops(message, userId) {
    this.sendToOwner(this.desktopClients, message, userId);
  }

  /** Send to the mobile clients of one account. */
  broadcastToMobiles(message, userId) {
    this.sendToOwner(this.mobileClients, message, userId);
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