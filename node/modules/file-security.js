/**
 * File Security Operations
 * 文件安全操作 - 安全打开文件，防止符号链接/硬链接攻击
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {'path' | 'validation' | 'io'} SafeOpenFailureReason
 */

/**
 * @typedef {'file' | 'directory'} SafeOpenAllowedType
 */

/**
 * @typedef {Object} SafeOpenSuccessResult
 * @property {boolean} ok - 成功标志
 * @property {string} path - 文件路径
 * @property {number} fd - 文件描述符
 * @property {fs.Stats} stat - 文件状态
 */

/**
 * @typedef {Object} SafeOpenFailureResult
 * @property {boolean} ok - 失败标志
 * @property {SafeOpenFailureReason} reason - 失败原因
 * @property {unknown} [error] - 错误对象
 */

/**
 * @typedef {SafeOpenSuccessResult | SafeOpenFailureResult} SafeOpenResult
 */

/**
 * 文件身份状态
 * @typedef {Object} FileIdentityStat
 * @property {number|bigint} dev - 设备 ID
 * @property {number|bigint} ino - inode 号
 */

/**
 * 检查是否为零
 * @param {number|bigint} value - 值
 * @returns {boolean} 是否为零
 */
function isZero(value) {
  return value === 0 || value === 0n;
}

/**
 * 检查文件身份是否相同
 * @param {FileIdentityStat} left - 左侧文件身份
 * @param {FileIdentityStat} right - 右侧文件身份
 * @param {NodeJS.Platform} [platform] - 平台
 * @returns {boolean} 是否相同
 */
function sameFileIdentity(left, right, platform = process.platform) {
  if (left.ino !== right.ino) {
    return false;
  }

  // On Windows, path-based stat calls can report dev=0 while fd-based stat
  // reports a real volume serial; treat either-side dev=0 as "unknown device".
  if (left.dev === right.dev) {
    return true;
  }
  return platform === 'win32' && (isZero(left.dev) || isZero(right.dev));
}

/**
 * 检查是否为预期的路径错误
 * @param {unknown} error - 错误对象
 * @returns {boolean} 是否为预期错误
 */
function isExpectedPathError(error) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  return code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP';
}

/**
 * 检查是否为允许的类型
 * @param {fs.Stats} stat - 文件状态
 * @param {SafeOpenAllowedType} allowedType - 允许的类型
 * @returns {boolean} 是否为允许的类型
 */
function isAllowedType(stat, allowedType) {
  if (allowedType === 'directory') {
    return stat.isDirectory();
  }
  return stat.isFile();
}

/**
 * 打开验证后的文件（同步）
 * @param {Object} params - 参数
 * @param {string} params.filePath - 文件路径
 * @param {string} [params.resolvedPath] - 解析后的路径
 * @param {boolean} [params.rejectPathSymlink] - 是否拒绝路径符号链接
 * @param {boolean} [params.rejectHardlinks] - 是否拒绝硬链接
 * @param {number} [params.maxBytes] - 最大字节数
 * @param {SafeOpenAllowedType} [params.allowedType] - 允许的类型
 * @param {Object} [params.ioFs] - 文件系统接口
 * @returns {SafeOpenResult} 打开结果
 */
