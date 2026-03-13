/**
 * iFlow System Utils Module
 * 整合自 OpenClaw 项目的系统工具
 * 提供端口管理、系统事件、剪贴板、环境变量替换等功能
 */

const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// ==================== 端口管理 ====================

/**
 * 尝试监听端口以检测是否可用
 * @param {Object} options - 选项
 * @param {number} options.port - 端口号
 * @param {string} options.host - 主机地址（默认：127.0.0.1）
 * @returns {Promise<void>}
 */
async function tryListenOnPort(options) {
  const { port, host = '127.0.0.1' } = options;
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      reject(err);
    });
    server.once('listening', () => {
      server.close(() => resolve());
    });
    server.listen(port, host);
  });
}

/**
 * 确保端口可用
 * @param {number} port - 端口号
 * @returns {Promise<void>}
 * @throws {Error} 端口已被占用
 */
async function ensurePortAvailable(port) {
  try {
    await tryListenOnPort({ port });
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      throw new Error(`Port ${port} is already in use.`);
    }
    throw err;
  }
}

/**
 * 查找可用端口
 * @param {number} startPort - 起始端口
 * @param {number} maxAttempts - 最大尝试次数
 * @returns {Promise<number>} 可用端口
 */
async function findAvailablePort(startPort = 3000, maxAttempts = 100) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    try {
      await tryListenOnPort({ port });
      return port;
    } catch {
      // 继续尝试下一个端口
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * 获取进程信息
 * @param {number} pid - 进程 ID
 * @returns {Object|null} 进程信息
 */
function getProcessInfo(pid) {
  try {
    return process.kill(pid, 0) ? { pid, alive: true } : { pid, alive: false };
  } catch {
    return { pid, alive: false };
  }
}

// ==================== 系统事件队列 ====================

const MAX_EVENTS = 20;
const eventQueues = new Map();

/**
 * 入队系统事件
 * @param {string} text - 事件文本
 * @param {Object} options - 选项
 * @param {string} options.sessionKey - 会话键
 * @param {string} options.contextKey - 上下文键（可选）
 */
function enqueueSystemEvent(text, options) {
  const { sessionKey, contextKey } = options;
  if (!sessionKey || !sessionKey.trim()) {
    throw new Error('system events require a sessionKey');
  }

  const key = sessionKey.trim();
  const queue = eventQueues.get(key) || {
    events: [],
    lastContextKey: null
  };

  // 更新上下文键
  queue.lastContextKey = contextKey?.toLowerCase().trim() || null;

  // 添加事件
  queue.events.push({
    text,
    timestamp: Date.now()
  });

  // 限制队列大小
  if (queue.events.length > MAX_EVENTS) {
    queue.events.shift();
  }

  eventQueues.set(key, queue);
}

/**
 * 获取系统事件
 * @param {string} sessionKey - 会话键
 * @returns {Array} 事件数组
 */
function getSystemEvents(sessionKey) {
  const key = sessionKey?.trim();
  if (!key) {
    return [];
  }
  const queue = eventQueues.get(key);
  return queue?.events || [];
}

/**
 * 检查系统事件上下文是否变化
 * @param {string} sessionKey - 会话键
 * @param {string} contextKey - 上下文键
 * @returns {boolean}
 */
function isSystemEventContextChanged(sessionKey, contextKey) {
  const key = sessionKey?.trim();
  if (!key) {
    return false;
  }
  const queue = eventQueues.get(key);
  const normalized = contextKey?.toLowerCase().trim() || null;
  return normalized !== (queue?.lastContextKey || null);
}

/**
 * 清空系统事件
 * @param {string} sessionKey - 会话键
 */
function clearSystemEvents(sessionKey) {
  const key = sessionKey?.trim();
  if (key) {
    eventQueues.delete(key);
  }
}

// ==================== 剪贴板操作 ====================

/**
 * 复制内容到剪贴板
 * @param {string} value - 要复制的内容
 * @returns {Promise<boolean>} 是否成功
 */
async function copyToClipboard(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const attempts = [
    { argv: ['pbcopy'], platform: 'darwin' },
    { argv: ['xclip', '-selection', 'clipboard'], platform: 'linux' },
    { argv: ['wl-copy'], platform: 'linux' },
    { argv: ['clip.exe'], platform: 'win32' },
    { argv: ['powershell', '-NoProfile', '-Command', 'Set-Clipboard'], platform: 'win32' }
  ];

  const platformAttempts = attempts.filter(a => a.platform === process.platform);

  for (const attempt of platformAttempts.length > 0 ? platformAttempts : attempts) {
    try {
      await spawnCommand(attempt.argv, {
        timeoutMs: 3000,
        input: value
      });
      return true;
    } catch {
      // 尝试下一个命令
    }
  }
  return false;
}

// ==================== 环境变量替换 ====================

const ENV_VAR_PATTERN = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

/**
 * 替换字符串中的环境变量引用
 * @param {string} value - 包含环境变量引用的字符串
 * @param {Object} env - 环境变量对象（默认：process.env）
 * @returns {string} 替换后的字符串
 */
function substituteEnvVars(value, env = process.env) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(ENV_VAR_PATTERN, (match, varName) => {
    const envValue = env[varName];
    if (envValue !== undefined) {
      return envValue;
    }
    throw new Error(`Missing env var "${varName}"`);
  });
}

