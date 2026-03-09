/**
 * iFlow Node.js Native Modules
 * 完整模块套件
 */

const desktop = require('./desktop');
const browser = require('./modules/browser');
const files = require('./modules/files');
const memory = require('./modules/memory');
const session = require('./modules/session');
const channel = require('./modules/channel');
const summarize = require('./modules/summarize');
const agents = require('./modules/agents');
const autonomous = require('./modules/autonomous');
const decision = require('./modules/decision');
const heartbeat = require('./modules/heartbeat');
const improve = require('./modules/improve');
const lobster = require('./modules/lobster');
const sandbox = require('./modules/sandbox');
const selfrepair = require('./modules/selfrepair');
const skills = require('./modules/skills');
const subagent = require('./modules/subagent');
const triage = require('./modules/triage');
const state = require('./modules/state');
const cache = require('./modules/cache');
const llm = require('./modules/llm');

// 版本信息
const VERSION = '1.0.0';

// 获取所有模块
function getModules() {
  return {
    desktop: Object.keys(desktop).filter(k => typeof desktop[k] === 'function'),
    browser: Object.keys(browser).filter(k => typeof browser[k] === 'function'),
    files: Object.keys(files).filter(k => typeof files[k] === 'function'),
    memory: Object.keys(memory).filter(k => typeof memory[k] === 'function'),
    session: Object.keys(session).filter(k => typeof session[k] === 'function'),
    channel: Object.keys(channel).filter(k => typeof channel[k] === 'function'),
    summarize: Object.keys(summarize).filter(k => typeof summarize[k] === 'function'),
    agents: Object.keys(agents).filter(k => typeof agents[k] === 'function'),
    autonomous: Object.keys(autonomous).filter(k => typeof autonomous[k] === 'function'),
    decision: Object.keys(decision).filter(k => typeof decision[k] === 'function'),
    heartbeat: Object.keys(heartbeat).filter(k => typeof heartbeat[k] === 'function'),
    improve: Object.keys(improve).filter(k => typeof improve[k] === 'function'),
    lobster: Object.keys(lobster).filter(k => typeof lobster[k] === 'function'),
    sandbox: Object.keys(sandbox).filter(k => typeof sandbox[k] === 'function'),
    selfrepair: Object.keys(selfrepair).filter(k => typeof selfrepair[k] === 'function'),
    skills: Object.keys(skills).filter(k => typeof skills[k] === 'function'),
    subagent: Object.keys(subagent).filter(k => typeof subagent[k] === 'function'),
    triage: Object.keys(triage).filter(k => typeof triage[k] === 'function'),
    state: Object.keys(state).filter(k => typeof state[k] === 'function'),
    cache: Object.keys(cache).filter(k => typeof cache[k] === 'function'),
    llm: Object.keys(llm).filter(k => typeof llm[k] === 'function')
  };
}

// 系统状态
function getSystemStatus() {
  const start = Date.now();
  const os = require('os');
  
  return {
    status: 'ok',
    version: VERSION,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    cpuCount: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
    freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + 'GB',
    uptime: Math.round(process.uptime()) + 's',
    modules: Object.keys(getModules()).length,
    time: Date.now() - start
  };
}

// 完整功能列表
function getCapabilities() {
  return {
    desktop: ['mouse', 'keyboard', 'screen', 'window', 'clipboard', 'screenshot'],
    browser: ['open', 'click', 'fill', 'getText', 'screenshot', 'wait', 'evaluate', 'cookies', 'saveState', 'close'],
    files: ['scan', 'read', 'write', 'tree', 'search', 'copy', 'remove'],
    memory: ['save', 'remember', 'list', 'remove', 'update', 'stats', 'writeDaily', 'readDaily', 'vectorSearch', 'saveConversation'],
    session: ['create', 'load', 'addMessage', 'getMessages', 'list', 'remove', 'exportSession', 'compress'],
    channel: ['sendTelegram', 'sendWebhook', 'sendDiscord', 'sendSlack', 'notify', 'config'],
    summarize: ['extractUrl', 'extractFile', 'summarizeText', 'summarizeBatch', 'status'],
    agents: ['assign', 'dispatch', 'collaborate', 'listTypes', 'defineRole', 'removeRole', 'selectModel'],
    autonomous: ['start', 'stop', 'getStatus', 'recordAction', 'setGoal'],
    decision: ['make', 'updatePreference', 'getPreferences', 'getHistory', 'clearHistory'],
    heartbeat: ['beat', 'getLastBeat', 'startInterval', 'stopInterval', 'healthCheck', 'productivity', 'updateProductivity', 'setConfig', 'getConfig', 'getTradingLog', 'runAnalysis', 'manualTrade', 'getQuotes', 'getPanwatchHoldings', 'easythsBuy', 'easythsSell', 'easythsHolding', 'registerSkill', 'unregisterSkill', 'getSkills', 'enableSkill', 'updateSkillConfig', 'triggerSkill'],
    improve: ['recordLearning', 'recordError', 'queryLearnings', 'updateConfidence', 'detectPatterns', 'suggestImprovements', 'reflect', 'stats', 'getPromotionStatus', 'checkAndPromote'],
    lobster: ['run', 'resume', 'list', 'state', 'cancel', 'addStep', 'where', 'pick', 'head', 'tail', 'map', 'sort', 'dedupe', 'groupBy', 'count', 'sum', 'avg', 'pipe', 'approve', 'respond'],
    sandbox: ['execute', 'shell', 'runScript', 'createIsolation', 'cleanup', 'listSandboxes'],
    selfrepair: ['check', 'repair', 'getState', 'reset', 'logError', 'getHistory'],
    skills: ['search', 'install', 'list', 'info', 'uninstall', 'execute', 'recommend', 'update'],
    subagent: ['plan', 'delegate', 'delegateParallel', 'report', 'status', 'review', 'aggregate', 'cancel', 'templates', 'autoDelegate', 'assessComplexity'],
    triage: ['classify', 'prioritize', 'getHistory', 'getStats', 'batchClassify'],
    state: ['get', 'set', 'list', 'delete', 'clear', 'exportState', 'importState'],
    cache: ['get', 'set', 'delete', 'clear', 'cleanup', 'stats', 'hash', 'has'],
    llm: ['invoke', 'stream', 'batch', 'embed', 'clearCache', 'cacheStats']
  };
}

// 导出
module.exports = {
  VERSION,
  // 核心模块
  desktop,
  browser,
  files,
  memory,
  session,
  channel,
  summarize,
  // 高级模块
  agents,
  autonomous,
  decision,
  heartbeat,
  improve,
  lobster,
  sandbox,
  selfrepair,
  skills,
  subagent,
  triage,
  state,
  cache,
  llm,
  // 工具函数
  getModules,
  getSystemStatus,
  getCapabilities
};