/**
 * iFlow Markdown Module
 * 整合自 OpenClaw 项目的 Markdown 处理功能
 * 解析、生成和渲染 Markdown
 */

// ==================== Frontmatter 解析 ====================

/**
 * 解析 Frontmatter
 * @param {string} content - Markdown 内容
 * @returns {Object} { frontmatter: Object, content: string }
 */
function parseFrontmatter(content) {
  if (!content || typeof content !== 'string') {
    return { frontmatter: {}, content };
  }

  // 检查是否以 --- 开头
  if (!content.startsWith('---')) {
    return { frontmatter: {}, content };
  }

  // 查找结束的 ---
  const endIndex = content.indexOf('\n---\n', 3);
  if (endIndex === -1) {
    return { frontmatter: {}, content };
  }

  const frontmatterText = content.slice(3, endIndex);
  const markdownText = content.slice(endIndex + 5);

  // 解析 YAML
  const frontmatter = parseYaml(frontmatterText);

  return { frontmatter, content: markdownText };
}

/**
 * 简单的 YAML 解析器
 */
function parseYaml(text) {
  const result = {};
  const lines = text.split('\n');

  let currentKey = null;
  let isArray = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // 跳过注释和空行
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // 检查是否是数组项
    if (trimmed.startsWith('- ')) {
      if (!currentKey) {
        continue;
      }

      if (!result[currentKey]) {
        result[currentKey] = [];
        isArray = true;
      }

      result[currentKey].push(trimmed.slice(2).trim());
      continue;
    }

    // 检查是否是键值对
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();

    currentKey = key;
    isArray = false;

    // 解析值
    if (value.startsWith('"') && value.endsWith('"')) {
      result[key] = value.slice(1, -1);
    } else if (value === 'true') {
      result[key] = true;
    } else if (value === 'false') {
      result[key] = false;
    } else if (!isNaN(Number(value))) {
      result[key] = Number(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * 生成 Frontmatter
 */
function generateFrontmatter(frontmatter) {
  if (!frontmatter || typeof frontmatter !== 'object') {
    return '';
  }

  const lines = ['---'];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        lines.push(`${key}:`);
        lines.push(`  - ${item}`);
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: "${value}"`);
    }
  }

  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

// ==================== Markdown 渲染 ====================

/**
 * 渲染 Markdown 为 HTML
 * @param {string} markdown - Markdown 文本
 * @returns {string} HTML
 */
function renderToHtml(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  let html = markdown;

  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 粗体和斜体
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]+?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // 引用
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // 无序列表
  html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\n<ul>/g, '');

  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<ol><li>$1</li></ol>');
  html = html.replace(/<\/ol>\n<ol>/g, '');

  // 水平线
  html = html.replace(/^---$/gm, '<hr>');

  // 换行
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p><(h[1-6]|ul|ol|pre|blockquote|hr)/g, '<$1');
  html = html.replace(/<\/(h[1-6]|ul|ol|pre|blockquote|hr)><\/p>/g, '</$1>');

  return html;
}

/**
 * 渲染 Markdown 为纯文本
 * @param {string} markdown - Markdown 文本
 * @returns {string} 纯文本
 */
function renderToPlainText(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  let text = markdown;

  // 移除 Frontmatter
  text = text.replace(/^---[\s\S]*?---\n/, '');

  // 标题
  text = text.replace(/^### (.+)$/gm, '$1');
  text = text.replace(/^## (.+)$/gm, '$1');
  text = text.replace(/^# (.+)$/gm, '$1');

  // 粗体和斜体
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/\*(.+?)\*/g, '$1');

  // 代码块
  text = text.replace(/```\w*\n([\s\S]+?)```/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');

  // 链接
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 图片
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '[$1]');

  // 引用
  text = text.replace(/^> (.+)$/gm, '$1');

  // 列表
  text = text.replace(/^[\*\-] (.+)$/gm, '$1');
  text = text.replace(/^\d+\. (.+)$/gm, '$1');

  // 水平线
  text = text.replace(/^---$/gm, '');

  // 多个空行合并为一个
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

// ==================== Markdown 生成 ====================

/**
 * 生成 Markdown
 * @param {Object} data - 数据对象
 * @param {Object} options - 选项
 * @returns {string} Markdown 文本
 */
function generateMarkdown(data, options = {}) {
  if (!data || typeof data !== 'object') {
    return '';
  }

  const { frontmatter, ...content } = data;
  let markdown = '';

  // 添加 Frontmatter
  if (frontmatter && typeof frontmatter === 'object') {
    markdown += generateFrontmatter(frontmatter);
  }

  // 处理内容
  for (const [key, value] of Object.entries(content)) {
    const title = key.replace(/([A-Z])/g, ' $1').trim();
    markdown += `## ${title}\n\n`;

    if (Array.isArray(value)) {
      for (const item of value) {
        markdown += `- ${item}\n`;
      }
      markdown += '\n';
    } else if (typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value)) {
        markdown += `- **${subKey}**: ${subValue}\n`;
      }
      markdown += '\n';
    } else {
      markdown += `${value}\n\n`;
    }
  }

  return markdown;
}

// ==================== Markdown 工具函数 ====================

/**
 * 提取标题
 */
function extractHeaders(markdown) {
  const headers = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      headers.push({ level, text });
    }
  }

  return headers;
}

/**
 * 提取链接
 */
function extractLinks(markdown) {
  const links = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    links.push({
      text: match[1],
      url: match[2]
    });
  }

  return links;
}

/**
 * 提取代码块
 */
function extractCodeBlocks(markdown) {
  const codeBlocks = [];
  const regex = /```(\w*)\n([\s\S]+?)```/g;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2].trim()
    });
  }

  return codeBlocks;
}

/**
 * 验证 Markdown 语法
 */
function validateMarkdown(markdown) {
  const errors = [];
  const lines = markdown.split('\n');
  let codeBlockDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检查代码块是否闭合
    if (line.startsWith('```')) {
      codeBlockDepth++;
      if (codeBlockDepth > 1) {
        errors.push({ line: i + 1, message: 'Nested code block detected' });
      }
    }

    // 检查未闭合的链接
    const openBrackets = (line.match(/\[/g) || []).length;
    const closeBrackets = (line.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push({ line: i + 1, message: 'Unclosed link bracket' });
    }
  }

  // 检查未闭合的代码块
  if (codeBlockDepth % 2 !== 0) {
    errors.push({ line: lines.length, message: 'Unclosed code block' });
  }

  return { valid: errors.length === 0, errors };
}

// ==================== 导出 ====================

module.exports = {
  // Frontmatter
  parseFrontmatter,
  generateFrontmatter,

  // 渲染
  renderToHtml,
  renderToPlainText,

  // 生成
  generateMarkdown,

  // 工具
  extractHeaders,
  extractLinks,
  extractCodeBlocks,
  validateMarkdown
};