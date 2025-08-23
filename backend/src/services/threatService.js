/**
 * Threat Detection Service
 * Handles cybersecurity threat detection and analysis
 */

const axios = require('axios');

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
   * ML-based threat detection
   */
  async detectMLThreats(data) {
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
          description: `ML detected threat: ${threat}`,
          url: data.url,
          confidence: response.data.confidence || 0.5
        }));
      }

      return [];

    } catch (error) {
      console.warn('ML threat detection failed:', error.message);
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
      // This would typically query the database
      // For now, return mock stats
      return {
        total_threats: 0,
        active_threats: 0,
        resolved_threats: 0,
        high_severity: 0,
        last_scan: new Date().toISOString()
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
  detectThreats: (data) => threatService.detectThreats(data),
  getThreatStats: (userId) => threatService.getThreatStats(userId),
  checkThreatDatabase: (url) => threatService.checkThreatDatabase(url)
};
