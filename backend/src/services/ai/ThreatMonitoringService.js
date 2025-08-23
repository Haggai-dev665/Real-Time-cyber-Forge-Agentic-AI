/**
 * Real-time Threat Monitoring Service
 * Provides continuous threat detection and alerting
 */

const EventEmitter = require('events');
const { Threat, Analysis, User } = require('../../models');
const AIAnalysisService = require('./AIAnalysisService');

class ThreatMonitoringService extends EventEmitter {
  constructor() {
    super();
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.aiAnalysisService = new AIAnalysisService();
    this.connectedClients = new Map(); // Store WebSocket connections
    this.alertRules = new Map();
    this.setupDefaultAlertRules();
  }

  /**
   * Start real-time monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('Threat monitoring already running');
      return;
    }

    console.log('🔍 Starting real-time threat monitoring...');
    this.isMonitoring = true;

    // Monitor for new threats every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.checkForNewThreats();
    }, 30000);

    // Monitor for critical patterns every 60 seconds  
    setInterval(async () => {
      await this.analyzePatterns();
    }, 60000);

    // Generate summary reports every 5 minutes
    setInterval(async () => {
      await this.generateRealTimeSummary();
    }, 300000);

    this.emit('monitoring_started');
    console.log('✅ Real-time threat monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('🛑 Stopping threat monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoring_stopped');
    console.log('✅ Threat monitoring stopped');
  }

  /**
   * Add WebSocket client for real-time updates
   */
  addClient(clientId, webSocket) {
    this.connectedClients.set(clientId, {
      ws: webSocket,
      connectedAt: new Date(),
      lastActivity: new Date()
    });

    webSocket.on('close', () => {
      this.removeClient(clientId);
    });

    console.log(`📱 Client ${clientId} connected for real-time monitoring`);
  }

  /**
   * Remove WebSocket client
   */
  removeClient(clientId) {
    this.connectedClients.delete(clientId);
    console.log(`📱 Client ${clientId} disconnected`);
  }

