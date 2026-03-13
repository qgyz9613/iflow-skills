/**
 * iFlow Diagnostic Events Module
 * 诊断事件系统，整合自 OpenClaw 的 diagnostic-events.ts
 */

// ==================== 诊断事件类型 ====================

/**
 * 会话状态类型
 */
const SessionState = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  WAITING: 'waiting'
};

/**
 * 诊断事件状态
 */
const state = {
  seq: 0,
  listeners: new Set(),
  dispatchDepth: 0,
  enabled: true
};

// ==================== 诊断事件类型定义 ====================

/**
 * 模型使用事件
 */
function createModelUsageEvent(data = {}) {
  return {
    type: 'model.usage',
    sessionKey: data.sessionKey,
    sessionId: data.sessionId,
    channel: data.channel,
    provider: data.provider,
    model: data.model,
    usage: data.usage || {},
    lastCallUsage: data.lastCallUsage,
    context: data.context,
    costUsd: data.costUsd,
    durationMs: data.durationMs
  };
}

/**
 * Webhook 接收事件
 */
function createWebhookReceivedEvent(data = {}) {
  return {
    type: 'webhook.received',
    channel: data.channel,
    updateType: data.updateType,
    chatId: data.chatId
  };
}

/**
 * Webhook 处理完成事件
 */
function createWebhookProcessedEvent(data = {}) {
  return {
    type: 'webhook.processed',
    channel: data.channel,
    updateType: data.updateType,
    chatId: data.chatId,
    durationMs: data.durationMs
  };
}

/**
 * Webhook 错误事件
 */
function createWebhookErrorEvent(data = {}) {
  return {
    type: 'webhook.error',
    channel: data.channel,
    updateType: data.updateType,
    chatId: data.chatId,
    error: data.error
  };
}

/**
 * 消息队列事件
 */
function createMessageQueuedEvent(data = {}) {
  return {
    type: 'message.queued',
    sessionKey: data.sessionKey,
    sessionId: data.sessionId,
    channel: data.channel,
    source: data.source,
    queueDepth: data.queueDepth
  };
}

/**
 * 消息处理完成事件
 */
function createMessageProcessedEvent(data = {}) {
  return {
    type: 'message.processed',
    channel: data.channel,
    messageId: data.messageId,
    chatId: data.chatId,
    sessionKey: data.sessionKey,
    sessionId: data.sessionId,
    durationMs: data.durationMs,
    outcome: data.outcome,
    reason: data.reason,
    error: data.error
  };
}

/**
 * 会话状态事件
 */
function createSessionStateEvent(data = {}) {
  return {
    type: 'session.state',
    sessionKey: data.sessionKey,
    sessionId: data.sessionId,
    prevState: data.prevState,
    state: data.state,
    reason: data.reason,
    queueDepth: data.queueDepth
  };
}

/**
 * 会话卡住事件
 */
function createSessionStuckEvent(data = {}) {
  return {
    type: 'session.stuck',
    sessionKey: data.sessionKey,
    sessionId: data.sessionId,
    state: data.state,
    ageMs: data.ageMs,
    queueDepth: data.queueDepth
  };
}

/**
 * 队列入队事件
 */
function createLaneEnqueueEvent(data = {}) {
  return {
    type: 'queue.lane.enqueue',
    lane: data.lane,
    queueSize: data.queueSize
  };
}

/**
 * 队列出队事件
 */
function createLaneDequeueEvent(data = {}) {
  return {
    type: 'queue.lane.dequeue',
    lane: data.lane,
    queueSize: data.queueSize,
    waitMs: data.waitMs
  };
}

/**
 * 运行尝试事件
 */
function createRunAttemptEvent(data = {}) {
  return {
    type: 'run.attempt',
    sessionKey: data.sessionKey,
    sessionId: data.sessionId,
    runId: data.runId,
    attempt: data.attempt
  };
}

/**
 * 心跳事件
 */
function createHeartbeatEvent(data = {}) {
  return {
    type: 'diagnostic.heartbeat',
    webhooks: data.webhooks || {
      received: 0,
      processed: 0,
      errors: 0
    },
    active: data.active || 0,
    waiting: data.waiting || 0,
    queued: data.queued || 0
  };
}

/**
 * 工具循环事件
 */
function createToolLoopEvent(data = {}) {
  return {
    type: 'tool.loop',
    sessionKey: data.sessionKey,
    sessionId: data.sessionId,
    toolName: data.toolName,
    level: data.level,
    action: data.action,
    detector: data.detector,
    count: data.count,
    message: data.message,
    pairedToolName: data.pairedToolName
  };
}

// ==================== 诊断事件管理 ====================

/**
 * 发送诊断事件
 * @param {Object} event - 事件对象
 */
