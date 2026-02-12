/**
 * Datadog Configuration
 * Observability and metrics tracking for system health
 */

const tracer = require('dd-trace');

// Datadog configuration
const DATADOG_CONFIG = {
  enabled: process.env.DATADOG_ENABLED === 'true',
  apiKey: process.env.DATADOG_API_KEY || '',
  serviceName: process.env.DATADOG_SERVICE_NAME || 'cyberforge-backend',
  env: process.env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || '1.0.0',
  hostname: process.env.HOSTNAME || 'localhost',
  
  // Agent configuration
  agentHost: process.env.DATADOG_AGENT_HOST || 'localhost',
  agentPort: parseInt(process.env.DATADOG_AGENT_PORT || '8126', 10),
  
  // Logging
  logLevel: process.env.DATADOG_LOG_LEVEL || 'info',
  
  // Profiling
  profiling: process.env.DATADOG_PROFILING === 'true',
  
  // Runtime metrics
  runtimeMetrics: process.env.DATADOG_RUNTIME_METRICS !== 'false'
};

/**
 * Initialize Datadog tracer
 */
function initializeDatadog() {
  if (!DATADOG_CONFIG.enabled) {
    console.log('⚠️  Datadog is disabled');
    return null;
  }

  try {
    tracer.init({
      service: DATADOG_CONFIG.serviceName,
      env: DATADOG_CONFIG.env,
      version: DATADOG_CONFIG.version,
      hostname: DATADOG_CONFIG.hostname,
      logInjection: true,
      analytics: true,
      runtimeMetrics: DATADOG_CONFIG.runtimeMetrics,
      profiling: DATADOG_CONFIG.profiling,
      
      // Agent configuration
      url: `http://${DATADOG_CONFIG.agentHost}:${DATADOG_CONFIG.agentPort}`,
      
      // Enable debug mode in development
      debug: DATADOG_CONFIG.env === 'development',
      
      // Log level
      logLevel: DATADOG_CONFIG.logLevel
    });

    console.log('✅ Datadog tracer initialized');
    return tracer;
  } catch (error) {
    console.error('❌ Failed to initialize Datadog tracer:', error);
    return null;
  }
}

module.exports = {
  DATADOG_CONFIG,
  initializeDatadog,
  tracer
};
