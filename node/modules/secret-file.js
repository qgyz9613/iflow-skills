/**
 * Secret File Loading
 * 安全密钥文件加载 - 安全地从文件读取 API 密钥和敏感信息
 */

const fs = require('fs');
const path = require('path');
const { fileSecurity } = require('./file-security');

/**
 * 默认密钥文件最大字节数（16KB）
 */
const DEFAULT_SECRET_FILE_MAX_BYTES = 16 * 1024;

/**
 * 加载密钥文件（同步）
 * @param {string} filePath - 文件路径
 * @param {string} label - 密钥标签（用于错误消息）
 * @param {Object} options - 选项
 * @param {number} [options.maxBytes] - 最大字节数
 * @param {boolean} [options.rejectSymlink] - 是否拒绝符号链接
 * @returns {SecretFileReadResult} 读取结果
 */
function loadSecretFileSync(filePath, label, options = {}) {
  const trimmedPath = filePath.trim();
  const resolvedPath = resolveUserPath(trimmedPath);
  
  if (!resolvedPath) {
    return { ok: false, message: `${label} file path is empty.` };
  }

  const maxBytes = options.maxBytes ?? DEFAULT_SECRET_FILE_MAX_BYTES;

  // 预检查文件状态
  let previewStat;
  try {
    previewStat = fs.lstatSync(resolvedPath);
  } catch (error) {
    return {
      ok: false,
      resolvedPath,
      error,
      message: `Failed to inspect ${label} file at ${resolvedPath}: ${String(error)}`
    };
  }

  // 安全检查
  if (options.rejectSymlink && previewStat.isSymbolicLink()) {
    return {
      ok: false,
      resolvedPath,
      message: `${label} file at ${resolvedPath} must not be a symlink.`
    };
  }
  
  if (!previewStat.isFile()) {
    return {
      ok: false,
      resolvedPath,
      message: `${label} file at ${resolvedPath} must be a regular file.`
    };
  }
  
  if (previewStat.size > maxBytes) {
    return {
      ok: false,
      resolvedPath,
      message: `${label} file at ${resolvedPath} exceeds ${maxBytes} bytes.`
    };
  }

  // 使用安全的文件打开方法
  const opened = fileSecurity.openVerifiedFileSync({
    filePath: resolvedPath,
    rejectPathSymlink: options.rejectSymlink,
    maxBytes,
    allowedType: 'file'
  });

  if (!opened.ok) {
    const error = opened.reason === 'validation' 
      ? new Error('security validation failed') 
      : opened.error;
    return {
      ok: false,
      resolvedPath,
      error,
      message: `Failed to read ${label} file at ${resolvedPath}: ${String(error)}`
    };
  }

  try {
    const raw = fs.readFileSync(opened.fd, 'utf8');
    const secret = raw.trim();
    
    if (!secret) {
      return {
        ok: false,
        resolvedPath,
        message: `${label} file at ${resolvedPath} is empty.`
      };
    }
    
    return { ok: true, secret, resolvedPath };
  } catch (error) {
    return {
      ok: false,
      resolvedPath,
      error,
      message: `Failed to read ${label} file at ${resolvedPath}: ${String(error)}`
    };
  } finally {
    if (opened.ok) {
      fs.closeSync(opened.fd);
    }
  }
}

/**
 * 加载密钥文件（异步）
 * @param {string} filePath - 文件路径
 * @param {string} label - 密钥标签
 * @param {Object} options - 选项
 * @returns {Promise<SecretFileReadResult>} 读取结果
 */
