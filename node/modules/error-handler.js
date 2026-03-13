/**
 * iFlow Error Handler Module
 * 错误处理模块，整合自 OpenClaw 的 errors.ts 和 unhandled-rejections.ts
 */

// ==================== 错误处理函数 ====================

/**
 * 提取错误代码
 * @param {unknown} err - 错误对象
 * @returns {string|undefined} 错误代码
 */
function extractErrorCode(err) {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const code = err.code;
  if (typeof code === "string") {
    return code;
  }
  if (typeof code === "number") {
    return String(code);
  }
  return undefined;
}

/**
 * 读取错误名称
 * @param {unknown} err - 错误对象
 * @returns {string} 错误名称
 */
function readErrorName(err) {
  if (!err || typeof err !== "object") {
    return "";
  }
  const name = err.name;
  return typeof name === "string" ? name : "";
}

/**
 * 检查是否为 NodeJS.ErrnoException
 * @param {unknown} err - 错误对象
 * @returns {boolean} 是否为 ErrnoException
 */
function isErrno(err) {
  return Boolean(err && typeof err === "object" && "code" in err);
}

/**
 * 检查错误是否有特定的 errno 代码
 * @param {unknown} err - 错误对象
 * @param {string} code - 错误代码
 * @returns {boolean} 是否匹配
 */
function hasErrnoCode(err, code) {
  return isErrno(err) && err.code === code;
}

/**
 * 格式化错误消息
 * @param {unknown} err - 错误对象
 * @returns {string} 格式化后的错误消息
 */
function formatErrorMessage(err) {
  let formatted;
  if (err instanceof Error) {
    formatted = err.message || err.name || "Error";
  } else if (typeof err === "string") {
    formatted = err;
  } else if (typeof err === "number" || typeof err === "boolean" || typeof err === "bigint") {
    formatted = String(err);
  } else {
    try {
      formatted = JSON.stringify(err);
    } catch {
      formatted = Object.prototype.toString.call(err);
    }
  }
  // 安全：在返回/日志之前尽力删除敏感信息
  return redactSensitiveText(formatted);
}

/**
 * 格式化未捕获的错误
 * @param {unknown} err - 错误对象
 * @returns {string} 格式化后的错误消息
 */
function formatUncaughtError(err) {
  if (extractErrorCode(err) === "INVALID_CONFIG") {
    return formatErrorMessage(err);
  }
  if (err instanceof Error) {
    const stack = err.stack ?? err.message ?? err.name;
    return redactSensitiveText(stack);
  }
  return formatErrorMessage(err);
}

/**
 * 获取错误原因
 * @param {unknown} err - 错误对象
 * @returns {unknown} 错误原因
 */
function getErrorCause(err) {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  return err.cause;
}

/**
 * 提取错误代码或 errno
 * @param {unknown} err - 错误对象
 * @returns {string|undefined} 错误代码或 errno
 */
function extractErrorCodeOrErrno(err) {
  const code = extractErrorCode(err);
  if (code) {
    return code.trim().toUpperCase();
  }
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const errno = err.errno;
  if (typeof errno === "string" && errno.trim()) {
    return errno.trim().toUpperCase();
  }
  if (typeof errno === "number" && Number.isFinite(errno)) {
    return String(errno);
  }
  return undefined;
}

// ==================== 错误分类 ====================

/**
 * 致命错误代码集合
 */
const FATAL_ERROR_CODES = new Set([
  "ERR_OUT_OF_MEMORY",
  "ERR_SCRIPT_EXECUTION_TIMEOUT",
  "ERR_WORKER_OUT_OF_MEMORY",
  "ERR_WORKER_UNCAUGHT_EXCEPTION",
  "ERR_WORKER_INITIALIZATION_FAILED",
]);

/**
 * 配置错误代码集合
 */
const CONFIG_ERROR_CODES = new Set([
  "INVALID_CONFIG",
  "MISSING_API_KEY",
  "MISSING_CREDENTIALS",
]);

/**
 * 瞬态网络错误代码集合
 */
const TRANSIENT_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
  "ECONNABORTED",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_DNS_RESOLVE_FAILED",
  "UND_ERR_CONNECT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "EPROTO",
  "ERR_SSL_WRONG_VERSION_NUMBER",
  "ERR_SSL_PROTOCOL_RETURNED_AN_ERROR",
]);

/**
 * 瞬态网络错误名称集合
 */
