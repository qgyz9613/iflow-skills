/**
 * iFlow Cache Module
 * 缓存系统
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const CACHE_DIR = path.join(__dirname, '..', 'cache-data');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// 获取缓存
function get(key) {
  const start = Date.now();
  try {
    // 如果 key 是对象，提取 key 字段（MCP 调用方式）
    if (typeof key === 'object' && key !== null) {
      key = key.key || null;
    }

    const safeKey = sanitizeKey(key);
    const filePath = path.join(CACHE_DIR, `${safeKey}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'ok', value: null, cached: false, time: Date.now() - start };
    }
    
    const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // 检查过期
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      fs.unlinkSync(filePath);
      return { status: 'ok', value: null, cached: false, expired: true, time: Date.now() - start };
    }
    
    return { status: 'ok', value: cached.value, cached: true, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 设置缓存
function set(key, value, ttlSeconds = 3600) {
  const start = Date.now();
  try {
    // 如果 key 是对象，提取 key、value 和 ttlSeconds 字段（MCP 调用方式）
    if (typeof key === 'object' && key !== null) {
      value = key.value;
      ttlSeconds = key.ttlSeconds !== undefined ? key.ttlSeconds : ttlSeconds;
      key = key.key;
    }

    const safeKey = sanitizeKey(key);
    const filePath = path.join(CACHE_DIR, `${safeKey}.json`);
    
    const cached = {
      key,
      value,
      createdAt: new Date().toISOString(),
      expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null,
      ttl: ttlSeconds
    };
    
    fs.writeFileSync(filePath, JSON.stringify(cached, null, 2));
    
    return { status: 'ok', key, ttl: ttlSeconds, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 删除缓存
function del(key) {
  const start = Date.now();
  try {
    const safeKey = sanitizeKey(key);
    const filePath = path.join(CACHE_DIR, `${safeKey}.json`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { status: 'ok', deleted: true, time: Date.now() - start };
    }
    
    return { status: 'ok', deleted: false, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 清空缓存
function clear() {
  const start = Date.now();
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    
    files.forEach(f => {
      try {
        fs.unlinkSync(path.join(CACHE_DIR, f));
      } catch {}
    });
    
    return { status: 'ok', cleared: files.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 清理过期缓存
function cleanup() {
  const start = Date.now();
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    let cleaned = 0;
    
    files.forEach(f => {
      try {
        const cached = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8'));
        if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
          fs.unlinkSync(path.join(CACHE_DIR, f));
          cleaned++;
        }
      } catch {}
    });
    
    return { status: 'ok', cleaned, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取缓存统计
function stats() {
  const start = Date.now();
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    
    let totalSize = 0;
    let validCount = 0;
    let expiredCount = 0;
    
    files.forEach(f => {
      try {
        const stat = fs.statSync(path.join(CACHE_DIR, f));
        totalSize += stat.size;
        
        const cached = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8'));
        if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
          expiredCount++;
        } else {
          validCount++;
        }
      } catch {}
    });
    
    return { 
      status: 'ok', 
      total: files.length,
      valid: validCount,
      expired: expiredCount,
      sizeBytes: totalSize,
      sizeMB: (totalSize / 1024 / 1024).toFixed(2),
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 生成哈希键
function hash(content) {
  const start = Date.now();
  const hashValue = crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
  return { status: 'ok', hash: hashValue, time: Date.now() - start };
}

// 检查缓存是否存在
function has(key) {
  const start = Date.now();
  try {
    const safeKey = sanitizeKey(key);
    const filePath = path.join(CACHE_DIR, `${safeKey}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'ok', exists: false, time: Date.now() - start };
    }
    
    const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const expired = cached.expiresAt && new Date(cached.expiresAt) < new Date();
    
    return { status: 'ok', exists: !expired, expired, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 辅助函数：安全化键名
function sanitizeKey(key) {
  // 参数类型校验
  if (key === null || key === undefined) {
    return 'default_key';
  }
  if (typeof key !== 'string') {
    key = String(key);
  }
  // 移除不安全字符，限制长度
  return key
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64);
}

module.exports = {
  get,
  set,
  delete: del,
  clear,
  cleanup,
  stats,
  hash,
  has
};
