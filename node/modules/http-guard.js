/**
 * iFlow HTTP Guard Module
 * HTTP 请求防护模块，整合自 OpenClaw 的 http-body.ts
 */

/**
 * 默认最大请求体大小（1MB）
 */
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

/**
 * 默认请求体超时时间（30秒）
 */
const DEFAULT_BODY_TIMEOUT_MS = 30000;

/**
 * 请求体限制错误代码
 */
const RequestBodyLimitErrorCode = {
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  REQUEST_BODY_TIMEOUT: 'REQUEST_BODY_TIMEOUT',
  CONNECTION_CLOSED: 'CONNECTION_CLOSED'
};

/**
 * 请求体限制错误类
 */
class RequestBodyLimitError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RequestBodyLimitError';
    this.code = code;
    this.statusCode = this.getStatusCode(code);
  }

  /**
   * 获取状态码
   * @param {string} code - 错误代码
   * @returns {number} HTTP 状态码
   */
  getStatusCode(code) {
    const statusCodes = {
      [RequestBodyLimitErrorCode.PAYLOAD_TOO_LARGE]: 413,
      [RequestBodyLimitErrorCode.REQUEST_BODY_TIMEOUT]: 408,
      [RequestBodyLimitErrorCode.CONNECTION_CLOSED]: 400
    };
    return statusCodes[code] || 500;
  }
}

/**
 * 检查是否为请求体限制错误
 * @param {unknown} error - 错误对象
 * @param {string} [code] - 错误代码
 * @returns {boolean} 是否为请求体限制错误
 */
function isRequestBodyLimitError(error, code) {
  if (!(error instanceof RequestBodyLimitError)) {
    return false;
  }
  if (!code) {
    return true;
  }
  return error.code === code;
}

/**
 * 解析 Content-Length 头
 * @param {Object} headers - 请求头
 * @returns {number|null} Content-Length 值
 */
function parseContentLengthHeader(headers) {
  const header = headers['content-length'];
  const raw = Array.isArray(header) ? header[0] : header;
  
  if (typeof raw !== 'string') {
    return null;
  }
  
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  
  return parsed;
}

/**
 * 解析请求体限制值
 * @param {Object} options - 选项
 * @param {number} options.maxBytes - 最大字节数
 * @param {number} [options.timeoutMs] - 超时时间（毫秒）
 * @returns {Object} 解析后的值
 */
function resolveRequestBodyLimitValues(options) {
  const maxBytes = Number.isFinite(options.maxBytes)
    ? Math.max(1, Math.floor(options.maxBytes))
    : DEFAULT_MAX_BODY_BYTES;
  const timeoutMs = typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs)
    ? Math.max(1, Math.floor(options.timeoutMs))
    : DEFAULT_BODY_TIMEOUT_MS;
  
  return { maxBytes, timeoutMs };
}

/**
 * 读取请求体
 * @param {Object} req - 请求对象
 * @param {Object} options - 选项
 * @param {number} [options.maxBytes] - 最大字节数
 * @param {number} [options.timeoutMs] - 超时时间（毫秒）
 * @param {string} [options.encoding] - 编码
 * @returns {Promise<Buffer|string>} 请求体
 */
async function readRequestBody(req, options = {}) {
  const { maxBytes, timeoutMs } = resolveRequestBodyLimitValues(options);
  const encoding = options.encoding || 'utf8';

  // 检查 Content-Length
  const contentLength = parseContentLengthHeader(req.headers || {});
  if (contentLength !== null && contentLength > maxBytes) {
    throw new RequestBodyLimitError(
      RequestBodyLimitErrorCode.PAYLOAD_TOO_LARGE,
      `Payload too large: ${contentLength} bytes (max: ${maxBytes})`
    );
  }

  return new Promise((resolve, reject) => {
    let chunks = [];
    let totalBytes = 0;
    let isComplete = false;

    const timeout = setTimeout(() => {
      if (!isComplete) {
        isComplete = true;
        req.destroy();
        reject(new RequestBodyLimitError(
          RequestBodyLimitErrorCode.REQUEST_BODY_TIMEOUT,
          `Request body timeout after ${timeoutMs}ms`
        ));
      }
    }, timeoutMs);

    req.on('data', (chunk) => {
      if (isComplete) return;

      totalBytes += chunk.length;
      
      if (totalBytes > maxBytes) {
        isComplete = true;
        req.destroy();
        clearTimeout(timeout);
        reject(new RequestBodyLimitError(
          RequestBodyLimitErrorCode.PAYLOAD_TOO_LARGE,
          `Payload too large: ${totalBytes} bytes (max: ${maxBytes})`
        ));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (isComplete) return;
      isComplete = true;
      clearTimeout(timeout);

      const body = Buffer.concat(chunks);
      resolve(encoding ? body.toString(encoding) : body);
    });

    req.on('error', (err) => {
      if (isComplete) return;
      isComplete = true;
      clearTimeout(timeout);
      reject(new RequestBodyLimitError(
        RequestBodyLimitErrorCode.CONNECTION_CLOSED,
        `Connection closed: ${err.message}`
      ));
    });

    req.on('close', () => {
      if (isComplete) return;
      isComplete = true;
      clearTimeout(timeout);
      reject(new RequestBodyLimitError(
        RequestBodyLimitErrorCode.CONNECTION_CLOSED,
        'Connection closed'
      ));
    });
  });
}

/**
 * 创建请求体中间件
 * @param {Object} options - 选项
 * @param {number} [options.maxBytes] - 最大字节数
 * @param {number} [options.timeoutMs] - 超时时间（毫秒）
 * @param {string} [options.encoding] - 编码
 * @returns {Function} 中间件函数
 */
function createBodyGuardMiddleware(options = {}) {
  return async (req, res, next) => {
    try {
      req.body = await readRequestBody(req, options);
      next();
    } catch (err) {
      if (isRequestBodyLimitError(err)) {
        res.statusCode = err.statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: err.code,
          message: err.message
        }));
      } else {
        next(err);
      }
    }
  };
}

/**
 * 验证请求体大小
 * @param {Object} headers - 请求头
 * @param {number} maxSize - 最大大小
 * @returns {boolean} 是否有效
 */
function validateRequestBodySize(headers, maxSize = DEFAULT_MAX_BODY_BYTES) {
  const contentLength = parseContentLengthHeader(headers);
  if (contentLength === null) {
    return true;
  }
  return contentLength <= maxSize;
}

/**
 * 创建大小验证中间件
 * @param {number} maxSize - 最大大小
 * @returns {Function} 中间件函数
 */
function createSizeValidationMiddleware(maxSize = DEFAULT_MAX_BODY_BYTES) {
  return (req, res, next) => {
    if (!validateRequestBodySize(req.headers, maxSize)) {
      const contentLength = parseContentLengthHeader(req.headers);
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: RequestBodyLimitErrorCode.PAYLOAD_TOO_LARGE,
        message: `Payload too large: ${contentLength} bytes (max: ${maxSize})`
      }));
      return;
    }
    next();
  };
}

module.exports = {
  // 常量
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_BODY_TIMEOUT_MS,
  RequestBodyLimitErrorCode,
  RequestBodyLimitError,
  
  // 核心函数
  readRequestBody,
  parseContentLengthHeader,
  resolveRequestBodyLimitValues,
  validateRequestBodySize,
  isRequestBodyLimitError,
  
  // 中间件
  createBodyGuardMiddleware,
  createSizeValidationMiddleware
};