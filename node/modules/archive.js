/**
 * iFlow Archive Module
 * 归档系统 - 参考 OpenClaw archive
 */

const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const ARCHIVE_DIR = path.join(__dirname, '..', 'archive-data');
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

// 默认限制
const DEFAULT_LIMITS = {
  maxArchiveBytes: 256 * 1024 * 1024,  // 256MB
  maxEntries: 50000,
  maxExtractedBytes: 512 * 1024 * 1024,  // 512MB
  maxEntryBytes: 10 * 1024 * 1024  // 10MB
};

/**
 * 创建压缩归档
 */
async function createArchive(sourceDir, outputType = 'gzip') {
  const start = Date.now();
  
  try {
    if (!fs.existsSync(sourceDir)) {
      return { status: 'error', message: 'Source directory not found', time: Date.now() - start };
    }
    
    const sourceName = path.basename(sourceDir);
    const timestamp = new Date().toISOString().slice(0, 10);
    const outputPath = path.join(ARCHIVE_DIR, `${sourceName}-${timestamp}.gz`);
    
    // 使用 gzip 压缩
    const gzip = zlib.createGzip();
    const inp = fs.createReadStream(sourceDir);
    const out = fs.createWriteStream(outputPath);
    
    inp.pipe(gzip).pipe(out);
    
    return new Promise((resolve) => {
      out.on('finish', () => {
        const stats = fs.statSync(outputPath);
        resolve({
          status: 'ok',
          archivePath: outputPath,
          size: stats.size,
          time: Date.now() - start
        });
      });
      
      out.on('error', (err) => {
        resolve({ status: 'error', message: err.message, time: Date.now() - start });
      });
    });
    
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 解压归档
 */
async function extractArchive(archivePath, targetDir) {
  const start = Date.now();
  
  try {
    if (!fs.existsSync(archivePath)) {
      return { status: 'error', message: 'Archive not found', time: Date.now() - start };
    }
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // 使用 gunzip 解压
    const gunzip = zlib.createGunzip();
    const inp = fs.createReadStream(archivePath);
    const outPath = path.join(targetDir, path.basename(archivePath, '.gz'));
    const out = fs.createWriteStream(outPath);
    
    inp.pipe(gunzip).pipe(out);
    
    return new Promise((resolve) => {
      out.on('finish', () => {
        resolve({
          status: 'ok',
          outputPath: outPath,
          time: Date.now() - start
        });
      });
      
      out.on('error', (err) => {
        resolve({ status: 'error', message: err.message, time: Date.now() - start });
      });
    });
    
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 列出归档
 */
function listArchives() {
  const start = Date.now();
  
  try {
    const files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.gz'));
    
    const archives = files.map(f => {
      const filePath = path.join(ARCHIVE_DIR, f);
      const stats = fs.statSync(filePath);
      return {
        name: f,
        path: filePath,
        size: stats.size,
        created: stats.birthtime.toISOString(),
        sizeFormatted: formatBytes(stats.size)
      };
    }).sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return { status: 'ok', archives, total: archives.length, time: Date.now() - start };
    
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 删除归档
 */
function deleteArchive(archiveName) {
  const start = Date.now();
  
  try {
    const archivePath = path.join(ARCHIVE_DIR, archiveName);
    
    if (!fs.existsSync(archivePath)) {
      return { status: 'error', message: 'Archive not found', time: Date.now() - start };
    }
    
    fs.unlinkSync(archivePath);
    return { status: 'ok', archive: archiveName, time: Date.now() - start };
    
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

/**
 * 格式化字节大小
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

module.exports = {
  DEFAULT_LIMITS,
  createArchive,
  extractArchive,
  listArchives,
  deleteArchive,
  formatBytes
};