/**
 * iFlow Rate Limit Module
 * 速率限制模块，整合自 OpenClaw 的 fixed-window-rate-limit.ts
 */

/**
 * 创建固定窗口速率限制器
 * @param {Object} params - 参数
 * @param {number} params.maxRequests - 最大请求数
 * @param {number} params.windowMs - 窗口时间（毫秒）
 * @param {Function} [params.now] - 当前时间函数
 * @returns {Object} 速率限制器对象
 */
function createFixedWindowRateLimiter(params) {
  const maxRequests = Math.max(1, Math.floor(params.maxRequests));
  const windowMs = Math.max(1, Math.floor(params.windowMs));
  const now = params.now || Date.now;

  let count = 0;
  let windowStartMs = 0;

  return {
    /**
     * 消费一个配额
     * @returns {Object} 结果对象
     * @returns {boolean} result.allowed - 是否允许
     * @returns {number} result.retryAfterMs - 重试等待时间
     * @returns {number} result.remaining - 剩余配额
     */
    consume() {
      const nowMs = now();
      
      // 检查窗口是否过期
      if (nowMs - windowStartMs >= windowMs) {
        windowStartMs = nowMs;
        count = 0;
      }
      
      // 检查是否超过限制
      if (count >= maxRequests) {
        return {
          allowed: false,
          retryAfterMs: Math.max(0, windowStartMs + windowMs - nowMs),
          remaining: 0
        };
      }
      
      // 增加计数
      count += 1;
      return {
        allowed: true,
        retryAfterMs: 0,
        remaining: Math.max(0, maxRequests - count)
      };
    },

    /**
     * 重置计数器
     */
    reset() {
      count = 0;
      windowStartMs = 0;
    },

    /**
     * 获取当前状态
     * @returns {Object} 状态对象
     * @returns {number} state.count - 当前计数
     * @returns {number} state.maxRequests - 最大请求数
     * @returns {number} state.windowMs - 窗口时间
     * @returns {number} state.windowStartMs - 窗口开始时间
     * @returns {number} state.remaining - 剩余配额
     */
    getState() {
      const nowMs = now();
      
      // 检查窗口是否过期
      if (nowMs - windowStartMs >= windowMs) {
        return {
          count: 0,
          maxRequests,
          windowMs,
          windowStartMs: 0,
          remaining: maxRequests
        };
      }
      
      return {
        count,
        maxRequests,
        windowMs,
        windowStartMs,
        remaining: Math.max(0, maxRequests - count)
      };
    }
  };
}

/**
 * 创建滑动窗口速率限制器
 * @param {Object} params - 参数
 * @param {number} params.maxRequests - 最大请求数
 * @param {number} params.windowMs - 窗口时间（毫秒）
 * @param {Function} [params.now] - 当前时间函数
 * @returns {Object} 速率限制器对象
 */
function createSlidingWindowRateLimiter(params) {
  const maxRequests = Math.max(1, Math.floor(params.maxRequests));
  const windowMs = Math.max(1, Math.floor(params.windowMs));
  const now = params.now || Date.now;

  const requests = []; // 存储请求时间戳

  return {
    /**
     * 消费一个配额
     * @returns {Object} 结果对象
     * @returns {boolean} result.allowed - 是否允许
     * @returns {number} result.retryAfterMs - 重试等待时间
     * @returns {number} result.remaining - 剩余配额
     */
    consume() {
      const nowMs = now();
      
      // 删除过期的请求
      while (requests.length > 0 && requests[0] <= nowMs - windowMs) {
        requests.shift();
      }
      
      // 检查是否超过限制
      if (requests.length >= maxRequests) {
        const oldestRequest = requests[0];
        return {
          allowed: false,
          retryAfterMs: Math.max(0, oldestRequest + windowMs - nowMs),
          remaining: 0
        };
      }
      
      // 添加新请求
      requests.push(nowMs);
      return {
        allowed: true,
        retryAfterMs: 0,
        remaining: Math.max(0, maxRequests - requests.length)
      };
    },

    /**
     * 重置计数器
     */
    reset() {
      requests.length = 0;
    },

    /**
     * 获取当前状态
     * @returns {Object} 状态对象
     * @returns {number} state.count - 当前计数
     * @returns {number} state.maxRequests - 最大请求数
     * @returns {number} state.windowMs - 窗口时间
     * @returns {number} state.remaining - 剩余配额
     */
    getState() {
      const nowMs = now();
      
      // 删除过期的请求
      while (requests.length > 0 && requests[0] <= nowMs - windowMs) {
        requests.shift();
      }
      
      return {
        count: requests.length,
        maxRequests,
        windowMs,
        remaining: Math.max(0, maxRequests - requests.length)
      };
    }
  };
}

/**
 * 创建令牌桶速率限制器
 * @param {Object} params - 参数
 * @param {number} params.maxRequests - 最大请求数（桶容量）
 * @param {number} params.refillRate - 每秒填充速率
 * @param {Function} [params.now] - 当前时间函数
 * @returns {Object} 速率限制器对象
 */
