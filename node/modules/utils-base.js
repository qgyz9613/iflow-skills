/**
 * iFlow Base Utils Module
 * 整合自 OpenClaw 项目的通用工具函数
 * 提供分块、并发、超时、安全处理等基础工具
 */

// ==================== 分块处理 ====================

/**
 * 将数组分成指定大小的块
 * @param {Array} items - 要分块的数组
 * @param {number} size - 每块的大小
 * @returns {Array<Array>} 分块后的二维数组
 */
function chunkItems(items, size) {
  if (!Array.isArray(items)) {
    return [];
  }
  if (size <= 0) {
    return [Array.from(items)];
  }
  const rows = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

// ==================== 并发控制 ====================

/**
 * 带并发限制的任务执行器
 * @param {Object} params - 参数对象
 * @param {Array<Function>} params.tasks - 任务函数数组
 * @param {number} params.limit - 并发限制
 * @param {string} params.errorMode - 错误模式 ('continue' | 'stop')
 * @param {Function} params.onTaskError - 任务错误回调
 * @returns {Promise<{results: Array, firstError: Error|null, hasError: boolean}>}
 */
async function runTasksWithConcurrency(params) {
  const { tasks, limit, onTaskError } = params;
  const errorMode = params.errorMode ?? 'continue';

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { results: [], firstError: undefined, hasError: false };
  }

  const resolvedLimit = Math.max(1, Math.min(limit, tasks.length));
  const results = Array.from({ length: tasks.length });
  let next = 0;
  let firstError = undefined;
  let hasError = false;

  const workers = Array.from({ length: resolvedLimit }, async () => {
    while (true) {
      if (errorMode === 'stop' && hasError) {
        return;
      }
      const index = next;
      next += 1;
      if (index >= tasks.length) {
        return;
      }
      try {
        results[index] = await tasks[index]();
      } catch (error) {
        if (!hasError) {
          firstError = error;
          hasError = true;
        }
        onTaskError?.(error, index);
        if (errorMode === 'stop') {
          return;
        }
      }
    }
  });

  await Promise.allSettled(workers);
  return { results, firstError, hasError };
}

// ==================== 超时控制 ====================

/**
 * 为 Promise 添加超时
 * @param {Promise} promise - 要包装的 Promise
 * @param {number} timeoutMs - 超时时间（毫秒）
 * @returns {Promise} 带超时的 Promise
 */
function withTimeout(promise, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

// ==================== 安全 JSON 处理 ====================

/**
 * 安全 JSON 序列化，处理特殊类型
 * @param {any} value - 要序列化的值
 * @returns {string|null} JSON 字符串或 null
 */
function safeJsonStringify(value) {
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'bigint') {
        return val.toString();
      }
      if (typeof val === 'function') {
        return '[Function]';
      }
      if (val instanceof Error) {
        return { name: val.name, message: val.message, stack: val.stack };
      }
      if (val instanceof Uint8Array) {
        return { type: 'Uint8Array', data: Buffer.from(val).toString('base64') };
      }
      return val;
    });
  } catch {
    return null;
  }
}

/**
 * 安全 JSON 解析
 * @param {string} str - JSON 字符串
 * @param {any} defaultValue - 解析失败时的默认值
 * @returns {any} 解析结果或默认值
 */
function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

// ==================== API 密钥掩码 ====================

/**
 * 掩码 API 密钥用于安全显示
 * @param {string} value - API 密钥
 * @returns {string} 掩码后的字符串
 */
function maskApiKey(value) {
  if (typeof value !== 'string') {
    return 'invalid';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 'missing';
  }
  if (trimmed.length <= 6) {
    return `${trimmed.slice(0, 1)}...${trimmed.slice(-1)}`;
  }
  if (trimmed.length <= 16) {
    return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-8)}`;
}

// ==================== 深度克隆 ====================

/**
 * 深度克隆对象
 * @param {any} value - 要克隆的值
 * @returns {any} 克隆后的值
 */
function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

// ==================== 去重 ====================

/**
 * 数组去重
 * @param {Array} arr - 数组
 * @param {Function} keyFn - 可选的键提取函数
 * @returns {Array} 去重后的数组
 */
function deduplicate(arr, keyFn) {
  if (!Array.isArray(arr)) {
    return [];
  }
  if (keyFn) {
    const seen = new Set();
    return arr.filter(item => {
      const key = keyFn(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  return [...new Set(arr)];
}

// ==================== 延迟 ====================

/**
 * 延迟执行
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 随机工具 ====================

/**
 * 生成随机字符串
 * @param {number} length - 长度
 * @param {string} charset - 字符集（默认：字母数字）
 * @returns {string} 随机字符串
 */
function randomString(length, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  let result = '';
  const charsetLength = charset.length;
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charsetLength));
  }
  return result;
}

/**
 * 生成 UUID v4
 * @returns {string} UUID
 */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==================== 验证工具 ====================

/**
 * 检查是否为有效的 URL
 * @param {string} url - URL 字符串
 * @returns {boolean}
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查是否为有效的邮箱地址
 * @param {string} email - 邮箱地址
 * @returns {boolean}
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// ==================== 时间格式化 ====================

/**
 * 验证 IANA 时区字符串
 * @param {string} value - 时区字符串
 * @returns {string|undefined} 有效的时区字符串，无效则返回 undefined
 */
function resolveTimezone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return undefined;
  }
}

/**
 * 格式化 UTC 时间戳
 * @param {Date} date - 日期对象
 * @param {Object} options - 选项
 * @returns {string} 格式化的时间戳
 */
function formatUtcTimestamp(date, options = {}) {
  const displaySeconds = options.displaySeconds || false;
  const yyyy = String(date.getUTCFullYear()).padStart(4, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  
  if (!displaySeconds) {
    return `${yyyy}-${mm}-${dd}T${hh}:${min}Z`;
  }
  
  const sec = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}Z`;
}

