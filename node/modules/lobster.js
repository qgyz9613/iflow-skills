/**
 * iFlow Lobster Module v2.0
 * 完整工作流引擎 + 管道命令
 * 比 OpenClaw Lobster 更强大
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const WORKFLOW_DIR = path.join(__dirname, '..', 'workflow-data');
const CACHE_DIR = path.join(__dirname, '..', 'lobster-cache');
[WORKFLOW_DIR, CACHE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============================================================
// 管道命令
// ============================================================

// 解析谓词表达式
function parsePredicate(expr) {
  const m = expr.match(/^([a-zA-Z0-9_.]+)\s*(==|=|!=|<=|>=|<|>)\s*(.+)$/);
  if (!m) throw new Error(`Invalid where expression: ${expr}`);
  const [, fieldPath, op, rawValue] = m;

  let value = rawValue;
  if (rawValue === 'true') value = true;
  else if (rawValue === 'false') value = false;
  else if (rawValue === 'null') value = null;
  else if (!Number.isNaN(Number(rawValue)) && rawValue.trim() !== '') value = Number(rawValue);

  return { fieldPath, op: op === '=' ? '==' : op, value };
}

// 获取嵌套路径值
function getByPath(obj, fieldPath) {
  if (!fieldPath) return obj;
  const parts = fieldPath.split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

// 比较函数
function compare(left, op, right) {
  switch (op) {
    case '==': return left == right;
    case '!=': return left != right;
    case '<': return left < right;
    case '<=': return left <= right;
    case '>': return left > right;
    case '>=': return left >= right;
    default: throw new Error(`Unsupported operator: ${op}`);
  }
}

// where - 过滤
function where(items, expr) {
  const start = Date.now();
  try {
    const pred = parsePredicate(expr);
    const results = items.filter(item => {
      const left = getByPath(item, pred.fieldPath);
      return compare(left, pred.op, pred.value);
    });
    return { status: 'ok', results, count: results.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// pick - 选择字段
function pick(items, fields) {
  const start = Date.now();
  try {
    const fieldList = typeof fields === 'string' ? fields.split(',').map(s => s.trim()).filter(Boolean) : fields;
    const results = items.map(item => {
      if (item === null || typeof item !== 'object') return item;
      const out = {};
      for (const f of fieldList) out[f] = item[f];
      return out;
    });
    return { status: 'ok', results, count: results.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// head - 取前N条
function head(items, n = 10) {
  const start = Date.now();
  try {
    const count = Number(n) || 10;
    const results = items.slice(0, count);
    return { status: 'ok', results, count: results.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// tail - 取后N条
function tail(items, n = 10) {
  const start = Date.now();
  try {
    const count = Number(n) || 10;
    const results = items.slice(-count);
    return { status: 'ok', results, count: results.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// map - 映射转换
function map(items, options = {}) {
  const start = Date.now();
  try {
    const { wrap, unwrap, assignments } = options;
    let results = items;

    if (unwrap) {
      results = items.map(item => getByPath(item, unwrap));
    } else if (wrap) {
      results = items.map(item => ({ [wrap]: item }));
    }

    if (assignments && Object.keys(assignments).length > 0) {
      results = results.map(item => {
        const newItem = { ...item };
        for (const [key, template] of Object.entries(assignments)) {
          // 支持 {{path}} 模板
          newItem[key] = template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => {
            const val = getByPath(item, expr.trim());
            return val !== undefined ? String(val) : '';
          });
        }
        return newItem;
      });
    }

    return { status: 'ok', results, count: results.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// sort - 排序
function sort(items, options = {}) {
  const start = Date.now();
  try {
    const { key, desc = false } = options;
    
    const indexed = items.map((item, idx) => ({ item, idx }));
    
    indexed.sort((a, b) => {
      const av = key ? getByPath(a.item, key) : a.item;
      const bv = key ? getByPath(b.item, key) : b.item;
      
      // null/undefined 排最后
      const aNull = av === undefined || av === null;
      const bNull = bv === undefined || bv === null;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      
      let c;
      if (typeof av === 'number' && typeof bv === 'number') {
        c = av - bv;
      } else {
        c = String(av).localeCompare(String(bv));
      }
      
      if (c !== 0) return desc ? -c : c;
      return a.idx - b.idx; // 稳定排序
    });

    const results = indexed.map(x => x.item);
    return { status: 'ok', results, count: results.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// dedupe - 去重
function dedupe(items, options = {}) {
  const start = Date.now();
  try {
    const { key } = options;
    const seen = new Set();
    const results = [];

    for (const item of items) {
      const id = key ? getByPath(item, key) : item;
      const k = JSON.stringify(id);
      if (seen.has(k)) continue;
      seen.add(k);
      results.push(item);
    }

    return { status: 'ok', results, count: results.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// groupBy - 分组
function groupBy(items, key) {
  const start = Date.now();
  try {
    const groups = {};
    
    for (const item of items) {
      const groupKey = getByPath(item, key);
      const k = JSON.stringify(groupKey);
      if (!groups[k]) groups[k] = { key: groupKey, items: [] };
      groups[k].items.push(item);
    }

    const results = Object.values(groups);
    return { status: 'ok', results, count: results.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// count - 计数
function count(items) {
  const start = Date.now();
  return { status: 'ok', count: items.length, time: Date.now() - start };
}

// sum - 求和
function sum(items, field) {
  const start = Date.now();
  try {
    const total = items.reduce((acc, item) => {
      const val = field ? getByPath(item, field) : item;
      return acc + (Number(val) || 0);
    }, 0);
    return { status: 'ok', sum: total, count: items.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// avg - 平均值
function avg(items, field) {
  const start = Date.now();
  try {
    if (items.length === 0) return { status: 'ok', avg: 0, count: 0, time: Date.now() - start };
    const total = items.reduce((acc, item) => {
      const val = field ? getByPath(item, field) : item;
      return acc + (Number(val) || 0);
    }, 0);
    return { status: 'ok', avg: total / items.length, sum: total, count: items.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ============================================================
// 工作流执行
// ============================================================

// 执行工作流
function run(workflow, args = {}) {
  const start = Date.now();
  try {
    const executionId = uuidv4();
    
    // 支持工作流名称、YAML 定义或步骤数组
    let workflowDef = workflow;
    
    // 如果是字符串，尝试加载工作流文件
    if (typeof workflow === 'string') {
      const workflowPath = path.join(WORKFLOW_DIR, `${workflow}.yaml`);
      if (fs.existsSync(workflowPath)) {
        const yaml = require('js-yaml'); // 可选依赖
        workflowDef = yaml.load(fs.readFileSync(workflowPath, 'utf8'));
      } else {
        // 尝试 JSON
        const jsonPath = path.join(WORKFLOW_DIR, `${workflow}.json`);
        if (fs.existsSync(jsonPath)) {
          workflowDef = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        }
      }
    }
    
    const execution = {
      id: executionId,
      workflow: workflowDef.name || 'anonymous',
      workflowDef,
      args,
      status: 'running',
      steps: [],
      context: {},
      started_at: new Date().toISOString(),
      completed_at: null,
      result: null
    };
    
    const filePath = path.join(WORKFLOW_DIR, `${executionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(execution, null, 2));
    
    return { status: 'ok', execution, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 恢复工作流
function resume(token, approved = true) {
  const start = Date.now();
  try {
    const filePath = path.join(WORKFLOW_DIR, `${token}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'Workflow not found', time: Date.now() - start };
    }
    
    const execution = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    execution.status = approved ? 'approved' : 'rejected';
    execution.resumed_at = new Date().toISOString();
    
    fs.writeFileSync(filePath, JSON.stringify(execution, null, 2));
    
    return { status: 'ok', execution, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 列出工作流
function list(options = {}) {
  const start = Date.now();
  try {
    const files = fs.readdirSync(WORKFLOW_DIR).filter(f => f.endsWith('.json'));
    
    const workflows = files.map(f => {
      try {
        const wf = JSON.parse(fs.readFileSync(path.join(WORKFLOW_DIR, f), 'utf8'));
        return {
          id: wf.id,
          name: wf.workflow,
          status: wf.status,
          started_at: wf.started_at,
          stepCount: wf.steps?.length || 0
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    // 支持过滤
    let results = workflows;
    if (options.status) {
      results = results.filter(w => w.status === options.status);
    }
    
    return { status: 'ok', workflows: results, total: results.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取状态
function state(workflowName = null) {
  const start = Date.now();
  try {
    const files = fs.readdirSync(WORKFLOW_DIR).filter(f => f.endsWith('.json'));
    
    if (workflowName) {
      const matching = files.filter(f => {
        try {
          const wf = JSON.parse(fs.readFileSync(path.join(WORKFLOW_DIR, f), 'utf8'));
          return wf.workflow === workflowName;
        } catch {
          return false;
        }
      });
      
      return { status: 'ok', count: matching.length, time: Date.now() - start };
    }
    
    const statuses = files.map(f => {
      try {
        const wf = JSON.parse(fs.readFileSync(path.join(WORKFLOW_DIR, f), 'utf8'));
        return { id: wf.id, workflow: wf.workflow, status: wf.status };
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    return { status: 'ok', workflows: statuses, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 取消工作流
function cancel(workflowId) {
  const start = Date.now();
  try {
    const filePath = path.join(WORKFLOW_DIR, `${workflowId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'Workflow not found', time: Date.now() - start };
    }
    
    const execution = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    execution.status = 'cancelled';
    execution.cancelled_at = new Date().toISOString();
    
    fs.writeFileSync(filePath, JSON.stringify(execution, null, 2));
    
    return { status: 'ok', execution, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 添加步骤结果
function addStep(workflowId, step, result) {
  const start = Date.now();
  try {
    const filePath = path.join(WORKFLOW_DIR, `${workflowId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'Workflow not found', time: Date.now() - start };
    }
    
    const execution = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    execution.steps.push({
      step,
      result,
      timestamp: new Date().toISOString()
    });
    
    // 更新上下文
    if (result && typeof result === 'object') {
      execution.context = { ...execution.context, ...result };
    }
    
    fs.writeFileSync(filePath, JSON.stringify(execution, null, 2));
    
    return { status: 'ok', execution, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ============================================================
// 审批流程
// ============================================================

// 创建审批请求
function approve(options = {}) {
  const start = Date.now();
  try {
    const { prompt = 'Approve?', items = [], preview = null, timeout = 3600000 } = options;
    
    const approvalId = uuidv4();
    const approval = {
      id: approvalId,
      type: 'approval_request',
      prompt,
      items,
      preview,
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + timeout).toISOString(),
      response: null
    };
    
    const filePath = path.join(WORKFLOW_DIR, `approval-${approvalId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(approval, null, 2));
    
    return { 
      status: 'ok', 
      approval,
      message: 'Approval request created. Use respond() to answer.',
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 响应审批
function respond(approvalId, response, notes = '') {
  const start = Date.now();
  try {
    const filePath = path.join(WORKFLOW_DIR, `approval-${approvalId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'Approval not found', time: Date.now() - start };
    }
    
    const approval = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (approval.status !== 'pending') {
      return { status: 'error', message: `Approval already ${approval.status}`, time: Date.now() - start };
    }
    
    if (new Date() > new Date(approval.expires_at)) {
      approval.status = 'expired';
    } else {
      approval.status = response ? 'approved' : 'rejected';
    }
    
    approval.response = response;
    approval.notes = notes;
    approval.responded_at = new Date().toISOString();
    
    fs.writeFileSync(filePath, JSON.stringify(approval, null, 2));
    
    return { status: 'ok', approval, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ============================================================
// 管道执行器
// ============================================================

// 执行管道
function pipe(items, commands) {
  const start = Date.now();
  try {
    let data = Array.isArray(items) ? items : [items];
    const logs = [];
    
    for (const cmd of commands) {
      const { command, args = {} } = typeof cmd === 'string' ? { command: cmd } : cmd;
      const cmdStart = Date.now();
      
      switch (command) {
        case 'where':
          data = where(data, args.expr || args._?.[0]).results || [];
          break;
        case 'pick':
          data = pick(data, args.fields || args._?.[0]).results || [];
          break;
        case 'head':
          data = head(data, args.n || args._?.[0]).results || [];
          break;
        case 'tail':
          data = tail(data, args.n || args._?.[0]).results || [];
          break;
        case 'map':
          data = map(data, args).results || [];
          break;
        case 'sort':
          data = sort(data, args).results || [];
          break;
        case 'dedupe':
          data = dedupe(data, args).results || [];
          break;
        case 'groupBy':
          data = groupBy(data, args.key).results || [];
          break;
        case 'count':
          data = [count(data)];
          break;
        case 'sum':
          data = [sum(data, args.field)];
          break;
        case 'avg':
          data = [avg(data, args.field)];
          break;
        default:
          throw new Error(`Unknown command: ${command}`);
      }
      
      logs.push({
        command,
        inputCount: data.length,
        time: Date.now() - cmdStart
      });
    }
    
    return { 
      status: 'ok', 
      results: data, 
      count: data.length,
      logs,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ============================================================
// 模块导出
// ============================================================

module.exports = {
  // 管道命令
  where,
  pick,
  head,
  tail,
  map,
  sort,
  dedupe,
  groupBy,
  count,
  sum,
  avg,
  pipe,
  
  // 工作流
  run,
  resume,
  list,
  state,
  cancel,
  addStep,
  
  // 审批
  approve,
  respond
};