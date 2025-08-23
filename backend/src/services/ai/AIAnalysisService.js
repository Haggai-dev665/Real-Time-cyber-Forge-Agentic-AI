/**
 * AI Analysis Service
 * Integrates with ML models for threat detection and analysis
 */

const axios = require('axios');
const { Analysis, Threat } = require('../../models');

class AIAnalysisService {
  constructor() {
    this.mlServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    this.models = {
      threatDetection: 'threat-detector-v1',
      malwareAnalysis: 'malware-analyzer-v1',
      phishingDetection: 'phishing-detector-v1',
      networkAnalysis: 'network-analyzer-v1'
    };
  }

  /**
   * Analyze URL for threats
   */
  async analyzeUrl(url, userId, context = {}) {
    try {
      // Create analysis record
      const analysis = new Analysis({
        type: 'url',
        target: { value: url },
        user: userId,
        source: context.source || 'api',
        context
      });

      await analysis.save();
      await analysis.startProcessing('ai-worker-1');

      // Call ML service for URL analysis
      const mlResponse = await axios.post(`${this.mlServiceUrl}/analyze/url`, {
        url,
        models: [this.models.threatDetection, this.models.phishingDetection]
      });

      const results = mlResponse.data;
      
      // Process ML results
      const analysisResults = {
        safe: results.threat_score < 0.3,
        risk_score: results.threat_score * 10,
        threat_types: results.threats || [],
        confidence: results.confidence || 0.8,
        details: {
          ml_analysis: results,
          domain_reputation: results.domain_reputation,
          content_analysis: results.content_analysis
        }
      };

      // Complete analysis
      await analysis.completeAnalysis(analysisResults);

      // Create threat if risk score is high
      if (analysisResults.risk_score >= 7) {
        await this.createThreatFromAnalysis(analysis, analysisResults);
      }

      return {
        success: true,
        analysis: analysis,
        results: analysisResults
      };

    } catch (error) {
      console.error('URL analysis error:', error);
      
      if (analysis) {
        await analysis.failAnalysis(error);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze file for malware
   */
  async analyzeFile(fileData, userId, context = {}) {
    try {
      const analysis = new Analysis({
        type: 'file',
        target: { 
          value: fileData.filename,
          hash: fileData.hash,
          metadata: {
            size: fileData.size,
            type: fileData.type
          }
        },
        user: userId,
        source: context.source || 'api',
        context
      });

      await analysis.save();
      await analysis.startProcessing('ai-worker-1');

      // Call ML service for file analysis
      const mlResponse = await axios.post(`${this.mlServiceUrl}/analyze/file`, {
        file_hash: fileData.hash,
        file_content: fileData.content,
        models: [this.models.malwareAnalysis, this.models.threatDetection]
      });

      const results = mlResponse.data;

      const analysisResults = {
        safe: results.malware_score < 0.2,
        risk_score: results.malware_score * 10,
        threat_types: results.malware_families || [],
        confidence: results.confidence || 0.85,
        details: {
          malware_analysis: results,
          behavioral_analysis: results.behavior,
          static_analysis: results.static_features
        }
      };

      await analysis.completeAnalysis(analysisResults);

      if (analysisResults.risk_score >= 8) {
        await this.createThreatFromAnalysis(analysis, analysisResults);
      }

      return {
        success: true,
        analysis: analysis,
        results: analysisResults
      };

    } catch (error) {
      console.error('File analysis error:', error);
      
      if (analysis) {
        await analysis.failAnalysis(error);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze network traffic patterns
   */
  async analyzeNetworkTraffic(networkData, userId) {
    try {
      const analysis = new Analysis({
        type: 'network',
        target: { 
          value: 'network_traffic',
          metadata: networkData
        },
        user: userId,
        source: 'network_monitor'
      });

      await analysis.save();
      await analysis.startProcessing('ai-worker-network');

      // Call ML service for network analysis
      const mlResponse = await axios.post(`${this.mlServiceUrl}/analyze/network`, {
        traffic_data: networkData,
        models: [this.models.networkAnalysis, this.models.threatDetection]
      });

      const results = mlResponse.data;

      const analysisResults = {
        safe: results.anomaly_score < 0.3,
        risk_score: results.anomaly_score * 10,
        threat_types: results.detected_threats || [],
        confidence: results.confidence || 0.75,
        details: {
          network_analysis: results,
          traffic_patterns: results.patterns,
          anomalies: results.anomalies
        }
      };

      await analysis.completeAnalysis(analysisResults);

      if (analysisResults.risk_score >= 6) {
        await this.createThreatFromAnalysis(analysis, analysisResults);
      }

      return {
        success: true,
        analysis: analysis,
        results: analysisResults
      };

    } catch (error) {
      console.error('Network analysis error:', error);
      
      if (analysis) {
        await analysis.failAnalysis(error);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create threat record from analysis
   */
  async createThreatFromAnalysis(analysis, results) {
    try {
      const threat = new Threat({
        type: this.mapAnalysisToThreatType(analysis.type, results.threat_types),
        severity: this.mapRiskScoreToSeverity(results.risk_score),
        description: this.generateThreatDescription(analysis, results),
        source: {
          url: analysis.type === 'url' ? analysis.target.value : undefined,
          domain: analysis.type === 'url' ? new URL(analysis.target.value).hostname : undefined
        },
        detection: {
          method: 'ml_model',
          confidence: results.confidence,
          model_version: 'v1.0'
        },
        details: {
          analysis_id: analysis._id,
          indicators: results.threat_types,
          ml_results: results.details
        }
      });

      await threat.save();
      
      // Add timeline event
      await threat.addTimelineEvent(
        'Threat detected by AI analysis',
        `Analysis ID: ${analysis._id}, Risk Score: ${results.risk_score}`,
        analysis.user
      );

      return threat;

    } catch (error) {
      console.error('Threat creation error:', error);
      throw error;
    }
  }

  /**
   * Map analysis type and threats to threat type
   */
  mapAnalysisToThreatType(analysisType, threatTypes) {
    if (threatTypes.includes('malware') || threatTypes.includes('virus')) {
      return 'malware';
    }
    if (threatTypes.includes('phishing')) {
      return 'phishing';
    }
    if (analysisType === 'url') {
      return 'suspicious_url';
    }
    if (analysisType === 'network') {
      return 'network_intrusion';
    }
    return 'anomaly';
  }

  /**
   * Map risk score to severity level
   */
  mapRiskScoreToSeverity(riskScore) {
    if (riskScore >= 9) return 'critical';
    if (riskScore >= 7) return 'high';
    if (riskScore >= 4) return 'medium';
    return 'low';
  }

  /**
   * Generate threat description
   */
  generateThreatDescription(analysis, results) {
    const target = analysis.target.value;
    const riskScore = results.risk_score;
    const threatTypes = results.threat_types.join(', ');

    return `AI analysis detected ${threatTypes} threat in ${analysis.type} "${target}" with risk score ${riskScore.toFixed(1)}/10`;
  }

  /**
   * Get analysis history
   */
  async getAnalysisHistory(userId, limit = 50) {
    try {
      const analyses = await Analysis.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('user', 'firstName lastName email');

      return {
        success: true,
        analyses
      };
    } catch (error) {
      console.error('Get analysis history error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get threat summary
   */
  async getThreatSummary(timeframe = '24h') {
    try {
      const timeFilter = this.getTimeFilter(timeframe);
      
      const summary = await Threat.aggregate([
        { $match: { 'detection.timestamp': { $gte: timeFilter } } },
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 },
            types: { $addToSet: '$type' }
          }
        }
      ]);

      const total = await Threat.countDocuments({ 
        'detection.timestamp': { $gte: timeFilter } 
      });

      return {
        success: true,
        summary: {
          total,
          by_severity: summary,
          timeframe
        }
      };
    } catch (error) {
      console.error('Get threat summary error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get time filter for timeframe
   */
  getTimeFilter(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }
}

module.exports = AIAnalysisService;