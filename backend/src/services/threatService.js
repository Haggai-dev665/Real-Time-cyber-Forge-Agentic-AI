/**
 * Threat Detection Service
 * Handles cybersecurity threat detection and analysis
 */

const axios = require('axios');
const { cyberforgeML } = require('./cyberforgeMLService');

class ThreatService {
  constructor() {
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
    this.threatPatterns = [
      // URL-based patterns
      {
        pattern: /phishing|malware|suspicious|hack|scam/i,
        type: 'suspicious_keyword',
        severity: 'medium'
      },
      {
        pattern: /data:text\/html|javascript:|vbscript:/i,
        type: 'script_injection',
        severity: 'high'
      },
      // Domain-based patterns
      {
        pattern: /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/,
        type: 'ip_address_url',
        severity: 'medium'
      }
    ];
  }

  /**
   * Detect threats in URL or page data
   */
  async detectThreats(data) {
    try {
      const threats = [];

      // Basic pattern matching
      const patternThreats = this.detectPatternThreats(data);
      threats.push(...patternThreats);

      // ML-based analysis
      try {
        const mlThreats = await this.detectMLThreats(data);
        threats.push(...mlThreats);
      } catch (mlError) {
        console.warn('ML threat detection unavailable:', mlError.message);
      }

      // Push any detected threats to live dashboards over SSE (real-time).
      try {
        const realtimeBus = require('./realtimeBus');
        const rs = this.calculateRiskScore(threats);
        threats.forEach((t) => realtimeBus.emit('threat:new', {
          indicator: t.url || data.url,
          type: t.type,
          severity: t.severity,
          riskScore: rs,
          confidence: t.confidence,
          source: 'threat-scan'
        }));
      } catch (_) { /* realtime is best-effort */ }

      return {
        success: true,
        threats,
        riskScore: this.calculateRiskScore(threats),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Threat detection error:', error);
      return {
        success: false,
        error: error.message,
        threats: [],
        riskScore: 0
      };
    }
  }

  /**
   * Pattern-based threat detection
   */
  detectPatternThreats(data) {
    const threats = [];
    const url = data.url || '';

    this.threatPatterns.forEach(pattern => {
      if (pattern.pattern.test(url)) {
        threats.push({
          type: pattern.type,
          severity: pattern.severity,
          description: `Pattern detected: ${pattern.type}`,
          url: url,
          confidence: 0.7
        });
      }
    });

    return threats;
  }

  /**
   * ML-based threat detection using CyberForge ML models
   */
  async detectMLThreats(data) {
    try {
      // Use CyberForge ML service for local predictions
      const analysis = await cyberforgeML.analyzeUrl(data.url, data.additional_features || {});
      
      const threats = [];
      
      // Check each model's prediction
      if (analysis.model_predictions) {
        for (const [modelName, prediction] of Object.entries(analysis.model_predictions)) {
          if (prediction.is_threat && prediction.threat_score >= 0.4) {
            threats.push({
              type: modelName.replace('_detection', ''),
              severity: prediction.threat_score >= 0.8 ? 'high' : 
                       prediction.threat_score >= 0.6 ? 'medium' : 'low',
              description: `CyberForge ML detected: ${prediction.risk_level} risk (${modelName})`,
              url: data.url,
              confidence: prediction.threat_score,
              model: modelName,
              recommended_action: prediction.threat_score >= 0.6 ? 'block' : 'warn'
            });
          }
        }
      }
      
      // Also include aggregate assessment if high risk
      if (analysis.aggregate && analysis.aggregate.overall_risk_level !== 'LOW') {
        console.log(`CyberForge ML Analysis: ${analysis.aggregate.overall_risk_level} risk for ${data.url}`);
      }

      return threats;

    } catch (error) {
      console.warn('CyberForge ML threat detection failed, falling back to legacy:', error.message);
      
      // Fallback to legacy ML service if available
      try {
        const response = await axios.post(`${this.mlServiceUrl}/analyze-url`, {
          url: data.url,
          context: 'threat_detection',
          additional_data: data
        }, {
          timeout: 5000
        });

        if (response.data && response.data.threat_types && response.data.threat_types.length > 0) {
          return response.data.threat_types.map(threat => ({
            type: threat,
            severity: response.data.risk_score > 0.8 ? 'high' : 
                     response.data.risk_score > 0.5 ? 'medium' : 'low',
            description: `Legacy ML detected threat: ${threat}`,
            url: data.url,
            confidence: response.data.confidence || 0.5
          }));
        }
      } catch (legacyError) {
        console.warn('Legacy ML also unavailable:', legacyError.message);
      }

      return [];
    }
  }

  /**
   * Calculate overall risk score
   */
  calculateRiskScore(threats) {
    if (threats.length === 0) return 0;

    const severityWeights = {
      low: 0.3,
      medium: 0.6,
      high: 1.0,
      critical: 1.5
    };

    const totalScore = threats.reduce((sum, threat) => {
      const weight = severityWeights[threat.severity] || 0.5;
      const confidence = threat.confidence || 0.5;
      return sum + (weight * confidence);
    }, 0);

    // Normalize to 0-10 scale
    return Math.min(10, Math.round(totalScore * 2));
  }

  /**
   * Get threat statistics
   */
  async getThreatStats(userId = null) {
    try {
      const Threat = require('../models/Threat');
      
      const query = {};
      // If scoping by user, add query.user = userId, but Threat model might not have user?
      
      const total_threats = await Threat.countDocuments(query);
      const active_threats = await Threat.countDocuments({ ...query, status: { $in: ['detected', 'investigating', 'confirmed'] } });
      const resolved_threats = await Threat.countDocuments({ ...query, status: { $in: ['mitigated', 'false_positive'] } });
      const high_severity = await Threat.countDocuments({ ...query, severity: { $in: ['high', 'critical'] } });
      
      const lastThreat = await Threat.findOne(query).sort({ 'detection.timestamp': -1 });
      
      return {
        total_threats,
        active_threats,
        resolved_threats,
        high_severity,
        last_scan: lastThreat?.detection?.timestamp || new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting threat stats:', error);
      return null;
    }
  }

  /**
   * Check if URL is in known threat database
   */
  async checkThreatDatabase(url) {
    try {
      // This would check against known threat databases
      // For now, return safe
      return {
        is_threat: false,
        threat_type: null,
        confidence: 0.0
      };
    } catch (error) {
      console.error('Error checking threat database:', error);
      return {
        is_threat: false,
        threat_type: null,
        confidence: 0.0
      };
    }
  }
}

// Create singleton instance
const threatService = new ThreatService();

module.exports = {
  threatService,
  cyberforgeML,
  detectThreats: (data) => threatService.detectThreats(data),
  getThreatStats: (userId) => threatService.getThreatStats(userId),
  checkThreatDatabase: (url) => threatService.checkThreatDatabase(url),
  // CyberForge ML convenience methods
  analyzeUrl: (url, features) => cyberforgeML.analyzeUrl(url, features),
  mlPredict: (model, features) => cyberforgeML.predict(model, features)
};
