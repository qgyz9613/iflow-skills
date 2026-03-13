/**
 * iFlow Data Validation Module
 * 数据验证模块，整合自 OpenClaw 的数字解析和安全随机数模块
 */

const crypto = require('crypto');

/**
 * 规范化数字字符串
 * @param {unknown} value - 值
 * @returns {string|undefined} 规范化后的字符串
 */
function normalizeNumericString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * 解析有限数字
 * @param {unknown} value - 值
 * @returns {number|undefined} 有限数字或 undefined
 */
function parseFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

/**
 * 解析严格整数
 * @param {unknown} value - 值
 * @returns {number|undefined} 安全整数或 undefined
 */
function parseStrictInteger(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = normalizeNumericString(value);
  if (!normalized || !/^[+-]?\d+$/.test(normalized)) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

/**
 * 解析严格正整数
 * @param {unknown} value - 值
 * @returns {number|undefined} 正整数或 undefined
 */
function parseStrictPositiveInteger(value) {
  const parsed = parseStrictInteger(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

/**
 * 解析严格非负整数
 * @param {unknown} value - 值
 * @returns {number|undefined} 非负整数或 undefined
 */
function parseStrictNonNegativeInteger(value) {
  const parsed = parseStrictInteger(value);
  return parsed !== undefined && parsed >= 0 ? parsed : undefined;
}

/**
 * 解析浮点数
 * @param {unknown} value - 值
 * @returns {number|undefined} 浮点数或 undefined
 */
function parseFloatNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

/**
 * 解析正浮点数
 * @param {unknown} value - 值
 * @returns {number|undefined} 正浮点数或 undefined
 */
function parsePositiveFloat(value) {
  const parsed = parseFloatNumber(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

/**
 * 解析非负浮点数
 * @param {unknown} value - 值
 * @returns {number|undefined} 非负浮点数或 undefined
 */
function parseNonNegativeFloat(value) {
  const parsed = parseFloatNumber(value);
  return parsed !== undefined && parsed >= 0 ? parsed : undefined;
}

/**
 * 检查是否为有效数字
 * @param {unknown} value - 值
 * @returns {boolean} 是否为有效数字
 */
function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 检查是否为有效整数
 * @param {unknown} value - 值
 * @returns {boolean} 是否为有效整数
 */
function isValidInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/**
 * 检查是否为有效正整数
 * @param {unknown} value - 值
 * @returns {boolean} 是否为有效正整数
 */
function isValidPositiveInteger(value) {
  return isValidInteger(value) && value > 0;
}

/**
 * 检查是否为有效非负整数
 * @param {unknown} value - 值
 * @returns {boolean} 是否为有效非负整数
 */
function isValidNonNegativeInteger(value) {
  return isValidInteger(value) && value >= 0;
}

/**
 * 生成安全 UUID
 * @returns {string} UUID v4
 */
function generateSecureUuid() {
  return crypto.randomUUID();
}

/**
 * 生成安全 Token
 * @param {number} bytes - 字节数
 * @returns {string} Base64URL 编码的 token
 */
function generateSecureToken(bytes = 16) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * 生成安全随机字符串
 * @param {number} length - 字符串长度
 * @param {string} charset - 字符集
 * @returns {string} 随机字符串
 */
function generateSecureRandomString(length = 32, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  const randomBytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[randomBytes[i] % charset.length];
  }
  return result;
}

/**
 * 生成安全随机整数
 * @param {number} min - 最小值（包含）
 * @param {number} max - 最大值（不包含）
 * @returns {number} 随机整数
 */
function generateSecureRandomInt(min, max) {
  const range = max - min;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const cutoff = Math.floor((256 ** bytesNeeded) / range) * range;
  const bytes = crypto.randomBytes(bytesNeeded);
  
  let value = 0;
  for (let i = 0; i < bytesNeeded; i++) {
    value = (value << 8) + bytes[i];
  }
  
  if (value >= cutoff) {
    return generateSecureRandomInt(min, max);
  }
  
  return min + (value % range);
}

/**
 * 生成安全随机浮点数
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @param {number} precision - 小数位数
 * @returns {number} 随机浮点数
 */
function generateSecureRandomFloat(min = 0, max = 1, precision = 6) {
  const range = max - min;
  const randomValue = crypto.randomBytes(4).readUInt32LE(0) / 0xFFFFFFFF;
  const value = min + randomValue * range;
  return Number(value.toFixed(precision));
}

/**
 * 验证数字范围
 * @param {number} value - 数值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {boolean} 是否在范围内
 */
function isInRange(value, min, max) {
  return value >= min && value <= max;
}

/**
 * 钳制数值到范围
 * @param {number} value - 数值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 钳制后的数值
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 检查是否为百分比
 * @param {unknown} value - 值
 * @returns {boolean} 是否为有效百分比
 */
function isValidPercentage(value) {
  const num = parseFiniteNumber(value);
  return num !== undefined && isInRange(num, 0, 100);
}

/**
 * 解析百分比
 * @param {unknown} value - 值
 * @returns {number|undefined} 百分比值（0-1）或 undefined
 */
function parsePercentage(value) {
  const num = parseFiniteNumber(value);
  if (num === undefined || !isInRange(num, 0, 100)) {
    return undefined;
  }
  return num / 100;
}

module.exports = {
  // 数字解析
  normalizeNumericString,
  parseFiniteNumber,
  parseStrictInteger,
  parseStrictPositiveInteger,
  parseStrictNonNegativeInteger,
  parseFloatNumber,
  parsePositiveFloat,
  parseNonNegativeFloat,
  
  // 数字验证
  isValidNumber,
  isValidInteger,
  isValidPositiveInteger,
  isValidNonNegativeInteger,
  isInRange,
  clamp,
  isValidPercentage,
  parsePercentage,
  
  // 安全随机数
  generateSecureUuid,
  generateSecureToken,
  generateSecureRandomString,
  generateSecureRandomInt,
  generateSecureRandomFloat
};