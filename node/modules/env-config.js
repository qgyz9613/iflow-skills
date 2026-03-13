/**
 * iFlow Env Config Module
 * 环境配置模块，整合自 OpenClaw 的环境变量加载模块
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析 .env 文件内容
 * @param {string} content - 文件内容
 * @returns {object} 解析后的环境变量对象
 */
function parseDotEnv(content) {
  const result = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    // 解析 KEY=VALUE
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) {
      continue;
    }
    
    const key = match[1].trim();
    let value = match[2].trim();
    
    // 移除引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    result[key] = value;
  }
  
  return result;
}

/**
 * 加载 .env 文件到 process.env
 * @param {object} options - 选项
 * @returns {object} 加载的环境变量
 */
function loadDotEnv(options = {}) {
  const {
    path: customPath,
    quiet = true,
    override = false
  } = options;
  
  const envPath = customPath || path.join(process.cwd(), '.env');
  const loaded = {};
  
  if (!fs.existsSync(envPath)) {
    if (!quiet) {
      console.warn(`[env-config] .env file not found: ${envPath}`);
    }
    return loaded;
  }
  
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const parsed = parseDotEnv(content);
    
    for (const [key, value] of Object.entries(parsed)) {
      // 只有在 override 为 true 或环境变量不存在时才设置
      if (override || process.env[key] === undefined) {
        process.env[key] = value;
        loaded[key] = value;
      }
    }
    
    if (!quiet) {
      console.log(`[env-config] Loaded ${Object.keys(loaded).length} variables from ${envPath}`);
    }
  } catch (error) {
    if (!quiet) {
      console.error(`[env-config] Error loading .env file: ${error.message}`);
    }
  }
  
  return loaded;
}

/**
 * 获取环境变量
 * @param {string} key - 环境变量键
 * @param {string|number|boolean} defaultValue - 默认值
 * @returns {string|number|boolean} 环境变量值
 */
function getEnv(key, defaultValue = undefined) {
  if (typeof key !== 'string' || !key) {
    return defaultValue;
  }
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value;
}

/**
 * 获取字符串环境变量
 * @param {string} key - 环境变量键
 * @param {string} defaultValue - 默认值
 * @returns {string} 环境变量值
 */
function getEnvString(key, defaultValue = '') {
  return getEnv(key, defaultValue) || defaultValue;
}

/**
 * 获取数字环境变量
 * @param {string} key - 环境变量键
 * @param {number} defaultValue - 默认值
 * @returns {number} 环境变量值
 */
function getEnvNumber(key, defaultValue = 0) {
  const value = getEnv(key);
  if (value === undefined) {
    return defaultValue;
  }
  const num = Number(value);
  return Number.isNaN(num) ? defaultValue : num;
}

/**
 * 获取布尔环境变量
 * @param {string} key - 环境变量键
 * @param {boolean} defaultValue - 默认值
 * @returns {boolean} 环境变量值
 */
function getEnvBoolean(key, defaultValue = false) {
  const value = getEnv(key);
  if (value === undefined) {
    return defaultValue;
  }
  const normalized = value.toLowerCase().trim();
  return ['1', 'true', 'yes', 'on', 'y'].includes(normalized);
}

/**
 * 获取数组环境变量（逗号分隔）
 * @param {string} key - 环境变量键
 * @param {string[]} defaultValue - 默认值
 * @returns {string[]} 环境变量值数组
 */
function getEnvArray(key, defaultValue = []) {
  const value = getEnv(key);
  if (value === undefined) {
    return defaultValue;
  }
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * 获取 JSON 环境变量
 * @param {string} key - 环境变量键
 * @param {object} defaultValue - 默认值
 * @returns {object} 解析后的 JSON 对象
 */
function getEnvJson(key, defaultValue = {}) {
  const value = getEnv(key);
  if (value === undefined) {
    return defaultValue;
  }
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

/**
 * 设置环境变量
 * @param {string} key - 环境变量键
 * @param {string} value - 环境变量值
 */
function setEnv(key, value) {
  process.env[key] = String(value);
}

/**
 * 删除环境变量
 * @param {string} key - 环境变量键
 */
function deleteEnv(key) {
  delete process.env[key];
}

/**
 * 获取所有环境变量
 * @param {object} options - 选项
 * @returns {object} 环境变量对象
 */
function getAllEnv(options = {}) {
  const {
    prefix = '',
    includeSystem = false
  } = options;
  
  const result = {};
  
  for (const [key, value] of Object.entries(process.env)) {
    // 跳过系统环境变量（如果 includeSystem 为 false）
    if (!includeSystem && !key.startsWith(prefix) && key !== 'NODE_ENV') {
      continue;
    }
    
    // 应用前缀过滤
    if (prefix && !key.startsWith(prefix)) {
      continue;
    }
    
    result[key] = value;
  }
  
  return result;
}

/**
 * 从多个来源加载环境变量
 * @param {string[]} paths - .env 文件路径数组
 * @param {object} options - 选项
 * @returns {object} 加载的环境变量
 */
function loadMultipleEnv(paths, options = {}) {
  const loaded = {};
  
  for (const envPath of paths) {
    const result = loadDotEnv({ ...options, path: envPath });
    Object.assign(loaded, result);
  }
  
  return loaded;
}

/**
 * 验证必需的环境变量
 * @param {string[]} keys - 环境变量键数组
 * @returns {object} 验证结果 { valid: boolean, missing: string[] }
 */
function validateRequiredEnv(keys) {
  const missing = [];
  
  for (const key of keys) {
    if (process.env[key] === undefined || process.env[key] === '') {
      missing.push(key);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * 掩码敏感环境变量值
 * @param {object} env - 环境变量对象
 * @param {string[]} sensitiveKeys - 敏感键数组
 * @returns {object} 掩码后的环境变量对象
 */
function maskSensitiveEnv(env, sensitiveKeys = ['password', 'secret', 'token', 'key', 'api']) {
  const result = {};
  
  for (const [key, value] of Object.entries(env)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
    
    if (isSensitive && value) {
      result[key] = '***masked***';
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * 创建 .env 文件
 * @param {string} filePath - 文件路径
 * @param {object} env - 环境变量对象
 * @returns {boolean} 是否成功
 */
function createDotEnv(filePath, env) {
  try {
    const lines = [];
    
    for (const [key, value] of Object.entries(env)) {
      // 如果值包含空格或特殊字符，用引号包裹
      const needsQuotes = /[\s'"#]/.test(value);
      const formattedValue = needsQuotes ? `"${value}"` : value;
      lines.push(`${key}=${formattedValue}`);
    }
    
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  // 加载环境变量
  loadDotEnv,
  loadMultipleEnv,
  parseDotEnv,
  
  // 获取环境变量
  getEnv,
  getEnvString,
  getEnvNumber,
  getEnvBoolean,
  getEnvArray,
  getEnvJson,
  getAllEnv,
  
  // 设置环境变量
  setEnv,
  deleteEnv,
  
  // 验证和安全
  validateRequiredEnv,
  maskSensitiveEnv,
  
  // 创建 .env 文件
  createDotEnv
};
