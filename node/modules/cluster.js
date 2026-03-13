/**
 * iFlow Cluster Module
 * 分布式集群管理 - 通过 SSH 连接远程节点
 * 
 * 性能分层：
 * - tier1 (高性能): 8+ 核心或 16GB+ 内存 - 重计算、AI训练
 * - tier2 (中性能): 4-8 核心或 8-16GB 内存 - 数据处理、爬虫
 * - tier3 (低性能): <4 核心或 <8GB 内存 - 轻量任务、监控
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// 配置文件路径
const CLUSTER_CONFIG_PATH = path.join(__dirname, '..', '..', 'cluster-config.json');

// 默认配置
const DEFAULT_CONFIG = {
  nodes: [],
  timeout: 30000,
  maxConcurrent: 5,
  // 本机性能（Windows）
  localNode: {
    id: 'local',
    name: 'Windows-Local',
    host: 'localhost',
    cpuCores: 24,
    cpuModel: 'Intel i9-13900HX',
    memoryGB: 32,
    tier: 'tier1',
    roles: ['heavy_compute', 'ai_training', 'main_controller']
  }
};

// 任务类型到性能层的映射
const TASK_TIERS = {
  'heavy_compute': 'tier1',    // 重计算：模型训练、大数据分析
  'ai_training': 'tier1',      // AI 训练
  'data_analysis': 'tier1',    // 数据分析
  'web_crawler': 'tier2',      // 爬虫
  'file_processing': 'tier2',  // 文件处理
  'api_request': 'tier2',      // API 请求
  'monitoring': 'tier3',       // 监控
  'log_collection': 'tier3',   // 日志收集
  'network_proxy': 'tier3'     // 网络代理
};

/**
 * 加载集群配置
 */
