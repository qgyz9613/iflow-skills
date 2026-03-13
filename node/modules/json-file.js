/**
 * JSON File Utilities
 * JSON 文件工具 - 简化的 JSON 文件读写操作
 */

const fs = require('fs');
const path = require('path');

/**
 * 加载 JSON 文件
 * @param {string} pathname - 文件路径
 * @returns {unknown} 解析后的 JSON 对象，失败返回 undefined
 */
function loadJsonFile(pathname) {
  try {
    if (!fs.existsSync(pathname)) {
      return undefined;
    }
    const raw = fs.readFileSync(pathname, 'utf8');
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * 加载 JSON 文件（异步）
 * @param {string} pathname - 文件路径
 * @returns {Promise<unknown>} 解析后的 JSON 对象
 */
async function loadJsonFileAsync(pathname) {
  try {
    await fs.promises.access(pathname);
    const raw = await fs.promises.readFile(pathname, 'utf8');
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * 保存 JSON 文件
 * @param {string} pathname - 文件路径
 * @param {unknown} data - 要保存的数据
 * @returns {boolean} 是否成功
 */
function saveJsonFile(pathname, data) {
  try {
    const dir = path.dirname(pathname);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(pathname, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.chmodSync(pathname, 0o600);
    return true;
  } catch {
    return false;
  }
}

/**
 * 保存 JSON 文件（异步）
 * @param {string} pathname - 文件路径
 * @param {unknown} data - 要保存的数据
 * @returns {Promise<boolean>} 是否成功
 */
async function saveJsonFileAsync(pathname, data) {
  try {
    const dir = path.dirname(pathname);
    await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.promises.writeFile(pathname, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await fs.promises.chmod(pathname, 0o600);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查 JSON 文件是否存在
 * @param {string} pathname - 文件路径
 * @returns {boolean} 是否存在
 */
function jsonFileExists(pathname) {
  try {
    return fs.existsSync(pathname);
  } catch {
    return false;
  }
}

/**
 * 检查 JSON 文件是否有效
 * @param {string} pathname - 文件路径
 * @returns {boolean} 是否有效
 */
function isValidJsonFile(pathname) {
  try {
    if (!fs.existsSync(pathname)) {
      return false;
    }
    const raw = fs.readFileSync(pathname, 'utf8');
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查 JSON 文件是否有效（异步）
 * @param {string} pathname - 文件路径
 * @returns {Promise<boolean>} 是否有效
 */
async function isValidJsonFileAsync(pathname) {
  try {
    await fs.promises.access(pathname);
    const raw = await fs.promises.readFile(pathname, 'utf8');
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * 合并 JSON 文件
 * @param {string} pathname - 文件路径
 * @param {Object} data - 要合并的数据
 * @returns {boolean} 是否成功
 */
function mergeJsonFile(pathname, data) {
  const existing = loadJsonFile(pathname);
  const merged = existing ? { ...existing, ...data } : data;
  return saveJsonFile(pathname, merged);
}

/**
 * 合并 JSON 文件（异步）
 * @param {string} pathname - 文件路径
 * @param {Object} data - 要合并的数据
 * @returns {Promise<boolean>} 是否成功
 */
async function mergeJsonFileAsync(pathname, data) {
  const existing = await loadJsonFileAsync(pathname);
  const merged = existing ? { ...existing, ...data } : data;
  return await saveJsonFileAsync(pathname, merged);
}

/**
 * 更新 JSON 文件中的特定字段
 * @param {string} pathname - 文件路径
 * @param {string} key - 字段名
 * @param {unknown} value - 新值
 * @returns {boolean} 是否成功
 */
function updateJsonField(pathname, key, value) {
  const existing = loadJsonFile(pathname);
  if (!existing || typeof existing !== 'object') {
    return false;
  }
  existing[key] = value;
  return saveJsonFile(pathname, existing);
}

/**
 * 更新 JSON 文件中的特定字段（异步）
 * @param {string} pathname - 文件路径
 * @param {string} key - 字段名
 * @param {unknown} value - 新值
 * @returns {Promise<boolean>} 是否成功
 */
async function updateJsonFieldAsync(pathname, key, value) {
  const existing = await loadJsonFileAsync(pathname);
  if (!existing || typeof existing !== 'object') {
    return false;
  }
  existing[key] = value;
  return await saveJsonFileAsync(pathname, existing);
}

/**
 * 删除 JSON 文件
 * @param {string} pathname - 文件路径
 * @returns {boolean} 是否成功
 */
function deleteJsonFile(pathname) {
  try {
    if (fs.existsSync(pathname)) {
      fs.unlinkSync(pathname);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 删除 JSON 文件（异步）
 * @param {string} pathname - 文件路径
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteJsonFileAsync(pathname) {
  try {
    await fs.promises.unlink(pathname);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  loadJsonFile,
  loadJsonFileAsync,
  saveJsonFile,
  saveJsonFileAsync,
  jsonFileExists,
  isValidJsonFile,
  isValidJsonFileAsync,
  mergeJsonFile,
  mergeJsonFileAsync,
  updateJsonField,
  updateJsonFieldAsync,
  deleteJsonFile,
  deleteJsonFileAsync
};
