/**
 * 包管理器检测模块
 * 检测项目使用的包管理器（pnpm/bun/npm）
 */

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * 检测项目使用的包管理器
 * @param {string} root - 项目根目录
 * @returns {Promise<'pnpm'|'bun'|'npm'|null>} - 包管理器类型，如果无法检测则返回 null
 */
async function detectPackageManager(root) {
  try {
    const raw = await fs.readFile(path.join(root, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const pm = parsed?.packageManager?.split('@')[0]?.trim();
    if (pm === 'pnpm' || pm === 'bun' || pm === 'npm') {
      return pm;
    }
  } catch {
    // ignore
  }

  const files = await fs.readdir(root).catch(() => []);
  if (files.includes('pnpm-lock.yaml')) {
    return 'pnpm';
  }
  if (files.includes('bun.lockb')) {
    return 'bun';
  }
  if (files.includes('package-lock.json')) {
    return 'npm';
  }
  return null;
}

module.exports = {
  detectPackageManager
};