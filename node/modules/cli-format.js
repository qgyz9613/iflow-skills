/**
 * iFlow CLI Format Module
 * 整合自 OpenClaw 的 terminal 模块
 * 提供 CLI 格式化工具：ANSI 颜色、表格、进度条等
 */

const util = require('util');

// ==================== ANSI 颜色代码 ====================

const ANSI_CODES = {
  // 前景色
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  // 亮色
  brightBlack: 90,
  brightRed: 91,
  brightGreen: 92,
  brightYellow: 93,
  brightBlue: 94,
  brightMagenta: 95,
  brightCyan: 96,
  brightWhite: 97,
  // 背景色
  bgBlack: 40,
  bgRed: 41,
  bgGreen: 42,
  bgYellow: 43,
  bgBlue: 44,
  bgMagenta: 45,
  bgCyan: 46,
  bgWhite: 47,
  // 样式
  bold: 1,
  dim: 2,
  italic: 3,
  underline: 4,
  blink: 5,
  inverse: 7,
  hidden: 8,
  strikethrough: 9,
  // 重置
  reset: 0
};

/**
 * 生成 ANSI 颜色代码
 * @param {string} color - 颜色名称
 * @returns {string} ANSI 代码
 */
function ansiColor(color) {
  return `\x1b[${ANSI_CODES[color] || 0}m`;
}

/**
 * 应用颜色到文本
 * @param {string} text - 文本
 * @param {string} color - 颜色名称
 * @returns {string} 带颜色的文本
 */
function colorize(text, color) {
  return `${ansiColor(color)}${text}${ansiColor('reset')}`;
}

/**
 * 移除 ANSI 代码
 * @param {string} text - 文本
 * @returns {string} 纯文本
 */
