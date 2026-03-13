/**
 * 代码区域检测模块
 * 查找Markdown代码区域（fenced code blocks和inline code）
 */

/**
 * 查找文本中的所有代码区域
 * @param {string} text - 要分析的文本
 * @returns {Array<{start: number, end: number}>} - 代码区域数组
 */
function findCodeRegions(text) {
  const regions = [];

  // 查找 fenced code blocks (``` 或 ~~~)
  const fencedRe = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?(?:\n\2(?:\n|$)|$)/g;
  for (const match of text.matchAll(fencedRe)) {
    const start = (match.index ?? 0) + match[1].length;
    regions.push({ start, end: start + match[0].length - match[1].length });
  }

  // 查找 inline code (`code`)
  const inlineRe = /`+[^`]+`+/g;
  for (const match of text.matchAll(inlineRe)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const insideFenced = regions.some((r) => start >= r.start && end <= r.end);
    if (!insideFenced) {
      regions.push({ start, end });
    }
  }

  regions.sort((a, b) => a.start - b.start);
  return regions;
}

/**
 * 检查位置是否在代码区域内
 * @param {number} pos - 要检查的位置
 * @param {Array<{start: number, end: number}>} regions - 代码区域数组
 * @returns {boolean} - 是否在代码区域内
 */
function isInsideCode(pos, regions) {
  return regions.some((r) => pos >= r.start && pos < r.end);
}

module.exports = {
  findCodeRegions,
  isInsideCode
};