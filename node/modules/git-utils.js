/**
 * iFlow Git Utils Module
 * Git 工具模块，整合自 OpenClaw 的 Git 根目录查找和提交信息读取模块
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DEFAULT_GIT_DISCOVERY_MAX_DEPTH = 12;
const COMMIT_CACHE = new Map();

/**
 * 从指定目录向上遍历查找
 * @param {string} startDir - 起始目录
 * @param {object} opts - 选项
 * @param {function} resolveAtDir - 解析函数
 * @returns {T|null} 解析结果
 */
function walkUpFrom(startDir, opts, resolveAtDir) {
  let current = path.resolve(startDir);
  const maxDepth = opts.maxDepth ?? DEFAULT_GIT_DISCOVERY_MAX_DEPTH;
  
  for (let i = 0; i < maxDepth; i++) {
    const resolved = resolveAtDir(current);
    if (resolved !== null && resolved !== undefined) {
      return resolved;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

/**
 * 检查是否有 Git 标记
 * @param {string} repoRoot - 仓库根目录
 * @returns {boolean} 是否有 Git 标记
 */
function hasGitMarker(repoRoot) {
  const gitPath = path.join(repoRoot, '.git');
  try {
    const stat = fs.statSync(gitPath);
    return stat.isDirectory() || stat.isFile();
  } catch {
    return false;
  }
}

/**
 * 查找 Git 仓库根目录
 * @param {string} startDir - 起始目录
 * @param {object} opts - 选项
 * @returns {string|null} Git 仓库根目录或 null
 */
function findGitRoot(startDir, opts = {}) {
  return walkUpFrom(startDir, opts, (repoRoot) => {
    return hasGitMarker(repoRoot) ? repoRoot : null;
  });
}

/**
 * 解析 .git 目录
 * @param {string} repoRoot - 仓库根目录
 * @returns {string|null} .git 目录路径或 null
 */
function resolveGitDirFromMarker(repoRoot) {
  const gitPath = path.join(repoRoot, '.git');
  try {
    const stat = fs.statSync(gitPath);
    if (stat.isDirectory()) {
      return gitPath;
    }
    if (!stat.isFile()) {
      return null;
    }
    const raw = fs.readFileSync(gitPath, 'utf-8');
    const match = raw.match(/gitdir:\s*(.+)/i);
    if (!match?.[1]) {
      return null;
    }
    return path.resolve(repoRoot, match[1].trim());
  } catch {
    return null;
  }
}

/**
 * 解析 Git HEAD 文件路径
 * @param {string} startDir - 起始目录
 * @param {object} opts - 选项
 * @returns {string|null} HEAD 文件路径或 null
 */
function resolveGitHeadPath(startDir, opts = {}) {
  return walkUpFrom(startDir, opts, (repoRoot) => {
    const gitDir = resolveGitDirFromMarker(repoRoot);
    return gitDir ? path.join(gitDir, 'HEAD') : null;
  });
}

/**
 * 格式化 commit hash
 * @param {string|null} value - commit 值
 * @returns {string|null} 格式化后的 commit hash
 */
function formatCommit(value) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/[0-9a-fA-F]{7,40}/);
  if (!match) {
    return null;
  }
  return match[0].slice(0, 7).toLowerCase();
}

/**
 * 安全读取文件前缀
 * @param {string} filePath - 文件路径
 * @param {number} limit - 限制字节数
 * @returns {string} 文件内容
 */
function safeReadFilePrefix(filePath, limit = 256) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(limit);
    const bytesRead = fs.readSync(fd, buf, 0, limit, 0);
    return buf.subarray(0, bytesRead).toString('utf-8');
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * 从 Git 读取 commit
 * @param {string} searchDir - 搜索目录
 * @param {string|null} packageRoot - 包根目录
 * @returns {string|null|undefined} commit hash
 */
function readCommitFromGit(searchDir, packageRoot) {
  const headPath = resolveGitHeadPath(searchDir, {});
  if (!headPath) {
    return undefined;
  }
  
  const head = safeReadFilePrefix(headPath).trim();
  if (!head) {
    return null;
  }
  
  if (head.startsWith('ref:')) {
    const refName = head.replace(/^ref:\s*/, '').trim();
    const gitDir = path.dirname(headPath);
    const refPath = path.join(gitDir, refName);
    
    try {
      const refContent = safeReadFilePrefix(refPath);
      return formatCommit(refContent);
    } catch {
      return null;
    }
  }
  
  return formatCommit(head);
}

/**
 * 读取 Git commit hash
 * @param {object} options - 选项
 * @returns {string|null} commit hash 或 null
 */
function getGitCommit(options = {}) {
  const cwd = options.cwd || process.cwd();
  const cacheKey = cwd;
  
  if (COMMIT_CACHE.has(cacheKey)) {
    return COMMIT_CACHE.get(cacheKey);
  }
  
  const commit = readCommitFromGit(cwd, null);
  COMMIT_CACHE.set(cacheKey, commit);
  return commit;
}

/**
 * 使用 git 命令获取 commit hash
 * @param {string} dir - 目录
 * @returns {string|null} commit hash 或 null
 */
function getGitCommitFromCommand(dir = process.cwd()) {
  try {
    const result = execSync('git rev-parse HEAD', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return formatCommit(result.trim());
  } catch {
    return null;
  }
}

/**
 * 获取 Git 分支名称
 * @param {string} dir - 目录
 * @returns {string|null} 分支名称或 null
 */
function getGitBranch(dir = process.cwd()) {
  try {
    const result = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * 获取 Git 远程 URL
 * @param {string} dir - 目录
 * @param {string} remote - 远程名称
 * @returns {string|null} 远程 URL 或 null
 */
function getGitRemoteUrl(dir = process.cwd(), remote = 'origin') {
  try {
    const result = execSync(`git remote get-url ${remote}`, {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * 检查是否在 Git 仓库中
 * @param {string} dir - 目录
 * @returns {boolean} 是否在 Git 仓库中
 */
function isGitRepository(dir) {
  // 参数验证：确保是字符串
  if (typeof dir !== 'string' || !dir) {
    dir = process.cwd();
  }
  return findGitRoot(dir) !== null;
}

/**
 * 获取 Git 状态（简洁版）
 * @param {string} dir - 目录
 * @returns {object} Git 状态
 */
function getGitStatus(dir = process.cwd()) {
  try {
    const result = execSync('git status --porcelain', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const lines = result.trim().split('\n').filter(Boolean);
    
    return {
      clean: lines.length === 0,
      staged: lines.filter(line => line.match(/^[MADRC]/)).length,
      unstaged: lines.filter(line => line.match(/^.[MADRC]/)).length,
      untracked: lines.filter(line => line.match(/^\?\?/)).length,
      total: lines.length
    };
  } catch {
    return {
      clean: false,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      total: 0
    };
  }
}

/**
 * 清除 commit 缓存
 * @param {string} key - 缓存键（可选）
 */
function clearCommitCache(key) {
  if (key) {
    COMMIT_CACHE.delete(key);
  } else {
    COMMIT_CACHE.clear();
  }
}

module.exports = {
  // Git 根目录查找
  findGitRoot,
  resolveGitDirFromMarker,
  resolveGitHeadPath,
  hasGitMarker,
  
  // Commit 读取
  getGitCommit,
  getGitCommitFromCommand,
  formatCommit,
  
  // Git 信息
  getGitBranch,
  getGitRemoteUrl,
  isGitRepository,
  getGitStatus,
  
  // 工具函数
  safeReadFilePrefix,
  clearCommitCache,
  
  // 常量
  DEFAULT_GIT_DISCOVERY_MAX_DEPTH
};