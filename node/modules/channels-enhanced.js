/**
 * iFlow Enhanced Channels Module
 * 整合自 OpenClaw 项目的多渠道统一管理
 * 增强的消息渠道功能：路由、会话绑定、权限控制
 */

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(__dirname, '..', 'channels-config.json');

// ==================== 配置管理 ====================

/**
 * 加载配置
 */
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
      return getDefaultConfig();
    }
  }
  return getDefaultConfig();
}

/**
 * 保存配置
 */
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * 获取默认配置
 */
function getDefaultConfig() {
  return {
    channels: {},
    routing: {},
    sessions: {},
    permissions: {},
    settings: {
      defaultPlatform: 'telegram',
      enableRouting: true,
      enablePermissions: true
    }
  };
}

// ==================== 消息类型 ====================

const MessageTypes = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  STICKER: 'sticker'
};

// ==================== 消息路由 ====================

/**
 * 消息路由器
 */
class MessageRouter {
  constructor(config) {
    this.config = config;
    this.routes = new Map();
    this.defaultRoute = null;
  }

  /**
   * 添加路由
   */
  addRoute(pattern, handler, options = {}) {
    const route = {
      pattern: pattern instanceof RegExp ? pattern : new RegExp(pattern),
      handler,
      priority: options.priority || 0,
      platform: options.platform || null,
      channel: options.channel || null
    };
    this.routes.set(route.pattern.toString(), route);
  }

  /**
   * 设置默认路由
   */
  setDefaultRoute(handler) {
    this.defaultRoute = handler;
  }

  /**
   * 路由消息
   */
  async route(message) {
    const { platform, channel, text } = message;
    
    // 按优先级排序路由
    const sortedRoutes = Array.from(this.routes.values())
      .sort((a, b) => b.priority - a.priority);

    for (const route of sortedRoutes) {
      // 平台过滤
      if (route.platform && route.platform !== platform) {
        continue;
      }

      // 渠道过滤
      if (route.channel && route.channel !== channel) {
        continue;
      }

      // 模式匹配
      if (route.pattern.test(text)) {
        return await route.handler(message);
      }
    }

    // 默认路由
    if (this.defaultRoute) {
      return await this.defaultRoute(message);
    }

    return null;
  }
}

// ==================== 会话管理 ====================

/**
 * 会话管理器
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.messageHistory = new Map();
  }

  /**
   * 创建会话
   */
  createSession(sessionId, options = {}) {
    const session = {
      id: sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      platform: options.platform || 'unknown',
      channel: options.channel || 'default',
      userId: options.userId || null,
      metadata: options.metadata || {},
      state: options.state || {}
    };
    
    this.sessions.set(sessionId, session);
    this.messageHistory.set(sessionId, []);
    
    return session;
  }

  /**
   * 获取会话
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 更新会话
   */
  updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    Object.assign(session, updates, { updatedAt: Date.now() });
    return session;
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId) {
    this.sessions.delete(sessionId);
    this.messageHistory.delete(sessionId);
  }

  /**
   * 添加消息到历史
   */
  addMessage(sessionId, message) {
    const history = this.messageHistory.get(sessionId) || [];
    history.push({
      ...message,
      timestamp: Date.now()
    });
    
    // 限制历史大小
    if (history.length > 100) {
      history.shift();
    }
    
    this.messageHistory.set(sessionId, history);
  }

  /**
   * 获取消息历史
   */
  getMessageHistory(sessionId, limit = 10) {
    const history = this.messageHistory.get(sessionId) || [];
    return history.slice(-limit);
  }

  /**
   * 绑定消息到会话
   */
  bindMessageToSession(message) {
    const { sessionId } = message;
    
    if (!sessionId) {
      // 自动生成会话 ID
      const autoSessionId = `${message.platform}:${message.channel}:${message.userId}`;
      this.createSession(autoSessionId, {
        platform: message.platform,
        channel: message.channel,
        userId: message.userId
      });
      return autoSessionId;
    }

    if (!this.sessions.has(sessionId)) {
      this.createSession(sessionId, {
        platform: message.platform,
        channel: message.channel,
        userId: message.userId
      });
    }

    return sessionId;
  }
}

// ==================== 权限管理 ====================

/**
 * 权限管理器
 */
class PermissionManager {
  constructor() {
    this.permissions = new Map();
    this.roles = new Map();
  }

  /**
   * 添加角色
   */
  addRole(name, permissions = []) {
    this.roles.set(name, new Set(permissions));
  }

