/**
 * iFlow Summarize Module
 * 内容摘要功能
 */

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CACHE_DIR = path.join(__dirname, '..', 'summarize-cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// HTTP 请求封装
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(options.headers || {})
      },
      timeout: options.timeout || 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    if (options.body) req.write(options.body);
    req.end();
  });
}

// 提取网页内容
function extractContent(html) {
  // 移除脚本和样式
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  
  // 提取标题
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  // 提取 meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const description = descMatch ? descMatch[1].trim() : '';
  
  // 提取正文 (简化版)
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 10000);
  
  return { title, description, text };
}

// 摘要 URL
async function summarizeUrl(url, options = {}) {
  const start = Date.now();
  try {
    const response = await fetch(url);
    
    if (response.status !== 200) {
      return { status: 'error', message: `HTTP ${response.status}`, time: Date.now() - start };
    }
    
    const content = extractContent(response.body);
    
    // 简化摘要逻辑 (实际应用中可调用 LLM API)
    const summary = {
      url,
      title: content.title,
      description: content.description,
      contentPreview: content.text.substring(0, options.maxLength || 2000),
      wordCount: content.text.split(/\s+/).length
    };
    
    return { status: 'ok', summary, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 摘要文件
async function summarizeFile(filePath, options = {}) {
  const start = Date.now();
  try {
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'File not found', time: Date.now() - start };
    }
    
    const ext = path.extname(filePath).toLowerCase();
    let content = '';
    
    if (['.txt', '.md', '.json', '.js', '.ts', '.py', '.html', '.css'].includes(ext)) {
      content = fs.readFileSync(filePath, 'utf8');
    } else {
      return { status: 'error', message: 'Unsupported file type', time: Date.now() - start };
    }
    
    const lines = content.split('\n');
    const summary = {
      path: filePath,
      ext,
      lineCount: lines.length,
      charCount: content.length,
      wordCount: content.split(/\s+/).filter(w => w).length,
      preview: content.substring(0, options.maxLength || 1000),
      firstLines: lines.slice(0, 10)
    };
    
    return { status: 'ok', summary, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// YouTube 摘要
async function summarizeYoutube(url, options = {}) {
  const start = Date.now();
  try {
    // 提取视频 ID
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (!videoIdMatch) {
      return { status: 'error', message: 'Invalid YouTube URL', time: Date.now() - start };
    }
    
    const videoId = videoIdMatch[1];
    
    // 获取视频信息 (通过 noembed)
    const infoUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(infoUrl);
    
    let info = {};
    try {
      info = JSON.parse(response.body);
    } catch (e) {
      // 忽略解析错误
    }
    
    const summary = {
      videoId,
      url,
      title: info.title || 'Unknown',
      authorName: info.author_name || 'Unknown',
      thumbnailUrl: info.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      note: 'Full transcript requires YouTube Data API or yt-dlp'
    };
    
    return { status: 'ok', summary, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 批量摘要
async function summarizeBatch(urls, options = {}) {
  const start = Date.now();
  const results = [];
  
  for (const url of urls) {
    try {
      const result = await summarizeUrl(url, options);
      results.push(result);
    } catch (e) {
      results.push({ status: 'error', url, message: e.message });
    }
  }
  
  return {
    status: 'ok',
    total: urls.length,
    successful: results.filter(r => r.status === 'ok').length,
    results,
    time: Date.now() - start
  };
}

// 提取关键词
function extractKeywords(text, maxKeywords = 10) {
  // 参数类型校验
  if (text === null || text === undefined) {
    return [];
  }
  if (typeof text !== 'string') {
    text = String(text);
  }
  
  // 简化版关键词提取
  const words = text.toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word, count]) => ({ word, count }));
}

module.exports = {
  summarizeUrl,
  summarizeFile,
  summarizeYoutube,
  summarizeBatch,
  extractKeywords,
  fetch
};