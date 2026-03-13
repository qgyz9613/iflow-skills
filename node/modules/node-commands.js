/**
 * Node Commands
 * Node.js 命令 - Node.js 相关命令定义和工具
 */

/**
 * Node.js 系统运行命令
 */
const NODE_SYSTEM_RUN_COMMANDS = [
  'system.run.prepare',
  'system.run',
  'system.which'
];

/**
 * Node.js 系统通知命令
 */
const NODE_SYSTEM_NOTIFY_COMMAND = 'system.notify';

/**
 * Node.js 浏览器代理命令
 */
const NODE_BROWSER_PROXY_COMMAND = 'browser.proxy';

/**
 * Node.js 执行审批命令
 */
const NODE_EXEC_APPROVALS_COMMANDS = [
  'system.execApprovals.get',
  'system.execApprovals.set'
];

/**
 * 获取 Node.js 版本
 * @returns {string} Node.js 版本
 */
function getNodeVersion() {
  return process.version;
}

/**
 * 获取 Node.js 版本详细信息
 * @returns {Object} 版本详细信息
 */
function getNodeVersionInfo() {
  return {
    version: process.version,
    major: process.versions.node,
    v8: process.versions.v8,
    openssl: process.versions.openssl,
    uv: process.versions.uv,
    zlib: process.versions.zlib,
    brotli: process.versions.brotli,
    ares: process.versions.ares,
    modules: process.versions.modules,
    icu: process.versions.icu,
    unicode: process.versions.unicode,
    napi: process.versions.napi
  };
}

/**
 * 获取 Node.js 执行路径
 * @returns {string} Node.js 执行路径
 */
function getNodeExecutablePath() {
  return process.execPath;
}

/**
 * 获取 Node.js 参数
 * @returns {string[]} Node.js 参数
 */
function getNodeExecArgv() {
  return process.execArgv;
}

/**
 * 获取 Node.js 脚本参数
 * @returns {string[]} Node.js 脚本参数
 */
function getNodeArgv() {
  return process.argv;
}

/**
 * 获取 Node.js 平台信息
 * @returns {Object} 平台信息
 */
function getPlatformInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    endianness: process.endianness
  };
}

/**
 * 检查是否为管理员权限
 * @returns {boolean} 是否为管理员
 */
function isPrivileged() {
  if (process.platform === 'win32') {
    // Windows: 检查是否为管理员
    try {
      const { execSync } = require('child_process');
      execSync('net session', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  } else {
    // Unix: 检查是否为 root
    return process.getuid && process.getuid() === 0;
  }
}

/**
 * 获取用户信息
 * @returns {Object} 用户信息
 */
function getUserInfo() {
  return process.userInfo();
}

/**
 * 获取进程信息
 * @returns {Object} 进程信息
 */
function getProcessInfo() {
  return {
    pid: process.pid,
    ppid: process.ppid,
    title: process.title,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage()
  };
}

/**
 * 获取环境变量
 * @returns {NodeJS.ProcessEnv} 环境变量
 */
function getProcessEnv() {
  return { ...process.env };
}

/**
 * 获取当前工作目录
 * @returns {string} 当前工作目录
 */
function getCwd() {
  return process.cwd();
}

/**
 * 获取脚本目录
 * @returns {string} 脚本目录
 */
function getScriptDir() {
  const scriptPath = process.argv[1];
  if (!scriptPath) {
    return getCwd();
  }
  const path = require('path');
  return path.dirname(path.resolve(scriptPath));
}

/**
 * 解析命令行参数
 * @param {string[]} [argv] - 参数数组
 * @returns {Object} 解析后的参数
 */
function parseCommandLineArgs(argv = process.argv.slice(2)) {
  const args = [];
  const flags = {};
  const options = {};

  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined) {
        options[key] = value;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-')) {
      flags[arg.slice(1)] = true;
    } else {
      args.push(arg);
    }
  }

  return { args, flags, options };
}

/**
 * 获取 Node.js 配置选项
 * @returns {Object} 配置选项
 */
function getNodeConfig() {
  return {
    targetDefaults: process.config?.targetDefaults,
    variables: process.config?.variables
  };
}

/**
 * 获取模块路径
 * @returns {string[]} 模块路径
 */
function getModulePaths() {
  return require('module').globalPaths || [];
}

/**
 * 解析模块路径
 * @param {string} moduleName - 模块名
 * @returns {string|null} 模块路径
 */
function resolveModulePath(moduleName) {
  try {
    return require.resolve(moduleName);
  } catch {
    return null;
  }
}

/**
 * 检查模块是否已安装
 * @param {string} moduleName - 模块名
 * @returns {boolean} 是否已安装
 */
function isModuleInstalled(moduleName) {
  return resolveModulePath(moduleName) !== null;
}

module.exports = {
  // 常量
  NODE_SYSTEM_RUN_COMMANDS,
  NODE_SYSTEM_NOTIFY_COMMAND,
  NODE_BROWSER_PROXY_COMMAND,
  NODE_EXEC_APPROVALS_COMMANDS,
  // Node.js 信息
  getNodeVersion,
  getNodeVersionInfo,
  getNodeExecutablePath,
  getNodeExecArgv,
  getNodeArgv,
  // 平台信息
  getPlatformInfo,
  isPrivileged,
  getUserInfo,
  getProcessInfo,
  // 环境信息
  getProcessEnv,
  getCwd,
  getScriptDir,
  // 命令行工具
  parseCommandLineArgs,
  // 模块工具
  getNodeConfig,
  getModulePaths,
  resolveModulePath,
  isModuleInstalled
};