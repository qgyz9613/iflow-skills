/**
 * iFlow Context Engine Module
 * 整合自 OpenClaw 项目的上下文管理引擎
 * 管理对话上下文、消息存储和智能压缩
 */

const fs = require('fs').promises;
const path = require('path');

// ==================== 上下文引擎类 ====================

class ContextEngine {
  constructor(options = {}) {
    this.options = {
      maxMessages: options.maxMessages || 50,
      maxTokens: options.maxTokens || 8000,
      autoCompact: options.autoCompact !== false,
      storageDir: options.storageDir || path.join(process.env.HOME || process.env.USERPROFILE || '.', '.iflow', 'context'),
      ...options
    };

    this.sessions = new Map();
    this.contextStore = new Map();
  }

  /**
   * 初始化上下文引擎
   */
  async initialize() {
    try {
      await fs.mkdir(this.options.storageDir, { recursive: true });
    } catch (err) {
      console.warn('Failed to create context storage directory:', err.message);
    }
  }

  /**
   * 摄入消息到上下文
   */
  async ingestMessage(sessionId, message) {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const session = this.sessions.get(sessionId) || {
      id: sessionId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 添加消息
    const messageWithMeta = {
      ...message,
      id: this.generateMessageId(),
      timestamp: Date.now()
    };

    session.messages.push(messageWithMeta);
    session.updatedAt = Date.now();

    // 限制消息数量
    if (session.messages.length > this.options.maxMessages) {
      session.messages = session.messages.slice(-this.options.maxMessages);
    }

    this.sessions.set(sessionId, session);

    return { ingested: true, messageId: messageWithMeta.id };
  }

  /**
   * 组装上下文
   */
  async assembleContext(sessionId, options = {}) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        messages: [],
        estimatedTokens: 0
      };
    }

    const maxMessages = options.maxMessages || this.options.maxMessages;
    const messages = session.messages.slice(-maxMessages);

    // 估算 token 数量
    const estimatedTokens = this.estimateTokens(messages);

    return {
      messages,
      estimatedTokens,
      systemPromptAddition: options.systemPromptAddition
    };
  }

  /**
   * 压缩上下文
   */
  async compactContext(sessionId, options = {}) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        ok: false,
        compacted: false,
        reason: 'Session not found'
      };
    }

    const targetTokens = options.targetTokens || this.options.maxTokens;
    const currentTokens = this.estimateTokens(session.messages);

    if (currentTokens <= targetTokens) {
      return {
        ok: true,
        compacted: false,
        reason: 'Context already within token budget',
        tokensBefore: currentTokens,
        tokensAfter: currentTokens
      };
    }

    // 压缩策略：保留最近的消息
    const keepRatio = targetTokens / currentTokens;
    const keepCount = Math.floor(session.messages.length * keepRatio);
    const compactedMessages = session.messages.slice(-Math.max(keepCount, 10));

    const tokensAfter = this.estimateTokens(compactedMessages);

    session.messages = compactedMessages;
    session.updatedAt = Date.now();

    this.sessions.set(sessionId, session);

    return {
      ok: true,
      compacted: true,
      reason: 'Compacted by keeping recent messages',
      tokensBefore: currentTokens,
      tokensAfter,
      firstKeptEntryId: compactedMessages[0]?.id
    };
  }

  /**
   * 获取会话
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId) {
    this.sessions.delete(sessionId);
    this.contextStore.delete(sessionId);
  }

  /**
   * 列出所有会话
   */
  listSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * 保存会话到文件
   */
  async saveSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const sessionFile = path.join(this.options.storageDir, `${sessionId}.json`);
    await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
  }

  /**
   * 从文件加载会话
   */
  async loadSession(sessionId) {
    const sessionFile = path.join(this.options.storageDir, `${sessionId}.json`);

    try {
      const content = await fs.readFile(sessionFile, 'utf8');
      const session = JSON.parse(content);
      this.sessions.set(sessionId, session);
      return session;
    } catch (err) {
      throw new Error(`Failed to load session: ${err.message}`);
    }
  }

  /**
   * 估算 token 数量
   */
  estimateTokens(messages) {
    if (!Array.isArray(messages)) {
      return 0;
    }

    let totalChars = 0;
    for (const message of messages) {
      if (message.content) {
        totalChars += String(message.content).length;
      }
      if (message.role) {
        totalChars += String(message.role).length;
      }
    }

    // 粗略估算：1 token ≈ 4 字符
    return Math.ceil(totalChars / 4);
  }

  /**
   * 生成消息 ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions(maxAge = 7 * 24 * 60 * 60 * 1000) { // 默认 7 天
    const now = Date.now();
    const expired = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.updatedAt > maxAge) {
        expired.push(sessionId);
      }
    }

    for (const sessionId of expired) {
      await this.deleteSession(sessionId);
      try {
        const sessionFile = path.join(this.options.storageDir, `${sessionId}.json`);
        await fs.unlink(sessionFile);
      } catch {
        // 忽略删除失败
      }
    }

    return expired.length;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
    const totalTokens = sessions.reduce((sum, s) => sum + this.estimateTokens(s.messages), 0);

    return {
      sessionCount: sessions.length,
      totalMessages,
      totalTokens,
      avgMessagesPerSession: sessions.length > 0 ? totalMessages / sessions.length : 0
    };
  }
}

// ==================== 全局上下文引擎实例 ====================

let globalContextEngine = null;

/**
 * 获取全局上下文引擎实例
 */
function getContextEngine() {
  if (!globalContextEngine) {
    globalContextEngine = new ContextEngine();
  }
  return globalContextEngine;
}

/**
 * 设置全局上下文引擎实例
 */
function setContextEngine(engine) {
  globalContextEngine = engine;
}

// ==================== 辅助函数 ====================

/**
 * 创建上下文管理器（用于特定会话）
 */
function createContextManager(sessionId) {
  const engine = getContextEngine();

  return {
    sessionId,
    async addMessage(message) {
      return await engine.ingestMessage(sessionId, message);
    },
    async getContext(options) {
      return await engine.assembleContext(sessionId, options);
    },
    async compact(options) {
      return await engine.compactContext(sessionId, options);
    },
    getSession() {
      return engine.getSession(sessionId);
    },
    async delete() {
      await engine.deleteSession(sessionId);
    }
  };
}

// ==================== 工厂函数（供 MCP 调用）====================

/**
 * 创建上下文引擎实例
 */
function createContextEngine(options = {}) {
  return new ContextEngine(options);
}

// ==================== 导出 ====================

module.exports = {
  ContextEngine,
  getContextEngine,
  setContextEngine,
  createContextManager,
  createContextEngine
};