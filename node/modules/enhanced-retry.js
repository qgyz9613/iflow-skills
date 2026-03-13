/**
 * iFlow Enhanced Retry Module
 * 增强重试机制，整合自 OpenClaw 的 retry.ts 和 backoff.ts
 */

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 延迟函数（支持 AbortSignal）
 * @param {number} ms - 延迟毫秒数
 * @param {AbortSignal} [abortSignal] - 可选的中断信号
 * @returns {Promise<void>}
 */
async function sleepWithAbort(ms, abortSignal) {
  if (ms <= 0) {
    return;
  }
  if (abortSignal?.aborted) {
    throw new Error("aborted");
  }
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve();
    }, ms);
    
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new Error("aborted"));
    };
    
    abortSignal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * 计算退避延迟
 * @param {Object} policy - 退避策略
 * @param {number} policy.initialMs - 初始延迟
 * @param {number} policy.maxMs - 最大延迟
 * @param {number} policy.factor - 增长因子
 * @param {number} policy.jitter - 抖动系数 (0-1)
 * @param {number} attempt - 当前尝试次数
 * @returns {number} 计算出的延迟毫秒数
 */
function computeBackoff(policy, attempt) {
  const base = policy.initialMs * Math.pow(policy.factor, Math.max(attempt - 1, 0));
  const jitter = base * policy.jitter * Math.random();
  return Math.min(policy.maxMs, Math.round(base + jitter));
}

/**
 * 解析重试配置
 * @param {Object} defaults - 默认配置
 * @param {Object} overrides - 覆盖配置
 * @returns {Object} 解析后的配置
 */
function resolveRetryConfig(defaults, overrides) {
  const attempts = Math.max(1, Math.round(clampNumber(overrides?.attempts, defaults.attempts, 1)));
  const minDelayMs = Math.max(0, Math.round(clampNumber(overrides?.minDelayMs, defaults.minDelayMs, 0)));
  const maxDelayMs = Math.max(minDelayMs, Math.round(clampNumber(overrides?.maxDelayMs, defaults.maxDelayMs, 0)));
  const jitter = clampNumber(overrides?.jitter, defaults.jitter, 0, 1);
  return { attempts, minDelayMs, maxDelayMs, jitter };
}

/**
 * 限制数值范围
 * @param {unknown} value - 要限制的值
 * @param {number} fallback - 默认值
 * @param {number} [min] - 最小值
 * @param {number} [max] - 最大值
 * @returns {number} 限制后的值
 */
function clampNumber(value, fallback, min, max) {
  const next = asFiniteNumber(value);
  if (next === undefined) {
    return fallback;
  }
  const floor = typeof min === "number" ? min : Number.NEGATIVE_INFINITY;
  const ceiling = typeof max === "number" ? max : Number.POSITIVE_INFINITY;
  return Math.min(Math.max(next, floor), ceiling);
}

/**
 * 转换为有限数字
 * @param {unknown} value - 要转换的值
 * @returns {number|undefined} 转换后的数字或 undefined
 */
function asFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * 应用抖动
 * @param {number} delayMs - 原始延迟
 * @param {number} jitter - 抖动系数 (0-1)
 * @returns {number} 应用抖动后的延迟
 */
