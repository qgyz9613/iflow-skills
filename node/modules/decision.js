/**
 * iFlow Decision Module
 * 决策系统
 */

const path = require('path');
const fs = require('fs');

const DECISION_DIR = path.join(__dirname, '..', 'decision-data');
if (!fs.existsSync(DECISION_DIR)) fs.mkdirSync(DECISION_DIR, { recursive: true });

// 决策历史
const historyFile = path.join(DECISION_DIR, 'history.json');
let history = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, 'utf8')) : [];

// 用户偏好
const prefsFile = path.join(DECISION_DIR, 'preferences.json');
let preferences = fs.existsSync(prefsFile) ? JSON.parse(fs.readFileSync(prefsFile, 'utf8')) : {};

// 做出决策
function make(args = {}) {
  const start = Date.now();
  try {
    // 支持对象参数
    const context = args.context || '';
    const options = Array.isArray(args.options) ? args.options : (Array.isArray(args) ? args : []);
    const strategy = args.strategy || 'weighted';
    
    if (options.length === 0) {
      return { status: 'error', message: 'No options provided', time: Date.now() - start };
    }
    
    let decision;
    
    switch (strategy) {
      case 'random':
        decision = options[Math.floor(Math.random() * options.length)];
        break;
        
      case 'weighted':
        // 基于用户偏好加权
        const weights = options.map(opt => {
          const key = typeof opt === 'string' ? opt : opt.name || JSON.stringify(opt);
          return { opt, weight: preferences[key] || 1 };
        });
        const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
        let random = Math.random() * totalWeight;
        for (const w of weights) {
          random -= w.weight;
          if (random <= 0) {
            decision = w.opt;
            break;
          }
        }
        if (!decision) decision = options[0];
        break;
        
      case 'first':
        decision = options[0];
        break;
        
      case 'consensus':
        // 简单多数（如果有投票数据）
        decision = options[0];
        break;
        
      default:
        decision = options[0];
    }
    
    // 记录决策
    const record = {
      id: Date.now(),
      context,
      options,
      strategy,
      decision,
      timestamp: new Date().toISOString()
    };
    
    history.push(record);
    if (history.length > 1000) history = history.slice(-1000);
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    
    return { status: 'ok', decision, strategy, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 更新偏好
function updatePreference(key, value) {
  const start = Date.now();
  try {
    preferences[key] = value;
    fs.writeFileSync(prefsFile, JSON.stringify(preferences, null, 2));
    
    return { status: 'ok', key, value, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取偏好
function getPreferences() {
  const start = Date.now();
  return { status: 'ok', preferences, time: Date.now() - start };
}

// 获取历史
function getHistory(limit = 50) {
  const start = Date.now();
  return { 
    status: 'ok', 
    history: history.slice(-limit), 
    total: history.length,
    time: Date.now() - start 
  };
}

// 清除历史
function clearHistory() {
  const start = Date.now();
  try {
    history = [];
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    
    return { status: 'ok', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

module.exports = {
  make,
  updatePreference,
  getPreferences,
  getHistory,
  clearHistory
};