const TRANSIENT_NETWORK_ERROR_NAMES = new Set([
  "AbortError",
  "ConnectTimeoutError",
  "HeadersTimeoutError",
  "BodyTimeoutError",
  "TimeoutError",
]);

/**
 * 瞬态网络错误消息正则表达式
 */
const TRANSIENT_NETWORK_MESSAGE_CODE_RE = /\b(ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNABORTED|EPIPE|EHOSTUNREACH|ENETUNREACH|EAI_AGAIN|EPROTO|UND_ERR_CONNECT_TIMEOUT|UND_ERR_DNS_RESOLVE_FAILED|UND_ERR_CONNECT|UND_ERR_SOCKET|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT)\b/i;

/**
 * 瞬态网络错误消息片段
 */
const TRANSIENT_NETWORK_MESSAGE_SNIPPETS = [
  "getaddrinfo",
  "socket hang up",
  "client network socket disconnected before secure tls connection was established",
  "network error",
  "network is unreachable",
  "temporary failure in name resolution",
  "tlsv1 alert",
  "ssl routines",
  "packet length too long",
  "write eproto",
];

/**
 * 检查是否为包装的 fetch 失败消息
 * @param {string} message - 错误消息
 * @returns {boolean} 是否为包装的 fetch 失败
 */
function isWrappedFetchFailedMessage(message) {
  if (message === "fetch failed") {
    return true;
  }
  // 保留包装变体（例如 "...: fetch failed"），同时避免广泛匹配
  // 如 "Web fetch failed (404): ..." 这样的非传输失败
  return /:\s*fetch failed$/.test(message);
}

/**
 * 检查错误是否为致命错误
 * @param {unknown} err - 错误对象
 * @returns {boolean} 是否为致命错误
 */
function isFatalError(err) {
  const code = extractErrorCodeOrErrno(err);
  return code ? FATAL_ERROR_CODES.has(code) : false;
}

/**
 * 检查错误是否为配置错误
 * @param {unknown} err - 错误对象
 * @returns {boolean} 是否为配置错误
 */
function isConfigError(err) {
  const code = extractErrorCodeOrErrno(err);
  return code ? CONFIG_ERROR_CODES.has(code) : false;
}

/**
 * 检查错误是否为瞬态网络错误
 * @param {unknown} err - 错误对象
 * @returns {boolean} 是否为瞬态网络错误
 */
function isTransientNetworkError(err) {
  // 检查错误代码
  const code = extractErrorCodeOrErrno(err);
  if (code && TRANSIENT_NETWORK_CODES.has(code)) {
    return true;
  }

  // 检查错误名称
  const name = readErrorName(err);
  if (name && TRANSIENT_NETWORK_ERROR_NAMES.has(name)) {
    return true;
  }

  // 检查错误消息
  const message = formatErrorMessage(err);
  if (TRANSIENT_NETWORK_MESSAGE_CODE_RE.test(message)) {
    return true;
  }

  // 检查错误消息片段
  if (TRANSIENT_NETWORK_MESSAGE_SNIPPETS.some(snippet => message.toLowerCase().includes(snippet.toLowerCase()))) {
    return true;
  }

  // 检查包装的 fetch 失败
  if (isWrappedFetchFailedMessage(message)) {
    return true;
  }

  return false;
}

/**
 * 收集错误图候选
 * @param {unknown} err - 错误对象
 * @param {Function} resolveNested - 解析嵌套错误的函数
 * @returns {unknown[]} 错误候选列表
 */
function collectErrorGraphCandidates(err, resolveNested) {
  const queue = [err];
  const seen = new Set();
  const candidates = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null || seen.has(current)) {
      continue;
    }
    seen.add(current);
    candidates.push(current);

    if (!current || typeof current !== "object" || !resolveNested) {
      continue;
    }
    for (const nested of resolveNested(current)) {
      if (nested != null && !seen.has(nested)) {
        queue.push(nested);
      }
    }
  }

  return candidates;
}

// ==================== 敏感信息脱敏 ====================

/**
 * 敏感信息模式
 */
