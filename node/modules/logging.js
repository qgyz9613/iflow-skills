/**
 * iFlow Logging Module
 * 整合自 OpenClaw 项目的结构化日志功能
 * 分级日志、文件管理、敏感信息脱敏
 */

const fs = require('fs').promises;
const path = require('path');

// ==================== 日志级别 ====================

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

const LOG_LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

/**
 * 获取日志级别数值
 */
function getLogLevelValue(level) {
  if (typeof level === 'number') {
    return level;
  }
  if (typeof level === 'string') {
    return LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
  }
  return LOG_LEVELS.INFO;
}

/**
 * 检查是否应该记录日志
 */
function shouldLog(level, minLevel = LOG_LEVELS.INFO) {
  const levelValue = getLogLevelValue(level);
  const minValue = getLogLevelValue(minLevel);
  return levelValue >= minValue;
}

// ==================== 时间戳格式化 ====================

/**
 * 格式化时间戳
 */
function formatTimestamp(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// ==================== 敏感信息脱敏 ====================

/**
 * 敏感信息模式
 */
const SENSITIVE_PATTERNS = [
  { name: 'password', pattern: /password["']?\s*[:=]\s*["']?([^"'\s,}]+)/gi },
  { name: 'api_key', pattern: /api[_-]?key["']?\s*[:=]\s*["']?([^"'\s,}]+)/gi },
  { name: 'token', pattern: /token["']?\s*[:=]\s*["']?([^"'\s,}]+)/gi },
  { name: 'secret', pattern: /secret["']?\s*[:=]\s*["']?([^"'\s,}]+)/gi },
  { name: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
  { name: 'phone', pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g },
  { name: 'credit_card', pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g }
];

/**
 * 脱敏日志内容
 */
function redactSensitiveInfo(message) {
  if (typeof message !== 'string') {
    return message;
  }

  let redacted = message;

  for (const { name, pattern } of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, (match, capture) => {
      if (name === 'email') {
        return match.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      } else if (name === 'phone') {
        return match.replace(/(\d{3})[\s.-]?(\d{3})[\s.-]?(\d{4})/, '$1-***-$3');
      } else if (name === 'credit_card') {
        return match.replace(/(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})/, '$1-****-****-$4');
      } else {
        return match.replace(capture, '***');
      }
    });
  }

  return redacted;
}

/**
 * 脱敏对象
 */
function redactObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sensitiveKeys = ['password', 'api_key', 'apikey', 'token', 'secret', 'email', 'phone', 'credit_card'];
  const redacted = {};

  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = sensitiveKeys.some(sk => key.toLowerCase().includes(sk));

    if (isSensitive && typeof value === 'string') {
      redacted[key] = '***';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactObject(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

// ==================== 日志格式化 ====================

/**
 * 格式化日志消息
 */
function formatLogEntry(level, message, context = {}) {
  const timestamp = formatTimestamp();
  const levelName = LOG_LEVEL_NAMES[level] || 'INFO';
  const redactedMessage = redactSensitiveInfo(String(message));
  const redactedContext = redactObject(context);

  const entry = {
    timestamp,
    level: levelName,
    message: redactedMessage,
    context: redactedContext
  };

  return entry;
}

/**
 * 格式化为文本
 */
function formatAsText(entry) {
  const { timestamp, level, message, context } = entry;
  let text = `[${timestamp}] [${level}] ${message}`;

  if (Object.keys(context).length > 0) {
    text += ` ${JSON.stringify(context)}`;
  }

  return text;
}

/**
 * 格式化为 JSON
 */
function formatAsJson(entry) {
  return JSON.stringify(entry);
}

// ==================== Logger 类 ====================

class Logger {
  constructor(options = {}) {
    this.options = {
      level: options.level || LOG_LEVELS.INFO,
      enableConsole: options.enableConsole !== false,
      enableFile: options.enableFile || false,
      logDir: options.logDir || path.join(process.env.HOME || process.env.USERPROFILE || '.', '.iflow', 'logs'),
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: options.maxFiles || 5,
      subsystem: options.subsystem || 'default',
      ...options
    };

    this.currentLogFile = null;
    this.currentFileSize = 0;
  }

  /**
   * 初始化 Logger
   */
  async initialize() {
    if (this.options.enableFile) {
      try {
        await fs.mkdir(this.options.logDir, { recursive: true });
        await this.rotateLogFile();
      } catch (err) {
        console.error('Failed to initialize logger:', err.message);
      }
    }
  }

  /**
   * 获取当前日志文件路径
   */
  getCurrentLogFilePath() {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    return path.join(this.options.logDir, `${this.options.subsystem}-${dateStr}.log`);
  }

  /**
   * 轮换日志文件
   */
  async rotateLogFile() {
    if (!this.options.enableFile) {
      return;
    }

    const currentPath = this.getCurrentLogFilePath();

    try {
      const stats = await fs.stat(currentPath);
      if (stats.size >= this.options.maxFileSize) {
        // 重命名旧文件
        const timestamp = Date.now();
        const archivePath = currentPath.replace('.log', `-${timestamp}.log`);
        await fs.rename(currentPath, archivePath);

        // 清理旧日志
        await this.cleanupOldLogs();
      }

      this.currentLogFile = currentPath;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      this.currentLogFile = currentPath;
    }
  }

  /**
   * 清理旧日志
   */
  async cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.options.logDir);
      const logFiles = files
        .filter(f => f.startsWith(`${this.options.subsystem}-`) && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.options.logDir, f),
          mtime: 0
        }));

      // 获取修改时间
      for (const file of logFiles) {
        const stats = await fs.stat(file.path);
        file.mtime = stats.mtime.getTime();
      }

      // 按时间排序
      logFiles.sort((a, b) => b.mtime - a.mtime);

      // 删除超过限制的文件
      const filesToDelete = logFiles.slice(this.options.maxFiles);
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
      }
    } catch (err) {
      console.warn('Failed to cleanup old logs:', err.message);
    }
  }

  /**
   * 记录日志
   */
  async log(level, message, context = {}) {
    const levelValue = getLogLevelValue(level);

    if (!shouldLog(levelValue, this.options.level)) {
      return;
    }

    const entry = formatLogEntry(levelValue, message, context);

    // 控制台输出
    if (this.options.enableConsole) {
      const text = formatAsText(entry);
      console.log(text);
    }

    // 文件输出
    if (this.options.enableFile) {
      await this.writeToFile(entry);
    }
  }

  /**
   * 写入文件
   */
  async writeToFile(entry) {
    if (!this.currentLogFile) {
      return;
    }

    try {
      const text = formatAsText(entry) + '\n';
      await fs.appendFile(this.currentLogFile, text);

      // 检查文件大小
      const stats = await fs.stat(this.currentLogFile);
      if (stats.size >= this.options.maxFileSize) {
        await this.rotateLogFile();
      }
    } catch (err) {
      console.error('Failed to write log:', err.message);
    }
  }

  /**
   * DEBUG 级别
   */
  debug(message, context) {
    return this.log(LOG_LEVELS.DEBUG, message, context);
  }

  /**
   * INFO 级别
   */
  info(message, context) {
    return this.log(LOG_LEVELS.INFO, message, context);
  }

  /**
   * WARN 级别
   */
  warn(message, context) {
    return this.log(LOG_LEVELS.WARN, message, context);
  }

  /**
   * ERROR 级别
   */
  error(message, context) {
    return this.log(LOG_LEVELS.ERROR, message, context);
  }

  /**
   * FATAL 级别
   */
  fatal(message, context) {
    return this.log(LOG_LEVELS.FATAL, message, context);
  }
}

// ==================== 全局 Logger 实例 ====================

let globalLogger = null;

/**
 * 获取全局 Logger 实例
 */
function getLogger() {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

/**
 * 设置全局 Logger 实例
 */
function setLogger(logger) {
  globalLogger = logger;
}

/**
 * 创建子系统 Logger
 */
function createSubsystemLogger(subsystem, options = {}) {
  return new Logger({
    ...options,
    subsystem
  });
}

// ==================== 便捷函数 ====================

const logger = getLogger();

function debug(message, context) {
  return logger.debug(message, context);
}

function info(message, context) {
  return logger.info(message, context);
}

function warn(message, context) {
  return logger.warn(message, context);
}

function error(message, context) {
  return logger.error(message, context);
}

function fatal(message, context) {
  return logger.fatal(message, context);
}

// ==================== 导出 ====================

module.exports = {
  // 日志级别
  LOG_LEVELS,
  LOG_LEVEL_NAMES,
  getLogLevelValue,
  shouldLog,

  // 时间戳
  formatTimestamp,

  // 脱敏
  redactSensitiveInfo,
  redactObject,

  // 格式化
  formatLogEntry,
  formatAsText,
  formatAsJson,

  // Logger 类
  Logger,

  // 全局实例
  getLogger,
  setLogger,
  createSubsystemLogger,

  // 便捷函数
  debug,
  info,
  warn,
  error,
  fatal
};