async function loadSecretFile(filePath, label, options = {}) {
  const fsPromises = require('fs/promises');
  const trimmedPath = filePath.trim();
  const resolvedPath = resolveUserPath(trimmedPath);
  
  if (!resolvedPath) {
    return { ok: false, message: `${label} file path is empty.` };
  }

  const maxBytes = options.maxBytes ?? DEFAULT_SECRET_FILE_MAX_BYTES;

  // 预检查文件状态
  let previewStat;
  try {
    previewStat = await fsPromises.lstat(resolvedPath);
  } catch (error) {
    return {
      ok: false,
      resolvedPath,
      error,
      message: `Failed to inspect ${label} file at ${resolvedPath}: ${String(error)}`
    };
  }

  // 安全检查
  if (options.rejectSymlink && previewStat.isSymbolicLink()) {
    return {
      ok: false,
      resolvedPath,
      message: `${label} file at ${resolvedPath} must not be a symlink.`
    };
  }
  
  if (!previewStat.isFile()) {
    return {
      ok: false,
      resolvedPath,
      message: `${label} file at ${resolvedPath} must be a regular file.`
    };
  }
  
  if (previewStat.size > maxBytes) {
    return {
      ok: false,
      resolvedPath,
      message: `${label} file at ${resolvedPath} exceeds ${maxBytes} bytes.`
    };
  }

  // 读取文件内容
  try {
    const raw = await fsPromises.readFile(resolvedPath, 'utf8');
    const secret = raw.trim();
    
    if (!secret) {
      return {
        ok: false,
        resolvedPath,
        message: `${label} file at ${resolvedPath} is empty.`
      };
    }
    
    return { ok: true, secret, resolvedPath };
  } catch (error) {
    return {
      ok: false,
      resolvedPath,
      error,
      message: `Failed to read ${label} file at ${resolvedPath}: ${String(error)}`
    };
  }
}

/**
 * 解析用户路径
 * @param {string} userPath - 用户提供的路径
 * @returns {string|null} 解析后的路径
 */
function resolveUserPath(userPath) {
  const trimmed = userPath?.trim();
  if (!trimmed) {
    return null;
  }
  
  if (path.isAbsolute(trimmed)) {
    return path.normalize(trimmed);
  }
  
  // 相对于用户主目录
  const home = process.env.HOME || process.env.USERPROFILE || require('os').homedir();
  if (!home) {
    return null;
  }
  
  return path.normalize(path.join(home, trimmed));
}

/**
 * 验证密钥文件
 * @param {string} filePath - 文件路径
 * @param {Object} options - 选项
 * @returns {Object} 验证结果
 */
function validateSecretFile(filePath, options = {}) {
  const trimmedPath = filePath.trim();
  const resolvedPath = resolveUserPath(trimmedPath);
  
  if (!resolvedPath) {
    return {
      valid: false,
      path: filePath,
      message: 'Path is empty or invalid'
    };
  }

  const maxBytes = options.maxBytes ?? DEFAULT_SECRET_FILE_MAX_BYTES;

  // 检查文件状态
  try {
    const stat = fs.lstatSync(resolvedPath);
    
    if (options.rejectSymlink && stat.isSymbolicLink()) {
      return {
        valid: false,
        path: resolvedPath,
        message: 'File is a symbolic link'
      };
    }
    
    if (!stat.isFile()) {
      return {
        valid: false,
        path: resolvedPath,
        message: 'Not a regular file'
      };
    }
    
    if (stat.size > maxBytes) {
      return {
        valid: false,
        path: resolvedPath,
        message: `File size (${stat.size}) exceeds limit (${maxBytes})`
      };
    }
    
    return {
      valid: true,
      path: resolvedPath,
      size: stat.size,
      message: 'File is valid'
    };
  } catch (error) {
    return {
      valid: false,
      path: resolvedPath,
      message: `Cannot access file: ${String(error)}`
    };
  }
}

/**
 * 从环境变量或文件加载密钥
 * @param {string} envKey - 环境变量键
 * @param {string} filePath - 文件路径
 * @param {string} label - 密钥标签
 * @param {Object} options - 选项
 * @returns {SecretFileReadResult} 加载结果
 */
function loadSecretFromEnvOrFile(envKey, filePath, label, options = {}) {
  // 优先从环境变量读取
  const envValue = process.env[envKey]?.trim();
  if (envValue) {
    return { 
      ok: true, 
      secret: envValue, 
      resolvedPath: `env:${envKey}`,
      source: 'environment'
    };
  }
  
  // 从文件读取
  const fileResult = loadSecretFileSync(filePath, label, options);
  if (fileResult.ok) {
    return { ...fileResult, source: 'file' };
  }
  
  return fileResult;
}

module.exports = {
  DEFAULT_SECRET_FILE_MAX_BYTES,
  loadSecretFileSync,
  loadSecretFile,
  validateSecretFile,
  loadSecretFromEnvOrFile,
  resolveUserPath
};