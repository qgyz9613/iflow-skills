/**
 * iFlow Media Module
 * 整合自 OpenClaw 项目的媒体文件处理功能
 * 图片、音频、视频、Base64 编解码
 */

const fs = require('fs').promises;
const path = require('path');

// ==================== MIME 类型 ====================

/**
 * 常见 MIME 类型映射
 */
const MIME_TYPES = {
  // 图片
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',

  // 音频
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',

  // 视频
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',

  // 文档
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.xml': 'application/xml',

  // 其他
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.tar': 'application/x-tar'
};

/**
 * 根据文件扩展名获取 MIME 类型
 */
function getMimeType(filePath) {
  if (typeof filePath !== 'string' || !filePath) {
    return 'application/octet-stream';
  }
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * 根据 MIME 类型获取文件扩展名
 */
function getExtensionFromMime(mimeType) {
  for (const [ext, mime] of Object.entries(MIME_TYPES)) {
    if (mime === mimeType) {
      return ext;
    }
  }
  return '';
}

// ==================== Base64 编解码 ====================

/**
 * 文件转 Base64
 */
async function fileToBase64(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const mimeType = getMimeType(filePath);
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    throw new Error(`Failed to convert file to base64: ${err.message}`);
  }
}

/**
 * Base64 转文件
 */
async function base64ToFile(base64String, outputPath) {
  try {
    // 移除 data URL 前缀
    const matches = base64String.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 string format');
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // 确保输出目录存在
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(outputPath, buffer);
    return outputPath;
  } catch (err) {
    throw new Error(`Failed to save base64 to file: ${err.message}`);
  }
}

/**
 * 检测 Base64 字符串的 MIME 类型
 */
function detectBase64Mime(base64String) {
  const match = base64String.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
  return match ? match[1] : null;
}

// ==================== 图片处理 ====================

/**
 * 获取图片信息
 */
async function getImageInfo(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const mimeType = getMimeType(filePath);
    const size = buffer.length;
    const stats = await fs.stat(filePath);

    // 简单的尺寸检测（仅支持部分格式）
    let width = 0;
    let height = 0;

    if (mimeType === 'image/png') {
      // PNG 简单解析
      if (buffer.length > 24) {
        width = buffer.readUInt32BE(16);
        height = buffer.readUInt32BE(20);
      }
    } else if (mimeType === 'image/jpeg') {
      // JPEG 需要更复杂的解析，这里跳过
      width = 0;
      height = 0;
    }

    return {
      width,
      height,
      size,
      mimeType,
      format: path.extname(filePath).slice(1)
    };
  } catch (err) {
    throw new Error(`Failed to get image info: ${err.message}`);
  }
}

/**
 * 验证图片格式
 */
function isValidImageFormat(format) {
  const validFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  return validFormats.includes(format.toLowerCase());
}

// ==================== 媒体文件处理 ====================

/**
 * 验证媒体文件
 */
async function validateMediaFile(filePath) {
  try {
    const stats = await fs.stat(filePath);
    const mimeType = getMimeType(filePath);
    const extension = path.extname(filePath).slice(1);

    return {
      valid: true,
      exists: true,
      size: stats.size,
      mimeType,
      extension,
      isImage: mimeType.startsWith('image/'),
      isAudio: mimeType.startsWith('audio/'),
      isVideo: mimeType.startsWith('video/')
    };
  } catch (err) {
    return {
      valid: false,
      exists: false,
      error: err.message
    };
  }
}

/**
 * 检查文件大小限制
 */
function checkFileSizeLimit(size, maxSize = 10 * 1024 * 1024) {
  return {
    withinLimit: size <= maxSize,
    size,
    maxSize,
    exceeded: size > maxSize
  };
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ==================== 媒体元数据 ====================

/**
 * 提取媒体元数据
 */
async function extractMediaMetadata(filePath) {
  const info = await validateMediaFile(filePath);

  if (!info.valid) {
    return info;
  }

  const stats = await fs.stat(filePath);

  return {
    ...info,
    fileName: path.basename(filePath),
    filePath,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
    accessedAt: stats.atime
  };
}

// ==================== 媒体存储路径 ====================

/**
 * 获取媒体存储路径
 */
function getMediaStoragePath(baseDir = '.iflow/media', category = 'uploads') {
  return path.join(process.env.HOME || process.env.USERPROFILE || '.', baseDir, category);
}

/**
 * 生成唯一文件名
 */
function generateUniqueFileName(originalName) {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${baseName}_${timestamp}_${random}${ext}`;
}

/**
 * 生成存储路径
 */
function generateStoragePath(originalName, options = {}) {
  const baseDir = options.baseDir || '.iflow/media';
  const category = options.category || 'uploads';
  const storageDir = getMediaStoragePath(baseDir, category);
  const uniqueName = generateUniqueFileName(originalName);
  return path.join(storageDir, uniqueName);
}

// ==================== 媒体操作 ====================

/**
 * 保存媒体文件
 */
async function saveMediaFile(sourcePath, options = {}) {
  try {
    const storagePath = options.outputPath || generateStoragePath(sourcePath, options);
    const storageDir = path.dirname(storagePath);

    // 确保目录存在
    await fs.mkdir(storageDir, { recursive: true });

    // 复制文件
    await fs.copyFile(sourcePath, storagePath);

    // 获取元数据
    const metadata = await extractMediaMetadata(storagePath);

    return {
      success: true,
      path: storagePath,
      metadata
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * 保存 Base64 媒体
 */
async function saveBase64Media(base64String, originalName, options = {}) {
  try {
    const storagePath = options.outputPath || generateStoragePath(originalName, options);
    const resultPath = await base64ToFile(base64String, storagePath);

    const metadata = await extractMediaMetadata(resultPath);

    return {
      success: true,
      path: resultPath,
      metadata
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * 删除媒体文件
 */
async function deleteMediaFile(filePath) {
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

// ==================== 导出 ====================

module.exports = {
  // MIME 类型
  getMimeType,
  getExtensionFromMime,

  // Base64
  fileToBase64,
  base64ToFile,
  detectBase64Mime,

  // 图片处理
  getImageInfo,
  isValidImageFormat,

  // 媒体文件
  validateMediaFile,
  checkFileSizeLimit,
  formatFileSize,

  // 元数据
  extractMediaMetadata,

  // 存储路径
  getMediaStoragePath,
  generateUniqueFileName,
  generateStoragePath,

  // 媒体操作
  saveMediaFile,
  saveBase64Media,
  deleteMediaFile
};