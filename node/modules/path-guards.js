/**
 * Path Guards Module
 * 路径防护模块，增强路径处理和安全性
 */

const path = require('path');

const NOT_FOUND_CODES = new Set(['ENOENT', 'ENOTDIR']);
const SYMLINK_OPEN_CODES = new Set(['ELOOP', 'EINVAL', 'ENOTSUP']);

/**
 * Normalize Windows path for comparison
 * @param {string} input - 输入路径
 * @returns {string} 规范化后的路径
 */
function normalizeWindowsPathForComparison(input) {
  let normalized = path.win32.normalize(input);
  if (normalized.startsWith('\\\\?\\')) {
    normalized = normalized.slice(4);
    if (normalized.toUpperCase().startsWith('UNC\\')) {
      normalized = `\\\\${normalized.slice(4)}`;
    }
  }
  return normalized.replaceAll('/', '\\').toLowerCase();
}

/**
 * Check if value is a Node.js error
 * @param {unknown} value - 值
 * @returns {value is NodeJS.ErrnoException}
 */
function isNodeError(value) {
  return Boolean(
    value && typeof value === 'object' && 'code' in value
  );
}

/**
 * Check if error has specific code
 * @param {unknown} value - 值
 * @param {string} code - 错误代码
 * @returns {boolean}
 */
function hasNodeErrorCode(value, code) {
  return isNodeError(value) && value.code === code;
}

/**
 * Check if error is a "not found" path error
 * @param {unknown} value - 值
 * @returns {boolean}
 */
function isNotFoundPathError(value) {
  return isNodeError(value) && typeof value.code === 'string' && NOT_FOUND_CODES.has(value.code);
}

/**
 * Check if error is a symlink open error
 * @param {unknown} value - 值
 * @returns {boolean}
 */
function isSymlinkOpenError(value) {
  return isNodeError(value) && typeof value.code === 'string' && SYMLINK_OPEN_CODES.has(value.code);
}

/**
 * Check if target path is inside root path
 * @param {string} root - 根路径
 * @param {string} target - 目标路径
 * @returns {boolean}
 */
function isPathInside(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);

  if (process.platform === 'win32') {
    const rootForCompare = normalizeWindowsPathForComparison(resolvedRoot);
    const targetForCompare = normalizeWindowsPathForComparison(resolvedTarget);
    const relative = path.win32.relative(rootForCompare, targetForCompare);
    return relative === '' || (!relative.startsWith('..') && !path.win32.isAbsolute(relative));
  }

  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

module.exports = {
  normalizeWindowsPathForComparison,
  isNodeError,
  hasNodeErrorCode,
  isNotFoundPathError,
  isSymlinkOpenError,
  isPathInside
};