/**
 * Package.json Utilities
 * package.json 工具 - 读取和解析 package.json 文件
 */

const fs = require('fs');
const path = require('path');

/**
 * 读取 package.json 版本
 * @param {string} root - 根目录路径
 * @returns {Promise<string|null>} 版本号
 */
async function readPackageVersion(root) {
  try {
    const raw = await fs.promises.readFile(path.join(root, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed?.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
}

/**
 * 读取 package.json 版本（同步）
 * @param {string} root - 根目录路径
 * @returns {string|null} 版本号
 */
function readPackageVersionSync(root) {
  try {
    const raw = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed?.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
}

/**
 * 读取 package.json 名称
 * @param {string} root - 根目录路径
 * @returns {Promise<string|null>} 包名
 */
async function readPackageName(root) {
  try {
    const raw = await fs.promises.readFile(path.join(root, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const name = parsed?.name?.trim();
    return name ? name : null;
  } catch {
    return null;
  }
}

/**
 * 读取 package.json 名称（同步）
 * @param {string} root - 根目录路径
 * @returns {string|null} 包名
 */
function readPackageNameSync(root) {
  try {
    const raw = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const name = parsed?.name?.trim();
    return name ? name : null;
  } catch {
    return null;
  }
}

/**
 * 读取 package.json 文件
 * @param {string} root - 根目录路径
 * @returns {Promise<Object|null>} package.json 对象
 */
async function readPackageJson(root) {
  try {
    const raw = await fs.promises.readFile(path.join(root, 'package.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 读取 package.json 文件（同步）
 * @param {string} root - 根目录路径
 * @returns {Object|null} package.json 对象
 */
function readPackageJsonSync(root) {
  try {
    const raw = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 查找 package.json 文件
 * @param {string} [startDir] - 起始目录
 * @returns {Promise<string|null>} package.json 文件路径
 */
async function findPackageJson(startDir) {
  const current = startDir || process.cwd();
  const packageJsonPath = path.join(current, 'package.json');
  
  try {
    await fs.promises.access(packageJsonPath);
    return packageJsonPath;
  } catch {
    return null;
  }
}

/**
 * 查找 package.json 文件（同步）
 * @param {string} [startDir] - 起始目录
 * @returns {string|null} package.json 文件路径
 */
function findPackageJsonSync(startDir) {
  const current = startDir || process.cwd();
  const packageJsonPath = path.join(current, 'package.json');
  
  try {
    fs.accessSync(packageJsonPath);
    return packageJsonPath;
  } catch {
    return null;
  }
}

/**
 * 查找项目根目录（包含 package.json 的目录）
 * @param {string} [startDir] - 起始目录
 * @param {number} [maxDepth] - 最大搜索深度
 * @returns {Promise<string|null>} 项目根目录
 */
async function findProjectRoot(startDir, maxDepth = 5) {
  let current = startDir || process.cwd();
  
  for (let i = 0; i < maxDepth; i++) {
    const packageJsonPath = path.join(current, 'package.json');
    
    try {
      await fs.promises.access(packageJsonPath);
      return current;
    } catch {
      // 继续向上搜索
    }
    
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  
  return null;
}

/**
 * 查找项目根目录（同步）
 * @param {string} [startDir] - 起始目录
 * @param {number} [maxDepth] - 最大搜索深度
 * @returns {string|null} 项目根目录
 */
function findProjectRootSync(startDir, maxDepth = 5) {
  let current = startDir || process.cwd();
  
  for (let i = 0; i < maxDepth; i++) {
    const packageJsonPath = path.join(current, 'package.json');
    
    try {
      fs.accessSync(packageJsonPath);
      return current;
    } catch {
      // 继续向上搜索
    }
    
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  
  return null;
}

/**
 * 获取依赖列表
 * @param {string} root - 根目录路径
 * @returns {Promise<Object<string, string>>} 依赖对象
 */
async function getDependencies(root) {
  const pkg = await readPackageJson(root);
  if (!pkg) {
    return {};
  }
  
  return {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
    ...pkg.optionalDependencies
  };
}

/**
 * 获取依赖列表（同步）
 * @param {string} root - 根目录路径
 * @returns {Object<string, string>} 依赖对象
 */
function getDependenciesSync(root) {
  const pkg = readPackageJsonSync(root);
  if (!pkg) {
    return {};
  }
  
  return {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
    ...pkg.optionalDependencies
  };
}

/**
 * 获取脚本列表
 * @param {string} root - 根目录路径
 * @returns {Promise<Object<string, string>>} 脚本对象
 */
async function getScripts(root) {
  const pkg = await readPackageJson(root);
  if (!pkg) {
    return {};
  }
  
  return pkg.scripts || {};
}

/**
 * 获取脚本列表（同步）
 * @param {string} root - 根目录路径
 * @returns {Object<string, string>} 脚本对象
 */
function getScriptsSync(root) {
  const pkg = readPackageJsonSync(root);
  if (!pkg) {
    return {};
  }
  
  return pkg.scripts || {};
}

/**
 * 验证 package.json 文件
 * @param {string} root - 根目录路径
 * @returns {Promise<Object>} 验证结果
 */
async function validatePackageJson(root) {
  const result = {
    valid: false,
    path: null,
    errors: [],
    warnings: []
  };
  
  const packageJsonPath = path.join(root, 'package.json');
  
  try {
    await fs.promises.access(packageJsonPath);
    result.path = packageJsonPath;
  } catch {
    result.errors.push('package.json not found');
    return result;
  }
  
  try {
    const raw = await fs.promises.readFile(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    
    if (!parsed.name) {
      result.warnings.push('Missing name field');
    }
    
    if (!parsed.version) {
      result.warnings.push('Missing version field');
    }
    
    result.valid = true;
  } catch (error) {
    result.errors.push(`Invalid JSON: ${String(error)}`);
  }
  
  return result;
}

module.exports = {
  readPackageVersion,
  readPackageVersionSync,
  readPackageName,
  readPackageNameSync,
  readPackageJson,
  readPackageJsonSync,
  findPackageJson,
  findPackageJsonSync,
  findProjectRoot,
  findProjectRootSync,
  getDependencies,
  getDependenciesSync,
  getScripts,
  getScriptsSync,
  validatePackageJson
};