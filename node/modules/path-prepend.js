/**
 * PATH 环境变量操作模块
 * 安全地添加路径到 PATH 环境变量，处理 Windows PATH 大小写问题
 */

const path = require('node:path');

/**
 * 查找 PATH 在环境对象中使用的实际键名
 * 在 Windows 上，process.env 将其存储为 "Path"（而不是 "PATH"）
 * 复制到普通对象后，原始大小写被保留，所以必须查找实际键名
 */
function findPathKey(env) {
  if ('PATH' in env) {
    return 'PATH';
  }
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === 'PATH') {
      return key;
    }
  }
  return 'PATH';
}

/**
 * 规范化 PATH 前缀条目，去重和清理
 */
function normalizePathPrepend(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  const seen = new Set();
  const normalized = [];
  for (const entry of entries) {
    if (typeof entry !== 'string') {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

/**
 * 合并 PATH 前缀到现有 PATH
 */
function mergePathPrepend(existing, prepend) {
  if (prepend.length === 0) {
    return existing;
  }
  const partsExisting = (existing ?? '')
    .split(path.delimiter)
    .map((part) => part.trim())
    .filter(Boolean);
  const merged = [];
  const seen = new Set();
  for (const part of [...prepend, ...partsExisting]) {
    if (seen.has(part)) {
      continue;
    }
    seen.add(part);
    merged.push(part);
  }
  return merged.join(path.delimiter);
}

/**
 * 应用 PATH 前缀到环境对象
 */
function applyPathPrepend(env, prepend, options = {}) {
  if (!Array.isArray(prepend) || prepend.length === 0) {
    return;
  }
  // 在 Windows 上，PATH 键可能存储为 "Path"（不区分大小写的环境变量）
  // 强制转换为普通对象后，原始大小写被保留，所以必须查找实际键名来读取现有值并写回合并结果
  const pathKey = findPathKey(env);
  if (options.requireExisting && !env[pathKey]) {
    return;
  }
  const merged = mergePathPrepend(env[pathKey], prepend);
  if (merged) {
    env[pathKey] = merged;
  }
}

module.exports = {
  findPathKey,
  normalizePathPrepend,
  mergePathPrepend,
  applyPathPrepend
};