function loadConfig() {
  try {
    if (fs.existsSync(CLUSTER_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CLUSTER_CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Load cluster config error:', e.message);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * 保存集群配置
 */
function saveConfig(config) {
  fs.writeFileSync(CLUSTER_CONFIG_PATH, JSON.stringify(config, null, 2));
  return { status: 'ok', config };
}

/**
 * 添加节点
 */
function addNode(node) {
  const config = loadConfig();
  
  // 检查是否已存在
  const exists = config.nodes.find(n => n.host === node.host);
  if (exists) {
    return { status: 'error', message: 'Node already exists', node: exists };
  }
  
  const newNode = {
    id: `node_${Date.now()}`,
    name: node.name || node.host,
    host: node.host,
    port: node.port || 22,
    username: node.username || 'root',
    password: node.password,
    enabled: true,
    addedAt: new Date().toISOString()
  };
  
  config.nodes.push(newNode);
  saveConfig(config);
  
  return { status: 'ok', node: newNode };
}

/**
 * 移除节点
 */
function removeNode(nodeId) {
  const config = loadConfig();
  const index = config.nodes.findIndex(n => n.id === nodeId);
  
  if (index === -1) {
    return { status: 'error', message: 'Node not found' };
  }
  
  const removed = config.nodes.splice(index, 1)[0];
  saveConfig(config);
  
  return { status: 'ok', removed };
}

/**
 * 列出所有节点
 */
function listNodes() {
  const config = loadConfig();
  return {
    status: 'ok',
    nodes: config.nodes.map(n => ({
      id: n.id,
      name: n.name,
      host: n.host,
      port: n.port,
      username: n.username,
      enabled: n.enabled
    }))
  };
}

/**
 * 测试节点连接（使用 Python paramiko）
 */
async function testNode(nodeId) {
  const config = loadConfig();
  const node = config.nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return { status: 'error', message: 'Node not found' };
  }
  
  // 使用临时文件执行 Python 脚本
  const script = `
import paramiko
import json
import sys

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('${node.host}', port=${node.port}, username='${node.username}', password='${node.password}', timeout=15)
    
    stdin, stdout, stderr = ssh.exec_command('uname -a && free -m | head -2 && df -h / | tail -1')
    output = stdout.read().decode()
    ssh.close()
    
    print(json.dumps({'status': 'ok', 'output': output}))
except Exception as e:
    print(json.dumps({'status': 'error', 'message': str(e)}))
`;

  return execPythonScript(script, 20000);
}

/**
 * 检测节点性能并返回性能标签
 */
async function detectNodeSpecs(nodeId) {
  const config = loadConfig();
  const node = config.nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return { status: 'error', message: 'Node not found' };
  }
  
  const script = `
import paramiko
import json
import re

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('${node.host}', port=${node.port}, username='${node.username}', password='${node.password}', timeout=15)
    
    # 获取 CPU 信息
    stdin, stdout, stderr = ssh.exec_command('lscpu 2>/dev/null || cat /proc/cpuinfo')
    cpu_info = stdout.read().decode()
    
    # 获取内存信息
    stdin, stdout, stderr = ssh.exec_command('free -m | grep Mem')
    mem_info = stdout.read().decode()
    
    ssh.close()
    
    # 解析 CPU 核心数
    cores = 1
    if 'CPU(s):' in cpu_info:
        match = re.search(r'CPU\\(s\\):\\s*(\\d+)', cpu_info)
        if match:
            cores = int(match.group(1))
    elif 'processor' in cpu_info:
        cores = cpu_info.count('processor')
    
    # 解析 CPU 型号
    cpu_model = 'Unknown'
    if 'Model name:' in cpu_info:
        match = re.search(r'Model name:\\s*(.+)', cpu_info)
        if match:
            cpu_model = match.group(1).strip()
    elif 'model name' in cpu_info:
        match = re.search(r'model name\\s*:\\s*(.+)', cpu_info)
        if match:
            cpu_model = match.group(1).strip()
    
    # 解析内存 (可能是 KB 或 MB)
    mem_kb = 0
    match = re.search(r'Mem:\\s*(\\d+)', mem_info)
    if match:
        value = int(match.group(1))
        # 检查数值大小判断单位，大于 1000000 应该是 KB
        if value > 1000000:
            mem_kb = value // 1024  # KB -> MB
        else:
            mem_kb = value  # 已经是 MB
    mem_gb = round(mem_kb / 1024, 1)
    
    # 确定性能层级
    tier = 'tier3'
    if cores >= 8 or mem_gb >= 16:
        tier = 'tier1'
    elif cores >= 4 or mem_gb >= 8:
        tier = 'tier2'
    
    print(json.dumps({
        'status': 'ok',
        'cpuCores': cores,
        'cpuModel': cpu_model,
        'memoryGB': mem_gb,
        'tier': tier
    }))
except Exception as e:
    print(json.dumps({'status': 'error', 'message': str(e)}))
`;

  return execPythonScript(script, 30000);
}

/**
 * 更新节点性能信息
 */
async function updateNodeSpecs(nodeId) {
  const config = loadConfig();
  const nodeIndex = config.nodes.findIndex(n => n.id === nodeId);
  
  if (nodeIndex === -1) {
    return { status: 'error', message: 'Node not found' };
  }
  
  const specs = await detectNodeSpecs(nodeId);
  
  if (specs.status === 'ok') {
    config.nodes[nodeIndex].cpuCores = specs.cpuCores;
    config.nodes[nodeIndex].cpuModel = specs.cpuModel;
    config.nodes[nodeIndex].memoryGB = specs.memoryGB;
    config.nodes[nodeIndex].tier = specs.tier;
    config.nodes[nodeIndex].specsUpdatedAt = new Date().toISOString();
    saveConfig(config);
    
    return { status: 'ok', node: config.nodes[nodeIndex], specs };
  }
  
  return specs;
}

/**
 * 智能选择最适合的节点执行任务
 * @param {string} taskType - 任务类型 (heavy_compute, ai_training, web_crawler, etc.)
 * @param {object} options - 选项 { preferLocal: false, excludeNodes: [] }
 */
async function selectBestNode(taskType, options = {}) {
  const config = loadConfig();
  const requiredTier = TASK_TIERS[taskType] || 'tier2';
  const excludeNodes = options.excludeNodes || [];
  
  // 性能层级优先级
  const tierPriority = { tier1: 3, tier2: 2, tier3: 1 };
  
  // 某些任务类型应该分发到远程节点（减轻主节点负担）
  const DISTRIBUTE_TASKS = ['web_crawler', 'file_processing', 'monitoring', 'log_collection', 'network_proxy'];
  
  // 如果偏好本地且本地满足要求，且不是分发型任务
  if (options.preferLocal !== false && !DISTRIBUTE_TASKS.includes(taskType)) {
    const local = config.localNode || DEFAULT_CONFIG.localNode;
    if (local && tierPriority[local.tier] >= tierPriority[requiredTier]) {
      return {
        status: 'ok',
        selected: 'local',
        node: local,
        reason: 'Local node meets requirements'
      };
    }
  }
  
  // 筛选可用节点
  const availableNodes = config.nodes.filter(n => 
    n.enabled && 
    !excludeNodes.includes(n.id) &&
    tierPriority[n.tier || 'tier3'] >= tierPriority[requiredTier]
  );
  
  if (availableNodes.length === 0) {
    // 如果是分发型任务但没有远程节点，回退到本地
    if (options.preferLocal !== false) {
      const local = config.localNode || DEFAULT_CONFIG.localNode;
      if (local) {
        return {
          status: 'ok',
          selected: 'local',
          node: local,
          reason: 'No remote nodes available, fallback to local'
        };
      }
    }
    
    return { status: 'error', message: 'No available nodes for this task type' };
  }
  
  // 对于分发型任务，选择刚好满足要求的节点（不浪费高性能节点）
  if (DISTRIBUTE_TASKS.includes(taskType)) {
    // 按性能排序，选择刚好满足要求的最低性能节点
    availableNodes.sort((a, b) => 
      (tierPriority[a.tier || 'tier3'] || 0) - (tierPriority[b.tier || 'tier3'] || 0)
    );
  } else {
    // 按性能排序，选择最高性能节点
    availableNodes.sort((a, b) => 
      (tierPriority[b.tier || 'tier3'] || 0) - (tierPriority[a.tier || 'tier3'] || 0)
    );
  }
  
  return {
    status: 'ok',
    selected: availableNodes[0].id,
    node: availableNodes[0],
    reason: `Best match for ${taskType} (tier ${availableNodes[0].tier || 'tier3'})`
  };
}

/**
 * 分发任务到最佳节点
 * @param {string} taskType - 任务类型
 * @param {string} command - 要执行的命令
 * @param {object} options - 选项
 */
async function dispatchTask(taskType, command, options = {}) {
  const selection = await selectBestNode(taskType, options);
  
  if (selection.status !== 'ok') {
    return selection;
  }
  
  if (selection.selected === 'local') {
    // 本地执行
    return new Promise((resolve) => {
      exec(command, { timeout: options.timeout || 60000 }, (error, stdout, stderr) => {
        resolve({
          status: error ? 'error' : 'ok',
          nodeId: 'local',
          node: selection.node,
          taskType,
          stdout: stdout?.toString(),
          stderr: stderr?.toString(),
          error: error?.message
        });
      });
    });
  }
  
  // 远程执行
  const result = await execOnNode(selection.selected, command, options);
  return {
    ...result,
    taskType,
    selection: selection.reason
  };
}

/**
 * 获取集群资源概览
 */
async function getResourceOverview() {
  const config = loadConfig();
  const overview = {
    local: config.localNode || DEFAULT_CONFIG.localNode,
    nodes: [],
    totalCores: config.localNode?.cpuCores || 0,
    totalMemoryGB: config.localNode?.memoryGB || 0,
    nodesByTier: { tier1: 0, tier2: 0, tier3: 0 }
  };
  
  // 更新本地统计
  if (overview.local) {
    overview.nodesByTier[overview.local.tier]++;
  }
  
  for (const node of config.nodes) {
    const nodeInfo = {
      id: node.id,
      name: node.name,
      host: node.host,
      enabled: node.enabled,
      tier: node.tier || 'tier3',
      cpuCores: node.cpuCores || 'unknown',
      cpuModel: node.cpuModel || 'unknown',
      memoryGB: node.memoryGB || 'unknown'
    };
    
    overview.nodes.push(nodeInfo);
    
    if (node.enabled && typeof node.cpuCores === 'number') {
      overview.totalCores += node.cpuCores;
      overview.totalMemoryGB += node.memoryGB || 0;
      overview.nodesByTier[node.tier || 'tier3']++;
    }
  }
  
  overview.totalMemoryGB = Math.round(overview.totalMemoryGB * 10) / 10;
  
  return {
    status: 'ok',
    overview
  };
}

/**
 * 执行 Python 脚本（通过临时文件）
 */
function execPythonScript(script, timeout = 30000) {
  const tmpFile = path.join(require('os').tmpdir(), `iflow_ssh_${Date.now()}.py`);
  
  return new Promise((resolve) => {
    fs.writeFileSync(tmpFile, script);
    
    exec(`python "${tmpFile}"`, { timeout }, (error, stdout, stderr) => {
      // 清理临时文件
      try { fs.unlinkSync(tmpFile); } catch (e) {}
      
      if (error) {
        resolve({ status: 'error', message: error.message });
        return;
      }
      
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (e) {
        resolve({ status: 'error', message: 'Parse error', raw: stdout });
      }
    });
  });
}

/**
 * 在节点上执行命令
 */
async function execOnNode(nodeId, command, options = {}) {
  const config = loadConfig();
  const node = config.nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return { status: 'error', message: 'Node not found' };
  }
  
  const timeout = options.timeout || config.timeout || 30000;
  
  // 使用临时文件执行 Python 脚本
  const script = `
import paramiko
import json
import sys

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('${node.host}', port=${node.port}, username='${node.username}', password='${node.password}', timeout=15)
    
    stdin, stdout, stderr = ssh.exec_command('''${command.replace(/'/g, "'\"'\"'")}''', timeout=${Math.floor(timeout/1000)})
    
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    code = stdout.channel.recv_exit_status()
    ssh.close()
    
    print(json.dumps({
        'status': 'ok' if code == 0 else 'error',
        'exitCode': code,
        'stdout': out,
        'stderr': err
    }))
except Exception as e:
    print(json.dumps({'status': 'error', 'message': str(e)}))
`;

  const result = await execPythonScript(script, timeout + 5000);
  result.nodeId = nodeId;
  result.node = node.name;
  return result;
}

/**
 * 广播命令到所有启用的节点
 */
async function broadcast(command, options = {}) {
  const config = loadConfig();
  const enabledNodes = config.nodes.filter(n => n.enabled);
  
  if (enabledNodes.length === 0) {
    return { status: 'error', message: 'No enabled nodes' };
  }
  
  const results = [];
  const maxConcurrent = options.maxConcurrent || config.maxConcurrent || 5;
  
  // 分批并行执行
  for (let i = 0; i < enabledNodes.length; i += maxConcurrent) {
    const batch = enabledNodes.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(n => execOnNode(n.id, command, options))
    );
    results.push(...batchResults);
  }
  
  return {
    status: 'ok',
    command,
    executedAt: new Date().toISOString(),
    nodeCount: enabledNodes.length,
    results
  };
}