function applyJitter(delayMs, jitter) {
  if (jitter <= 0) {
    return delayMs;
  }
  const offset = (Math.random() * 2 - 1) * jitter;
  return Math.max(0, Math.round(delayMs * (1 + offset)));
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG = {
  attempts: 3,
  minDelayMs: 300,
  maxDelayMs: 30000,
  jitter: 0,
};

/**
 * 默认退避策略
 */
const DEFAULT_BACKOFF_POLICY = {
  initialMs: 300,
  maxMs: 30000,
  factor: 2,
  jitter: 0.1,
};

/**
 * 异步重试函数
 * @param {Function} fn - 要重试的异步函数
 * @param {number|Object} attemptsOrOptions - 重试次数或选项
 * @param {number} [initialDelayMs] - 初始延迟（仅当 attemptsOrOptions 为数字时使用）
 * @returns {Promise<any>} 函数执行结果
 */
async function retryAsync(fn, attemptsOrOptions = 3, initialDelayMs = 300) {
  // 兼容旧版本：attemptsOrOptions 为数字
  if (typeof attemptsOrOptions === "number") {
    const attempts = Math.max(1, Math.round(attemptsOrOptions));
    let lastErr;
    for (let i = 0; i < attempts; i += 1) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (i === attempts - 1) {
          break;
        }
        const delay = initialDelayMs * Math.pow(2, i);
        await sleep(delay);
      }
    }
    throw lastErr ?? new Error("Retry failed");
  }

  // 新版本：attemptsOrOptions 为对象
  const options = attemptsOrOptions;
  const resolved = resolveRetryConfig(DEFAULT_RETRY_CONFIG, options);
  const maxAttempts = resolved.attempts;
  const minDelayMs = resolved.minDelayMs;
  const maxDelayMs = Number.isFinite(resolved.maxDelayMs) && resolved.maxDelayMs > 0
    ? resolved.maxDelayMs
    : Number.POSITIVE_INFINITY;
  const jitter = resolved.jitter;
  const shouldRetry = options.shouldRetry ?? (() => true);
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !shouldRetry(err, attempt)) {
        break;
      }

      const retryAfterMs = options.retryAfterMs?.(err);
      const hasRetryAfter = typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs);
      const baseDelay = hasRetryAfter
        ? Math.max(retryAfterMs, minDelayMs)
        : minDelayMs * Math.pow(2, attempt - 1);
      let delay = Math.min(baseDelay, maxDelayMs);
      delay = applyJitter(delay, jitter);
      delay = Math.min(Math.max(delay, minDelayMs), maxDelayMs);

      options.onRetry?.({
        attempt,
        maxAttempts,
        delayMs: delay,
        err,
        label: options.label,
      });
      await sleep(delay);
    }
  }

  throw lastErr ?? new Error("Retry failed");
}

/**
 * 带超时的重试函数
 * @param {Function} fn - 要重试的异步函数
 * @param {Object} options - 选项
 * @param {number} [options.timeoutMs] - 超时时间（毫秒）
 * @param {number} [options.attempts] - 重试次数
 * @param {number} [options.minDelayMs] - 最小延迟
 * @param {number} [options.maxDelayMs] - 最大延迟
 * @param {number} [options.jitter] - 抖动系数
 * @param {AbortSignal} [options.abortSignal] - 中断信号
 * @returns {Promise<any>} 函数执行结果
 */
async function retryWithTimeout(fn, options = {}) {
  const timeoutMs = options.timeoutMs || 30000;
  const abortController = new AbortController();
  
  // 合并 abortSignal
  if (options.abortSignal) {
    options.abortSignal.addEventListener('abort', () => {
      abortController.abort();
    });
  }
  
  return Promise.race([
    retryAsync(fn, options),
    new Promise((_, reject) => {
      const timeout = setTimeout(() => {
        abortController.abort();
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      abortController.signal.addEventListener('abort', () => {
        clearTimeout(timeout);
      });
    })
  ]);
}

/**
 * 计算退避延迟
 * @param {Object} policy - 退避策略
 * @param {number} attempt - 当前尝试次数
 * @returns {number} 计算出的延迟毫秒数
 */
function calculateBackoff(policy = DEFAULT_BACKOFF_POLICY, attempt) {
  return computeBackoff(policy, attempt);
}

/**
 * 创建重试装饰器
 * @param {Object} options - 重试选项
 * @returns {Function} 装饰器函数
 */
function createRetryDecorator(options = {}) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      return retryAsync(() => originalMethod.apply(this, args), options);
    };
    
    return descriptor;
  };
}

/**
 * 提取重试延迟（从错误中）
 * @param {Error} error - 错误对象
 * @returns {number|undefined} 重试延迟毫秒数
 */
function extractRetryAfter(error) {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  
  // 检查常见的重试延迟字段
  if (typeof error.retryAfter === 'number') {
    return error.retryAfter;
  }
  
  if (typeof error.headers === 'object' && error.headers) {
    const retryAfter = error.headers['retry-after'] || error.headers['Retry-After'];
    if (typeof retryAfter === 'number') {
      return retryAfter * 1000;
    }
    if (typeof retryAfter === 'string') {
      const parsed = parseInt(retryAfter, 10);
      if (!isNaN(parsed)) {
        return parsed * 1000;
      }
    }
  }
  
  return undefined;
}

module.exports = {
  // 基础函数
  sleep,
  sleepWithAbort,
  computeBackoff,
  calculateBackoff,
  
  // 重试函数
  retryAsync,
  retryWithTimeout,
  createRetryDecorator,
  
  // 工具函数
  resolveRetryConfig,
  extractRetryAfter,
  applyJitter,
  clampNumber,
  asFiniteNumber,
  
  // 常量
  DEFAULT_RETRY_CONFIG,
  DEFAULT_BACKOFF_POLICY
};