/**
 * iFlow Object Safety Module
 * 对象安全模块，整合自 OpenClaw 的对象安全检查模块
 */

/**
 * 被阻止的对象键
 */
const BLOCKED_OBJECT_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor'
]);

/**
 * 危险的对象键（可能包含敏感信息）
 */
const DANGEROUS_OBJECT_KEYS = new Set([
  'password',
  'secret',
  'token',
  'apiKey',
  'accessKey',
  'privateKey',
  'auth',
  'credentials'
]);

/**
 * 检查是否为被阻止的对象键
 * @param {string} key - 键
 * @returns {boolean} 是否被阻止
 */
function isBlockedObjectKey(key) {
  return BLOCKED_OBJECT_KEYS.has(key);
}

/**
 * 检查是否为危险的对象键
 * @param {string} key - 键
 * @returns {boolean} 是否危险
 */
function isDangerousObjectKey(key) {
  const lowerKey = key.toLowerCase();
  return DANGEROUS_OBJECT_KEYS.has(lowerKey);
}

/**
 * 检查是否为纯对象
 * @param {unknown} value - 值
 * @returns {boolean} 是否为纯对象
 */
function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * 检查是否为普通对象（不包含 Date、RegExp 等特殊对象）
 * @param {unknown} value - 值
 * @returns {boolean} 是否为普通对象
 */
