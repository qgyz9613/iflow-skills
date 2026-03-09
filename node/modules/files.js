/**
 * iFlow Files Module
 * 文件扫描、读取、搜索
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 文件扫描
function scan(dir, pattern = '**/*', options = {}) {
  const start = Date.now();
  try {
    const files = glob.sync(pattern, {
      cwd: dir,
      absolute: true,
      ignore: options.ignore || ['**/node_modules/**', '**/.git/**'],
      nodir: true
    });
    
    let totalSize = 0;
    const results = files.slice(0, options.limit || 1000).map(f => {
      try {
        const stat = fs.statSync(f);
        totalSize += stat.size;
        return { path: f, size: stat.size, modified: stat.mtime };
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    return { 
      status: 'ok', 
      files: results, 
      total: files.length, 
      totalSize,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 读取文件
function read(filePath, options = {}) {
  const start = Date.now();
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (options.limit) {
      const lines = content.split('\n');
      const limited = lines.slice(options.offset || 0, options.offset + options.limit).join('\n');
      return { status: 'ok', content: limited, lines: lines.length, time: Date.now() - start };
    }
    
    return { status: 'ok', content, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 写入文件
function write(filePath, content) {
  const start = Date.now();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return { status: 'ok', path: filePath, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 目录树
function tree(dir, maxDepth = 3) {
  const start = Date.now();
  
  function buildTree(p, depth) {
    if (depth > maxDepth) return null;
    
    try {
      const stats = fs.statSync(p);
      if (stats.isFile()) {
        return { name: path.basename(p), type: 'file', size: stats.size };
      }
      
      const items = fs.readdirSync(p);
      const children = items.slice(0, 50).map(item => buildTree(path.join(p, item), depth + 1)).filter(Boolean);
      
      return { name: path.basename(p), type: 'dir', children };
    } catch {
      return null;
    }
  }
  
  try {
    const result = buildTree(dir, 0);
    return { status: 'ok', tree: result, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 搜索文件内容
function search(dir, pattern, filePattern = '*') {
  const start = Date.now();
  try {
    const files = glob.sync(`**/${filePattern}`, { cwd: dir, nodir: true });
    const results = [];
    const regex = new RegExp(pattern, 'gi');
    
    for (const file of files.slice(0, 100)) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, i) => {
          if (regex.test(line)) {
            results.push({ file, line: i + 1, text: line.trim().slice(0, 200) });
          }
        });
        
        if (results.length >= 50) break;
      } catch {}
    }
    
    return { status: 'ok', results, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 复制文件
function copy(src, dest) {
  const start = Date.now();
  try {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
    return { status: 'ok', src, dest, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 删除文件
function remove(filePath) {
  const start = Date.now();
  try {
    fs.unlinkSync(filePath);
    return { status: 'ok', path: filePath, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

module.exports = { scan, read, write, tree, search, copy, remove };
