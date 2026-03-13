/**
 * iFlow Runtime System Module
 * 运行时系统 - 参考 OpenClaw runtime-system
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const RUNTIME_DIR = path.join(__dirname, '..', 'runtime-data');
if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });

// 系统事件队列
let systemEvents = [];

/**
 * 入队系统事件
 */
function enqueueSystemEvent(event) {
  const eventRecord = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...event
  };
  
  systemEvents.push(eventRecord);
  
  // 限制事件数量
  if (systemEvents.length > 1000) {
    systemEvents = systemEvents.slice(-1000);
  }
  
  return { status: 'ok', eventId: eventRecord.id };
}

/**
 * 获取系统事件
 */
function getSystemEvents(limit = 50) {
  return {
    status: 'ok',
    events: systemEvents.slice(-limit),
    total: systemEvents.length
  };
}

/**
 * 清空系统事件
 */
function clearSystemEvents() {
  systemEvents = [];
  return { status: 'ok' };
}

/**
 * 请求立即心跳
 */
function requestHeartbeatNow() {
  const heartbeat = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpus().map(cpu => ({
      model: cpu.model,
      speed: cpu.speed,
      times: cpu.times
    }))
  };
  
  return { status: 'ok', heartbeat };
}

/**
 * 带超时的命令执行
 */
function runCommandWithTimeout(command, options = {}) {
  const start = Date.now();
  
  return new Promise((resolve) => {
    const {
      timeoutMs = 60000,
      cwd = process.cwd(),
      env = process.env
    } = options;
    
    const child = exec(command, { cwd, env }, (error, stdout, stderr) => {
      const duration = Date.now() - start;
      
      if (error) {
        resolve({
          status: 'error',
          exitCode: error.code,
          signal: error.signal,
          stderr,
          stdout,
          duration
        });
      } else {
        resolve({
          status: 'ok',
          exitCode: 0,
          stdout,
          stderr,
          duration
        });
      }
    });
    
    // 超时处理
    if (timeoutMs > 0) {
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({
          status: 'timeout',
          message: `Command timed out after ${timeoutMs}ms`,
          duration: Date.now() - start
        });
      }, timeoutMs);
      
      child.on('exit', () => {
        clearTimeout(timeout);
      });
    }
  });
}

/**
 * 格式化原生依赖提示
 */
function formatNativeDependencyHint(dependency) {
  const hints = {
    '@napi-rs/canvas': 'Required for PDF image extraction. Install with: npm install @napi-rs/canvas',
    'pdfjs-dist': 'Required for PDF text extraction. Install with: npm install pdfjs-dist',
    'sharp': 'Required for image processing. Install with: npm install sharp'
  };
  
  return hints[dependency] || `Unknown dependency: ${dependency}`;
}

/**
 * 获取运行时状态
 */
function getRuntimeStatus() {
  const start = Date.now();
  
  try {
    const status = {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      pid: process.pid,
      cwd: process.cwd(),
      eventsCount: systemEvents.length
    };
    
    return { status: 'ok', runtime: status, time: Date.now() - start };
    
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 保存运行时快照
 */
function saveRuntimeSnapshot() {
  const start = Date.now();
  
  try {
    const snapshot = {
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        ppid: process.ppid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      platform: {
        arch: process.arch,
        platform: process.platform,
        nodeVersion: process.version
      },
      env: {
        cwd: process.cwd(),
        execPath: process.execPath
      }
    };
    
    const snapshotPath = path.join(RUNTIME_DIR, `snapshot-${Date.now()}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    
    return { 
      status: 'ok', 
      snapshotPath, 
      time: Date.now() - start 
    };
    
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

module.exports = {
  enqueueSystemEvent,
  getSystemEvents,
  clearSystemEvents,
  requestHeartbeatNow,
  runCommandWithTimeout,
  formatNativeDependencyHint,
  getRuntimeStatus,
  saveRuntimeSnapshot
};