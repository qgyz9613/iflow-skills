/**
 * WSL (Windows Subsystem for Linux) 检测模块
 * 用于检测当前运行环境是否在 WSL/WSL2 中
 */

const fs = require('node:fs');

let wslCached = null;

/**
 * 重置 WSL 缓存（主要用于测试）
 */
function resetWSLStateForTests() {
  wslCached = null;
}

/**
 * 通过环境变量检查是否在 WSL 环境中
 */
function isWSLEnv() {
  if (process.env.WSL_INTEROP || process.env.WSL_DISTRO_NAME || process.env.WSLENV) {
    return true;
  }
  return false;
}

/**
 * 同步检查是否在 WSL 环境中
 * 首先检查环境变量，然后检查 /proc/version
 */
function isWSLSync() {
  if (process.platform !== 'linux') {
    return false;
  }
  if (isWSLEnv()) {
    return true;
  }
  try {
    const release = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return release.includes('microsoft') || release.includes('wsl');
  } catch {
    return false;
  }
}

/**
 * 同步检查是否在 WSL2 环境中
 */
function isWSL2Sync() {
  if (!isWSLSync()) {
    return false;
  }
  try {
    const version = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return version.includes('wsl2') || version.includes('microsoft-standard');
  } catch {
    return false;
  }
}

/**
 * 异步检查是否在 WSL 环境中
 * 带缓存功能
 */
async function isWSL() {
  if (wslCached !== null) {
    return wslCached;
  }
  if (process.platform !== 'linux') {
    wslCached = false;
    return wslCached;
  }
  if (isWSLEnv()) {
    wslCached = true;
    return wslCached;
  }
  try {
    const release = await fs.promises.readFile('/proc/sys/kernel/osrelease', 'utf8');
    wslCached =
      release.toLowerCase().includes('microsoft') || release.toLowerCase().includes('wsl');
  } catch {
    wslCached = false;
  }
  return wslCached;
}

module.exports = {
  resetWSLStateForTests,
  isWSLEnv,
  isWSLSync,
  isWSL2Sync,
  isWSL
};