/**
 * 递归替换对象中的环境变量引用
 * @param {any} value - 任意值
 * @param {Object} env - 环境变量对象
 * @returns {any} 替换后的值
 */
function deepSubstituteEnvVars(value, env = process.env) {
  if (typeof value === 'string') {
    return substituteEnvVars(value, env);
  }
  if (Array.isArray(value)) {
    return value.map(item => deepSubstituteEnvVars(item, env));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = deepSubstituteEnvVars(value[key], env);
    }
    return result;
  }
  return value;
}

// ==================== 进程管理 ====================

/**
 * 生成命令
 * @param {Array<string>} argv - 参数数组
 * @param {Object} options - 选项
 * @param {number} options.timeoutMs - 超时时间
 * @param {string} options.input - 标准输入
 * @param {string} options.cwd - 工作目录
 * @returns {Promise<Object>} 执行结果
 */
function spawnCommand(argv, options = {}) {
  const { timeoutMs = 10000, input, cwd } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: cwd || process.cwd()
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // 设置超时
    const timeout = timeoutMs > 0 ? setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeoutMs) : null;

    // 收集输出
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // 处理输入
    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }

    // 处理退出
    child.on('close', (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({
        code,
        stdout,
        stderr,
        killed
      });
    });

    child.on('error', (err) => {
      if (timeout) clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * 运行命令（同步）
 * @param {Array<string>} argv - 参数数组
 * @param {Object} options - 选项
 * @returns {Object} 执行结果
 */
function spawnCommandSync(argv, options = {}) {
  const { input, cwd } = options;
  const { spawnSync } = require('child_process');
  const result = spawnSync(argv[0], argv.slice(1), {
    stdio: ['pipe', 'pipe', 'pipe'],
    input,
    cwd: cwd || process.cwd()
  });
  return {
    code: result.status,
    stdout: result.stdout?.toString() || '',
    stderr: result.stderr?.toString() || '',
    killed: result.signal !== null
  };
}

// ==================== 文件锁 ====================

const locks = new Map();

/**
 * 获取文件锁
 * @param {string} lockPath - 锁文件路径
 * @param {Object} options - 选项
 * @param {number} options.timeoutMs - 超时时间（默认：30000）
 * @returns {Promise<Object>} 锁对象
 */
async function acquireFileLock(lockPath, options = {}) {
  const { timeoutMs = 30000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (!locks.has(lockPath)) {
      locks.set(lockPath, {
        acquiredAt: Date.now(),
        pid: process.pid
      });
      return { lockPath, release: () => releaseFileLock(lockPath) };
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Failed to acquire lock: ${lockPath}`);
}

/**
 * 释放文件锁
 * @param {string} lockPath - 锁文件路径
 */
function releaseFileLock(lockPath) {
  locks.delete(lockPath);
}

// ==================== 系统信息 ====================

/**
 * 获取系统信息
 * @returns {Object} 系统信息
 */
function getSystemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    nodeVersion: process.version,
    pid: process.pid
  };
}

/**
 * 获取网络接口信息
 * @returns {Object} 网络接口
 */
function getNetworkInterfaces() {
  return os.networkInterfaces();
}

// ==================== 路径工具 ====================

/**
 * 标准化路径
 * @param {string} input - 输入路径
 * @returns {string} 标准化后的路径
 */
function normalizePath(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return path.normalize(input);
}

/**
 * 检查路径是否在根目录内
 * @param {string} root - 根目录
 * @param {string} target - 目标路径
 * @returns {boolean}
 */
function isPathInside(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);

  if (process.platform === 'win32') {
    const normalizedRoot = normalizeWindowsPath(resolvedRoot);
    const normalizedTarget = normalizeWindowsPath(resolvedTarget);
    const relative = path.win32.relative(normalizedRoot, normalizedTarget);
    return relative === '' || (!relative.startsWith('..') && !path.win32.isAbsolute(relative));
  }

  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * 标准化 Windows 路径（用于比较）
 * @param {string} input - 输入路径
 * @returns {string}
 */
function normalizeWindowsPath(input) {
  let normalized = path.win32.normalize(input);
  if (normalized.startsWith('\\\\?\\')) {
    normalized = normalized.slice(4);
    if (normalized.toUpperCase().startsWith('UNC\\')) {
      normalized = '\\\\' + normalized.slice(4);
    }
  }
  return normalized.replaceAll('/', '\\\\').toLowerCase();
}

// ==================== 进程管理增强 ====================

/**
 * 命令队列管理器
 */
class CommandQueueManager {
  constructor() {
    this.lanes = new Map();
    this.nextTaskId = 1;
    this.gatewayDraining = false;
  }

  /**
   * 获取或创建队列状态
   */
  getLaneState(lane) {
    if (!this.lanes.has(lane)) {
      this.lanes.set(lane, {
        lane,
        queue: [],
        activeTaskIds: new Set(),
        maxConcurrent: 1,
        draining: false,
        generation: 0
      });
    }
    return this.lanes.get(lane);
  }

  /**
   * 入队任务
   */
  async enqueue(task, options = {}) {
    const { lane = 'main', timeout = 30000 } = options;

    if (this.gatewayDraining) {
      throw new Error('Gateway is draining for restart; new tasks are not accepted');
    }

    const state = this.getLaneState(lane);

    if (state.draining) {
      throw new Error(`Command lane "${lane}" cleared`);
    }

    return new Promise((resolve, reject) => {
      const taskId = this.nextTaskId++;
      const enqueuedAt = Date.now();
      const warnAfterMs = 5000;

      state.queue.push({
        task,
        resolve,
        reject,
        enqueuedAt,
        warnAfterMs,
        taskId,
        generation: state.generation
      });

      setTimeout(() => {
        if (state.queue.find(e => e.taskId === taskId)) {
          const waitMs = Date.now() - enqueuedAt;
          const queuedAhead = state.queue.length;
          console.warn(`Task ${taskId} in lane "${lane}" waiting ${waitMs}ms (${queuedAhead} ahead)`);
        }
      }, warnAfterMs).unref();

      this.processQueue(lane);
    });
  }

  /**
   * 处理队列
   */
  async processQueue(lane) {
    const state = this.getLaneState(lane);

    while (state.queue.length > 0 && state.activeTaskIds.size < state.maxConcurrent) {
      const entry = state.queue.shift();

      if (!entry) continue;

      state.activeTaskIds.add(entry.taskId);

      this.executeTask(entry, lane, state.generation)
        .then(result => entry.resolve(result))
        .catch(error => entry.reject(error))
        .finally(() => {
          state.activeTaskIds.delete(entry.taskId);
          this.processQueue(lane);
        });
    }
  }

  /**
   * 执行任务
   */
  async executeTask(entry, lane, generation) {
    try {
      return await entry.task();
    } catch (error) {
      throw error;
    }
  }

  /**
   * 清空队列
   */
  clearLane(lane) {
    const state = this.getLaneState(lane);
    state.draining = true;
    state.generation++;

    for (const entry of state.queue) {
      entry.reject(new Error(`Command lane "${lane}" cleared`));
    }

    state.queue = [];
    state.draining = false;
  }

  /**
   * 设置网关排水状态
   */
  setGatewayDraining(draining) {
    this.gatewayDraining = draining;
  }

  /**
   * 获取队列状态
   */
  getLaneStatus(lane) {
    const state = this.getLaneState(lane);
    return {
      lane,
      queueLength: state.queue.length,
      activeTasks: state.activeTaskIds.size,
      maxConcurrent: state.maxConcurrent,
      draining: state.draining
    };
  }

  /**
   * 获取所有队列状态
   */
  getAllLaneStatus() {
    const status = {};
    for (const [lane, state] of this.lanes.entries()) {
      status[lane] = {
        queueLength: state.queue.length,
        activeTasks: state.activeTaskIds.size,
        maxConcurrent: state.maxConcurrent,
        draining: state.draining
      };
    }
    return status;
  }
}

// 全局命令队列管理器
const commandQueueManager = new CommandQueueManager();

/**
 * 命令队列枚举
 */
const CommandLane = {
  Main: 'main',
  Cron: 'cron',
  Subagent: 'subagent',
  Nested: 'nested'
};

/**
 * 通过队列执行命令
 */
async function enqueueCommand(task, options = {}) {
  return commandQueueManager.enqueue(task, options);
}

/**
 * 清空指定队列
 */
function clearCommandLane(lane) {
  commandQueueManager.clearLane(lane);
}

/**
 * 获取队列状态
 */
function getCommandLaneStatus(lane) {
  return commandQueueManager.getLaneStatus(lane);
}

/**
 * 获取所有队列状态
 */
function getAllCommandLaneStatus() {
  return commandQueueManager.getAllLaneStatus();
}

/**
 * 设置网关排水状态
 */
function setGatewayDraining(draining) {
  commandQueueManager.setGatewayDraining(draining);
}

/**
 * 检查进程是否存活
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * 优雅终止进程树
 */
function killProcessTree(pid, options = {}) {
  const { graceMs = 3000 } = options;

  if (!Number.isFinite(pid) || pid <= 0) {
    return;
  }

  const normalizedGrace = Math.max(0, Math.min(60000, Math.floor(graceMs)));

  if (process.platform === 'win32') {
    killProcessTreeWindows(pid, normalizedGrace);
  } else {
    killProcessTreeUnix(pid, normalizedGrace);
  }
}

/**
 * Windows 进程树终止
 */
function killProcessTreeWindows(pid, graceMs) {
  const { exec } = require('child_process');

  // 第一步：优雅终止
  exec(`taskkill /T /PID ${pid}`, (err) => {
    if (err) {
      // 进程已不存在，直接返回
      return;
    }

    // 第二步：等待宽限期后强制终止
    setTimeout(() => {
      if (isProcessAlive(pid)) {
        exec(`taskkill /F /T /PID ${pid}`, () => {});
      }
    }, graceMs).unref();
  });
}

/**
 * Unix 进程树终止
 */
function killProcessTreeUnix(pid, graceMs) {
  // 第一步：向进程组发送 SIGTERM
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      return;
    }
  }

  // 第二步：等待宽限期后发送 SIGKILL
  setTimeout(() => {
    if (isProcessAlive(-pid)) {
      try {
        process.kill(-pid, 'SIGKILL');
        return;
      } catch {}
    }

    if (isProcessAlive(pid)) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
  }, graceMs).unref();
}

/**
 * 并发执行命令
 */
async function runCommandsConcurrent(commands, options = {}) {
  const { maxConcurrent = 4 } = options;
  const results = [];
  const executing = new Set();

  for (const command of commands) {
    const promise = spawnCommand(command, options).then(result => {
      executing.delete(promise);
      return result;
    });

    results.push(promise);
    executing.add(promise);

    if (executing.size >= maxConcurrent) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// ==================== 导出 ====================

module.exports = {
  // 端口管理
  tryListenOnPort,
  ensurePortAvailable,
  findAvailablePort,
  getProcessInfo,

  // 系统事件
  enqueueSystemEvent,
  getSystemEvents,
  isSystemEventContextChanged,
  clearSystemEvents,

  // 剪贴板
  copyToClipboard,

  // 环境变量
  substituteEnvVars,
  deepSubstituteEnvVars,

  // 进程管理
  spawnCommand,
  spawnCommandSync,

  // 文件锁
  acquireFileLock,
  releaseFileLock,

  // 系统信息
  getSystemInfo,
  getNetworkInterfaces,

  // 路径工具
  normalizePath,
  isPathInside,
  normalizeWindowsPath,

  // 进程管理增强
  CommandQueueManager,
  CommandLane,
  enqueueCommand,
  clearCommandLane,
  getCommandLaneStatus,
  getAllCommandLaneStatus,
  setGatewayDraining,
  isProcessAlive,
  killProcessTree,
  killProcessTreeWindows,
  killProcessTreeUnix,
  runCommandsConcurrent
};