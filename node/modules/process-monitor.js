/**
 * iFlow Process Monitor Module
 * 进程监控模块，整合自 OpenClaw 的进程管理模块
 */

const { spawn } = require('child_process');

/**
 * 平台信息
 */
const PLATFORM = process.platform;
const IS_WINDOWS = PLATFORM === 'win32';
const IS_MAC = PLATFORM === 'darwin';
const IS_LINUX = PLATFORM === 'linux';

/**
 * 检查 PID 是否有效
 * @param {number} pid - 进程 ID
 * @returns {Promise<boolean>} 是否有效
 */
async function isPidValid(pid) {
  if (!pid || typeof pid !== 'number' || pid <= 0) {
    return false;
  }
  
  if (IS_WINDOWS) {
    return isPidValidWindows(pid);
  } else if (IS_MAC || IS_LINUX) {
    return isPidValidUnix(pid);
  }
  
  return false;
}

/**
 * Windows 下检查 PID 是否有效
 * @param {number} pid - 进程 ID
 * @returns {Promise<boolean>} 是否有效
 */
function isPidValidWindows(pid) {
  return new Promise((resolve) => {
    try {
      process.kill(pid, 0);
      resolve(true);
    } catch {
      // 尝试使用 tasklist 命令
      spawn('tasklist', ['/FI', `PID eq ${pid}`, '/NH'])
        .on('error', () => resolve(false))
        .on('exit', (code) => {
          resolve(code === 0);
        });
    }
  });
}

/**
 * Unix 下检查 PID 是否有效
 * @param {number} pid - 进程 ID
 * @returns {Promise<boolean>} 是否有效
 */
function isPidValidUnix(pid) {
  return new Promise((resolve) => {
    try {
      process.kill(pid, 0);
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

/**
 * 检查进程是否为僵尸进程
 * @param {number} pid - 进程 ID
 * @returns {Promise<boolean>} 是否为僵尸进程
 */
async function isZombieProcess(pid) {
  if (IS_WINDOWS) {
    return false; // Windows 没有僵尸进程概念
  }
  
  try {
    const result = await executeCommand('ps', ['-p', String(pid), '-o', 'state=']);
    return result.trim() === 'Z';
  } catch {
    return false;
  }
}

/**
 * 获取进程信息
 * @param {number} pid - 进程 ID
 * @returns {Promise<Object|null>} 进程信息
 */
async function getProcessInfo(pid) {
  if (!await isPidValid(pid)) {
    return null;
  }
  
  if (IS_WINDOWS) {
    return getProcessInfoWindows(pid);
  } else if (IS_MAC || IS_LINUX) {
    return getProcessInfoUnix(pid);
  }
  
  return null;
}

/**
 * Windows 下获取进程信息
 * @param {number} pid - 进程 ID
 * @returns {Promise<Object>} 进程信息
 */
function getProcessInfoWindows(pid) {
  return new Promise((resolve) => {
    const result = {
      pid,
      name: '',
      command: '',
      cpu: 0,
      memory: 0,
      startTime: null
    };
    
    spawn('wmic', ['process', 'where', `ProcessId=${pid}`, 'get', 'Name,CommandLine,CreationDate', '/format:csv'])
      .on('error', () => resolve(null))
      .stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(',');
          result.name = parts[1] || '';
          result.command = parts[2] || '';
          if (parts[3]) {
            result.startTime = parseWmicDate(parts[3].trim());
          }
        }
      })
      .on('exit', () => resolve(result));
  });
}

/**
 * Unix 下获取进程信息
 * @param {number} pid - 进程 ID
 * @returns {Promise<Object>} 进程信息
 */
function getProcessInfoUnix(pid) {
  return new Promise(async (resolve) => {
    try {
      const [stat, command] = await Promise.all([
        executeCommand('cat', [`/proc/${pid}/stat`]),
        executeCommand('cat', [`/proc/${pid}/cmdline`])
      ]);
      
      const statParts = stat.split(' ');
      const startTime = parseInt(statParts[21], 10);
      
      resolve({
        pid,
        name: command.split(' ')[0] || '',
        command: command.replace(/\0/g, ' ').trim(),
        cpu: 0,
        memory: 0,
        startTime: new Date(startTime * 1000)
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * 获取所有子进程
 * @param {number} parentPid - 父进程 ID
 * @returns {Promise<number[]>} 子进程 PID 列表
 */
async function getChildProcesses(parentPid) {
  if (IS_WINDOWS) {
    return getChildProcessesWindows(parentPid);
  } else if (IS_MAC || IS_LINUX) {
    return getChildProcessesUnix(parentPid);
  }
  
  return [];
}

/**
 * Windows 下获取子进程
 * @param {number} parentPid - 父进程 ID
 * @returns {Promise<number[]>} 子进程 PID 列表
 */
function getChildProcessesWindows(parentPid) {
  return new Promise((resolve) => {
    const children = [];
    
    spawn('wmic', ['process', 'where', `ParentProcessId=${parentPid}`, 'get', 'ProcessId', '/format:csv'])
      .on('error', () => resolve(children))
      .stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          const parts = line.split(',');
          if (parts.length > 1) {
            const pid = parseInt(parts[1], 10);
            if (!isNaN(pid)) {
              children.push(pid);
            }
          }
        });
      })
      .on('exit', () => resolve(children));
  });
}

/**
 * Unix 下获取子进程
 * @param {number} parentPid - 父进程 ID
 * @returns {Promise<number[]>} 子进程 PID 列表
 */
async function getChildProcessesUnix(parentPid) {
  try {
    const output = await executeCommand('ps', ['-eo', 'pid,ppid']);
    const lines = output.split('\n');
    const children = [];
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const pid = parseInt(parts[0], 10);
        const ppid = parseInt(parts[1], 10);
        if (!isNaN(pid) && ppid === parentPid) {
          children.push(pid);
        }
      }
    });
    
    return children;
  } catch {
    return [];
  }
}

