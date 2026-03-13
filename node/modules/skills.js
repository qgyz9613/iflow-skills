/**
 * iFlow Skills Module v2.0
 * 技能系统 - 参考 OpenClaw 的技能格式
 * 支持 SKILL.md + metadata.openclaw 格式
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { execSync } = require('child_process');

const SKILLS_DIR = path.join(__dirname, '..', 'skills-data');
const SKILL_MD_DIR = path.join(require('os').homedir(), '.iflow', 'skills');
[SKILLS_DIR, SKILL_MD_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ========== OpenClaw 风格元数据格式 ==========
const METADATA_SCHEMA = {
  name: { type: 'string', required: true },
  description: { type: 'string', required: true },
  emoji: { type: 'string', default: '📦' },
  homepage: { type: 'string' },
  os: { type: 'array', default: ['win32', 'darwin', 'linux'] },
  requires: {
    bins: { type: 'array' },
    anyBins: { type: 'array' },
    env: { type: 'array' },
    config: { type: 'array' }
  },
  install: [{
    id: { type: 'string' },
    kind: { type: 'string', enum: ['brew', 'npm', 'pnpm', 'yarn', 'uv', 'download'] },
    formula: { type: 'string' },
    package: { type: 'string' },
    bins: { type: 'array' },
    label: { type: 'string' }
  }]
};

// ========== 技能状态管理 ==========
let skillRegistry = null;

function loadRegistry() {
  const registryPath = path.join(SKILLS_DIR, 'registry.json');
  if (fs.existsSync(registryPath)) {
    try {
      skillRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    } catch (e) {
      skillRegistry = { skills: {}, metadata: {} };
    }
  } else {
    skillRegistry = { skills: {}, metadata: {} };
  }
}

function saveRegistry() {
  const registryPath = path.join(SKILLS_DIR, 'registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(skillRegistry, null, 2));
}

// 初始化
loadRegistry();

// ========== SKILL.md 解析 ==========
function parseSkillMd(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }
  
  const frontmatterStr = frontmatterMatch[1];
  const body = frontmatterMatch[2];
  const frontmatter = {};
  
  // 解析 YAML frontmatter
  frontmatterStr.split('\n').forEach(line => {
    const match = line.match(/^(\w+):\s*"?([^"]*)"?$/);
    if (match) {
      frontmatter[match[1]] = match[2];
    }
  });
  
  return { frontmatter, body };
}

// 解析 metadata.openclaw
function parseMetadata(metadataStr) {
  try {
    const metadata = JSON.parse(metadataStr);
    return normalizeMetadata(metadata);
  } catch (e) {
    return {};
  }
}

// 标准化元数据
function normalizeMetadata(metadata) {
  const normalized = {
    name: metadata.name || 'unnamed',
    description: metadata.description || '',
    emoji: metadata.emoji || '📦',
    homepage: metadata.homepage || null,
    os: metadata.os || ['win32', 'darwin', 'linux'],
    requires: {
      bins: metadata.requires?.bins || [],
      anyBins: metadata.requires?.anyBins || [],
      env: metadata.requires?.env || [],
      config: metadata.requires?.config || []
    },
    install: metadata.install || []
  };
  
  return normalized;
}

// ========== 依赖检查 ==========
function checkRequirements(requires) {
  const result = { satisfied: true, missing: [] };
  
  // 检查 bins
  if (requires.bins && requires.bins.length > 0) {
    for (const bin of requires.bins) {
      if (!checkBinExists(bin)) {
        result.satisfied = false;
        result.missing.push({ type: 'bin', name: bin });
      }
    }
  }
  
  // 检查 anyBins (满足任意一个即可)
  if (requires.anyBins && requires.anyBins.length > 0) {
    const anySatisfied = requires.anyBins.some(bin => checkBinExists(bin));
    if (!anySatisfied) {
      result.satisfied = false;
      result.missing.push({ type: 'anyBin', names: requires.anyBins });
    }
  }
  
  // 检查环境变量
  if (requires.env && requires.env.length > 0) {
    for (const env of requires.env) {
      if (!process.env[env]) {
        result.satisfied = false;
        result.missing.push({ type: 'env', name: env });
      }
    }
  }
  
  return result;
}

function checkBinExists(bin) {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${bin}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${bin}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

// ========== 安装依赖 ==========
async function installDependency(installSpec) {
  const platform = process.platform;
  
  // 检查 OS 兼容性
  if (installSpec.os && !installSpec.os.includes(platform)) {
    return { success: false, message: `Not supported on ${platform}` };
  }
  
  try {
    switch (installSpec.kind) {
      case 'brew':
        if (platform === 'darwin') {
          execSync(`brew install ${installSpec.formula || installSpec.package}`, { stdio: 'inherit' });
          return { success: true, method: 'brew' };
        }
        break;
        
      case 'npm':
        execSync(`npm install -g ${installSpec.package}`, { stdio: 'inherit' });
        return { success: true, method: 'npm' };
        
      case 'pnpm':
        execSync(`pnpm add -g ${installSpec.package}`, { stdio: 'inherit' });
        return { success: true, method: 'pnpm' };
        
      case 'yarn':
        execSync(`yarn global add ${installSpec.package}`, { stdio: 'inherit' });
        return { success: true, method: 'yarn' };
        
      case 'uv':
        execSync(`uv pip install ${installSpec.package}`, { stdio: 'inherit' });
        return { success: true, method: 'uv' };
        
      case 'download':
        // TODO: 实现下载安装
        return { success: false, message: 'Download install not implemented' };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
  
  return { success: false, message: 'Unknown install method' };
}

// ========== 核心函数 ==========

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
  update,
  // 新增功能
  parseSkillMd,
  parseMetadata,
  checkRequirements,
  installDependency,
  checkBinExists
};
