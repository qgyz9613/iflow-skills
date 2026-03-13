/**
 * iFlow Dedupe Cache Module
 * 去重缓存模块，整合自 OpenClaw 的 dedupe.ts
 */

/**
 * 修剪 Map 到最大大小
 * @param {Map} map - 要修剪的 Map
 * @param {number} maxSize - 最大大小
 */
function pruneMapToMaxSize(map, maxSize) {
  if (map.size <= maxSize) {
    return;
  }
  
  // 删除最早的条目（按照插入顺序）
  const entriesToDelete = map.size - maxSize;
  let deleted = 0;
  
  for (const key of map.keys()) {
    if (deleted >= entriesToDelete) {
      break;
    }
    map.delete(key);
    deleted++;
  }
}

/**
 * 创建去重缓存
 * @param {Object} options - 缓存选项
 * @param {number} [options.ttlMs=3600000] - TTL（毫秒），0 表示无过期
 * @param {number} [options.maxSize=1000] - 最大大小，0 表示无限制
 * @returns {Object} 去重缓存对象
 */
function createDedupeCache(options = {}) {
  const ttlMs = Math.max(0, options.ttlMs || 3600000);
  const maxSize = Math.max(0, Math.floor(options.maxSize || 1000));
  const cache = new Map();

  /**
   * 触摸缓存条目（更新时间戳）
   * @param {string} key - 缓存键
   * @param {number} now - 当前时间戳
   */
  const touch = (key, now) => {
    cache.delete(key);
    cache.set(key, now);
  };

  /**
   * 修剪缓存
   * @param {number} now - 当前时间戳
   */
  const prune = (now) => {
    // 删除过期的条目
    const cutoff = ttlMs > 0 ? now - ttlMs : undefined;
    if (cutoff !== undefined) {
      for (const [entryKey, entryTs] of cache) {
        if (entryTs < cutoff) {
          cache.delete(entryKey);
        }
      }
    }
    
    // 删除多余的条目
    if (maxSize <= 0) {
      cache.clear();
      return;
    }
    pruneMapToMaxSize(cache, maxSize);
  };

  /**
   * 检查是否有未过期的条目
   * @param {string} key - 缓存键
   * @param {number} now - 当前时间戳
   * @param {boolean} touchOnRead - 读取时是否触摸
   * @returns {boolean} 是否存在且未过期
   */
  const hasUnexpired = (key, now, touchOnRead) => {
    const existing = cache.get(key);
    if (existing === undefined) {
      return false;
    }
    if (ttlMs > 0 && now - existing >= ttlMs) {
      cache.delete(key);
      return false;
    }
    if (touchOnRead) {
      touch(key, now);
    }
    return true;
  };

  return {
    /**
     * 检查并标记键
     * @param {string|null|undefined} key - 缓存键
     * @param {number} [now=Date.now()] - 当前时间戳
     * @returns {boolean} 如果键已存在且未过期返回 true，否则返回 false
     */
    check: (key, now = Date.now()) => {
      if (!key) {
        return false;
      }
      if (hasUnexpired(key, now, true)) {
        return true;
      }
      touch(key, now);
      prune(now);
      return false;
    },

    /**
     * 查看键是否存在（不触摸）
     * @param {string|null|undefined} key - 缓存键
     * @param {number} [now=Date.now()] - 当前时间戳
     * @returns {boolean} 如果键已存在且未过期返回 true，否则返回 false
     */
    peek: (key, now = Date.now()) => {
      if (!key) {
        return false;
      }
      return hasUnexpired(key, now, false);
    },

    /**
     * 清空缓存
     */
    clear: () => {
      cache.clear();
    },

    /**
     * 获取缓存大小
     * @returns {number} 缓存大小
     */
    size: () => cache.size,

    /**
     * 删除特定键
     * @param {string} key - 缓存键
     * @returns {boolean} 是否删除成功
     */
    delete: (key) => {
      return cache.delete(key);
    },

    /**
     * 检查键是否存在（不检查过期）
     * @param {string} key - 缓存键
     * @returns {boolean} 是否存在
     */
    has: (key) => {
      return cache.has(key);
    },

    /**
     * 获取所有键
     * @returns {string[]} 所有键
     */
    keys: () => {
      return Array.from(cache.keys());
    },

    /**
     * 获取缓存统计信息
     * @returns {Object} 统计信息
     */
    getStats: () => {
      const now = Date.now();
      let expiredCount = 0;
      
      for (const [_, entryTs] of cache) {
        if (ttlMs > 0 && now - entryTs >= ttlMs) {
          expiredCount++;
        }
      }
      
      return {
        size: cache.size,
        maxSize,
        ttlMs,
        expiredCount,
        activeCount: cache.size - expiredCount
      };
    }
  };
}

