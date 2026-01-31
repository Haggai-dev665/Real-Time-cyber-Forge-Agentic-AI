/**
 * Child Pages Routes - API endpoints for all sidebar child page components
 * Browser Monitor, Scan Modes, Real-Time Intel, AI Agent, Workspace, etc.
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { mlService } = require('../services/mlService');

const router = express.Router();

// In-memory stores for child page features
const childStores = {
  browserSessions: new Map(),
  browserCookies: new Map(),
  browserStorage: new Map(),
  browserNetwork: new Map(),
  browserConsole: new Map(),
  scans: new Map(),
  scanConfigs: new Map(),
  alerts: new Map(),
  threatFeeds: new Map(),
  aiTasks: new Map(),
  aiModels: new Map(),
  aiTraining: new Map(),
  replayQueue: new Map(),
  notes: new Map(),
  attachments: new Map(),
  teamMembers: new Map(),
  teamActivity: new Map(),
  searchHistory: new Map(),
  bookmarks: new Map()
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// =========================================
// BROWSER MONITOR - SESSIONS
// =========================================

router.get('/browser/sessions', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const sessions = Array.from(childStores.browserSessions.values())
    .filter(s => s.userId === userId);
  
  res.json({ success: true, data: { sessions } });
}));

router.post('/browser/sessions', auth, asyncHandler(async (req, res) => {
  const { name, browser, url } = req.body;
  const session = {
    id: generateId(),
    userId: req.user.userId,
    name,
    browser: browser || 'chrome',
    status: 'active',
    tabs: 1,
    startUrl: url,
    createdAt: new Date().toISOString()
  };
  childStores.browserSessions.set(session.id, session);
  res.status(201).json({ success: true, data: session });
}));

router.delete('/browser/sessions/:id', auth, asyncHandler(async (req, res) => {
  childStores.browserSessions.delete(req.params.id);
  res.json({ success: true, message: 'Session closed' });
}));

// =========================================
// BROWSER MONITOR - COOKIES
// =========================================

router.get('/browser/cookies', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const cookies = Array.from(childStores.browserCookies.values())
    .filter(c => c.userId === userId);
  
  res.json({ success: true, data: { cookies } });
}));

router.post('/browser/cookies', auth, asyncHandler(async (req, res) => {
  const { name, domain, value, httpOnly, secure, sameSite, expires } = req.body;
  const cookie = {
    id: generateId(),
    userId: req.user.userId,
    name,
    domain,
    value,
    httpOnly: httpOnly || false,
    secure: secure || false,
    sameSite: sameSite || 'Lax',
    expires: expires || null,
    createdAt: new Date().toISOString()
  };
  childStores.browserCookies.set(cookie.id, cookie);
  res.status(201).json({ success: true, data: cookie });
}));

router.delete('/browser/cookies', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  childStores.browserCookies.forEach((v, k) => {
    if (v.userId === userId) childStores.browserCookies.delete(k);
  });
  res.json({ success: true, message: 'All cookies cleared' });
}));

// =========================================
// BROWSER MONITOR - STORAGE
// =========================================

router.get('/browser/storage', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { type = 'local' } = req.query;
  
  const storage = Array.from(childStores.browserStorage.values())
    .filter(s => s.userId === userId && s.type === type);
  
  res.json({ success: true, data: { storage, type } });
}));

router.post('/browser/storage', auth, asyncHandler(async (req, res) => {
  const { type, key, value } = req.body;
  const item = {
    id: generateId(),
    userId: req.user.userId,
    type: type || 'local',
    key,
    value,
    size: JSON.stringify(value).length,
    createdAt: new Date().toISOString()
  };
  childStores.browserStorage.set(item.id, item);
  res.status(201).json({ success: true, data: item });
}));

// =========================================
// BROWSER MONITOR - NETWORK
// =========================================

router.get('/browser/network', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { type } = req.query;
  
  let requests = Array.from(childStores.browserNetwork.values())
    .filter(r => r.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (type && type !== 'all') {
    requests = requests.filter(r => r.type === type);
  }
  
  res.json({ success: true, data: { requests } });
}));

router.post('/browser/network', auth, asyncHandler(async (req, res) => {
  const { method, url, status, type, size, time } = req.body;
  const request = {
    id: generateId(),
    userId: req.user.userId,
    method,
    url,
    status,
    type: type || 'xhr',
    size: size || 0,
    time: time || 0,
    timestamp: new Date().toISOString()
  };
  childStores.browserNetwork.set(request.id, request);
  res.status(201).json({ success: true, data: request });
}));

router.delete('/browser/network', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  childStores.browserNetwork.forEach((v, k) => {
    if (v.userId === userId) childStores.browserNetwork.delete(k);
  });
  res.json({ success: true, message: 'Network log cleared' });
}));

// =========================================
// BROWSER MONITOR - CONSOLE
// =========================================

router.get('/browser/console', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { level } = req.query;
  
  let logs = Array.from(childStores.browserConsole.values())
    .filter(l => l.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (level && level !== 'all') {
    logs = logs.filter(l => l.level === level);
  }
  
  res.json({ success: true, data: { logs } });
}));

router.post('/browser/console', auth, asyncHandler(async (req, res) => {
  const { level, message, source } = req.body;
  const log = {
    id: generateId(),
    userId: req.user.userId,
    level: level || 'log',
    message,
    source: source || 'console',
    timestamp: new Date().toISOString()
  };
  childStores.browserConsole.set(log.id, log);
  res.status(201).json({ success: true, data: log });
}));

// =========================================
// SCAN MODES
// =========================================

router.get('/scan/passive', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const config = childStores.scanConfigs.get(`${userId}:passive`) || {
    enabled: true,
    requestsAnalyzed: 0,
    issuesFound: 0,
    infoDisclosures: 0,
    cookieIssues: 0
  };
  
  // Get passive scan rules
  const rules = [
    { name: 'Missing Security Headers', enabled: true, findings: 0 },
    { name: 'Information Disclosure', enabled: true, findings: 0 },
    { name: 'Insecure Cookies', enabled: true, findings: 0 },
    { name: 'Mixed Content', enabled: true, findings: 0 },
    { name: 'Sensitive Data Exposure', enabled: true, findings: 0 }
  ];
  
  res.json({ 
    success: true, 
    data: { 
      ...config, 
      rules,
      recentFindings: []
    } 
  });
}));

router.put('/scan/passive', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const config = { ...req.body, userId, updatedAt: new Date().toISOString() };
  childStores.scanConfigs.set(`${userId}:passive`, config);
  res.json({ success: true, data: config });
}));

router.get('/scan/active', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  
  const active = Array.from(childStores.scans.values())
    .filter(s => s.userId === userId && s.type === 'active' && s.status === 'running');
  
  const history = Array.from(childStores.scans.values())
    .filter(s => s.userId === userId && s.type === 'active' && s.status !== 'running')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20);
  
  res.json({ success: true, data: { active, history } });
}));

router.post('/scan/active', auth, asyncHandler(async (req, res) => {
  const { target, scanType, depth, concurrent } = req.body;
  
  const scan = {
    id: generateId(),
    userId: req.user.userId,
    type: 'active',
    target,
    scanType: scanType || 'full',
    depth: depth || 3,
    concurrent: concurrent || 10,
    status: 'running',
    progress: 0,
    requests: 0,
    findings: 0,
    createdAt: new Date().toISOString()
  };
  
  childStores.scans.set(scan.id, scan);
  
  // Simulate scan progress
  simulateScanProgress(scan.id);
  
  res.status(201).json({ success: true, data: scan });
}));

router.post('/scan/active/:id/stop', auth, asyncHandler(async (req, res) => {
  const scan = childStores.scans.get(req.params.id);
  if (scan) {
    scan.status = 'stopped';
    scan.stoppedAt = new Date().toISOString();
  }
  res.json({ success: true, data: scan });
}));

router.get('/scan/stealth/config', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const config = childStores.scanConfigs.get(`${userId}:stealth`) || {
    delay: 1000,
    jitter: 500,
    maxRequestsPerHour: 100,
    evasionTechniques: {
      userAgentRotation: true,
      ipRotation: false,
      requestRandomization: true,
      payloadEncoding: false
    },
    proxyChain: ['direct', 'tor', 'target']
  };
  res.json({ success: true, data: config });
}));

router.put('/scan/stealth/config', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const config = { ...req.body, userId, updatedAt: new Date().toISOString() };
  childStores.scanConfigs.set(`${userId}:stealth`, config);
  res.json({ success: true, data: config });
}));

router.post('/scan/stealth', auth, asyncHandler(async (req, res) => {
  const { target, duration } = req.body;
  const scan = {
    id: generateId(),
    userId: req.user.userId,
    type: 'stealth',
    target,
    duration: duration || '1h',
    status: 'running',
    progress: 0,
    createdAt: new Date().toISOString()
  };
  childStores.scans.set(scan.id, scan);
  res.status(201).json({ success: true, data: scan });
}));

router.get('/scan/aggressive/config', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const config = childStores.scanConfigs.get(`${userId}:aggressive`) || {
    threads: 50,
    requestRate: 'aggressive',
    timeout: 30,
    attackVectors: ['sqli', 'xss', 'cmdi', 'path-traversal', 'xxe', 'ssrf'],
    payloads: {
      sqli: 2847,
      xss: 1523,
      cmdi: 456,
      pathTraversal: 234
    }
  };
  res.json({ success: true, data: config });
}));

router.post('/scan/aggressive', auth, asyncHandler(async (req, res) => {
  const { target, confirm } = req.body;
  
  if (!confirm) {
    return res.status(400).json({ 
      success: false, 
      message: 'Must confirm authorization for aggressive scan' 
    });
  }
  
  const scan = {
    id: generateId(),
    userId: req.user.userId,
    type: 'aggressive',
    target,
    status: 'running',
    progress: 0,
    requests: 0,
    findings: 0,
    createdAt: new Date().toISOString()
  };
  childStores.scans.set(scan.id, scan);
  res.status(201).json({ success: true, data: scan });
}));

// Helper to simulate scan progress
function simulateScanProgress(scanId) {
  const interval = setInterval(() => {
    const scan = childStores.scans.get(scanId);
    if (!scan || scan.status !== 'running') {
      clearInterval(interval);
      return;
    }
    
    scan.progress = Math.min(100, scan.progress + Math.random() * 5);
    scan.requests += Math.floor(Math.random() * 20);
    
    if (Math.random() > 0.8) {
      scan.findings += 1;
    }
    
    if (scan.progress >= 100) {
      scan.status = 'completed';
      scan.completedAt = new Date().toISOString();
      clearInterval(interval);
    }
  }, 2000);
}

// =========================================
// REAL-TIME INTEL - THREAT MAP
// =========================================

router.get('/threats/map', auth, asyncHandler(async (req, res) => {
  const { range = '24h' } = req.query;
  
  // Call ML service for threat data
  let mlData = null;
  try {
    const mlHealth = await mlService.checkHealth();
    if (mlHealth.available) {
      mlData = await mlService.getThreatMap({ range });
    }
  } catch (e) {
    console.log('ML service not available for threat map');
  }
  
  const threats = mlData?.data?.threats || [
    { id: 1, type: 'DDoS', source: 'Russia', target: 'US', severity: 'critical', timestamp: new Date() },
    { id: 2, type: 'Brute Force', source: 'China', target: 'Germany', severity: 'high', timestamp: new Date() },
    { id: 3, type: 'Malware', source: 'Brazil', target: 'UK', severity: 'medium', timestamp: new Date() }
  ];
  
  const stats = mlData?.data?.stats || {
    activeAttacks: 127,
    highRisk: 45,
    blocked: 892
  };
  
  res.json({ success: true, data: { threats, stats } });
}));

// =========================================
// REAL-TIME INTEL - LIVE FEEDS
// =========================================

router.get('/threats/feeds', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  let feeds = Array.from(childStores.threatFeeds.values())
    .filter(f => f.userId === userId);
  
  if (feeds.length === 0) {
    // Default feeds
    feeds = [
      { id: '1', name: 'AlienVault OTX', url: 'https://otx.alienvault.com', type: 'IOC', status: 'active', indicators: 15234, enabled: true, lastUpdate: new Date() },
      { id: '2', name: 'URLhaus', url: 'https://urlhaus.abuse.ch', type: 'Malware URLs', status: 'active', indicators: 8721, enabled: true, lastUpdate: new Date() },
      { id: '3', name: 'Feodo Tracker', url: 'https://feodotracker.abuse.ch', type: 'Botnet C2', status: 'active', indicators: 2345, enabled: true, lastUpdate: new Date() }
    ];
  }
  
  res.json({ success: true, data: { feeds } });
}));

router.post('/threats/feeds', auth, asyncHandler(async (req, res) => {
  const { name, url, type, interval } = req.body;
  const feed = {
    id: generateId(),
    userId: req.user.userId,
    name,
    url,
    type,
    interval: interval || '1h',
    status: 'active',
    indicators: 0,
    enabled: true,
    createdAt: new Date().toISOString(),
    lastUpdate: new Date().toISOString()
  };
  childStores.threatFeeds.set(feed.id, feed);
  res.status(201).json({ success: true, data: feed });
}));

router.put('/threats/feeds/:id', auth, asyncHandler(async (req, res) => {
  const feed = childStores.threatFeeds.get(req.params.id);
  if (!feed) {
    return res.status(404).json({ success: false, message: 'Feed not found' });
  }
  Object.assign(feed, req.body, { updatedAt: new Date().toISOString() });
  res.json({ success: true, data: feed });
}));

router.delete('/threats/feeds/:id', auth, asyncHandler(async (req, res) => {
  childStores.threatFeeds.delete(req.params.id);
  res.json({ success: true, message: 'Feed deleted' });
}));

// =========================================
// REAL-TIME INTEL - ALERTS
// =========================================

router.get('/alerts', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { severity, status } = req.query;
  
  let alerts = Array.from(childStores.alerts.values())
    .filter(a => a.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (severity && severity !== 'all') {
    alerts = alerts.filter(a => a.severity === severity);
  }
  
  // Add default alerts if none exist
  if (alerts.length === 0) {
    alerts = [
      { id: '1', title: 'SQL Injection Detected', description: 'Multiple SQL injection attempts detected', severity: 'critical', category: 'Attack', read: false, source: 'WAF', timestamp: new Date() },
      { id: '2', title: 'Brute Force Attack', description: 'Over 100 failed login attempts', severity: 'high', category: 'Authentication', read: false, source: 'IDS', timestamp: new Date() }
    ];
  }
  
  res.json({ success: true, data: { alerts } });
}));

router.post('/alerts/:id/acknowledge', auth, asyncHandler(async (req, res) => {
  const alert = childStores.alerts.get(req.params.id);
  if (alert) {
    alert.read = true;
    alert.acknowledgedAt = new Date().toISOString();
  }
  res.json({ success: true, data: alert });
}));

router.post('/alerts/:id/dismiss', auth, asyncHandler(async (req, res) => {
  childStores.alerts.delete(req.params.id);
  res.json({ success: true, message: 'Alert dismissed' });
}));

router.post('/alerts/mark-all-read', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  childStores.alerts.forEach(a => {
    if (a.userId === userId) a.read = true;
  });
  res.json({ success: true, message: 'All alerts marked as read' });
}));

// =========================================
// AI AGENT
// =========================================

router.get('/ai/agent/status', auth, asyncHandler(async (req, res) => {
  // Check ML service health
  let mlStatus = { available: false };
  try {
    mlStatus = await mlService.checkHealth();
  } catch (e) {
    console.log('ML service not available');
  }
  
  const userId = req.user.userId;
  const tasks = Array.from(childStores.aiTasks.values())
    .filter(t => t.userId === userId);
  
  const status = {
    running: mlStatus.available,
    activeModels: mlStatus.available ? 4 : 0,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    threatsDetected: tasks.filter(t => t.type === 'threat').length,
    uptime: mlStatus.available ? '4h 23m' : '0m',
    lastActivity: new Date().toISOString(),
    activityLog: [
      { time: new Date(), action: 'System check completed', type: 'info' },
      { time: new Date(Date.now() - 60000), action: 'Analyzed 5 requests', type: 'analysis' }
    ]
  };
  
  res.json({ success: true, data: status });
}));

router.post('/ai/agent/start', auth, asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'AI Agent started' });
}));

router.post('/ai/agent/stop', auth, asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'AI Agent stopped' });
}));

router.get('/ai/agent/tasks', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { status } = req.query;
  
  let tasks = Array.from(childStores.aiTasks.values())
    .filter(t => t.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  if (status && status !== 'all') {
    tasks = tasks.filter(t => t.status === status);
  }
  
  res.json({ success: true, data: { tasks } });
}));

router.post('/ai/agent/tasks', auth, asyncHandler(async (req, res) => {
  const { name, type, target, priority } = req.body;
  
  const task = {
    id: generateId(),
    userId: req.user.userId,
    name,
    type: type || 'analysis',
    target,
    priority: priority || 'normal',
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString()
  };
  
  childStores.aiTasks.set(task.id, task);
  
  // Send to ML service for processing
  try {
    const mlHealth = await mlService.checkHealth();
    if (mlHealth.available) {
      task.status = 'running';
      mlService.submitTask(task).catch(e => console.error('ML task error:', e));
    }
  } catch (e) {
    console.log('ML service not available for task');
  }
  
  res.status(201).json({ success: true, data: task });
}));

router.get('/ai/agent/threats', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  
  // Get threats from ML service
  let threats = [];
  try {
    const mlHealth = await mlService.checkHealth();
    if (mlHealth.available) {
      const result = await mlService.getDetectedThreats();
      threats = result?.data || [];
    }
  } catch (e) {
    console.log('ML service not available for threats');
  }
  
  // Add default threats if none
  if (threats.length === 0) {
    threats = [
      { id: '1', type: 'SQL Injection', target: '/api/users', severity: 'critical', confidence: 0.95, status: 'pending', detectedAt: new Date() },
      { id: '2', type: 'XSS', target: '/search', severity: 'high', confidence: 0.87, status: 'pending', detectedAt: new Date() }
    ];
  }
  
  res.json({ success: true, data: { threats } });
}));

router.post('/ai/agent/threats/:id/action', auth, asyncHandler(async (req, res) => {
  const { action } = req.body; // investigate, confirm, dismiss
  res.json({ success: true, message: `Threat ${action}ed` });
}));

router.get('/ai/agent/learning', auth, asyncHandler(async (req, res) => {
  // Get learning stats from ML service
  let learningData = null;
  try {
    const mlHealth = await mlService.checkHealth();
    if (mlHealth.available) {
      learningData = await mlService.getLearningStats();
    }
  } catch (e) {
    console.log('ML service not available for learning stats');
  }
  
  const data = learningData?.data || {
    totalSamples: 15420,
    todayLearned: 342,
    accuracy: 0.94,
    modelPerformance: [
      { name: 'SQL Injection', accuracy: 0.96 },
      { name: 'XSS Detection', accuracy: 0.93 },
      { name: 'Anomaly Detection', accuracy: 0.89 },
      { name: 'Malware Classification', accuracy: 0.91 }
    ],
    feedback: { positive: 1245, negative: 78, pending: 23 }
  };
  
  res.json({ success: true, data });
}));

router.get('/ai/agent/settings', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const settings = childStores.aiModels.get(`${userId}:settings`) || {
    autoAnalysis: true,
    analysisThreshold: 0.75,
    aiProvider: 'gemini',
    enableNotifications: true,
    realtimeMonitoring: true
  };
  res.json({ success: true, data: settings });
}));

router.put('/ai/agent/settings', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const settings = { ...req.body, userId, updatedAt: new Date().toISOString() };
  childStores.aiModels.set(`${userId}:settings`, settings);
  res.json({ success: true, data: settings });
}));

// =========================================
// AI MODELS
// =========================================

router.get('/ai/models', auth, asyncHandler(async (req, res) => {
  // Get models from ML service
  let models = [];
  try {
    const mlHealth = await mlService.checkHealth();
    if (mlHealth.available) {
      const result = await mlService.getAvailableModels();
      models = result?.data || [];
    }
  } catch (e) {
    console.log('ML service not available for models');
  }
  
  if (models.length === 0) {
    models = [
      { id: '1', name: 'Anomaly Detection', type: 'autoencoder', status: 'active', accuracy: 0.94, enabled: true },
      { id: '2', name: 'SQL Injection Detector', type: 'transformer', status: 'active', accuracy: 0.96, enabled: true },
      { id: '3', name: 'XSS Scanner', type: 'cnn', status: 'active', accuracy: 0.93, enabled: true },
      { id: '4', name: 'Malware Classifier', type: 'lstm', status: 'training', accuracy: 0.89, enabled: false }
    ];
  }
  
  res.json({ success: true, data: { models } });
}));

router.put('/ai/models/:id', auth, asyncHandler(async (req, res) => {
  const { enabled, threshold } = req.body;
  res.json({ success: true, data: { id: req.params.id, enabled, threshold } });
}));

router.get('/ai/models/config', auth, asyncHandler(async (req, res) => {
  const config = {
    defaultThreshold: 0.75,
    maxConcurrentModels: 4,
    gpuEnabled: false,
    autoRetrain: true,
    retrainInterval: '7d'
  };
  res.json({ success: true, data: config });
}));

router.get('/ai/models/training', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const jobs = Array.from(childStores.aiTraining.values())
    .filter(j => j.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ success: true, data: { jobs } });
}));

router.post('/ai/models/training', auth, asyncHandler(async (req, res) => {
  const { modelId, dataset, epochs } = req.body;
  
  const job = {
    id: generateId(),
    userId: req.user.userId,
    modelId,
    dataset,
    epochs: epochs || 50,
    status: 'running',
    progress: 0,
    currentEpoch: 0,
    loss: null,
    accuracy: null,
    createdAt: new Date().toISOString()
  };
  
  childStores.aiTraining.set(job.id, job);
  
  // Start training via ML service
  try {
    const mlHealth = await mlService.checkHealth();
    if (mlHealth.available) {
      mlService.startTraining(job).catch(e => console.error('Training error:', e));
    }
  } catch (e) {
    console.log('ML service not available for training');
  }
  
  res.status(201).json({ success: true, data: job });
}));

// =========================================
// REPLAY
// =========================================

router.get('/replay/queue', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const queue = Array.from(childStores.replayQueue.values())
    .filter(r => r.userId === userId && !r.completed)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ success: true, data: { queue } });
}));

router.post('/replay/queue', auth, asyncHandler(async (req, res) => {
  const { requestId, modifications } = req.body;
  
  const replay = {
    id: generateId(),
    userId: req.user.userId,
    requestId,
    modifications: modifications || {},
    completed: false,
    createdAt: new Date().toISOString()
  };
  
  childStores.replayQueue.set(replay.id, replay);
  res.status(201).json({ success: true, data: replay });
}));

router.get('/replay/history', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const history = Array.from(childStores.replayQueue.values())
    .filter(r => r.userId === userId && r.completed)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  
  res.json({ success: true, data: { history } });
}));

// =========================================
// WORKSPACE - NOTES
// =========================================

router.get('/workspace/notes', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const notes = Array.from(childStores.notes.values())
    .filter(n => n.userId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  
  res.json({ success: true, data: { notes } });
}));

router.post('/workspace/notes', auth, asyncHandler(async (req, res) => {
  const { title, content, tags } = req.body;
  const note = {
    id: generateId(),
    userId: req.user.userId,
    title,
    content,
    tags: tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  childStores.notes.set(note.id, note);
  res.status(201).json({ success: true, data: note });
}));

router.put('/workspace/notes/:id', auth, asyncHandler(async (req, res) => {
  const note = childStores.notes.get(req.params.id);
  if (!note) {
    return res.status(404).json({ success: false, message: 'Note not found' });
  }
  Object.assign(note, req.body, { updatedAt: new Date().toISOString() });
  res.json({ success: true, data: note });
}));

router.delete('/workspace/notes/:id', auth, asyncHandler(async (req, res) => {
  childStores.notes.delete(req.params.id);
  res.json({ success: true, message: 'Note deleted' });
}));

// =========================================
// WORKSPACE - ATTACHMENTS
// =========================================

router.get('/workspace/attachments', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const attachments = Array.from(childStores.attachments.values())
    .filter(a => a.userId === userId)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  
  res.json({ success: true, data: { attachments } });
}));

router.post('/workspace/attachments', auth, asyncHandler(async (req, res) => {
  const { name, type, size, url } = req.body;
  const attachment = {
    id: generateId(),
    userId: req.user.userId,
    name,
    type,
    size,
    url,
    uploadedAt: new Date().toISOString()
  };
  childStores.attachments.set(attachment.id, attachment);
  res.status(201).json({ success: true, data: attachment });
}));

router.delete('/workspace/attachments/:id', auth, asyncHandler(async (req, res) => {
  childStores.attachments.delete(req.params.id);
  res.json({ success: true, message: 'Attachment deleted' });
}));

// =========================================
// TEAM
// =========================================

router.get('/team/members', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  let members = Array.from(childStores.teamMembers.values())
    .filter(m => m.ownerId === userId || m.userId === userId);
  
  if (members.length === 0) {
    members = [
      { id: '1', name: 'You', email: req.user.email || 'user@example.com', role: 'Owner', status: 'active' }
    ];
  }
  
  res.json({ success: true, data: { members } });
}));

router.post('/team/members/invite', auth, asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  const member = {
    id: generateId(),
    ownerId: req.user.userId,
    email,
    role: role || 'viewer',
    status: 'pending',
    invitedAt: new Date().toISOString()
  };
  childStores.teamMembers.set(member.id, member);
  res.status(201).json({ success: true, data: member });
}));

router.get('/team/activity', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const activities = Array.from(childStores.teamActivity.values())
    .filter(a => a.teamOwnerId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 50);
  
  res.json({ success: true, data: { activities } });
}));

// =========================================
// SEARCH
// =========================================

router.get('/search/history', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const history = Array.from(childStores.searchHistory.values())
    .filter(s => s.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100);
  
  res.json({ success: true, data: { history } });
}));

router.post('/search/history', auth, asyncHandler(async (req, res) => {
  const { query, filters, results } = req.body;
  const search = {
    id: generateId(),
    userId: req.user.userId,
    query,
    filters: filters || {},
    results: results || 0,
    timestamp: new Date().toISOString()
  };
  childStores.searchHistory.set(search.id, search);
  res.status(201).json({ success: true, data: search });
}));

router.get('/search/bookmarks', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const bookmarks = Array.from(childStores.bookmarks.values())
    .filter(b => b.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ success: true, data: { bookmarks } });
}));

router.post('/search/bookmarks', auth, asyncHandler(async (req, res) => {
  const { requestId, name, notes } = req.body;
  const bookmark = {
    id: generateId(),
    userId: req.user.userId,
    requestId,
    name,
    notes: notes || '',
    createdAt: new Date().toISOString()
  };
  childStores.bookmarks.set(bookmark.id, bookmark);
  res.status(201).json({ success: true, data: bookmark });
}));

router.delete('/search/bookmarks/:id', auth, asyncHandler(async (req, res) => {
  childStores.bookmarks.delete(req.params.id);
  res.json({ success: true, message: 'Bookmark deleted' });
}));

module.exports = router;