  /**
   * 添加用户权限
   */
  addUserPermissions(userId, permissions = []) {
    const userPerms = this.permissions.get(userId) || new Set();
    permissions.forEach(perm => userPerms.add(perm));
    this.permissions.set(userId, userPerms);
  }

  /**
   * 检查权限
   */
  hasPermission(userId, permission) {
    const userPerms = this.permissions.get(userId);
    if (userPerms && userPerms.has(permission)) {
      return true;
    }
    return false;
  }

  /**
   * 检查角色权限
   */
  hasRolePermission(roleName, permission) {
    const rolePerms = this.roles.get(roleName);
    return rolePerms ? rolePerms.has(permission) : false;
  }

  /**
   * 设置用户角色
   */
  setUserRole(userId, roleName) {
    const rolePerms = this.roles.get(roleName) || new Set();
    this.permissions.set(userId, rolePerms);
  }
}

// ==================== 消息去重 ====================

/**
 * 消息去重器
 */
class MessageDeduplicator {
  constructor() {
    this.seenMessages = new Map();
    this.ttl = 60000; // 1 分钟
  }

  /**
   * 生成消息 ID
   */
  generateMessageId(message) {
    return `${message.platform}:${message.channel}:${message.userId}:${message.timestamp}:${message.text}`;
  }

  /**
   * 检查是否已处理
   */
  isSeen(message) {
    const messageId = this.generateMessageId(message);
    const seenAt = this.seenMessages.get(messageId);
    
    if (!seenAt) {
      return false;
    }

    // 检查是否过期
    if (Date.now() - seenAt > this.ttl) {
      this.seenMessages.delete(messageId);
      return false;
    }

    return true;
  }

  /**
   * 标记为已处理
   */
  markSeen(message) {
    const messageId = this.generateMessageId(message);
    this.seenMessages.set(messageId, Date.now());
  }

  /**
   * 清理过期记录
   */
  cleanup() {
    const now = Date.now();
    for (const [messageId, seenAt] of this.seenMessages.entries()) {
      if (now - seenAt > this.ttl) {
        this.seenMessages.delete(messageId);
      }
    }
  }
}

// ==================== 会话管理增强 ====================

/**
 * 输入来源追踪器
 */
class InputProvenanceTracker {
  constructor() {
    this.kinds = ['external_user', 'inter_session', 'internal_system'];
    this.provenance = new Map();
  }

  /**
   * 标准化输入来源
   */
  normalizeProvenance(value) {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const normalized = {
      kind: 'external_user',
      originSessionId: undefined,
      sourceSessionKey: undefined,
      sourceChannel: undefined,
      sourceTool: undefined
    };

    if (this.kinds.includes(value.kind)) {
      normalized.kind = value.kind;
    }

    if (typeof value.originSessionId === 'string') {
      normalized.originSessionId = value.originSessionId.trim() || undefined;
    }

    if (typeof value.sourceSessionKey === 'string') {
      normalized.sourceSessionKey = value.sourceSessionKey.trim() || undefined;
    }

    if (typeof value.sourceChannel === 'string') {
      normalized.sourceChannel = value.sourceChannel.trim() || undefined;
    }

    if (typeof value.sourceTool === 'string') {
      normalized.sourceTool = value.sourceTool.trim() || undefined;
    }

    return normalized;
  }

  /**
   * 记录输入来源
   */
  track(sessionId, provenance) {
    const normalized = this.normalizeProvenance(provenance);
    if (normalized) {
      this.provenance.set(sessionId, normalized);
    }
  }

  /**
   * 获取输入来源
   */
  getProvenance(sessionId) {
    return this.provenance.get(sessionId);
  }

  /**
   * 应用来源到消息
   */
  applyToMessage(message, provenance) {
    const normalized = this.normalizeProvenance(provenance);
    if (!normalized) {
      return message;
    }

    if (message.role !== 'user') {
      return message;
    }

    return {
      ...message,
      provenance: normalized
    };
  }

  /**
   * 清除来源记录
   */
  clear(sessionId) {
    this.provenance.delete(sessionId);
  }

  /**
   * 清除所有记录
   */
  clearAll() {
    this.provenance.clear();
  }
}

/**
 * 会话转录事件管理器
 */
class TranscriptEventManager {
  constructor() {
    this.listeners = new Set();
  }