/**
 * 获取所有节点状态
 */
async function status() {
  const config = loadConfig();
  const results = [];
  
  for (const node of config.nodes) {
    if (!node.enabled) {
      results.push({
        id: node.id,
        name: node.name,
        host: node.host,
        status: 'disabled'
      });
      continue;
    }
    
    const testResult = await testNode(node.id);
    results.push({
      id: node.id,
      name: node.name,
      host: node.host,
      status: testResult.status === 'ok' ? 'online' : 'offline',
      info: testResult.output || testResult.message
    });
  }
  
  return {
    status: 'ok',
    checkedAt: new Date().toISOString(),
    nodes: results
  };
}

/**
 * 传输文件到节点（使用 SCP）
 */
async function uploadFile(nodeId, localPath, remotePath) {
  const config = loadConfig();
  const node = config.nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return { status: 'error', message: 'Node not found' };
  }
  
  // 先安装 scp 模块
  await new Promise(resolve => exec('pip install scp -q', resolve));
  
  // 使用临时文件方式
  const tmpFile = path.join(require('os').tmpdir(), `iflow_scp_${Date.now()}.py`);
  const script = `
import paramiko
import json
from scp import SCPClient

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('${node.host}', port=${node.port}, username='${node.username}', password='${node.password}', timeout=15)
    
    with SCPClient(ssh.get_transport()) as scp:
        scp.put(r'${localPath.replace(/\\/g, '\\\\')}', '${remotePath}')
    
    ssh.close()
    print(json.dumps({'status': 'ok', 'localPath': r'${localPath}', 'remotePath': '${remotePath}'}))
except Exception as e:
    print(json.dumps({'status': 'error', 'message': str(e)}))
`;

  return new Promise((resolve) => {
    fs.writeFileSync(tmpFile, script);
    
    exec(`python "${tmpFile}"`, { timeout: 60000 }, (error, stdout, stderr) => {
      // 清理临时文件
      try { fs.unlinkSync(tmpFile); } catch (e) {}
      
      if (error) {
        resolve({ status: 'error', message: error.message });
        return;
      }
      
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (e) {
        resolve({ status: 'error', message: 'Parse error', raw: stdout });
      }
    });
  });
}

