/**
 * Machine Name
 * 机器名称 - 获取机器的显示名称
 */

const { execFile } = require('child_process');
const os = require('os');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

let cachedPromise = null;

/**
 * 尝试使用 scutil 获取 macOS 信息
 * @param {'ComputerName' | 'LocalHostName'} key - scutil 键
 * @returns {Promise<string|null>} 值
 */
async function tryScutil(key) {
  try {
    const { stdout } = await execFileAsync('/usr/sbin/scutil', ['--get', key], {
      timeout: 1000,
      windowsHide: true
    });
    const value = String(stdout ?? '').trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * 获取备用主机名
 * @returns {string} 主机名
 */
function fallbackHostName() {
  return (
    os.hostname()
      .replace(/\.local$/i, '')
      .trim() || 'openclaw'
  );
}

/**
 * 获取机器显示名称
 * @returns {Promise<string>} 机器显示名称
 */
async function getMachineDisplayName() {
  if (cachedPromise) {
    return cachedPromise;
  }
  
  cachedPromise = (async () => {
    // 测试环境返回简单名称
    if (process.env.VITEST || process.env.NODE_ENV === 'test') {
      return fallbackHostName();
    }
    
    // macOS 特殊处理
    if (process.platform === 'darwin') {
      const computerName = await tryScutil('ComputerName');
      if (computerName) {
        return computerName;
      }
      const localHostName = await tryScutil('LocalHostName');
      if (localHostName) {
        return localHostName;
      }
    }
    
    return fallbackHostName();
  })();
  
  return cachedPromise;
}

/**
 * 获取机器显示名称（同步）
 * @returns {string} 机器显示名称
 */
function getMachineDisplayNameSync() {
  return fallbackHostName();
}

/**
 * 获取主机名
 * @returns {string} 主机名
 */
function getHostname() {
  return os.hostname();
}

/**
 * 获取简短主机名（不含域名）
 * @returns {string} 简短主机名
 */
function getShortHostname() {
  const hostname = os.hostname();
  const parts = hostname.split('.');
  return parts[0] || hostname;
}

/**
 * 获取机器类型
 * @returns {string} 机器类型
 */
function getMachineType() {
  const platform = process.platform;
  const arch = os.arch();
  
  if (platform === 'darwin') {
    return `macos-${arch}`;
  }
  if (platform === 'win32') {
    return `windows-${arch}`;
  }
  if (platform === 'linux') {
    return `linux-${arch}`;
  }
  
  return `${platform}-${arch}`;
}

/**
 * 获取机器唯一标识符
 * @returns {string} 唯一标识符
 */
function getMachineId() {
  const hostname = os.hostname();
  const platform = process.platform;
  const arch = os.arch();
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';
  
  // 创建一个稳定的机器 ID
  const idString = `${hostname}-${platform}-${arch}-${cpuModel}`;
  const crypto = require('crypto');
  return crypto.createHash('md5').update(idString).digest('hex');
}

/**
 * 检查是否为本地主机
 * @returns {boolean} 是否为本地主机
 */
function isLocalhost() {
  const hostname = os.hostname();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * 获取机器信息摘要
 * @returns {Object} 机器信息
 */
function getMachineInfo() {
  return {
    hostname: getHostname(),
    shortHostname: getShortHostname(),
    displayName: getMachineDisplayNameSync(),
    type: getMachineType(),
    platform: process.platform,
    arch: os.arch(),
    uptime: os.uptime(),
    isLocal: isLocalhost()
  };
}

/**
 * 清除缓存的机器名称
 */
function clearMachineNameCache() {
  cachedPromise = null;
}

module.exports = {
  getMachineDisplayName,
  getMachineDisplayNameSync,
  getHostname,
  getShortHostname,
  getMachineType,
  getMachineId,
  isLocalhost,
  getMachineInfo,
  clearMachineNameCache
};