/**
 * 获取进程树
 * @param {number} rootPid - 根进程 ID
 * @returns {Promise<Object>} 进程树
 */
async function getProcessTree(rootPid) {
  const root = await getProcessInfo(rootPid);
  if (!root) {
    return null;
  }
  
  root.children = [];
  const children = await getChildProcesses(rootPid);
  
  for (const childPid of children) {
    const childTree = await getProcessTree(childPid);
    if (childTree) {
      root.children.push(childTree);
    }
  }
  
  return root;
}

/**
 * 终止进程树
 * @param {number} rootPid - 根进程 ID
 * @param {string} signal - 信号名称（Unix）或终止方式（Windows）
 * @returns {Promise<boolean>} 是否成功
 */
async function killProcessTree(rootPid, signal = 'SIGTERM') {
  const tree = await getProcessTree(rootPid);
  if (!tree) {
    return false;
  }
  
  // 后序遍历，先终止子进程
  const pids = [];
  function collectPids(node) {
    node.children.forEach(child => collectPids(child));
    pids.push(node.pid);
  }
  collectPids(tree);
  
  // 反向终止，从叶子节点开始
  for (let i = pids.length - 1; i >= 0; i--) {
    try {
      process.kill(pids[i], signal);
    } catch {
      // 忽略错误
    }
  }
  
  // 等待进程退出
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 检查是否全部终止
  for (const pid of pids) {
    if (await isPidValid(pid)) {
      // 强制终止
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // 忽略错误
      }
    }
  }
  
  return true;
}

/**
 * 等待进程退出
 * @param {number} pid - 进程 ID
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<boolean>} 是否在超时前退出
 */
async function waitForProcessExit(pid, timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (!await isPidValid(pid)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}

/**
 * 获取进程 CPU 使用率
 * @param {number} pid - 进程 ID
 * @returns {Promise<number>} CPU 使用率（百分比）
 */
async function getProcessCpuUsage(pid) {
  if (IS_WINDOWS) {
    return getProcessCpuUsageWindows(pid);
  } else if (IS_MAC || IS_LINUX) {
    return getProcessCpuUsageUnix(pid);
  }
  
  return 0;
}

/**
 * Windows 下获取进程 CPU 使用率
 * @param {number} pid - 进程 ID
 * @returns {Promise<number>} CPU 使用率
 */
function getProcessCpuUsageWindows(pid) {
  return new Promise((resolve) => {
    spawn('wmic', ['process', 'where', `ProcessId=${pid}`, 'get', 'WorkingSetSize', '/format:csv'])
      .on('error', () => resolve(0))
      .stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(',');
          const memory = parseInt(parts[1], 10);
          // Windows 上获取 CPU 使用率比较复杂，这里简化为 0
          resolve(0);
        }
      })
      .on('exit', () => resolve(0));
  });
}

