/**
 * File Atomic Operations
 * 原子文件操作 - 防止数据损坏的文件读写操作
 */

const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

/**
 * 读取 JSON 文件
 * @param {string} filePath - 文件路径
 * @returns {Promise<any|null>} 解析后的 JSON 对象，失败返回 null
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
 * 原子写入 JSON 文件
 * @param {string} filePath - 文件路径
 * @param {any} value - 要写入的值
 * @param {Object} options - 选项
 * @param {number} options.mode - 文件权限模式
 * @param {boolean} options.trailingNewline - 是否添加尾随换行符
 * @param {number} options.ensureDirMode - 确保目录存在的权限模式
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
 * 原子写入文本文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @param {Object} options - 选项
 * @param {number} options.mode - 文件权限模式
 * @param {boolean} options.appendTrailingNewline - 是否添加尾随换行符
 * @param {number} options.ensureDirMode - 确保目录存在的权限模式
 */
async function writeTextAtomic(filePath, content, options = {}) {
  const mode = options.mode ?? 0o600;
  const payload = options.appendTrailingNewline && !content.endsWith('\n') 
    ? `${content}\n` 
    : content;
  const mkdirOptions = { recursive: true };
  if (typeof options?.ensureDirMode === 'number') {
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
 * 创建异步锁
 * @returns {Function} 带锁的执行函数
 */
function createAsyncLock() {
  let lock = Promise.resolve();
  return async function withLock(fn) {
    const prev = lock;
    let release;
    lock = new Promise((resolve) => {
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

/**
 * 读取文本文件
 * @param {string} filePath - 文件路径
 * @param {Object} options - 选项
 * @param {string} options.encoding - 文件编码
 * @returns {Promise<string|null>} 文件内容，失败返回 null
 */
async function readTextFile(filePath, options = {}) {
  try {
    return await fs.readFile(filePath, options.encoding || 'utf8');
  } catch {
    return null;
  }
}

/**
 * 检查文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 文件是否存在
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 删除文件
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 是否成功删除
 */
async function removeFile(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 确保目录存在
 * @param {string} dirPath - 目录路径
 * @param {Object} options - 选项
 * @param {number} options.mode - 目录权限模式
 * @returns {Promise<void>}
 */
async function ensureDir(dirPath, options = {}) {
  const mkdirOptions = { recursive: true };
  if (typeof options?.mode === 'number') {
    mkdirOptions.mode = options.mode;
  }
  await fs.mkdir(dirPath, mkdirOptions);
}

module.exports = {
  readJsonFile,
  writeJsonAtomic,
  writeTextAtomic,
  createAsyncLock,
  readTextFile,
  fileExists,
  removeFile,
  ensureDir
};