/**
 * 格式化时区感知时间戳
 * @param {Date} date - 日期对象
 * @param {Object} options - 选项
 * @returns {string|undefined} 格式化的时间戳，失败返回 undefined
 */
function formatZonedTimestamp(date, options = {}) {
  const displaySeconds = options.displaySeconds || false;
  const timeZone = options.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: displaySeconds ? '2-digit' : undefined,
      timeZoneName: 'short'
    });

    return formatter.format(date);
  } catch {
    return undefined;
  }
}

/**
 * 格式化持续时间（秒）
 * @param {number} ms - 毫秒数
 * @param {Object} options - 选项
 * @returns {string} 格式化的持续时间
 */
function formatDurationSeconds(ms, options = {}) {
  if (!Number.isFinite(ms)) {
    return 'unknown';
  }
  const decimals = options.decimals ?? 1;
  const unit = options.unit ?? 's';
  const seconds = Math.max(0, ms) / 1000;
  const fixed = seconds.toFixed(Math.max(0, decimals));
  const trimmed = fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  return unit === 'seconds' ? `${trimmed} seconds` : `${trimmed}s`;
}

/**
 * 精确格式化持续时间
 * @param {number} ms - 毫秒数
 * @param {Object} options - 选项
 * @returns {string} 格式化的持续时间
 */
function formatDurationPrecise(ms, options = {}) {
  if (!Number.isFinite(ms)) {
    return 'unknown';
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return formatDurationSeconds(ms, {
    decimals: options.decimals ?? 2,
    unit: options.unit ?? 's'
  });
}

/**
 * 紧凑格式化持续时间
 * @param {number} ms - 毫秒数
 * @param {Object} options - 选项
 * @returns {string|undefined} 格式化的持续时间
 */
function formatDurationCompact(ms, options = {}) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    return undefined;
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const sep = options?.spaced ? ' ' : '';
  const totalSeconds = Math.round(ms / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (remainingHours > 0 || (days === 0 && hours > 0)) parts.push(`${remainingHours}h`);
  if (remainingMinutes > 0 || (hours === 0 && minutes > 0)) parts.push(`${remainingMinutes}m`);
  if (seconds > 0 || (minutes === 0)) parts.push(`${seconds}s`);

  return parts.join(sep);
}

/**
 * 格式化相对时间（多久之前）
 * @param {number|null|undefined} durationMs - 持续时间（毫秒）
 * @param {Object} options - 选项
 * @returns {string} 格式化的相对时间
 */
function formatTimeAgo(durationMs, options = {}) {
  const suffix = options?.suffix !== false;
  const fallback = options?.fallback ?? 'unknown';

  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) {
    return fallback;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.round(totalSeconds / 60);

  if (minutes < 1) {
    return suffix ? 'just now' : `${totalSeconds}s`;
  }
  if (minutes < 60) {
    return suffix ? `${minutes}m ago` : `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return suffix ? `${hours}h ago` : `${hours}h`;
  }
  const days = Math.round(hours / 24);
  return suffix ? `${days}d ago` : `${days}d`;
}

/**
 * 格式化相对时间戳
 * @param {number} epochMs - 时间戳（毫秒）
 * @param {Object} options - 选项
 * @returns {string} 格式化的相对时间
 */
function formatRelativeTimestamp(epochMs, options = {}) {
  const fallback = options?.fallback ?? 'n/a';
  const dateFallback = options?.dateFallback ?? false;
  const timezone = options?.timezone;

  if (epochMs == null || !Number.isFinite(epochMs)) {
    return fallback;
  }

  const now = Date.now();
  const diff = now - epochMs;

  // 未来时间
  if (diff < 0) {
    const date = new Date(epochMs);
    if (dateFallback && Math.abs(diff) > 7 * 24 * 60 * 60 * 1000) {
      return formatZonedTimestamp(date, { displaySeconds: false, timezone });
    }
    return `in ${formatTimeAgo(Math.abs(diff), { suffix: false })}`;
  }

  // 过去时间
  const ago = formatTimeAgo(diff);
  if (dateFallback && diff > 7 * 24 * 60 * 60 * 1000) {
    const date = new Date(epochMs);
    return formatZonedTimestamp(date, { displaySeconds: false, timezone });
  }
  return ago;
}

// ==================== 导出 ====================

module.exports = {
  // 分块处理
  chunkItems,

  // 并发控制
  runTasksWithConcurrency,

  // 超时控制
  withTimeout,

  // 安全 JSON
  safeJsonStringify,
  safeJsonParse,

  // API 密钥
  maskApiKey,

  // 深度克隆
  deepClone,

  // 去重
  deduplicate,

  // 延迟
  delay,

  // 随机
  randomString,
  uuid,

  // 验证
  isValidUrl,
  isValidEmail,

  // 时间格式化
  resolveTimezone,
  formatUtcTimestamp,
  formatZonedTimestamp,
  formatDurationSeconds,
  formatDurationPrecise,
  formatDurationCompact,
  formatTimeAgo,
  formatRelativeTimestamp
};