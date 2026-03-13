/**
 * iFlow Hooks Module - 插件钩子系统
 * 参考 OpenClaw 的生命周期钩子设计
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const HOOKS_DIR = path.join(__dirname, '..', 'hooks-data');
if (!fs.existsSync(HOOKS_DIR)) fs.mkdirSync(HOOKS_DIR, { recursive: true });

// ========== 钩子类型定义 ==========
const HOOK_TYPES = {
  // 代理生命周期
  beforeAgentStart: { priority: 1, async: true },
  afterAgentEnd: { priority: 1, async: true },
  
  // 模型调用
  beforeModelResolve: { priority: 2, async: true },
  beforePromptBuild: { priority: 2, async: true },
  
  // 工具调用
  beforeToolCall: { priority: 3, async: true },
  afterToolCall: { priority: 3, async: true },
  
  // 压缩
  beforeCompaction: { priority: 2, async: true },
  afterCompaction: { priority: 2, async: true },
  
  // 子代理
  subagentSpawning: { priority: 2, async: true },
  subagentEnded: { priority: 2, async: true },
  
  // 消息
  messageReceived: { priority: 1, async: false },
  messageSending: { priority: 1, async: false },
  
  // 心跳
  beforeHeartbeat: { priority: 1, async: false },
  afterHeartbeat: { priority: 1, async: false },
  
  // 技能
  beforeSkillExecute: { priority: 2, async: true },
  afterSkillExecute: { priority: 2, async: true }
};

// ========== 钩子注册表 ==========
let hooksRegistry = {};

// 加载持久化的钩子
function loadHooks() {
  const registryPath = path.join(HOOKS_DIR, 'registry.json');
  if (fs.existsSync(registryPath)) {
    try {
      hooksRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    } catch (e) {
      hooksRegistry = {};
    }
  }
}

// 保存钩子注册表
function saveHooks() {
  const registryPath = path.join(HOOKS_DIR, 'registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(hooksRegistry, null, 2));
}

// 初始化加载
loadHooks();

// ========== 核心函数 ==========

/**
 * 注册钩子
 * @param {string} hookType - 钩子类型
 * @param {function} callback - 回调函数
 * @param {object} options - 选项 { priority, once, condition }
 */
function register(hookType, callback, options = {}) {
  const start = Date.now();
  try {
    if (!HOOK_TYPES[hookType]) {
      return { status: 'error', message: `Unknown hook type: ${hookType}`, time: Date.now() - start };
    }
    
    const hookId = uuidv4();
    const hook = {
      id: hookId,
      type: hookType,
      callback: callback.toString(), // 存储函数字符串
      priority: options.priority || HOOK_TYPES[hookType].priority,
      once: options.once || false,
      condition: options.condition || null,
      enabled: true,
      created_at: new Date().toISOString(),
      callCount: 0
    };
    
    if (!hooksRegistry[hookType]) {
      hooksRegistry[hookType] = [];
    }
    hooksRegistry[hookType].push(hook);
    saveHooks();
    
    return { status: 'ok', hookId, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 触发钩子
 * @param {string} hookType - 钩子类型
 * @param {object} event - 事件数据
 * @returns {object} - 处理结果
 */
async function trigger(hookType, event = {}) {
  const start = Date.now();
  try {
    if (!HOOK_TYPES[hookType]) {
      return { status: 'ok', message: 'Unknown hook type, skipped', time: Date.now() - start };
    }
    
    const hooks = hooksRegistry[hookType] || [];
    const enabledHooks = hooks.filter(h => h.enabled);
    
    // 按优先级排序
    enabledHooks.sort((a, b) => a.priority - b.priority);
    
    const results = [];
    const toRemove = [];
    
    for (const hook of enabledHooks) {
      // 检查条件
      if (hook.condition && !evaluateCondition(hook.condition, event)) {
        continue;
      }
      
      try {
        // 执行回调
        const callback = eval(`(${hook.callback})`);
        const hookDef = HOOK_TYPES[hookType];
        
        let result;
        if (hookDef.async) {
          result = await Promise.resolve(callback(event));
        } else {
          result = callback(event);
        }
        
        results.push({ hookId: hook.id, result, status: 'ok' });
        hook.callCount++;
        
        // 一次性钩子标记移除
        if (hook.once) {
          toRemove.push(hook.id);
        }
      } catch (e) {
        results.push({ hookId: hook.id, error: e.message, status: 'error' });
      }
    }
    
    // 移除一次性钩子
    if (toRemove.length > 0) {
      hooksRegistry[hookType] = hooks.filter(h => !toRemove.includes(h.id));
      saveHooks();
    }
    
    return { status: 'ok', results, triggered: results.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 评估条件
 */
function evaluateCondition(condition, event) {
  try {
    // 简单条件评估
    if (typeof condition === 'function') {
      return condition(event);
    }
    if (typeof condition === 'string') {
      // 支持 "event.field === value" 格式
      const fn = new Function('event', `return ${condition}`);
      return fn(event);
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 取消注册钩子
 */
function unregister(hookId) {
  const start = Date.now();
  try {
    let found = false;
    for (const hookType of Object.keys(hooksRegistry)) {
      const idx = hooksRegistry[hookType].findIndex(h => h.id === hookId);
      if (idx >= 0) {
        hooksRegistry[hookType].splice(idx, 1);
        found = true;
        break;
      }
    }
    
    if (found) {
      saveHooks();
    }
    
    return { status: 'ok', found, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 列出钩子
 */
function list(hookType = null) {
  const start = Date.now();
  try {
    if (hookType) {
      const hooks = hooksRegistry[hookType] || [];
      return { status: 'ok', hooks, total: hooks.length, time: Date.now() - start };
    }
    
    const allHooks = [];
    for (const [type, hooks] of Object.entries(hooksRegistry)) {
      allHooks.push(...hooks.map(h => ({ ...h, type })));
    }
    
    return { status: 'ok', hooks: allHooks, total: allHooks.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 启用/禁用钩子
 */
function toggle(hookId, enabled) {
  const start = Date.now();
  try {
    for (const hookType of Object.keys(hooksRegistry)) {
      const hook = hooksRegistry[hookType].find(h => h.id === hookId);
      if (hook) {
        hook.enabled = enabled;
        saveHooks();
        return { status: 'ok', hook, time: Date.now() - start };
      }
    }
    
    return { status: 'error', message: 'Hook not found', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 清除所有钩子
 */
function clear(hookType = null) {
  const start = Date.now();
  try {
    if (hookType) {
      hooksRegistry[hookType] = [];
    } else {
      hooksRegistry = {};
    }
    saveHooks();
    
    return { status: 'ok', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 获取钩子类型定义
 */
function getTypes() {
  return { status: 'ok', types: Object.keys(HOOK_TYPES), definitions: HOOK_TYPES };
}

// ========== 模块导出 ==========
module.exports = {
  register,
  trigger,
  unregister,
  list,
  toggle,
  clear,
  getTypes,
  HOOK_TYPES
};
