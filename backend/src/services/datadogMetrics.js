/**
 * Datadog Metrics Service
 * Handles all metrics reporting for observability
 */

const { StatsD } = require('hot-shots');
const { DATADOG_CONFIG } = require('../config/datadog.config');
const logger = require('../utils/logger');

class DatadogMetricsService {
  constructor() {
    this.client = null;
    this.isEnabled = DATADOG_CONFIG.enabled;
  }

  /**
   * Initialize Datadog StatsD client
   */
  initialize() {
    if (!this.isEnabled) {
      logger.info('⚠️  Datadog metrics disabled');
      return;
    }

    try {
      this.client = new StatsD({
        host: DATADOG_CONFIG.agentHost,
        port: DATADOG_CONFIG.agentPort,
        prefix: `${DATADOG_CONFIG.serviceName}.`,
        globalTags: [
          `env:${DATADOG_CONFIG.env}`,
          `version:${DATADOG_CONFIG.version}`,
          `service:${DATADOG_CONFIG.serviceName}`
        ],
        errorHandler: (error) => {
          logger.error('Datadog StatsD error:', error);
        }
      });

      logger.info('✅ Datadog metrics service initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize Datadog metrics:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Record agent heartbeat latency
   */
  recordAgentHeartbeat(agentId, latencyMs, tags = {}) {
    if (!this.isEnabled || !this.client) return;
    
    this.client.timing('agent.heartbeat.latency', latencyMs, {
      agentId,
      ...tags
    });
    
    this.client.increment('agent.heartbeat.count', 1, {
      agentId,
      ...tags
    });
  }

  /**
   * Record scan duration
   */
  recordScanDuration(taskId, durationMs, success = true, tags = {}) {
    if (!this.isEnabled || !this.client) return;
    
    this.client.timing('scan.duration', durationMs, {
      taskId,
      success: success.toString(),
      ...tags
    });
    
    this.client.increment('scan.count', 1, {
      taskId,
      success: success.toString(),
      ...tags
    });
  }

  /**
   * Record scraper API call
   */
  recordScraperApiCall(url, durationMs, success = true, tags = {}) {
    if (!this.isEnabled || !this.client) return;
    
    this.client.timing('scraper.api.duration', durationMs, {
      success: success.toString(),
      ...tags
    });
    
    this.client.increment('scraper.api.calls', 1, {
      success: success.toString(),
      ...tags
    });
  }

  /**
   * Record ML inference time
   */
  recordMlInference(modelName, durationMs, success = true, tags = {}) {
    if (!this.isEnabled || !this.client) return;
    
    this.client.timing('ml.inference.duration', durationMs, {
      model: modelName,
      success: success.toString(),
      ...tags
    });
    
    this.client.increment('ml.inference.count', 1, {
      model: modelName,
      success: success.toString(),
      ...tags
    });
  }

  /**
   * Record Gemini API usage
   */
  recordGeminiUsage(durationMs, tokenCount = 0, success = true, tags = {}) {
    if (!this.isEnabled || !this.client) return;
    
    this.client.timing('gemini.api.duration', durationMs, {
      success: success.toString(),
      ...tags
    });
    
    this.client.increment('gemini.api.calls', 1, {
      success: success.toString(),
      ...tags
    });
    
    if (tokenCount > 0) {
      this.client.gauge('gemini.tokens.used', tokenCount, tags);
    }
  }

  /**
   * Record error
   */
  recordError(errorType, component, tags = {}) {
    if (!this.isEnabled || !this.client) return;
    
    this.client.increment('errors.count', 1, {
      error_type: errorType,
      component,
      ...tags
    });
  }

  /**
   * Record retry attempt
   */
  recordRetry(operation, attempt, tags = {}) {
    if (!this.isEnabled || !this.client) return;
    
    this.client.increment('retries.count', 1, {
      operation,
      attempt: attempt.toString(),
      ...tags
    });
  }

  /**
   * Record alert creation
   */
  recordAlert(severity, alertType, tags = {}) {
    if (!this.isEnabled || !this.client) return;
    
    this.client.increment('alerts.created', 1, {
      severity,
      alert_type: alertType,
      ...tags
    });
  }

  /**
   * Record agent state change
   */
  recordAgentStateChange(agentId, fromState, toState, tags = {}) {
    if (!this.isEnabled || !this.client) return;
    
    this.client.increment('agent.state.changes', 1, {
      agentId,
      from_state: fromState,
      to_state: toState,
      ...tags
    });
  }

  /**
   * Record gauge metric (current value)
   */
  recordGauge(metricName, value, tags = {}) {
    if (!this.isEnabled || !this.client) return;
    
    this.client.gauge(metricName, value, tags);
  }

  /**
   * Increment counter
   */
  incrementCounter(metricName, value = 1, tags = {}) {
    if (!this.isEnabled || !this.client) return;
    
    this.client.increment(metricName, value, tags);
  }

  /**
   * Record timing
   */
  recordTiming(metricName, durationMs, tags = {}) {
    if (!this.isEnabled || !this.client) return;
    
    this.client.timing(metricName, durationMs, tags);
  }

  /**
   * Close the client
   */
  close() {
    if (this.client) {
      this.client.close();
    }
  }
}

// Singleton instance
const datadogMetrics = new DatadogMetricsService();

module.exports = { DatadogMetricsService, datadogMetrics };
