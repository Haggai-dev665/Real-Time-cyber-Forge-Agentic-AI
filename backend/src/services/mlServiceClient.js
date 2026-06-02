/**
 * ML Service Client
 * Calls the CyberForge HuggingFace Space (che237-cyberforge) for:
 *   - Threat classification via /scan-threats (Gemini-powered)
 *   - URL analysis via /analyze-url (ML model predictions)
 *   - Gemini explanation via /scan-threats (returns detailed analysis)
 *
 * NO FALLBACKS — this is a production service. If HF is down, errors propagate.
 */

const axios = require('axios');
const logger = require('../utils/logger');

class MLServiceClient {
  constructor() {
    this.baseUrl = process.env.AI_SERVICE_URL || 'https://che237-cyberforge.hf.space';
    this.timeout = 60000; // 60s — Gemini analysis can take time
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    logger.info(`🤖 ML Service Client initialized → ${this.baseUrl}`);
  }

  /**
   * Check if ML service is available
   */
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }

  /**
   * Classify threat using HF Space /analyze-url endpoint.
   * Returns per-model predictions (phishing, malware, anomaly, web_attack)
   * plus an aggregate risk score.
   *
   * @param {Object} analysisData - Formatted analysis from webScraperAPIService.formatForAIAnalysis()
   * @returns {Promise<Object>} ML classification result
   */
  async classifyThreat(analysisData) {
    const { url, risk_score, risk_level, security_summary, missing_headers, suspicious_requests } = analysisData;

    logger.info(`🔬 ML classifying: ${url} (scraper risk: ${risk_score}/${risk_level})`);

    // Call /analyze-url — returns per-model predictions
    const response = await this.client.post('/analyze-url', {
      url,
      analysis_data: {
        risk_score,
        risk_level,
        security_summary: security_summary || {},
        missing_headers: missing_headers || [],
        suspicious_requests: (suspicious_requests || []).slice(0, 5)
      }
    });

    const result = response.data;
    const predictions = result.model_predictions || {};
    const aggregate = result.aggregate || {};

    // Determine the highest-threat model
    let maxThreatScore = 0;
    let dominantCategory = 'benign';
    let dominantConfidence = 1.0;

    for (const [modelName, pred] of Object.entries(predictions)) {
      if (pred.threat_score > maxThreatScore) {
        maxThreatScore = pred.threat_score;
        dominantCategory = pred.prediction_label || modelName.replace('_detection', '');
        dominantConfidence = pred.confidence || 0.5;
      }
    }

    // Combine: use the higher of aggregate threat score (0-1 scale → 0-100) or scraper risk score
    const mlRiskScore = Math.round((aggregate.average_threat_score || 0) * 100);
    const combinedRiskScore = Math.max(mlRiskScore, risk_score || 0);

    // If all models say benign but scraper found issues, use scraper risk level
    if (dominantCategory === 'benign' && risk_score >= 30) {
      dominantCategory = risk_level === 'critical' ? 'malware' :
                         risk_level === 'high' ? 'phishing' : 'suspicious';
    }

    const classification = {
      riskScore: combinedRiskScore,
      confidence: dominantConfidence,
      category: dominantCategory,
      threatType: dominantCategory,
      indicators: this.extractIndicators(predictions),
      modelPredictions: predictions,
      featuresAnalyzed: result.features_analyzed || {},
      aggregateRisk: aggregate,
      timestamp: new Date().toISOString()
    };

    logger.info(`✅ ML classification: ${classification.category} | risk=${classification.riskScore} | confidence=${classification.confidence}`);
    return classification;
  }

  /**
   * Get Gemini-powered threat explanation via /scan-threats endpoint.
   * Returns detailed analysis, recommendations, and technical breakdown.
   *
   * @param {Object} mlOutput - Output from classifyThreat()
   * @param {Object} analysisData - Original analysis data for context
   * @returns {Promise<Object>} Gemini explanation
   */
  async getExplanation(mlOutput, analysisData) {
    logger.info(`💡 Requesting Gemini explanation for: ${mlOutput.category} (risk: ${mlOutput.riskScore})`);

    // Build the scan data for Gemini — include both ML output and scraper data
    const scanData = {
      url: analysisData?.url || 'unknown',
      risk_score: mlOutput.riskScore,
      risk_level: mlOutput.riskScore >= 70 ? 'critical' : mlOutput.riskScore >= 50 ? 'high' :
                  mlOutput.riskScore >= 30 ? 'medium' : 'low',
      category: mlOutput.category,
      confidence: mlOutput.confidence,
      security_summary: analysisData?.security_summary || {},
      model_predictions: mlOutput.modelPredictions || {},
      indicators: mlOutput.indicators || [],
      features_analyzed: mlOutput.featuresAnalyzed || {}
    };

    const response = await this.client.post('/scan-threats', {
      data: scanData
    });

    const result = response.data;

    // Parse recommendations from the Gemini response text
    const recommendations = result.recommendations && result.recommendations.length > 0
      ? result.recommendations
      : this.extractRecommendations(result.response || '');

    const explanation = {
      summary: this.extractSummary(result.response || '', mlOutput),
      fullAnalysis: result.response || '',
      recommendations,
      riskLevel: result.risk_level || 'unknown',
      geminiRiskScore: this.normalizeRiskScore(result.risk_score),
      geminiConfidence: result.confidence || 0,
      modelUsed: result.model_used || 'gemini',
      technicalDetails: result.response || '',
      timestamp: result.timestamp || new Date().toISOString()
    };

    logger.info(`✅ Gemini explanation: ${explanation.riskLevel} | model=${explanation.modelUsed}`);
    return explanation;
  }

  /**
   * Extract a concise summary from Gemini's full response
   */
  extractSummary(responseText, mlOutput) {
    if (!responseText) {
      return `${mlOutput.category} threat detected with ${Math.round(mlOutput.confidence * 100)}% confidence`;
    }
    // Take first 2-3 sentences or up to 300 chars
    const sentences = responseText.split(/[.!]\s+/).filter(s => s.trim().length > 10);
    const summary = sentences.slice(0, 3).join('. ').trim();
    return summary.length > 300 ? summary.substring(0, 297) + '...' : summary + '.';
  }

  /**
   * Extract recommendations from Gemini response text
   */
  extractRecommendations(responseText) {
    const recs = [];
    const lines = responseText.split('\n');
    let inRecommendations = false;

    for (const line of lines) {
      if (/recommendation|action|should|must|block|enable|implement|monitor/i.test(line)) {
        inRecommendations = true;
      }
      if (inRecommendations && /^\s*[\*\-•]\s+(.+)/.test(line)) {
        const match = line.match(/^\s*[\*\-•]\s+\*?\*?(.+?)\*?\*?\s*$/);
        if (match) {
          const rec = match[1].replace(/\*\*/g, '').trim();
          if (rec.length > 10 && rec.length < 200) recs.push(rec);
        }
      }
    }

    return recs.length > 0 ? recs.slice(0, 5) : [
      'Review the full analysis report',
      'Monitor for similar patterns'
    ];
  }

  /**
   * Extract threat indicators from model predictions
   */
  extractIndicators(predictions) {
    const indicators = [];
    for (const [model, pred] of Object.entries(predictions || {})) {
      if (pred.threat_score > 0 || pred.prediction_label !== 'benign') {
        indicators.push(`${model}: ${pred.prediction_label} (${Math.round(pred.confidence * 100)}%)`);
      }
      if (pred.reasons && pred.reasons.length > 0) {
        indicators.push(...pred.reasons);
      }
    }
    return indicators;
  }

  /**
   * Normalize risk score to 0-100 scale
   */
  normalizeRiskScore(score) {
    if (score == null) return 0;
    if (score >= 0 && score <= 10) return Math.round(score * 10);
    if (score >= 0 && score <= 1) return Math.round(score * 100);
    if (score >= 0 && score <= 100) return Math.round(score);
    return 50;
  }
}

// Singleton instance
const mlServiceClient = new MLServiceClient();

module.exports = { MLServiceClient, mlServiceClient };
