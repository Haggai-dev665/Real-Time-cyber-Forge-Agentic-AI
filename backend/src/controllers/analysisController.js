/**
 * Analysis Controller
 * Handles cybersecurity analysis requests and threat detection
 */

const Analysis = require('../models/Analysis');
const Threat = require('../models/Threat');
const { validationResult } = require('express-validator');
const axios = require('axios');

class AnalysisController {
  /**
   * Create new analysis
   */
  async createAnalysis(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { 
        url, 
        analysisType, 
        priority, 
        metadata,
        scheduledFor 
      } = req.body;

      // Create analysis record
      const analysis = new Analysis({
        userId: req.user.userId,
        url,
        analysisType,
        priority: priority || 'medium',
        status: 'pending',
        metadata: metadata || {},
        scheduledFor: scheduledFor ? new Date(scheduledFor) : new Date()
      });

      await analysis.save();

      // Trigger ML analysis
      try {
        const mlResponse = await axios.post(`${process.env.ML_SERVICE_URL || 'http://localhost:8001'}/analyze-url`, {
          url,
          context: analysisType || 'security_analysis',
          analysis_id: analysis._id
        });

        // Update analysis with initial results
        analysis.results = {
          confidence: mlResponse.data.confidence || 0.5,
          riskLevel: mlResponse.data.risk_level || 'unknown',
          securityScore: mlResponse.data.security_score || 0,
          insights: mlResponse.data.insights || [],
          recommendations: mlResponse.data.recommendations || []
        };
        analysis.status = 'processing';
        await analysis.save();

      } catch (mlError) {
        console.error('ML Service error:', mlError.message);
        analysis.status = 'failed';
        analysis.errorMessage = 'ML analysis service unavailable';
        await analysis.save();
      }

      res.status(201).json({
        success: true,
        message: 'Analysis created successfully',
        data: {
          analysis: {
            id: analysis._id,
            url: analysis.url,
            analysisType: analysis.analysisType,
            status: analysis.status,
            priority: analysis.priority,
            createdAt: analysis.createdAt,
            results: analysis.results
          }
        }
      });

    } catch (error) {
      console.error('Create analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during analysis creation'
      });
    }
  }

  /**
   * Get analysis by ID
   */
  async getAnalysis(req, res) {
    try {
      const { analysisId } = req.params;

      const analysis = await Analysis.findOne({
        _id: analysisId,
        userId: req.user.userId
      }).populate('threats');

      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Analysis not found'
        });
      }

      res.json({
        success: true,
        data: {
          analysis: {
            id: analysis._id,
            url: analysis.url,
            analysisType: analysis.analysisType,
            status: analysis.status,
            priority: analysis.priority,
            results: analysis.results,
            threats: analysis.threats,
            metadata: analysis.metadata,
            createdAt: analysis.createdAt,
            updatedAt: analysis.updatedAt,
            completedAt: analysis.completedAt
          }
        }
      });

    } catch (error) {
      console.error('Get analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get user analyses with pagination and filtering
   */
  async getUserAnalyses(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        analysisType,
        priority,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build query
      const query = { userId: req.user.userId };
      
      if (status) query.status = status;
      if (analysisType) query.analysisType = analysisType;
      if (priority) query.priority = priority;

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query
      const [analyses, totalCount] = await Promise.all([
        Analysis.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .populate('threats'),
        Analysis.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalCount / parseInt(limit));

      res.json({
        success: true,
        data: {
          analyses: analyses.map(analysis => ({
            id: analysis._id,
            url: analysis.url,
            analysisType: analysis.analysisType,
            status: analysis.status,
            priority: analysis.priority,
            results: analysis.results,
            threatCount: analysis.threats?.length || 0,
            createdAt: analysis.createdAt,
            completedAt: analysis.completedAt
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      console.error('Get user analyses error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Update analysis status
   */
  async updateAnalysisStatus(req, res) {
    try {
      const { analysisId } = req.params;
      const { status, results, errorMessage } = req.body;

      const analysis = await Analysis.findOne({
        _id: analysisId,
        userId: req.user.userId
      });

      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Analysis not found'
        });
      }

      // Update fields
      if (status) analysis.status = status;
      if (results) analysis.results = { ...analysis.results, ...results };
      if (errorMessage) analysis.errorMessage = errorMessage;
      
      if (status === 'completed') {
        analysis.completedAt = new Date();
      }

      await analysis.save();

      res.json({
        success: true,
        message: 'Analysis updated successfully',
        data: {
          analysis: {
            id: analysis._id,
            status: analysis.status,
            results: analysis.results,
            updatedAt: analysis.updatedAt,
            completedAt: analysis.completedAt
          }
        }
      });

    } catch (error) {
      console.error('Update analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Delete analysis
   */
  async deleteAnalysis(req, res) {
    try {
      const { analysisId } = req.params;

      const analysis = await Analysis.findOneAndDelete({
        _id: analysisId,
        userId: req.user.userId
      });

      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Analysis not found'
        });
      }

      // Also delete associated threats
      await Threat.deleteMany({ analysisId: analysis._id });

      res.json({
        success: true,
        message: 'Analysis deleted successfully'
      });

    } catch (error) {
      console.error('Delete analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStats(req, res) {
    try {
      const userId = req.user.userId;
      const { timeframe = '30d' } = req.query;

      // Calculate date range
      const now = new Date();
      let startDate;
      
      switch (timeframe) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const stats = await Analysis.aggregate([
        {
          $match: {
            userId: require('mongoose').Types.ObjectId(userId),
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalAnalyses: { $sum: 1 },
            completedAnalyses: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            pendingAnalyses: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            failedAnalyses: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            },
            avgSecurityScore: { $avg: '$results.securityScore' },
            highRiskCount: {
              $sum: { $cond: [{ $eq: ['$results.riskLevel', 'high'] }, 1, 0] }
            },
            mediumRiskCount: {
              $sum: { $cond: [{ $eq: ['$results.riskLevel', 'medium'] }, 1, 0] }
            },
            lowRiskCount: {
              $sum: { $cond: [{ $eq: ['$results.riskLevel', 'low'] }, 1, 0] }
            }
          }
        }
      ]);

      const analysisStats = stats[0] || {
        totalAnalyses: 0,
        completedAnalyses: 0,
        pendingAnalyses: 0,
        failedAnalyses: 0,
        avgSecurityScore: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0
      };

      // Get threat statistics
      const threatStats = await Threat.aggregate([
        {
          $match: {
            userId: require('mongoose').Types.ObjectId(userId),
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 }
          }
        }
      ]);

      const threatsByType = await Threat.aggregate([
        {
          $match: {
            userId: require('mongoose').Types.ObjectId(userId),
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          timeframe,
          analysisStats,
          threatStats: {
            bySeverity: threatStats,
            byType: threatsByType
          }
        }
      });

    } catch (error) {
      console.error('Get analysis stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Trigger batch analysis
   */
  async triggerBatchAnalysis(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { urls, analysisType, priority } = req.body;

      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'URLs array is required and cannot be empty'
        });
      }

      const analyses = [];
      const createdAnalyses = [];

      for (const url of urls) {
        try {
          const analysis = new Analysis({
            userId: req.user.userId,
            url,
            analysisType: analysisType || 'security_analysis',
            priority: priority || 'medium',
            status: 'pending'
          });

          await analysis.save();
          analyses.push(analysis);
          createdAnalyses.push({
            id: analysis._id,
            url: analysis.url,
            status: analysis.status
          });

        } catch (error) {
          console.error(`Error creating analysis for URL ${url}:`, error);
        }
      }

      // Trigger batch processing in background
      setImmediate(async () => {
        for (const analysis of analyses) {
          try {
            await axios.post(`${process.env.ML_SERVICE_URL || 'http://localhost:8001'}/analyze-url`, {
              url: analysis.url,
              context: analysis.analysisType,
              analysis_id: analysis._id
            });
          } catch (error) {
            console.error(`Batch processing error for analysis ${analysis._id}:`, error);
          }
        }
      });

      res.status(201).json({
        success: true,
        message: `Batch analysis initiated for ${createdAnalyses.length} URLs`,
        data: {
          analyses: createdAnalyses,
          totalCreated: createdAnalyses.length,
          totalRequested: urls.length
        }
      });

    } catch (error) {
      console.error('Batch analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during batch analysis'
      });
    }
  }
}

module.exports = new AnalysisController();