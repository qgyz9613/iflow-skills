/**
 * Path Resolver
 * 路径解析器 - 跨平台主目录和路径解析
 */

const os = require('os');
const path = require('path');

/**
 * 规范化值
 * @param {string|undefined} value - 输入值
 * @returns {string|undefined} 规范化后的值
 */
function normalize(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * 解析有效主目录
 * @param {NodeJS.ProcessEnv} [env] - 环境变量
 * @param {function(): string} [homedir] - 主目录函数
 * @returns {string|undefined} 解析后的主目录
 */
function resolveEffectiveHomeDir(env = process.env, homedir = os.homedir) {
  const raw = resolveRawHomeDir(env, homedir);
  return raw ? path.resolve(raw) : undefined;
}

/**
 * 解析原始主目录
 * @param {NodeJS.ProcessEnv} env - 环境变量
 * @param {function(): string} homedir - 主目录函数
 * @returns {string|undefined} 原始主目录
 */
function resolveRawHomeDir(env, homedir) {
  const explicitHome = normalize(env.OPENCLAW_HOME);
  if (explicitHome) {
    if (explicitHome === '~' || explicitHome.startsWith('~/') || explicitHome.startsWith('~\\')) {
      const fallbackHome =
        normalize(env.HOME) ?? normalize(env.USERPROFILE) ?? normalizeSafe(homedir);
      if (fallbackHome) {
        return explicitHome.replace(/^~(?=$|[\\/])/, fallbackHome);
      }
      return undefined;
    }
    return explicitHome;
  }

  const envHome = normalize(env.HOME);
  if (envHome) {
    return envHome;
  }

  const userProfile = normalize(env.USERPROFILE);
  if (userProfile) {
    return userProfile;
  }

  return normalizeSafe(homedir);
}

/**
 * 安全规范化
 * @param {function(): string} homedir - 主目录函数
 * @returns {string|undefined} 规范化后的值
 */
function normalizeSafe(homedir) {
  try {
    return normalize(homedir());
  } catch {
    return undefined;
  }
}

/**
 * 解析必需主目录
 * @param {NodeJS.ProcessEnv} [env] - 环境变量
 * @param {function(): string} [homedir] - 主目录函数
 * @returns {string} 主目录
 */
function resolveRequiredHomeDir(env = process.env, homedir = os.homedir) {
  return resolveEffectiveHomeDir(env, homedir) ?? path.resolve(process.cwd());
}

/**
 * 展开主目录前缀
 * @param {string} input - 输入路径
 * @param {Object} [opts] - 选项
 * @param {string} [opts.home] - 主目录
 * @param {NodeJS.ProcessEnv} [opts.env] - 环境变量
 * @param {function(): string} [opts.homedir] - 主目录函数
 * @returns {string} 展开后的路径
 */
function expandHomePrefix(input, opts = {}) {
  if (!input.startsWith('~')) {
    return input;
  }
  const home =
    normalize(opts?.home) ??
    resolveEffectiveHomeDir(opts?.env ?? process.env, opts?.homedir ?? os.homedir);
  if (!home) {
    return input;
  }
  return input.replace(/^~(?=$|[\\/])/, home);
}

/**
 * 解析配置目录
 * @param {NodeJS.ProcessEnv} [env] - 环境变量
 * @param {string} [appName] - 应用名称
 * @returns {string} 配置目录
 */
function resolveConfigDir(env = process.env, appName = 'iflow') {
  const home = resolveEffectiveHomeDir(env);
  if (!home) {
    return path.resolve(process.cwd(), '.config', appName);
  }
  
  if (process.platform === 'win32') {
    // Windows: %APPDATA%\appName
    const appData = normalize(env.APPDATA) || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, appName);
  } else if (process.platform === 'darwin') {
    // macOS: ~/Library/Application Support/appName
    return path.join(home, 'Library', 'Application Support', appName);
  } else {
    // Linux: ~/.config/appName (XDG Base Directory)
    const configHome = normalize(env.XDG_CONFIG_HOME) || path.join(home, '.config');
    return path.join(configHome, appName);
  }
}

