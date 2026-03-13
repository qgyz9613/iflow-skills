/**
 * iFlow Process Restart Module
 * 进程重启模块，整合自 OpenClaw 的进程重启模块
 */

const { spawn } = require('child_process');

/**
 * 重启模式
 */
const RespawnMode = {
  SPAWNED: 'spawned',
  SUPERVISED: 'supervised',
  DISABLED: 'disabled',
  FAILED: 'failed'
};

/**
 * 检查值是否为真值
 * @param {string|undefined} value - 值
 * @returns {boolean} 是否为真值
 */
function isTruthy(value) {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

/**
 * 检测重启监管器类型
 * @param {object} env - 环境变量
 * @returns {string|null} 监管器类型
 */
function detectRespawnSupervisor(env) {
  // 检查 launchd（macOS）
  if (env.LAUNCHD_SOCKET || env.LAUNCH_JOB_KEY) {
    return 'launchd';
  }
  
  // 检查 systemd（Linux）
  if (env.NOTIFY_SOCKET || env.INVOCATION_ID) {
    return 'systemd';
  }
  
  // 检查 Windows 计划任务
  if (process.platform === 'win32' && env.SCHEDULED_TASK) {
    return 'schtasks';
  }
  
  return null;
}

/**
 * 重启当前进程（获取新 PID）
 * @returns {object} 重启结果
 */
function restartGatewayProcessWithFreshPid() {
  // 检查是否禁用重启
  if (isTruthy(process.env.IFLOW_NO_RESPAWN)) {
    return {
      mode: RespawnMode.DISABLED,
      detail: 'Restart disabled by IFLOW_NO_RESPAWN'
    };
  }
  
  // 检测监管器
  const supervisor = detectRespawnSupervisor(process.env);
  
  if (supervisor) {
    return {
      mode: RespawnMode.SUPERVISED,
      detail: `Managed by ${supervisor}, supervisor will restart process`
    };
  }
  
  // Windows 上不支持独立重启
  if (process.platform === 'win32') {
    return {
      mode: RespawnMode.DISABLED,
      detail: 'Detached respawn unsupported on Windows without Scheduled Task'
    };
  }
  
  // 使用独立子进程重启
  try {
    const args = [...process.execArgv, ...process.argv.slice(1)];
    const child = spawn(process.execPath, args, {
      env: process.env,
      detached: true,
      stdio: 'inherit'
    });
    
    child.unref();
    
    return {
      mode: RespawnMode.SPAWNED,
      pid: child.pid,
      detail: `Spawned detached child process with PID ${child.pid}`
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      mode: RespawnMode.FAILED,
      detail: `Failed to spawn child process: ${detail}`
    };
  }
}

/**
 * 优雅地重启进程
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<object>} 重启结果
 */
async function gracefulRestart(timeout = 5000) {
  return new Promise((resolve) => {
    const result = restartGatewayProcessWithFreshPid();
    
    if (result.mode === RespawnMode.SUPERVISED) {
      // 监管器会处理重启，直接退出
      setTimeout(() => {
        process.exit(0);
      }, 100);
      resolve(result);
    } else if (result.mode === RespawnMode.SPAWNED) {
      // 等待子进程启动后退出
      setTimeout(() => {
        process.exit(0);
      }, timeout);
      resolve(result);
    } else {
      resolve(result);
    }
  });
}

/**
 * 重启进程（强制模式）
 * @returns {object} 重启结果
 */
function forceRestart() {
  // 强制重启，忽略环境变量
  const originalNoRespawn = process.env.IFLOW_NO_RESPAWN;
  delete process.env.IFLOW_NO_RESPAWN;
  
  const result = restartGatewayProcessWithFreshPid();
  
  // 恢复环境变量
  if (originalNoRespawn) {
    process.env.IFLOW_NO_RESPAWN = originalNoRespawn;
  }
  
  return result;
}

/**
 * 检查是否可以重启
 * @returns {object} 检查结果
 */
function canRestart() {
  const result = {
    canRestart: false,
    reason: '',
    mode: null
  };
  
  if (isTruthy(process.env.IFLOW_NO_RESPAWN)) {
    result.reason = 'Restart disabled by IFLOW_NO_RESPAWN';
    return result;
  }
  
  const supervisor = detectRespawnSupervisor(process.env);
  
  if (supervisor) {
    result.canRestart = true;
    result.mode = RespawnMode.SUPERVISED;
    result.reason = `Managed by ${supervisor}`;
    return result;
  }
  
  if (process.platform === 'win32') {
    result.reason = 'Detached respawn unsupported on Windows without Scheduled Task';
    return result;
  }
  
  result.canRestart = true;
  result.mode = RespawnMode.SPAWNED;
  result.reason = 'Can spawn detached child process';
  return result;
}

/**
 * 获取进程信息
 * @returns {object} 进程信息
 */
function getProcessInfo() {
  return {
    pid: process.pid,
    ppid: process.ppid,
    platform: process.platform,
    execPath: process.execPath,
    execArgv: process.execArgv,
    argv: process.argv,
    cwd: process.cwd(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      IFLOW_NO_RESPAWN: process.env.IFLOW_NO_RESPAWN
    },
    supervisor: detectRespawnSupervisor(process.env),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
}

/**
 * 等待进程退出
 * @param {number} pid - 进程 ID
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<boolean>} 是否在超时前退出
 */
async function waitForProcessExit(pid, timeout = 10000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      try {
        process.kill(pid, 0);
        // 进程还在运行
        if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          resolve(false);
        }
      } catch {
        // 进程已退出
        clearInterval(interval);
        resolve(true);
      }
    }, 100);
  });
}

/**
 * 杀死进程
 * @param {number} pid - 进程 ID
 * @param {string} signal - 信号
 * @returns {boolean} 是否成功
 */
function killProcess(pid, signal = 'SIGTERM') {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

/**
 * 杀死进程树
 * @param {number} rootPid - 根进程 ID
 * @param {string} signal - 信号
 * @returns {Promise<boolean>} 是否成功
 */
async function killProcessTree(rootPid, signal = 'SIGTERM') {
  // Windows 上需要使用 taskkill
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      execSync(`taskkill /F /PID ${rootPid} /T`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  
  // Unix 上先发送信号
  if (!killProcess(rootPid, signal)) {
    return false;
  }
  
  // 等待进程退出
  const exited = await waitForProcessExit(rootPid, 5000);
  
  if (!exited) {
    // 强制杀死
    return killProcess(rootPid, 'SIGKILL');
  }
  
  return true;
}

/**
 * 重启进程并等待
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<object>} 重启结果
 */
async function restartAndWait(timeout = 10000) {
  const result = restartGatewayProcessWithFreshPid();
  
  if (result.mode === RespawnMode.SPAWNED) {
    // 等待子进程启动
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 检查子进程是否还在运行
    if (result.pid) {
      const alive = await waitForProcessExit(result.pid, timeout);
      result.childAlive = !alive;
    }
  }
  
  return result;
}

module.exports = {
  // 重启模式
  RespawnMode,
  
  // 重启方法
  restartGatewayProcessWithFreshPid,
  gracefulRestart,
  forceRestart,
  restartAndWait,
  
  // 检查方法
  canRestart,
  detectRespawnSupervisor,
  
  // 进程信息
  getProcessInfo,
  
  // 进程控制
  waitForProcessExit,
  killProcess,
  killProcessTree,
  
  // 工具函数
  isTruthy
};