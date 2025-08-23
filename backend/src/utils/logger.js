/**
 * Logging utility for the Cyber Forge AI backend
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    // Create logs directory if it doesn't exist
    this.logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Format log message
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
  }

  /**
   * Write log to file
   */
  writeToFile(level, message, meta = {}) {
    const formattedMessage = this.formatMessage(level, message, meta);
    const logFile = path.join(this.logsDir, `${level}.log`);
    const allLogFile = path.join(this.logsDir, 'all.log');
    
    try {
      // Write to level-specific log file
      fs.appendFileSync(logFile, formattedMessage + '\n');
      
      // Write to combined log file
      fs.appendFileSync(allLogFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Check if log level should be logged
   */
  shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  /**
   * Log error message
   */
  error(message, meta = {}) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
      this.writeToFile('error', message, meta);
    }
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
      this.writeToFile('warn', message, meta);
    }
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta));
      this.writeToFile('info', message, meta);
    }
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, meta));
      this.writeToFile('debug', message, meta);
    }
  }

  /**
   * Log activity with specific formatting
   */
  logActivity(level, message, meta = {}) {
    const activityMeta = {
      ...meta,
      type: 'activity',
      timestamp: new Date().toISOString()
    };

    switch (level) {
      case 'error':
        this.error(message, activityMeta);
        break;
      case 'warn':
        this.warn(message, activityMeta);
        break;
      case 'info':
        this.info(message, activityMeta);
        break;
      case 'debug':
        this.debug(message, activityMeta);
        break;
      default:
        this.info(message, activityMeta);
    }
  }

  /**
   * Log HTTP request
   */
  logRequest(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`
    };

    const message = `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`;
    this.info(message, meta);
  }

  /**
   * Log WebSocket event
   */
  logWebSocket(event, clientId, data = {}) {
    const meta = {
      event,
      clientId,
      ...data
    };

    this.info(`WebSocket ${event}`, meta);
  }

  /**
   * Log security event
   */
  logSecurity(event, details = {}) {
    const meta = {
      type: 'security',
      event,
      ...details
    };

    this.warn(`Security event: ${event}`, meta);
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = {
  logActivity: (level, message, meta) => logger.logActivity(level, message, meta),
  logRequest: (req, res, responseTime) => logger.logRequest(req, res, responseTime),
  logWebSocket: (event, clientId, data) => logger.logWebSocket(event, clientId, data),
  logSecurity: (event, details) => logger.logSecurity(event, details),
  error: (message, meta) => logger.error(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  info: (message, meta) => logger.info(message, meta),
  debug: (message, meta) => logger.debug(message, meta)
};
