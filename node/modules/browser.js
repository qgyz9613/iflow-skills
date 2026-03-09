/**
 * iFlow Browser Module
 * Playwright 浏览器自动化
 */

const path = require('path');
const fs = require('fs');

// 可选加载 Playwright
let chromium = null;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  console.log('[Browser] Playwright not installed, browser features disabled');
}

const STATE_DIR = path.join(__dirname, '..', 'browser-state');
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

let browser = null;
let context = null;
let page = null;

// 初始化浏览器
async function init(options = {}) {
  const start = Date.now();
  try {
    if (!chromium) {
      return { status: 'error', message: 'Playwright not installed. Run: npx playwright install chromium', time: Date.now() - start };
    }
    browser = await chromium.launch({
      headless: options.headless !== false,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    context = await browser.newContext({
      viewport: options.viewport || { width: 1280, height: 720 },
      userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    page = await context.newPage();
    
    return { status: 'ok', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 导航
async function navigate(url, options = {}) {
  const start = Date.now();
  try {
    if (!page) await init();
    
    await page.goto(url, {
      waitUntil: options.waitUntil || 'domcontentloaded',
      timeout: options.timeout || 30000
    });
    
    return { status: 'ok', url: page.url(), time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 点击
async function click(selector, options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    await page.click(selector, { timeout: options.timeout || 5000 });
    
    return { status: 'ok', selector, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 填充输入框
async function fill(selector, value, options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    if (options.clear !== false) await page.fill(selector, '');
    await page.type(selector, value, { delay: options.delay || 0 });
    
    return { status: 'ok', selector, value, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取文本
async function getText(selector) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const text = await page.textContent(selector);
    
    return { status: 'ok', text, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取页面内容
async function getContent() {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const content = await page.content();
    
    return { status: 'ok', content: content.substring(0, 50000), time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 截图
async function screenshot(options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const filePath = options.path || path.join(STATE_DIR, `screenshot_${Date.now()}.png`);
    
    if (options.fullPage) {
      await page.screenshot({ path: filePath, fullPage: true });
    } else if (options.selector) {
      await page.locator(options.selector).screenshot({ path: filePath });
    } else {
      await page.screenshot({ path: filePath });
    }
    
    return { status: 'ok', path: filePath, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 等待
async function wait(selector, options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    await page.waitForSelector(selector, {
      state: options.state || 'visible',
      timeout: options.timeout || 10000
    });
    
    return { status: 'ok', selector, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 执行脚本
async function evaluate(script) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const result = await page.evaluate(script);
    
    return { status: 'ok', result, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 保存状态
async function saveState(name) {
  const start = Date.now();
  try {
    if (!context) throw new Error('Browser not initialized');
    
    const statePath = path.join(STATE_DIR, `${name}.json`);
    await context.storageState({ path: statePath });
    
    return { status: 'ok', path: statePath, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 加载状态
async function loadState(name) {
  const start = Date.now();
  try {
    const statePath = path.join(STATE_DIR, `${name}.json`);
    if (!fs.existsSync(statePath)) {
      return { status: 'error', message: 'State not found', time: Date.now() - start };
    }
    
    if (browser) await browser.close();
    
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext({ storageState: statePath });
    page = await context.newPage();
    
    return { status: 'ok', path: statePath, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// Cookie 操作
async function getCookies() {
  const start = Date.now();
  try {
    if (!context) throw new Error('Browser not initialized');
    
    const cookies = await context.cookies();
    
    return { status: 'ok', cookies, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

async function setCookies(cookies) {
  const start = Date.now();
  try {
    if (!context) throw new Error('Browser not initialized');
    
    await context.addCookies(cookies);
    
    return { status: 'ok', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 关闭
async function close() {
  const start = Date.now();
  try {
    if (browser) {
      await browser.close();
      browser = null;
      context = null;
      page = null;
    }
    
    return { status: 'ok', time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取当前页面
function getPage() {
  return page;
}

module.exports = {
  init,
  navigate,
  click,
  fill,
  getText,
  getContent,
  screenshot,
  wait,
  evaluate,
  saveState,
  loadState,
  getCookies,
  setCookies,
  close,
  getPage
};