/**
 * Executable Path
 * 可执行文件路径 - 解析和验证可执行文件路径
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析 Windows 可执行文件扩展名
 * @param {string} executable - 可执行文件名
 * @param {NodeJS.ProcessEnv} [env] - 环境变量
 * @returns {string[]} 扩展名数组
 */
function resolveWindowsExecutableExtensions(executable, env) {
  if (process.platform !== 'win32') {
    return [''];
  }
  if (path.extname(executable).length > 0) {
    return [''];
  }
  const pathext =
    env?.PATHEXT ??
    env?.Pathext ??
    process.env.PATHEXT ??
    process.env.Pathext ??
    '.EXE;.CMD;.BAT;.COM';
  return pathext.split(';').map((ext) => ext.toLowerCase());
}

/**
 * 检查是否为可执行文件
 * @param {string} filePath - 文件路径
 * @returns {boolean} 是否为可执行文件
 */
function isExecutableFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return false;
    }
    if (process.platform !== 'win32') {
      fs.accessSync(filePath, fs.constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 从 PATH 环境变量解析可执行文件
 * @param {string} executable - 可执行文件名
 * @param {string} pathEnv - PATH 环境变量
 * @param {NodeJS.ProcessEnv} [env] - 环境变量
 * @returns {string|undefined} 可执行文件路径
 */
function resolveExecutableFromPathEnv(executable, pathEnv, env) {
  const entries = pathEnv.split(path.delimiter).filter(Boolean);
  const extensions = resolveWindowsExecutableExtensions(executable, env);
  for (const entry of entries) {
    for (const ext of extensions) {
      const candidate = path.join(entry, executable + ext);
      if (isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

/**
 * 解析可执行文件路径
 * @param {string} rawExecutable - 原始可执行文件名
 * @param {Object} [options] - 选项
 * @param {string} [options.cwd] - 当前工作目录
 * @param {NodeJS.ProcessEnv} [options.env] - 环境变量
 * @returns {string|undefined} 可执行文件路径
 */
function resolveExecutablePath(rawExecutable, options = {}) {
  const expanded = rawExecutable.startsWith('~') 
    ? expandHomePrefix(rawExecutable) 
    : rawExecutable;
  
  if (expanded.includes('/') || expanded.includes('\\')) {
    if (path.isAbsolute(expanded)) {
      return isExecutableFile(expanded) ? expanded : undefined;
    }
    const base = options?.cwd && options.cwd.trim() ? options.cwd.trim() : process.cwd();
    const candidate = path.resolve(base, expanded);
    return isExecutableFile(candidate) ? candidate : undefined;
  }
  
  const envPath = options?.env?.PATH ?? options?.env?.Path ?? process.env.PATH ?? process.env.Path ?? '';
  return resolveExecutableFromPathEnv(expanded, envPath, options?.env);
}

/**
 * 展开主目录前缀
 * @param {string} input - 输入路径
 * @returns {string} 展开后的路径
 */
function expandHomePrefix(input) {
  if (!input.startsWith('~')) {
    return input;
  }
  const home = process.env.HOME || process.env.USERPROFILE || require('os').homedir();
  if (!home) {
    return input;
  }
  return input.replace(/^~(?=$|[\\/])/, home);
}

/**
 * 查找可执行文件（多个位置）
 * @param {string} command - 命令名
 * @param {Object} [options] - 选项
 * @param {string[]} [options.searchPaths] - 搜索路径
 * @param {NodeJS.ProcessEnv} [options.env] - 环境变量
 * @returns {string|null} 可执行文件路径
 */
function findExecutable(command, options = {}) {
  const searchPaths = options.searchPaths || [];
  
  // 检查绝对路径
  if (path.isAbsolute(command)) {
    return isExecutableFile(command) ? command : null;
  }

  // 检查相对路径
  if (command.includes('/') || command.includes('\\')) {
    const candidate = path.resolve(options.cwd || process.cwd(), command);
    return isExecutableFile(candidate) ? candidate : null;
  }

  // 搜索自定义路径
  if (searchPaths.length > 0) {
    for (const dir of searchPaths) {
      const candidate = path.resolve(dir, command);
      if (isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }

  // 从 PATH 环境变量搜索
  const resolved = resolveExecutablePath(command, options);
  return resolved || null;
}

/**
 * 验证可执行文件
 * @param {string} filePath - 文件路径
 * @returns {Object} 验证结果
 */
function validateExecutable(filePath) {
  const result = {
    exists: false,
    isFile: false,
    isExecutable: false,
    path: filePath
  };

  try {
    const stat = fs.statSync(filePath);
    result.exists = true;
    result.isFile = stat.isFile();
    result.isExecutable = isExecutableFile(filePath);
  } catch {
    result.exists = false;
  }

  return result;
}

/**
 * 获取 PATH 环境变量
 * @param {NodeJS.ProcessEnv} [env] - 环境变量
 * @returns {string[]} PATH 路径数组
 */
function getPathEnv(env = process.env) {
  const pathValue = env?.PATH ?? env?.Path ?? '';
  return pathValue.split(path.delimiter).filter(Boolean);
}

/**
 * 检查命令是否在 PATH 中
 * @param {string} command - 命令名
 * @param {NodeJS.ProcessEnv} [env] - 环境变量
 * @returns {boolean} 是否在 PATH 中
 */
function isCommandInPath(command, env = process.env) {
  return resolveExecutablePath(command, { env }) !== undefined;
}

/**
 * 获取命令的所有可能路径
 * @param {string} command - 命令名
 * @param {NodeJS.ProcessEnv} [env] - 环境变量
 * @returns {string[]} 所有可能的路径
 */
function getAllPossiblePaths(command, env = process.env) {
  const paths = getPathEnv(env);
  const extensions = resolveWindowsExecutableExtensions(command, env);
  const result = [];

  for (const dir of paths) {
    for (const ext of extensions) {
      const candidate = path.join(dir, command + ext);
      if (isExecutableFile(candidate)) {
        result.push(candidate);
      }
    }
  }

  return result;
}

module.exports = {
  resolveWindowsExecutableExtensions,
  isExecutableFile,
  resolveExecutableFromPathEnv,
  resolveExecutablePath,
  expandHomePrefix,
  findExecutable,
  validateExecutable,
  getPathEnv,
  isCommandInPath,
  getAllPossiblePaths
};