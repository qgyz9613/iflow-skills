/**
 * iFlow Plugin Tools Module
 * 整合自 OpenClaw 的 plugin-sdk
 * 提供插件开发工具：键控队列、持久化去重、文本分块、运行时存储等
 */

const fs = require('fs').promises;
const path = require('path');

// ==================== 键控异步队列 ====================

/**
 * 键控异步队列管理器
 * 确保相同键的任务按顺序执行
 */
class KeyedAsyncQueue {
  constructor() {
    this.tails = new Map();
  }

  /**
   * 入队任务
   * @param {string} key - 任务键
   * @param {Function} task - 任务函数
   * @param {Object} hooks - 钩子
   * @returns {Promise}
   */
  async enqueue(key, task, hooks = {}) {
    hooks.onEnqueue?.();

    const previous = this.tails.get(key) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(task)
      .finally(() => {
        hooks.onSettle?.();
      });

    const tail = current.then(
      () => undefined,
      () => undefined
    );

    this.tails.set(key, tail);

    tail.finally(() => {
      if (this.tails.get(key) === tail) {
        this.tails.delete(key);
      }
    });

    return current;
  }

  /**
   * 获取队列状态
   * @returns {Object} 队列状态
   */
  getStatus() {
    const status = {};
    for (const [key, tail] of this.tails.entries()) {
      status[key] = {
        pending: true
      };
    }
    return status;
  }

  /**
   * 清空队列
   */
  clear() {
    this.tails.clear();
  }

  /**
   * 获取队列大小
   * @returns {number} 队列大小
   */
  size() {
    return this.tails.size;
  }
}

// ==================== 持久化去重 ====================

/**
 * 持久化去重器
 * 支持内存和文件持久化
 */