function stripAnsi(text) {
  if (typeof text !== 'string') {
    return '';
  }
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * 计算可见宽度（不考虑 ANSI 代码）
 * @param {string} text - 文本
 * @returns {number} 可见宽度
 */
function visibleWidth(text) {
  if (typeof text !== 'string') {
    return 0;
  }
  return stripAnsi(text).length;
}

/**
 * 简化的字符串分割（按字素簇）
 * @param {string} text - 文本
 * @returns {string[]} 字符数组
 */
function splitGraphemes(text) {
  if (!text) {
    return [];
  }
  // 简化版本，实际应该使用 Intl.Segmenter
  return Array.from(text);
}

// ==================== 颜色调色板 ====================

const PALETTES = {
  default: {
    primary: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'cyan',
    muted: 'brightBlack'
  },
  dark: {
    primary: 'brightBlue',
    success: 'brightGreen',
    warning: 'brightYellow',
    error: 'brightRed',
    info: 'brightCyan',
    muted: 'white'
  },
  light: {
    primary: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'cyan',
    muted: 'black'
  }
};

/**
 * 调色板管理器
 */
class Palette {
  constructor(palette = 'default') {
    this.currentPalette = palette;
    this.customColors = {};
  }

  /**
   * 设置调色板
   * @param {string} palette - 调色板名称
   */
  setPalette(palette) {
    this.currentPalette = palette;
  }

  /**
   * 获取当前调色板
   * @returns {Object} 调色板
   */
  getPalette() {
    return PALETTES[this.currentPalette] || PALETTES.default;
  }

  /**
   * 使用调色板颜色
   * @param {string} text - 文本
   * @param {string} type - 类型
   * @returns {string} 带颜色的文本
   */
  use(text, type) {
    const palette = this.getPalette();
    const color = palette[type] || type;
    return colorize(text, color);
  }

  /**
   * 自定义颜色
   * @param {string} name - 名称
   * @param {string} color - 颜色名称或代码
   */
  custom(name, color) {
    this.customColors[name] = color;
  }

  /**
   * 使用自定义颜色
   * @param {string} text - 文本
   * @param {string} name - 名称
   * @returns {string} 带颜色的文本
   */
  useCustom(text, name) {
    const color = this.customColors[name];
    if (color) {
      return colorize(text, color);
    }
    return text;
  }
}

// ==================== 表格格式化 ====================

/**
 * 表格渲染器
 */
class TableRenderer {
  constructor(options = {}) {
    this.padding = options.padding || 1;
    this.border = options.border || 'unicode';
  }

  /**
   * 渲染表格
   * @param {Object} options - 选项
   * @returns {string} 表格字符串
   */
  render(options) {
    const { columns, rows, width } = options;

    // 计算列宽
    const columnWidths = this.calculateColumnWidths(columns, rows, width);

    // 生成边框字符
    const borders = this.getBorders();

    // 渲染表头
    let output = '';

    if (this.border !== 'none') {
      output += this.renderBorder(borders.top, columnWidths) + '\n';
    }

    output += this.renderRow(columns.map(c => c.header), columnWidths, 'center');

    if (this.border !== 'none') {
      output += '\n' + this.renderBorder(borders.middle, columnWidths);
    }

    // 渲染数据行
    for (const row of rows) {
      output += '\n' + this.renderRow(
        columns.map(c => row[c.key] || ''),
        columnWidths,
        columns.map(c => c.align || 'left')
      );
    }

    if (this.border !== 'none') {
      output += '\n' + this.renderBorder(borders.bottom, columnWidths);
    }

    return output;
  }

  /**
   * 计算列宽
   * @param {Array} columns - 列定义
   * @param {Array} rows - 数据行
   * @param {number} width - 总宽度
   * @returns {Array} 列宽
   */
  calculateColumnWidths(columns, rows, width) {
    const widths = columns.map(c => this.getHeaderWidth(c));

    // 计算每列的最大宽度
    for (const row of rows) {
      for (let i = 0; i < columns.length; i++) {
        const cell = row[columns[i].key] || '';
        const cellWidth = visibleWidth(cell);
        widths[i] = Math.max(widths[i], cellWidth);
      }
    }

    // 应用最小/最大宽度
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (col.minWidth) {
        widths[i] = Math.max(widths[i], col.minWidth);
      }
      if (col.maxWidth) {
        widths[i] = Math.min(widths[i], col.maxWidth);
      }
    }

    // 应用总宽度限制
    if (width) {
      const totalPadding = (columns.length + 1) * this.padding * 2;
      const availableWidth = width - totalPadding;
      const totalWidth = widths.reduce((a, b) => a + b, 0);

      if (totalWidth > availableWidth) {
        const flexColumns = columns.filter(c => c.flex);
        const fixedWidth = columns.reduce((a, c) => a + (c.flex ? 0 : widths[columns.indexOf(c)]), 0);
        const flexWidth = availableWidth - fixedWidth;

        if (flexColumns.length > 0 && flexWidth > 0) {
          const avgFlexWidth = flexWidth / flexColumns.length;
          for (let i = 0; i < columns.length; i++) {
            if (columns[i].flex) {
              widths[i] = Math.max(widths[i], Math.floor(avgFlexWidth));
            }
          }
        }
      }
    }

    return widths;
  }

  /**
   * 获取表头宽度
   * @param {Object} column - 列定义
   * @returns {number} 宽度
   */
  getHeaderWidth(column) {
    return visibleWidth(column.header);
  }

  /**
   * 渲染行
   * @param {Array} cells - 单元格
   * @param {Array} widths - 列宽
   * @param {Array} aligns - 对齐方式
   * @returns {string} 行字符串
   */
  renderRow(cells, widths, aligns) {
    const padding = ' '.repeat(this.padding);
    const separator = this.border !== 'none' ? '│' : '';

    const renderedCells = cells.map((cell, i) => {
      const padded = this.padCell(cell, widths[i], aligns[i] || 'left');
      return padding + padded + padding;
    });

    if (this.border !== 'none') {
      return separator + renderedCells.join(separator) + separator;
    }

    return renderedCells.join('');
  }

  /**
   * 填充单元格
   * @param {string} text - 文本
   * @param {number} width - 宽度
   * @param {string} align - 对齐
   * @returns {string} 填充后的文本
   */
  padCell(text, width, align) {
    const w = visibleWidth(text);
    if (w >= width) {
      return text;
    }

    const pad = width - w;
    if (align === 'right') {
      return ' '.repeat(pad) + text;
    }
    if (align === 'center') {
      const left = Math.floor(pad / 2);
      const right = pad - left;
      return ' '.repeat(left) + text + ' '.repeat(right);
    }

    return text + ' '.repeat(pad);
  }

  /**
   * 渲染边框
   * @param {Object} borderChars - 边框字符
   * @param {Array} widths - 列宽
   * @returns {string} 边框字符串
   */
  renderBorder(borderChars, widths) {
    const padding = ' '.repeat(this.padding);

    let line = borderChars.left;
    for (let i = 0; i < widths.length; i++) {
      line += padding + borderChars.horizontal.repeat(widths[i]) + padding;
      line += borderChars.separator;
    }
    line = line.slice(0, -1) + borderChars.right;

    return line;
  }

  /**
   * 获取边框字符
   * @returns {Object} 边框字符
   */
  getBorders() {
    if (this.border === 'ascii') {
      return {
        top: '+-+-+',
        middle: '+-+-+',
        bottom: '+-+-+',
        left: '+',
        right: '+',
        horizontal: '-',
        separator: '+'
      };
    }

    if (this.border === 'none') {
      return {
        top: '',
        middle: '',
        bottom: '',
        left: '',
        right: '',
        horizontal: '',
        separator: ''
      };
    }

    // Unicode 边框
    return {
      top: '┌─┬─┐',
      middle: '├─┼─┤',
      bottom: '└─┴─┘',
      left: '│',
      right: '│',
      horizontal: '─',
      separator: '│'
    };
  }
}

