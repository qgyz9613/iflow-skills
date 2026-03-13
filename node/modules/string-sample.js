/**
 * 字符串条目总结模块
 * 智能总结字符串列表，显示前 N 项和剩余数量
 * 用于日志输出和用户界面显示
 */

/**
 * 总结字符串条目
 * @param {Object} params - 参数对象
 * @param {Array<string>} [params.entries] - 字符串条目数组
 * @param {number} [params.limit=6] - 显示的条目数量限制
 * @param {string} [params.emptyText=''] - 空列表时显示的文本
 * @returns {string} - 总结字符串
 */
function summarizeStringEntries(params) {
  const entries = params.entries ?? [];
  if (entries.length === 0) {
    return params.emptyText ?? '';
  }
  const limit = Math.max(1, Math.floor(params.limit ?? 6));
  const sample = entries.slice(0, limit);
  const suffix = entries.length > sample.length ? ` (+${entries.length - sample.length})` : '';
  return `${sample.join(', ')}${suffix}`;
}

module.exports = {
  summarizeStringEntries
};