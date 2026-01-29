/**
 * AI Analysis Routes
 * Provides endpoints for AI-powered security analysis
 */

const express = require('express');
const { body, query } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const AIAnalysisService = require('../services/ai/AIAnalysisService');
const ThreatMonitoringService = require('../services/ai/ThreatMonitoringService');
const { mlService } = require('../services/mlService');
const { webScraperAPIService } = require('../services/WebScraperAPIService');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Initialize services
const aiAnalysisService = new AIAnalysisService();
const threatMonitoringService = new ThreatMonitoringService();

// Start threat monitoring
threatMonitoringService.startMonitoring();

/**
 * Helper function to build security findings from scraped data
 */
function buildSecurityFindings(scrapedData) {
  const findings = [];
  const ss = scrapedData.security_summary || {};
  
  // HTTPS check
  if (!ss.is_https) {
    findings.push({
      title: 'No HTTPS',
      description: 'Website is not using HTTPS encryption. All data is transmitted in plain text.',
      severity: 'critical'
    });
  }
  
  // Mixed content
  if (ss.has_mixed_content) {
    findings.push({
      title: 'Mixed Content',
      description: 'Website loads some resources over insecure HTTP connections.',
      severity: 'high'
    });
  }
  
  // Insecure cookies
  if (ss.has_insecure_cookies) {
    findings.push({
      title: 'Insecure Cookies',
      description: 'Some cookies are not marked as Secure or HttpOnly.',
      severity: 'medium'
    });
  }
  
  // Missing security headers
  const missingHeaders = ss.missing_security_headers || scrapedData.missing_headers || [];
  missingHeaders.forEach(header => {
    findings.push({
      title: `Missing ${header}`,
      description: `The ${header} security header is not set.`,
      severity: 'medium'
    });
  });
  
  // Suspicious requests
  if (ss.suspicious_requests_count > 0) {
    findings.push({
      title: 'Suspicious Network Requests',
      description: `${ss.suspicious_requests_count} potentially suspicious requests detected.`,
      severity: 'high'
    });
  }
  
  // External domains
  if (ss.external_domains_count > 20) {
    findings.push({
      title: 'Excessive External Domains',
      description: `Website connects to ${ss.external_domains_count} external domains.`,
      severity: 'low'
    });
  }
  
  // Console errors
  if (ss.console_errors_count > 0) {
    findings.push({
      title: 'JavaScript Errors',
      description: `${ss.console_errors_count} JavaScript errors detected on the page.`,
      severity: 'info'
    });
  }
  
  return findings;
}

// Rate limiting for AI analysis routes
const aiAnalysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 analysis requests per windowMs
  message: {
    success: false,
    message: 'Too many analysis requests, please try again later'
  }
});