  /**
   * Broadcast alert to all connected clients
   */
  broadcastAlert(alert) {
    const message = JSON.stringify({
      type: 'threat_alert',
      data: alert,
      timestamp: new Date().toISOString()
    });

    this.connectedClients.forEach((client, clientId) => {
      try {
        if (client.ws.readyState === 1) { // WebSocket.OPEN
          client.ws.send(message);
          client.lastActivity = new Date();
        }
      } catch (error) {
        console.error(`Failed to send alert to client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    });
  }

  /**
   * Check for new threats
   */
  async checkForNewThreats() {
    try {
      const lastCheck = new Date(Date.now() - 30000); // Last 30 seconds
      
      const newThreats = await Threat.find({
        'detection.timestamp': { $gte: lastCheck },
        status: 'detected'
      }).populate('analysis.analyst_assigned', 'firstName lastName');

      for (const threat of newThreats) {
        await this.processNewThreat(threat);
      }

      if (newThreats.length > 0) {
        console.log(`🚨 Processed ${newThreats.length} new threats`);
      }

    } catch (error) {
      console.error('Error checking for new threats:', error);
    }
  }

  /**
   * Process a newly detected threat
   */
  async processNewThreat(threat) {
    try {
      // Apply alert rules
      const alertLevel = this.evaluateAlertRules(threat);
      
      if (alertLevel > 0) {
        const alert = {
          id: threat._id,
          type: threat.type,
          severity: threat.severity,
          description: threat.description,
          alertLevel,
          timestamp: threat.detection.timestamp,
          source: threat.source,
          recommendations: this.generateRecommendations(threat)
        };

        // Broadcast to clients
        this.broadcastAlert(alert);

        // Emit event for other services
        this.emit('threat_detected', { threat, alert });

        // Auto-assign to analyst if critical
        if (threat.severity === 'critical') {
          await this.autoAssignThreat(threat);
        }

        console.log(`🚨 Alert broadcast for threat: ${threat.type} (${threat.severity})`);
      }

    } catch (error) {
      console.error('Error processing new threat:', error);
    }
  }

  /**
   * Analyze threat patterns
   */
  async analyzePatterns() {
    try {
      const last5Minutes = new Date(Date.now() - 300000);
      
      // Check for attack patterns
      const recentThreats = await Threat.find({
        'detection.timestamp': { $gte: last5Minutes }
      });

      // Detect patterns
      const patterns = this.detectThreatPatterns(recentThreats);
      
      for (const pattern of patterns) {
        await this.handleThreatPattern(pattern);
      }

    } catch (error) {
      console.error('Error analyzing patterns:', error);
    }
  }

  /**
   * Detect threat patterns
   */
  detectThreatPatterns(threats) {
    const patterns = [];

    // Group by source IP
    const ipGroups = new Map();
    threats.forEach(threat => {
      if (threat.source.ip) {
        if (!ipGroups.has(threat.source.ip)) {
          ipGroups.set(threat.source.ip, []);
        }
        ipGroups.get(threat.source.ip).push(threat);
      }
    });

    // Detect coordinated attacks
    ipGroups.forEach((threatList, ip) => {
      if (threatList.length >= 3) {
        patterns.push({
          type: 'coordinated_attack',
          source_ip: ip,
          threat_count: threatList.length,
          threats: threatList,
          severity: 'high'
        });
      }
    });

    // Detect threat type clusters
    const typeGroups = new Map();
    threats.forEach(threat => {
      if (!typeGroups.has(threat.type)) {
        typeGroups.set(threat.type, []);
      }
      typeGroups.get(threat.type).push(threat);
    });

    typeGroups.forEach((threatList, type) => {
      if (threatList.length >= 5) {
        patterns.push({
          type: 'threat_surge',
          threat_type: type,
          count: threatList.length,
          threats: threatList,
          severity: 'medium'
        });
      }
    });

    return patterns;
  }

  /**
   * Handle detected threat pattern
   */
  async handleThreatPattern(pattern) {
    try {
      const patternAlert = {
        id: `pattern_${Date.now()}`,
        type: 'threat_pattern',
        pattern: pattern.type,
        severity: pattern.severity,
        description: this.generatePatternDescription(pattern),
        timestamp: new Date(),
        details: pattern
      };

      this.broadcastAlert(patternAlert);
      this.emit('pattern_detected', pattern);

      console.log(`🔍 Pattern detected: ${pattern.type} - ${pattern.threat_count || pattern.count} threats`);

    } catch (error) {
      console.error('Error handling threat pattern:', error);
    }
  }

  /**
   * Generate real-time summary
   */
  async generateRealTimeSummary() {
    try {
      const last5Minutes = new Date(Date.now() - 300000);
      
      const summary = await Threat.aggregate([
        { $match: { 'detection.timestamp': { $gte: last5Minutes } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            critical: { 
              $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
            },
            high: { 
              $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] }
            },
            medium: { 
              $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] }
            },
            low: { 
              $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] }
            },
            types: { $addToSet: '$type' }
          }
        }
      ]);

      if (summary.length > 0 && summary[0].total > 0) {
        const summaryData = {
          type: 'monitoring_summary',
          data: {
            period: '5 minutes',
            timestamp: new Date(),
            threats: summary[0],
            connected_clients: this.connectedClients.size,
            monitoring_status: 'active'
          }
        };

        this.broadcastAlert(summaryData);
        this.emit('summary_generated', summaryData);
      }

    } catch (error) {
      console.error('Error generating real-time summary:', error);
    }
  }

  /**
   * Setup default alert rules
   */
  setupDefaultAlertRules() {
    this.alertRules.set('critical_threats', {
      condition: (threat) => threat.severity === 'critical',
      alertLevel: 3
    });

    this.alertRules.set('high_threats', {
      condition: (threat) => threat.severity === 'high',
      alertLevel: 2
    });

    this.alertRules.set('malware_detection', {
      condition: (threat) => threat.type === 'malware',
      alertLevel: 2
    });

    this.alertRules.set('phishing_attempts', {
      condition: (threat) => threat.type === 'phishing',
      alertLevel: 2
    });

    this.alertRules.set('network_intrusion', {
      condition: (threat) => threat.type === 'network_intrusion',
      alertLevel: 3
    });
  }

  /**
   * Evaluate alert rules for a threat
   */
  evaluateAlertRules(threat) {
    let maxAlertLevel = 0;

    this.alertRules.forEach((rule, ruleName) => {
      if (rule.condition(threat)) {
        maxAlertLevel = Math.max(maxAlertLevel, rule.alertLevel);
      }
    });

    return maxAlertLevel;
  }

  /**
   * Generate recommendations for a threat
   */
  generateRecommendations(threat) {
    const recommendations = [];

    switch (threat.type) {
      case 'malware':
        recommendations.push('Isolate affected system immediately');
        recommendations.push('Run full system scan');
        recommendations.push('Update antivirus definitions');
        break;
      case 'phishing':
        recommendations.push('Block sender domain');
        recommendations.push('Educate users about phishing indicators');
        recommendations.push('Review email security policies');
        break;
      case 'network_intrusion':
        recommendations.push('Check firewall logs');
        recommendations.push('Monitor network traffic');
        recommendations.push('Update intrusion detection rules');
        break;
      default:
        recommendations.push('Investigate threat indicators');
        recommendations.push('Monitor for similar patterns');
        break;
    }

    return recommendations;
  }

  /**
   * Generate pattern description
   */
  generatePatternDescription(pattern) {
    switch (pattern.type) {
      case 'coordinated_attack':
        return `Coordinated attack detected from IP ${pattern.source_ip} with ${pattern.threat_count} threats`;
      case 'threat_surge':
        return `Surge in ${pattern.threat_type} threats detected (${pattern.count} incidents)`;
      default:
        return `Threat pattern detected: ${pattern.type}`;
    }
  }

  /**
   * Auto-assign critical threats to available analysts
   */
  async autoAssignThreat(threat) {
    try {
      const availableAnalysts = await User.find({
        role: { $in: ['analyst', 'admin'] },
        isActive: true
      }).sort({ 'activity.lastActiveAt': -1 });

      if (availableAnalysts.length > 0) {
        const analyst = availableAnalysts[0];
        threat.analysis.analyst_assigned = analyst._id;
        threat.analysis.analysis_started = new Date();
        threat.status = 'investigating';

        await threat.save();
        await threat.addTimelineEvent(
          'Auto-assigned to analyst',
          `Critical threat auto-assigned to ${analyst.firstName} ${analyst.lastName}`,
          analyst._id
        );

        console.log(`🎯 Critical threat auto-assigned to ${analyst.firstName} ${analyst.lastName}`);
      }
    } catch (error) {
      console.error('Error auto-assigning threat:', error);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      connectedClients: this.connectedClients.size,
      alertRules: this.alertRules.size,
      uptime: this.isMonitoring ? Date.now() - this.startTime : 0
    };
  }
}

module.exports = ThreatMonitoringService;