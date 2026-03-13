/**
 * Stable Node.js Path
 * 稳定的 Node.js 路径 - 解析跨平台的稳定 Node.js 可执行文件路径
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析稳定的 Node.js 路径
 * @param {string} nodePath - Node.js 路径
 * @returns {Promise<string>} 稳定的 Node.js 路径
 */
async function resolveStableNodePath(nodePath) {
  // 检查是否为 Homebrew Cellar 路径
  // Homebrew Cellar paths (e.g. /opt/homebrew/Cellar/node/25.7.0/bin/node)
  // break when Homebrew upgrades Node and removes the old version directory.
  // Resolve these to a stable Homebrew-managed path that survives upgrades:
  //   - Default formula "node": <prefix>/opt/node/bin/node  or  <prefix>/bin/node
  //   - Versioned formula "node@22": <prefix>/opt/node@22/bin/node  (keg-only)
  
  const cellarMatch = nodePath.match(/^(.+?)\/Cellar\/([^/]+)\/[^/]+\/bin\/node$/);
  if (!cellarMatch) {
    return nodePath;
  }
  
  const prefix = cellarMatch[1]; // e.g. /opt/homebrew
  const formula = cellarMatch[2]; // e.g. "node" or "node@22"

  // Try the Homebrew opt symlink first — works for both default and versioned formulas.
  const optPath = `${prefix}/opt/${formula}/bin/node`;
  try {
    await fs.promises.access(optPath);
    return optPath;
  } catch {
    // fall through
  }

  // For the default "node" formula, also try the direct bin symlink.
  if (formula === 'node') {
    const binPath = `${prefix}/bin/node`;
    try {
      await fs.promises.access(binPath);
      return binPath;
    } catch {
      // fall through
    }
  }

  return nodePath;
}

/**
 * 解析稳定的 Node.js 路径（同步）
 * @param {string} nodePath - Node.js 路径
 * @returns {string} 稳定的 Node.js 路径
 */
function resolveStableNodePathSync(nodePath) {
  const cellarMatch = nodePath.match(/^(.+?)\/Cellar\/([^/]+)\/[^/]+\/bin\/node$/);
  if (!cellarMatch) {
    return nodePath;
  }
  
  const prefix = cellarMatch[1];
  const formula = cellarMatch[2];

  // Try the Homebrew opt symlink first
  const optPath = `${prefix}/opt/${formula}/bin/node`;
  try {
    if (fs.existsSync(optPath)) {
      return optPath;
    }
  } catch {
    // fall through
  }

  // For the default "node" formula, also try the direct bin symlink
  if (formula === 'node') {
    const binPath = `${prefix}/bin/node`;
    try {
      if (fs.existsSync(binPath)) {
        return binPath;
      }
    } catch {
      // fall through
    }
  }

  return nodePath;
}

/**
 * 获取 Node.js 可执行文件路径
 * @returns {string} Node.js 可执行文件路径
 */
function getNodeExecutablePath() {
  return process.execPath;
}

/**
 * 获取稳定的 Node.js 可执行文件路径
 * @returns {Promise<string>} 稳定的 Node.js 可执行文件路径
 */
async function getStableNodeExecutablePath() {
  return await resolveStableNodePath(process.execPath);
}

/**
 * 获取稳定的 Node.js 可执行文件路径（同步）
 * @returns {string} 稳定的 Node.js 可执行文件路径
 */
function getStableNodeExecutablePathSync() {
  return resolveStableNodePathSync(process.execPath);
}

/**
 * 获取 Node.js 版本目录
 * @returns {string} Node.js 版本目录
 */
function getNodeVersionDir() {
  return path.dirname(process.execPath);
}

/**
 * 获取 npm 可执行文件路径
 * @returns {string} npm 可执行文件路径
 */
function getNpmPath() {
  const nodeDir = path.dirname(process.execPath);
  const npmPath = path.join(nodeDir, 'npm');
  
  try {
    if (fs.existsSync(npmPath)) {
      return npmPath;
    }
  } catch {
    // fall through
  }
  
  // Try npm.cmd on Windows
  if (process.platform === 'win32') {
    const npmCmdPath = path.join(nodeDir, 'npm.cmd');
    if (fs.existsSync(npmCmdPath)) {
      return npmCmdPath;
    }
  }
  
  return npmPath;
}

/**
 * 获取 npx 可执行文件路径
 * @returns {string} npx 可执行文件路径
 */
function getNpxPath() {
  const nodeDir = path.dirname(process.execPath);
  const npxPath = path.join(nodeDir, 'npx');
  
  try {
    if (fs.existsSync(npxPath)) {
      return npxPath;
    }
  } catch {
    // fall through
  }
  
  // Try npx.cmd on Windows
  if (process.platform === 'win32') {
    const npxCmdPath = path.join(nodeDir, 'npx.cmd');
    if (fs.existsSync(npxCmdPath)) {
      return npxCmdPath;
    }
  }
  
  return npxPath;
}

/**
 * 检查 Node.js 是否从 Homebrew 安装
 * @returns {boolean} 是否从 Homebrew 安装
 */
function isHomebrewNode() {
  const execPath = process.execPath;
  return execPath.includes('/Cellar/node/') || execPath.includes('/opt/node/');
}

/**
 * 检查 Node.js 是否从 nvm 安装
 * @returns {boolean} 是否从 nvm 安装
 */
function isNvmNode() {
  const execPath = process.execPath;
  return execPath.includes('/.nvm/') || execPath.includes('/nvm/');
}

/**
 * 检查 Node.js 是否从官方安装器安装
 * @returns {boolean} 是否从官方安装器安装
 */
function isOfficialNode() {
  const execPath = process.execPath;
  return execPath.includes('/Program Files/nodejs/') || execPath.includes('/usr/local/bin/node');
}

/**
 * 获取 Node.js 安装类型
 * @returns {string} 安装类型
 */
function getNodeInstallationType() {
  if (isHomebrewNode()) {
    return 'homebrew';
  }
  if (isNvmNode()) {
    return 'nvm';
  }
  if (isOfficialNode()) {
    return 'official';
  }
  return 'unknown';
}

module.exports = {
  resolveStableNodePath,
  resolveStableNodePathSync,
  getNodeExecutablePath,
  getStableNodeExecutablePath,
  getStableNodeExecutablePathSync,
  getNodeVersionDir,
  getNpmPath,
  getNpxPath,
  isHomebrewNode,
  isNvmNode,
  isOfficialNode,
  getNodeInstallationType
};