function isOrdinaryObject(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

/**
 * 过滤对象键（移除被阻止的键）
 * @param {object} obj - 对象
 * @returns {object} 过滤后的对象
 */
function filterBlockedKeys(obj) {
  if (!isPlainObject(obj)) {
    return obj;
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!isBlockedObjectKey(key)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 过滤敏感键
 * @param {object} obj - 对象
 * @param {string} mask - 掩码字符串
 * @returns {object} 过滤后的对象
 */
function filterSensitiveKeys(obj, mask = '***') {
  if (!isPlainObject(obj)) {
    return obj;
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isDangerousObjectKey(key)) {
      result[key] = mask;
    } else if (isPlainObject(value)) {
      result[key] = filterSensitiveKeys(value, mask);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 深度克隆对象（防止原型污染）
 * @param {unknown} value - 值
 * @returns {unknown} 克隆后的值
 */
function safeDeepClone(value) {
  if (value === null || value === undefined) {
    return value;
  }
  
  if (typeof value !== 'object') {
    return value;
  }
  
  if (Array.isArray(value)) {
    return value.map(item => safeDeepClone(item));
  }
  
  if (!isPlainObject(value)) {
    return value;
  }
  
  const clone = Object.create(null);
  for (const [key, val] of Object.entries(value)) {
    if (!isBlockedObjectKey(key)) {
      clone[key] = safeDeepClone(val);
    }
  }
  
  return clone;
}

/**
 * 创建安全对象（无原型）
 * @param {object} obj - 源对象
 * @returns {object} 安全对象
 */
function createSafeObject(obj = {}) {
  const safe = Object.create(null);
  
  if (isPlainObject(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      if (!isBlockedObjectKey(key)) {
        safe[key] = value;
      }
    }
  }
  
  return safe;
}

/**
 * 安全地设置对象属性
 * @param {object} obj - 对象
 * @param {string} key - 键
 * @param {unknown} value - 值
 * @returns {boolean} 是否成功
 */
function safeSetProperty(obj, key, value) {
  if (isBlockedObjectKey(key)) {
    return false;
  }
  
  obj[key] = value;
  return true;
}

/**
 * 安全地获取对象属性
 * @param {object} obj - 对象
 * @param {string} key - 键
 * @param {unknown} defaultValue - 默认值
 * @returns {unknown} 属性值
 */
function safeGetProperty(obj, key, defaultValue = undefined) {
  if (isBlockedObjectKey(key)) {
    return defaultValue;
  }
  
  return obj[key] ?? defaultValue;
}

/**
 * 安全地合并对象
 * @param {object} target - 目标对象
 * @param {...object} sources - 源对象
 * @returns {object} 合并后的对象
 */
function safeMerge(target, ...sources) {
  const result = createSafeObject(target);
  
  for (const source of sources) {
    if (!isPlainObject(source)) {
      continue;
    }
    
    for (const [key, value] of Object.entries(source)) {
      if (!isBlockedObjectKey(key)) {
        if (isPlainObject(value) && isPlainObject(result[key])) {
          result[key] = safeMerge(result[key], value);
        } else {
          result[key] = safeDeepClone(value);
        }
      }
    }
  }
  
  return result;
}

/**
 * 检查对象是否包含被阻止的键
 * @param {object} obj - 对象
 * @returns {boolean} 是否包含被阻止的键
 */
function hasBlockedKeys(obj) {
  if (!isPlainObject(obj)) {
    return false;
  }
  
  for (const key of Object.keys(obj)) {
    if (isBlockedObjectKey(key)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 检查对象是否包含敏感键
 * @param {object} obj - 对象
 * @returns {boolean} 是否包含敏感键
 */
function hasSensitiveKeys(obj) {
  if (!isPlainObject(obj)) {
    return false;
  }
  
  for (const key of Object.keys(obj)) {
    if (isDangerousObjectKey(key)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 获取对象的所有安全键
 * @param {object} obj - 对象
 * @returns {string[]} 安全键数组
 */
function getSafeKeys(obj) {
  if (!isPlainObject(obj)) {
    return [];
  }
  
  return Object.keys(obj).filter(key => !isBlockedObjectKey(key));
}

/**
 * 冻结对象（深度冻结）
 * @param {object} obj - 对象
 * @returns {object} 冻结后的对象
 */
function deepFreeze(obj) {
  if (!isPlainObject(obj)) {
    return obj;
  }
  
  // 冻结所有属性
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    
    if (isPlainObject(value)) {
      deepFreeze(value);
    } else if (Array.isArray(value)) {
      value.forEach(item => {
        if (isPlainObject(item)) {
          deepFreeze(item);
        }
      });
    }
  }
  
  return Object.freeze(obj);
}

/**
 * 创建不可变对象
 * @param {object} obj - 源对象
 * @returns {object} 不可变对象
 */
function createImmutable(obj) {
  return deepFreeze(safeDeepClone(obj));
}

/**
 * 验证对象键
 * @param {string} key - 键
 * @returns {object} 验证结果 { valid: boolean, reason: string }
 */
function validateObjectKey(key) {
  if (typeof key !== 'string') {
    return { valid: false, reason: 'Key must be a string' };
  }
  
  if (key.trim() === '') {
    return { valid: false, reason: 'Key cannot be empty' };
  }
  
  if (isBlockedObjectKey(key)) {
    return { valid: false, reason: 'Key is blocked for security reasons' };
  }
  
  return { valid: true, reason: '' };
}

/**
 * 安全地遍历对象
 * @param {object} obj - 对象
 * @param {function} callback - 回调函数
 */
function safeObjectForEach(obj, callback) {
  if (!isPlainObject(obj)) {
    return;
  }
  
  for (const key of Object.keys(obj)) {
    if (!isBlockedObjectKey(key)) {
      callback(key, obj[key]);
    }
  }
}

/**
 * 安全地映射对象
 * @param {object} obj - 对象
 * @param {function} callback - 回调函数
 * @returns {object} 映射后的对象
 */
function safeObjectMap(obj, callback) {
  const result = createSafeObject();
  
  if (!isPlainObject(obj)) {
    return result;
  }
  
  safeObjectForEach(obj, (key, value) => {
    const mappedValue = callback(key, value);
    if (!isBlockedObjectKey(key)) {
      result[key] = mappedValue;
    }
  });
  
  return result;
}

module.exports = {
  // 键检查
  isBlockedObjectKey,
  isDangerousObjectKey,
  
  // 对象检查
  isPlainObject,
  isOrdinaryObject,
  
  // 过滤
  filterBlockedKeys,
  filterSensitiveKeys,
  
  // 安全操作
  safeDeepClone,
  createSafeObject,
  safeSetProperty,
  safeGetProperty,
  safeMerge,
  
  // 检查方法
  hasBlockedKeys,
  hasSensitiveKeys,
  getSafeKeys,
  validateObjectKey,
  
  // 不可变对象
  deepFreeze,
  createImmutable,
  
  // 遍历和映射
  safeObjectForEach,
  safeObjectMap,
  
  // 常量
  BLOCKED_OBJECT_KEYS,
  DANGEROUS_OBJECT_KEYS
};