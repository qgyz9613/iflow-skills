/**
 * iFlow Clipboard Module
 * 剪贴板模块，整合自 OpenClaw 的剪贴板操作模块
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * 平台信息
 */
const PLATFORM = process.platform;
const IS_WINDOWS = PLATFORM === 'win32';
const IS_MAC = PLATFORM === 'darwin';
const IS_LINUX = PLATFORM === 'linux';

/**
 * 执行命令并获取结果
 * @param {string[]} command - 命令数组
 * @param {object} options - 选项
 * @returns {Promise<object>} 执行结果
 */
function executeCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const { timeout = 3000, input = null } = options;
    
    const child = spawn(command[0], command.slice(1), {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // 设置超时
    const timeoutId = setTimeout(() => {
      child.kill();
      resolve({ code: -1, killed: true, stdout, stderr });
    }, timeout);
    
    child.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({ code, killed: false, stdout, stderr });
    });
    
    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
    
    // 写入输入
    if (input !== null) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

/**
 * 复制文本到剪贴板（Windows）
 * @param {string} text - 文本
 * @returns {Promise<boolean>} 是否成功
 */
async function copyToClipboardWindows(text) {
  // 尝试 clip.exe（Windows 原生）
  try {
    const result = await executeCommand(['clip.exe'], { input: text });
    if (result.code === 0) {
      return true;
    }
  } catch {
    // 忽略错误
  }
  
  // 尝试 PowerShell
  try {
    const result = await executeCommand([
      'powershell',
      '-NoProfile',
      '-Command',
      'Set-Clipboard'
    ], { input: text });
    if (result.code === 0) {
      return true;
    }
  } catch {
    // 忽略错误
  }
  
  return false;
}

/**
 * 复制文本到剪贴板（macOS）
 * @param {string} text - 文本
 * @returns {Promise<boolean>} 是否成功
 */
async function copyToClipboardMac(text) {
  try {
    const result = await executeCommand(['pbcopy'], { input: text });
    return result.code === 0 && !result.killed;
  } catch {
    return false;
  }
}

/**
 * 复制文本到剪贴板（Linux）
 * @param {string} text - 文本
 * @returns {Promise<boolean>} 是否成功
 */
async function copyToClipboardLinux(text) {
  // 尝试 xclip
  try {
    const result = await executeCommand(['xclip', '-selection', 'clipboard'], { input: text });
    if (result.code === 0 && !result.killed) {
      return true;
    }
  } catch {
    // 忽略错误
  }
  
  // 尝试 wl-copy（Wayland）
  try {
    const result = await executeCommand(['wl-copy'], { input: text });
    if (result.code === 0 && !result.killed) {
      return true;
    }
  } catch {
    // 忽略错误
  }
  
  return false;
}

/**
 * 复制文本到剪贴板（跨平台）
 * @param {string} text - 文本
 * @returns {Promise<boolean>} 是否成功
 */
async function copyToClipboard(text) {
  if (typeof text !== 'string') {
    return false;
  }
  
  if (IS_WINDOWS) {
    return await copyToClipboardWindows(text);
  } else if (IS_MAC) {
    return await copyToClipboardMac(text);
  } else if (IS_LINUX) {
    return await copyToClipboardLinux(text);
  }
  
  return false;
}

/**
 * 从剪贴板读取文本（Windows）
 * @returns {Promise<string|null>} 剪贴板文本或 null
 */
async function readFromClipboardWindows() {
  try {
    const result = await executeCommand([
      'powershell',
      '-NoProfile',
      '-Command',
      'Get-Clipboard'
    ]);
    if (result.code === 0) {
      return result.stdout.trim();
    }
  } catch {
    // 忽略错误
  }
  return null;
}

/**
 * 从剪贴板读取文本（macOS）
 * @returns {Promise<string|null>} 剪贴板文本或 null
 */
async function readFromClipboardMac() {
  try {
    const result = await executeCommand(['pbpaste']);
    if (result.code === 0) {
      return result.stdout;
    }
  } catch {
    // 忽略错误
  }
  return null;
}

/**
 * 从剪贴板读取文本（Linux）
 * @returns {Promise<string|null>} 剪贴板文本或 null
 */
async function readFromClipboardLinux() {
  // 尝试 xclip
  try {
    const result = await executeCommand(['xclip', '-selection', 'clipboard', '-o']);
    if (result.code === 0) {
      return result.stdout;
    }
  } catch {
    // 忽略错误
  }
  
  // 尝试 wl-paste（Wayland）
  try {
    const result = await executeCommand(['wl-paste']);
    if (result.code === 0) {
      return result.stdout;
    }
  } catch {
    // 忽略错误
  }
  
  return null;
}

/**
 * 从剪贴板读取文本（跨平台）
 * @returns {Promise<string|null>} 剪贴板文本或 null
 */
async function readFromClipboard() {
  if (IS_WINDOWS) {
    return await readFromClipboardWindows();
  } else if (IS_MAC) {
    return await readFromClipboardMac();
  } else if (IS_LINUX) {
    return await readFromClipboardLinux();
  }
  
  return null;
}

/**
 * 清空剪贴板（跨平台）
 * @returns {Promise<boolean>} 是否成功
 */
async function clearClipboard() {
  return await copyToClipboard('');
}

/**
 * 检查剪贴板是否可用
 * @returns {Promise<boolean>} 是否可用
 */
async function isClipboardAvailable() {
  const testString = 'iFlow-clipboard-test';
  const success = await copyToClipboard(testString);
  if (!success) {
    return false;
  }
  
  const content = await readFromClipboard();
  return content === testString;
}

/**
 * 获取剪贴板历史（仅 Windows）
 * @param {number} count - 数量
 * @returns {Promise<string[]>} 剪贴板历史
 */
async function getClipboardHistory(count = 10) {
  if (!IS_WINDOWS) {
    return [];
  }
  
  try {
    const result = await executeCommand([
      'powershell',
      '-NoProfile',
      '-Command',
      `Get-Clipboard | Select-Object -First ${count}`
    ]);
    if (result.code === 0) {
      return result.stdout.trim().split('\n').filter(Boolean);
    }
  } catch {
    // 忽略错误
  }
  
  return [];
}

/**
 * 复制文件到剪贴板（仅 Windows）
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 是否成功
 */
async function copyFileToClipboard(filePath) {
  if (!IS_WINDOWS) {
    return false;
  }
  
  try {
    const absolutePath = path.resolve(filePath);
    const result = await executeCommand([
      'powershell',
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetFileDropList((New-Object System.Collections.Specialized.StringCollection)); [System.Windows.Forms.Clipboard]::SetFileDropList(([System.Windows.Forms.Clipboard]::GetFileDropList() | ForEach-Object { $_ })); [System.Windows.Forms.Clipboard]::SetFileDropList(([System.Collections.Specialized.StringCollection](('${absolutePath}' | ForEach-Object { $_ }))))`
    ]);
    return result.code === 0;
  } catch {
    return false;
  }
}

module.exports = {
  // 基本操作
  copyToClipboard,
  readFromClipboard,
  clearClipboard,
  
  // 检查和测试
  isClipboardAvailable,
  
  // 高级操作
  getClipboardHistory,
  copyFileToClipboard,
  
  // 平台信息
  PLATFORM,
  IS_WINDOWS,
  IS_MAC,
  IS_LINUX
};