/**
 * 从节点下载文件（使用 SCP）
 */
async function downloadFile(nodeId, remotePath, localPath) {
  const config = loadConfig();
  const node = config.nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return { status: 'error', message: 'Node not found' };
  }
  
  // 先安装 scp 模块
  await new Promise(resolve => exec('pip install scp -q', resolve));
  
  // 使用临时文件方式
  const tmpFile = path.join(require('os').tmpdir(), `iflow_scp_${Date.now()}.py`);
  const script = `
import paramiko
import json
from scp import SCPClient

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('${node.host}', port=${node.port}, username='${node.username}', password='${node.password}', timeout=15)
    
    with SCPClient(ssh.get_transport()) as scp:
        scp.get('${remotePath}', r'${localPath.replace(/\\/g, '\\\\')}')
    
    ssh.close()
    print(json.dumps({'status': 'ok', 'remotePath': '${remotePath}', 'localPath': r'${localPath}'}))
except Exception as e:
    print(json.dumps({'status': 'error', 'message': str(e)}))
`;

  return new Promise((resolve) => {
    fs.writeFileSync(tmpFile, script);
    
    exec(`python "${tmpFile}"`, { timeout: 60000 }, (error, stdout, stderr) => {
      // 清理临时文件
      try { fs.unlinkSync(tmpFile); } catch (e) {}
      
      if (error) {
        resolve({ status: 'error', message: error.message });
        return;
      }
      
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (e) {
        resolve({ status: 'error', message: 'Parse error', raw: stdout });
      }
    });
  });
}