// ==================== 进度条 ====================

/**
 * 进度条渲染器
 */
class ProgressBar {
  constructor(options = {}) {
    this.width = options.width || 40;
    this.completeChar = options.completeChar || '█';
    this.incompleteChar = options.incompleteChar || '░';
    this.showPercent = options.showPercent !== false;
    this.prefix = options.prefix || '';
    this.suffix = options.suffix || '';
    this.colors = options.colors || {
      complete: 'green',
      incomplete: 'brightBlack'
    };
  }

  /**
   * 渲染进度条
   * @param {number} current - 当前值
   * @param {number} total - 总值
   * @returns {string} 进度条字符串
   */
  render(current, total) {
    const percent = total > 0 ? Math.min(1, current / total) : 0;
    const completeWidth = Math.round(percent * this.width);
    const incompleteWidth = this.width - completeWidth;

    const complete = this.colors.complete 
      ? colorize(this.completeChar.repeat(completeWidth), this.colors.complete)
      : this.completeChar.repeat(completeWidth);
    
    const incomplete = this.colors.incomplete
      ? colorize(this.incompleteChar.repeat(incompleteWidth), this.colors.incomplete)
      : this.incompleteChar.repeat(incompleteWidth);

    let output = `${this.prefix}[${complete}${incomplete}]`;

    if (this.showPercent) {
      output += ` ${Math.round(percent * 100)}%`;
    }

    output += this.suffix;

    return output;
  }

  /**
   * 更新进度条（在原位置更新）
   * @param {number} current - 当前值
   * @param {number} total - 总值
   */
  update(current, total) {
    const line = this.render(current, total);
    process.stdout.write('\r' + line);
  }

  /**
   * 完成进度条
   * @param {number} total - 总值
   */
  complete(total) {
    this.update(total, total);
    process.stdout.write('\n');
  }
}

// ==================== 安全文本处理 ====================

/**
 * 安全文本处理器
 * 防止日志注入和终端逃逸
 */
