/**
 * iFlow Session Module
 * 会话管理
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const SESSION_DIR = path.join(__dirname, '..', 'sessions');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// 创建会话
function create(options = {}) {
  const start = Date.now();
  try {
    const id = uuidv4();
    const session = {
      id,
      name: options.name || `Session ${id.slice(0, 8)}`,
      model: options.model || 'default',
      tags: options.tags || [],
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const filePath = path.join(SESSION_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    
    return { status: 'ok', session, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 加载会话
function load(sessionId) {
  const start = Date.now();
  try {
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'Session not found', time: Date.now() - start };
    }
    
    const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { status: 'ok', session, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 添加消息
function addMessage(sessionId, role, content) {
  const start = Date.now();
  try {
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'Session not found', time: Date.now() - start };
    }
    
    const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    session.messages.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    session.updated_at = new Date().toISOString();
    
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    
    return { status: 'ok', message: session.messages[session.messages.length - 1], time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取消息
function getMessages(sessionId, options = {}) {
  const start = Date.now();
  try {
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'Session not found', time: Date.now() - start };
    }
    
    const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let messages = session.messages;
    
    if (options.limit) {
      const offset = options.offset || 0;
      messages = messages.slice(offset, offset + options.limit);
    }
    
    return { status: 'ok', messages, total: session.messages.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 列出会话
function list(options = {}) {
  const start = Date.now();
  try {
    const files = fs.readdirSync(SESSION_DIR).filter(f => f.endsWith('.json'));
    const limit = options.limit || 20;
    
    const sessions = files.slice(0, limit).map(f => {
      try {
        const session = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, f), 'utf8'));
        return {
          id: session.id,
          name: session.name,
          model: session.model,
          tags: session.tags,
          messageCount: session.messages.length,
          created_at: session.created_at,
          updated_at: session.updated_at
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    // 按更新时间排序
    sessions.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    
    return { status: 'ok', sessions, total: files.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 删除会话
function remove(sessionId) {
  const start = Date.now();
  try {
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return { status: 'ok', id: sessionId, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 导出会话
function exportSession(sessionId, format = 'json') {
  const start = Date.now();
  try {
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'Session not found', time: Date.now() - start };
    }
    
    const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (format === 'markdown' || format === 'md') {
      let md = `# ${session.name}\n\n`;
      md += `Created: ${session.created_at}\n\n`;
      
      for (const msg of session.messages) {
        md += `### ${msg.role}\n${msg.content}\n\n`;
      }
      
      return { status: 'ok', content: md, format: 'markdown', time: Date.now() - start };
    }
    
    return { status: 'ok', content: JSON.stringify(session, null, 2), format: 'json', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 压缩会话（保留最近N条，其余转为摘要）
function compress(sessionId, keepLast = 10) {
  const start = Date.now();
  try {
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { status: 'error', message: 'Session not found', time: Date.now() - start };
    }
    
    const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (session.messages.length <= keepLast) {
      return { status: 'ok', message: 'No compression needed', time: Date.now() - start };
    }
    
    const oldMessages = session.messages.slice(0, -keepLast);
    const recentMessages = session.messages.slice(-keepLast);
    
    // 创建摘要
    const summary = {
      role: 'system',
      content: `[Previous ${oldMessages.length} messages summarized]`,
      timestamp: new Date().toISOString(),
      compressed: true,
      originalCount: oldMessages.length
    };
    
    session.messages = [summary, ...recentMessages];
    session.updated_at = new Date().toISOString();
    
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    
    return { status: 'ok', compressed: oldMessages.length, remaining: session.messages.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

module.exports = { create, load, addMessage, getMessages, list, remove, exportSession, compress };
