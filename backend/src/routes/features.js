/**
 * Features Routes - Comprehensive CRUD for all desktop app features
 * HTTP Requests, Intercepts, Match Rules, Automations, Workflows, etc.
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const mongoose = require('mongoose');

const router = express.Router();

// In-memory stores for features (replace with MongoDB models in production)
const stores = {
  requests: new Map(),
  intercepts: new Map(),
  matchRules: new Map(),
  automations: new Map(),
  workflows: new Map(),
  findings: new Map(),
  scopes: new Map(),
  filters: new Map(),
  plugins: new Map(),
  exports: new Map(),
  environment: new Map(),
  sitemaps: new Map()
};

// Helper to generate IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper for user-specific keys
const userKey = (userId, id) => `${userId}:${id}`;

// =========================================
// HTTP REQUESTS / HISTORY
// =========================================

router.get('/requests', auth, asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, host, method, status } = req.query;
  const userId = req.user.userId;
  
  let requests = Array.from(stores.requests.values())
    .filter(r => r.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Apply filters
  if (host) requests = requests.filter(r => r.host.includes(host));
  if (method) requests = requests.filter(r => r.method === method);
  if (status) requests = requests.filter(r => r.status === parseInt(status));
  
  const total = requests.length;
  const startIndex = (page - 1) * limit;
  requests = requests.slice(startIndex, startIndex + parseInt(limit));
  
  res.json({
    success: true,
    data: {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  });
}));

router.get('/requests/:requestId', auth, asyncHandler(async (req, res) => {
  const request = stores.requests.get(req.params.requestId);
  if (!request || request.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  res.json({ success: true, data: request });
}));

router.post('/requests', auth, asyncHandler(async (req, res) => {
  const { host, method, path, query, headers, body: reqBody, scheme = 'https' } = req.body;
  
  const request = {
    id: generateId(),
    userId: req.user.userId,
    host,
    method: method || 'GET',
    path: path || '/',
    query: query || '',
    headers: headers || [],
    body: reqBody || '',
    scheme,
    status: null,
    response: null,
    timestamp: new Date().toISOString()
  };
  
  stores.requests.set(request.id, request);
  
  res.status(201).json({ success: true, data: request });
}));

router.post('/requests/:requestId/replay', auth, asyncHandler(async (req, res) => {
  const original = stores.requests.get(req.params.requestId);
  if (!original || original.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  
  const { modifications = {} } = req.body;
  
  // Create replay request
  const replay = {
    id: generateId(),
    userId: req.user.userId,
    ...original,
    ...modifications,
    originalId: original.id,
    timestamp: new Date().toISOString(),
    isReplay: true
  };
  
  // Simulate making the request (in production, actually make the HTTP request)
  replay.status = 200;
  replay.response = { headers: {}, body: 'Replayed successfully' };
  
  stores.requests.set(replay.id, replay);
  
  res.json({ success: true, data: replay });
}));

router.delete('/requests/:requestId', auth, asyncHandler(async (req, res) => {
  const request = stores.requests.get(req.params.requestId);
  if (!request || request.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  stores.requests.delete(req.params.requestId);
  res.json({ success: true, message: 'Request deleted' });
}));

// =========================================
// INTERCEPTS
// =========================================

router.get('/intercepts', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const intercepts = Array.from(stores.intercepts.values())
    .filter(i => i.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  res.json({ success: true, data: { intercepts } });
}));

router.get('/intercepts/settings', auth, asyncHandler(async (req, res) => {
  const settings = stores.environment.get(`${req.user.userId}:intercept_settings`) || {
    enabled: true,
    interceptRequests: true,
    interceptResponses: false,
    urlPatterns: ['*'],
    excludePatterns: []
  };
  res.json({ success: true, data: settings });
}));

router.put('/intercepts/settings', auth, asyncHandler(async (req, res) => {
  const settings = req.body;
  stores.environment.set(`${req.user.userId}:intercept_settings`, settings);
  res.json({ success: true, data: settings });
}));

router.post('/intercepts/:interceptId/forward', auth, asyncHandler(async (req, res) => {
  const intercept = stores.intercepts.get(req.params.interceptId);
  if (!intercept || intercept.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Intercept not found' });
  }
  
  intercept.action = 'forwarded';
  intercept.forwardedAt = new Date().toISOString();
  Object.assign(intercept, req.body.modifications || {});
  
  // Move to requests history
  stores.requests.set(intercept.id, { ...intercept, status: 200 });
  stores.intercepts.delete(req.params.interceptId);
  
  res.json({ success: true, data: intercept });
}));

router.delete('/intercepts/:interceptId', auth, asyncHandler(async (req, res) => {
  const intercept = stores.intercepts.get(req.params.interceptId);
  if (!intercept || intercept.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Intercept not found' });
  }
  stores.intercepts.delete(req.params.interceptId);
  res.json({ success: true, message: 'Intercept dropped' });
}));

router.post('/intercepts/forward-all', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  let count = 0;
  
  stores.intercepts.forEach((intercept, id) => {
    if (intercept.userId === userId) {
      stores.requests.set(id, { ...intercept, status: 200, action: 'forwarded' });
      stores.intercepts.delete(id);
      count++;
    }
  });
  
  res.json({ success: true, message: `Forwarded ${count} intercepts` });
}));

router.delete('/intercepts/all', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  let count = 0;
  
  stores.intercepts.forEach((intercept, id) => {
    if (intercept.userId === userId) {
      stores.intercepts.delete(id);
      count++;
    }
  });
  
  res.json({ success: true, message: `Dropped ${count} intercepts` });
}));

// =========================================
// MATCH & REPLACE RULES
// =========================================

router.get('/match-rules', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const rules = Array.from(stores.matchRules.values())
    .filter(r => r.userId === userId)
    .sort((a, b) => a.order - b.order);
  
  res.json({ success: true, data: { rules } });
}));

router.post('/match-rules', auth, [
  body('type').isIn(['replace', 'match', 'remove']),
  body('match').notEmpty(),
  body('target').optional()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  const { type, match, replace, target = 'all', enabled = true } = req.body;
  
  const existingRules = Array.from(stores.matchRules.values())
    .filter(r => r.userId === req.user.userId);
  
  const rule = {
    id: generateId(),
    userId: req.user.userId,
    type,
    match,
    replace: replace || '',
    target,
    enabled,
    order: existingRules.length,
    createdAt: new Date().toISOString()
  };
  
  stores.matchRules.set(rule.id, rule);
  
  res.status(201).json({ success: true, data: rule });
}));

router.put('/match-rules/:ruleId', auth, asyncHandler(async (req, res) => {
  const rule = stores.matchRules.get(req.params.ruleId);
  if (!rule || rule.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Rule not found' });
  }
  
  Object.assign(rule, req.body, { updatedAt: new Date().toISOString() });
  
  res.json({ success: true, data: rule });
}));

router.delete('/match-rules/:ruleId', auth, asyncHandler(async (req, res) => {
  const rule = stores.matchRules.get(req.params.ruleId);
  if (!rule || rule.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Rule not found' });
  }
  stores.matchRules.delete(req.params.ruleId);
  res.json({ success: true, message: 'Rule deleted' });
}));

router.put('/match-rules/:ruleId/toggle', auth, asyncHandler(async (req, res) => {
  const rule = stores.matchRules.get(req.params.ruleId);
  if (!rule || rule.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Rule not found' });
  }
  rule.enabled = req.body.enabled;
  res.json({ success: true, data: rule });
}));

// =========================================
// AUTOMATIONS
// =========================================

router.get('/automations', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const automations = Array.from(stores.automations.values())
    .filter(a => a.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ success: true, data: { automations } });
}));

router.post('/automations', auth, [
  body('name').notEmpty(),
  body('trigger').isObject(),
  body('actions').isArray()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  const { name, description, trigger, actions, enabled = true } = req.body;
  
  const automation = {
    id: generateId(),
    userId: req.user.userId,
    name,
    description: description || '',
    trigger,
    actions,
    enabled,
    status: 'idle',
    lastRun: null,
    runCount: 0,
    createdAt: new Date().toISOString()
  };
  
  stores.automations.set(automation.id, automation);
  
  res.status(201).json({ success: true, data: automation });
}));

router.put('/automations/:automationId', auth, asyncHandler(async (req, res) => {
  const automation = stores.automations.get(req.params.automationId);
  if (!automation || automation.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Automation not found' });
  }
  
  Object.assign(automation, req.body, { updatedAt: new Date().toISOString() });
  
  res.json({ success: true, data: automation });
}));

router.delete('/automations/:automationId', auth, asyncHandler(async (req, res) => {
  const automation = stores.automations.get(req.params.automationId);
  if (!automation || automation.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Automation not found' });
  }
  stores.automations.delete(req.params.automationId);
  res.json({ success: true, message: 'Automation deleted' });
}));

router.post('/automations/:automationId/run', auth, asyncHandler(async (req, res) => {
  const automation = stores.automations.get(req.params.automationId);
  if (!automation || automation.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Automation not found' });
  }
  
  automation.status = 'running';
  automation.lastRun = new Date().toISOString();
  automation.runCount++;
  
  // Simulate automation run
  setTimeout(() => {
    automation.status = 'completed';
  }, 2000);
  
  res.json({ success: true, data: automation, message: 'Automation started' });
}));

router.post('/automations/:automationId/pause', auth, asyncHandler(async (req, res) => {
  const automation = stores.automations.get(req.params.automationId);
  if (!automation || automation.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Automation not found' });
  }
  
  automation.status = 'paused';
  
  res.json({ success: true, data: automation });
}));

router.get('/automations/:automationId/logs', auth, asyncHandler(async (req, res) => {
  const automation = stores.automations.get(req.params.automationId);
  if (!automation || automation.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Automation not found' });
  }
  
  // Return simulated logs
  const logs = [
    { timestamp: new Date().toISOString(), level: 'info', message: 'Automation started' },
    { timestamp: new Date().toISOString(), level: 'info', message: 'Trigger conditions met' },
    { timestamp: new Date().toISOString(), level: 'success', message: 'Actions completed' }
  ];
  
  res.json({ success: true, data: { logs } });
}));

// =========================================
// WORKFLOWS
// =========================================

router.get('/workflows', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const workflows = Array.from(stores.workflows.values())
    .filter(w => w.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ success: true, data: { workflows } });
}));

router.post('/workflows', auth, [
  body('name').notEmpty(),
  body('steps').isArray()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  const { name, description, steps, enabled = true } = req.body;
  
  const workflow = {
    id: generateId(),
    userId: req.user.userId,
    name,
    description: description || '',
    steps,
    enabled,
    lastRun: null,
    runCount: 0,
    createdAt: new Date().toISOString()
  };
  
  stores.workflows.set(workflow.id, workflow);
  
  res.status(201).json({ success: true, data: workflow });
}));

router.put('/workflows/:workflowId', auth, asyncHandler(async (req, res) => {
  const workflow = stores.workflows.get(req.params.workflowId);
  if (!workflow || workflow.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Workflow not found' });
  }
  
  Object.assign(workflow, req.body, { updatedAt: new Date().toISOString() });
  
  res.json({ success: true, data: workflow });
}));

router.delete('/workflows/:workflowId', auth, asyncHandler(async (req, res) => {
  const workflow = stores.workflows.get(req.params.workflowId);
  if (!workflow || workflow.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Workflow not found' });
  }
  stores.workflows.delete(req.params.workflowId);
  res.json({ success: true, message: 'Workflow deleted' });
}));

router.post('/workflows/:workflowId/run', auth, asyncHandler(async (req, res) => {
  const workflow = stores.workflows.get(req.params.workflowId);
  if (!workflow || workflow.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Workflow not found' });
  }
  
  const runId = generateId();
  workflow.lastRun = new Date().toISOString();
  workflow.runCount++;
  
  res.json({ 
    success: true, 
    data: { 
      runId, 
      workflowId: workflow.id,
      status: 'running',
      startedAt: workflow.lastRun 
    } 
  });
}));

router.get('/workflows/:workflowId/runs', auth, asyncHandler(async (req, res) => {
  const workflow = stores.workflows.get(req.params.workflowId);
  if (!workflow || workflow.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Workflow not found' });
  }
  
  res.json({ success: true, data: { runs: [] } });
}));

// =========================================
// FINDINGS
// =========================================

router.get('/findings', auth, asyncHandler(async (req, res) => {
  const { severity, status, page = 1, limit = 50 } = req.query;
  const userId = req.user.userId;
  
  let findings = Array.from(stores.findings.values())
    .filter(f => f.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  if (severity) findings = findings.filter(f => f.severity === severity);
  if (status) findings = findings.filter(f => f.status === status);
  
  const total = findings.length;
  findings = findings.slice((page - 1) * limit, page * limit);
  
  res.json({ success: true, data: { findings, total } });
}));

router.post('/findings', auth, [
  body('title').notEmpty(),
  body('severity').isIn(['low', 'medium', 'high', 'critical'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  const { title, severity, description, path, evidence, requestId } = req.body;
  
  const finding = {
    id: generateId(),
    userId: req.user.userId,
    title,
    severity,
    description: description || '',
    path: path || '',
    evidence: evidence || '',
    requestId: requestId || null,
    status: 'open',
    createdAt: new Date().toISOString()
  };
  
  stores.findings.set(finding.id, finding);
  
  res.status(201).json({ success: true, data: finding });
}));

router.put('/findings/:findingId', auth, asyncHandler(async (req, res) => {
  const finding = stores.findings.get(req.params.findingId);
  if (!finding || finding.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Finding not found' });
  }
  
  Object.assign(finding, req.body, { updatedAt: new Date().toISOString() });
  
  res.json({ success: true, data: finding });
}));

router.delete('/findings/:findingId', auth, asyncHandler(async (req, res) => {
  const finding = stores.findings.get(req.params.findingId);
  if (!finding || finding.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Finding not found' });
  }
  stores.findings.delete(req.params.findingId);
  res.json({ success: true, message: 'Finding deleted' });
}));

router.post('/findings/:findingId/resolve', auth, asyncHandler(async (req, res) => {
  const finding = stores.findings.get(req.params.findingId);
  if (!finding || finding.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Finding not found' });
  }
  
  finding.status = 'resolved';
  finding.resolution = req.body.resolution || '';
  finding.resolvedAt = new Date().toISOString();
  
  res.json({ success: true, data: finding });
}));

// =========================================
// SCOPES
// =========================================

router.get('/scopes', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const scopes = Array.from(stores.scopes.values())
    .filter(s => s.userId === userId);
  
  res.json({ success: true, data: { scopes } });
}));

router.post('/scopes', auth, [
  body('pattern').notEmpty(),
  body('type').isIn(['include', 'exclude'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  const { pattern, type, description } = req.body;
  
  const scope = {
    id: generateId(),
    userId: req.user.userId,
    pattern,
    type,
    description: description || '',
    enabled: true,
    requestCount: 0,
    createdAt: new Date().toISOString()
  };
  
  stores.scopes.set(scope.id, scope);
  
  res.status(201).json({ success: true, data: scope });
}));

router.put('/scopes/:scopeId', auth, asyncHandler(async (req, res) => {
  const scope = stores.scopes.get(req.params.scopeId);
  if (!scope || scope.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Scope not found' });
  }
  
  Object.assign(scope, req.body);
  
  res.json({ success: true, data: scope });
}));

router.delete('/scopes/:scopeId', auth, asyncHandler(async (req, res) => {
  const scope = stores.scopes.get(req.params.scopeId);
  if (!scope || scope.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Scope not found' });
  }
  stores.scopes.delete(req.params.scopeId);
  res.json({ success: true, message: 'Scope deleted' });
}));

// =========================================
// FILTERS
// =========================================

router.get('/filters', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const filters = Array.from(stores.filters.values())
    .filter(f => f.userId === userId);
  
  res.json({ success: true, data: { filters } });
}));

router.post('/filters', auth, [
  body('name').notEmpty(),
  body('conditions').isArray()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  const { name, description, conditions } = req.body;
  
  const filter = {
    id: generateId(),
    userId: req.user.userId,
    name,
    description: description || '',
    conditions,
    enabled: true,
    createdAt: new Date().toISOString()
  };
  
  stores.filters.set(filter.id, filter);
  
  res.status(201).json({ success: true, data: filter });
}));

router.put('/filters/:filterId', auth, asyncHandler(async (req, res) => {
  const filter = stores.filters.get(req.params.filterId);
  if (!filter || filter.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Filter not found' });
  }
  
  Object.assign(filter, req.body);
  
  res.json({ success: true, data: filter });
}));

router.delete('/filters/:filterId', auth, asyncHandler(async (req, res) => {
  const filter = stores.filters.get(req.params.filterId);
  if (!filter || filter.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Filter not found' });
  }
  stores.filters.delete(req.params.filterId);
  res.json({ success: true, message: 'Filter deleted' });
}));

router.put('/filters/:filterId/toggle', auth, asyncHandler(async (req, res) => {
  const filter = stores.filters.get(req.params.filterId);
  if (!filter || filter.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Filter not found' });
  }
  filter.enabled = req.body.enabled;
  res.json({ success: true, data: filter });
}));

// =========================================
// PLUGINS
// =========================================

const pluginStore = [
  { id: 'auto-exploit', name: 'Auto Exploit', version: '2.1.0', author: 'CyberForge', description: 'Automatically suggests and runs exploits', category: 'security' },
  { id: 'jwt-decoder', name: 'JWT Decoder', version: '1.5.2', author: 'CyberForge', description: 'Decode and analyze JWT tokens', category: 'utility' },
  { id: 'sql-scanner', name: 'SQL Injection Scanner', version: '3.0.1', author: 'CyberForge', description: 'Detect SQL injection vulnerabilities', category: 'security' },
  { id: 'xss-hunter', name: 'XSS Hunter', version: '2.3.0', author: 'CyberForge', description: 'Find and exploit XSS vulnerabilities', category: 'security' },
  { id: 'api-fuzzer', name: 'API Fuzzer', version: '1.2.0', author: 'CyberForge', description: 'Fuzz API endpoints', category: 'testing' }
];

router.get('/plugins', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const installed = Array.from(stores.plugins.values())
    .filter(p => p.userId === userId);
  
  res.json({ success: true, data: { plugins: installed } });
}));

router.get('/plugins/store', auth, asyncHandler(async (req, res) => {
  res.json({ success: true, data: { plugins: pluginStore } });
}));

router.post('/plugins/install', auth, asyncHandler(async (req, res) => {
  const { pluginId } = req.body;
  const storePlugin = pluginStore.find(p => p.id === pluginId);
  
  if (!storePlugin) {
    return res.status(404).json({ success: false, message: 'Plugin not found in store' });
  }
  
  const plugin = {
    ...storePlugin,
    id: generateId(),
    pluginId: storePlugin.id,
    userId: req.user.userId,
    enabled: true,
    installedAt: new Date().toISOString()
  };
  
  stores.plugins.set(plugin.id, plugin);
  
  res.status(201).json({ success: true, data: plugin });
}));

router.delete('/plugins/:pluginId', auth, asyncHandler(async (req, res) => {
  const plugin = stores.plugins.get(req.params.pluginId);
  if (!plugin || plugin.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Plugin not found' });
  }
  stores.plugins.delete(req.params.pluginId);
  res.json({ success: true, message: 'Plugin uninstalled' });
}));

router.put('/plugins/:pluginId/toggle', auth, asyncHandler(async (req, res) => {
  const plugin = stores.plugins.get(req.params.pluginId);
  if (!plugin || plugin.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Plugin not found' });
  }
  plugin.enabled = req.body.enabled;
  res.json({ success: true, data: plugin });
}));

// =========================================
// EXPORTS
// =========================================

router.get('/exports', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const exports = Array.from(stores.exports.values())
    .filter(e => e.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ success: true, data: { exports } });
}));

router.post('/exports', auth, [
  body('name').notEmpty(),
  body('format').isIn(['pdf', 'json', 'har', 'csv', 'html'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  const { name, format, filters, includeRequests, includeFindings } = req.body;
  
  const exportItem = {
    id: generateId(),
    userId: req.user.userId,
    name,
    format,
    filters: filters || {},
    includeRequests: includeRequests !== false,
    includeFindings: includeFindings !== false,
    status: 'processing',
    size: null,
    downloadUrl: null,
    createdAt: new Date().toISOString()
  };
  
  stores.exports.set(exportItem.id, exportItem);
  
  // Simulate export generation
  setTimeout(() => {
    exportItem.status = 'completed';
    exportItem.size = Math.floor(Math.random() * 10000000) + 100000;
    exportItem.downloadUrl = `/api/exports/${exportItem.id}/download`;
  }, 2000);
  
  res.status(201).json({ success: true, data: exportItem });
}));

router.get('/exports/:exportId/download', auth, asyncHandler(async (req, res) => {
  const exportItem = stores.exports.get(req.params.exportId);
  if (!exportItem || exportItem.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Export not found' });
  }
  
  if (exportItem.status !== 'completed') {
    return res.status(400).json({ success: false, message: 'Export not ready' });
  }
  
  // In production, stream the actual file
  res.json({ success: true, message: 'Download would start here', data: exportItem });
}));

router.delete('/exports/:exportId', auth, asyncHandler(async (req, res) => {
  const exportItem = stores.exports.get(req.params.exportId);
  if (!exportItem || exportItem.userId !== req.user.userId) {
    return res.status(404).json({ success: false, message: 'Export not found' });
  }
  stores.exports.delete(req.params.exportId);
  res.json({ success: true, message: 'Export deleted' });
}));

// =========================================
// ENVIRONMENT VARIABLES
// =========================================

router.get('/environment', auth, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const variables = [];
  
  stores.environment.forEach((value, key) => {
    if (key.startsWith(`${userId}:env:`)) {
      variables.push(value);
    }
  });
  
  res.json({ success: true, data: { variables } });
}));

router.post('/environment', auth, [
  body('key').notEmpty(),
  body('value').exists()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  const { key, value, scope = 'session' } = req.body;
  
  const variable = {
    id: generateId(),
    userId: req.user.userId,
    key,
    value,
    scope,
    createdAt: new Date().toISOString()
  };
  
  stores.environment.set(`${req.user.userId}:env:${key}`, variable);
  
  res.status(201).json({ success: true, data: variable });
}));

router.delete('/environment/:key', auth, asyncHandler(async (req, res) => {
  const storeKey = `${req.user.userId}:env:${req.params.key}`;
  if (!stores.environment.has(storeKey)) {
    return res.status(404).json({ success: false, message: 'Variable not found' });
  }
  stores.environment.delete(storeKey);
  res.json({ success: true, message: 'Variable deleted' });
}));

// =========================================
// SITEMAP
// =========================================

router.get('/sitemap/:domain', auth, asyncHandler(async (req, res) => {
  const domain = decodeURIComponent(req.params.domain);
  const sitemap = stores.sitemaps.get(`${req.user.userId}:${domain}`);
  
  if (!sitemap) {
    return res.json({ success: true, data: { domain, nodes: [] } });
  }
  
  res.json({ success: true, data: sitemap });
}));

router.post('/sitemap/build', auth, [
  body('domain').notEmpty()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  const { domain, depth = 3 } = req.body;
  
  // Build sitemap from captured requests
  const requests = Array.from(stores.requests.values())
    .filter(r => r.userId === req.user.userId && r.host.includes(domain));
  
  const paths = new Set();
  requests.forEach(r => {
    const parts = r.path.split('/').filter(Boolean);
    let currentPath = '';
    parts.forEach(part => {
      currentPath += '/' + part;
      paths.add(currentPath);
    });
  });
  
  const nodes = Array.from(paths).map(path => ({
    path,
    requests: requests.filter(r => r.path.startsWith(path)).length,
    methods: [...new Set(requests.filter(r => r.path === path).map(r => r.method))]
  }));
  
  const sitemap = {
    domain,
    nodes,
    builtAt: new Date().toISOString()
  };
  
  stores.sitemaps.set(`${req.user.userId}:${domain}`, sitemap);
  
  res.json({ success: true, data: sitemap });
}));

module.exports = router;
