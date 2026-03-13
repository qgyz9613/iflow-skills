/**
 * iFlow Cache Utils Module
 * 缓存工具 - 参考 OpenClaw cache-utils
 */

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'cache-data');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// 默认 TTL
const DEFAULT_TTL_MS = 3600000;  // 1小时

/**
 * 解析 TTL（毫秒）
 */
function resolveCacheTtlMs(envValue, defaultTtlMs = DEFAULT_TTL_MS) {
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return defaultTtlMs;
}

/**
 * 检查缓存是否启用
 */
function isCacheEnabled(ttlMs) {
  return ttlMs > 0;
}

/**
 * 获取缓存键
 */
function getCacheKey(prefix, key) {
  return `${prefix}:${key}`;
}

/**
 * 获取缓存文件路径
 */
function getCachePath(key) {
  const hash = require('crypto').createHash('md5').update(key).digest('hex');
  return path.join(CACHE_DIR, `${hash}.json`);
}

/**
 * 获取文件状态快照
 */
function getFileStatSnapshot(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return {
      mtimeMs: stats.mtimeMs,
      sizeBytes: stats.size
    };
  } catch {
    return undefined;
  }
}

/**
 * 读取缓存
 */
function get(key, options = {}) {
  const start = Date.now();
  
  try {
    const cachePath = getCachePath(key);
    
    if (!fs.existsSync(cachePath)) {
      return { status: 'miss', value: null, time: Date.now() - start };
    }
    
    const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const now = Date.now();
    const ttlMs = options.ttlMs || DEFAULT_TTL_MS;
    
    // 检查过期
    if (now - cacheData.timestamp > ttlMs) {
      fs.unlinkSync(cachePath);
      return { status: 'expired', value: null, time: Date.now() - start };
    }
    
    return {
      status: 'hit',
      value: cacheData.value,
      timestamp: cacheData.timestamp,
      ageMs: now - cacheData.timestamp,
      time: Date.now() - start
    };
    
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 写入缓存
 */
function set(key, value, options = {}) {
  const start = Date.now();
  
  try {
    const cachePath = getCachePath(key);
    const ttlMs = options.ttlMs || DEFAULT_TTL_MS;
    
    const cacheData = {
      key,
      value,
      timestamp: Date.now(),
      ttlMs,
      metadata: options.metadata || {}
    };
    
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
    
    return {
      status: 'ok',
      key,
      expiresAt: Date.now() + ttlMs,
      time: Date.now() - start
    };
    
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 删除缓存
 */
function del(key) {
  const start = Date.now();
  
  try {
    const cachePath = getCachePath(key);
    
    if (!fs.existsSync(cachePath)) {
      return { status: 'not_found', key, time: Date.now() - start };
    }
    
    fs.unlinkSync(cachePath);
    return { status: 'ok', key, time: Date.now() - start };
    
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 清空所有缓存
 */
function clear() {
  const start = Date.now();
  
  try {
    const files = fs.readdirSync(CACHE_DIR);
    let cleared = 0;
    
    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      fs.unlinkSync(filePath);
      cleared++;
    }
    
    return { status: 'ok', cleared, time: Date.now() - start };
    
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 缓存统计
 */
function stats() {
  const start = Date.now();
  
  try {
    const files = fs.readdirSync(CACHE_DIR);
    let totalSize = 0;
    let expiredCount = 0;
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
      
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (now - data.timestamp > (data.ttlMs || DEFAULT_TTL_MS)) {
          expiredCount++;
        }
      } catch {
        // 忽略解析错误
      }
    }
    
    return {
      status: 'ok',
      total: files.length,
      expired: expiredCount,
      active: files.length - expiredCount,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      time: Date.now() - start
    };
    
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 清理过期缓存
 */
function cleanup() {
  const start = Date.now();
  
  try {
    const files = fs.readdirSync(CACHE_DIR);
    let cleaned = 0;
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const ttlMs = data.ttlMs || DEFAULT_TTL_MS;
        
        if (now - data.timestamp > ttlMs) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch {
        // 删除损坏的缓存文件
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }
    
    return { status: 'ok', cleaned, time: Date.now() - start };
    
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 格式化字节
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

module.exports = {
  DEFAULT_TTL_MS,
  resolveCacheTtlMs,
  isCacheEnabled,
  getCacheKey,
  getCachePath,
  getFileStatSnapshot,
  get,
  set,
  del,
  clear,
  stats,
  cleanup,
  formatBytes
};