  /**
   * 监听会话更新
   */
  onUpdate(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 发出更新事件
   */
  emit(sessionFile) {
    const trimmed = sessionFile.trim();
    if (!trimmed) {
      return;
    }

    const update = { sessionFile: trimmed };
    
    for (const listener of this.listeners) {
      try {
        listener(update);
      } catch (err) {
        console.error('Transcript event listener error:', err);
      }
    }
  }

  /**
   * 清除所有监听器
   */
  clearAll() {
    this.listeners.clear();
  }

  /**
   * 获取监听器数量
   */
  getListenerCount() {
    return this.listeners.size;
  }
}

/**
 * 发送策略管理器
 */
class SendPolicyManager {
  constructor() {
    this.policies = new Map();
    this.globalPolicy = 'allow';
  }

  /**
   * 标准化策略
   */
  normalizePolicy(raw) {
    const value = raw?.trim().toLowerCase();
    if (value === 'allow') {
      return 'allow';
    }
    if (value === 'deny') {
      return 'deny';
    }
    return undefined;
  }

  /**
   * 设置会话策略
   */
  setPolicy(sessionId, policy) {
    const normalized = this.normalizePolicy(policy);
    if (normalized) {
      this.policies.set(sessionId, normalized);
    }
  }

  /**
   * 获取会话策略
   */
  getPolicy(sessionId) {
    return this.policies.get(sessionId);
  }

  /**
   * 解析策略（考虑渠道和类型覆盖）
   */
  resolvePolicy(sessionId, channel, chatType) {
    const sessionPolicy = this.policies.get(sessionId);
    if (sessionPolicy) {
      return sessionPolicy;
    }

    // 检查渠道策略
    const channelKey = `channel:${channel}`;
    if (this.policies.has(channelKey)) {
      return this.policies.get(channelKey);
    }

    // 检查类型策略
    if (chatType) {
      const typeKey = `type:${chatType}`;
      if (this.policies.has(typeKey)) {
        return this.policies.get(typeKey);
      }
    }

    return this.globalPolicy;
  }

  /**
   * 检查是否允许发送
   */
  isAllowed(sessionId, channel, chatType) {
    const policy = this.resolvePolicy(sessionId, channel, chatType);
    return policy === 'allow';
  }

  /**
   * 设置渠道策略
   */
  setChannelPolicy(channel, policy) {
    const normalized = this.normalizePolicy(policy);
    if (normalized) {
      this.policies.set(`channel:${channel}`, normalized);
    }
  }

  /**
   * 设置类型策略
   */
  setTypePolicy(chatType, policy) {
    const normalized = this.normalizePolicy(policy);
    if (normalized) {
      this.policies.set(`type:${chatType}`, normalized);
    }
  }

  /**
   * 设置全局策略
   */
  setGlobalPolicy(policy) {
    const normalized = this.normalizePolicy(policy);
    if (normalized) {
      this.globalPolicy = normalized;
    }
  }

  /**
   * 清除策略
   */
  clearPolicy(sessionId) {
    this.policies.delete(sessionId);
  }

  /**
   * 清除所有策略
   */
  clearAll() {
    this.policies.clear();
  }
}

// 全局实例
const inputProvenanceTracker = new InputProvenanceTracker();
const transcriptEventManager = new TranscriptEventManager();
const sendPolicyManager = new SendPolicyManager();

// ==================== 导出 ====================

// ==================== 路由管理增强 ====================

/**
 * 账户 ID 管理器
 */
class AccountIdManager {
  constructor() {
    this.defaultAccountId = 'default';
    this.validIdRe = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
    this.invalidCharsRe = /[^a-z0-9_-]+/g;
    this.cache = new Map();
    this.maxCacheSize = 512;
  }

  /**
   * 标准化账户 ID
   */
  normalizeAccountId(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return this.defaultAccountId;
    }

    if (this.cache.has(trimmed)) {
      return this.cache.get(trimmed);
    }

    let normalized = trimmed.toLowerCase();
    
    // 如果已经是有效格式
    if (this.validIdRe.test(normalized)) {
      this.updateCache(trimmed, normalized);
      return normalized;
    }

    // 替换无效字符
    normalized = normalized
      .replace(this.invalidCharsRe, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
      .slice(0, 64);

    // 如果结果为空，返回默认值
    if (!normalized) {
      normalized = this.defaultAccountId;
    }

    this.updateCache(trimmed, normalized);
    return normalized;
  }

  /**
   * 标准化可选账户 ID
   */
  normalizeOptionalAccountId(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return undefined;
    }

