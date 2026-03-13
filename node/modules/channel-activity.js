/**
 * Channel Activity Tracking
 * 渠道活动跟踪 - 跟踪入站/出站渠道活动
 */

/**
 * @typedef {'inbound' | 'outbound'} ChannelDirection
 */

/**
 * @typedef {Object} ActivityEntry
 * @property {number|null} inboundAt - 入站时间戳
 * @property {number|null} outboundAt - 出站时间戳
 */

/**
 * @typedef {Object} ChannelActivityStats
 * @property {number|null} inboundAt - 入站时间戳
 * @property {number|null} outboundAt - 出站时间戳
 * @property {number|null} lastActivityAt - 最后活动时间戳
 * @property {number|null} idleTimeMs - 空闲时间（毫秒）
 */

const activity = new Map();

/**
 * 生成渠道活动键
 * @param {string} channel - 渠道 ID
 * @param {string} accountId - 账户 ID
 * @returns {string} 键
 */
function keyFor(channel, accountId) {
  return `${channel}:${accountId || 'default'}`;
}

/**
 * 确保活动条目存在
 * @param {string} channel - 渠道 ID
 * @param {string} accountId - 账户 ID
 * @returns {ActivityEntry} 活动条目
 */
function ensureEntry(channel, accountId) {
  const k = keyFor(channel, accountId);
  const existing = activity.get(k);
  if (existing) {
    return existing;
  }
  const created = { inboundAt: null, outboundAt: null };
  activity.set(k, created);
  return created;
}

/**
 * 记录渠道活动
 * @param {Object} params - 参数
 * @param {string} params.channel - 渠道 ID
 * @param {string|null} [params.accountId] - 账户 ID
 * @param {ChannelDirection} params.direction - 方向（inbound/outbound）
 * @param {number} [params.at] - 时间戳（默认当前时间）
 */
function recordChannelActivity(params) {
  const at = typeof params.at === 'number' ? params.at : Date.now();
  const accountId = params.accountId?.trim() || 'default';
  const entry = ensureEntry(params.channel, accountId);
  if (params.direction === 'inbound') {
    entry.inboundAt = at;
  }
  if (params.direction === 'outbound') {
    entry.outboundAt = at;
  }
}

/**
 * 获取渠道活动
 * @param {Object} params - 参数
 * @param {string} params.channel - 渠道 ID
 * @param {string|null} [params.accountId] - 账户 ID
 * @returns {ActivityEntry} 活动条目
 */
function getChannelActivity(params) {
  const accountId = params.accountId?.trim() || 'default';
  return (
    activity.get(keyFor(params.channel, accountId)) ?? {
      inboundAt: null,
      outboundAt: null
    }
  );
}

/**
 * 获取渠道活动统计
 * @param {Object} params - 参数
 * @param {string} params.channel - 渠道 ID
 * @param {string|null} [params.accountId] - 账户 ID
 * @returns {ChannelActivityStats} 活动统计
 */
function getChannelActivityStats(params) {
  const entry = getChannelActivity(params);
  const lastActivityAt = Math.max(entry.inboundAt || 0, entry.outboundAt || 0) || null;
  const idleTimeMs = lastActivityAt ? Date.now() - lastActivityAt : null;
  return {
    inboundAt: entry.inboundAt,
    outboundAt: entry.outboundAt,
    lastActivityAt,
    idleTimeMs
  };
}

/**
 * 清除渠道活动
 * @param {Object} params - 参数
 * @param {string} params.channel - 渠道 ID
 * @param {string|null} [params.accountId] - 账户 ID
 */
function clearChannelActivity(params) {
  const accountId = params.accountId?.trim() || 'default';
  activity.delete(keyFor(params.channel, accountId));
}

/**
 * 获取所有渠道活动
 * @returns {Array<{channel: string, accountId: string, activity: ActivityEntry}>} 所有渠道活动
 */
function getAllChannelActivity() {
  const result = [];
  for (const [key, entry] of activity.entries()) {
    const [channel, accountId] = key.split(':');
    result.push({ channel, accountId, activity: entry });
  }
  return result;
}

/**
 * 重置渠道活动（仅用于测试）
 */
function resetChannelActivityForTest() {
  activity.clear();
}

/**
 * 获取活跃渠道数量
 * @returns {number} 活跃渠道数量
 */
function getActiveChannelCount() {
  return activity.size;
}

/**
 * 检查渠道是否活跃
 * @param {Object} params - 参数
 * @param {string} params.channel - 渠道 ID
 * @param {string|null} [params.accountId] - 账户 ID
 * @param {number} [params.thresholdMs] - 阈值时间（毫秒，默认 3600000 = 1 小时）
 * @returns {boolean} 是否活跃
 */
function isChannelActive(params) {
  const stats = getChannelActivityStats(params);
  const thresholdMs = params.thresholdMs ?? 3600000;
  if (!stats.lastActivityAt) {
    return false;
  }
  return stats.idleTimeMs === null || stats.idleTimeMs < thresholdMs;
}

module.exports = {
  recordChannelActivity,
  getChannelActivity,
  getChannelActivityStats,
  clearChannelActivity,
  getAllChannelActivity,
  resetChannelActivityForTest,
  getActiveChannelCount,
  isChannelActive
};