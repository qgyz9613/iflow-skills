/**
 * iFlow Autonomous Module
 * 自主执行模式
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const AUTONOMOUS_DIR = path.join(__dirname, '..', 'autonomous-data');
if (!fs.existsSync(AUTONOMOUS_DIR)) fs.mkdirSync(AUTONOMOUS_DIR, { recursive: true });

// 自主任务状态
let activeTask = null;
let isRunning = false;

// 启动自主模式
function start(config = {}) {
  const start = Date.now();
  try {
    if (isRunning) {
      return { status: 'error', message: 'Autonomous mode already running', time: Date.now() - start };
    }
    
    activeTask = {
      id: uuidv4(),
      goal: config.goal || 'General autonomous operation',
      maxIterations: config.maxIterations || 10,
      currentIteration: 0,
      status: 'running',
      actions: [],
      started_at: new Date().toISOString(),
      config
    };
    
    isRunning = true;
    
    const filePath = path.join(AUTONOMOUS_DIR, `${activeTask.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(activeTask, null, 2));
    
    return { status: 'ok', task: activeTask, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 停止自主模式
function stop() {
  const start = Date.now();
  try {
    if (!isRunning) {
      return { status: 'ok', message: 'No active task', time: Date.now() - start };
    }
    
    activeTask.status = 'stopped';
    activeTask.stopped_at = new Date().toISOString();
    
    const filePath = path.join(AUTONOMOUS_DIR, `${activeTask.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(activeTask, null, 2));
    
    const result = { ...activeTask };
    activeTask = null;
    isRunning = false;
    
    return { status: 'ok', task: result, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取状态
function getStatus() {
  const start = Date.now();
  return {
    status: 'ok',
    isRunning,
    activeTask: activeTask ? {
      id: activeTask.id,
      goal: activeTask.goal,
      currentIteration: activeTask.currentIteration,
      maxIterations: activeTask.maxIterations,
      status: activeTask.status
    } : null,
    time: Date.now() - start
  };
}

// 记录行动
function recordAction(action, result) {
  const start = Date.now();
  try {
    if (!activeTask) {
      return { status: 'error', message: 'No active task', time: Date.now() - start };
    }
    
    activeTask.actions.push({
      iteration: activeTask.currentIteration,
      action,
      result,
      timestamp: new Date().toISOString()
    });
    
    activeTask.currentIteration++;
    
    if (activeTask.currentIteration >= activeTask.maxIterations) {
      activeTask.status = 'completed';
      isRunning = false;
    }
    
    const filePath = path.join(AUTONOMOUS_DIR, `${activeTask.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(activeTask, null, 2));
    
    return { status: 'ok', iteration: activeTask.currentIteration, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 设置目标
function setGoal(goal) {
  const start = Date.now();
  try {
    if (!activeTask) {
      return { status: 'error', message: 'No active task', time: Date.now() - start };
    }
    
    activeTask.goal = goal;
    
    return { status: 'ok', goal, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

module.exports = {
  start,
  stop,
  getStatus,
  recordAction,
  setGoal
};
