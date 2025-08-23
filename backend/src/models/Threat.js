/**
 * Threat Model
 * Defines threats detected by the system
 */

const mongoose = require('mongoose');

const threatSchema = new mongoose.Schema({
  threatId: {
    type: String,
    required: true,
    unique: true,
    default: () => `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  type: {
    type: String,
    required: true,
    enum: [
      'malware',
      'phishing',
      'suspicious_url',
      'network_intrusion',
      'data_breach',
      'ddos',
      'social_engineering',
      'insider_threat',
      'vulnerability',
      'anomaly'
    ]
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['detected', 'investigating', 'confirmed', 'mitigated', 'false_positive'],
    default: 'detected'
  },
  source: {
    url: String,
    ip: String,
    domain: String,
    userAgent: String,
    referrer: String
  },
  detection: {
    timestamp: {
      type: Date,
      default: Date.now
    },
    method: {
      type: String,
      enum: ['ml_model', 'signature', 'behavioral', 'heuristic', 'manual'],
      required: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      required: true
    },
    model_version: String,
    rules_matched: [String]
  },
  description: {
    type: String,
    required: true
  },
  details: {
    malware_family: String,
    attack_vector: String,
    payload: String,
    indicators: [String],
    artifacts: [{
      type: String,
      value: String,
      hash: String
    }]
  },
  impact: {
    affected_systems: [String],
    data_at_risk: String,
    business_impact: String,
    estimated_cost: Number
  },
  mitigation: {
    recommended_actions: [String],
    implemented_actions: [String],
    mitigated_at: Date,
    mitigated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  analysis: {
    analyst_assigned: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    analysis_started: Date,
    analysis_completed: Date,
    notes: String,
    tags: [String]
  },
  geo_location: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  timeline: [{
    timestamp: Date,
    event: String,
    details: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
threatSchema.index({ type: 1, severity: 1 });
threatSchema.index({ 'detection.timestamp': -1 });
threatSchema.index({ status: 1 });
threatSchema.index({ 'source.domain': 1 });
threatSchema.index({ 'source.ip': 1 });

// Virtual for threat score
threatSchema.virtual('threatScore').get(function() {
  const severityScores = { low: 1, medium: 3, high: 7, critical: 10 };
  return severityScores[this.severity] * this.detection.confidence;
});

// Method to add timeline event
threatSchema.methods.addTimelineEvent = function(event, details, user) {
  this.timeline.push({
    timestamp: new Date(),
    event,
    details,
    user
  });
  return this.save();
};

// Method to update status
threatSchema.methods.updateStatus = function(newStatus, user, notes) {
  this.status = newStatus;
  this.addTimelineEvent(`Status changed to ${newStatus}`, notes, user);
  
  if (newStatus === 'mitigated') {
    this.mitigation.mitigated_at = new Date();
    this.mitigation.mitigated_by = user;
  }
  
  return this.save();
};

const Threat = mongoose.model('Threat', threatSchema);

module.exports = Threat;