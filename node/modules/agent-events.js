/**
 * Agent Event System
 * 代理事件系统 - 事件驱动的运行时监控和通知
 */

/**
 * @typedef {'lifecycle' | 'tool' | 'assistant' | 'error' | string} AgentEventStream
 */

/**
 * @typedef {Object} AgentEventPayload
 * @property {string} runId - 运行 ID
 * @property {number} seq - 序列号
 * @property {AgentEventStream} stream - 事件流
 * @property {number} ts - 时间戳
 * @property {Object<string, unknown>} data - 事件数据
 * @property {string} [sessionKey] - 会话密钥
 */

/**
 * @typedef {Object} AgentRunContext
 * @property {string} [sessionKey] - 会话密钥
 * @property {string} [verboseLevel] - 详细级别
 * @property {boolean} [isHeartbeat] - 是否心跳
 * @property {boolean} [isControlUiVisible] - 控制UI是否可见
 */

// Keep per-run counters so streams stay strictly monotonic per runId.
const seqByRun = new Map();
const listeners = new Set();
const runContextById = new Map();

/**
 * 注册代理运行上下文
 * @param {string} runId - 运行 ID
 * @param {AgentRunContext} context - 运行上下文
 */
function registerAgentRunContext(runId, context) {
  if (!runId) {
    return;
  }
  const existing = runContextById.get(runId);
  if (!existing) {
    runContextById.set(runId, { ...context });
    return;
  }
  if (context.sessionKey && existing.sessionKey !== context.sessionKey) {
    existing.sessionKey = context.sessionKey;
  }
  if (context.verboseLevel && existing.verboseLevel !== context.verboseLevel) {
    existing.verboseLevel = context.verboseLevel;
  }
  if (context.isControlUiVisible !== undefined) {
    existing.isControlUiVisible = context.isControlUiVisible;
  }
  if (context.isHeartbeat !== undefined && existing.isHeartbeat !== context.isHeartbeat) {
    existing.isHeartbeat = context.isHeartbeat;
  }
}

/**
 * 获取代理运行上下文
 * @param {string} runId - 运行 ID
 * @returns {AgentRunContext|undefined} 运行上下文
 */
function getAgentRunContext(runId) {
  return runContextById.get(runId);
}

/**
 * 清除代理运行上下文
 * @param {string} runId - 运行 ID
 */
function clearAgentRunContext(runId) {
  runContextById.delete(runId);
}

/**
 * 重置代理运行上下文（仅用于测试）
 */
function resetAgentRunContextForTest() {
  runContextById.clear();
}

/**
 * 发送代理事件
 * @param {Omit<AgentEventPayload, 'seq' | 'ts'>} event - 事件对象
 */
function emitAgentEvent(event) {
  const nextSeq = (seqByRun.get(event.runId) ?? 0) + 1;
  seqByRun.set(event.runId, nextSeq);
  const context = runContextById.get(event.runId);
  const isControlUiVisible = context?.isControlUiVisible ?? true;
  const eventSessionKey =
    typeof event.sessionKey === 'string' && event.sessionKey.trim() ? event.sessionKey : undefined;
  const sessionKey = isControlUiVisible ? (eventSessionKey ?? context?.sessionKey) : undefined;
  const enriched = {
    ...event,
    sessionKey,
    seq: nextSeq,
    ts: Date.now()
  };
  for (const listener of listeners) {
    try {
      listener(enriched);
    } catch {
      /* ignore */
    }
  }
}

/**
 * 监听代理事件
 * @param {function(AgentEventPayload): void} listener - 事件监听器
 * @returns {function} 取消监听的函数
 */
function onAgentEvent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 重置所有状态（仅用于测试）
 */
function resetAgentEventsForTest() {
  seqByRun.clear();
  listeners.clear();
  runContextById.clear();
}

/**
 * 获取运行序列号
 * @param {string} runId - 运行 ID
 * @returns {number} 当前序列号
 */
function getRunSequence(runId) {
  return seqByRun.get(runId) ?? 0;
}

/**
 * 获取活跃运行数量
 * @returns {number} 活跃运行数量
 */
function getActiveRunCount() {
  return runContextById.size;
}

/**
 * 获取监听器数量
 * @returns {number} 监听器数量
 */
function getListenerCount() {
  return listeners.size;
}

module.exports = {
  registerAgentRunContext,
  getAgentRunContext,
  clearAgentRunContext,
  resetAgentRunContextForTest,
  emitAgentEvent,
  onAgentEvent,
  resetAgentEventsForTest,
  getRunSequence,
  getActiveRunCount,
  getListenerCount
};