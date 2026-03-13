/**
 * iFlow Retry Policy Module
 * 智能重试策略 - 参考 OpenClaw retry-policy
 */

// 默认重试配置
const RETRY_DEFAULTS = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30000,
  jitter: 0.1,  // 随机抖动比例
};

// HTTP 错误正则
const HTTP_RETRY_PATTERNS = {
  telegram: /429|timeout|connect|reset|closed|unavailable|temporarily|ETIMEDOUT|ECONNRESET/i,
  discord: /429|timeout|connect|reset|closed|unavailable|temporarily/i,
  general: /ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|502|503|504/i
};

/**
 * 创建重试策略
 */
function createRetryConfig(options = {}) {
  return {
    ...RETRY_DEFAULTS,
    ...options
  };
}

/**
 * 计算重试延迟（指数退避 + 抖动）
 */
function calculateRetryDelay(attempt, config) {
  const baseDelay = Math.min(
    config.minDelayMs * Math.pow(2, attempt - 1),
    config.maxDelayMs
  );
  
  // 添加抖动
  const jitterMs = baseDelay * config.jitter * (Math.random() - 0.5) * 2;
  
  return Math.max(0, baseDelay + jitterMs);
}

/**
 * 检查是否应该重试
 */
function shouldRetry(error, patterns = HTTP_RETRY_PATTERNS.general) {
  if (!error) return false;
  
  const message = error.message || String(error);
  return patterns.test(message);
}

/**
 * 从错误中提取 Retry-After 值（秒）
 */
function extractRetryAfter(error) {
  if (!error || typeof error !== 'object') return null;
  
  // 检查不同位置
  const candidates = [
    error.parameters?.retry_after,
    error.response?.parameters?.retry_after,
    error.error?.parameters?.retry_after,
    error.headers?.['retry-after']
  ];
  
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && candidate > 0) {
      return candidate * 1000; // 转换为毫秒
    }
  }
  
  return null;
}

/**
 * 异步重试执行
 */
async function retryAsync(fn, options = {}) {
  const config = createRetryConfig(options);
  let lastError = null;
  
  for (let attempt = 1; attempt <= config.attempts; attempt++) {
    try {
      const result = await fn();
      
      if (attempt > 1) {
        console.error(`[Retry] Success on attempt ${attempt}/${config.attempts}`);
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      // 检查是否应该重试
      if (!shouldRetry(error, options.patterns)) {
        throw error;
      }
      
      // 最后一次尝试失败，不再重试
      if (attempt >= config.attempts) {
        break;
      }
      
      // 计算延迟
      const retryAfter = extractRetryAfter(error);
      const delay = retryAfter || calculateRetryDelay(attempt, config);
      
      console.error(`[Retry] Attempt ${attempt}/${config.attempts} failed: ${error.message}. Retrying in ${Math.round(delay)}ms...`);
      
      // 等待
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * 带超时的重试
 */
async function retryWithTimeout(fn, options = {}) {
  const { timeoutMs = 60000, ...retryOptions } = options;
  
  return Promise.race([
    retryAsync(fn, retryOptions),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

module.exports = {
  RETRY_DEFAULTS,
  HTTP_RETRY_PATTERNS,
  createRetryConfig,
  calculateRetryDelay,
  shouldRetry,
  extractRetryAfter,
  retryAsync,
  retryWithTimeout
};