    if (this.cache.has(trimmed)) {
      return this.cache.get(trimmed);
    }

    let normalized = trimmed.toLowerCase();
    
    if (this.validIdRe.test(normalized)) {
      this.updateCache(trimmed, normalized);
      return normalized;
    }

    normalized = normalized
      .replace(this.invalidCharsRe, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
      .slice(0, 64);

    if (!normalized) {
      return undefined;
    }

    this.updateCache(trimmed, normalized);
    return normalized;
  }

  /**
   * 更新缓存
   */
  updateCache(key, value) {
    this.cache.set(key, value);
    if (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * 验证账户 ID
   */
  isValidAccountId(accountId) {
    return this.validIdRe.test(accountId);
  }

  /**
   * 获取默认账户 ID
   */
  getDefaultAccountId() {
    return this.defaultAccountId;
  }
}

/**
 * 账户查找器
 */
class AccountLookup {
  constructor() {
    this.accounts = new Map();
  }

  /**
   * 添加账户
   */
  addAccount(accountId, accountData) {
    this.accounts.set(accountId, accountData);
  }

  /**
   * 删除账户
   */
  removeAccount(accountId) {
    return this.accounts.delete(accountId);
  }

  /**
   * 查找账户（支持大小写不敏感）
   */
  lookupAccount(accountId) {
    if (this.accounts.has(accountId)) {
      return this.accounts.get(accountId);
    }

    const normalized = accountId.toLowerCase();
    for (const [key, value] of this.accounts.entries()) {
      if (key.toLowerCase() === normalized) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * 列出所有账户
   */
  listAccounts() {
    return Array.from(this.accounts.keys());
  }

  /**
   * 查找多个账户
   */
  lookupAccounts(accountIds) {
    return accountIds
      .map(id => this.lookupAccount(id))
      .filter(account => account !== undefined);
  }
}

/**
 * 绑定规则管理器
 */
class BindingManager {
  constructor() {
    this.bindings = [];
  }

  /**
   * 添加绑定规则
   */
  addBinding(binding) {
    this.bindings.push({
      agentId: binding.agentId,
      accountId: binding.accountId || '*',
      channelId: binding.channelId || '*',
      priority: binding.priority || 0,
      enabled: binding.enabled !== false
    });

    // 按优先级排序
    this.bindings.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 删除绑定规则
   */
  removeBinding(agentId, accountId, channelId) {
    this.bindings = this.bindings.filter(
      b => !(b.agentId === agentId && b.accountId === accountId && b.channelId === channelId)
    );
  }

  /**
   * 查找匹配的绑定
   */
  findMatches(channelId, accountId) {
    return this.bindings.filter(binding => {
      if (!binding.enabled) return false;
      
      const channelMatch = binding.channelId === '*' || binding.channelId === channelId;
      const accountMatch = binding.accountId === '*' || binding.accountId === accountId;
      
      return channelMatch && accountMatch;
    });
  }

  /**
   * 查找最佳匹配（按优先级）
   */
  findBestMatch(channelId, accountId) {
    const matches = this.findMatches(channelId, accountId);
    return matches.length > 0 ? matches[0] : undefined;
  }

  /**
   * 列出所有绑定
   */
  listBindings() {
    return this.bindings;
  }

  /**
   * 列出渠道的绑定账户
   */
  listBoundAccounts(channelId) {
    const accounts = new Set();
    for (const binding of this.bindings) {
      if (binding.channelId === channelId && binding.accountId !== '*') {
        accounts.add(binding.accountId);
      }
    }
    return Array.from(accounts);
  }

  /**
   * 清空绑定
   */
  clear() {
    this.bindings = [];
  }
}

// 全局实例
const accountIdManager = new AccountIdManager();
const accountLookup = new AccountLookup();
const bindingManager = new BindingManager();

module.exports = {
  // 配置
  loadConfig,
  saveConfig,
  getDefaultConfig,

  // 消息类型
  MessageTypes,

  // 消息路由
  MessageRouter,

  // 会话管理
  SessionManager,

  // 权限管理
  PermissionManager,

  // 消息去重
  MessageDeduplicator,

  // 路由管理增强
  AccountIdManager,
  AccountLookup,
  BindingManager,
  accountIdManager,
  accountLookup,
  bindingManager,

  // 会话管理增强
  InputProvenanceTracker,
  TranscriptEventManager,
  SendPolicyManager,
  inputProvenanceTracker,
  transcriptEventManager,
  sendPolicyManager
};