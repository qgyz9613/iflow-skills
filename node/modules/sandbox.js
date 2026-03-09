/**
 * iFlow Sandbox Module
 * 沙箱执行环境
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const SANDBOX_DIR = path.join(__dirname, '..', 'sandbox-data');
if (!fs.existsSync(SANDBOX_DIR)) fs.mkdirSync(SANDBOX_DIR, { recursive: true });

// 执行代码
function execute(code, options = {}) {
  const start = Date.now();
  try {
    const sandboxId = uuidv4();
    const sandboxPath = path.join(SANDBOX_DIR, sandboxId);
    fs.mkdirSync(sandboxPath, { recursive: true });
    
    // 根据语言保存文件
    const lang = options.language || 'javascript';
    const extensions = {
      javascript: 'js',
      python: 'py',
      typescript: 'ts',
      bash: 'sh'
    };
    
    const ext = extensions[lang] || 'txt';
    const filePath = path.join(sandboxPath, `main.${ext}`);
    fs.writeFileSync(filePath, code, 'utf8');
    
    return { 
      status: 'ok', 
      sandboxId, 
      path: sandboxPath,
      file: filePath,
      language: lang,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 执行 Shell 命令
function shell(command, options = {}) {
  const start = Date.now();
  
  return new Promise((resolve) => {
    const timeout = options.timeout || 30000;
    
    exec(command, { 
      cwd: options.cwd || SANDBOX_DIR,
      timeout 
    }, (error, stdout, stderr) => {
      const result = {
        status: error ? 'error' : 'ok',
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: error ? error.code : 0,
        time: Date.now() - start
      };
      
      if (options.callback) {
        options.callback(result);
      }
      
      resolve(result);
    });
  });
}

// 运行脚本
function runScript(scriptPath, args = []) {
  const start = Date.now();
  
  return new Promise((resolve) => {
    const ext = path.extname(scriptPath);
    let command;
    
    switch (ext) {
      case '.js':
        command = 'node';
        break;
      case '.py':
        command = 'python';
        break;
      case '.sh':
        command = 'bash';
        break;
      default:
        command = 'node';
    }
    
    const proc = spawn(command, [scriptPath, ...args], {
      cwd: SANDBOX_DIR,
      timeout: 60000
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', data => stdout += data);
    proc.stderr.on('data', data => stderr += data);
    
    proc.on('close', code => {
      resolve({
        status: code === 0 ? 'ok' : 'error',
        stdout,
        stderr,
        exitCode: code,
        time: Date.now() - start
      });
    });
    
    proc.on('error', err => {
      resolve({
        status: 'error',
        message: err.message,
        time: Date.now() - start
      });
    });
  });
}

// 创建隔离环境
function createIsolation(config = {}) {
  const start = Date.now();
  try {
    const isolateId = uuidv4();
    const isolatePath = path.join(SANDBOX_DIR, isolateId);
    
    fs.mkdirSync(isolatePath, { recursive: true });
    
    // 创建基本结构
    const structure = {
      id: isolateId,
      path: isolatePath,
      config,
      created_at: new Date().toISOString(),
      files: []
    };
    
    const metaPath = path.join(isolatePath, 'sandbox.json');
    fs.writeFileSync(metaPath, JSON.stringify(structure, null, 2));
    
    return { status: 'ok', sandbox: structure, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 清理沙箱
function cleanup(sandboxId) {
  const start = Date.now();
  try {
    const sandboxPath = path.join(SANDBOX_DIR, sandboxId);
    
    if (fs.existsSync(sandboxPath)) {
      fs.rmSync(sandboxPath, { recursive: true, force: true });
    }
    
    return { status: 'ok', sandboxId, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 列出沙箱
function listSandboxes() {
  const start = Date.now();
  try {
    const dirs = fs.readdirSync(SANDBOX_DIR);
    
    const sandboxes = dirs.map(d => {
      const metaPath = path.join(SANDBOX_DIR, d, 'sandbox.json');
      if (fs.existsSync(metaPath)) {
        try {
          return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch {
          return { id: d };
        }
      }
      return { id: d };
    });
    
    return { status: 'ok', sandboxes, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

module.exports = {
  execute,
  shell,
  runScript,
  createIsolation,
  cleanup,
  listSandboxes
};
