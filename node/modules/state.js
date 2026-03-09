/**
 * iFlow State Module
 * 持久化状态管理
 */

const path = require('path');
const fs = require('fs');

const STATE_DIR = path.join(__dirname, '..', 'state-data');
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

const STATE_FILE = path.join(STATE_DIR, 'state.json');

// 加载状态
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

// 保存状态
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

let state = loadState();

// 获取状态
function get(key) {
  const start = Date.now();
  try {
    // 参数类型校验
    if (key === null || key === undefined) {
      return { status: 'ok', value: state, key: null, time: Date.now() - start };
    }
    if (typeof key !== 'string') {
      key = String(key);
    }
    
    const keys = key.split('.');
    let value = state;
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return { status: 'ok', value: null, key, time: Date.now() - start };
      }
    }
    
    return { status: 'ok', value, key, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 设置状态
function set(key, value) {
  const start = Date.now();
  try {
    // 参数类型校验
    if (key === null || key === undefined) {
      return { status: 'error', message: 'Key is required', time: Date.now() - start };
    }
    if (typeof key !== 'string') {
      key = String(key);
    }
    
    const keys = key.split('.');
    let current = state;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k]) current[k] = {};
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
    saveState(state);
    
    return { status: 'ok', key, value, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 列出所有键
function list(prefix = '') {
  const start = Date.now();
  try {
    const keys = [];
    
    function extractKeys(obj, path = '') {
      for (const key in obj) {
        const fullKey = path ? `${path}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          extractKeys(obj[key], fullKey);
        } else {
          if (!prefix || fullKey.startsWith(prefix)) {
            keys.push(fullKey);
          }
        }
      }
    }
    
    extractKeys(state);
    
    return { status: 'ok', keys, total: keys.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 删除状态
function deleteState(key) {
  const start = Date.now();
  try {
    const keys = key.split('.');
    let current = state;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k]) {
        return { status: 'ok', deleted: false, key, time: Date.now() - start };
      }
      current = current[k];
    }
    
    const lastKey = keys[keys.length - 1];
    if (current.hasOwnProperty(lastKey)) {
      delete current[lastKey];
      saveState(state);
      return { status: 'ok', deleted: true, key, time: Date.now() - start };
    }
    
    return { status: 'ok', deleted: false, key, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 清空状态
function clear() {
  const start = Date.now();
  try {
    state = {};
    saveState(state);
    
    return { status: 'ok', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 导出状态
function exportState() {
  const start = Date.now();
  return { status: 'ok', state, time: Date.now() - start };
}

// 导入状态
function importState(newState, merge = true) {
  const start = Date.now();
  try {
    if (merge) {
      Object.assign(state, newState);
    } else {
      state = newState;
    }
    saveState(state);
    
    return { status: 'ok', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

module.exports = {
  get,
  set,
  list,
  delete: deleteState,
  clear,
  exportState,
  importState
};