class SafeText {
  /**
   * 清理文本（移除 ANSI 和控制字符）
   * @param {string} text - 文本
   * @returns {string} 清理后的文本
   */
  sanitize(text) {
    let out = stripAnsi(text);

    // 移除 C0 控制字符 (U+0000–U+001F)
    for (let c = 0; c <= 0x1f; c++) {
      out = out.replaceAll(String.fromCharCode(c), '');
    }

    // 移除 DEL (U+007F)
    out = out.replaceAll(String.fromCharCode(0x7f), '');

    return out;
  }

  /**
   * 转义特殊字符
   * @param {string} text - 文本
   * @returns {string} 转义后的文本
   */
  escape(text) {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * 截断文本
   * @param {string} text - 文本
   * @param {number} maxLength - 最大长度
   * @param {string} suffix - 后缀
   * @returns {string} 截断后的文本
   */
  truncate(text, maxLength = 100, suffix = '...') {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength - suffix.length) + suffix;
  }

  /**
   * 单词截断
   * @param {string} text - 文本
   * @param {number} maxLength - 最大长度
   * @param {string} suffix - 后缀
   * @returns {string} 截断后的文本
   */
  truncateWords(text, maxLength = 100, suffix = '...') {
    if (!text || text.length <= maxLength) {
      return text;
    }

    const words = text.split(' ');
    let result = '';

    for (const word of words) {
      if ((result + ' ' + word).length > maxLength) {
        break;
      }
      result += (result ? ' ' : '') + word;
    }

    if (result.length < text.length) {
      result += suffix;
    }

    return result;
  }
}

// ==================== 主题管理 ====================

/**
 * 主题管理器
 */
class Theme {
  constructor(theme = 'default') {
    this.currentTheme = theme;
    this.themes = {
      default: {
        primary: 'blue',
        secondary: 'cyan',
        success: 'green',
        warning: 'yellow',
        error: 'red',
        muted: 'brightBlack'
      },
      dark: {
        primary: 'brightBlue',
        secondary: 'brightCyan',
        success: 'brightGreen',
        warning: 'brightYellow',
        error: 'brightRed',
        muted: 'white'
      },
      light: {
        primary: 'blue',
        secondary: 'cyan',
        success: 'green',
        warning: 'yellow',
        error: 'red',
        muted: 'black'
      }
    };
  }

  /**
   * 设置主题
   * @param {string} theme - 主题名称
   */
  setTheme(theme) {
    if (this.themes[theme]) {
      this.currentTheme = theme;
    }
  }

  /**
   * 获取当前主题
   * @returns {Object} 主题
   */
  getTheme() {
    return this.themes[this.currentTheme] || this.themes.default;
  }

  /**
   * 使用主题颜色
   * @param {string} text - 文本
   * @param {string} role - 角色
   * @returns {string} 带颜色的文本
   */
  use(text, role) {
    const theme = this.getTheme();
    const color = theme[role] || role;
    return colorize(text, color);
  }
}

// ==================== 全局实例 ====================

const palette = new Palette();
const tableRenderer = new TableRenderer();
const progressBar = new ProgressBar();
const safeText = new SafeText();
const theme = new Theme();

// ==================== 工厂函数（供 MCP 调用）====================

function createPalette(options = {}) {
  return new Palette(options);
}

function createTableRenderer(options = {}) {
  return new TableRenderer(options);
}

function createProgressBar(options = {}) {
  return new ProgressBar(options);
}

function createSafeText(options = {}) {
  return new SafeText(options);
}

function createTheme(options = {}) {
  return new Theme(options);
}

// ==================== 导出 ====================

module.exports = {
  // ANSI 颜色
  ansiColor,
  colorize,
  stripAnsi,
  visibleWidth,
  splitGraphemes,

  // 调色板
  Palette,
  palette,
  createPalette,

  // 表格
  TableRenderer,
  tableRenderer,
  createTableRenderer,

  // 进度条
  ProgressBar,
  progressBar,
  createProgressBar,

  // 安全文本
  SafeText,
  safeText,
  createSafeText,

  // 主题
  Theme,
  theme,
  createTheme,

  // 预定义调色板
  PALETTES
};
