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

// 注册所有模块的工具 (sandbox 已禁用)
const moduleList = [
  'desktop', 'browser', 'files', 'memory', 'session', 'channel',
  'summarize', 'agents', 'autonomous', 'decision', 'heartbeat',
  'improve', 'lobster', 'selfrepair', 'skills',
  'subagent', 'triage', 'state', 'cache', 'llm'
];

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
