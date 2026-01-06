/**
 * ML Training Routes
 * Handles endpoints for model training, dataset management, and predictions
 */

const express = require('express');
const { body, query, param } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const { mlService } = require('../services/mlService');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for training endpoints
const trainingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 training requests per hour
  message: {
    success: false,
    message: 'Too many training requests, please try again later'
  }
});

// =========================================
// Dataset Management Endpoints
// =========================================

/**
 * @route   GET /api/ml/datasets
 * @desc    Get all available datasets
 * @access  Private
 */
router.get('/datasets', auth, async (req, res) => {
  try {
    const result = await mlService.getDatasets();
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error || 'Failed to fetch datasets'
      });
    }
  } catch (error) {
    console.error('Get datasets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/ml/datasets/:datasetId
 * @desc    Get specific dataset details
 * @access  Private
 */
router.get('/datasets/:datasetId', auth, async (req, res) => {
  try {
    const { datasetId } = req.params;
    const result = await mlService.getDatasetDetails(datasetId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error || 'Dataset not found'
      });
    }
  } catch (error) {
    console.error('Get dataset details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/ml/datasets/download
 * @desc    Download and prepare a dataset for training
 * @access  Private (Admin/Analyst)
 */
router.post('/datasets/download',
  auth,
  authorize('admin', 'analyst'),
  [
    body('datasetId').notEmpty().withMessage('Dataset ID is required')
  ],
  async (req, res) => {
    try {
      const { datasetId, forceRefresh } = req.body;
      const result = await mlService.downloadDataset(datasetId, forceRefresh);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Dataset download initiated',
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Failed to download dataset'
        });
      }
    } catch (error) {
      console.error('Download dataset error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// =========================================
// Model Management Endpoints
// =========================================

/**
 * @route   GET /api/ml/models
 * @desc    Get all available ML models
 * @access  Private
 */
router.get('/models', auth, async (req, res) => {
  try {
    const result = await mlService.getModels();
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error || 'Failed to fetch models'
      });
    }
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/ml/models/:modelId
 * @desc    Get specific model details and metrics
 * @access  Private
 */
router.get('/models/:modelId', auth, async (req, res) => {
  try {
    const { modelId } = req.params;
    const result = await mlService.getModelDetails(modelId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error || 'Model not found'
      });
    }
  } catch (error) {
    console.error('Get model details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// =========================================
// Training Endpoints
// =========================================

/**
 * @route   POST /api/ml/train
 * @desc    Start training a model on a dataset
 * @access  Private (Admin/Analyst)
 */
router.post('/train',
  auth,
  authorize('admin', 'analyst'),
  trainingLimiter,
  [
    body('datasetId').notEmpty().withMessage('Dataset ID is required'),
    body('modelType').optional().isIn([
      'random_forest', 'gradient_boosting', 'neural_network', 
      'deep_learning', 'pytorch_model', 'svm', 'ensemble'
    ]).withMessage('Invalid model type')
  ],
  async (req, res) => {
    try {
      const { datasetId, modelType, hyperparameters, trainAll } = req.body;
      
      const result = await mlService.trainModel({
        datasetId,
        modelType,
        hyperparameters,
        trainAll: trainAll || false,
        userId: req.user.userId
      });
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Training job started',
          data: {
            jobId: result.data.jobId,
            status: 'started',
            estimatedTime: result.data.estimatedTime
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Failed to start training'
        });
      }
    } catch (error) {
      console.error('Train model error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   GET /api/ml/train/status/:jobId
 * @desc    Get training job status
 * @access  Private
 */
router.get('/train/status/:jobId', auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await mlService.getTrainingStatus(jobId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error || 'Training job not found'
      });
    }
  } catch (error) {
    console.error('Get training status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/ml/train/history
 * @desc    Get training history
 * @access  Private
 */
router.get('/train/history', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const result = await mlService.getTrainingHistory(parseInt(limit), parseInt(offset));
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error || 'Failed to fetch training history'
      });
    }
  } catch (error) {
    console.error('Get training history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// =========================================
// Prediction Endpoints
// =========================================

/**
 * @route   POST /api/ml/predict
 * @desc    Make prediction using trained model
 * @access  Private
 */
router.post('/predict',
  auth,
  [
    body('modelId').notEmpty().withMessage('Model ID is required'),
    body('data').notEmpty().withMessage('Input data is required')
  ],
  async (req, res) => {
    try {
      const { modelId, data, context } = req.body;
      
      const result = await mlService.predict({
        modelId,
        data,
        context,
        userId: req.user.userId
      });
      
      if (result.success) {
        res.json({
          success: true,
          data: {
            prediction: result.data.prediction,
            confidence: result.data.confidence,
            modelInfo: result.data.modelInfo,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Prediction failed'
        });
      }
    } catch (error) {
      console.error('Prediction error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   POST /api/ml/predict/batch
 * @desc    Make batch predictions
 * @access  Private (Admin/Analyst)
 */
router.post('/predict/batch',
  auth,
  authorize('admin', 'analyst'),
  [
    body('modelId').notEmpty().withMessage('Model ID is required'),
    body('dataArray').isArray().withMessage('Data array is required')
  ],
  async (req, res) => {
    try {
      const { modelId, dataArray, context } = req.body;
      
      const result = await mlService.batchPredict({
        modelId,
        dataArray,
        context,
        userId: req.user.userId
      });
      
      if (result.success) {
        res.json({
          success: true,
          data: {
            predictions: result.data.predictions,
            summary: result.data.summary,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Batch prediction failed'
        });
      }
    } catch (error) {
      console.error('Batch prediction error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// =========================================
// Threat Detection Endpoints
// =========================================

/**
 * @route   POST /api/ml/detect/malware
 * @desc    Detect malware using ML models
 * @access  Private
 */
router.post('/detect/malware',
  auth,
  [
    body('fileData').notEmpty().withMessage('File data is required')
  ],
  async (req, res) => {
    try {
      const { fileData, filename, hash } = req.body;
      
      const result = await mlService.detectMalware({
        fileData,
        filename,
        hash,
        userId: req.user.userId
      });
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Malware detection failed'
        });
      }
    } catch (error) {
      console.error('Malware detection error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   POST /api/ml/detect/phishing
 * @desc    Detect phishing using ML models
 * @access  Private
 */
router.post('/detect/phishing',
  auth,
  [
    body('url').isURL().withMessage('Valid URL is required')
  ],
  async (req, res) => {
    try {
      const { url, pageContent } = req.body;
      
      const result = await mlService.detectPhishing({
        url,
        pageContent,
        userId: req.user.userId
      });
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Phishing detection failed'
        });
      }
    } catch (error) {
      console.error('Phishing detection error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   POST /api/ml/detect/intrusion
 * @desc    Detect network intrusion using ML models
 * @access  Private (Admin/Analyst)
 */
router.post('/detect/intrusion',
  auth,
  authorize('admin', 'analyst'),
  [
    body('networkData').notEmpty().withMessage('Network data is required')
  ],
  async (req, res) => {
    try {
      const { networkData } = req.body;
      
      const result = await mlService.detectIntrusion({
        networkData,
        userId: req.user.userId
      });
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Intrusion detection failed'
        });
      }
    } catch (error) {
      console.error('Intrusion detection error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   POST /api/ml/detect/anomaly
 * @desc    Detect anomalies in data using ML models
 * @access  Private
 */
router.post('/detect/anomaly',
  auth,
  [
    body('data').notEmpty().withMessage('Data is required')
  ],
  async (req, res) => {
    try {
      const { data, context } = req.body;
      
      const result = await mlService.detectAnomaly({
        data,
        context,
        userId: req.user.userId
      });
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Anomaly detection failed'
        });
      }
    } catch (error) {
      console.error('Anomaly detection error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// =========================================
// Model Metrics & Evaluation
// =========================================

/**
 * @route   GET /api/ml/metrics/:modelId
 * @desc    Get model performance metrics
 * @access  Private
 */
router.get('/metrics/:modelId', auth, async (req, res) => {
  try {
    const { modelId } = req.params;
    const result = await mlService.getModelMetrics(modelId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error || 'Model metrics not found'
      });
    }
  } catch (error) {
    console.error('Get model metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/ml/evaluate
 * @desc    Evaluate model on test data
 * @access  Private (Admin/Analyst)
 */
router.post('/evaluate',
  auth,
  authorize('admin', 'analyst'),
  [
    body('modelId').notEmpty().withMessage('Model ID is required'),
    body('testData').notEmpty().withMessage('Test data is required')
  ],
  async (req, res) => {
    try {
      const { modelId, testData } = req.body;
      
      const result = await mlService.evaluateModel({
        modelId,
        testData,
        userId: req.user.userId
      });
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Model evaluation failed'
        });
      }
    } catch (error) {
      console.error('Evaluate model error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

module.exports = router;
