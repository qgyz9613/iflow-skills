/**
 * iFlow Link Extraction Module
 * 整合自 OpenClaw 项目的链接内容提取功能
 * 自动检测消息中的链接并抓取内容
 */

const { withTimeout } = require('./utils-base');
const { isPathTraversal, isDangerousPath } = require('./security-utils');

// ==================== 链接检测 ====================

/**
 * Markdown 链接正则表达式
 */
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi;

/**
 * 纯链接正则表达式
 */
const BARE_LINK_RE = /https?:\/\/[^\s<>]+/gi;

/**
 * 被阻止的主机名/IP（防止 SSRF 攻击）
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS metadata
  'metadata.google.internal' // GCP metadata
]);

/**
 * 内网 IP 段
 */
const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^fc00:/i, // IPv6 private
  /^fe80:/i  // IPv6 link-local
];

/**
 * 移除 Markdown 链接语法，只保留纯 URL
 * @param {string} message - 消息文本
 * @returns {string} 清理后的文本
 */
function stripMarkdownLinks(message) {
  return message.replace(MARKDOWN_LINK_RE, '$2');
}

/**
 * 检查主机名是否被阻止
 * @param {string} hostname - 主机名
 * @returns {boolean}
 */
function isBlockedHostname(hostname) {
  const lowerHostname = hostname.toLowerCase();
  
  // 检查明确阻止的主机名
  if (BLOCKED_HOSTNAMES.has(lowerHostname)) {
    return true;
  }

  // 检查内网 IP
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(lowerHostname)) {
      return true;
    }
  }

  return false;
}

/**
 * 检查 URL 是否允许访问
 * @param {string} url - URL 字符串
 * @returns {boolean}
 */
function isAllowedUrl(url) {
  try {
    const parsed = new URL(url);
    
    // 只允许 HTTP/HTTPS
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    // 检查主机名
    if (isBlockedHostname(parsed.hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * 从消息中提取链接
 * @param {string} message - 消息文本
 * @param {Object} options - 选项
 * @param {number} options.maxLinks - 最大链接数（默认：5）
 * @returns {Array<string>} 链接数组
 */
function extractLinksFromMessage(message, options = {}) {
  const source = message?.trim();
  if (!source) {
    return [];
  }

  const maxLinks = options.maxLinks || 5;
  const sanitized = stripMarkdownLinks(source);
  const seen = new Set();
  const results = [];

  // 匹配所有链接
  const matches = sanitized.matchAll(BARE_LINK_RE);

  for (const match of matches) {
    if (results.length >= maxLinks) {
      break;
    }

    const raw = match[0]?.trim();
    if (!raw) {
      continue;
    }

    // 去重
    if (seen.has(raw)) {
      continue;
    }

    // 安全检查
    if (!isAllowedUrl(raw)) {
      continue;
    }

    seen.add(raw);
    results.push(raw);
  }

  return results;
}

// ==================== 链接内容抓取 ====================

/**
 * 抓取链接内容
 * @param {string} url - 链接 URL
 * @param {Object} options - 选项
 * @param {number} options.timeoutMs - 超时时间（默认：10000）
 * @param {Object} options.headers - 请求头
 * @param {string} options.userAgent - User-Agent
 * @returns {Promise<Object>} 抓取结果
 */
async function fetchLinkContent(url, options = {}) {
  const timeoutMs = options.timeoutMs || 10000;
  const headers = options.headers || {};
  const userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  try {
    // 使用 withTimeout 超时控制
    return await withTimeout((async () => {
      const { default: fetch } = await import('node-fetch');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          ...headers
        },
        redirect: 'follow',
        maxRedirects: 5
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();

      // 提取标题
      const titleMatch = text.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // 提取描述
      const descMatch = text.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
      const description = descMatch ? descMatch[1].trim() : '';

      // 移除 HTML 标签获取正文
      const bodyText = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000); // 限制正文长度

      return {
        url,
        status: response.status,
        title,
        description,
        body: bodyText,
        contentType: response.headers.get('content-type') || '',
        contentLength: text.length
      };
    })(), timeoutMs);

  } catch (error) {
    return {
      url,
      status: 0,
      error: error.message,
      title: '',
      description: '',
      body: ''
    };
  }
}

/**
 * 批量抓取链接内容
 * @param {Array<string>} urls - 链接数组
 * @param {Object} options - 选项
 * @param {number} options.timeoutMs - 超时时间
 * @param {number} options.concurrency - 并发数（默认：3）
 * @returns {Promise<Array<Object>>} 抓取结果数组
 */
async function fetchMultipleLinks(urls, options = {}) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }

  const timeoutMs = options.timeoutMs || 10000;
  const concurrency = options.concurrency || 3;

  // 分批处理
  const batches = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    batches.push(urls.slice(i, i + concurrency));
  }

  const results = [];
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(url => fetchLinkContent(url, { timeoutMs, ...options }))
    );
    results.push(...batchResults);
  }

  return results;
}

// ==================== 链接内容分析 ====================

/**
 * 提取链接摘要
 * @param {Object} content - 抓取的内容
 * @param {number} maxLength - 最大长度（默认：500）
 * @returns {string} 摘要
 */
function extractLinkSummary(content, maxLength = 500) {
  if (!content || content.error) {
    return content?.error || 'Failed to fetch content';
  }

  let summary = '';

  if (content.title) {
    summary += `标题: ${content.title}\n\n`;
  }

  if (content.description) {
    summary += `描述: ${content.description}\n\n`;
  }

  if (content.body) {
    summary += `正文: ${content.body.slice(0, maxLength)}`;
    if (content.body.length > maxLength) {
      summary += '...';
    }
  }

  return summary.trim();
}

/**
 * 格式化链接内容为 Markdown
 * @param {Object} content - 抓取的内容
 * @returns {string} Markdown 格式的内容
 */
function formatLinkAsMarkdown(content) {
  if (!content) {
    return '';
  }

  let md = '';

  md += `# ${content.title || 'Untitled'}\n\n`;
  md += `**URL**: ${content.url}\n\n`;

  if (content.description) {
    md += `**描述**: ${content.description}\n\n`;
  }

  if (content.body) {
    md += `## 内容\n\n${content.body}\n`;
  }

  if (content.error) {
    md += `\n> 错误: ${content.error}\n`;
  }

  return md;
}

// ==================== 智能链接处理 ====================

/**
 * 从消息中提取并抓取链接内容
 * @param {string} message - 消息文本
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 处理结果
 */
async function processLinksInMessage(message, options = {}) {
  const links = extractLinksFromMessage(message, options);

  if (links.length === 0) {
    return {
      hasLinks: false,
      links: [],
      contents: []
    };
  }

  const contents = await fetchMultipleLinks(links, options);

  return {
    hasLinks: true,
    links,
    contents,
    summaries: contents.map(c => extractLinkSummary(c))
  };
}

// ==================== 导出 ====================

module.exports = {
  // 链接检测
  extractLinksFromMessage,
  stripMarkdownLinks,
  isAllowedUrl,
  isBlockedHostname,

  // 链接抓取
  fetchLinkContent,
  fetchMultipleLinks,

  // 内容分析
  extractLinkSummary,
  formatLinkAsMarkdown,

  // 智能处理
  processLinksInMessage
};