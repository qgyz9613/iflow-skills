#!/usr/bin/env node
/**
 * iFlow Node.js MCP Server
 * 加载所有 Node.js 高级模块
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// 加载所有模块
const nodeModules = require('./index.js');

// 工具定义
const tools = [];

// 从模块提取工具
function extractTools(moduleName, moduleObj) {
  const moduleTools = [];
  
  for (const [fnName, fn] of Object.entries(moduleObj)) {
    if (typeof fn === 'function') {
      const toolName = `${moduleName}_${fnName}`;
      
      moduleTools.push({
        name: toolName,
        description: `${moduleName}.${fnName} - ${fnName} function from ${moduleName} module`,
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: true
        },
        handler: fn
      });
    }
  }
  
  return moduleTools;
}

// 注册所有模块的工具 (sandbox 已禁用，memory 使用 iFlow 内置系统)
const moduleList = [
  'desktop', 'browser', 'files', 'session', 'channel',
  'summarize', 'agents', 'autonomous', 'decision', 'heartbeat',
  'improve', 'lobster', 'selfrepair', 'skills',
  'subagent', 'triage', 'state', 'cache', 'llm', 'hooks',
  'retryPolicy', 'archive', 'runtimeSystem', 'cacheUtils',
  'utilsBase', 'systemUtils', 'securityUtils',
  'secrets', 'linkExtraction', 'webGateway', 'channelsEnhanced',
  'contextEngine', 'markdown', 'media', 'logging',
  'pluginTools', 'cliFormat', 'cluster',
  'enhancedRetry', 'errorHandler', 'dedupeCache', 'diagnosticEvents',
  'rateLimit', 'httpGuard', 'textChunking',
  'netUtils', 'processMonitor', 'stringUtils',
  'dataValidation', 'gitUtils', 'envConfig',
  'clipboard', 'frontmatter', 'objectSafety', 'processRestart',
  'fileAtomic', 'agentEvents', 'channelActivity', 'pathResolver',
  'fileSecurity', 'shellEnv', 'osSummary', 'executablePath', 'nodeCommands',
  'secretFile', 'packageJson', 'jsonFile', 'mapSize', 'stableNodePath', 'machineName',
  'wsl', 'pathPrepend', 'stringSample',
  'joinSegments', 'codeRegions', 'detectPackageManager', 'isMain',
  'reasoningTags', 'subagentsFormat', 'assistantVisibleText',
  'sanitizeText', 'pathGuards', 'jsonFilesEnhanced', 'abort',
  // 第十二阶段新增 - OpenClaw 模块
  'fileLock', 'archivePath', 'fetchEnhanced', 'hostEnvSecurity',
  // 第十三阶段新增
  'processRespawn', 'gitRootEnhanced', 'tempPath', 'envManage', 'runtimeEnv', 'jsonStoreEnhanced',
  // 第十四阶段新增
  'configEval', 'requirementsEval', 'stringNormalization', 'queueHelpers', 'frontmatterSimple',
  // 第十五阶段新增
  'normalizeSecretInput', 'transcriptTools', 'directiveTags', 'usageFormat', 'shellArgv',
  'pidAlive', 'processScopedMap', 'deviceAuth', 'deviceAuthStore', 'chatContent',
  'chatEnvelope', 'providerUtils',
  // 第十六阶段新增
  'nodeMatch', 'avatarPolicy', 'usageAggregates', 'runWithConcurrency', 'withTimeout', 'safeJson',
  // 第十七阶段新增
  'secureRandom', 'spawnUtils'
];

// 模块说明
const moduleDescriptions = {
  desktop: '桌面自动化操作',
  browser: '浏览器自动化（含多页面管理、高级交互、表单批量操作、网络监控、性能追踪、设备模拟、PDF导出、持久化上下文）',
  files: '文件系统操作',
  session: '会话管理',
  channel: '消息渠道',
  summarize: '内容摘要',
  agents: '智能代理',
  autonomous: '自动化引擎',
  decision: '决策系统',
  heartbeat: '心跳监控',
  improve: '学习改进',
  lobster: '数据处理',
  selfrepair: '自我修复',
  skills: '技能系统',
  subagent: '子代理',
  triage: '分诊系统',
  state: '状态管理',
  cache: '缓存系统',
  llm: 'LLM调用',
  hooks: '生命周期钩子',
  retryPolicy: '重试策略',
  archive: '归档系统',
  runtimeSystem: '运行时系统',
  cacheUtils: '缓存工具',
  utilsBase: '基础工具（含时间格式化）',
  systemUtils: '系统工具',
  securityUtils: '安全工具',
  secrets: '密钥管理',
  linkExtraction: '链接提取',
  webGateway: 'Web网关',
  channelsEnhanced: '增强渠道',
  contextEngine: '上下文引擎',
  markdown: 'Markdown处理',
  media: '媒体处理',
  logging: '日志系统',
  pluginTools: '插件工具',
  cliFormat: 'CLI格式化',
  cluster: '集群管理',
  enhancedRetry: '增强重试',
  errorHandler: '错误处理',
  dedupeCache: '去重缓存（TTL过期、大小限制）',
  diagnosticEvents: '诊断事件（模型使用、消息处理、队列监控）',
  rateLimit: '速率限制（固定窗口、滑动窗口、令牌桶、泄漏桶）',
  httpGuard: 'HTTP请求防护（请求体限制、超时控制）',
  textChunking: '文本分块（按长度、换行、段落、句子、Markdown）',
  netUtils: '网络工具（IP验证、主机名解析、URL处理）',
  processMonitor: '进程监控（进程检查、进程树、资源监控）',
  stringUtils: '字符串工具（规范化、大小写转换、截断、转义）',
  dataValidation: '数据验证（数字解析、安全随机数、范围检查）',
  gitUtils: 'Git工具（根目录查找、提交信息、分支管理）',
  envConfig: '环境配置（.env加载、环境变量管理）',
  clipboard: '剪贴板操作（跨平台复制、读取、清空）',
  frontmatter: 'Frontmatter解析（Markdown元数据、YAML解析）',
  objectSafety: '对象安全（原型污染防护、敏感键过滤）',
  processRestart: '进程重启（优雅重启、进程树管理）',
  fileAtomic: '文件原子操作（JSON/文本原子读写、异步锁）',
  agentEvents: '代理事件系统（事件流、运行上下文、监听器）',
  channelActivity: '渠道活动跟踪（入站/出站活动、活跃度检查）',
  pathResolver: '路径解析（主目录、配置/数据/缓存目录、路径规范化）',
  fileSecurity: '文件安全（安全打开文件、防止符号链接/硬链接攻击）',
  shellEnv: 'Shell环境（登录Shell环境、PATH解析、命令查找）',
  osSummary: '操作系统摘要（CPU/内存信息、系统负载、网络接口）',
  executablePath: '可执行文件路径（路径解析、命令查找、可执行文件验证）',
  nodeCommands: 'Node.js命令（版本信息、平台信息、模块管理）',
  secretFile: '密钥文件（安全加载密钥文件、防止符号链接攻击）',
  packageJson: 'package.json工具（读取版本/名称、依赖/脚本、项目根目录查找）',
  jsonFile: 'JSON文件工具（加载/保存/验证JSON文件、合并更新、删除）',
  mapSize: 'Map/Set大小限制（修剪到最大大小、创建有界容器、大小查询）',
  stableNodePath: '稳定Node路径（解析稳定Node.js路径、处理Homebrew版本升级）',
  machineName: '机器名称（获取机器显示名称、主机名、机器类型、唯一标识）',
  wsl: 'WSL检测（检测是否在WSL/WSL2环境中运行）',
  pathPrepend: 'PATH操作（查找PATH键、规范化路径前缀、合并PATH、应用PATH前缀）',
  stringSample: '字符串总结（智能总结字符串列表，显示前N项和剩余数量）',
  joinSegments: '文本段连接（连接可选文本段、连接存在的文本段、过滤空值）',
  codeRegions: '代码区域检测（查找Markdown代码区域、检测位置是否在代码内）',
  detectPackageManager: '包管理器检测（检测pnpm/bun/npm）',
  isMain: '主进程判断（判断是否为主进程入口、支持PM2等包装器）',
  reasoningTags: '推理标签处理（移除AI推理标签、<thinking>/<final>等）',
  subagentsFormat: '子代理格式化（持续时间、token统计、行截断）',
  assistantVisibleText: '助手可见文本清理（移除内部脚手架和记忆标签）',
  sanitizeText: 'HTML转纯文本（将HTML转换为WhatsApp/Signal/Telegram格式、移除HTML标签）',
  pathGuards: '路径防护增强（Windows路径规范化、路径包含检查、错误类型判断）',
  jsonFilesEnhanced: 'JSON文件增强（原子写入、异步锁、安全JSON操作）',
  abort: '中止检查（AbortSignal检查、异步操作取消支持）',
  // 第十二阶段新增 - OpenClaw 模块
  fileLock: '文件锁（跨进程文件锁、防止并发访问、支持重试和过期检测）',
  archivePath: '归档路径处理（路径验证、规范化、防止路径遍历攻击、归档类型检测）',
  fetchEnhanced: '增强Fetch（AbortSignal支持、超时控制、预连接、duplex支持）',
  hostEnvSecurity: '环境变量安全（危险变量检测、环境变量清理、安全环境变量处理）',
  processRespawn: '进程重启管理（监督环境检测、fresh PID 重启、跨平台支持）',
  gitRootEnhanced: 'Git 根目录查找（查找 Git 根目录、解析 .git 文件、解析 HEAD 文件路径）',
  tempPath: '临时文件管理（随机临时文件路径、临时目录管理、自动清理）',
  envManage: '环境变量管理（布尔值解析、环境变量日志、环境变量规范化）',
  runtimeEnv: '运行时环境（基于日志的运行时、运行时解析、不可用退出处理）',
  jsonStoreEnhanced: 'JSON 存储增强（读取 JSON 回退、原子写入 JSON、安全 JSON 解析）',
  configEval: '配置评估系统（真值判断、路径解析、运行时要求评估、二进制文件检测）',
  requirementsEval: '需求评估系统（bins/env/config/os 需求检查、缺失项解析、资格评估）',
  stringNormalization: '字符串规范化（字符串列表规范化、连字符 slug、@# 前缀 slug）',
  queueHelpers: '队列管理系统（丢弃策略、防抖、排空、摘要、跨频道检查）',
  frontmatterSimple: 'Frontmatter 简化版（字符串列表解析、布尔值解析、字符串值获取）',
  // 第十五阶段新增
  normalizeSecretInput: '密钥规范化（移除换行符、Latin1过滤、复制粘贴凭证处理）',
  transcriptTools: '工具调用分析（提取工具调用名称、检查工具调用、统计工具结果）',
  directiveTags: '指令标签解析（解析消息中的指令标签、移除指令标签用于显示）',
  usageFormat: '费用和Token统计（格式化token数量、格式化美元金额、估算使用费用）',
  shellArgv: 'Shell参数解析（解析Shell命令参数、支持单引号/双引号/转义符）',
  pidAlive: '进程存活检测（检查进程是否存活、僵尸进程检测、获取进程启动时间）',
  processScopedMap: '进程范围Map（创建或获取进程范围的Map、进程级别数据共享）',
  deviceAuth: '设备认证（规范化设备角色、规范化设备权限范围）',
  deviceAuthStore: '设备认证存储（加载/存储/清除设备认证令牌）',
  chatContent: '聊天内容提取（从聊天内容中提取文本、支持自定义处理）',
  chatEnvelope: '聊天信封解析（移除聊天信封头、移除消息ID提示）',
  providerUtils: '提供商工具（检查是否为推理标签提供商、特殊提供商处理）',
  // 第十六阶段新增
  nodeMatch: '节点匹配（规范化节点键、从候选节点中查找匹配项、解析节点 ID 支持模糊匹配）',
  avatarPolicy: '头像策略（解析头像 MIME 类型、检查 URL 类型、检查路径类型、检查路径是否在根目录内、检查支持的扩展名）',
  usageAggregates: '使用统计聚合（合并延迟统计、合并每日延迟统计、构建使用统计聚合结果）',
  runWithConcurrency: '并发任务执行（并发执行任务、支持错误处理、支持错误模式）',
  withTimeout: 'Promise 超时控制（为 Promise 添加超时控制、防止长时间阻塞）',
  safeJson: '安全 JSON 序列化（安全序列化 JSON、处理 bigint、函数、Error、Uint8Array 等特殊类型）',
  // 第十七阶段新增 - OpenClaw 模块
  secureRandom: '安全随机数生成（生成加密安全的 UUID、Token、十六进制字符串、随机整数、随机字符串，使用 Node.js crypto 模块）',
  spawnUtils: '进程启动和回退（解析命令标准 I/O 配置、格式化进程启动错误、检查进程存活、带回退机制的进程启动、带超时的进程启动）'
};

let loadedModules = [];
let totalTools = 0;

for (const modName of moduleList) {
  const mod = nodeModules[modName];
  if (mod) {
    const modTools = extractTools(modName, mod);
    tools.push(...modTools);
    loadedModules.push(modName);
    totalTools += modTools.length;
  }
}

console.error(`[iFlow Node MCP] 加载了 ${loadedModules.length} 个模块, ${totalTools} 个工具`);
console.error(`[iFlow Node MCP] 模块: ${loadedModules.join(', ')}`);

// 创建服务器
const server = new Server(
  {
    name: 'iflow-node-modules',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 列出工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }))
  };
});

// 执行工具
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const tool = tools.find(t => t.name === name);
  if (!tool) {
    return {
      content: [{
        type: 'text',
        text: `错误: 未知工具 '${name}'\n可用工具: ${tools.slice(0, 20).map(t => t.name).join(', ')}...`
      }]
    };
  }
  
  try {
    const result = await Promise.resolve(tool.handler(args || {}));
    
    let text;
    if (typeof result === 'string') {
      text = result;
    } else {
      text = JSON.stringify(result, null, 2);
    }
    
    // 截断过长输出
    if (text.length > 50000) {
      text = text.substring(0, 25000) + '\n\n... [输出已截断] ...\n\n' + text.substring(text.length - 25000);
    }
    
    return {
      content: [{ type: 'text', text }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `执行错误: ${error.message}\n${error.stack}`
      }]
    };
  }
});

// 启动服务器
async function main() {
  console.error('[iFlow Node MCP] 启动中...');
  
  // ========== 自动启动心跳和自主功能 ==========
  try {
    const heartbeat = nodeModules.heartbeat;
    const path = require('path');
    const fs = require('fs');
    
    // 读取持久化的技能配置
    const registryPath = path.join(__dirname, 'heartbeat-data', 'skill-registry.json');
    
    if (fs.existsSync(registryPath)) {
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      const enabledSkills = registry.filter(s => s.enabled);
      
      if (enabledSkills.length > 0) {
        console.error(`[iFlow AutoStart] 发现 ${enabledSkills.length} 个启用的技能，自动启动心跳...`);
        
        // 启动心跳（每分钟检查一次）
        heartbeat.startInterval(60000);
        
        console.error(`[iFlow AutoStart] 心跳已启动，技能: ${enabledSkills.map(s => s.name).join(', ')}`);
      }
    } else {
      // 首次启动，使用默认配置
      console.error('[iFlow AutoStart] 首次启动，使用默认配置...');
      heartbeat.startInterval(60000);
    }
    
    // 记录启动时间
    const startupLog = {
      timestamp: new Date().toISOString(),
      event: 'auto_start',
      heartbeatStarted: true
    };
    const logPath = path.join(__dirname, 'heartbeat-data', 'startup-log.json');
    fs.writeFileSync(logPath, JSON.stringify(startupLog, null, 2));
    
  } catch (e) {
    console.error(`[iFlow AutoStart] 启动失败: ${e.message}`);
  }
  // ========== 自动启动结束 ==========
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[iFlow Node MCP] 已连接，等待请求...');
}

main().catch(error => {
  console.error('[iFlow Node MCP] 错误:', error);
  process.exit(1);
});
