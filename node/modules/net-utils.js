/**
 * iFlow Net Utils Module
 * 网络工具模块，整合自 OpenClaw 的网络相关模块
 */

/**
 * IP 地址类
 */
const IP_ADDRESS_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * IPv6 地址类
 */
const IPV6_REGEX = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

/**
 * IPv4 特殊使用范围
 */
const IPV4_SPECIAL_RANGES = {
  '0.0.0.0/8': 'unspecified',
  '127.0.0.0/8': 'loopback',
  '10.0.0.0/8': 'private',
  '172.16.0.0/12': 'private',
  '192.168.0.0/16': 'private',
  '169.254.0.0/16': 'linkLocal',
  '224.0.0.0/4': 'multicast',
  '240.0.0.0/4': 'reserved'
};

/**
 * IPv6 特殊使用范围
 */
const IPV6_SPECIAL_RANGES = {
  '::1/128': 'loopback',
  'fe80::/10': 'linkLocal',
  'fc00::/7': 'uniqueLocal',
  'ff00::/8': 'multicast',
  '::/128': 'unspecified'
};

/**
 * 移除 IPv6 地址的括号
 * @param {string} value - IPv6 地址
 * @returns {string} 移除括号后的地址
 */
function stripIpv6Brackets(value) {
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * 验证 IPv4 地址
 * @param {string} ip - IP 地址
 * @returns {boolean} 是否有效
 */
function isValidIPv4(ip) {
  if (!ip || typeof ip !== 'string') {
    return false;
  }
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every(part => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255;
  });
}

/**
 * 验证 IPv6 地址
 * @param {string} ip - IP 地址
 * @returns {boolean} 是否有效
 */
function isValidIPv6(ip) {
  if (!ip || typeof ip !== 'string') {
    return false;
  }
  const cleaned = stripIpv6Brackets(ip);
  return IPV6_REGEX.test(cleaned);
}

/**
 * 验证 IP 地址（IPv4 或 IPv6）
 * @param {string} ip - IP 地址
 * @returns {boolean} 是否有效
 */
function isValidIP(ip) {
  return isValidIPv4(ip) || isValidIPv6(ip);
}

/**
 * 检查是否为 IPv4 私有地址
 * @param {string} ip - IP 地址
 * @returns {boolean} 是否为私有地址
 */
function isPrivateIPv4(ip) {
  if (!isValidIPv4(ip)) {
    return false;
  }
  const parts = ip.split('.').map(Number);
  const first = parts[0];
  
  // 10.0.0.0/8
  if (first === 10) return true;
  
  // 172.16.0.0/12
  if (first === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  
  // 192.168.0.0/16
  if (first === 192 && parts[1] === 168) return true;
  
  // 127.0.0.0/8
  if (first === 127) return true;
  
  return false;
}

/**
 * 检查是否为本地回环地址
 * @param {string} ip - IP 地址
 * @returns {boolean} 是否为回环地址
 */
function isLoopback(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

/**
 * 检查是否为特殊用途地址
 * @param {string} ip - IP 地址
 * @returns {string|null} 特殊用途类型
 */
function getSpecialUseType(ip) {
  if (!isValidIP(ip)) {
    return null;
  }
  
  // 检查 IPv4 特殊范围
  for (const [range, type] of Object.entries(IPV4_SPECIAL_RANGES)) {
    if (isInRange(ip, range)) {
      return type;
    }
  }
  
  // 检查 IPv6 特殊范围
  for (const [range, type] of Object.entries(IPV6_SPECIAL_RANGES)) {
    if (isInRange(ip, range)) {
      return type;
    }
  }
  
  return null;
}

/**
 * 检查 IP 是否在范围内
 * @param {string} ip - IP 地址
 * @param {string} range - 范围（如 "192.168.0.0/24"）
 * @returns {boolean} 是否在范围内
 */
function isInRange(ip, range) {
  if (!isValidIP(ip) || !range) {
    return false;
  }
  
  const [network, prefixLength] = range.split('/');
  const prefix = parseInt(prefixLength, 10);
  
  if (isValidIPv4(ip) && isValidIPv4(network)) {
    return isIPv4InRange(ip, network, prefix);
  }
  
  if (isValidIPv6(ip) && isValidIPv6(network)) {
    return isIPv6InRange(ip, network, prefix);
  }
  
  return false;
}

/**
 * 检查 IPv4 是否在范围内
 * @param {string} ip - IP 地址
 * @param {string} network - 网络地址
 * @param {number} prefixLength - 前缀长度
 * @returns {boolean} 是否在范围内
 */
function isIPv4InRange(ip, network, prefixLength) {
  const ipParts = ip.split('.').map(Number);
  const networkParts = network.split('.').map(Number);
  const mask = createNetmask(prefixLength);
  
  for (let i = 0; i < 4; i++) {
    if ((ipParts[i] & mask[i]) !== (networkParts[i] & mask[i])) {
      return false;
    }
  }
  
  return true;
}

/**
 * 创建子网掩码
 * @param {number} prefixLength - 前缀长度
 * @returns {number[]} 掩码数组
 */
function createNetmask(prefixLength) {
  const mask = [];
  for (let i = 0; i < 4; i++) {
    if (prefixLength >= (i + 1) * 8) {
      mask.push(255);
    } else if (prefixLength > i * 8) {
      mask.push(256 - Math.pow(2, 8 - (prefixLength % 8)));
    } else {
      mask.push(0);
    }
  }
  return mask;
}

/**
 * 检查 IPv6 是否在范围内
 * @param {string} ip - IP 地址
 * @param {string} network - 网络地址
 * @param {number} prefixLength - 前缀长度
 * @returns {boolean} 是否在范围内
 */
function isIPv6InRange(ip, network, prefixLength) {
  // 简化实现，完整实现需要更复杂的 IPv6 处理
  return ip.startsWith(network.split('/').slice(0, 1)[0]);
}

/**
 * 解析主机名
 * @param {string} hostname - 主机名
 * @returns {Object} 解析结果
 */
function parseHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    return null;
  }
  
  // 移除端口号
  const withoutPort = hostname.split(':')[0];
  
  // 检查是否为 IP 地址
  if (isValidIPv4(withoutPort)) {
    return {
      type: 'ipv4',
      value: withoutPort,
      isIP: true,
      isPrivate: isPrivateIPv4(withoutPort),
      isLoopback: isLoopback(withoutPort)
    };
  }
  
  if (isValidIPv6(withoutPort)) {
    return {
      type: 'ipv6',
      value: withoutPort,
      isIP: true,
      isPrivate: false,
      isLoopback: isLoopback(withoutPort)
    };
  }
  
  return {
    type: 'hostname',
    value: withoutPort,
    isIP: false,
    isPrivate: false,
    isLoopback: false
  };
}