class PersistentDeduper {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || 60000; // 默认 1 分钟
    this.memoryMaxSize = options.memoryMaxSize || 1000;
    this.fileMaxEntries = options.fileMaxEntries || 10000;
    this.resolveFilePath = options.resolveFilePath || ((ns) => path.join(process.cwd(), `.dedupe-${ns}.json`));
    this.memoryCache = new Map();
    this.fileData = new Map();
  }

  /**
   * 检查并记录
   * @param {string} key - 去重键
   * @param {Object} options - 选项
   * @returns {Promise<boolean>} 是否首次处理
   */
  async checkAndRecord(key, options = {}) {
    const { namespace = 'default', now = Date.now() } = options;
    const nowTs = now || Date.now();

    // 检查内存缓存
    const memoryTs = this.memoryCache.get(key);
    if (memoryTs && (nowTs - memoryTs) < this.ttlMs) {
      return false;
    }

    // 检查文件数据
    await this.loadFileData(namespace);
    const fileTs = this.fileData.get(key);
    if (fileTs && (nowTs - fileTs) < this.ttlMs) {
      return false;
    }

    // 记录
    this.memoryCache.set(key, nowTs);
    this.fileData.set(key, nowTs);

    // 更新内存缓存大小
    if (this.memoryCache.size > this.memoryMaxSize) {
      this.pruneMemoryCache(nowTs);
    }

    // 异步保存到文件
    this.saveFileData(namespace).catch(err => {
      options.onDiskError?.(err);
    });

    return true;
  }

  /**
   * 加载文件数据
   * @param {string} namespace - 命名空间
   */
  async loadFileData(namespace) {
    if (this.fileData.size > 0) {
      return;
    }

    try {
      const filePath = this.resolveFilePath(namespace);
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);

      this.fileData = new Map();
      for (const [key, ts] of Object.entries(data)) {
        if (typeof ts === 'number' && ts > 0) {
          this.fileData.set(key, ts);
        }
      }
    } catch (err) {
      // 文件不存在或读取失败，忽略
    }
  }

  /**
   * 保存文件数据
   * @param {string} namespace - 命名空间
   */
  async saveFileData(namespace) {
    const filePath = this.resolveFilePath(namespace);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });

    // 清理过期数据
    const now = Date.now();
    this.pruneFileData(now);

    // 限制条目数
    const entries = Array.from(this.fileData.entries());
    if (entries.length > this.fileMaxEntries) {
      entries.sort((a, b) => a[1] - b[1]);
      entries.splice(0, entries.length - this.fileMaxEntries);
      this.fileData = new Map(entries);
    }

    const data = Object.fromEntries(this.fileData);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * 清理内存缓存
   * @param {number} now - 当前时间戳
   */
  pruneMemoryCache(now) {
    for (const [key, ts] of this.memoryCache.entries()) {
      if (now - ts >= this.ttlMs) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * 清理文件数据
   * @param {number} now - 当前时间戳
   */
  pruneFileData(now) {
    for (const [key, ts] of this.fileData.entries()) {
      if (now - ts >= this.ttlMs) {
        this.fileData.delete(key);
      }
    }
  }

  /**
   * 清空内存缓存
   */
  clearMemory() {
    this.memoryCache.clear();
  }

  /**
   * 获取内存缓存大小
   * @returns {number} 缓存大小
   */
  memorySize() {
    return this.memoryCache.size;
  }

  /**
   * 预热（加载文件数据）
   * @param {string} namespace - 命名空间
   */
  async warmup(namespace) {
    await this.loadFileData(namespace);
    return this.fileData.size;
  }
}

// ==================== 文本分块 ====================

/**
 * 文本分块器
 * 智能分割长文本
 */
class TextChunker {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 4000;
    this.chunkOverlap = options.chunkOverlap || 200;
  }

  /**
   * 分块文本
   * @param {string} text - 要分块的文本
   * @returns {string[]} 分块结果
   */
  chunk(text) {
    if (!text || text.length <= this.chunkSize) {
      return [text];
    }

    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = start + this.chunkSize;

      // 优先在换行符处分割
      if (end < text.length) {
        const lastNewline = text.lastIndexOf('\n', end);
        if (lastNewline > start) {
          end = lastNewline + 1;
        } else {
          // 其次在空格处分割
          const lastSpace = text.lastIndexOf(' ', end);
          if (lastSpace > start) {
            end = lastSpace + 1;
          }
        }
      }

      chunks.push(text.slice(start, end).trim());
      start = end - this.chunkOverlap;
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * 按句子分块
   * @param {string} text - 要分块的文本
   * @returns {string[]} 分块结果
   */
  chunkBySentence(text) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 按段落分块
   * @param {string} text - 要分块的文本
   * @returns {string[]} 分块结果
   */
  chunkByParagraph(text) {
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > this.chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

// ==================== 运行时存储 ====================

/**
 * 运行时存储管理器
 * 进程内存中的临时存储
 */
class RuntimeStore {
  constructor() {
    this.stores = new Map();
  }

  /**
   * 获取存储
   * @param {string} namespace - 命名空间
   * @returns {Map} 存储对象
   */
  getStore(namespace = 'default') {
    if (!this.stores.has(namespace)) {
      this.stores.set(namespace, new Map());
    }
    return this.stores.get(namespace);
  }

  /**
   * 设置值
   * @param {string} key - 键
   * @param {*} value - 值
   * @param {string} namespace - 命名空间
   */
  set(key, value, namespace = 'default') {
    const store = this.getStore(namespace);
    store.set(key, value);
  }

  /**
   * 获取值
   * @param {string} key - 键
   * @param {string} namespace - 命名空间
   * @returns {*} 值
   */
  get(key, namespace = 'default') {
    const store = this.getStore(namespace);
    return store.get(key);
  }

  /**
   * 删除值
   * @param {string} key - 键
   * @param {string} namespace - 命名空间
   */
  delete(key, namespace = 'default') {
    const store = this.getStore(namespace);
    return store.delete(key);
  }

  /**
   * 检查键是否存在
   * @param {string} key - 键
   * @param {string} namespace - 命名空间
   * @returns {boolean} 是否存在
   */
  has(key, namespace = 'default') {
    const store = this.getStore(namespace);
    return store.has(key);
  }

  /**
   * 清空存储
   * @param {string} namespace - 命名空间
   */
  clear(namespace = 'default') {
    const store = this.getStore(namespace);
    store.clear();
  }

  /**
   * 清空所有存储
   */
  clearAll() {
    this.stores.clear();
  }

  /**
   * 获取所有键
   * @param {string} namespace - 命名空间
   * @returns {string[]} 键列表
   */
  keys(namespace = 'default') {
    const store = this.getStore(namespace);
    return Array.from(store.keys());
  }

  /**
   * 获取所有值
   * @param {string} namespace - 命名空间
   * @returns {Array} 值列表
   */
  values(namespace = 'default') {
    const store = this.getStore(namespace);
    return Array.from(store.values());
  }

  /**
   * 获取所有键值对
   * @param {string} namespace - 命名空间
   * @returns {Array} 键值对列表
   */
  entries(namespace = 'default') {
    const store = this.getStore(namespace);
    return Array.from(store.entries());
  }

  /**
   * 获取存储大小
   * @param {string} namespace - 命名空间
   * @returns {number} 存储大小
   */
  size(namespace = 'default') {
    const store = this.getStore(namespace);
    return store.size;
  }
}

// ==================== SSRF 防护 ====================

/**
 * SSRF 防护器
 * 防止服务器端请求伪造
 */
class SSRFProtection {
  constructor(options = {}) {
    this.blockedHosts = new Set(options.blockedHosts || [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.169.254' // AWS 元数据
    ]);
    this.blockedIPRanges = options.blockedIPRanges || [
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
      '127.0.0.0/8',
      '0.0.0.0/8'
    ];
    this.allowedSchemes = new Set(options.allowedSchemes || ['http', 'https']);
  }

  /**
   * 检查 URL 是否被阻止
   * @param {string} url - URL
   * @returns {boolean} 是否被阻止
   */
  isBlocked(url) {
    try {
      const parsed = new URL(url);

      // 检查协议
      if (!this.allowedSchemes.has(parsed.protocol.replace(':', ''))) {
        return true;
      }

      // 检查主机名
      const hostname = parsed.hostname.toLowerCase();
      if (this.blockedHosts.has(hostname)) {
        return true;
      }

      // 检查 IP 范围
      const ip = this.resolveIP(hostname);
      if (ip && this.isBlockedIP(ip)) {
        return true;
      }

      return false;
    } catch {
      return true; // 无效 URL，默认阻止
    }
  }

  /**
   * 解析 IP 地址
   * @param {string} hostname - 主机名
   * @returns {string|null} IP 地址
   */
  resolveIP(hostname) {
    // 简化版本，实际应该使用 DNS 解析
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return hostname;
    }
    return null;
  }

  /**
   * 检查 IP 是否在阻止范围内
   * @param {string} ip - IP 地址
   * @returns {boolean} 是否被阻止
   */
  isBlockedIP(ip) {
    const ipNum = this.ipToNumber(ip);

    for (const range of this.blockedIPRanges) {
      if (this.isIPInRange(ipNum, range)) {
        return true;
      }
    }

    return false;
  }

  /**
   * IP 转数字
   * @param {string} ip - IP 地址
   * @returns {number} 数字表示
   */
  ipToNumber(ip) {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }

  /**
   * 检查 IP 是否在范围内
   * @param {number} ipNum - IP 数字
   * @param {string} range - IP 范围
   * @returns {boolean} 是否在范围内
   */
  isIPInRange(ipNum, range) {
    const [base, mask] = range.split('/');
    const baseNum = this.ipToNumber(base);
    const maskBits = parseInt(mask, 10) || 32;
    const maskNum = -1 << (32 - maskBits);

    return (ipNum & maskNum) === (baseNum & maskNum);
  }

  /**
   * 添加阻止的主机
   * @param {string} host - 主机名
   */
  addBlockedHost(host) {
    this.blockedHosts.add(host.toLowerCase());
  }

  /**
   * 移除阻止的主机
   * @param {string} host - 主机名
   */
  removeBlockedHost(host) {
    this.blockedHosts.delete(host.toLowerCase());
  }

  /**
   * 添加允许的协议
   * @param {string} scheme - 协议
   */
  addAllowedScheme(scheme) {
    this.allowedSchemes.add(scheme.toLowerCase());
  }
}

// ==================== 全局实例 ====================

const keyedAsyncQueue = new KeyedAsyncQueue();
const persistentDeduper = new PersistentDeduper();
const textChunker = new TextChunker();
const runtimeStore = new RuntimeStore();
const ssrfProtection = new SSRFProtection();

// ==================== 工厂函数（供 MCP 调用）====================

/**
 * 创建键控异步队列实例
 */
function createKeyedAsyncQueue(options = {}) {
  return new KeyedAsyncQueue(options);
}

/**
 * 创建持久化去重器实例
 */
function createPersistentDeduper(options = {}) {
  return new PersistentDeduper(options);
}

/**
 * 创建文本分块器实例
 */
function createTextChunker(options = {}) {
  return new TextChunker(options);
}

/**
 * 创建运行时存储实例
 */
function createRuntimeStore(options = {}) {
  return new RuntimeStore(options);
}

/**
 * 创建 SSRF 防护实例
 */
function createSSRFProtection(options = {}) {
  return new SSRFProtection(options);
}

// ==================== 导出 ====================

module.exports = {
  // 键控异步队列
  KeyedAsyncQueue,
  keyedAsyncQueue,
  createKeyedAsyncQueue,

  // 持久化去重
  PersistentDeduper,
  persistentDeduper,
  createPersistentDeduper,

  // 文本分块
  TextChunker,
  textChunker,
  createTextChunker,

  // 运行时存储
  RuntimeStore,
  runtimeStore,
  createRuntimeStore,

  // SSRF 防护
  SSRFProtection,
  ssrfProtection,
  createSSRFProtection
};