/**
 * Unix 下获取进程 CPU 使用率
 * @param {number} pid - 进程 ID
 * @returns {Promise<number>} CPU 使用率
 */
async function getProcessCpuUsageUnix(pid) {
  try {
    const stat = await executeCommand('cat', [`/proc/${pid}/stat`]);
    const parts = stat.split(' ');
    const utime = parseInt(parts[13], 10);
    const stime = parseInt(parts[14], 10);
    const total = utime + stime;
    
    // 需要连续两次采样才能计算 CPU 使用率
    // 这里简化处理，返回 0
    return 0;
  } catch {
    return 0;
  }
}

/**
 * 获取进程内存使用量
 * @param {number} pid - 进程 ID
 * @returns {Promise<number>} 内存使用量（字节）
 */
async function getProcessMemoryUsage(pid) {
  if (IS_WINDOWS) {
    return getProcessMemoryUsageWindows(pid);
  } else if (IS_MAC || IS_LINUX) {
    return getProcessMemoryUsageUnix(pid);
  }
  
  return 0;
}

/**
 * Windows 下获取进程内存使用量
 * @param {number} pid - 进程 ID
 * @returns {Promise<number>} 内存使用量
 */
function getProcessMemoryUsageWindows(pid) {
  return new Promise((resolve) => {
    spawn('wmic', ['process', 'where', `ProcessId=${pid}`, 'get', 'WorkingSetSize', '/format:csv'])
      .on('error', () => resolve(0))
      .stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(',');
          const memory = parseInt(parts[1], 10);
          resolve(memory || 0);
        }
      })
      .on('exit', () => resolve(0));
  });
}

/**
 * Unix 下获取进程内存使用量
 * @param {number} pid - 进程 ID
 * @returns {Promise<number>} 内存使用量
 */
async function getProcessMemoryUsageUnix(pid) {
  try {
    const stat = await executeCommand('cat', [`/proc/${pid}/stat`]);
    const parts = stat.split(' ');
    const rss = parseInt(parts[23], 10);
    return rss * 4096; // 假设页面大小为 4KB
  } catch {
    return 0;
  }
}

/**
 * 解析 WMIC 日期格式
 * @param {string} wmicDate - WMIC 日期字符串
 * @returns {Date} 日期对象
 */
function parseWmicDate(wmicDate) {
  // WMIC 日期格式: YYYYMMDDHHMMSS.ffffff+ZZZ
  if (!wmicDate || wmicDate.length < 14) {
    return null;
  }
  
  const year = parseInt(wmicDate.substring(0, 4), 10);
  const month = parseInt(wmicDate.substring(4, 6), 10) - 1;
  const day = parseInt(wmicDate.substring(6, 8), 10);
  const hour = parseInt(wmicDate.substring(8, 10), 10);
  const minute = parseInt(wmicDate.substring(10, 12), 10);
  const second = parseInt(wmicDate.substring(12, 14), 10);
  
  return new Date(year, month, day, hour, minute, second);
}

/**
 * 执行命令
 * @param {string} command - 命令
 * @param {string[]} args - 参数
 * @returns {Promise<string>} 输出
 */
function executeCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    
    child.on('error', reject);
  });
}

module.exports = {
  // 进程检查
  isPidValid,
  isZombieProcess,
  getProcessInfo,
  
  // 进程树管理
  getChildProcesses,
  getProcessTree,
  killProcessTree,
  waitForProcessExit,
  
  // 进程资源
  getProcessCpuUsage,
  getProcessMemoryUsage,
  
  // 工具函数
  parseWmicDate,
  executeCommand,
  
  // 常量
  PLATFORM,
  IS_WINDOWS,
  IS_MAC,
  IS_LINUX
};