/**
 * iFlow SubAgent Module - 多代理协同系统
 * 升级：协调者智能委派 + 并行执行 + 努力扩展
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const SUBAGENT_DIR = path.join(__dirname, '..', 'subagent-data');
const ARTIFACTS_DIR = path.join(SUBAGENT_DIR, 'artifacts');
[SUBAGENT_DIR, ARTIFACTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ========== 努力扩展规则 ==========
const EFFORT_SCALING = {
  simple: { subagents: 1, toolCalls: '3-10', strategy: 'sequential' },
  moderate: { subagents: '2-4', toolCalls: '10-15', strategy: 'parallel' },
  complex: { subagents: '5-10', toolCalls: '15+', strategy: 'parallel' }
};

// ========== 任务复杂度评估 ==========
function assessComplexity(query) {
  const factors = {
    breadth: (query.match(/所有|全部|每个|列出/g) || []).length,
    depth: (query.match(/详细|深入|分析|对比/g) || []).length,
    multiple: (query.match(/和|以及|同时|分别/g) || []).length,
    parallel: (query.match(/并行|同时|不同/g) || []).length
  };
  
  const score = Object.values(factors).reduce((a, b) => a + b, 0);
  
  if (score <= 1) return 'simple';
  if (score <= 3) return 'moderate';
  return 'complex';
}

// ========== 协调者：创建委派计划 ==========
function plan(tasks, options = {}) {
  const start = Date.now();
  try {
    const planId = uuidv4();
    
    // 评估复杂度并确定策略
    const query = options.query || tasks.map(t => t.name).join(' ');
    const complexity = options.complexity || assessComplexity(query);
    const scaling = EFFORT_SCALING[complexity];
    
    const plan = {
      id: planId,
      query,
      complexity,
      scaling,
      strategy: options.strategy || scaling.strategy,
      reviewEnabled: options.reviewEnabled !== false,
      status: 'pending',
      created_at: new Date().toISOString(),
      expectedSubagents: typeof scaling.subagents === 'string' 
        ? parseInt(scaling.subagents.split('-')[1]) 
        : scaling.subagents,
      tasks: tasks.map((t, i) => ({
        id: `${planId}-${i}`,
        name: t.name,
        // 详细任务描述（关键改进）
        description: t.description || t.name,
        objective: t.objective || `完成 ${t.name}`,
        outputFormat: t.outputFormat || 'summary',
        tools: t.tools || ['default'],
        sources: t.sources || [],
        boundaries: t.boundaries || '专注于指定任务，不重复其他代理的工作',
        priority: t.priority || 'medium',
        status: 'pending',
        agentType: t.agentType || 'general-purpose',
        model: t.model || 'default',  // 支持多模型路由
        result: null,
        artifactPath: null  // 子代理输出文件路径
      }))
    };
    
    const filePath = path.join(SUBAGENT_DIR, `plan-${planId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(plan, null, 2));
    
    // 保存计划到记忆（防止上下文溢出）
    const memoryPath = path.join(SUBAGENT_DIR, `memory-${planId}.json`);
    fs.writeFileSync(memoryPath, JSON.stringify({
      planId,
      query,
      strategy: plan.strategy,
      taskCount: plan.tasks.length,
      createdAt: plan.created_at
    }, null, 2));
    
    return { 
      status: 'ok', 
      plan,
      message: `计划创建成功，复杂度: ${complexity}，策略: ${plan.strategy}，预期子代理: ${plan.expectedSubagents}`,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 委派任务给子代理 ==========
function delegate(taskId, options = {}) {
  const start = Date.now();
  try {
    const files = fs.readdirSync(SUBAGENT_DIR).filter(f => f.startsWith('plan-'));
    
    for (const f of files) {
      const plan = JSON.parse(fs.readFileSync(path.join(SUBAGENT_DIR, f), 'utf8'));
      const task = plan.tasks.find(t => t.id === taskId);
      
      if (task) {
        task.status = 'in_progress';
        task.agentType = options.agentType || task.agentType;
        task.model = options.model || task.model;
        task.context = options.context;
        task.started_at = new Date().toISOString();
        
        // 创建子代理工件目录
        const artifactDir = path.join(ARTIFACTS_DIR, taskId);
        if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
        task.artifactPath = artifactDir;
        
        fs.writeFileSync(path.join(SUBAGENT_DIR, f), JSON.stringify(plan, null, 2));
        
        // 生成委派指令（详细描述）
        const delegation = {
          taskId,
          instruction: generateDelegationInstruction(task),
          agentType: task.agentType,
          model: task.model,
          artifactPath: task.artifactPath
        };
        
        return { 
          status: 'ok', 
          task, 
          delegation,
          planId: plan.id, 
          time: Date.now() - start 
        };
      }
    }
    
    return { status: 'error', message: 'Task not found', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 生成委派指令（关键：详细描述） ==========
function generateDelegationInstruction(task) {
  return `
## 任务目标
${task.objective}

## 输出格式
${task.outputFormat}

## 可用工具
${task.tools.join(', ')}

## 信息源
${task.sources.length > 0 ? task.sources.join(', ') : '自动选择'}

## 任务边界
${task.boundaries}

## 注意事项
- 不要重复其他代理已完成的工作
- 使用 ${task.tools.length} 个工具完成任务
- 将输出保存到 ${task.artifactPath}
`;
}

// ========== 报告结果 ==========
function report(taskId, status, result = null, notes = '') {
  const start = Date.now();
  try {
    const files = fs.readdirSync(SUBAGENT_DIR).filter(f => f.startsWith('plan-'));
    
    for (const f of files) {
      const plan = JSON.parse(fs.readFileSync(path.join(SUBAGENT_DIR, f), 'utf8'));
      const task = plan.tasks.find(t => t.id === taskId);
      
      if (task) {
        task.status = status;
        task.result = result;
        task.notes = notes;
        task.completed_at = new Date().toISOString();
        
        // 如果有大型结果，保存到工件文件
        if (result && typeof result === 'string' && result.length > 1000) {
          const resultPath = path.join(task.artifactPath || ARTIFACTS_DIR, `result-${taskId}.json`);
          fs.writeFileSync(resultPath, JSON.stringify({
            taskId,
            status,
            result,
            notes,
            completedAt: task.completed_at
          }, null, 2));
          task.resultPath = resultPath;
          task.result = `[结果已保存到 ${resultPath}]`;
        }
        
        fs.writeFileSync(path.join(SUBAGENT_DIR, f), JSON.stringify(plan, null, 2));
        
        return { status: 'ok', task, time: Date.now() - start };
      }
    }
    
    return { status: 'error', message: 'Task not found', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 并行委派多个子代理 ==========
function delegateParallel(planId, taskIds = null) {
  const start = Date.now();
  try {
    const filePath = path.join(SUBAGENT_DIR, `plan-${planId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'Plan not found', time: Date.now() - start };
    }
    
    const plan = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // 获取待执行任务
    const pendingTasks = taskIds 
      ? plan.tasks.filter(t => taskIds.includes(t.id) && t.status === 'pending')
      : plan.tasks.filter(t => t.status === 'pending');
    
    if (pendingTasks.length === 0) {
      return { status: 'ok', message: 'No pending tasks', plan, time: Date.now() - start };
    }
    
    // 并行委派
    const delegations = [];
    for (const task of pendingTasks) {
      const result = delegate(task.id);
      if (result.status === 'ok') {
        delegations.push(result.delegation);
      }
    }
    
    return { 
      status: 'ok', 
      delegations,
      count: delegations.length,
      plan,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 查询状态 ==========
function status(options = {}) {
  const start = Date.now();
  try {
    if (options.taskId) {
      const files = fs.readdirSync(SUBAGENT_DIR).filter(f => f.startsWith('plan-'));
      
      for (const f of files) {
        const plan = JSON.parse(fs.readFileSync(path.join(SUBAGENT_DIR, f), 'utf8'));
        const task = plan.tasks.find(t => t.id === options.taskId);
        if (task) {
          return { status: 'ok', task, planId: plan.id, time: Date.now() - start };
        }
      }
      
      return { status: 'error', message: 'Task not found', time: Date.now() - start };
    }
    
    if (options.planId) {
      const filePath = path.join(SUBAGENT_DIR, `plan-${options.planId}.json`);
      
      if (!fs.existsSync(filePath)) {
        return { status: 'error', message: 'Plan not found', time: Date.now() - start };
      }
      
      const plan = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // 计算进度
      const completed = plan.tasks.filter(t => t.status === 'completed').length;
      const progress = `${completed}/${plan.tasks.length}`;
      
      return { status: 'ok', plan, progress, time: Date.now() - start };
    }
    
    // 列出所有计划
    const files = fs.readdirSync(SUBAGENT_DIR).filter(f => f.startsWith('plan-'));
    const plans = files.map(f => {
      try {
        const plan = JSON.parse(fs.readFileSync(path.join(SUBAGENT_DIR, f), 'utf8'));
        const completed = plan.tasks.filter(t => t.status === 'completed').length;
        return { 
          id: plan.id, 
          query: plan.query,
          complexity: plan.complexity,
          strategy: plan.strategy, 
          status: plan.status, 
          progress: `${completed}/${plan.tasks.length}`,
          taskCount: plan.tasks.length 
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    return { status: 'ok', plans, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 审查任务结果 ==========
function review(taskId, options = {}) {
  const start = Date.now();
  try {
    const files = fs.readdirSync(SUBAGENT_DIR).filter(f => f.startsWith('plan-'));
    
    for (const f of files) {
      const plan = JSON.parse(fs.readFileSync(path.join(SUBAGENT_DIR, f), 'utf8'));
      const task = plan.tasks.find(t => t.id === taskId);
      
      if (task) {
        // 审查标准
        const criteria = options.criteria || ['correctness', 'completeness', 'quality'];
        const scores = {};
        let totalScore = 0;
        
        for (const c of criteria) {
          // 模拟审查评分（实际应该调用 LLM）
          scores[c] = options.scores?.[c] || 0.85;
          totalScore += scores[c];
        }
        
        const avgScore = totalScore / criteria.length;
        const passed = avgScore >= (options.threshold || 0.7);
        
        const reviewResult = {
          taskId,
          criteria,
          scores,
          avgScore,
          passed,
          notes: options.notes || (passed ? '审查通过' : '需要改进'),
          timestamp: new Date().toISOString()
        };
        
        // 保存审查结果
        task.review = reviewResult;
        fs.writeFileSync(path.join(SUBAGENT_DIR, f), JSON.stringify(plan, null, 2));
        
        return { status: 'ok', review: reviewResult, task, time: Date.now() - start };
      }
    }
    
    return { status: 'error', message: 'Task not found', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 聚合结果 ==========
function aggregate(planId, format = 'summary') {
  const start = Date.now();
  try {
    const filePath = path.join(SUBAGENT_DIR, `plan-${planId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'Plan not found', time: Date.now() - start };
    }
    
    const plan = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const completed = plan.tasks.filter(t => t.status === 'completed');
    const failed = plan.tasks.filter(t => t.status === 'failed');
    const pending = plan.tasks.filter(t => t.status === 'pending');
    const inProgress = plan.tasks.filter(t => t.status === 'in_progress');
    
    // 收集所有结果
    const results = [];
    for (const task of completed) {
      let result = task.result;
      
      // 如果结果保存到文件，读取它
      if (task.resultPath && fs.existsSync(task.resultPath)) {
        try {
          result = JSON.parse(fs.readFileSync(task.resultPath, 'utf8'));
        } catch (e) {}
      }
      
      results.push({
        taskId: task.id,
        name: task.name,
        result
      });
    }
    
    const summary = {
      planId,
      query: plan.query,
      complexity: plan.complexity,
      total: plan.tasks.length,
      completed: completed.length,
      failed: failed.length,
      pending: pending.length,
      inProgress: inProgress.length,
      results
    };
    
    if (format === 'detailed') {
      summary.tasks = plan.tasks;
    }
    
    // 保存聚合结果
    const aggregatePath = path.join(SUBAGENT_DIR, `aggregate-${planId}.json`);
    fs.writeFileSync(aggregatePath, JSON.stringify(summary, null, 2));
    summary.aggregatePath = aggregatePath;
    
    return { status: 'ok', summary, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 取消任务/计划 ==========
function cancel(options = {}) {
  const start = Date.now();
  try {
    if (options.taskId) {
      return report(options.taskId, 'cancelled', null, options.reason || 'Cancelled by user');
    }
    
    if (options.planId) {
      const filePath = path.join(SUBAGENT_DIR, `plan-${options.planId}.json`);
      
      if (!fs.existsSync(filePath)) {
        return { status: 'error', message: 'Plan not found', time: Date.now() - start };
      }
      
      const plan = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      plan.status = 'cancelled';
      plan.cancelled_at = new Date().toISOString();
      plan.cancel_reason = options.reason;
      
      plan.tasks.forEach(t => {
        if (t.status === 'pending' || t.status === 'in_progress') {
          t.status = 'cancelled';
        }
      });
      
      fs.writeFileSync(filePath, JSON.stringify(plan, null, 2));
      
      return { status: 'ok', plan, time: Date.now() - start };
    }
    
    return { status: 'error', message: 'No taskId or planId provided', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 获取任务模板 ==========
function templates() {
  const start = Date.now();
  
  const templates = [
    { 
      name: 'code_review', 
      tasks: [
        { name: 'analyze', description: '分析代码结构和依赖', objective: '识别代码中的模式和潜在问题' },
        { name: 'review', description: '代码质量审查', objective: '检查代码风格、安全和性能' },
        { name: 'report', description: '生成审查报告', objective: '汇总发现并提供建议' }
      ], 
      strategy: 'sequential',
      complexity: 'moderate'
    },
    { 
      name: 'parallel_research', 
      tasks: [
        { name: 'research_a', description: '研究方向A', objective: '探索主题的一个方面' },
        { name: 'research_b', description: '研究方向B', objective: '探索主题的另一个方面' },
        { name: 'aggregate', description: '汇总研究结果', objective: '综合所有发现' }
      ], 
      strategy: 'parallel',
      complexity: 'moderate'
    },
    { 
      name: 'feature_development', 
      tasks: [
        { name: 'design', description: '功能设计', objective: '定义功能和接口' },
        { name: 'implement', description: '代码实现', objective: '编写功能代码' },
        { name: 'test', description: '测试验证', objective: '确保功能正确' },
        { name: 'review', description: '代码审查', objective: '质量把关' }
      ], 
      strategy: 'review',
      complexity: 'complex'
    },
    {
      name: 'trading_analysis',
      tasks: [
        { name: 'market_scan', description: '市场扫描', objective: '识别交易机会', tools: ['panwatch', 'quotes'] },
        { name: 'risk_check', description: '风险检查', objective: '评估止损止盈', tools: ['holding', 'analysis'] },
        { name: 'execute', description: '执行交易', objective: '下单或调整仓位', tools: ['easyths'] }
      ],
      strategy: 'sequential',
      complexity: 'simple'
    }
  ];
  
  return { status: 'ok', templates, effortScaling: EFFORT_SCALING, time: Date.now() - start };
}

// ========== 心跳集成：自动委派 ==========
function autoDelegate(callback) {
  const start = Date.now();
  try {
    // 查找未完成的计划
    const files = fs.readdirSync(SUBAGENT_DIR).filter(f => f.startsWith('plan-'));
    
    for (const f of files) {
      const plan = JSON.parse(fs.readFileSync(path.join(SUBAGENT_DIR, f), 'utf8'));
      
      if (plan.status !== 'pending') continue;
      
      // 自动委派待执行任务
      const pendingTasks = plan.tasks.filter(t => t.status === 'pending');
      
      if (pendingTasks.length > 0 && plan.strategy === 'parallel') {
        // 并行委派
        const result = delegateParallel(plan.id);
        if (callback) callback(result);
        return { status: 'ok', action: 'parallel_delegation', ...result, time: Date.now() - start };
      } else if (pendingTasks.length > 0) {
        // 顺序委派第一个
        const result = delegate(pendingTasks[0].id);
        if (callback) callback(result);
        return { status: 'ok', action: 'sequential_delegation', ...result, time: Date.now() - start };
      }
    }
    
    return { status: 'ok', action: 'no_pending_plans', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

module.exports = {
  plan,
  delegate,
  delegateParallel,
  report,
  status,
  review,
  aggregate,
  cancel,
  templates,
  autoDelegate,
  assessComplexity
};