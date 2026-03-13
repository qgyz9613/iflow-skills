/**
 * 主进程判断模块
 * 判断当前模块是否为主进程入口，支持PM2等包装器
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * 规范化路径候选
 * @param {string|undefined} candidate - 候选路径
 * @param {string} cwd - 当前工作目录
 * @returns {string|undefined} - 规范化后的路径
 */
function normalizePathCandidate(candidate, cwd) {
  if (!candidate) {
    return undefined;
  }

  const resolved = path.resolve(cwd, candidate);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

/**
 * 判断当前模块是否为主进程入口
 * @param {Object} options - 选项
 * @param {string} options.currentFile - 当前文件路径
 * @param {string[]} [options.argv] - 进程参数数组
 * @param {NodeJS.ProcessEnv} [options.env] - 环境变量
 * @param {string} [options.cwd] - 当前工作目录
 * @param {Array<{wrapperBasename: string, entryBasename: string}>} [options.wrapperEntryPairs] - 包装器入口对
 * @returns {boolean} - 是否为主进程
 */
function isMainModule(options) {
  const {
    currentFile,
    argv = process.argv,
    env = process.env,
    cwd = process.cwd(),
    wrapperEntryPairs = []
  } = options;

  const normalizedCurrent = normalizePathCandidate(currentFile, cwd);
  const normalizedArgv1 = normalizePathCandidate(argv[1], cwd);

  if (normalizedCurrent && normalizedArgv1 && normalizedCurrent === normalizedArgv1) {
    return true;
  }

  // PM2 运行脚本时通过内部包装器；argv[1] 指向包装器
  // PM2 在 pm_exec_path 中暴露实际脚本路径
  const normalizedPmExecPath = normalizePathCandidate(env.pm_exec_path, cwd);
  if (normalizedCurrent && normalizedPmExecPath && normalizedCurrent === normalizedPmExecPath) {
    return true;
  }

  // 可选的包装器->入口映射，用于导入实际入口的包装器启动器
  if (normalizedCurrent && normalizedArgv1 && wrapperEntryPairs.length > 0) {
    const currentBase = path.basename(normalizedCurrent);
    const argvBase = path.basename(normalizedArgv1);
    const matched = wrapperEntryPairs.some(
      ({ wrapperBasename, entryBasename }) =>
        currentBase === entryBasename && argvBase === wrapperBasename,
    );
    if (matched) {
      return true;
    }
  }

  // 后备：基名匹配（相对路径、符号链接的bin）
  if (
    normalizedCurrent &&
    normalizedArgv1 &&
    path.basename(normalizedCurrent) === path.basename(normalizedArgv1)
  ) {
    return true;
  }

  return false;
}

module.exports = {
  isMainModule
};