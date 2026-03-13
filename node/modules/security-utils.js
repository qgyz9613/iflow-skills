/**
 * iFlow Security Utils Module
 * 整合自 OpenClaw 项目的安全工具
 * 提供路径守卫、执行安全检查、输入验证等功能
 */

const path = require('path');
const os = require('os');

// ==================== 路径守卫 ====================

/**
 * 检查路径是否为绝对路径
 * @param {string} target - 目标路径
 * @returns {boolean}
 */
function isAbsolutePath(target) {
  if (!target || typeof target !== 'string') {
    return false;
  }
  if (process.platform === 'win32') {
    return /^[A-Za-z]:[/\\]/.test(target) || target.startsWith('\\\\');
  }
  return target.startsWith('/');
}

/**
 * 检查路径是否包含路径遍历
 * @param {string} target - 目标路径
 * @returns {boolean}
 */
function hasPathTraversal(target) {
  if (!target || typeof target !== 'string') {
    return false;
  }
  return target.includes('..') || target.includes('~');
}

/**
 * 检查路径是否为危险路径
 * @param {string} target - 目标路径
 * @returns {boolean}
 */
function isDangerousPath(target) {
  if (!target || typeof target !== 'string') {
    return false;
  }
  const dangerous = [
    '/dev/null',
    '/dev/random',
    '/dev/urandom',
    '/proc',
    '/sys',
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'LPT1',
    'LPT2',
    'LPT3'
  ];
  const normalized = path.normalize(target).toUpperCase();
  return dangerous.some(d => normalized.includes(d.toUpperCase()));
}

/**
 * 验证路径安全性
 * @param {string} root - 根目录
 * @param {string} target - 目标路径
 * @returns {Object} 验证结果
 */
function validatePath(root, target) {
  if (!target || typeof target !== 'string') {
    return { safe: false, reason: 'Invalid target path' };
  }

  if (hasPathTraversal(target)) {
    return { safe: false, reason: 'Path contains traversal characters' };
  }

  if (isDangerousPath(target)) {
    return { safe: false, reason: 'Path is dangerous' };
  }

  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);

  if (!isPathInside(resolvedRoot, resolvedTarget)) {
    return { safe: false, reason: 'Path is outside root directory' };
  }

  return { safe: true, path: resolvedTarget };
}

// ==================== 执行安全检查 ====================

const SHELL_METACHARS = /[;&|`$<>]/;
const CONTROL_CHARS = /[\r\n]/;
const QUOTE_CHARS = /["']/;
const BARE_NAME_PATTERN = /^[A-Za-z0-9._+-]+$/;

/**
 * 检查字符串是否像路径
 * @param {string} value - 输入值
 * @returns {boolean}
 */
function isLikelyPath(value) {
  if (value.startsWith('.') || value.startsWith('~')) {
    return true;
  }
  if (value.includes('/') || value.includes('\\')) {
    return true;
  }
  return /^[A-Za-z]:[\\/]/.test(value);
}

/**
 * 检查是否为安全的可执行值
 * @param {string} value - 输入值
 * @returns {boolean}
 */
function isSafeExecutableValue(value) {
  if (typeof value !== 'string' || !value) {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.includes('\0')) {
    return false;
  }
  if (CONTROL_CHARS.test(trimmed)) {
    return false;
  }
  if (SHELL_METACHARS.test(trimmed)) {
    return false;
  }
  if (QUOTE_CHARS.test(trimmed)) {
    return false;
  }

  if (isLikelyPath(trimmed)) {
    return true;
  }
  if (trimmed.startsWith('-')) {
    return false;
  }
  return BARE_NAME_PATTERN.test(trimmed);
}

/**
 * 检查命令参数是否安全
 * @param {Array<string>} argv - 参数数组
 * @returns {Object} 验证结果
 */
function validateCommandArgs(argv) {
  if (!Array.isArray(argv) || argv.length === 0) {
    return { safe: false, reason: 'Invalid arguments' };
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== 'string') {
      return { safe: false, reason: `Argument ${i} is not a string` };
    }
    if (!isSafeExecutableValue(arg)) {
      return { safe: false, reason: `Argument ${i} is unsafe: ${arg}` };
    }
  }

  return { safe: true };
}

/**
 * 净化输入字符串
 * @param {string} input - 输入字符串
 * @param {Object} options - 选项
 * @param {boolean} options.allowQuotes - 是否允许引号
 * @param {boolean} options.allowSpecialChars - 是否允许特殊字符
 * @returns {string} 净化后的字符串
 */
function sanitizeInput(input, options = {}) {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // 移除空字节
  sanitized = sanitized.replace(/\0/g, '');

  // 移除控制字符（可选）
  if (!options.allowSpecialChars) {
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  }

  // 移除危险元字符（可选）
  if (!options.allowQuotes) {
    sanitized = sanitized.replace(/[;&|`$<>"']/g, '');
  }

  return sanitized;
}

// ==================== 输入验证 ====================

/**
 * 检查是否为有效的文件名
 * @param {string} filename - 文件名
 * @returns {boolean}
 */
function isValidFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  // Windows 禁止的字符
  const windowsInvalid = /[<>:"|?*]/;
  if (windowsInvalid.test(filename)) {
    return false;
  }

  // 禁止的文件名
  const forbidden = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];

  const nameWithoutExt = path.parse(filename).name.toUpperCase();
  if (forbidden.includes(nameWithoutExt)) {
    return false;
  }

  // 不能以点开头（隐藏文件）或空格
  if (filename.startsWith('.') || filename.startsWith(' ')) {
    return false;
  }

  // 不能以空格结尾
  if (filename.endsWith(' ')) {
    return false;
  }

  return true;
}

/**
 * 检查是否为有效的 JSON
 * @param {string} str - JSON 字符串
 * @returns {boolean}
 */
function isValidJson(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查是否为有效的整数
 * @param {any} value - 输入值
 * @param {Object} options - 选项
 * @param {number} options.min - 最小值
 * @param {number} options.max - 最大值
 * @returns {boolean}
 */
function isValidInteger(value, options = {}) {
  const num = Number(value);
  if (!Number.isInteger(num)) {
    return false;
  }
  if (options.min !== undefined && num < options.min) {
    return false;
  }
  if (options.max !== undefined && num > options.max) {
    return false;
  }
  return true;
}

/**
 * 检查是否为有效的端口号
 * @param {any} value - 输入值
 * @returns {boolean}
 */
function isValidPort(value) {
  return isValidInteger(value, { min: 1, max: 65535 });
}

/**
 * 检查是否为安全的正则表达式
 * @param {string} pattern - 正则表达式字符串
 * @returns {boolean}
 */
function isSafeRegExp(pattern) {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

// ==================== 原型污染防护 ====================

/**
 * 检查键是否为危险的键（可能导致原型污染）
 * @param {string} key - 键名
 * @returns {boolean}
 */
function isDangerousKey(key) {
  const dangerous = ['__proto__', 'prototype', 'constructor'];
  return dangerous.includes(key);
}

/**
 * 净化对象键（移除危险的键）
 * @param {Object} obj - 对象
 * @returns {Object} 净化后的对象
 */
function sanitizeObjectKeys(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result = Array.isArray(obj) ? [] : {};

  for (const key of Object.keys(obj)) {
    if (!isDangerousKey(key)) {
      result[key] = sanitizeObjectKeys(obj[key]);
    }
  }

  return result;
}

// ==================== 速率限制 ====================

class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 10;
    this.windowMs = options.windowMs || 60000; // 默认 1 分钟
    this.requests = new Map();
  }

  /**
   * 检查是否允许请求
   * @param {string} key - 标识键
   * @returns {boolean}
   */
  check(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // 获取当前键的请求记录
    let record = this.requests.get(key);
    if (!record) {
      record = { count: 0, timestamps: [] };
      this.requests.set(key, record);
    }

    // 清理过期的记录
    record.timestamps = record.timestamps.filter(ts => ts > windowStart);
    record.count = record.timestamps.length;

    // 检查是否超过限制
    if (record.count >= this.maxRequests) {
      return false;
    }

    // 添加新记录
    record.timestamps.push(now);
    record.count++;

    return true;
  }

  /**
   * 重置指定键的记录
   * @param {string} key - 标识键
   */
  reset(key) {
    this.requests.delete(key);
  }

  /**
   * 清空所有记录
   */
  clear() {
    this.requests.clear();
  }
}

// ==================== 内容安全 ====================

/**
 * 检查内容是否包含敏感信息
 * @param {string} content - 内容
 * @param {Array<string>} patterns - 敏感词模式列表
 * @returns {boolean}
 */
function containsSensitiveContent(content, patterns) {
  if (!content || typeof content !== 'string') {
    return false;
  }

  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      if (content.includes(pattern)) {
        return true;
      }
    } else if (pattern instanceof RegExp) {
      if (pattern.test(content)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 掩码敏感信息
 * @param {string} content - 内容
 * @param {Array<string>} patterns - 敏感词模式列表
 * @param {string} mask - 掩码字符（默认：*）
 * @returns {string} 掩码后的内容
 */
function maskSensitiveContent(content, patterns, mask = '*') {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let masked = content;
  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      masked = masked.replace(new RegExp(escapeRegExp(pattern), 'gi'), match => mask.repeat(match.length));
    }
  }
  return masked;
}

/**
 * 转义正则表达式特殊字符
 * @param {string} str - 字符串
 * @returns {string}
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==================== 导出 ====================

module.exports = {
  // 路径守卫
  isAbsolutePath,
  hasPathTraversal,
  isDangerousPath,
  validatePath,

  // 执行安全
  isLikelyPath,
  isSafeExecutableValue,
  validateCommandArgs,
  sanitizeInput,

  // 输入验证
  isValidFilename,
  isValidJson,
  isValidInteger,
  isValidPort,
  isSafeRegExp,

  // 原型污染防护
  isDangerousKey,
  sanitizeObjectKeys,

  // 速率限制
  RateLimiter,
  createRateLimiter: (options = {}) => new RateLimiter(options),

  // 内容安全
  containsSensitiveContent,
  maskSensitiveContent,
  escapeRegExp
};