/**
 * 规范化主机名
 * @param {string} hostname - 主机名
 * @returns {string} 规范化后的主机名
 */
function normalizeHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    return '';
  }
  
  return hostname.toLowerCase().trim();
}

/**
 * 检查是否为内网地址
 * @param {string} hostname - 主机名或 IP 地址
 * @returns {boolean} 是否为内网地址
 */
function isInternalHostname(hostname) {
  if (!hostname) {
    return false;
  }
  
  const parsed = parseHostname(hostname);
  if (!parsed) {
    return false;
  }
  
  // 检查 IP 地址
  if (parsed.isIP) {
    return parsed.isPrivate || parsed.isLoopback;
  }
  
  // 检查常见内网域名
  const internalDomains = [
    'localhost',
    'local',
    '127.0.0.1',
    '::1'
  ];
  
  return internalDomains.includes(parsed.value);
}

/**
 * 解析 URL
 * @param {string} url - URL 字符串
 * @returns {Object|null} 解析结果
 */
function parseURL(url) {
  try {
    const urlObj = new URL(url);
    return {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash,
      origin: urlObj.origin
    };
  } catch {
    return null;
  }
}

/**
 * 获取 URL 的端口
 * @param {string} url - URL 字符串
 * @returns {number} 端口号
 */
function getURLPort(url) {
  const parsed = parseURL(url);
  if (!parsed) {
    return null;
  }
  
  if (parsed.port) {
    return parseInt(parsed.port, 10);
  }
  
  // 默认端口
  const defaultPorts = {
    'http:': 80,
    'https:': 443,
    'ws:': 80,
    'wss:': 443,
    'ftp:': 21
  };
  
  return defaultPorts[parsed.protocol] || null;
}

/**
 * 构建 URL
 * @param {Object} parts - URL 各部分
 * @returns {string} 构建的 URL
 */
function buildURL(parts) {
  try {
    const url = new URL('');
    
    if (parts.protocol) {
      url.protocol = parts.protocol;
    }
    
    if (parts.hostname) {
      url.hostname = parts.hostname;
    }
    
    if (parts.port) {
      url.port = String(parts.port);
    }
    
    if (parts.pathname) {
      url.pathname = parts.pathname;
    }
    
    if (parts.search) {
      url.search = parts.search;
    }
    
    if (parts.hash) {
      url.hash = parts.hash;
    }
    
    return url.toString();
  } catch {
    return '';
  }
}

module.exports = {
  // IP 地址验证
  isValidIPv4,
  isValidIPv6,
  isValidIP,
  
  // IP 地址检查
  isPrivateIPv4,
  isLoopback,
  getSpecialUseType,
  isInRange,
  
  // 主机名处理
  parseHostname,
  normalizeHostname,
  isInternalHostname,
  
  // URL 处理
  parseURL,
  getURLPort,
  buildURL,
  
  // 工具函数
  stripIpv6Brackets,
  createNetmask
};