const SENSITIVE_PATTERNS = [
  // API 密钥
  /\b[A-Za-z0-9]{32,}\b/g,
  // Bearer token
  /Bearer\s+[A-Za-z0-9\-._~+/]+/gi,
  // 密码字段
  /(["']?password["']?\s*[:=]\s*)(["']?)[^"'\s,}]+/gi,
  // Token 字段
  /(["']?token["']?\s*[:=]\s*)(["']?)[^"'\s,}]+/gi,
  // API key 字段
  /(["']?api[_-]?key["']?\s*[:=]\s*)(["']?)[^"'\s,}]+/gi,
  // Secret 字段
  /(["']?secret["']?\s*[:=]\s*)(["']?)[^"'\s,}]+/gi,
];

/**
 * 删除敏感文本
 * @param {string} text - 原始文本
 * @returns {string} 脱敏后的文本
 */
function redactSensitiveText(text) {
  if (typeof text !== "string") {
    return String(text);
  }

  let result = text;
  
  // 应用所有敏感信息模式
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match, prefix, quote) => {
      if (prefix) {
        return `${prefix}${quote || ''}***REDACTED***`;
      }
      return '***REDACTED***';
    });
  }

  return result;
}

// ==================== 未处理的 Promise 拒绝处理 ====================

/**
 * 未处理的 Promise 拒绝处理器集合
 */
const unhandledRejectionHandlers = new Set();

/**
 * 添加未处理的 Promise 拒绝处理器
 * @param {Function} handler - 处理器函数
 * @returns {Function} 移除处理器的函数
 */
function addUnhandledRejectionHandler(handler) {
  unhandledRejectionHandlers.add(handler);
  return () => unhandledRejectionHandlers.delete(handler);
}

/**
 * 处理未处理的 Promise 拒绝
 * @param {unknown} reason - 拒绝原因
 * @returns {boolean} 是否已处理
 */
function handleUnhandledRejection(reason) {
  for (const handler of unhandledRejectionHandlers) {
    if (handler(reason)) {
      return true;
    }
  }
  
  // 默认处理
  const isFatal = isFatalError(reason);
  const isConfig = isConfigError(reason);
  const isNetwork = isTransientNetworkError(reason);
  
  if (isFatal) {
    console.error('[ErrorHandler] Fatal unhandled rejection:', formatUncaughtError(reason));
    process.exit(1);
  } else if (isConfig) {
    console.error('[ErrorHandler] Config error:', formatUncaughtError(reason));
    return true;
  } else if (isNetwork) {
    console.warn('[ErrorHandler] Transient network error:', formatUncaughtError(reason));
    return true;
  } else {
    console.error('[ErrorHandler] Unhandled rejection:', formatUncaughtError(reason));
    return false;
  }
}

/**
 * 设置全局未处理的 Promise 拒绝处理
 */
function setupUnhandledRejectionHandler() {
  process.on('unhandledRejection', (reason) => {
    handleUnhandledRejection(reason);
  });
}

/**
 * 移除全局未处理的 Promise 拒绝处理
 */
function removeUnhandledRejectionHandler() {
  process.removeAllListeners('unhandledRejection');
}

// ==================== 错误包装器 ====================

/**
 * 创建错误包装器
 * @param {Error} originalError - 原始错误
 * @param {string} message - 新消息
 * @returns {Error} 包装后的错误
 */
function wrapError(originalError, message) {
  const error = new Error(message, { cause: originalError });
  error.name = `${readErrorName(originalError)}Wrapper`;
  return error;
}

/**
 * 创建重试错误
 * @param {Error} originalError - 原始错误
 * @param {number} attempt - 当前尝试次数
 * @returns {Error} 重试错误
 */
function createRetryError(originalError, attempt) {
  const message = `Retry attempt ${attempt} failed: ${formatErrorMessage(originalError)}`;
  return wrapError(originalError, message);
}

// ==================== 导出 ====================

module.exports = {
  // 错误提取和格式化
  extractErrorCode,
  readErrorName,
  formatErrorMessage,
  formatUncaughtError,
  getErrorCause,
  extractErrorCodeOrErrno,
  
  // 错误类型检查
  isErrno,
  hasErrnoCode,
  isFatalError,
  isConfigError,
  isTransientNetworkError,
  isWrappedFetchFailedMessage,
  
  // 错误图
  collectErrorGraphCandidates,
  
  // 敏感信息脱敏
  redactSensitiveText,
  
  // 未处理的 Promise 拒绝
  addUnhandledRejectionHandler,
  handleUnhandledRejection,
  setupUnhandledRejectionHandler,
  removeUnhandledRejectionHandler,
  
  // 错误包装器
  wrapError,
  createRetryError,
  
  // 常量
  FATAL_ERROR_CODES,
  CONFIG_ERROR_CODES,
  TRANSIENT_NETWORK_CODES,
  TRANSIENT_NETWORK_ERROR_NAMES
};