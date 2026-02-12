/**
 * ML Service Client
 * Calls the Python ML service for threat classification
 */

const axios = require('axios');
const logger = require('../utils/logger');

class MLServiceClient {
  constructor() {
    this.baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    this.timeout = 30000; // 30 seconds
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Check if ML service is available
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.error('ML service health check failed:', error.message);
      return { status: 'unavailable', error: error.message };
    }
  }

  /**
   * Classify threat from evidence data
   * @param {Object} evidenceData - Structured evidence from web scraper
   * @returns {Promise<Object>} ML classification result
   */
  async classifyThreat(evidenceData) {
    try {
      const { 
        url, 
        risk_score, 
        risk_level, 
        security_summary,
        missing_headers,
        suspicious_requests
      } = evidenceData;

      // Format the evidence into a text prompt for the ML model
      const threatContext = this.formatEvidenceForML(evidenceData);

      // Call the ML service threat detection endpoint
      const response = await this.client.post('/api/threats/detect', {
        text: threatContext,
        metadata: {
          url,
          riskScore: risk_score,
          riskLevel: risk_level
        }
      });

      // Extract and normalize the response
      const mlResult = response.data;

      return {
        riskScore: this.normalizeRiskScore(mlResult.risk_score || risk_score),
        confidence: mlResult.confidence || 0.7,
        category: mlResult.threat_type || this.inferCategory(risk_level),
        threatType: mlResult.threat_type || 'unknown',
        indicators: mlResult.indicators || [],
        details: mlResult.details || {},
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('ML threat classification failed:', error.message);
      logger.debug('ML service error details:', {
        error: error.message,
        stack: error.stack,
        url: evidenceData.url,
        serviceUrl: this.baseUrl
      });
      
      // Fallback to basic classification based on web scraper data
      return this.fallbackClassification(evidenceData);
    }
  }

  /**
   * Format evidence data for ML analysis
   */
  formatEvidenceForML(evidenceData) {
    const parts = [
      `URL: ${evidenceData.url}`,
      `Risk Level: ${evidenceData.risk_level}`,
      `Risk Score: ${evidenceData.risk_score}/100`
    ];

    if (evidenceData.security_summary) {
      parts.push(`HTTPS: ${evidenceData.security_summary.is_https ? 'Yes' : 'No'}`);
      parts.push(`Mixed Content: ${evidenceData.security_summary.has_mixed_content ? 'Yes' : 'No'}`);
      parts.push(`External Domains: ${evidenceData.security_summary.external_domains_count}`);
      parts.push(`Suspicious Requests: ${evidenceData.security_summary.suspicious_requests_count}`);
    }

    if (evidenceData.missing_headers && evidenceData.missing_headers.length > 0) {
      parts.push(`Missing Security Headers: ${evidenceData.missing_headers.join(', ')}`);
    }

    if (evidenceData.suspicious_requests && evidenceData.suspicious_requests.length > 0) {
      parts.push('Suspicious Requests Detected:');
      evidenceData.suspicious_requests.slice(0, 3).forEach(req => {
        parts.push(`- ${req.url}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Normalize risk score to 0-100 scale
   */
  normalizeRiskScore(score) {
    // If score is already 0-100, return as is
    if (score >= 0 && score <= 100) {
      return Math.round(score);
    }
    
    // If score is 0-10 scale, convert to 0-100
    if (score >= 0 && score <= 10) {
      return Math.round(score * 10);
    }
    
    // If score is 0-1 scale, convert to 0-100
    if (score >= 0 && score <= 1) {
      return Math.round(score * 100);
    }
    
    // Default to 50 if unclear
    return 50;
  }

  /**
   * Infer category from risk level
   */
  inferCategory(riskLevel) {
    const categoryMap = {
      'critical': 'malware',
      'high': 'phishing',
      'medium': 'suspicious',
      'low': 'benign',
      'minimal': 'benign'
    };
    
    return categoryMap[riskLevel] || 'unknown';
  }

  /**
   * Fallback classification when ML service is unavailable
   */
  fallbackClassification(evidenceData) {
    const riskScore = evidenceData.risk_score || 0;
    const riskLevel = evidenceData.risk_level || 'low';
    
    return {
      riskScore: riskScore,
      confidence: 0.5, // Lower confidence for fallback
      category: this.inferCategory(riskLevel),
      threatType: 'unknown',
      indicators: ['Fallback classification - ML service unavailable'],
      details: {
        fallback: true,
        originalRiskScore: riskScore,
        originalRiskLevel: riskLevel
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get threat explanation from ML service
   */
  async getExplanation(threatData) {
    try {
      const response = await this.client.post('/api/analysis/explain', {
        threat_data: threatData
      });

      return {
        summary: response.data.summary || 'Threat analysis completed',
        recommendations: response.data.recommendations || [],
        technicalDetails: response.data.technical_details || '',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('ML explanation generation failed:', error.message);
      
      return {
        summary: `${threatData.category} threat detected with ${Math.round(threatData.confidence * 100)}% confidence`,
        recommendations: [
          'Block suspicious domains',
          'Enable security headers',
          'Monitor for similar patterns'
        ],
        technicalDetails: 'Detailed analysis unavailable - ML service error',
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Singleton instance
const mlServiceClient = new MLServiceClient();

module.exports = { MLServiceClient, mlServiceClient };