// Validation rules
const urlAnalysisValidation = [
  body('url')
    .isURL()
    .withMessage('Please provide a valid URL'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object')
];

const fileAnalysisValidation = [
  body('filename')
    .notEmpty()
    .withMessage('Filename is required'),
  body('hash')
    .isLength({ min: 32, max: 64 })
    .withMessage('File hash must be between 32-64 characters'),
  body('size')
    .isInt({ min: 1 })
    .withMessage('File size must be a positive integer')
];

/**
 * @route   POST /api/ai/analyze/url
 * @desc    Analyze URL for threats
 * @access  Private
 */
router.post('/analyze/url', 
  auth, 
  aiAnalysisLimiter, 
  urlAnalysisValidation,
  async (req, res) => {
    try {
      const { url, context } = req.body;
      
      const result = await aiAnalysisService.analyzeUrl(
        url, 
        req.user.userId, 
        {
          ...context,
          source: 'api',
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        }
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            analysis_id: result.analysis._id,
            results: result.results,
            url: url
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('URL analysis route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during URL analysis'
      });
    }
  }
);

/**
 * @route   POST /api/ai/analyze/file
 * @desc    Analyze file for malware
 * @access  Private
 */
router.post('/analyze/file',
  auth,
  aiAnalysisLimiter,
  fileAnalysisValidation,
  async (req, res) => {
    try {
      const { filename, hash, size, type, content } = req.body;
      
      const fileData = {
        filename,
        hash,
        size,
        type,
        content
      };

      const result = await aiAnalysisService.analyzeFile(
        fileData,
        req.user.userId,
        {
          source: 'api',
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        }
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            analysis_id: result.analysis._id,
            results: result.results,
            filename: filename
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('File analysis route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during file analysis'
      });
    }
  }
);

/**
 * @route   POST /api/ai/analyze/network
 * @desc    Analyze network traffic patterns
 * @access  Private (Analyst or Admin only)
 */
router.post('/analyze/network',
  auth,
  authorize('analyst', 'admin'),
  aiAnalysisLimiter,
  async (req, res) => {
    try {
      const { networkData } = req.body;

      if (!networkData) {
        return res.status(400).json({
          success: false,
          message: 'Network data is required'
        });
      }

      const result = await aiAnalysisService.analyzeNetworkTraffic(
        networkData,
        req.user.userId
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            analysis_id: result.analysis._id,
            results: result.results
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('Network analysis route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during network analysis'
      });
    }
  }
);

/**
 * @route   GET /api/ai/analysis/history
 * @desc    Get user's analysis history
 * @access  Private
 */
router.get('/analysis/history',
  auth,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      
      const result = await aiAnalysisService.getAnalysisHistory(
        req.user.userId,
        limit
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            analyses: result.analyses,
            count: result.analyses.length
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('Analysis history route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   GET /api/ai/threats/summary
 * @desc    Get threat summary
 * @access  Private
 */
router.get('/threats/summary',
  auth,
  [
    query('timeframe')
      .optional()
      .isIn(['1h', '24h', '7d', '30d'])
      .withMessage('Timeframe must be one of: 1h, 24h, 7d, 30d')
  ],
  async (req, res) => {
    try {
      const timeframe = req.query.timeframe || '24h';
      
      const result = await aiAnalysisService.getThreatSummary(timeframe);

      if (result.success) {
        res.json({
          success: true,
          data: result.summary
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('Threat summary route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   GET /api/ai/monitoring/status
 * @desc    Get real-time monitoring status
 * @access  Private (Analyst or Admin only)
 */
router.get('/monitoring/status',
  auth,
  authorize('analyst', 'admin'),
  async (req, res) => {
    try {
      const status = threatMonitoringService.getStatus();
      
      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Monitoring status route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   POST /api/ai/monitoring/start
 * @desc    Start real-time monitoring
 * @access  Private (Admin only)
 */
router.post('/monitoring/start',
  auth,
  authorize('admin'),
  async (req, res) => {
    try {
      threatMonitoringService.startMonitoring();
      
      res.json({
        success: true,
        message: 'Real-time monitoring started'
      });

    } catch (error) {
      console.error('Start monitoring route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   POST /api/ai/monitoring/stop
 * @desc    Stop real-time monitoring
 * @access  Private (Admin only)
 */
router.post('/monitoring/stop',
  auth,
  authorize('admin'),
  async (req, res) => {
    try {
      threatMonitoringService.stopMonitoring();
      
      res.json({
        success: true,
        message: 'Real-time monitoring stopped'
      });

    } catch (error) {
      console.error('Stop monitoring route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   GET /api/ai/models/status
 * @desc    Get AI models status
 * @access  Private (Analyst or Admin only)
 */
router.get('/models/status',
  auth,
  authorize('analyst', 'admin'),
  async (req, res) => {
    try {
      // In production, this would check actual model status
      const modelsStatus = {
        threat_detection: {
          status: 'active',
          version: '1.0.0',
          accuracy: 0.94,
          last_updated: '2024-01-15T10:30:00Z'
        },
        malware_analysis: {
          status: 'active',
          version: '1.2.0',
          accuracy: 0.97,
          last_updated: '2024-01-20T14:15:00Z'
        },
        phishing_detection: {
          status: 'active',
          version: '1.1.0',
          accuracy: 0.92,
          last_updated: '2024-01-18T09:45:00Z'
        },
        network_analysis: {
          status: 'active',
          version: '1.0.1',
          accuracy: 0.89,
          last_updated: '2024-01-22T16:20:00Z'
        }
      };

      res.json({
        success: true,
        data: {
          models: modelsStatus,
          overall_status: 'healthy',
          total_models: Object.keys(modelsStatus).length
        }
      });

    } catch (error) {
      console.error('Models status route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// =======================================================
// ML SERVICE INTEGRATION ENDPOINTS
// =======================================================

/**
 * @route   GET /api/ai/ml-health
 * @desc    Check ML services health
 * @access  Public
 */
router.get('/ml-health',
  async (req, res) => {
    try {
      const healthStatus = await mlService.checkHealth();
      
      res.json({
        success: true,
        data: healthStatus
      });
    } catch (error) {
      console.error('ML health check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check ML services health'
      });
    }
  }
);

/**
 * @route   POST /api/ai/chat-ml
 * @desc    Chat with AI using ML services
 * @access  Private
 */
router.post('/chat-ml',
  auth,
  aiAnalysisLimiter,
  [
    body('message').notEmpty().withMessage('Message is required'),
    body('conversation_id').optional().isString(),
    body('context').optional().isObject()
  ],
  async (req, res) => {
    try {
      const { message, conversation_id, context } = req.body;
      
      // Add user context
      const enrichedContext = {
        ...context,
        user_id: req.user.id,
        timestamp: new Date().toISOString()
      };
      
      const result = await mlService.chatWithAI(message, conversation_id, enrichedContext);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(200).json({
          success: true,
          data: {
            response: result.fallback_response || "I'm having technical difficulties. Please try again.",
            conversation_id: conversation_id,
            source: 'fallback'
          }
        });
      }
    } catch (error) {
      console.error('ML chat error:', error);
      res.status(500).json({
        success: false,
        message: 'Chat service temporarily unavailable'
      });
    }
  }
);

/**
 * @route   POST /api/ai/analyze-website-ml
 * @desc    Analyze website using ML services
 * @access  Private
 */
router.post('/analyze-website-ml',
  auth,
  aiAnalysisLimiter,
  [
    body('url').isURL().withMessage('Valid URL is required'),
    body('content').optional().isString()
  ],
  async (req, res) => {
    try {
      const { url, content } = req.body;
      
      const result = await mlService.analyzeWebsite(url, content);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Website analysis failed'
        });
      }
    } catch (error) {
      console.error('ML website analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Website analysis service unavailable'
      });
    }
  }
);

/**
 * @route   POST /api/ai/scan-threats-ml
 * @desc    Scan for threats using ML models
 * @access  Private
 */
router.post('/scan-threats-ml',
  auth,
  aiAnalysisLimiter,
  [
    body('data').isObject().withMessage('Scan data is required')
  ],
  async (req, res) => {
    try {
      const { data } = req.body;
      
      // Add user context to scan data
      const enrichedData = {
        ...data,
        user_id: req.user.id,
        scan_timestamp: new Date().toISOString()
      };
      
      const result = await mlService.scanForThreats(enrichedData);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Threat scan failed'
        });
      }
    } catch (error) {
      console.error('ML threat scan error:', error);
      res.status(500).json({
        success: false,
        message: 'Threat scanning service unavailable'
      });
    }
  }
);

/**
 * @route   POST /api/ai/insights-ml
 * @desc    Generate AI insights using ML services
 * @access  Private
 */
router.post('/insights-ml',
  auth,
  aiAnalysisLimiter,
  [
    body('query').notEmpty().withMessage('Query is required'),
    body('context').optional().isObject()
  ],
  async (req, res) => {
    try {
      const { query, context } = req.body;
      
      // Add user context
      const enrichedContext = {
        ...context,
        user_id: req.user.id,
        request_timestamp: new Date().toISOString()
      };
      
      const result = await mlService.getAIInsights(query, enrichedContext);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Insights generation failed'
        });
      }
    } catch (error) {
      console.error('ML insights error:', error);
      res.status(500).json({
        success: false,
        message: 'AI insights service unavailable'
      });
    }
  }
);

/**
 * @route   POST /api/ai/network-analysis-ml
 * @desc    Analyze network traffic using ML models
 * @access  Private
 */
router.post('/network-analysis-ml',
  auth,
  aiAnalysisLimiter,
  [
    body('traffic_data').isObject().withMessage('Traffic data is required')
  ],
  async (req, res) => {
    try {
      const { traffic_data } = req.body;
      
      const result = await mlService.analyzeNetworkTraffic(traffic_data);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Network analysis failed'
        });
      }
    } catch (error) {
      console.error('ML network analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Network analysis service unavailable'
      });
    }
  }
);

/**
 * @route   POST /api/ai/execute-task-ml
 * @desc    Execute AI task using Enhanced AI Agent
 * @access  Private
 */
router.post('/execute-task-ml',
  auth,
  aiAnalysisLimiter,
  [
    body('task_type').notEmpty().withMessage('Task type is required'),
    body('task_data').isObject().withMessage('Task data is required')
  ],
  async (req, res) => {
    try {
      const { task_type, task_data } = req.body;
      
      // Add user context to task data
      const enrichedTaskData = {
        ...task_data,
        user_id: req.user.id,
        initiated_at: new Date().toISOString()
      };
      
      const result = await mlService.executeAITask(task_type, enrichedTaskData);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Task execution failed'
        });
      }
    } catch (error) {
      console.error('ML task execution error:', error);
      res.status(500).json({
        success: false,
        message: 'AI task execution service unavailable'
      });
    }
  }
);

/**
 * @route POST /api/ai/chat
 * @desc Chat with AI assistant using ML services
 * @access Public
 */
router.post('/chat',
  aiAnalysisLimiter,
  [
    body('message').notEmpty().withMessage('Message is required'),
    body('conversationHistory').optional().isArray(),
    body('context').optional().isObject()
  ],
  async (req, res) => {
    try {
      const { message, conversationHistory = [], context = {} } = req.body;
      
      console.log('🤖 AI Chat Request:', { message, historyLength: conversationHistory.length });
      
      // Detect if user is requesting a website scan/analysis
      const urlPattern = /(?:scan|analyze|check|review|audit|scrape|inspect|investigate|assess)\s+(?:the\s+)?(?:website|site|url|page|domain)?\s*:?\s*(https?:\/\/[^\s]+)/i;
      const simpleUrlPattern = /(?:scan|analyze|check|security\s+(?:of|for|on)|vulnerabilities?\s+(?:of|for|on|in))\s+(https?:\/\/[^\s]+)/i;
      const urlOnlyPattern = /(https?:\/\/[^\s]+)/i;
      
      // Check for scanning intent keywords
      const scanKeywords = ['scan', 'analyze', 'check', 'security', 'vulnerab', 'audit', 'inspect', 'threat', 'assess', 'review', 'scrape'];
      const hasScanIntent = scanKeywords.some(kw => message.toLowerCase().includes(kw));
      
      let websiteContext = null;
      let urlMatch = message.match(urlPattern) || message.match(simpleUrlPattern);
      
      // If no explicit scan pattern but has URL and scan-related intent
      if (!urlMatch && hasScanIntent) {
        urlMatch = message.match(urlOnlyPattern);
      }
      
      if (urlMatch) {
        const targetUrl = urlMatch[1];
        console.log(`🌐 Detected URL for scanning: ${targetUrl}`);
        
        try {
          // Call the web scraper API
          const scrapeResult = await webScraperAPIService.scrapeWebsite(targetUrl);
          
          if (scrapeResult.success) {
            // Format the scraped data for AI analysis
            const analysisData = webScraperAPIService.formatForAIAnalysis(scrapeResult);
            const aiContext = webScraperAPIService.generateAIContext(analysisData);
            
            console.log(`✅ Website scraped successfully. Risk Score: ${analysisData.risk_score}/100`);
            
            // Add scraped data to context for AI
            websiteContext = {
              type: 'website_security_scan',
              url: targetUrl,
              scraped_data: analysisData,
              formatted_context: aiContext
            };
          } else {
            console.log(`⚠️ Website scraping failed: ${scrapeResult.error}`);
            websiteContext = {
              type: 'website_security_scan',
              url: targetUrl,
              error: scrapeResult.error,
              formatted_context: `Website scraping failed for ${targetUrl}: ${scrapeResult.error}. Provide general security advice.`
            };
          }
        } catch (scrapeError) {
          console.error('Web scraper error:', scrapeError.message);
          websiteContext = {
            type: 'website_security_scan',
            url: targetUrl,
            error: scrapeError.message,
            formatted_context: `Unable to scrape ${targetUrl}. Error: ${scrapeError.message}. Provide general security analysis advice.`
          };
        }
      }
      
      // Merge website context with existing context
      const enrichedContext = {
        ...context,
        ...(websiteContext && { website_scan: websiteContext })
      };
      
      // If we have website scan data, prepend it to the message for better AI context
      let enrichedMessage = message;
      if (websiteContext && websiteContext.formatted_context) {
        enrichedMessage = `[WEBSITE SECURITY SCAN DATA]\n${websiteContext.formatted_context}\n\n[USER REQUEST]\n${message}\n\nPlease analyze the security scan results above and provide a comprehensive security assessment including vulnerabilities, recommendations, and risk analysis.`;
      }
      
      // Try ML service first
      const mlResult = await mlService.chatWithAI(enrichedMessage, conversationHistory, enrichedContext);
      
      if (mlResult.success) {
        // Build comprehensive website scan data for frontend
        let websiteScanResponse = null;
        if (websiteContext && websiteContext.scraped_data) {
          const sd = websiteContext.scraped_data;
          websiteScanResponse = {
            url: websiteContext.url,
            title: sd.title || websiteContext.url,
            description: sd.description || sd.meta_description || '',
            risk_score: sd.risk_score || 0,
            risk_level: sd.risk_level || 'low',
            scanned: !websiteContext.error,
            summary: sd.summary || `Security analysis of ${websiteContext.url}`,
            
            // Security data
            findings: buildSecurityFindings(sd),
            headers: sd.security_summary ? {
              csp: sd.security_summary.missing_security_headers?.includes('Content-Security-Policy') ? null : 'Present',
              hsts: sd.security_summary.missing_security_headers?.includes('Strict-Transport-Security') ? null : 'Present',
              xFrameOptions: sd.security_summary.missing_security_headers?.includes('X-Frame-Options') ? null : 'Present',
              xContentType: sd.security_summary.missing_security_headers?.includes('X-Content-Type-Options') ? null : 'Present',
              xssProtection: sd.security_summary.missing_security_headers?.includes('X-XSS-Protection') ? null : 'Present',
              referrerPolicy: sd.security_summary.missing_security_headers?.includes('Referrer-Policy') ? null : 'Present'
            } : {},
            ssl: {
              valid: sd.security_summary?.is_https || false,
              issuer: sd.ssl_issuer || null,
              expires: sd.ssl_expires || null
            },
            
            // Technologies (mock for now, can be enhanced)
            technologies: sd.technologies || [],
            
            // Performance
            performance: {
              loadTime: sd.performance?.total_load_time_ms ? `${sd.performance.total_load_time_ms}ms` : 'N/A',
              pageSize: sd.performance?.total_size_kb ? `${sd.performance.total_size_kb}KB` : 'N/A',
              requestCount: sd.network_summary?.total_requests || 0,
              score: sd.performance_score || null
            },
            
            // Assets
            images: sd.images || [],
            scripts: sd.scripts || [],
            stylesheets: sd.stylesheets || [],
            requests: sd.network_requests || []
          };
        }
        
        return res.json({
          success: true,
          response: mlResult.data.response || mlResult.data,
          confidence: mlResult.data.confidence,
          insights: mlResult.data.insights,
          recommendations: mlResult.data.recommendations,
          source: 'ml_service',
          website_scan: websiteScanResponse
        });
      }
      
      // Fallback to local AI service
      console.log('ML service unavailable, using fallback');
      const fallbackResponse = mlResult.fallback_response || 
        "I'm currently experiencing technical difficulties. Please try again in a moment.";
      
      res.json({
        success: true,
        response: fallbackResponse,
        source: 'fallback'
      });
      
    } catch (error) {
      console.error('AI chat route error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process chat request',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/ai/analyze-website
 * @desc Analyze website using ML services
 * @access Private
 */
router.post('/analyze-website',
  auth,
  aiAnalysisLimiter,
  [
    body('url').isURL().withMessage('Valid URL is required'),
    body('content').optional().isString()
  ],
  async (req, res) => {
    try {
      const { url, content } = req.body;
      
      console.log('🔍 Website Analysis Request:', url);
      
      const result = await mlService.analyzeWebsite(url, content);
      
      if (result.success) {
        res.json({
          success: true,
          analysis: result.data,
          source: 'ml_service'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Website analysis failed',
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('Website analysis route error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze website',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/ai/scan-threats
 * @desc Scan for threats using ML models
 * @access Private
 */
router.post('/scan-threats',
  auth,
  aiAnalysisLimiter,
  [
    body('data').isObject().withMessage('Analysis data is required')
  ],
  async (req, res) => {
    try {
      const { data } = req.body;
      
      console.log('🛡️ Threat Scan Request');
      
      const result = await mlService.scanForThreats(data);
      
      if (result.success) {
        res.json({
          success: true,
          threats: result.data,
          source: 'ml_service'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Threat scan failed',
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('Threat scan route error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to scan for threats',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/ai/insights
 * @desc Get AI insights using ML services
 * @access Private
 */
router.post('/insights',
  auth,
  aiAnalysisLimiter,
  [
    body('query').notEmpty().withMessage('Query is required'),
    body('context').optional().isObject()
  ],
  async (req, res) => {
    try {
      const { query, context } = req.body;
      
      console.log('💡 AI Insights Request:', query);
      
      const result = await mlService.getAIInsights(query, context);
      
      if (result.success) {
        res.json({
          success: true,
          insights: result.data,
          source: 'ml_service'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to generate insights',
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('AI insights route error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get AI insights',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/ai/ml-status
 * @desc Check ML services health status
 * @access Private
 */
router.get('/ml-status',
  auth,
  async (req, res) => {
    try {
      const health = await mlService.checkHealth();
      
      res.json({
        success: true,
        ml_services: health,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('ML status route error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check ML services status',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/ai/execute-task
 * @desc Execute AI task using enhanced AI agent
 * @access Private
 */
router.post('/execute-task',
  auth,
  aiAnalysisLimiter,
  [
    body('taskType').notEmpty().withMessage('Task type is required'),
    body('taskData').isObject().withMessage('Task data is required')
  ],
  async (req, res) => {
    try {
      const { taskType, taskData } = req.body;
      
      console.log('🚀 AI Task Execution:', taskType);
      
      const result = await mlService.executeAITask(taskType, taskData);
      
      if (result.success) {
        res.json({
          success: true,
          result: result.data,
          source: 'ml_service'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'AI task execution failed',
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('AI task execution route error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to execute AI task',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/ai/scrape-website
 * @desc Scrape and analyze a website for security issues
 * @access Public
 */
router.post('/scrape-website',
  aiAnalysisLimiter,
  [
    body('url').isURL().withMessage('Valid URL is required')
  ],
  async (req, res) => {
    try {
      const { url } = req.body;
      
      console.log('🕷️ Website Scrape Request:', url);
      
      // Call the web scraper API
      const scrapeResult = await webScraperAPIService.scrapeWebsite(url);
      
      if (scrapeResult.success) {
        // Format the scraped data for analysis
        const analysisData = webScraperAPIService.formatForAIAnalysis(scrapeResult);
        const aiContext = webScraperAPIService.generateAIContext(analysisData);
        
        res.json({
          success: true,
          data: {
            url: url,
            analysis: analysisData,
            formatted_report: aiContext,
            raw_data: {
              network_requests_count: scrapeResult.data.network_requests.length,
              console_logs_count: scrapeResult.data.console_logs.length,
              html_size: scrapeResult.data.html_content.length
            }
          },
          source: 'webscrapper_api'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Website scraping failed',
          error: scrapeResult.error,
          url: url
        });
      }
      
    } catch (error) {
      console.error('Website scrape route error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to scrape website',
        error: error.message
      });
    }
  }
);

// Export the threat monitoring service for WebSocket integration
router.threatMonitoringService = threatMonitoringService;

module.exports = router;