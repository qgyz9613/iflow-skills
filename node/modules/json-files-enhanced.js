/**
 * JSON Files Module
 * JSON 文件工具增强模块
 */

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

/**
 * Read JSON file
 * @template T
 * @param {string} filePath - 文件路径
 * @returns {Promise<T | null>}
 */
async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Write JSON atomically
 * @param {string} filePath - 文件路径
 * @param {unknown} value - 值
 * @param {Object} options - 选项
 * @param {number} options.mode - 文件权限模式
 * @param {boolean} options.trailingNewline - 是否添加尾随换行
 * @param {number} options.ensureDirMode - 目录权限模式
 */
async function writeJsonAtomic(filePath, value, options = {}) {
  const text = JSON.stringify(value, null, 2);
  await writeTextAtomic(filePath, text, {
    mode: options.mode,
    ensureDirMode: options.ensureDirMode,
    appendTrailingNewline: options.trailingNewline
  });
}

/**
 * Write text atomically
 * @param {string} filePath - 文件路径
 * @param {string} content - 内容
 * @param {Object} options - 选项
 * @param {number} options.mode - 文件权限模式
 * @param {number} options.ensureDirMode - 目录权限模式
 * @param {boolean} options.appendTrailingNewline - 是否添加尾随换行
 */
async function writeTextAtomic(filePath, content, options = {}) {
  const mode = options.mode ?? 0o600;
  const payload = options.appendTrailingNewline && !content.endsWith('\n') 
    ? `${content}\n` 
    : content;
  
  const mkdirOptions = { recursive: true };
  if (typeof options.ensureDirMode === 'number') {
    mkdirOptions.mode = options.ensureDirMode;
  }
  
  await fs.mkdir(path.dirname(filePath), mkdirOptions);
  const tmp = `${filePath}.${randomUUID()}.tmp`;
  
  try {
    await fs.writeFile(tmp, payload, 'utf8');
    try {
      await fs.chmod(tmp, mode);
    } catch {
      // best-effort; ignore on platforms without chmod
    }
    await fs.rename(tmp, filePath);
    try {
      await fs.chmod(filePath, mode);
    } catch {
      // best-effort; ignore on platforms without chmod
    }
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
  }
}

/**
 * Create async lock
 * @returns {(fn: () => Promise<T>) => Promise<T>} 加载函数
 */
function createAsyncLock() {
  let lock = Promise.resolve();
  return async function withLock(fn) {
    const prev = lock;
    let release;
    lock = new Promise(resolve => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release?.();
    }
  };
}

module.exports = {
  readJsonFile,
  writeJsonAtomic,
  writeTextAtomic,
  createAsyncLock
};