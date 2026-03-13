/**
 * iFlow Frontmatter Module
 * Frontmatter 模块，整合自 OpenClaw 的 Markdown 元数据解析模块
 */

/**
 * 规范化字符串列表
 * @param {unknown} input - 输入值
 * @returns {string[]} 字符串数组
 */
function normalizeStringList(input) {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input.map(value => String(value).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input.split(',').map(value => value.trim()).filter(Boolean);
  }
  return [];
}

/**
 * 从 frontmatter 获取字符串
 * @param {object} frontmatter - frontmatter 对象
 * @param {string} key - 键
 * @returns {string|undefined} 字符串或 undefined
 */
function getFrontmatterString(frontmatter, key) {
  const raw = frontmatter[key];
  return typeof raw === 'string' ? raw : undefined;
}

/**
 * 解析布尔值
 * @param {string} value - 字符串值
 * @returns {boolean|undefined} 布尔值或 undefined
 */
function parseBooleanValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return undefined;
}

/**
 * 解析 frontmatter 布尔值
 * @param {string|undefined} value - 值
 * @param {boolean} fallback - 回退值
 * @returns {boolean} 布尔值
 */
function parseFrontmatterBool(value, fallback) {
  const parsed = parseBooleanValue(value);
  return parsed === undefined ? fallback : parsed;
}

/**
 * 从 Markdown 内容中提取 frontmatter
 * @param {string} content - Markdown 内容
 * @returns {object|null} frontmatter 对象或 null
 */
function extractFrontmatter(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }
  
  const lines = content.split('\n');
  
  // 检查是否以 --- 开头
  if (!lines[0].startsWith('---')) {
    return null;
  }
  
  const frontmatterLines = [];
  let endIndex = -1;
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith('---')) {
      endIndex = i;
      break;
    }
    frontmatterLines.push(lines[i]);
  }
  
  if (endIndex === -1) {
    return null;
  }
  
  const frontmatterString = frontmatterLines.join('\n');
  return parseYamlLike(frontmatterString);
}

/**
 * 解析 YAML 格式的字符串（简化版）
 * @param {string} content - YAML 内容
 * @returns {object} 解析后的对象
 */
function parseYamlLike(content) {
  // 参数验证
  if (typeof content !== 'string') {
    return {};
  }
  const result = {};
  const lines = content.split('\n');
  let currentKey = null;
  let currentValue = [];
  let inMultiline = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 跳过注释和空行
    if (trimmed.startsWith('#') || trimmed === '') {
      continue;
    }
    
    // 检查是否是键值对
    const match = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    
    if (match) {
      // 保存前一个键的值
      if (currentKey) {
        result[currentKey] = currentValue.join('\n').trim();
      }
      
      currentKey = match[1];
      const value = match[2];
      
      if (value.startsWith('|') || value.startsWith('>')) {
        // 多行值
        inMultiline = true;
        currentValue = [];
      } else {
        // 单行值
        inMultiline = false;
        result[currentKey] = parseYamlValue(value);
        currentValue = [];
      }
    } else if (inMultiline && currentKey) {
      // 多行值的一部分
      currentValue.push(trimmed);
    }
  }
  
  // 保存最后一个键的值
  if (currentKey) {
    result[currentKey] = currentValue.join('\n').trim();
  }
  
  return result;
}

/**
 * 解析 YAML 值
 * @param {string} value - 值字符串
 * @returns {unknown} 解析后的值
 */
function parseYamlValue(value) {
  if (!value) {
    return '';
  }
  
  // 布尔值
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  
  // 数字
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }
  
  // 带引号的字符串
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  // 数组（简化版，只支持用逗号分隔的字符串数组）
  if (value.startsWith('[') && value.endsWith(']')) {
    const arrayContent = value.slice(1, -1);
    if (arrayContent.trim() === '') {
      return [];
    }
    return arrayContent.split(',').map(item => {
      const trimmed = item.trim();
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    });
  }
  
  // 字符串
  return value;
}

/**
 * 从 frontmatter 获取数组
 * @param {object} frontmatter - frontmatter 对象
 * @param {string} key - 键
 * @returns {string[]} 字符串数组
 */
function getFrontmatterArray(frontmatter, key) {
  const raw = frontmatter[key];
  if (Array.isArray(raw)) {
    return raw.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return normalizeStringList(raw);
  }
  return [];
}

