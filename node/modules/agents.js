/**
 * iFlow Agents Module
 * 多代理协作系统
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const AGENTS_DIR = path.join(__dirname, '..', 'agents-data');
if (!fs.existsSync(AGENTS_DIR)) fs.mkdirSync(AGENTS_DIR, { recursive: true });

// 预定义代理类型
const AGENT_TYPES = {
  coder: { model: 'qwen3-coder-plus', systemPrompt: 'You are an expert coder.' },
  architect: { model: 'deepseek-r1', systemPrompt: 'You are a system architect.' },
  reviewer: { model: 'gpt-4', systemPrompt: 'You are a code reviewer.' },
  researcher: { model: 'claude-3', systemPrompt: 'You are a research assistant.' },
  writer: { model: 'gpt-4', systemPrompt: 'You are a technical writer.' }
};

// 分配任务给代理
function assign(agentType, task, options = {}) {
  const start = Date.now();
  try {
    const agentId = uuidv4();
    const agent = AGENT_TYPES[agentType] || AGENT_TYPES.coder;
    
    const assignment = {
      id: agentId,
      type: agentType,
      task,
      model: options.model || agent.model,
      systemPrompt: options.systemPrompt || agent.systemPrompt,
      status: 'pending',
      created_at: new Date().toISOString(),
      result: null
    };
    
    // 保存任务
    const filePath = path.join(AGENTS_DIR, `${agentId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(assignment, null, 2));
    
    return { status: 'ok', assignment, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 分发任务给多个代理
function dispatch(tasks, parallel = true) {
  const start = Date.now();
  try {
    const results = tasks.map(t => assign(t.agentType || 'coder', t.task, t.options));
    
    return { 
      status: 'ok', 
      assignments: results, 
      parallel,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 协作模式
function collaborate(objective, strategy = 'sequential', agents = []) {
  const start = Date.now();
  try {
    const planId = uuidv4();
    
    const plan = {
      id: planId,
      objective,
      strategy, // sequential, parallel, review
      agents: agents.length > 0 ? agents : Object.keys(AGENT_TYPES),
      status: 'planned',
      created_at: new Date().toISOString(),
      results: []
    };
    
    const filePath = path.join(AGENTS_DIR, `plan-${planId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(plan, null, 2));
    
    return { status: 'ok', plan, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 列出可用代理
function listTypes() {
  const start = Date.now();
  return { 
    status: 'ok', 
    types: Object.keys(AGENT_TYPES).map(k => ({
      name: k,
      ...AGENT_TYPES[k]
    })),
    time: Date.now() - start 
  };
}

// 定义新角色
function defineRole(roleName, config) {
  const start = Date.now();
  try {
    AGENT_TYPES[roleName] = {
      model: config.model || 'gpt-4',
      systemPrompt: config.systemPrompt || ''
    };
    
    return { status: 'ok', role: roleName, config: AGENT_TYPES[roleName], time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 移除角色
function removeRole(roleName) {
  const start = Date.now();
  try {
    if (AGENT_TYPES[roleName]) {
      delete AGENT_TYPES[roleName];
      return { status: 'ok', role: roleName, time: Date.now() - start };
    }
    return { status: 'error', message: 'Role not found', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 智能选择模型
function selectModel(taskType, options = {}) {
  const start = Date.now();
  
  const recommendations = {
    code: 'qwen3-coder-plus',
    research: 'claude-3',
    review: 'gpt-4',
    think: 'deepseek-r1',
    general: 'gpt-4',
    vision: 'gpt-4-vision'
  };
  
  const model = recommendations[taskType] || recommendations.general;
  
  return { 
    status: 'ok', 
    taskType, 
    recommendedModel: model,
    time: Date.now() - start 
  };
}

module.exports = {
  assign,
  dispatch,
  collaborate,
  listTypes,
  defineRole,
  removeRole,
  selectModel,
  AGENT_TYPES
};
