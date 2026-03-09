/**
 * iFlow SelfRepair Module
 * 自修复系统
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const REPAIR_DIR = path.join(__dirname, '..', 'selfrepair-data');
if (!fs.existsSync(REPAIR_DIR)) fs.mkdirSync(REPAIR_DIR, { recursive: true });

// 系统状态
const stateFile = path.join(REPAIR_DIR, 'system_state.json');
let systemState = fs.existsSync(stateFile) 
  ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  : { health: 'unknown', issues: [], lastCheck: null };

// 检查系统状态
function check() {
  const start = Date.now();
  try {
    const issues = [];
    
    // 内存检查
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
      issues.push({ type: 'memory', severity: 'high', message: 'High memory usage' });
    }
    
    // 磁盘检查（简单）
    try {
      const stats = fs.statSync(process.cwd());
      // 可以添加更多检查
    } catch (e) {
      issues.push({ type: 'disk', severity: 'medium', message: e.message });
    }
    
    // 更新状态
    systemState = {
      health: issues.length === 0 ? 'healthy' : (issues.some(i => i.severity === 'high') ? 'critical' : 'warning'),
      issues,
      lastCheck: new Date().toISOString(),
      uptime: process.uptime()
    };
    
    fs.writeFileSync(stateFile, JSON.stringify(systemState, null, 2));
    
    return { status: 'ok', state: systemState, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 尝试修复
function repair(issue) {
  const start = Date.now();
  try {
    const repairId = uuidv4();
    const actions = [];
    
    // 兼容 issue.type 和 issue.issueType 两种命名
    const issueType = issue.type || issue.issueType;
    
    switch (issueType) {
      case 'memory':
        // 触发垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
          actions.push('Triggered garbage collection');
        } else {
          actions.push('GC not available (run with --expose-gc)');
        }
        break;
        
      case 'disk':
        actions.push('Cleanup temporary files');
        // 清理临时文件
        const tmpDir = path.join(REPAIR_DIR, 'tmp');
        if (fs.existsSync(tmpDir)) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        break;
        
      default:
        actions.push(`No repair action for type: ${issueType || 'unknown'}`);
    }
    
    const result = {
      id: repairId,
      issue,
      actions,
      status: 'completed',
      timestamp: new Date().toISOString()
    };
    
    const filePath = path.join(REPAIR_DIR, `repair-${repairId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    
    return { status: 'ok', repair: result, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取状态
function getState() {
  const start = Date.now();
  return { status: 'ok', state: systemState, time: Date.now() - start };
}

// 重置状态
function reset() {
  const start = Date.now();
  try {
    systemState = { health: 'unknown', issues: [], lastCheck: null };
    fs.writeFileSync(stateFile, JSON.stringify(systemState, null, 2));
    
    return { status: 'ok', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 记录错误
function logError(error, context = {}) {
  const start = Date.now();
  try {
    const errorId = uuidv4();
    const record = {
      id: errorId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      timestamp: new Date().toISOString()
    };
    
    const filePath = path.join(REPAIR_DIR, `error-${errorId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
    
    // 添加到问题列表
    systemState.issues.push({
      type: 'error',
      severity: 'medium',
      message: error.message,
      errorId,
      timestamp: record.timestamp
    });
    
    fs.writeFileSync(stateFile, JSON.stringify(systemState, null, 2));
    
    return { status: 'ok', errorId, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取修复历史
function getHistory(limit = 20) {
  const start = Date.now();
  try {
    const files = fs.readdirSync(REPAIR_DIR)
      .filter(f => f.startsWith('repair-') && f.endsWith('.json'))
      .slice(-limit);
    
    const history = files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(REPAIR_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    return { status: 'ok', history, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

module.exports = {
  check,
  repair,
  getState,
  reset,
  logError,
  getHistory
};
