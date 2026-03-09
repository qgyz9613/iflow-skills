/**
 * iFlow Triage Module
 * 任务分类系统
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const TRIAGE_DIR = path.join(__dirname, '..', 'triage-data');
if (!fs.existsSync(TRIAGE_DIR)) fs.mkdirSync(TRIAGE_DIR, { recursive: true });

// 任务分类
const CATEGORIES = {
  code: ['debug', 'refactor', 'implement', 'review'],
  research: ['search', 'analyze', 'summarize'],
  file: ['read', 'write', 'organize', 'search'],
  browser: ['scrape', 'interact', 'automate'],
  system: ['configure', 'monitor', 'deploy'],
  general: ['other']
};

// 优先级关键词
const PRIORITY_KEYWORDS = {
  high: ['urgent', 'critical', 'important', 'asap', '紧急', '重要', '立即'],
  medium: ['soon', 'needed', '需要', '正常'],
  low: ['later', 'someday', 'maybe', '以后', '可能']
};

// 分类任务
function classify(task, options = {}) {
  const start = Date.now();
  try {
    const text = task.toLowerCase();
    
    // 检测分类
    let category = 'general';
    let subCategory = 'other';
    
    for (const [cat, subs] of Object.entries(CATEGORIES)) {
      if (text.includes(cat) || subs.some(s => text.includes(s))) {
        category = cat;
        subCategory = subs.find(s => text.includes(s)) || subs[0];
        break;
      }
    }
    
    // 检测优先级
    let priority = 'medium';
    for (const [p, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
      if (keywords.some(k => text.includes(k))) {
        priority = p;
        break;
      }
    }
    
    // 检测复杂度
    const complexity = analyzeComplexity(task);
    
    const result = {
      id: uuidv4(),
      task: options.originalTask || task,
      category,
      subCategory,
      priority,
      complexity,
      confidence: calculateConfidence(text, category),
      timestamp: new Date().toISOString()
    };
    
    // 保存分类结果
    const filePath = path.join(TRIAGE_DIR, `${result.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    
    return { status: 'ok', triage: result, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 分析复杂度
function analyzeComplexity(task) {
  const text = task.toLowerCase();
  
  let score = 0;
  
  // 简单启发式
  if (text.includes('simple') || text.includes('quick') || text.includes('简单')) score -= 1;
  if (text.includes('complex') || text.includes('complicated') || text.includes('复杂')) score += 2;
  if (text.includes('multiple') || text.includes('多个') || text.includes('all')) score += 1;
  if (text.split(' ').length > 20 || text.length > 100) score += 1;
  if (text.includes('and') || text.includes('然后') || text.includes('同时')) score += 1;
  
  if (score <= 0) return 'low';
  if (score === 1) return 'medium';
  return 'high';
}

// 计算置信度
function calculateConfidence(text, category) {
  const keywords = CATEGORIES[category] || [];
  const matches = keywords.filter(k => text.includes(k)).length;
  return Math.min(0.5 + matches * 0.15, 1.0);
}

// 排序任务
function prioritize(tasks) {
  const start = Date.now();
  try {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const complexityOrder = { low: 0, medium: 1, high: 2 };
    
    const classified = tasks.map(t => {
      const result = classify(t);
      return result.status === 'ok' ? result.triage : null;
    }).filter(Boolean);
    
    // 按优先级排序，然后按复杂度（简单优先）
    classified.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return complexityOrder[a.complexity] - complexityOrder[b.complexity];
    });
    
    return { status: 'ok', tasks: classified, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取历史
function getHistory(limit = 50) {
  const start = Date.now();
  try {
    const files = fs.readdirSync(TRIAGE_DIR)
      .filter(f => f.endsWith('.json'))
      .slice(-limit);
    
    const history = files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(TRIAGE_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    return { status: 'ok', history, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取统计
function getStats() {
  const start = Date.now();
  try {
    const files = fs.readdirSync(TRIAGE_DIR).filter(f => f.endsWith('.json'));
    
    const stats = {
      total: files.length,
      byCategory: {},
      byPriority: { high: 0, medium: 0, low: 0 },
      byComplexity: { low: 0, medium: 0, high: 0 }
    };
    
    files.forEach(f => {
      try {
        const t = JSON.parse(fs.readFileSync(path.join(TRIAGE_DIR, f), 'utf8'));
        stats.byCategory[t.category] = (stats.byCategory[t.category] || 0) + 1;
        if (t.priority) stats.byPriority[t.priority]++;
        if (t.complexity) stats.byComplexity[t.complexity]++;
      } catch {}
    });
    
    return { status: 'ok', stats, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 批量分类
function batchClassify(tasks) {
  const start = Date.now();
  try {
    const results = tasks.map(t => classify(t));
    
    return { 
      status: 'ok', 
      results: results.map(r => r.triage),
      total: tasks.length,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

module.exports = {
  classify,
  prioritize,
  getHistory,
  getStats,
  batchClassify,
  CATEGORIES
};
