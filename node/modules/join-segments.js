/**
 * 文本段连接模块
 * 连接可选文本段和存在的文本段，用于消息拼接和格式化
 */

/**
 * 连接两个可选文本段
 * @param {Object} params - 参数对象
 * @param {string} [params.left] - 左侧文本段
 * @param {string} [params.right] - 右侧文本段
 * @param {string} [params.separator='\n\n'] - 分隔符
 * @returns {string|undefined} - 连接后的文本，如果都为空则返回 undefined
 */
function concatOptionalTextSegments(params) {
  const separator = params.separator ?? '\n\n';
  if (params.left && params.right) {
    return `${params.left}${separator}${params.right}`;
  }
  return params.right ?? params.left;
}

/**
 * 连接多个存在的文本段
 * @param {Array<string|null|undefined>} segments - 文本段数组
 * @param {Object} [options] - 选项
 * @param {string} [options.separator='\n\n'] - 分隔符
 * @param {boolean} [options.trim=false] - 是否修剪每个段
 * @returns {string|undefined} - 连接后的文本，如果没有有效段则返回 undefined
 */
function joinPresentTextSegments(segments, options = {}) {
  const separator = options.separator ?? '\n\n';
  const trim = options.trim ?? false;
  const values = [];
  for (const segment of segments) {
    if (typeof segment !== 'string') {
      continue;
    }
    const normalized = trim ? segment.trim() : segment;
    if (!normalized) {
      continue;
    }
    values.push(normalized);
  }
  return values.length > 0 ? values.join(separator) : undefined;
}

module.exports = {
  concatOptionalTextSegments,
  joinPresentTextSegments
};