function emitDiagnosticEvent(event) {
  if (!state.enabled) {
    return;
  }
  
  // 递归保护
  if (state.dispatchDepth > 100) {
    console.error(
      `[diagnostic-events] recursion guard tripped at depth=${state.dispatchDepth}, dropping type=${event.type}`
    );
    return;
  }

  // 添加序列号和时间戳
  const enriched = {
    ...event,
    seq: (state.seq += 1),
    ts: Date.now()
  };
  
  state.dispatchDepth += 1;
  
  // 通知所有监听器
  for (const listener of state.listeners) {
    try {
      listener(enriched);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? (err.stack ?? err.message)
          : typeof err === "string"
            ? err
            : String(err);
      console.error(
        `[diagnostic-events] listener error type=${enriched.type} seq=${enriched.seq}: ${errorMessage}`
      );
    }
  }
  
  state.dispatchDepth -= 1;
}

/**
 * 添加诊断事件监听器
 * @param {Function} listener - 监听器函数
 * @returns {Function} 移除监听器的函数
 */
function onDiagnosticEvent(listener) {
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

/**
 * 启用诊断事件
 */
function enableDiagnostics() {
  state.enabled = true;
}

/**
 * 禁用诊断事件
 */
function disableDiagnostics() {
  state.enabled = false;
}

/**
 * 检查诊断事件是否启用
 * @returns {boolean} 是否启用
 */
function isDiagnosticsEnabled() {
  return state.enabled;
}

/**
 * 重置诊断事件（仅用于测试）
 */
function resetDiagnosticEvents() {
  state.seq = 0;
  state.listeners.clear();
  state.dispatchDepth = 0;
}

/**
 * 获取诊断事件统计
 * @returns {Object} 统计信息
 */
function getDiagnosticStats() {
  return {
    seq: state.seq,
    listenerCount: state.listeners.size,
    dispatchDepth: state.dispatchDepth,
    enabled: state.enabled
  };
}

// ==================== 快捷方法 ====================

/**
 * 记录模型使用
 * @param {Object} data - 模型使用数据
 */
function trackModelUsage(data) {
  emitDiagnosticEvent(createModelUsageEvent(data));
}

/**
 * 记录 Webhook 接收
 * @param {Object} data - Webhook 数据
 */
function trackWebhookReceived(data) {
  emitDiagnosticEvent(createWebhookReceivedEvent(data));
}

/**
 * 记录 Webhook 处理完成
 * @param {Object} data - Webhook 数据
 */
function trackWebhookProcessed(data) {
  emitDiagnosticEvent(createWebhookProcessedEvent(data));
}

/**
 * 记录 Webhook 错误
 * @param {Object} data - 错误数据
 */
function trackWebhookError(data) {
  emitDiagnosticEvent(createWebhookErrorEvent(data));
}

/**
 * 记录消息队列
 * @param {Object} data - 消息数据
 */
function trackMessageQueued(data) {
  emitDiagnosticEvent(createMessageQueuedEvent(data));
}

/**
 * 记录消息处理完成
 * @param {Object} data - 消息数据
 */
function trackMessageProcessed(data) {
  emitDiagnosticEvent(createMessageProcessedEvent(data));
}

/**
 * 记录会话状态
 * @param {Object} data - 会话数据
 */
function trackSessionState(data) {
  emitDiagnosticEvent(createSessionStateEvent(data));
}

/**
 * 记录会话卡住
 * @param {Object} data - 会话数据
 */
function trackSessionStuck(data) {
  emitDiagnosticEvent(createSessionStuckEvent(data));
}

/**
 * 记录心跳
 * @param {Object} data - 心跳数据
 */
function trackHeartbeat(data) {
  emitDiagnosticEvent(createHeartbeatEvent(data));
}

/**
 * 记录运行尝试
 * @param {Object} data - 运行数据
 */
function trackRunAttempt(data) {
  emitDiagnosticEvent(createRunAttemptEvent(data));
}

/**
 * 记录工具循环
 * @param {Object} data - 工具数据
 */
function trackToolLoop(data) {
  emitDiagnosticEvent(createToolLoopEvent(data));
}

// ==================== 导出 ====================

module.exports = {
  // 事件管理
  emitDiagnosticEvent,
  onDiagnosticEvent,
  enableDiagnostics,
  disableDiagnostics,
  isDiagnosticsEnabled,
  resetDiagnosticEvents,
  getDiagnosticStats,
  
  // 事件创建器
  createModelUsageEvent,
  createWebhookReceivedEvent,
  createWebhookProcessedEvent,
  createWebhookErrorEvent,
  createMessageQueuedEvent,
  createMessageProcessedEvent,
  createSessionStateEvent,
  createSessionStuckEvent,
  createLaneEnqueueEvent,
  createLaneDequeueEvent,
  createRunAttemptEvent,
  createHeartbeatEvent,
  createToolLoopEvent,
  
  // 快捷方法
  trackModelUsage,
  trackWebhookReceived,
  trackWebhookProcessed,
  trackWebhookError,
  trackMessageQueued,
  trackMessageProcessed,
  trackSessionState,
  trackSessionStuck,
  trackHeartbeat,
  trackRunAttempt,
  trackToolLoop,
  
  // 常量
  SessionState
};