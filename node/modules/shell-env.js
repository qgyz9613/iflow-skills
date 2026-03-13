/**
 * Shell Environment
 * Shell 环境变量 - 解析和管理 Shell 环境变量
 */

const { execFileSync } = require('child_process');
const os = require('os');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BUFFER_BYTES = 2 * 1024 * 1024;
const DEFAULT_SHELL = '/bin/sh';

let lastAppliedKeys = [];
let cachedShellPath = null;
let cachedEtcShells = null;

/**
 * 检查环境值是否为真
 * @param {string|undefined} value - 环境值
 * @returns {boolean} 是否为真
 */
function isTruthyEnvValue(value) {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

/**
 * 解析 Shell 执行环境
 * @param {NodeJS.ProcessEnv} env - 环境变量
 * @returns {NodeJS.ProcessEnv} 解析后的环境
 */
function resolveShellExecEnv(env) {
  const execEnv = { ...env };

  // Startup-file resolution must stay pinned to the real user home.
  const home = os.homedir().trim();
  if (home) {
    execEnv.HOME = home;
  } else {
    delete execEnv.HOME;
  }

  // Avoid zsh startup-file redirection via env poisoning.
  delete execEnv.ZDOTDIR;
  return execEnv;
}

/**
 * 解析超时时间
 * @param {number|undefined} timeoutMs - 超时时间
 * @returns {number} 解析后的超时时间
 */
function resolveTimeoutMs(timeoutMs) {
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(0, timeoutMs);
}

/**
 * 读取 /etc/shells
 * @returns {Set<string>|null} Shell 路径集合
 */
function readEtcShells() {
  if (cachedEtcShells !== undefined) {
    return cachedEtcShells;
  }
  try {
    const fs = require('fs');
    const raw = fs.readFileSync('/etc/shells', 'utf8');
    const entries = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#') && path.isAbsolute(line));
    cachedEtcShells = new Set(entries);
  } catch {
    cachedEtcShells = null;
  }
  return cachedEtcShells;
}

/**
 * 检查是否为可信的 Shell 路径
 * @param {string} shell - Shell 路径
 * @returns {boolean} 是否可信
 */
function isTrustedShellPath(shell) {
  if (!path.isAbsolute(shell)) {
    return false;
  }
  const normalized = path.normalize(shell);
  if (normalized !== shell) {
    return false;
  }

  // Primary trust anchor: shell registered in /etc/shells.
  const registeredShells = readEtcShells();
  return registeredShells?.has(shell) === true;
}

/**
 * 解析 Shell
 * @param {NodeJS.ProcessEnv} env - 环境变量
 * @returns {string} Shell 路径
 */
function resolveShell(env) {
  const shell = env.SHELL?.trim();
  if (shell && isTrustedShellPath(shell)) {
    return shell;
  }
  return DEFAULT_SHELL;
}

/**
 * 解析 Shell 环境
 * @param {Buffer} stdout - 标准输出
 * @returns {Map<string, string>} 环境变量映射
 */
function parseShellEnv(stdout) {
  const shellEnv = new Map();
  const parts = stdout.toString('utf8').split('\0');
  for (const part of parts) {
    if (!part) {
      continue;
    }
    const eq = part.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    shellEnv.set(key, value);
  }
  return shellEnv;
}

/**
 * 执行登录 Shell 环境
 * @param {Object} params - 参数
 * @param {string} params.shell - Shell 路径
 * @param {NodeJS.ProcessEnv} params.env - 环境变量
 * @param {Function} params.exec - 执行函数
 * @param {number} params.timeoutMs - 超时时间
 * @returns {Buffer} 标准输出
 */
function execLoginShellEnvZero(params) {
  return params.exec(params.shell, ['-l', '-c', 'env -0'], {
    encoding: 'buffer',
    timeout: params.timeoutMs,
    maxBuffer: DEFAULT_MAX_BUFFER_BYTES,
    env: params.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

/**
 * 解析登录 Shell 环境
 * @param {Object} options - 选项
 * @param {NodeJS.ProcessEnv} [options.env] - 环境变量
 * @param {number} [options.timeoutMs] - 超时时间
 * @returns {Map<string, string>|null} 环境变量映射
 */
function resolveLoginShellEnv(options = {}) {
  const env = options.env ?? process.env;
  const timeoutMs = resolveTimeoutMs(options.timeoutMs);

  if (process.platform === 'win32') {
    // Windows: 直接返回环境变量
    return new Map(Object.entries(env));
  }

  const shell = resolveShell(env);
  const execEnv = resolveShellExecEnv(env);

  try {
    const stdout = execLoginShellEnvZero({
      shell,
      env: execEnv,
      exec: execFileSync,
      timeoutMs
    });
    return parseShellEnv(stdout);
  } catch {
    return null;
  }
}

/**
 * 获取 Shell 环境
 * @param {string} [shellName] - Shell 名称
 * @returns {Map<string, string>|null} 环境变量映射
 */
function getShellEnv(shellName) {
  return resolveLoginShellEnv();
}

/**
 * 获取环境变量
 * @param {string} key - 环境变量键
 * @param {Map<string, string>} [shellEnv] - Shell 环境
 * @returns {string|undefined} 环境变量值
 */
function getEnvVar(key, shellEnv) {
  if (shellEnv) {
    return shellEnv.get(key);
  }
  return process.env[key];
}

/**
 * 获取所有环境变量
 * @param {Map<string, string>} [shellEnv] - Shell 环境
 * @returns {Record<string, string>} 环境变量对象
 */
function getAllEnvVars(shellEnv) {
  if (shellEnv) {
    return Object.fromEntries(shellEnv);
  }
  return { ...process.env };
}

/**
 * 获取 PATH 环境变量
 * @param {Map<string, string>} [shellEnv] - Shell 环境
 * @returns {string[]} PATH 路径数组
 */
function getPathEnv(shellEnv) {
  const pathValue = getEnvVar('PATH', shellEnv);
  if (!pathValue) {
    return [];
  }
  return pathValue.split(path.delimiter).filter(Boolean);
}

/**
 * 检查命令是否可用
 * @param {string} command - 命令名称
 * @param {Map<string, string>} [shellEnv] - Shell 环境
 * @returns {boolean} 是否可用
 */
function isCommandAvailable(command, shellEnv) {
  if (path.isAbsolute(command)) {
    try {
      const fs = require('fs');
      return fs.existsSync(command);
    } catch {
      return false;
    }
  }

  const paths = getPathEnv(shellEnv);
  for (const dir of paths) {
    const fullPath = path.join(dir, command);
    try {
      const fs = require('fs');
      if (fs.existsSync(fullPath)) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * 查找命令路径
 * @param {string} command - 命令名称
 * @param {Map<string, string>} [shellEnv] - Shell 环境
 * @returns {string|null} 命令路径
 */
function findCommandPath(command, shellEnv) {
  if (path.isAbsolute(command)) {
    return command;
  }

  const paths = getPathEnv(shellEnv);
  for (const dir of paths) {
    const fullPath = path.join(dir, command);
    try {
      const fs = require('fs');
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * 解析 HOME 目录
 * @param {Map<string, string>} [shellEnv] - Shell 环境
 * @returns {string} HOME 目录
 */
function resolveHomeDir(shellEnv) {
  const home = getEnvVar('HOME', shellEnv);
  if (home) {
    return home;
  }
  return os.homedir();
}

/**
 * 解析用户目录
 * @param {string} username - 用户名
 * @param {Map<string, string>} [shellEnv] - Shell 环境
 * @returns {string|null} 用户目录
 */
function resolveUserDir(username, shellEnv) {
  if (process.platform === 'win32') {
    const home = getEnvVar('USERPROFILE', shellEnv);
    if (username && home) {
      // Windows: C:\Users\username
      const drive = path.parse(home).root;
      return path.join(drive, 'Users', username);
    }
    return home || null;
  }

  const home = resolveHomeDir(shellEnv);
  if (username) {
    return path.join('/home', username);
  }
  return home;
}

module.exports = {
  isTruthyEnvValue,
  resolveShellExecEnv,
  resolveShell,
  resolveLoginShellEnv,
  getShellEnv,
  getEnvVar,
  getAllEnvVars,
  getPathEnv,
  isCommandAvailable,
  findCommandPath,
  resolveHomeDir,
  resolveUserDir
};