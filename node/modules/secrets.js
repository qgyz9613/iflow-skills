/**
 * iFlow Secrets Module
 * 整合自 OpenClaw 项目的密钥管理系统
 * 提供安全存储和管理 API Key、密码等敏感信息
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// ==================== 密钥存储路径 ====================

/**
 * 获取密钥存储目录
 * @returns {string} 密钥存储目录路径
 */
function getSecretsDir() {
  const homeDir = os.homedir();
  return path.join(homeDir, '.iflow', 'secrets');
}

/**
 * 获取密钥文件路径
 * @param {string} name - 密钥名称
 * @returns {string} 密钥文件路径
 */
function getSecretPath(name) {
  return path.join(getSecretsDir(), `${name}.secret`);
}

// ==================== 密钥存储 ====================

/**
 * 存储密钥
 * @param {string} name - 密钥名称
 * @param {string} value - 密钥值
 * @param {Object} options - 选项
 * @param {string} options.description - 密钥描述
 * @returns {Promise<boolean>} 是否成功
 */
async function storeSecret(name, value, options = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error('Secret name is required');
  }
  if (value === undefined || value === null) {
    throw new Error('Secret value is required');
  }

  const secretsDir = getSecretsDir();
  const secretPath = getSecretPath(name);

  // 确保目录存在
  try {
    await fs.mkdir(secretsDir, { recursive: true });
  } catch (err) {
    throw new Error(`Failed to create secrets directory: ${err.message}`);
  }

  // 存储密钥元数据
  const secretData = {
    name,
    value: String(value),
    description: options.description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    await fs.writeFile(secretPath, JSON.stringify(secretData, null, 2), 'utf8');
    return true;
  } catch (err) {
    throw new Error(`Failed to store secret: ${err.message}`);
  }
}

/**
 * 读取密钥
 * @param {string} name - 密钥名称
 * @returns {Promise<string|null>} 密钥值或 null
 */
