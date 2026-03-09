/**
 * iFlow Improve Module - 自我进化系统
 * 增强：自动推广机制 + 心跳集成
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const IMPROVE_DIR = path.join(__dirname, '..', 'improve-data');
const MEMORY_DIR = path.join(__dirname, '..', '..', '..', 'memory');
const LEARNINGS_DIR = path.join(IMPROVE_DIR, 'learnings');
const PATTERNS_DIR = path.join(IMPROVE_DIR, 'patterns');

[IMPROVE_DIR, LEARNINGS_DIR, PATTERNS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ========== 模式计数器 (用于自动推广) ==========
let patternCounter = {};
const COUNTER_PATH = path.join(IMPROVE_DIR, 'pattern-counter.json');
const PROMOTE_THRESHOLD = 3;  // 重复3次自动推广

if (fs.existsSync(COUNTER_PATH)) {
  try {
    patternCounter = JSON.parse(fs.readFileSync(COUNTER_PATH, 'utf8'));
  } catch (e) {}
}

// ========== 记录学习 ==========
function recordLearning(content, options = {}) {
  const start = Date.now();
  try {
    // 参数类型校验
    if (content === null || content === undefined) {
      return { status: 'error', message: 'Content is required', time: Date.now() - start };
    }
    if (typeof content !== 'string') {
      content = String(content);
    }
    
    const id = uuidv4();
    const learning = {
      id,
      content,
      category: options.category || 'general',
      source: options.source || 'session',
      confidence: options.confidence || 0.5,
      tags: options.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const filePath = path.join(LEARNINGS_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(learning, null, 2));
    
    // 检查是否需要推广
    checkAndPromote(content, 'learning');
    
    // 同时写入 LEARNINGS.md
    appendToLearningsMd(learning);
    
    return { status: 'ok', learning, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 记录错误 ==========
function recordError(errorInfo) {
  const start = Date.now();
  try {
    const id = `E${String(Date.now()).slice(-6)}`;
    const error = {
      id,
      message: errorInfo.message || errorInfo.error || '',
      type: errorInfo.type || 'unknown',
      context: errorInfo.context || '',
      solution: errorInfo.solution || '',
      timestamp: new Date().toISOString(),
      count: 1
    };
    
    // 检查是否已存在相同错误
    const existingErrors = findSimilarErrors(error.message);
    if (existingErrors.length > 0) {
      // 更新计数
      const existing = existingErrors[0];
      existing.count = (existing.count || 1) + 1;
      existing.lastOccurrence = error.timestamp;
      
      // 检查推广
      checkAndPromote(error.message, 'error', existing.count);
    } else {
      // 新错误，写入 ERRORS.md
      appendToErrorsMd(error);
    }
    
    return { status: 'ok', error, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 查找相似错误 ==========
function findSimilarErrors(message) {
  const errorsPath = path.join(MEMORY_DIR, 'ERRORS.md');
  if (!fs.existsSync(errorsPath)) return [];
  
  const content = fs.readFileSync(errorsPath, 'utf8');
  const errors = [];
  
  // 简单匹配：查找包含相同关键词的错误
  const keywords = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  // 这里简化处理，实际可以用更智能的匹配
  return errors;
}

// ========== 自动推广机制 ==========
function checkAndPromote(content, type, currentCount = 1) {
  // 生成模式签名
  const signature = generateSignature(content);
  
  // 更新计数
  if (!patternCounter[signature]) {
    patternCounter[signature] = { count: 0, type, content, firstSeen: new Date().toISOString() };
  }
  patternCounter[signature].count += currentCount;
  patternCounter[signature].lastSeen = new Date().toISOString();
  
  // 保存计数器
  fs.writeFileSync(COUNTER_PATH, JSON.stringify(patternCounter, null, 2));
  
  // 检查是否达到推广阈值
  if (patternCounter[signature].count >= PROMOTE_THRESHOLD) {
    promoteToProjectMemory(signature, patternCounter[signature]);
    return { promoted: true, signature };
  }
  
  return { promoted: false, count: patternCounter[signature].count, threshold: PROMOTE_THRESHOLD };
}

// ========== 生成模式签名 ==========
function generateSignature(content) {
  // 参数类型校验
  if (content === null || content === undefined) {
    return 'unknown_pattern';
  }
  if (typeof content !== 'string') {
    content = String(content);
  }
  
  // 简化签名：取关键词hash
  const keywords = content.toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 5)
    .join('_');
  
  return keywords || 'unknown_pattern';
}

// ========== 推广到项目记忆 ==========
function promoteToProjectMemory(signature, pattern) {
  const memoryPath = path.join(MEMORY_DIR, 'MEMORY.md');
  const improvementsPath = path.join(MEMORY_DIR, 'IMPROVEMENTS.md');
  
  // 添加到 IMPROVEMENTS.md
  const entry = `
## 自动推广: ${signature}

**发现时间:** ${pattern.firstSeen}
**重复次数:** ${pattern.count}
**类型:** ${pattern.type}

${pattern.content}

---
`;
  
  if (fs.existsSync(improvementsPath)) {
    fs.appendFileSync(improvementsPath, entry);
  } else {
    fs.writeFileSync(improvementsPath, `# IMPROVEMENTS.md\n\n> 自动推广的模式和最佳实践\n${entry}`);
  }
  
  // 重置计数
  patternCounter[signature].promoted = true;
  fs.writeFileSync(COUNTER_PATH, JSON.stringify(patternCounter, null, 2));
}

// ========== 追加到 LEARNINGS.md ==========
function appendToLearningsMd(learning) {
  const filePath = path.join(MEMORY_DIR, 'LEARNINGS.md');
  
  const entry = `
### ${learning.id}: ${learning.category}

**时间:** ${learning.created_at}
**置信度:** ${learning.confidence * 100}%

${learning.content}

---
`;
  
  if (fs.existsSync(filePath)) {
    fs.appendFileSync(filePath, entry);
  }
}

// ========== 追加到 ERRORS.md ==========
function appendToErrorsMd(error) {
  const filePath = path.join(MEMORY_DIR, 'ERRORS.md');
  
  const entry = `
## ${error.id}: ${error.type}

**错误信息:**
\`\`\`
${error.message}
\`\`\`

**发生时间:** ${error.timestamp}
**发生次数:** ${error.count}

**解决方案:**
${error.solution || '待补充'}

---
`;
  
  if (fs.existsSync(filePath)) {
    fs.appendFileSync(filePath, entry);
  }
}

// ========== 查询学习 ==========
function queryLearnings(query, options = {}) {
  const start = Date.now();
  try {
    const files = fs.readdirSync(LEARNINGS_DIR).filter(f => f.endsWith('.json'));
    const minConfidence = options.minConfidence || 0;
    
    const results = files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(LEARNINGS_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    }).filter(l => {
      if (!l) return false;
      if (l.confidence < minConfidence) return false;
      if (options.category && l.category !== options.category) return false;
      if (query && !l.content.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    
    return { status: 'ok', results, total: results.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 更新置信度 ==========
function updateConfidence(learningId, delta, feedback = '') {
  const start = Date.now();
  try {
    const filePath = path.join(LEARNINGS_DIR, `${learningId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'Learning not found', time: Date.now() - start };
    }
    
    const learning = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    learning.confidence = Math.max(0, Math.min(1, learning.confidence + delta));
    learning.updated_at = new Date().toISOString();
    learning.feedback = learning.feedback || [];
    learning.feedback.push({ delta, feedback, timestamp: new Date().toISOString() });
    
    fs.writeFileSync(filePath, JSON.stringify(learning, null, 2));
    
    return { status: 'ok', learning, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 检测模式 ==========
function detectPatterns(args = {}) {
  const start = Date.now();
  try {
    const content = typeof args === 'string' ? args : (args.content || '');
    const patterns = [];
    
    if (!content) {
      return { status: 'ok', patterns, message: 'No content provided', time: Date.now() - start };
    }
    
    const errorPatterns = [
      { pattern: /error|错误|failed|失败/gi, type: 'error' },
      { pattern: /timeout|超时/gi, type: 'timeout' },
      { pattern: /exception|异常/gi, type: 'exception' },
      { pattern: /cannot|无法|不能/gi, type: 'limitation' },
      { pattern: /should|应该|需要/gi, type: 'suggestion' }
    ];
    
    for (const { pattern, type } of errorPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        patterns.push({ type, count: matches.length, found: true });
        
        // 自动记录错误模式
        if (type === 'error' || type === 'timeout' || type === 'exception') {
          recordError({
            message: content.slice(0, 200),
            type: type,
            context: 'auto_detected'
          });
        }
      }
    }
    
    return { status: 'ok', patterns, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 生成改进建议 ==========
function suggestImprovements(category = 'error_handling', context = '') {
  const start = Date.now();
  try {
    const suggestions = {
      error_handling: [
        '添加 try-catch 处理异步操作',
        '网络请求实现重试逻辑',
        '错误日志包含上下文便于调试'
      ],
      performance: [
        '频繁访问数据使用缓存',
        '大数据集实现懒加载',
        '数据库查询优化索引'
      ],
      workflow: [
        '复杂任务分解为小步骤',
        '每步添加验证',
        '实现回滚机制'
      ],
      trading: [
        '午休时间不下单 (11:30-13:00)',
        '卖出价格=实时价-0.01 秒成交',
        '买入价格=实时价+0.01 秒成交',
        '止损-3%，止盈+5%浮动'
      ]
    };
    
    const result = suggestions[category] || suggestions.error_handling;
    
    return { status: 'ok', suggestions: result, category, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 记录反思 ==========
function reflect(args = {}) {
  const start = Date.now();
  try {
    const summary = typeof args === 'string' ? args : (args.summary || args.context || '');
    const whatWorked = args.whatWorked || [];
    const whatFailed = args.whatFailed || [];
    const nextSteps = args.nextSteps || [];
    
    const reflection = {
      id: uuidv4(),
      summary,
      whatWorked,
      whatFailed,
      nextSteps,
      timestamp: new Date().toISOString()
    };
    
    const filePath = path.join(IMPROVE_DIR, `reflection-${reflection.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(reflection, null, 2));
    
    // 自动记录失败为错误
    for (const failed of whatFailed) {
      recordError({ message: failed, type: 'reflection', context: summary });
    }
    
    // 自动记录成功为学习
    for (const worked of whatWorked) {
      recordLearning(worked, { category: 'best_practice', source: 'reflection' });
    }
    
    return { status: 'ok', reflection, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 获取统计 ==========
function stats() {
  const start = Date.now();
  try {
    const learnings = fs.readdirSync(LEARNINGS_DIR).filter(f => f.endsWith('.json')).length;
    const patterns = fs.readdirSync(PATTERNS_DIR).filter(f => f.endsWith('.json')).length;
    const promotedPatterns = Object.values(patternCounter).filter(p => p.promoted).length;
    const pendingPromotion = Object.values(patternCounter).filter(p => !p.promoted && p.count >= PROMOTE_THRESHOLD - 1).length;
    
    return { 
      status: 'ok', 
      learnings, 
      patterns, 
      promotedPatterns,
      pendingPromotion,
      promoteThreshold: PROMOTE_THRESHOLD,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 获取推广状态 ==========
function getPromotionStatus() {
  const start = Date.now();
  
  const pending = Object.entries(patternCounter)
    .filter(([k, v]) => !v.promoted && v.count > 0)
    .map(([signature, data]) => ({
      signature,
      count: data.count,
      type: data.type,
      progress: `${data.count}/${PROMOTE_THRESHOLD}`,
      needsMore: PROMOTE_THRESHOLD - data.count
    }))
    .sort((a, b) => b.count - a.count);
  
  const promoted = Object.entries(patternCounter)
    .filter(([k, v]) => v.promoted)
    .map(([signature, data]) => ({
      signature,
      type: data.type,
      promotedAt: data.lastSeen
    }));
  
  return {
    status: 'ok',
    pending,
    promoted,
    time: Date.now() - start
  };
}

module.exports = {
  recordLearning,
  recordError,
  queryLearnings,
  updateConfidence,
  detectPatterns,
  suggestImprovements,
  reflect,
  stats,
  getPromotionStatus,
  checkAndPromote
};