/**
 * 从 frontmatter 获取数字
 * @param {object} frontmatter - frontmatter 对象
 * @param {string} key - 键
 * @param {number} defaultValue - 默认值
 * @returns {number} 数字值
 */
function getFrontmatterNumber(frontmatter, key, defaultValue = 0) {
  const raw = frontmatter[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

/**
 * 从 frontmatter 获取布尔值
 * @param {object} frontmatter - frontmatter 对象
 * @param {string} key - 键
 * @param {boolean} defaultValue - 默认值
 * @returns {boolean} 布尔值
 */
function getFrontmatterBoolean(frontmatter, key, defaultValue = false) {
  const raw = frontmatter[key];
  return parseFrontmatterBool(String(raw), defaultValue);
}

/**
 * 从 frontmatter 获取对象
 * @param {object} frontmatter - frontmatter 对象
 * @param {string} key - 键
 * @returns {object} 对象
 */
function getFrontmatterObject(frontmatter, key) {
  const raw = frontmatter[key];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  return {};
}

/**
 * 从 frontmatter 获取日期
 * @param {object} frontmatter - frontmatter 对象
 * @param {string} key - 键
 * @returns {Date|null} 日期或 null
 */
function getFrontmatterDate(frontmatter, key) {
  const raw = frontmatter[key];
  if (!raw) {
    return null;
  }
  
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 创建 frontmatter 字符串
 * @param {object} data - 数据对象
 * @returns {string} frontmatter 字符串
 */
function createFrontmatter(data) {
  const lines = ['---'];
  
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      continue;
    }
    
    if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'string') {
      // 如果字符串包含换行符或特殊字符，使用多行格式
      if (value.includes('\n') || value.includes(':')) {
        lines.push(`${key}: |`);
        lines.push(...value.split('\n').map(line => `  ${line}`));
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${String(item)}`);
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [subKey, subValue] of Object.entries(value)) {
        lines.push(`  ${subKey}: ${String(subValue)}`);
      }
    }
  }
  
  lines.push('---');
  return lines.join('\n');
}

/**
 * 将 frontmatter 注入到 Markdown 内容
 * @param {string} content - Markdown 内容
 * @param {object} frontmatter - frontmatter 对象
 * @returns {string} 注入后的 Markdown 内容
 */
function injectFrontmatter(content, frontmatter) {
  const existingFrontmatter = extractFrontmatter(content);
  
  if (existingFrontmatter) {
    // 替换现有 frontmatter
    const lines = content.split('\n');
    let frontmatterEnd = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (i > 0 && lines[i].startsWith('---')) {
        frontmatterEnd = i;
        break;
      }
    }
    
    if (frontmatterEnd !== -1) {
      const newFrontmatter = createFrontmatter(frontmatter);
      const before = lines.slice(0, frontmatterEnd + 1).join('\n');
      const after = lines.slice(frontmatterEnd + 1).join('\n');
      return before + '\n' + after;
    }
  }
  
  // 在开头添加 frontmatter
  const newFrontmatter = createFrontmatter(frontmatter);
  return newFrontmatter + '\n\n' + content;
}

/**
 * 从 Markdown 内容中移除 frontmatter
 * @param {string} content - Markdown 内容
 * @returns {string} 移除 frontmatter 后的内容
 */
function removeFrontmatter(content) {
  if (!content || typeof content !== 'string') {
    return content;
  }
  
  const lines = content.split('\n');
  
  if (!lines[0].startsWith('---')) {
    return content;
  }
  
  let frontmatterEnd = -1;
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith('---')) {
      frontmatterEnd = i;
      break;
    }
  }
  
  if (frontmatterEnd === -1) {
    return content;
  }
  
  return lines.slice(frontmatterEnd + 1).join('\n').trim();
}

module.exports = {
  // 提取和解析
  extractFrontmatter,
  parseYamlLike,
  parseYamlValue,
  parseBooleanValue,
  parseFrontmatterBool,
  
  // 获取值
  getFrontmatterString,
  getFrontmatterArray,
  getFrontmatterNumber,
  getFrontmatterBoolean,
  getFrontmatterObject,
  getFrontmatterDate,
  
  // 工具函数
  normalizeStringList,
  
  // 创建和操作
  createFrontmatter,
  injectFrontmatter,
  removeFrontmatter
};
