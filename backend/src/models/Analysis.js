/**
 * Analysis Model
 * Stores security analysis results
 */

const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  analysisId: {
    type: String,
    required: true,
    unique: true,
    default: () => `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  type: {
    type: String,
    required: true,
    enum: ['url', 'file', 'network', 'email', 'domain', 'ip', 'hash']
  },
  target: {
    value: {
      type: String,
      required: true
    },
    hash: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  results: {
    safe: {
      type: Boolean,
      default: null
    },
    risk_score: {
      type: Number,
      min: 0,
      max: 10,
      default: 0
    },
    threat_types: [String],
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    details: mongoose.Schema.Types.Mixed
  },
  engines: [{
    name: String,
    version: String,
    result: String,
    confidence: Number,
    processing_time: Number
  }],
  ml_models: [{
    name: String,
    version: String,
    prediction: String,
    confidence: Number,
    features_used: [String]
  }],
  processing: {
    started_at: Date,
    completed_at: Date,
    processing_time: Number,
    worker_id: String
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  source: {
    type: String,
    enum: ['desktop_app', 'mobile_app', 'api', 'manual'],
    required: true
  },
  context: {
    user_agent: String,
    referrer: String,
    session_id: String,
    ip_address: String
  },
  reputation: {
    known_good: Boolean,
    known_bad: Boolean,
    first_seen: Date,
    last_seen: Date,
    frequency: Number
  },
  external_checks: [{
    service: String,
    result: String,
    details: mongoose.Schema.Types.Mixed,
    checked_at: Date
  }],
  tags: [String],
  notes: String
}, {
  timestamps: true
});

// Index for efficient queries
analysisSchema.index({ 'target.value': 1 });
analysisSchema.index({ type: 1, status: 1 });
analysisSchema.index({ user: 1, createdAt: -1 });
analysisSchema.index({ 'results.risk_score': -1 });
analysisSchema.index({ createdAt: -1 });

// Virtual for overall status
analysisSchema.virtual('isComplete').get(function() {
  return this.status === 'completed';
});

// Method to start processing
analysisSchema.methods.startProcessing = function(workerId) {
  this.status = 'processing';
  this.processing.started_at = new Date();
  this.processing.worker_id = workerId;
  return this.save();
};

// Method to complete analysis
analysisSchema.methods.completeAnalysis = function(results) {
  this.status = 'completed';
  this.processing.completed_at = new Date();
  this.processing.processing_time = this.processing.completed_at - this.processing.started_at;
  this.results = { ...this.results, ...results };
  return this.save();
};

// Method to fail analysis
analysisSchema.methods.failAnalysis = function(error) {
  this.status = 'failed';
  this.processing.completed_at = new Date();
  this.results.details = { error: error.message };
  return this.save();
};

// Method to add engine result
analysisSchema.methods.addEngineResult = function(engineName, version, result, confidence, processingTime) {
  this.engines.push({
    name: engineName,
    version,
    result,
    confidence,
    processing_time: processingTime
  });
  return this.save();
};

// Method to add ML model result
analysisSchema.methods.addMLResult = function(modelName, version, prediction, confidence, features) {
  this.ml_models.push({
    name: modelName,
    version,
    prediction,
    confidence,
    features_used: features
  });
  return this.save();
};

const Analysis = mongoose.model('Analysis', analysisSchema);

module.exports = Analysis;