function createTokenBucketRateLimiter(params) {
  const maxRequests = Math.max(1, Math.floor(params.maxRequests));
  const refillRate = Math.max(0, params.refillRate);
  const now = params.now || Date.now;

  let tokens = maxRequests;
  let lastRefillTime = now();

  /**
   * 填充令牌
   */
  function refillTokens() {
    const nowMs = now();
    const elapsed = (nowMs - lastRefillTime) / 1000; // 转换为秒
    const tokensToAdd = Math.floor(elapsed * refillRate);
    
    if (tokensToAdd > 0) {
      tokens = Math.min(maxRequests, tokens + tokensToAdd);
      lastRefillTime = nowMs;
    }
  }

  return {
    /**
     * 消费一个令牌
     * @returns {Object} 结果对象
     * @returns {boolean} result.allowed - 是否允许
     * @returns {number} result.retryAfterMs - 重试等待时间
     * @returns {number} result.remaining - 剩余令牌
     */
    consume() {
      refillTokens();
      
      if (tokens >= 1) {
        tokens -= 1;
        return {
          allowed: true,
          retryAfterMs: 0,
          remaining: Math.floor(tokens)
        };
      }
      
      // 计算需要等待的时间
      const tokensNeeded = 1 - tokens;
      const waitTimeMs = Math.ceil(tokensNeeded / refillRate * 1000);
      
      return {
        allowed: false,
        retryAfterMs: waitTimeMs,
        remaining: 0
      };
    },

    /**
     * 重置计数器
     */
    reset() {
      tokens = maxRequests;
      lastRefillTime = now();
    },

    /**
     * 获取当前状态
     * @returns {Object} 状态对象
     * @returns {number} state.tokens - 当前令牌数
     * @returns {number} state.maxRequests - 最大令牌数
     * @returns {number} state.refillRate - 填充速率
     * @returns {number} state.remaining - 剩余令牌
     */
    getState() {
      refillTokens();
      return {
        tokens: Math.floor(tokens),
        maxRequests,
        refillRate,
        remaining: Math.floor(tokens)
      };
    }
  };
}

/**
 * 创建泄漏桶速率限制器
 * @param {Object} params - 参数
 * @param {number} params.maxRequests - 最大请求数（桶容量）
 * @param {number} params.drainRate - 每秒泄漏速率
 * @param {Function} [params.now] - 当前时间函数
 * @returns {Object} 速率限制器对象
 */
function createLeakyBucketRateLimiter(params) {
  const maxRequests = Math.max(1, Math.floor(params.maxRequests));
  const drainRate = Math.max(0, params.drainRate);
  const now = params.now || Date.now;

  let count = 0;
  let lastDrainTime = now();

  /**
   * 泄漏
   */
  function leak() {
    const nowMs = now();
    const elapsed = (nowMs - lastDrainTime) / 1000; // 转换为秒
    const tokensToDrain = Math.floor(elapsed * drainRate);
    
    if (tokensToDrain > 0) {
      count = Math.max(0, count - tokensToDrain);
      lastDrainTime = nowMs;
    }
  }

  return {
    /**
     * 尝试添加请求
     * @returns {Object} 结果对象
     * @returns {boolean} result.allowed - 是否允许
     * @returns {number} result.retryAfterMs - 重试等待时间
     * @returns {number} result.remaining - 剩余容量
     */
    consume() {
      leak();
      
      if (count < maxRequests) {
        count += 1;
        return {
          allowed: true,
          retryAfterMs: 0,
          remaining: maxRequests - count
        };
      }
      
      // 计算需要等待的时间
      const overflow = count - maxRequests + 1;
      const waitTimeMs = Math.ceil(overflow / drainRate * 1000);
      
      return {
        allowed: false,
        retryAfterMs: waitTimeMs,
        remaining: 0
      };
    },

    /**
     * 重置计数器
     */
    reset() {
      count = 0;
      lastDrainTime = now();
    },

    /**
     * 获取当前状态
     * @returns {Object} 状态对象
     * @returns {number} state.count - 当前计数
     * @returns {number} state.maxRequests - 最大请求数
     * @returns {number} state.drainRate - 泄漏速率
     * @returns {number} state.remaining - 剩余容量
     */
    getState() {
      leak();
      return {
        count: Math.floor(count),
        maxRequests,
        drainRate,
        remaining: maxRequests - count
      };
    }
  };
}

/**
 * 速率限制器装饰器
 * @param {Object} limiter - 速率限制器
 * @param {Function} fn - 要装饰的函数
 * @returns {Function} 装饰后的函数
 */
function createRateLimitDecorator(limiter, fn) {
  return async function(...args) {
    const result = limiter.consume();
    
    if (!result.allowed) {
      throw new Error(`Rate limit exceeded. Retry after ${result.retryAfterMs}ms`);
    }
    
    return fn.apply(this, args);
  };
}

module.exports = {
  // 固定窗口
  createFixedWindowRateLimiter,
  
  // 滑动窗口
  createSlidingWindowRateLimiter,
  
  // 令牌桶
  createTokenBucketRateLimiter,
  
  // 泄漏桶
  createLeakyBucketRateLimiter,
  
  // 装饰器
  createRateLimitDecorator
};