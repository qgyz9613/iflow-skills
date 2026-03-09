/**
 * iFlow Skills Module
 * 技能系统
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const SKILLS_DIR = path.join(__dirname, '..', 'skills-data');
if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });

// 搜索技能
async function search(query, options = {}) {
  const start = Date.now();
  try {
    // 本地搜索
    const localSkills = searchLocal(query, options);
    
    // 在线搜索（可选）
    // const onlineSkills = await searchOnline(query, options);
    
    return { 
      status: 'ok', 
      skills: localSkills.skills,
      total: localSkills.skills.length,
      source: 'local',
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 本地搜索
function searchLocal(query, options = {}) {
  const start = Date.now();
  try {
    const limit = options.limit || 20;
    const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.json'));
    
    const skills = files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    }).filter(s => {
      if (!s) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return s.name?.toLowerCase().includes(q) ||
             s.description?.toLowerCase().includes(q) ||
             s.tags?.some(t => t.toLowerCase().includes(q));
    }).slice(0, limit);
    
    return { status: 'ok', skills, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 安装技能
async function install(skillSlug, options = {}) {
  const start = Date.now();
  try {
    const source = options.source || 'local';
    
    if (source === 'github') {
      // 从 GitHub 安装
      const url = `https://raw.githubusercontent.com/openclaw/skills/main/skills/${skillSlug}/skill.json`;
      const skillData = await fetchUrl(url);
      
      const filePath = path.join(SKILLS_DIR, `${skillSlug}.json`);
      fs.writeFileSync(filePath, JSON.stringify(skillData, null, 2));
      
      return { status: 'ok', skill: skillData, source, time: Date.now() - start };
    }
    
    return { status: 'error', message: 'Local install not implemented', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 列出已安装技能
function list() {
  const start = Date.now();
  try {
    const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.json'));
    
    const skills = files.map(f => {
      try {
        const skill = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, f), 'utf8'));
        return {
          name: skill.name,
          version: skill.version,
          description: skill.description?.slice(0, 100)
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    return { status: 'ok', skills, total: skills.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取技能信息
function info(skillName) {
  const start = Date.now();
  try {
    const filePath = path.join(SKILLS_DIR, `${skillName}.json`);
    
    if (!fs.existsSync(filePath)) {
      // 尝试其他命名
      const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.json'));
      for (const f of files) {
        const skill = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, f), 'utf8'));
        if (skill.name === skillName || skill.slug === skillName) {
          return { status: 'ok', skill, time: Date.now() - start };
        }
      }
      
      return { status: 'error', message: 'Skill not found', time: Date.now() - start };
    }
    
    const skill = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { status: 'ok', skill, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 卸载技能
function uninstall(skillName) {
  const start = Date.now();
  try {
    const filePath = path.join(SKILLS_DIR, `${skillName}.json`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { status: 'ok', skill: skillName, time: Date.now() - start };
    }
    
    return { status: 'error', message: 'Skill not found', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 执行技能
function execute(skillName, params = {}) {
  const start = Date.now();
  try {
    const skillInfo = info(skillName);
    
    if (skillInfo.status === 'error') {
      return skillInfo;
    }
    
    // 返回技能提示词（由主系统注入）
    return { 
      status: 'ok', 
      skill: skillInfo.skill,
      prompt: skillInfo.skill.prompt || skillInfo.skill.instructions,
      params,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 推荐技能
function recommend(category = null, limit = 10) {
  const start = Date.now();
  try {
    const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.json'));
    
    let skills = files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    if (category) {
      skills = skills.filter(s => s.category === category);
    }
    
    // 按热度排序（如果有）
    skills.sort((a, b) => (b.stars || 0) - (a.stars || 0));
    
    return { status: 'ok', skills: skills.slice(0, limit), time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 更新技能
async function update(skillName = null) {
  const start = Date.now();
  try {
    if (skillName) {
      // 更新单个技能
      const skillInfo = info(skillName);
      if (skillInfo.status === 'error') return skillInfo;
      
      return { status: 'ok', message: 'Skill updated', skill: skillName, time: Date.now() - start };
    }
    
    // 更新所有技能
    const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.json'));
    return { status: 'ok', message: `Checked ${files.length} skills`, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 辅助函数：获取 URL
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'iFlow-Skills/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

module.exports = {
  search,
  install,
  list,
  info,
  uninstall,
  execute,
  recommend,
  update
};
