/**
 * OS Summary
 * 操作系统摘要 - 获取操作系统信息
 */

const { spawnSync } = require('child_process');
const os = require('os');

/**
 * 安全修剪
 * @param {unknown} value - 值
 * @returns {string} 修剪后的字符串
 */
function safeTrim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * macOS 版本
 * @returns {string} 版本字符串
 */
function macosVersion() {
  try {
    const res = spawnSync('sw_vers', ['-productVersion'], { encoding: 'utf8' });
    const out = safeTrim(res.stdout);
    return out || os.release();
  } catch {
    return os.release();
  }
}

/**
 * 解析操作系统摘要
 * @returns {OsSummary} 操作系统摘要
 */
function resolveOsSummary() {
  const platform = os.platform();
  const release = os.release();
  const arch = os.arch();
  const label = (() => {
    if (platform === 'darwin') {
      return `macos ${macosVersion()} (${arch})`;
    }
    if (platform === 'win32') {
      return `windows ${release} (${arch})`;
    }
    return `${platform} ${release} (${arch})`;
  })();
  return { platform, arch, release, label };
}

/**
 * 获取操作系统摘要
 * @returns {OsSummary} 操作系统摘要
 */
function getOsSummary() {
  return resolveOsSummary();
}

/**
 * 获取 CPU 信息
 * @returns {Object} CPU 信息
 */
function getCpuInfo() {
  const cpus = os.cpus();
  if (cpus.length === 0) {
    return {
      model: 'unknown',
      cores: 0,
      arch: os.arch()
    };
  }
  return {
    model: cpus[0].model,
    cores: cpus.length,
    arch: os.arch()
  };
}

/**
 * 获取内存信息
 * @returns {Object} 内存信息
 */
function getMemoryInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    total,
    free,
    used,
    totalGB: Math.round(total / 1024 / 1024 / 1024),
    freeGB: Math.round(free / 1024 / 1024 / 1024),
    usedGB: Math.round(used / 1024 / 1024 / 1024),
    usagePercent: Math.round((used / total) * 100)
  };
}

/**
 * 获取系统负载
 * @returns {number[]} 负载平均值
 */
function getLoadAverage() {
  return os.loadavg();
}

/**
 * 获取系统运行时间
 * @returns {Object} 运行时间信息
 */
function getUptime() {
  const uptime = os.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return {
    seconds: uptime,
    days,
    hours,
    minutes,
    secondsRemainder: seconds,
    formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`
  };
}

/**
 * 获取网络接口
 * @returns {Object} 网络接口信息
 */
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const result = {};
  for (const [name, addrs] of Object.entries(interfaces)) {
    const filtered = addrs.filter(addr => !addr.internal);
    if (filtered.length > 0) {
      result[name] = filtered;
    }
  }
  return result;
}

/**
 * 获取主机名
 * @returns {string} 主机名
 */
function getHostname() {
  return os.hostname();
}

/**
 * 获取用户信息
 * @returns {Object} 用户信息
 */
function getUserInfo() {
  return {
    username: os.userInfo().username,
    homedir: os.homedir(),
    shell: os.userInfo().shell
  };
}

/**
 * 获取临时目录
 * @returns {string} 临时目录
 */
function getTempDir() {
  return os.tmpdir();
}

/**
 * 获取端序
 * @returns {string} 端序（'BE' 或 'LE'）
 */
function getEndianness() {
  return os.endianness();
}

/**
 * 获取系统摘要
 * @returns {Object} 完整系统摘要
 */
function getSystemSummary() {
  return {
    os: getOsSummary(),
    cpu: getCpuInfo(),
    memory: getMemoryInfo(),
    loadAverage: getLoadAverage(),
    uptime: getUptime(),
    network: getNetworkInterfaces(),
    hostname: getHostname(),
    user: getUserInfo(),
    tempDir: getTempDir(),
    endianness: getEndianness()
  };
}

/**
 * 检查是否为 Windows
 * @returns {boolean} 是否为 Windows
 */
function isWindows() {
  return process.platform === 'win32';
}

/**
 * 检查是否为 macOS
 * @returns {boolean} 是否为 macOS
 */
function isMacOS() {
  return process.platform === 'darwin';
}

/**
 * 检查是否为 Linux
 * @returns {boolean} 是否为 Linux
 */
function isLinux() {
  return process.platform === 'linux';
}

/**
 * 检查是否为 64 位系统
 * @returns {boolean} 是否为 64 位
 */
function is64Bit() {
  return os.arch().includes('64');
}

/**
 * 检查是否为 ARM 架构
 * @returns {boolean} 是否为 ARM
 */
function isArm() {
  return os.arch().includes('arm') || os.arch().includes('aarch');
}

module.exports = {
  resolveOsSummary,
  getOsSummary,
  getCpuInfo,
  getMemoryInfo,
  getLoadAverage,
  getUptime,
  getNetworkInterfaces,
  getHostname,
  getUserInfo,
  getTempDir,
  getEndianness,
  getSystemSummary,
  isWindows,
  isMacOS,
  isLinux,
  is64Bit,
  isArm
};