/**
 * iFlow Text Chunking Module
 * 文本分块模块，整合自 OpenClaw 的 chunk.ts 和 text-chunking.ts
 */

/**
 * 默认分块限制
 */
const DEFAULT_CHUNK_LIMIT = 4000;

/**
 * 默认分块模式
 */
const DEFAULT_CHUNK_MODE = 'length';

/**
 * 按换行符分块
 * @param {string} text - 要分块的文本
 * @param {number} limit - 每块的最大长度
 * @returns {string[]} 分块后的文本数组
 */
function chunkByNewline(text, limit = DEFAULT_CHUNK_LIMIT) {
  if (!text) {
    return [];
  }
  if (limit <= 0) {
    return [text];
  }
  
  const lines = text.split('\n');
  const chunks = [];
  let currentChunk = '';
  
  for (const line of lines) {
    const lineWithNewline = currentChunk ? currentChunk + '\n' + line : line;
    
    if (lineWithNewline.length <= limit) {
      currentChunk = lineWithNewline;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = line;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * 按段落分块
 * @param {string} text - 要分块的文本
 * @param {number} limit - 每块的最大长度
 * @returns {string[]} 分块后的文本数组
 */
function chunkByParagraph(text, limit = DEFAULT_CHUNK_LIMIT) {
  if (!text) {
    return [];
  }
  if (limit <= 0) {
    return [text];
  }
  
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const paragraphWithNewline = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
    
    if (paragraphWithNewline.length <= limit) {
      currentChunk = paragraphWithNewline;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      // 如果单个段落超过限制，按换行符分块
      if (paragraph.length > limit) {
        const paragraphChunks = chunkByNewline(paragraph, limit);
        chunks.push(...paragraphChunks);
      } else {
        currentChunk = paragraph;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * 按句子分块
 * @param {string} text - 要分块的文本
 * @param {number} limit - 每块的最大长度
 * @returns {string[]} 分块后的文本数组
 */
function chunkBySentence(text, limit = DEFAULT_CHUNK_LIMIT) {
  if (!text) {
    return [];
  }
  if (limit <= 0) {
    return [text];
  }
  
  // 按句号、问号、感叹号分割
  const sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
  const chunks = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const sentenceWithSpace = currentChunk ? currentChunk + ' ' + sentence.trim() : sentence.trim();
    
    if (sentenceWithSpace.length <= limit) {
      currentChunk = sentenceWithSpace;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      // 如果单个句子超过限制，强制分割
      if (sentence.length > limit) {
        while (sentence.length > limit) {
          chunks.push(sentence.slice(0, limit));
          sentence = sentence.slice(limit);
        }
        if (sentence) {
          currentChunk = sentence;
        } else {
          currentChunk = '';
        }
      } else {
        currentChunk = sentence.trim();
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * 按长度分块
 * @param {string} text - 要分块的文本
 * @param {number} limit - 每块的最大长度
 * @returns {string[]} 分块后的文本数组
 */
function chunkByLength(text, limit = DEFAULT_CHUNK_LIMIT) {
  if (!text) {
    return [];
  }
  if (limit <= 0) {
    return [text];
  }
  if (text.length <= limit) {
    return [text];
  }
  
  const chunks = [];
  let remaining = text;
  
  while (remaining.length > limit) {
    chunks.push(remaining.slice(0, limit));
    remaining = remaining.slice(limit);
  }
  
  if (remaining.length) {
    chunks.push(remaining);
  }
  
  return chunks;
}

/**
 * 按Markdown分块
 * @param {string} text - 要分块的文本
 * @param {number} limit - 每块的最大长度
 * @returns {string[]} 分块后的文本数组
 */
function chunkByMarkdown(text, limit = DEFAULT_CHUNK_LIMIT) {
  if (!text) {
    return [];
  }
  if (limit <= 0) {
    return [text];
  }
  
  const chunks = [];
  let remaining = text;
  
  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    
    // 查找合适的断点（代码块、标题、列表等）
    const breakIndex = findMarkdownBreakPoint(window);
    const chunk = remaining.slice(0, breakIndex).trimEnd();
    
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    // 跳过空白字符
    const nextStart = findNextNonWhitespace(remaining, breakIndex);
    remaining = remaining.slice(nextStart);
  }
  
  if (remaining.trim().length > 0) {
    chunks.push(remaining.trim());
  }
  
  return chunks;
}

/**
 * 查找Markdown断点
 * @param {string} window - 窗口文本
 * @returns {number} 断点位置
 */
function findMarkdownBreakPoint(window) {
  // 优先级：代码块 > 标题 > 列表 > 段落 > 任意位置
  
  // 查找代码块结束
  const codeBlockEnd = window.lastIndexOf('```');
  if (codeBlockEnd > 0) {
    return codeBlockEnd + 3;
  }
  
  // 查找标题
  const lastHeading = Math.max(
    window.lastIndexOf('\n#'),
    window.lastIndexOf('\n##'),
    window.lastIndexOf('\n###')
  );
  if (lastHeading > 0) {
    return lastHeading;
  }
  
  // 查找列表项
  const lastListItem = window.lastIndexOf('\n-');
  if (lastListItem > 0) {
    return lastListItem;
  }
  
  // 查找段落（连续两个换行）
  const lastParagraph = window.lastIndexOf('\n\n');
  if (lastParagraph > 0) {
    return lastParagraph;
  }
  
  // 查找最后一个换行
  const lastNewline = window.lastIndexOf('\n');
  if (lastNewline > 0) {
    return lastNewline + 1;
  }
  
  // 没有合适的断点，强制分割
  return window.length;
}

/**
 * 查找下一个非空白字符位置
 * @param {string} text - 文本
 * @param {number} start - 起始位置
 * @returns {number} 非空白字符位置
 */
function findNextNonWhitespace(text, start) {
  for (let i = start; i < text.length; i++) {
    if (!/\s/.test(text[i])) {
      return i;
    }
  }
  return text.length;
}

/**
 * 智能分块（自动选择最佳策略）
 * @param {string} text - 要分块的文本
 * @param {number} [limit] - 每块的最大长度
 * @param {string} [mode] - 分块模式
 * @returns {string[]} 分块后的文本数组
 */
function chunkText(text, limit = DEFAULT_CHUNK_LIMIT, mode = DEFAULT_CHUNK_MODE) {
  if (!text) {
    return [];
  }
  if (limit <= 0) {
    return [text];
  }
  if (text.length <= limit) {
    return [text];
  }
  
  switch (mode) {
    case 'newline':
      return chunkByNewline(text, limit);
    case 'paragraph':
      return chunkByParagraph(text, limit);
    case 'sentence':
      return chunkBySentence(text, limit);
    case 'markdown':
      return chunkByMarkdown(text, limit);
    case 'length':
    default:
      return chunkByLength(text, limit);
  }
}

/**
 * 按断点解析器分块
 * @param {string} text - 要分块的文本
 * @param {number} limit - 每块的最大长度
 * @param {Function} resolveBreakIndex - 断点解析函数
 * @returns {string[]} 分块后的文本数组
 */
function chunkTextByBreakResolver(text, limit, resolveBreakIndex) {
  if (!text) {
    return [];
  }
  if (limit <= 0 || text.length <= limit) {
    return [text];
  }
  
  const chunks = [];
  let remaining = text;
  
  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const candidateBreak = resolveBreakIndex(window);
    const breakIdx =
      Number.isFinite(candidateBreak) && candidateBreak > 0 && candidateBreak <= limit
        ? candidateBreak
        : limit;
    const rawChunk = remaining.slice(0, breakIdx);
    const chunk = rawChunk.trimEnd();
    
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    const brokeOnSeparator = breakIdx < remaining.length && /\s/.test(remaining[breakIdx]);
    const nextStart = Math.min(remaining.length, breakIdx + (brokeOnSeparator ? 1 : 0));
    remaining = remaining.slice(nextStart).trimStart();
  }
  
  if (remaining.length) {
    chunks.push(remaining);
  }
  
  return chunks;
}

/**
 * 创建自定义分块器
 * @param {Function} breakResolver - 断点解析函数
 * @returns {Function} 分块函数
 */
function createChunker(breakResolver) {
  return (text, limit = DEFAULT_CHUNK_LIMIT) => {
    return chunkTextByBreakResolver(text, limit, breakResolver);
  };
}

/**
 * 估算文本的 token 数量
 * @param {string} text - 文本
 * @returns {number} 估算的 token 数量
 */
function estimateTokenCount(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  // 粗略估算：1 token ≈ 4 字符（英文）或 2 字符（中文）
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 2 + otherChars / 4);
}

/**
 * 按 token 数量分块
 * @param {string} text - 要分块的文本
 * @param {number} maxTokens - 每块的最大 token 数
 * @returns {string[]} 分块后的文本数组
 */
function chunkByTokens(text, maxTokens = 1000) {
  if (!text) {
    return [];
  }
  if (maxTokens <= 0) {
    return [text];
  }
  
  const tokens = estimateTokenCount(text);
  if (tokens <= maxTokens) {
    return [text];
  }
  
  // 按字符数估算分块
  const estimatedChars = Math.floor(maxTokens * 3.5); // 平均 token 长度
  return chunkByLength(text, estimatedChars);
}

module.exports = {
  // 基础分块方法
  chunkByLength,
  chunkByNewline,
  chunkByParagraph,
  chunkBySentence,
  chunkByMarkdown,
  
  // 高级分块方法
  chunkText,
  chunkTextByBreakResolver,
  createChunker,
  chunkByTokens,
  
  // 工具函数
  estimateTokenCount,
  findMarkdownBreakPoint,
  findNextNonWhitespace,
  
  // 常量
  DEFAULT_CHUNK_LIMIT,
  DEFAULT_CHUNK_MODE
};