async function getSecret(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }

  const secretPath = getSecretPath(name);

  try {
    const content = await fs.readFile(secretPath, 'utf8');
    const secretData = JSON.parse(content);
    return secretData.value || null;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to read secret: ${err.message}`);
  }
}

/**
 * 删除密钥
 * @param {string} name - 密钥名称
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteSecret(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }

  const secretPath = getSecretPath(name);

  try {
    await fs.unlink(secretPath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    }
    throw new Error(`Failed to delete secret: ${err.message}`);
  }
}

/**
 * 列出所有密钥
 * @returns {Promise<Array>} 密钥列表
 */
async function listSecrets() {
  const secretsDir = getSecretsDir();

  try {
    const files = await fs.readdir(secretsDir);
    const secrets = [];

    for (const file of files) {
      if (file.endsWith('.secret')) {
        const secretPath = path.join(secretsDir, file);
        try {
          const content = await fs.readFile(secretPath, 'utf8');
          const secretData = JSON.parse(content);
          secrets.push({
            name: secretData.name,
            description: secretData.description,
            createdAt: secretData.createdAt,
            updatedAt: secretData.updatedAt
          });
        } catch (err) {
          // 跳过损坏的密钥文件
          continue;
        }
      }
    }

    return secrets;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw new Error(`Failed to list secrets: ${err.message}`);
  }
}

// ==================== 环境变量密钥 ====================

/**
 * 从环境变量读取密钥
 * @param {string} name - 环境变量名称
 * @returns {string|null} 环境变量值或 null
 */
function getSecretFromEnv(name) {
  const value = process.env[name];
  return value || null;
}

/**
 * 批量从环境变量读取密钥
 * @param {Array<string>} names - 环境变量名称数组
 * @returns {Object} 密钥对象
 */
function getSecretsFromEnv(names) {
  const secrets = {};
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined) {
      secrets[name] = value;
    }
  }
  return secrets;
}

// ==================== 密钥引用解析 ====================

const SECRET_REF_PATTERN = /\{\{\s*secret\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
const ENV_REF_PATTERN = /\{\{\s*env\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * 解析密钥引用
 * @param {string} value - 包含密钥引用的字符串
 * @param {Object} options - 选项
 * @param {Function} options.secretResolver - 密钥解析函数
 * @param {Function} options.envResolver - 环境变量解析函数
 * @returns {Promise<string>} 解析后的字符串
 */
async function resolveSecretRefs(value, options = {}) {
  if (typeof value !== 'string') {
    return value;
  }

  const secretResolver = options.secretResolver || getSecret;
  const envResolver = options.envResolver || getSecretFromEnv;

  let result = value;

  // 解析 secret. 引用
  result = result.replace(SECRET_REF_PATTERN, async (match, name) => {
    const secretValue = await secretResolver(name);
    return secretValue !== null ? secretValue : match;
  });

  // 解析 env. 引用
  result = result.replace(ENV_REF_PATTERN, (match, name) => {
    const envValue = envResolver(name);
    return envValue !== null ? envValue : match;
  });

  return result;
}

/**
 * 递归解析对象中的密钥引用
 * @param {any} value - 任意值
 * @param {Object} options - 选项
 * @returns {Promise<any>} 解析后的值
 */
async function deepResolveSecretRefs(value, options = {}) {
  if (typeof value === 'string') {
    return resolveSecretRefs(value, options);
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map(item => deepResolveSecretRefs(item, options)));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = await deepResolveSecretRefs(value[key], options);
    }
    return result;
  }
  return value;
}

// ==================== 密钥掩码 ====================

/**
 * 掩码密钥值用于安全显示
 * @param {string} value - 密钥值
 * @param {number} visibleChars - 可见字符数（默认：4）
 * @returns {string} 掩码后的字符串
 */
function maskSecretValue(value, visibleChars = 4) {
  if (typeof value !== 'string') {
    return 'invalid';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 'missing';
  }
  if (trimmed.length <= visibleChars * 2) {
    return `${trimmed.slice(0, 1)}...${trimmed.slice(-1)}`;
  }
  return `${trimmed.slice(0, visibleChars)}...${trimmed.slice(-visibleChars)}`;
}

/**
 * 掩码对象中的密钥值
 * @param {Object} obj - 对象
 * @param {Array<string>} secretKeys - 密钥键名列表
 * @returns {Object} 掩码后的对象
 */
function maskSecretsInObject(obj, secretKeys = ['password', 'secret', 'token', 'apiKey', 'key']) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result = {};
  const keyPatterns = secretKeys.map(key => new RegExp(key, 'i'));

  for (const key of Object.keys(obj)) {
    const isSecretKey = keyPatterns.some(pattern => pattern.test(key));
    if (isSecretKey && typeof obj[key] === 'string') {
      result[key] = maskSecretValue(obj[key]);
    } else {
      result[key] = obj[key];
    }
  }

  return result;
}

// ==================== 密钥验证 ====================

/**
 * 验证密钥名称是否有效
 * @param {string} name - 密钥名称
 * @returns {boolean}
 */
function isValidSecretName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * 验证密钥引用是否有效
 * @param {string} ref - 密钥引用
 * @returns {boolean}
 */
function isValidSecretRef(ref) {
  if (!ref || typeof ref !== 'string') {
    return false;
  }
  return SECRET_REF_PATTERN.test(ref);
}

// ==================== 密钥审计 ====================

/**
 * 获取密钥使用审计信息
 * @param {string} name - 密钥名称
 * @returns {Promise<Object>} 审计信息
 */
async function getSecretAudit(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }

  const secretPath = getSecretPath(name);

  try {
    const stats = await fs.stat(secretPath);
    const content = await fs.readFile(secretPath, 'utf8');
    const secretData = JSON.parse(content);

    return {
      name: secretData.name,
      createdAt: secretData.createdAt,
      updatedAt: secretData.updatedAt,
      size: stats.size,
      modifiedAt: stats.mtime.toISOString()
    };
  } catch (err) {
    return null;
  }
}

// ==================== 导出 ====================

module.exports = {
  // 存储路径
  getSecretsDir,
  getSecretPath,

  // 密钥存储
  storeSecret,
  getSecret,
  deleteSecret,
  listSecrets,

  // 环境变量
  getSecretFromEnv,
  getSecretsFromEnv,

  // 密钥引用
  resolveSecretRefs,
  deepResolveSecretRefs,

  // 密钥掩码
  maskSecretValue,
  maskSecretsInObject,

  // 密钥验证
  isValidSecretName,
  isValidSecretRef,

  // 密钥审计
  getSecretAudit
};