function openVerifiedFileSync(params) {
  const ioFs = params.ioFs ?? fs;
  const allowedType = params.allowedType ?? 'file';
  const openReadFlags =
    ioFs.constants.O_RDONLY |
    (typeof ioFs.constants.O_NOFOLLOW === 'number' ? ioFs.constants.O_NOFOLLOW : 0);
  let fd = null;
  try {
    if (params.rejectPathSymlink) {
      const candidateStat = ioFs.lstatSync(params.filePath);
      if (candidateStat.isSymbolicLink()) {
        return { ok: false, reason: 'validation' };
      }
    }

    const realPath = params.resolvedPath ?? ioFs.realpathSync(params.filePath);
    const preOpenStat = ioFs.lstatSync(realPath);
    if (!isAllowedType(preOpenStat, allowedType)) {
      return { ok: false, reason: 'validation' };
    }
    if (params.rejectHardlinks && preOpenStat.isFile() && preOpenStat.nlink > 1) {
      return { ok: false, reason: 'validation' };
    }
    if (
      params.maxBytes !== undefined &&
      preOpenStat.isFile() &&
      preOpenStat.size > params.maxBytes
    ) {
      return { ok: false, reason: 'validation' };
    }

    fd = ioFs.openSync(realPath, openReadFlags);
    const openedStat = ioFs.fstatSync(fd);
    if (!isAllowedType(openedStat, allowedType)) {
      return { ok: false, reason: 'validation' };
    }
    if (params.rejectHardlinks && openedStat.isFile() && openedStat.nlink > 1) {
      return { ok: false, reason: 'validation' };
    }
    if (params.maxBytes !== undefined && openedStat.isFile() && openedStat.size > params.maxBytes) {
      return { ok: false, reason: 'validation' };
    }
    if (!sameFileIdentity(preOpenStat, openedStat)) {
      return { ok: false, reason: 'validation' };
    }

    const opened = { ok: true, path: realPath, fd, stat: openedStat };
    fd = null;
    return opened;
  } catch (error) {
    if (isExpectedPathError(error)) {
      return { ok: false, reason: 'path', error };
    }
    return { ok: false, reason: 'io', error };
  } finally {
    if (fd !== null) {
      ioFs.closeSync(fd);
    }
  }
}

/**
 * 安全读取文件（同步）
 * @param {Object} params - 参数
 * @param {string} params.filePath - 文件路径
 * @param {number} [params.maxBytes] - 最大字节数
 * @param {BufferEncoding} [params.encoding] - 编码
 * @param {Object} [params.ioFs] - 文件系统接口
 * @returns {SafeOpenResult | {ok: true, content: string|Buffer}} 读取结果
 */
function readVerifiedFileSync(params) {
  const openResult = openVerifiedFileSync({
    filePath: params.filePath,
    maxBytes: params.maxBytes,
    allowedType: 'file',
    rejectPathSymlink: true,
    rejectHardlinks: true,
    ioFs: params.ioFs
  });

  if (!openResult.ok) {
    return openResult;
  }

  const ioFs = params.ioFs ?? fs;
  let fd = null;
  try {
    fd = ioFs.openSync(openResult.path, 'r');
    const buffer = Buffer.alloc(Math.min(params.maxBytes ?? Infinity, openResult.stat.size));
    const bytesRead = ioFs.readSync(fd, buffer, 0, buffer.length, 0);
    const content = params.encoding ? buffer.slice(0, bytesRead).toString(params.encoding) : buffer.slice(0, bytesRead);
    return { ok: true, content, stat: openResult.stat };
  } catch (error) {
    return { ok: false, reason: 'io', error };
  } finally {
    if (fd !== null) {
      ioFs.closeSync(fd);
    }
  }
}

/**
 * 检查文件是否安全
 * @param {string} filePath - 文件路径
 * @param {Object} [options] - 选项
 * @param {boolean} [options.rejectSymlinks] - 是否拒绝符号链接
 * @param {boolean} [options.rejectHardlinks] - 是否拒绝硬链接
 * @param {number} [options.maxBytes] - 最大字节数
 * @returns {boolean} 是否安全
 */
function isFileSafe(filePath, options = {}) {
  const result = openVerifiedFileSync({
    filePath,
    maxBytes: options.maxBytes,
    rejectPathSymlink: options.rejectSymlinks,
    rejectHardlinks: options.rejectHardlinks
  });
  return result.ok;
}

/**
 * 获取文件信息（安全）
 * @param {string} filePath - 文件路径
 * @param {Object} [options] - 选项
 * @returns {SafeOpenResult | {ok: true, stat: fs.Stats}} 文件信息
 */
function getFileInfo(filePath, options = {}) {
  const result = openVerifiedFileSync({
    filePath,
    rejectPathSymlink: options.rejectSymlinks,
    rejectHardlinks: options.rejectHardlinks,
    allowedType: options.type ?? 'file'
  });
  return result;
}

module.exports = {
  openVerifiedFileSync,
  readVerifiedFileSync,
  isFileSafe,
  getFileInfo,
  sameFileIdentity
};