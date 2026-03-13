/**
 * iFlow String Utils Module
 * 字符串工具模块，整合自 OpenClaw 的字符串处理模块
 */

/**
 * 规范化字符串数组
 * @param {Array<unknown>} list - 字符串数组
 * @returns {string[]} 规范化后的数组
 */
function normalizeStringEntries(list) {
  return (list || []).map(entry => String(entry).trim()).filter(Boolean);
}

/**
 * 规范化字符串数组并转为小写
 * @param {Array<unknown>} list - 字符串数组
 * @returns {string[]} 规范化后的小写数组
 */
function normalizeStringEntriesLower(list) {
  return normalizeStringEntries(list).map(entry => entry.toLowerCase());
}

/**
 * 规范化为连字符 slug
 * @param {string|null} raw - 原始字符串
 * @returns {string} slug
 */
function normalizeHyphenSlug(raw) {
  const trimmed = (raw || '').trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  
  const dashed = trimmed.replace(/\s+/g, '-');
  const cleaned = dashed.replace(/[^a-z0-9#@._+-]+/g, '-');
  return cleaned.replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '');
}

/**
 * 规范化为 @# 前缀 slug
 * @param {string|null} raw - 原始字符串
 * @returns {string} slug
 */
function normalizeAtHashSlug(raw) {
  const trimmed = (raw || '').trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  
  const withoutPrefix = trimmed.replace(/^[@#]+/, '');
  const dashed = withoutPrefix.replace(/[\s_]+/g, '-');
  const cleaned = dashed.replace(/[^a-z0-9-]+/g, '-');
  return cleaned.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * 首字母大写
 * @param {string} str - 字符串
 * @returns {string} 首字母大写的字符串
 */
function capitalize(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * 标题化（每个单词首字母大写）
 * @param {string} str - 字符串
 * @returns {string} 标题化的字符串
 */
function titleize(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.toLowerCase().split(/\s+/).map(capitalize).join(' ');
}

/**
 * 驼峰化
 * @param {string} str - 字符串
 * @returns {string} 驼峰化的字符串
 */
function camelize(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^(.)/, char => char.toLowerCase());
}

/**
 * 帕斯卡化（首字母大写的驼峰）
 * @param {string} str - 字符串
 * @returns {string} 帕斯卡化的字符串
 */
function pascalize(str) {
  const camelized = camelize(str);
  return camelized.charAt(0).toUpperCase() + camelized.slice(1);
}

/**
 * 蛇形化
 * @param {string} str - 字符串
 * @returns {string} 蛇形化的字符串
 */
function snakeize(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

/**
 * 连字符化
 * @param {string} str - 字符串
 * @returns {string} 连字符化的字符串
 */
function kebabize(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

/**
 * 截断字符串
 * @param {string} str - 字符串
 * @param {number} length - 最大长度
 * @param {string} suffix - 后缀
 * @returns {string} 截断后的字符串
 */
function truncate(str, length, suffix = '...') {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  if (str.length <= length) {
    return str;
  }
  
  return str.slice(0, length - suffix.length) + suffix;
}

/**
 * 在单词边界截断字符串
 * @param {string} str - 字符串
 * @param {number} length - 最大长度
 * @param {string} suffix - 后缀
 * @returns {string} 截断后的字符串
 */
function truncateWords(str, length, suffix = '...') {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  if (str.length <= length) {
    return str;
  }
  
  const truncated = str.slice(0, length - suffix.length);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace) + suffix;
  }
  
  return truncated + suffix;
}

/**
 * 转义 HTML 特殊字符
 * @param {string} str - 字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  return str.replace(/[&<>"']/g, char => htmlEntities[char]);
}

/**
 * 反转义 HTML 特殊字符
 * @param {string} str - 字符串
 * @returns {string} 反转义后的字符串
 */
function unescapeHtml(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  const htmlEntities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'"
  };
  
  return str.replace(/&(amp|lt|gt|quot|#39);/g, entity => htmlEntities[entity]);
}

/**
 * 检查字符串是否为空或仅包含空白字符
 * @param {string} str - 字符串
 * @returns {boolean} 是否为空
 */
function isBlank(str) {
  return !str || /^\s*$/.test(str);
}

/**
 * 检查字符串是否不为空
 * @param {string} str - 字符串
 * @returns {boolean} 是否不为空
 */
function isNotBlank(str) {
  return !isBlank(str);
}

/**
 * 移除字符串两端的空白字符
 * @param {string} str - 字符串
 * @returns {string} 去除空白后的字符串
 */
function trim(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.trim();
}

/**
 * 移除字符串开头的空白字符
 * @param {string} str - 字符串
 * @returns {string} 去除开头空白后的字符串
 */
function trimStart(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.trimLeft();
}

/**
 * 移除字符串结尾的空白字符
 * @param {string} str - 字符串
 * @returns {string} 去除结尾空白后的字符串
 */
function trimEnd(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.trimRight();
}

/**
 * 移除字符串中所有空白字符
 * @param {string} str - 字符串
 * @returns {string} 去除所有空白后的字符串
 */
function removeAllWhitespace(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.replace(/\s+/g, '');
}

/**
 * 标准化空白字符（多个空白字符替换为单个空格）
 * @param {string} str - 字符串
 * @returns {string} 标准化后的字符串
 */
function normalizeWhitespace(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * 反转字符串
 * @param {string} str - 字符串
 * @returns {string} 反转后的字符串
 */
function reverse(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.split('').reverse().join('');
}

/**
 * 重复字符串
 * @param {string} str - 字符串
 * @param {number} count - 重复次数
 * @returns {string} 重复后的字符串
 */
function repeat(str, count) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  if (count <= 0) {
    return '';
  }
  return str.repeat(count);
}

/**
 * 填充字符串
 * @param {string} str - 字符串
 * @param {number} length - 目标长度
 * @param {string} padString - 填充字符串
 * @param {boolean} padEnd - 是否在结尾填充
 * @returns {string} 填充后的字符串
 */
function pad(str, length, padString = ' ', padEnd = true) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  if (str.length >= length) {
    return str;
  }
  
  const paddingLength = length - str.length;
  const padding = repeat(padString, Math.ceil(paddingLength / padString.length)).slice(0, paddingLength);
  
  return padEnd ? str + padding : padding + str;
}

/**
 * 在左侧填充字符串
 * @param {string} str - 字符串
 * @param {number} length - 目标长度
 * @param {string} padString - 填充字符串
 * @returns {string} 填充后的字符串
 */
function padStart(str, length, padString = ' ') {
  return pad(str, length, padString, false);
}

/**
 * 在右侧填充字符串
 * @param {string} str - 字符串
 * @param {number} length - 目标长度
 * @param {string} padString - 填充字符串
 * @returns {string} 填充后的字符串
 */
function padEnd(str, length, padString = ' ') {
  return pad(str, length, padString, true);
}

/**
 * 将字符串转换为 URL 友好的 slug
 * @param {string} str - 字符串
 * @returns {string} slug
 */
function slugify(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // 移除变音符号
    .replace(/[^a-z0-9\s-]/g, '') // 移除特殊字符
    .replace(/\s+/g, '-') // 空格替换为连字符
    .replace(/-+/g, '-') // 多个连字符替换为一个
    .replace(/^-+|-+$/g, ''); // 移除首尾连字符
}

/**
 * 检查字符串是否包含子字符串（不区分大小写）
 * @param {string} str - 字符串
 * @param {string} search - 搜索字符串
 * @returns {boolean} 是否包含
 */
function includesIgnoreCase(str, search) {
  if (!str || !search) {
    return false;
  }
  return str.toLowerCase().includes(search.toLowerCase());
}

/**
 * 检查字符串是否以指定字符串开头（不区分大小写）
 * @param {string} str - 字符串
 * @param {string} prefix - 前缀
 * @returns {boolean} 是否以指定字符串开头
 */
function startsWithIgnoreCase(str, prefix) {
  if (!str || !prefix) {
    return false;
  }
  return str.toLowerCase().startsWith(prefix.toLowerCase());
}

/**
 * 检查字符串是否以指定字符串结尾（不区分大小写）
 * @param {string} str - 字符串
 * @param {string} suffix - 后缀
 * @returns {boolean} 是否以指定字符串结尾
 */
function endsWithIgnoreCase(str, suffix) {
  if (!str || !suffix) {
    return false;
  }
  return str.toLowerCase().endsWith(suffix.toLowerCase());
}

/**
 * 替换所有出现的子字符串（不区分大小写）
 * @param {string} str - 字符串
 * @param {string} search - 搜索字符串
 * @param {string} replacement - 替换字符串
 * @returns {string} 替换后的字符串
 */
function replaceAllIgnoreCase(str, search, replacement) {
  if (!str || !search) {
    return str;
  }
  
  const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return str.replace(regex, replacement);
}

/**
 * 转换为字符串
 * @param {unknown} value - 值
 * @returns {string} 字符串
 */
function toString(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

/**
 * 转换为安全字符串（过滤 null 和 undefined）
 * @param {unknown} value - 值
 * @returns {string|null} 字符串或 null
 */
function toSafeString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

/**
 * 格式化字符串（简单的模板替换）
 * @param {string} template - 模板字符串
 * @param {Object} values - 值对象
 * @returns {string} 格式化后的字符串
 */
function format(template, values) {
  if (!template || typeof template !== 'string') {
    return '';
  }
  
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return values && values[key] !== undefined ? String(values[key]) : match;
  });
}

module.exports = {
  // 字符串规范化
  normalizeStringEntries,
  normalizeStringEntriesLower,
  normalizeHyphenSlug,
  normalizeAtHashSlug,
  
  // 大小写转换
  capitalize,
  titleize,
  camelize,
  pascalize,
  snakeize,
  kebabize,
  
  // 截断
  truncate,
  truncateWords,
  
  // HTML 转义
  escapeHtml,
  unescapeHtml,
  
  // 空白检查
  isBlank,
  isNotBlank,
  
  // 空白处理
  trim,
  trimStart,
  trimEnd,
  removeAllWhitespace,
  normalizeWhitespace,
  
  // 字符串操作
  reverse,
  repeat,
  pad,
  padStart,
  padEnd,
  
  // Slug 生成
  slugify,
  
  // 不区分大小写的字符串操作
  includesIgnoreCase,
  startsWithIgnoreCase,
  endsWithIgnoreCase,
  replaceAllIgnoreCase,
  
  // 类型转换
  toString,
  toSafeString,
  
  // 格式化
  format
};