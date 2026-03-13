/**
 * iFlow Heartbeat Module - 通用自主运行引擎
 * 三级技能加载系统：元数据+SKILL.md+资源
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const improve = require('./improve');
const subagent = require('./subagent');
const cronHelper = require('./heartbeat-cron');

const HEARTBEAT_DIR = path.join(__dirname, '..', 'heartbeat-data');
const SKILLS_DIR = path.join(os.homedir(), '.iflow', 'skills');
if (!fs.existsSync(HEARTBEAT_DIR)) fs.mkdirSync(HEARTBEAT_DIR, { recursive: true });
if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });

let lastBeat = null;
let beatInterval = null;
let tradingLog = [];

// ========== 技能注册表 (Level 1: 元数据始终加载) ==========
let skillRegistry = [
  {
    name: 'trading-monitor',
    description: 'A股T+0交易监控，自动止损止盈',
    triggers: ['trading_hours', 'manual'],
    priority: 1,
    enabled: true,
    lastTriggered: null,
    config: {
      stopLoss: -0.03,
      takeProfit: 0.05,
      panwatchUrl: 'http://192.168.100.1:8000',
      easythsUrl: 'http://localhost:7648',
      token: 'YOUR_TOKEN_HERE'  # 替换为实际的token
    }
  },
  {
    name: 'knowledge-sync',
    description: '知识同步，整理记忆和学习',
    triggers: ['daily_9pm', 'manual'],
    priority: 2,
    enabled: true,
    lastTriggered: null,
    config: {}
  },
  {
    name: 'system-health',
    description: '系统健康检查，清理缓存',
    triggers: ['every_5min', 'manual'],
    priority: 3,
    enabled: true,
    lastTriggered: null,
    config: {}
  },
  {
    name: 'self-improve',
    description: '自我进化，错误记录和模式推广',
    triggers: ['every_10min', 'manual'],
    priority: 4,
    enabled: true,
    lastTriggered: null,
    config: {}
  },
  {
    name: 'subagent-orchestrator',
    description: '子代理协同，自动委派和聚合',
    triggers: ['every_5min', 'manual'],
    priority: 5,
    enabled: true,
    lastTriggered: null,
    config: {}
  },
  {
    name: 'cache-cleanup',
    description: '缓存清理，删除过期缓存文件',
    triggers: ['every_30min', 'manual'],
    priority: 6,
    enabled: true,
    lastTriggered: null,
    config: { maxCacheSize: 100 }  // MB
  },
  {
    name: 'self-repair',
    description: '自我修复，检查系统健康并修复问题',
    triggers: ['every_5min', 'manual'],
    priority: 7,
    enabled: true,
    lastTriggered: null,
    config: { autoFix: true }
  },
  {
    name: 'daily-notification',
    description: '每日通知，发送日报到Telegram/微信',
    triggers: ['daily_9pm', 'manual'],
    priority: 8,
    enabled: true,
    lastTriggered: null,
    config: { channels: ['telegram'] }
  },
  {
    name: 'memory-archive',
    description: '记忆归档，每周归档旧记忆释放空间',
    triggers: ['weekly_sunday', 'manual'],
    priority: 9,
    enabled: true,
    lastTriggered: null,
    config: { archiveAfterDays: 30 }
  }
];

// 加载持久化的技能注册表（合并而非覆盖）
const registryPath = path.join(HEARTBEAT_DIR, 'skill-registry.json');
if (fs.existsSync(registryPath)) {
  try {
    const saved = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    
    // 合并逻辑：保留默认技能+ 更新已有技能配置+ 添加新技能
    for (const savedSkill of saved) {
      const existingIndex = skillRegistry.findIndex(s => s.name === savedSkill.name);
      if (existingIndex >= 0) {
        // 更新已有技能（保留默认值，覆盖配置）
        skillRegistry[existingIndex] = { ...skillRegistry[existingIndex], ...savedSkill };
      } else {
        // 添加新技能
        skillRegistry.push(savedSkill);
      }
    }

    // 保存合并后的完整配置
    fs.writeFileSync(registryPath, JSON.stringify(skillRegistry, null, 2));
    console.error(`[Heartbeat] 加载技能配置: ${skillRegistry.length} 个技能(已合并)`);
  } catch (e) {
    console.error(`[Heartbeat] 加载配置失败: ${e.message}`);
  }
}

// ========== 触发条件检查器 ==========
const triggerCheckers = {
  trading_hours: () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const day = now.getDay();
    
    // 周末不交易
    if (day === 0 || day === 6) return false;
    
    // 早盘 9:30-11:30, 午盘 13:00-15:00
    const isMorning = hour === 9 && minute >= 30 || hour === 10 || hour === 11 && minute < 30;
    const isAfternoon = hour === 13 || hour === 14 || hour === 15 && minute === 0;
    
    return isMorning || isAfternoon;
  },
  
  daily_9pm: () => {
    const now = new Date();
    return now.getHours() === 21 && now.getMinutes() === 0;
  },
  
  every_5min: () => {
    const now = new Date();
    return now.getMinutes() % 5 === 0;
  },
  
  every_10min: () => {
    const now = new Date();
    return now.getMinutes() % 10 === 0;
  },
  
  every_30min: () => {
    const now = new Date();
    return now.getMinutes() % 30 === 0;
  },
  
  weekly_sunday: () => {
    const now = new Date();
    return now.getDay() === 0 && now.getHours() === 2 && now.getMinutes() === 0;  // 周日凌晨2点
  },
  
  manual: () => false  // 手动触发不自动执行
};

// ========== HTTP请求工具 ==========
function httpRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// ========== 技能执行器 ==========
const skillExecutors = {
  // 交易监控技能 - 只监控模拟账户，不对真实账户执行交易
  'trading-monitor': async (skill) => {
    const results = [];
    const config = skill.config;
    
    try {
      // 1. 获取盯盘侠持仓（真实账户） 仅用于分析，不执行交易
      const holdingsData = await httpRequest({
        hostname: '192.168.100.1',
        port: 8000,
        path: '/api/portfolio/summary?include_quotes=true',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${config.token}` }
      });
      
      // 生成买卖建议（不执行）
      const suggestions = [];
      
      if (holdingsData.success && holdingsData.data?.accounts?.[0]?.positions) {
        for (const pos of holdingsData.data.accounts[0].positions) {
          const pnlPct = pos.pnl_pct || ((pos.current_price - pos.cost_price) / pos.cost_price * 100);
          
          // 止损建议（成本为负表示已回本，不适用止损）
          if (pos.cost_price > 0 && pnlPct <= config.stopLoss * 100) {
            suggestions.push({
              type: 'STOP_LOSS_SUGGESTION',
              symbol: pos.symbol,
              name: pos.name,
              reason: `建议止损: 亏损 ${pnlPct.toFixed(2)}%`,
              action: '建议卖出',
              currentPrice: pos.current_price,
              quantity: pos.quantity
            });
          }
          
          // 止盈建议
          if (pnlPct >= config.takeProfit * 100) {
            suggestions.push({
              type: 'TAKE_PROFIT_SUGGESTION',
              symbol: pos.symbol,
              name: pos.name,
              reason: `建议止盈: 盈利 ${pnlPct.toFixed(2)}%`,
              action: '建议卖出部分',
              currentPrice: pos.current_price,
              quantity: Math.floor(pos.quantity / 2)
            });
          }
          
          // 补仓建议（成本为正且跌幅超过3%）
          if (pos.cost_price > 0 && pnlPct <= -3 && pnlPct > -10) {
            suggestions.push({
              type: 'ADD_POSITION_SUGGESTION',
              symbol: pos.symbol,
              name: pos.name,
              reason: `建议补仓: 跌幅 ${pnlPct.toFixed(2)}%，可摊低成本`,
              action: '建议买入',
              currentPrice: pos.current_price,
              costPrice: pos.cost_price
            });
          }
        }
      }
      
      // 2. 获取模拟账户持仓 - 从easyths查询
      // 注意：模拟账户持股需要从同花顺资金股票中查询
      // 这里不执行任何卖出操作

      // 记录建议到日志
      if (suggestions.length > 0) {
        const logPath = path.join(HEARTBEAT_DIR, 'trading-suggestions.json');
        const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : [];
        log.push({
          timestamp: new Date().toISOString(),
          suggestions
        });
        fs.writeFileSync(logPath, JSON.stringify(log.slice(-100), null, 2));
      }
      
      return {
        skill: skill.name,
        executed: true,
        suggestions,  // 返回建议，不执行交易
        positionsAnalyzed: holdingsData.data?.accounts?.[0]?.positions?.length || 0,
        note: '仅提供建议，不执行真实账户交易'
      };
      
    } catch (e) {
      return { skill: skill.name, executed: false, error: e.message };
    }
  },
  
  // 知识同步技能
  'knowledge-sync': async (skill) => {
    try {
      const memoryDir = path.join(os.homedir(), '.iflow', 'memory');
      const facts = [];
      
      // 检查今日是否已保存
      const today = new Date().toISOString().split('T')[0];
      const dailyPath = path.join(memoryDir, 'daily', `${today}.md`);
      
      if (!fs.existsSync(dailyPath)) {
        // 创建每日总结
        const summary = `# ${today} 会话总结\n\n## 待办事项\n- 持续监控交易\n- 学习新策略\n`;
        fs.mkdirSync(path.dirname(dailyPath), { recursive: true });
        fs.writeFileSync(dailyPath, summary);
      }
      
      return { skill: skill.name, executed: true, dailySaved: true };
      
    } catch (e) {
      return { skill: skill.name, executed: false, error: e.message };
    }
  },
  
  // 系统健康检查
  'system-health': async (skill) => {
    try {
      const memUsage = process.memoryUsage();
      const health = {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        uptime: Math.round(process.uptime()) + 's',
        timestamp: new Date().toISOString()
      };
      
      // 内存警告
      if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
        global.gc && global.gc();  // 尝试垃圾回收
      }
      
      return { skill: skill.name, executed: true, health };
      
    } catch (e) {
      return { skill: skill.name, executed: false, error: e.message };
    }
  },
  
  // 自我进化技能
  'self-improve': async (skill) => {
    try {
      // 检查推广状态
      const status = improve.getPromotionStatus();
      
      // 检查是否有待推广的模式
      const promotions = [];
      for (const pending of status.pending) {
        if (pending.count >= 3) {
          // 达到阈值，执行推广
          improve.checkAndPromote(pending.signature, pending.type, pending.count);
          promotions.push(pending.signature);
        }
      }
      
      // 获取统计
      const stats = improve.stats();
      
      return { 
        skill: skill.name, 
        executed: true, 
        promotions,
        stats: {
          learnings: stats.learnings,
          patterns: stats.patterns,
          promotedPatterns: stats.promotedPatterns
        }
      };
      
    } catch (e) {
      return { skill: skill.name, executed: false, error: e.message };
    }
  },
  
  // 子代理协同技能
  'subagent-orchestrator': async (skill) => {
    try {
      // 自动检查和委派待执行任务
      const result = subagent.autoDelegate();

      // 获取当前活跃计划状态
      const status = subagent.status({});

      return {
        skill: skill.name,
        executed: true,
        delegateResult: result,
        activePlans: status.plans?.slice(0, 5)  // 最多显示前5个
      };
      
    } catch (e) {
      return { skill: skill.name, executed: false, error: e.message };
    }
  },
  
  // 缓存清理技能
  'cache-cleanup': async (skill) => {
    try {
      const cache = require('./cache');
      const result = cache.cleanup();
      
      return { 
        skill: skill.name, 
        executed: true,
        cleaned: result.cleaned || 0,
        freedSpace: result.freedSpace || '0KB'
      };
      
    } catch (e) {
      return { skill: skill.name, executed: false, error: e.message };
    }
  },
  
  // 自我修复技能
  'self-repair': async (skill) => {
    try {
      const selfrepair = require('./selfrepair');
      const checkResult = selfrepair.check();
      
      let repairedCount = 0;
      if (checkResult.state?.issues?.length > 0 && skill.config.autoFix) {
        // 遍历所有问题并尝试修复
        for (const issue of checkResult.state.issues) {
          const result = selfrepair.repair(issue);
          if (result.status === 'ok') repairedCount++;
        }
      }
      
      return { 
        skill: skill.name, 
        executed: true,
        health: checkResult.state?.health || 'unknown',
        issues: checkResult.state?.issues?.length || 0,
        repaired: repairedCount
      };
      
    } catch (e) {
      return { skill: skill.name, executed: false, error: e.message };
    }
  },
  
  // 每日通知技能
  'daily-notification': async (skill) => {
    try {
      const channel = require('./channel');
      const memory = require('./memory');

      // 获取今日统计
      const stats = memory.stats();

      // 生成日报
      const report = `📊 iFlow 日报 ${new Date().toLocaleDateString('zh-CN')}\n\n` +
        `🧠 记忆条目: ${stats.total || 0}\n` +
        `📚 学习记录: ${stats.learnings || 0}\n` +
        `🔧 技能运行: ${skillRegistry.filter(s => s.lastTriggered).length}/${skillRegistry.length}\n` +
        `⏱️ 运行时间: ${Math.floor(process.uptime() / 3600)}小时`;

      // 发送到配置的渠道
      const results = [];
      for (const ch of skill.config.channels) {
        if (ch === 'telegram') {
          const result = await channel.sendTelegram(report);
          results.push({ channel: 'telegram', sent: result.status === 'ok' });
        }
      }
      
      return {
        skill: skill.name,
        executed: true,
        report,
        channels: results
      };

    } catch (e) {
      return { skill: skill.name, executed: false, error: e.message };
    }
  },

  // 记忆归档技能
  'memory-archive': async (skill) => {
    try {
      const memory = require('./memory');
      const archiveDays = skill.config.archiveAfterDays || 30;

      // 获取旧记忆
      const oldMemories = memory.list({ olderThan: archiveDays });

      // 归档到文件
      const archiveDir = path.join(os.homedir(), '.iflow', 'memory', 'archive');
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
      
      const archiveFile = path.join(archiveDir, `archive-${new Date().toISOString().split('T')[0]}.json`);
      fs.writeFileSync(archiveFile, JSON.stringify(oldMemories.memories || [], null, 2));
      
      return { 
        skill: skill.name, 
        executed: true,
        archivedCount: oldMemories.memories?.length || 0,
        archiveFile
      };
      
    } catch (e) {
      return { skill: skill.name, executed: false, error: e.message };
    }
  }
};

// ========== 心跳主循环 ==========
function beat(data = {}) {
  const start = Date.now();
  try {
    lastBeat = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: process.memoryUsage()
      },
      cpu: os.loadavg(),
      platform: process.platform,
      skillsCount: skillRegistry.length,
      tradingLogCount: tradingLog.length,
      ...data
    };
    
    const filePath = path.join(HEARTBEAT_DIR, 'heartbeat.json');
    fs.writeFileSync(filePath, JSON.stringify(lastBeat, null, 2));
    
    return { status: 'ok', beat: lastBeat, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 启动自主运行 ==========
function startInterval(intervalMs = 60000, callback = null) {
  const start = Date.now();
  try {
    if (beatInterval) {
      clearInterval(beatInterval);
    }
    
    beatInterval = setInterval(async () => {
      // 1. 记录心跳
      beat();
      
      // 2. 检查所有技能触发条件
      const results = [];
      
      for (const skill of skillRegistry) {
        if (!skill.enabled) continue;
        
        let shouldTrigger = false;
        
        // 检查 schedule 字段（支持 cron 表达式）
        if (skill.schedule && skill.schedule.cron) {
          const cronExpr = skill.schedule.cron;
          const parsed = cronHelper.parseCronExpression(cronExpr);
          if (parsed && cronHelper.matchCron(parsed, new Date())) {
            shouldTrigger = true;
          }
        }
        
        // 检查传统 triggers
        if (!shouldTrigger) {
          for (const trigger of skill.triggers) {
            const checker = triggerCheckers[trigger];
            if (checker && checker()) {
              shouldTrigger = true;
              break;
            }
          }
        }
        
        if (shouldTrigger) {
          // Level 2: 触发时加载技能
          const executor = skillExecutors[skill.name];
          if (executor) {
            const result = await executor(skill);
            results.push(result);
            
            skill.lastTriggered = new Date().toISOString();
            
            if (callback) callback(result);
          }
        }
      }
      
      // 3. 保存技能注册表
      fs.writeFileSync(registryPath, JSON.stringify(skillRegistry, null, 2));
      
      // 4. 保存交易日志
      if (tradingLog.length > 0) {
        const logPath = path.join(HEARTBEAT_DIR, 'trading-log.json');
        fs.writeFileSync(logPath, JSON.stringify(tradingLog.slice(-100), null, 2));
      }
      
    }, intervalMs);
    
    // 立即执行一次心跳
    beat();
    
    return { 
      status: 'ok', 
      interval: intervalMs,
      skillsLoaded: skillRegistry.filter(s => s.enabled).length,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 技能管理 ==========
function registerSkill(skill) {
  const existing = skillRegistry.findIndex(s => s.name === skill.name);
  if (existing >= 0) {
    skillRegistry[existing] = { ...skillRegistry[existing], ...skill };
  } else {
    skillRegistry.push(skill);
  }
  fs.writeFileSync(registryPath, JSON.stringify(skillRegistry, null, 2));
  return { status: 'ok', skills: skillRegistry };
}

function unregisterSkill(name) {
  skillRegistry = skillRegistry.filter(s => s.name !== name);
  fs.writeFileSync(registryPath, JSON.stringify(skillRegistry, null, 2));
  return { status: 'ok', skills: skillRegistry };
}

function getSkills() {
  return { status: 'ok', skills: skillRegistry };
}

function enableSkill(name, enabled = true) {
  const skill = skillRegistry.find(s => s.name === name);
  if (skill) {
    skill.enabled = enabled;
    fs.writeFileSync(registryPath, JSON.stringify(skillRegistry, null, 2));
  }
  return { status: 'ok', skill };
}

function updateSkillConfig(name, config) {
  const skill = skillRegistry.find(s => s.name === name);
  if (skill) {
    skill.config = { ...skill.config, ...config };
    fs.writeFileSync(registryPath, JSON.stringify(skillRegistry, null, 2));
  }
  return { status: 'ok', skill };
}

// ========== 手动触发技能 ==========
async function triggerSkill(name) {
  const skill = skillRegistry.find(s => s.name === name);
  if (!skill) {
    return { status: 'error', message: `Skill ${name} not found` };
  }
  
  const executor = skillExecutors[name];
  if (!executor) {
    return { status: 'error', message: `Executor for ${name} not found` };
  }
  
  const result = await executor(skill);
  skill.lastTriggered = new Date().toISOString();
  fs.writeFileSync(registryPath, JSON.stringify(skillRegistry, null, 2));
  
  return result;
}

// ========== 配置管理 (兼容旧接口) ==========
function setConfig(config) {
  const tradingSkill = skillRegistry.find(s => s.name === 'trading-monitor');
  if (tradingSkill) {
    tradingSkill.config = { ...tradingSkill.config, ...config };
    fs.writeFileSync(registryPath, JSON.stringify(skillRegistry, null, 2));
  }
  return { status: 'ok', config: tradingSkill?.config };
}

function getConfig() {
  const tradingSkill = skillRegistry.find(s => s.name === 'trading-monitor');
  return { status: 'ok', config: tradingSkill?.config };
}

// ========== 其他函数 ==========
function getLastBeat() {
  return { status: 'ok', lastBeat };
}

function stopInterval() {
  if (beatInterval) {
    clearInterval(beatInterval);
    beatInterval = null;
  }
  return { status: 'ok' };
}

function healthCheck() {
  const memUsage = process.memoryUsage();
  return {
    status: 'ok',
    health: {
      uptime: process.uptime(),
      memory: memUsage,
      lastBeat: lastBeat?.timestamp,
      intervalRunning: beatInterval !== null,
      skillsActive: skillRegistry.filter(s => s.enabled).length,
      tradingLogCount: tradingLog.length
    }
  };
}

function productivity() {
  const filePath = path.join(HEARTBEAT_DIR, 'productivity.json');
  if (!fs.existsSync(filePath)) {
    return { status: 'ok', productivity: { tasksCompleted: 0 } };
  }
  return { status: 'ok', productivity: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
}

function updateProductivity(task, duration) {
  const filePath = path.join(HEARTBEAT_DIR, 'productivity.json');
  let data = fs.existsSync(filePath) 
    ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
    : { tasksCompleted: 0, tasks: [] };
  
  data.tasksCompleted++;
  data.tasks = data.tasks || [];
  data.tasks.push({ task, duration, timestamp: new Date().toISOString() });
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return { status: 'ok', productivity: data };
}

// ========== 交易专用接口 (兼容旧代码) ==========
function getTradingLog() {
  return { status: 'ok', log: tradingLog.slice(-50), total: tradingLog.length };
}

async function runAnalysis() {
  return await triggerSkill('trading-monitor');
}

async function manualTrade(symbol, action, price, quantity) {
  const tradingSkill = skillRegistry.find(s => s.name === 'trading-monitor');
  if (!tradingSkill) return { status: 'error', message: 'Trading skill not found' };
  
  const config = tradingSkill.config;
  const decision = { type: 'MANUAL', symbol, action, price, quantity, reason: '手动触发' };
  
  try {
    if (action === 'SELL') {
      await httpRequest({
        hostname: 'localhost',
        port: 7648,
        path: '/api/v1/operations/sell',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'sell', params: { stock_code: symbol, price, quantity } })
      });
    } else if (action === 'BUY') {
      await httpRequest({
        hostname: 'localhost',
        port: 7648,
        path: '/api/v1/operations/buy',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'buy', params: { stock_code: symbol, price, quantity } })
      });
    }
    
    tradingLog.push({ timestamp: new Date().toISOString(), ...decision });
    return { status: 'ok', decision };
    
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

async function getQuotes(symbols) {
  // 参数类型校验
  if (!symbols) {
    return { status: 'error', message: 'Symbols is required' };
  }
  if (!Array.isArray(symbols)) {
    symbols = [symbols];
  }
  
  const tradingSkill = skillRegistry.find(s => s.name === 'trading-monitor');
  const token = tradingSkill?.config?.token;
  
  const body = JSON.stringify({
    items: symbols.map(s => ({ symbol: s, market: 'CN' }))
  });
  
  return httpRequest({
    hostname: '192.168.100.1',
    port: 8000,
    path: '/api/quotes/batch',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body
  });
}

async function getPanwatchHoldings() {
  const tradingSkill = skillRegistry.find(s => s.name === 'trading-monitor');
  const token = tradingSkill?.config?.token;
  
  return httpRequest({
    hostname: '192.168.100.1',
    port: 8000,
    path: '/api/portfolio/summary?include_quotes=true',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

async function easythsBuy(stockCode, price, quantity) {
  return httpRequest({
    hostname: 'localhost',
    port: 7648,
    path: '/api/v1/operations/buy',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'buy', params: { stock_code: stockCode, price, quantity } })
  });
}

async function easythsSell(stockCode, price, quantity) {
  return httpRequest({
    hostname: 'localhost',
    port: 7648,
    path: '/api/v1/operations/sell',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'sell', params: { stock_code: stockCode, price, quantity } })
  });
}

async function easythsHolding() {
  return httpRequest({
    hostname: 'localhost',
    port: 7648,
    path: '/api/v1/operations/holding_query',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
}

module.exports = {
  // 核心
  beat,
  getLastBeat,
  startInterval,
  stopInterval,
  healthCheck,
  productivity,
  updateProductivity,
  
  // 技能管理(新增)
  registerSkill,
  unregisterSkill,
  getSkills,
  enableSkill,
  updateSkillConfig,
  triggerSkill,
  
  // 兼容旧接口  setConfig,
  getConfig,
  getTradingLog,
  runAnalysis,
  manualTrade,
  getQuotes,
  getPanwatchHoldings,
  easythsBuy,
  easythsSell,
  easythsHolding
};