/**
 * 创建简单的内存缓存
 * @param {Object} options - 缓存选项
 * @param {number} [options.maxSize=100] - 最大大小
 * @returns {Object} 缓存对象
 */
function createMemoryCache(options = {}) {
  const maxSize = Math.max(0, options.maxSize || 100);
  const cache = new Map();

  return {
    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {any} value - 缓存值
     */
    set: (key, value) => {
      if (maxSize > 0 && cache.size >= maxSize && !cache.has(key)) {
        // 删除最早的条目
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set(key, value);
    },

    /**
     * 获取缓存
     * @param {string} key - 缓存键
     * @returns {any|undefined} 缓存值
     */
    get: (key) => {
      return cache.get(key);
    },

    /**
     * 检查键是否存在
     * @param {string} key - 缓存键
     * @returns {boolean} 是否存在
     */
    has: (key) => {
      return cache.has(key);
    },

    /**
     * 删除键
     * @param {string} key - 缓存键
     * @returns {boolean} 是否删除成功
     */
    delete: (key) => {
      return cache.delete(key);
    },

    /**
     * 清空缓存
     */
    clear: () => {
      cache.clear();
    },

    /**
     * 获取缓存大小
     * @returns {number} 缓存大小
     */
    size: () => cache.size,

    /**
     * 获取所有键
     * @returns {string[]} 所有键
     */
    keys: () => {
      return Array.from(cache.keys());
    }
  };
}

/**
 * 创建 LRU 缓存
 * @param {Object} options - 缓存选项
 * @param {number} [options.maxSize=100] - 最大大小
 * @returns {Object} LRU 缓存对象
 */
function createLRUCache(options = {}) {
  const maxSize = Math.max(0, options.maxSize || 100);
  const cache = new Map();

  return {
    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {any} value - 缓存值
     */
    set: (key, value) => {
      if (maxSize > 0 && cache.size >= maxSize && !cache.has(key)) {
        // 删除最早的条目（LRU）
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      // 删除并重新插入以更新访问顺序
      cache.delete(key);
      cache.set(key, value);
    },

    /**
     * 获取缓存
     * @param {string} key - 缓存键
     * @returns {any|undefined} 缓存值
     */
    get: (key) => {
      const value = cache.get(key);
      if (value !== undefined) {
        // 删除并重新插入以更新访问顺序
        cache.delete(key);
        cache.set(key, value);
      }
      return value;
    },

    /**
     * 检查键是否存在
     * @param {string} key - 缓存键
     * @returns {boolean} 是否存在
     */
    has: (key) => {
      return cache.has(key);
    },

    /**
     * 删除键
     * @param {string} key - 缓存键
     * @returns {boolean} 是否删除成功
     */
    delete: (key) => {
      return cache.delete(key);
    },

    /**
     * 清空缓存
     */
    clear: () => {
      cache.clear();
    },

    /**
     * 获取缓存大小
     * @returns {number} 缓存大小
     */
    size: () => cache.size,

    /**
     * 获取所有键
     * @returns {string[]} 所有键
     */
    keys: () => {
      return Array.from(cache.keys());
    }
  };
}

module.exports = {
  // 去重缓存
  createDedupeCache,
  pruneMapToMaxSize,
  
  // 其他缓存类型
  createMemoryCache,
  createLRUCache
};