/**
 * 让节点读取 Windows 文件（通过 HTTP）
 * @param {string} nodeId - 节点ID
 * @param {string} filePath - Windows .iflow 目录下的相对路径
 */
async function readWindowsFile(nodeId, filePath) {
  const config = loadConfig();
  const node = config.nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return { status: 'error', message: 'Node not found' };
  }
  
  // Windows 本机 IP
  const windowsHost = getLocalIP();
  const url = `http://${windowsHost}:8765/${filePath}`;
  
  const result = await execOnNode(nodeId, `curl -s "${url}"`);
  return result;
}

/**
 * 让节点写入 Windows 文件（通过 HTTP）
 * @param {string} nodeId - 节点ID
 * @param {string} filePath - Windows .iflow 目录下的相对路径
 * @param {string} content - 文件内容
 */
async function writeWindowsFile(nodeId, filePath, content) {
  const config = loadConfig();
  const node = config.nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return { status: 'error', message: 'Node not found' };
  }
  
  // Windows 本机 IP
  const windowsHost = getLocalIP();
  const url = `http://${windowsHost}:8765/${filePath}`;
  
  // 写入临时文件然后用 curl 上传
  const tmpFile = `/tmp/iflow_write_${Date.now()}.tmp`;
  
  // 先写入内容到节点临时文件
  const escapedContent = content.replace(/'/g, "'\"'\"'");
  const writeCmd = `cat > ${tmpFile} << 'IFLOW_EOF'\n${content}\nIFLOW_EOF`;
  await execOnNode(nodeId, writeCmd);
  
  // 然后上传到 Windows
  const result = await execOnNode(nodeId, `curl -X PUT --data-binary @${tmpFile} "${url}"`);
  
  // 清理临时文件
  await execOnNode(nodeId, `rm -f ${tmpFile}`);
  
  return result;
}

/**
 * 让节点列出 Windows 文件（通过 HTTP）
 * @param {string} nodeId - 节点ID
 * @param {string} dirPath - Windows .iflow 目录下的相对路径
 */
async function listWindowsFiles(nodeId, dirPath = '') {
  const config = loadConfig();
  const node = config.nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return { status: 'error', message: 'Node not found' };
  }
  
  // Windows 本机 IP
  const windowsHost = getLocalIP();
  const url = `http://${windowsHost}:8765/${dirPath}/?list=1`;
  
  const result = await execOnNode(nodeId, `curl -s "${url}"`);
  
  try {
    return { ...result, files: JSON.parse(result.stdout) };
  } catch (e) {
    return result;
  }
}

/**
 * 获取本机IP地址
 */
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // 优先返回 192.168.100.x 网段
        if (iface.address.startsWith('192.168.100.')) {
          return iface.address;
        }
      }
    }
  }
  
  // 返回第一个非内网IP
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return '127.0.0.1';
}

module.exports = {
  loadConfig,
  saveConfig,
  addNode,
  removeNode,
  listNodes,
  testNode,
  execOnNode,
  broadcast,
  status,
  uploadFile,
  downloadFile,
  readWindowsFile,
  writeWindowsFile,
  listWindowsFiles,
  getLocalIP,
  // 新增性能相关函数
  detectNodeSpecs,
  updateNodeSpecs,
  selectBestNode,
  dispatchTask,
  getResourceOverview,
  // 常量导出
  TASK_TIERS
};
