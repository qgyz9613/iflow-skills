/**
 * iFlow Memory Module v2.0
 * 支持向量搜索的增强记忆系统
 * 支持 SQLite (better-sqlite3) 或 JSON 文件存储
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'memory-data');
const MEMORY_FILE = path.join(DATA_DIR, 'memories.json');
const CONVERSATIONS_DIR = path.join(DATA_DIR, 'conversations');
const DAILY_DIR = path.join(DATA_DIR, 'daily');

// 确保目录存在
[DATA_DIR, CONVERSATIONS_DIR, DAILY_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 尝试加载 better-sqlite3
let db = null;
let useSQLite = false;

try {
  const Database = require('better-sqlite3');
  const dbPath = path.join(DATA_DIR, 'memory.db');
  db = new Database(dbPath);
  
  // 创建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      tags TEXT DEFAULT '[]',
      importance INTEGER DEFAULT 5,
      embedding BLOB,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_category ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_importance ON memories(importance);
  `);
  
  useSQLite = true;
  console.log('[Memory] Using SQLite storage with vector support');
} catch (e) {
  console.log('[Memory] better-sqlite3 not available, using JSON file storage');
}

// ============================================================
// JSON 文件存储 (回退方案)
// ============================================================

function loadMemoriesFromJSON() {
  if (fs.existsSync(MEMORY_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    } catch {
      return [];
    }
  }
  return [];
}

function saveMemoriesToJSON(memories) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2));
}

// ============================================================
// 核心操作
// ============================================================

// 保存记忆
function save(content, options = {}) {
  const start = Date.now();
  try {
    const id = uuidv4();
    const category = options.category || 'general';
    const tags = options.tags || [];
    const importance = options.importance || 5;
    const embedding = options.embedding || null;
    const now = new Date().toISOString();
    
    if (useSQLite && db) {
      const stmt = db.prepare(`
        INSERT INTO memories (id, content, category, tags, importance, embedding, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const embeddingBuffer = embedding ? Buffer.from(new Float32Array(embedding).buffer) : null;
      stmt.run(id, content, category, JSON.stringify(tags), importance, embeddingBuffer, now, now);
    } else {
      const memories = loadMemoriesFromJSON();
      memories.push({
        id,
        content,
        category,
        tags,
        importance,
        embedding,
        created_at: now,
        updated_at: now
      });
      saveMemoriesToJSON(memories);
    }
    
    return { status: 'ok', id, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 检索记忆
function remember(query, options = {}) {
  const start = Date.now();
  try {
    // 参数类型校验
    if (query === null || query === undefined) {
      return { status: 'ok', results: [], time: Date.now() - start };
    }
    if (typeof query !== 'string') {
      query = String(query);
    }
    
    const limit = options.limit || 10;
    const minImportance = options.minImportance || 0;
    const categories = options.categories || null;
    
    let results;
    
    if (useSQLite && db) {
      let sql = `
        SELECT id, content, category, tags, importance, created_at
        FROM memories
        WHERE importance >= ?
      `;
      const params = [minImportance];
      
      if (categories && categories.length > 0) {
        sql += ` AND category IN (${categories.map(() => '?').join(',')})`;
        params.push(...categories);
      }
      
      // 关键词匹配
      sql += ` AND content LIKE ?`;
      params.push(`%${query}%`);
      
      sql += ` ORDER BY importance DESC, created_at DESC LIMIT ?`;
      params.push(limit);
      
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      
      results = rows.map(row => ({
        id: row.id,
        content: row.content,
        category: row.category,
        tags: JSON.parse(row.tags || '[]'),
        importance: row.importance,
        score: 1,
        createdAt: row.created_at
      }));
    } else {
      const memories = loadMemoriesFromJSON();
      const q = query.toLowerCase();
      
      results = memories
        .filter(m => {
          if (m.importance < minImportance) return false;
          if (categories && !categories.includes(m.category)) return false;
          return m.content.toLowerCase().includes(q) || 
                 m.tags.some(t => t.toLowerCase().includes(q));
        })
        .slice(0, limit)
        .map(m => ({ ...m, score: 1, createdAt: m.created_at }));
    }
    
    return { status: 'ok', results, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 向量相似度搜索
function vectorSearch(embedding, options = {}) {
  const start = Date.now();
  try {
    if (!useSQLite || !db) {
      return { status: 'error', message: 'Vector search requires SQLite (better-sqlite3)', time: Date.now() - start };
    }
    
    const limit = options.limit || 10;
    const threshold = options.threshold || 0.7;
    
    // 获取所有有 embedding 的记忆
    const stmt = db.prepare(`
      SELECT id, content, category, tags, importance, embedding, created_at
      FROM memories
      WHERE embedding IS NOT NULL
    `);
    const rows = stmt.all();
    
    // 计算相似度
    const queryVec = new Float32Array(embedding);
    const results = rows.map(row => {
      const storedVec = new Float32Array(row.embedding.buffer);
      const similarity = cosineSimilarity(queryVec, storedVec);
      return {
        id: row.id,
        content: row.content,
        category: row.category,
        tags: JSON.parse(row.tags || '[]'),
        importance: row.importance,
        similarity,
        createdAt: row.created_at
      };
    })
    .filter(r => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
    
    return { status: 'ok', results, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 余弦相似度
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 列出记忆
function list(options = {}) {
  const start = Date.now();
  try {
    const category = options.category;
    const limit = options.limit || 50;
    const minImportance = options.minImportance || 0;
    
    let results;
    
    if (useSQLite && db) {
      let sql = `
        SELECT id, content, category, tags, importance, created_at
        FROM memories
        WHERE importance >= ?
      `;
      const params = [minImportance];
      
      if (category) {
        sql += ` AND category = ?`;
        params.push(category);
      }
      
      sql += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);
      
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      
      results = rows.map(row => ({
        id: row.id,
        content: row.content,
        category: row.category,
        tags: JSON.parse(row.tags || '[]'),
        importance: row.importance,
        createdAt: row.created_at
      }));
      
      // 获取总数
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM memories');
      const total = countStmt.get().count;
      
      return { status: 'ok', results, total, time: Date.now() - start };
    } else {
      const memories = loadMemoriesFromJSON();
      
      let filtered = memories.filter(m => m.importance >= minImportance);
      if (category) {
        filtered = filtered.filter(m => m.category === category);
      }
      
      results = filtered.slice(-limit);
      
      return { status: 'ok', results, total: memories.length, time: Date.now() - start };
    }
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 删除记忆
function remove(id) {
  const start = Date.now();
  try {
    if (useSQLite && db) {
      const stmt = db.prepare('DELETE FROM memories WHERE id = ?');
      stmt.run(id);
    } else {
      const memories = loadMemoriesFromJSON();
      const index = memories.findIndex(m => m.id === id);
      if (index >= 0) {
        memories.splice(index, 1);
        saveMemoriesToJSON(memories);
      }
    }
    
    return { status: 'ok', id, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 更新记忆
function update(id, content, options = {}) {
  const start = Date.now();
  try {
    const now = new Date().toISOString();
    
    if (useSQLite && db) {
      const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
      if (memory) {
        const stmt = db.prepare(`
          UPDATE memories 
          SET content = ?, category = ?, importance = ?, updated_at = ?
          WHERE id = ?
        `);
        stmt.run(
          content,
          options.category || memory.category,
          options.importance || memory.importance,
          now,
          id
        );
      }
    } else {
      const memories = loadMemoriesFromJSON();
      const memory = memories.find(m => m.id === id);
      if (memory) {
        memory.content = content;
        if (options.category) memory.category = options.category;
        if (options.importance) memory.importance = options.importance;
        memory.updated_at = now;
        saveMemoriesToJSON(memories);
      }
    }
    
    return { status: 'ok', id, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 统计
function stats() {
  const start = Date.now();
  try {
    let total, byCategory, avgImportance;
    
    if (useSQLite && db) {
      const totalStmt = db.prepare('SELECT COUNT(*) as count FROM memories');
      total = totalStmt.get().count;
      
      const categoryStmt = db.prepare('SELECT category, COUNT(*) as count FROM memories GROUP BY category');
      const categoryRows = categoryStmt.all();
      byCategory = {};
      categoryRows.forEach(row => {
        byCategory[row.category] = row.count;
      });
      
      const avgStmt = db.prepare('SELECT AVG(importance) as avg FROM memories');
      avgImportance = avgStmt.get().avg || 0;
    } else {
      const memories = loadMemoriesFromJSON();
      total = memories.length;
      byCategory = {};
      memories.forEach(m => {
        byCategory[m.category] = (byCategory[m.category] || 0) + 1;
      });
      avgImportance = memories.length > 0 
        ? memories.reduce((sum, m) => sum + m.importance, 0) / memories.length 
        : 0;
    }
    
    return { 
      status: 'ok', 
      total, 
      byCategory, 
      avgImportance,
      storage: useSQLite ? 'sqlite' : 'json',
      vectorSupport: useSQLite,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ============================================================
// 对话管理
// ============================================================

// 保存对话
function saveConversation(messages, summary = null) {
  const start = Date.now();
  try {
    const sessionId = uuidv4();
    const conversationPath = path.join(CONVERSATIONS_DIR, `${sessionId}.json`);
    
    fs.writeFileSync(conversationPath, JSON.stringify({
      id: sessionId,
      messages,
      summary,
      created_at: new Date().toISOString()
    }, null, 2));
    
    // 如果有摘要，保存为记忆
    if (summary) {
      save(summary, {
        category: 'conversation',
        tags: ['session', sessionId]
      });
    }
    
    return { status: 'ok', sessionId, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 加载对话
function loadConversation(sessionId) {
  const start = Date.now();
  try {
    const conversationPath = path.join(CONVERSATIONS_DIR, `${sessionId}.json`);
    
    if (!fs.existsSync(conversationPath)) {
      return { status: 'error', message: 'Conversation not found', time: Date.now() - start };
    }
    
    const conversation = JSON.parse(fs.readFileSync(conversationPath, 'utf8'));
    return { status: 'ok', conversation, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 列出对话
function listConversations(limit = 20) {
  const start = Date.now();
  try {
    const files = fs.readdirSync(CONVERSATIONS_DIR).filter(f => f.endsWith('.json'));
    
    const conversations = files.map(f => {
      try {
        const conv = JSON.parse(fs.readFileSync(path.join(CONVERSATIONS_DIR, f), 'utf8'));
        return {
          id: conv.id,
          summary: conv.summary?.slice(0, 100),
          messageCount: conv.messages?.length,
          created_at: conv.created_at
        };
      } catch {
        return null;
      }
    }).filter(Boolean)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
    
    return { status: 'ok', conversations, total: files.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ============================================================
// 每日笔记
// ============================================================

// 写入每日笔记
function writeDaily(content, tags = []) {
  const start = Date.now();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dailyPath = path.join(DAILY_DIR, `${today}.md`);
    
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    const entry = `\n## ${timestamp}\n\n${content}\n`;
    
    if (fs.existsSync(dailyPath)) {
      const existing = fs.readFileSync(dailyPath, 'utf-8');
      fs.writeFileSync(dailyPath, existing + entry);
    } else {
      fs.writeFileSync(dailyPath, `# ${today}\n\n${entry}`);
    }
    
    return { status: 'ok', path: dailyPath, date: today, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 读取每日笔记
function readDaily(date = null) {
  const start = Date.now();
  try {
    const dateStr = date || new Date().toISOString().slice(0, 10);
    const dailyPath = path.join(DAILY_DIR, `${dateStr}.md`);
    
    if (fs.existsSync(dailyPath)) {
      const content = fs.readFileSync(dailyPath, 'utf8');
      return { status: 'ok', content, date: dateStr, time: Date.now() - start };
    }
    
    return { status: 'ok', content: '', date: dateStr, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ============================================================
// 长期记忆
// ============================================================

// 写入长期记忆文件
function writeLongTerm(content, mode = 'append') {
  const start = Date.now();
  try {
    const longTermPath = path.join(DATA_DIR, 'MEMORY.md');
    
    if (mode === 'overwrite' || !fs.existsSync(longTermPath)) {
      fs.writeFileSync(longTermPath, content);
    } else {
      const existing = fs.readFileSync(longTermPath, 'utf-8');
      fs.writeFileSync(longTermPath, existing + '\n\n' + content);
    }
    
    return { status: 'ok', path: longTermPath, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 读取长期记忆
function readLongTerm() {
  const start = Date.now();
  try {
    const longTermPath = path.join(DATA_DIR, 'MEMORY.md');
    
    if (fs.existsSync(longTermPath)) {
      const content = fs.readFileSync(longTermPath, 'utf8');
      return { status: 'ok', content, time: Date.now() - start };
    }
    
    return { status: 'ok', content: '', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ============================================================
// 模块导出
// ============================================================

module.exports = {
  // 核心
  save,
  remember,
  list,
  remove,
  update,
  stats,
  
  // 向量搜索
  vectorSearch,
  
  // 对话
  saveConversation,
  loadConversation,
  listConversations,
  
  // 每日笔记
  writeDaily,
  readDaily,
  
  // 长期记忆
  writeLongTerm,
  readLongTerm
};
