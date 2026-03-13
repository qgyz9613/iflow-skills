/**
 * Map/Set Size Utilities
 * Map/Set 大小限制工具 - 防止内存泄漏
 */

/**
 * 修剪 Map 到最大大小
 * @param {Map} map - Map 对象
 * @param {number} maxSize - 最大大小
 */
function pruneMapToMaxSize(map, maxSize) {
  const limit = Math.max(0, Math.floor(maxSize));
  if (limit <= 0) {
    map.clear();
    return;
  }

  while (map.size > limit) {
    const oldest = map.keys().next();
    if (oldest.done) {
      break;
    }
    map.delete(oldest.value);
  }
}

/**
 * 修剪 Set 到最大大小
 * @param {Set} set - Set 对象
 * @param {number} maxSize - 最大大小
 */
function pruneSetToMaxSize(set, maxSize) {
  const limit = Math.max(0, Math.floor(maxSize));
  if (limit <= 0) {
    set.clear();
    return;
  }

  while (set.size > limit) {
    const oldest = set.values().next();
    if (oldest.done) {
      break;
    }
    set.delete(oldest.value);
  }
}

/**
 * 创建大小受限的 Map
 * @param {number} maxSize - 最大大小
 * @returns {Map} 大小受限的 Map
 */
function createBoundedMap(maxSize) {
  const map = new Map();
  const originalSet = map.set.bind(map);
  
  map.set = function(key, value) {
    originalSet(key, value);
    pruneMapToMaxSize(map, maxSize);
    return map;
  };
  
  return map;
}

/**
 * 创建大小受限的 Set
 * @param {number} maxSize - 最大大小
 * @returns {Set} 大小受限的 Set
 */
function createBoundedSet(maxSize) {
  const set = new Set();
  const originalAdd = set.add.bind(set);
  
  set.add = function(value) {
    originalAdd(value);
    pruneSetToMaxSize(set, maxSize);
    return set;
  };
  
  return set;
}

/**
 * 获取 Map 大小信息
 * @param {Map} map - Map 对象
 * @returns {Object} 大小信息
 */
function getMapSizeInfo(map) {
  return {
    size: map.size,
    isEmpty: map.size === 0
  };
}

/**
 * 获取 Set 大小信息
 * @param {Set} set - Set 对象
 * @returns {Object} 大小信息
 */
function getSetSizeInfo(set) {
  return {
    size: set.size,
    isEmpty: set.size === 0
  };
}

/**
 * 检查 Map 是否已满
 * @param {Map} map - Map 对象
 * @param {number} maxSize - 最大大小
 * @returns {boolean} 是否已满
 */
function isMapFull(map, maxSize) {
  return map.size >= maxSize;
}

/**
 * 检查 Set 是否已满
 * @param {Set} set - Set 对象
 * @param {number} maxSize - 最大大小
 * @returns {boolean} 是否已满
 */
function isSetFull(set, maxSize) {
  return set.size >= maxSize;
}

/**
 * 清空 Map
 * @param {Map} map - Map 对象
 */
function clearMap(map) {
  map.clear();
}

/**
 * 清空 Set
 * @param {Set} set - Set 对象
 */
function clearSet(set) {
  set.clear();
}

module.exports = {
  pruneMapToMaxSize,
  pruneSetToMaxSize,
  createBoundedMap,
  createBoundedSet,
  getMapSizeInfo,
  getSetSizeInfo,
  isMapFull,
  isSetFull,
  clearMap,
  clearSet
};