/**
 * 解析数据目录
 * @param {NodeJS.ProcessEnv} [env] - 环境变量
 * @param {string} [appName] - 应用名称
 * @returns {string} 数据目录
 */
function resolveDataDir(env = process.env, appName = 'iflow') {
  const home = resolveEffectiveHomeDir(env);
  if (!home) {
    return path.resolve(process.cwd(), '.data', appName);
  }
  
  if (process.platform === 'win32') {
    // Windows: %LOCALAPPDATA%\appName
    const localAppData = normalize(env.LOCALAPPDATA) || path.join(home, 'AppData', 'Local');
    return path.join(localAppData, appName);
  } else if (process.platform === 'darwin') {
    // macOS: ~/Library/Application Support/appName
    return path.join(home, 'Library', 'Application Support', appName);
  } else {
    // Linux: ~/.local/share/appName (XDG Base Directory)
    const dataHome = normalize(env.XDG_DATA_HOME) || path.join(home, '.local', 'share');
    return path.join(dataHome, appName);
  }
}

/**
 * 解析缓存目录
 * @param {NodeJS.ProcessEnv} [env] - 环境变量
 * @param {string} [appName] - 应用名称
 * @returns {string} 缓存目录
 */
function resolveCacheDir(env = process.env, appName = 'iflow') {
  const home = resolveEffectiveHomeDir(env);
  if (!home) {
    return path.resolve(process.cwd(), '.cache', appName);
  }
  
  if (process.platform === 'win32') {
    // Windows: %LOCALAPPDATA%\appName\cache
    const localAppData = normalize(env.LOCALAPPDATA) || path.join(home, 'AppData', 'Local');
    return path.join(localAppData, appName, 'cache');
  } else if (process.platform === 'darwin') {
    // macOS: ~/Library/Caches/appName
    return path.join(home, 'Library', 'Caches', appName);
  } else {
    // Linux: ~/.cache/appName (XDG Base Directory)
    const cacheHome = normalize(env.XDG_CACHE_HOME) || path.join(home, '.cache');
    return path.join(cacheHome, appName);
  }
}

/**
 * 解析临时目录
 * @returns {string} 临时目录
 */
function resolveTempDir() {
  return normalize(process.env.TMPDIR) || normalize(process.env.TEMP) || os.tmpdir();
}

/**
 * 规范化路径
 * @param {string} input - 输入路径
 * @returns {string} 规范化后的路径
 */
function normalizePath(input) {
  const expanded = expandHomePrefix(input);
  return path.normalize(expanded);
}

/**
 * 连接路径
 * @param {...string} paths - 路径段
 * @returns {string} 连接后的路径
 */
function joinPaths(...paths) {
  return normalizePath(path.join(...paths));
}

/**
 * 解析相对路径
 * @param {string} from - 起始路径
 * @param {string} to - 目标路径
 * @returns {string} 相对路径
 */
function resolveRelativePath(from, to) {
  const fromNormalized = normalizePath(from);
  const toNormalized = normalizePath(to);
  return path.relative(fromNormalized, toNormalized);
}

/**
 * 路径是否在另一个路径内
 * @param {string} parent - 父路径
 * @param {string} child - 子路径
 * @returns {boolean} 是否在内
 */
function isPathInside(parent, child) {
  const relative = path.relative(normalizePath(parent), normalizePath(child));
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

module.exports = {
  normalize,
  resolveEffectiveHomeDir,
  resolveRawHomeDir,
  resolveRequiredHomeDir,
  expandHomePrefix,
  resolveConfigDir,
  resolveDataDir,
  resolveCacheDir,
  resolveTempDir,
  normalizePath,
  joinPaths,
  resolveRelativePath,
  isPathInside
};