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

// ==================== 页面状态监控 ====================

const MAX_CONSOLE_MESSAGES = 50;
const MAX_PAGE_ERRORS = 50;
const MAX_NETWORK_REQUESTS = 100;

const pageStates = new Map();
const observedPages = new Set();

function ensurePageState(targetPage) {
  const existing = pageStates.get(targetPage);
  if (existing) {
    return existing;
  }

  const state = {
    console: [],
    errors: [],
    requests: [],
    requestIds: new WeakMap(),
    nextRequestId: 0
  };
  pageStates.set(targetPage, state);

  if (!observedPages.has(targetPage)) {
    observedPages.add(targetPage);
    
    // 监听控制台消息
    targetPage.on('console', (msg) => {
      state.console.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
        location: msg.location()
      });
      if (state.console.length > MAX_CONSOLE_MESSAGES) {
        state.console.shift();
      }
    });

    // 监听页面错误
    targetPage.on('pageerror', (err) => {
      state.errors.push({
        message: err?.message ? String(err.message) : String(err),
        name: err?.name ? String(err.name) : undefined,
        stack: err?.stack ? String(err.stack) : undefined,
        timestamp: new Date().toISOString()
      });
      if (state.errors.length > MAX_PAGE_ERRORS) {
        state.errors.shift();
      }
    });

    // 监听网络请求
    targetPage.on('request', (req) => {
      state.nextRequestId += 1;
      const id = `r${state.nextRequestId}`;
      state.requestIds.set(req, id);
      state.requests.push({
        id,
        timestamp: new Date().toISOString(),
        method: req.method(),
        url: req.url(),
        resourceType: req.resourceType(),
        status: null,
        ok: null,
        failureText: null
      });
      if (state.requests.length > MAX_NETWORK_REQUESTS) {
        state.requests.shift();
      }
    });

    // 监听响应
    targetPage.on('response', (resp) => {
      const req = resp.request();
      const id = state.requestIds.get(req);
      if (!id) return;
      
      const rec = state.requests.find(r => r.id === id);
      if (rec) {
        rec.status = resp.status();
        rec.ok = resp.ok();
      }
    });

    // 监听请求失败
    targetPage.on('requestfailed', (req) => {
      const id = state.requestIds.get(req);
      if (!id) return;
      
      const rec = state.requests.find(r => r.id === id);
      if (rec) {
        rec.failureText = req.failure()?.errorText;
        rec.ok = false;
      }
    });

    // 页面关闭时清理状态
    targetPage.on('close', () => {
      pageStates.delete(targetPage);
      observedPages.delete(targetPage);
    });
  }

  return state;
}

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
    
    const contextOptions = {
      viewport: options.viewport || { width: 1280, height: 720 },
      userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    
    // 支持时区设置
    if (options.timezoneId) {
      contextOptions.timezoneId = options.timezoneId;
    }
    
    // 支持语言设置
    if (options.locale) {
      contextOptions.locale = options.locale;
    }
    
    // 支持颜色方案设置
    if (options.colorScheme) {
      contextOptions.colorScheme = options.colorScheme;
    }
    
    // 支持地理位置设置
    if (options.latitude !== undefined && options.longitude !== undefined) {
      contextOptions.geolocation = {
        latitude: options.latitude,
        longitude: options.longitude,
        accuracy: options.accuracy || 0
      };
      contextOptions.permissions = ['geolocation'];
    }
    
    context = await browser.newContext(contextOptions);
    
    page = await context.newPage();
    
    // 启用页面状态监控
    ensurePageState(page);
    
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

// ==================== 多页面管理 ====================

// 页面存储
const pages = new Map(); // Map<pageId, {page, url, title}>

// 新建页面
async function newPage(url, options = {}) {
  const start = Date.now();
  try {
    if (!context) {
      await init(options);
    }

    const newPage = await context.newPage();
    const pageId = `page_${Date.now()}`;

    if (url) {
      await newPage.goto(url, {
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: options.timeout || 30000
      });
    }

    pages.set(pageId, {
      page: newPage,
      url: newPage.url(),
      title: await newPage.title()
    });

    return { 
      status: 'ok', 
      pageId, 
      url: newPage.url(), 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取所有页面
async function getPages() {
  const start = Date.now();
  try {
    const pageList = [];
    
    // 添加主页面
    if (page) {
      pageList.push({
        pageId: 'main',
        url: page.url(),
        title: await page.title(),
        isMain: true
      });
    }

    // 添加其他页面
    for (const [pageId, pageInfo] of pages.entries()) {
      try {
        pageList.push({
          pageId,
          url: pageInfo.page.url(),
          title: await pageInfo.page.title(),
          isMain: false
        });
      } catch (e) {
        // 页面可能已关闭
        pages.delete(pageId);
      }
    }

    return { 
      status: 'ok', 
      pages: pageList, 
      count: pageList.length,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 切换页面
async function switchPage(pageId) {
  const start = Date.now();
  try {
    if (pageId === 'main') {
      if (!page) throw new Error('Main page not initialized');
      return { 
        status: 'ok', 
        pageId: 'main', 
        url: page.url(), 
        time: Date.now() - start 
      };
    }

    const pageInfo = pages.get(pageId);
    if (!pageInfo) {
      throw new Error(`Page ${pageId} not found`);
    }

    // 更新全局 page 引用
    page = pageInfo.page;

    return { 
      status: 'ok', 
      pageId, 
      url: page.url(), 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 关闭指定页面
async function closePage(pageId) {
  const start = Date.now();
  try {
    if (pageId === 'main') {
      throw new Error('Cannot close main page. Use close() instead.');
    }

    const pageInfo = pages.get(pageId);
    if (!pageInfo) {
      throw new Error(`Page ${pageId} not found`);
    }

    await pageInfo.page.close();
    pages.delete(pageId);

    return { 
      status: 'ok', 
      pageId, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ==================== 高级交互 ====================

// 双击
async function doubleClick(selector, options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    await page.dblclick(selector, { 
      timeout: options.timeout || 5000 
    });
    
    return { 
      status: 'ok', 
      selector, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 悬停
async function hover(selector, options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    await page.hover(selector, { 
      timeout: options.timeout || 5000 
    });
    
    return { 
      status: 'ok', 
      selector, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 拖拽
async function drag(fromSelector, toSelector, options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const fromElement = page.locator(fromSelector);
    const toElement = page.locator(toSelector);
    
    await fromElement.dragTo(toElement, {
      timeout: options.timeout || 10000
    });
    
    return { 
      status: 'ok', 
      from: fromSelector, 
      to: toSelector, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 滚动
async function scroll(distance, options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    if (typeof distance === 'number') {
      // 滚动指定像素
      await page.evaluate((dist) => {
        window.scrollBy(0, dist);
      }, distance);
    } else if (options.selector) {
      // 滚动到指定元素
      await page.locator(options.selector).scrollIntoViewIfNeeded({
        timeout: options.timeout || 5000
      });
    } else if (distance === 'top') {
      // 滚动到顶部
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
    } else if (distance === 'bottom') {
      // 滚动到底部
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
    }
    
    return { 
      status: 'ok', 
      distance, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 按键
async function pressKey(key, options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    await page.keyboard.press(key, {
      delay: options.delay || 0
    });
    
    return { 
      status: 'ok', 
      key, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ==================== 表单批量操作 ====================

// 批量填充表单
async function fillForm(fields, options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const results = [];
    
    for (const field of fields) {
      try {
        if (field.clear !== false) {
          await page.locator(field.selector).clear();
        }
        
        if (field.type === 'select') {
          // 下拉选择
          await page.locator(field.selector).selectOption(field.value);
        } else if (field.type === 'checkbox') {
          // 复选框
          if (field.value) {
            await page.locator(field.selector).check();
          } else {
            await page.locator(field.selector).uncheck();
          }
        } else if (field.type === 'radio') {
          // 单选按钮
          await page.locator(field.selector).check();
        } else {
          // 文本输入
          await page.locator(field.selector).fill(String(field.value));
        }
        
        results.push({
          selector: field.selector,
          success: true
        });
      } catch (e) {
        results.push({
          selector: field.selector,
          success: false,
          error: e.message
        });
      }
    }
    
    const failedCount = results.filter(r => !r.success).length;
    
    return { 
      status: failedCount === 0 ? 'ok' : 'partial', 
      results,
      total: fields.length,
      failed: failedCount,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 上传文件
async function uploadFile(selector, filePath, options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const fileInput = page.locator(selector);
    
    if (options.multiple) {
      await fileInput.setInputFiles(filePath);
    } else {
      await fileInput.setInputFiles(filePath);
    }
    
    return { 
      status: 'ok', 
      selector, 
      path: filePath, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ==================== 网络和调试功能 ====================

// 获取控制台消息
async function getConsoleMessages(options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const state = ensurePageState(page);
    let messages = state.console;
    
    // 按级别过滤
    if (options.level) {
      messages = messages.filter(msg => msg.type === options.level);
    }
    
    // 清空消息
    if (options.clear) {
      state.console = [];
    }
    
    return { 
      status: 'ok', 
      messages, 
      count: messages.length,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取页面错误
async function getPageErrors(options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const state = ensurePageState(page);
    let errors = state.errors;
    
    // 清空错误
    if (options.clear) {
      state.errors = [];
    }
    
    return { 
      status: 'ok', 
      errors, 
      count: errors.length,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取网络请求
async function getNetworkRequests(options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const state = ensurePageState(page);
    let requests = state.requests;
    
    // 按资源类型过滤
    if (options.filter) {
      requests = requests.filter(req => req.resourceType === options.filter);
    }
    
    // 清空请求
    if (options.clear) {
      state.requests = [];
    }
    
    return { 
      status: 'ok', 
      requests, 
      count: requests.length,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 清除所有监控数据
async function clearMonitoringData() {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const state = ensurePageState(page);
    state.console = [];
    state.errors = [];
    state.requests = [];
    
    return { 
      status: 'ok', 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ==================== 性能监控 ====================

// 开始性能追踪
async function startPerformanceTrace(options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    // 开始追踪性能指标
    await page.context().tracing.start({
      screenshots: options.screenshots || false,
      snapshots: options.snapshots || false
    });
    
    return { 
      status: 'ok', 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 停止性能追踪
async function stopPerformanceTrace(options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const timestamp = Date.now();
    const defaultPath = path.join(STATE_DIR, `trace_${timestamp}.zip`);
    const filePath = options.path || defaultPath;
    
    await page.context().tracing.stop({ path: filePath });
    
    return { 
      status: 'ok', 
      path: filePath, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取性能指标
async function getPerformanceMetrics() {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        // 页面加载时间
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        pageLoad: navigation.loadEventEnd - navigation.fetchStart,
        
        // DNS 时间
        dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
        
        // TCP 连接时间
        tcpConnect: navigation.connectEnd - navigation.connectStart,
        
        // 请求时间
        requestTime: navigation.responseStart - navigation.requestStart,
        
        // 响应时间
        responseTime: navigation.responseEnd - navigation.responseStart,
        
        // DOM 处理时间
        domProcessing: navigation.domComplete - navigation.domInteractive,
        
        // 资源统计
        resources: performance.getEntriesByType('resource').length
      };
    });
    
    return { 
      status: 'ok', 
      metrics, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ==================== 设备模拟 ====================

// 设置视口大小
async function setViewport(width, height, options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    await page.setViewportSize({ width, height });
    
    return { 
      status: 'ok', 
      width, 
      height, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 设置地理位置
async function setGeolocation(latitude, longitude, options = {}) {
  const start = Date.now();
  try {
    if (!context) throw new Error('Browser not initialized');
    
    await context.setGeolocation({
      latitude,
      longitude,
      accuracy: options.accuracy || 0
    });
    
    return { 
      status: 'ok', 
      latitude, 
      longitude, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 清除地理位置
async function clearGeolocation() {
  const start = Date.now();
  try {
    if (!context) throw new Error('Browser not initialized');
    
    await context.clearGeolocation();
    
    return { 
      status: 'ok', 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 设置时区
async function setTimezone(timezoneId) {
  const start = Date.now();
  try {
    if (!context) throw new Error('Browser not initialized');
    
    // 需要在创建 context 时设置，这里返回错误提示
    return { 
      status: 'error', 
      message: 'Timezone must be set during browser initialization. Use init({ timezoneId: ... }) instead.',
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 设置语言
async function setLocale(locale) {
  const start = Date.now();
  try {
    if (!context) throw new Error('Browser not initialized');
    
    // 需要在创建 context 时设置，这里返回错误提示
    return { 
      status: 'error', 
      message: 'Locale must be set during browser initialization. Use init({ locale: ... }) instead.',
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 设置颜色方案
async function setColorScheme(scheme) {
  const start = Date.now();
  try {
    if (!context) throw new Error('Browser not initialized');
    
    // 需要在创建 context 时设置，这里返回错误提示
    return { 
      status: 'error', 
      message: 'Color scheme must be set during browser initialization. Use init({ colorScheme: ... }) instead.',
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 设置离线模式
async function setOffline(offline) {
  const start = Date.now();
  try {
    if (!context) throw new Error('Browser not initialized');
    
    await context.setOffline(offline);
    
    return { 
      status: 'ok', 
      offline, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 模拟设备
async function emulateDevice(deviceName) {
  const start = Date.now();
  try {
    if (!context) throw new Error('Browser not initialized');
    
    const devices = {
      // iPhone 系列
      'iPhone 12': { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPhone 12 Pro': { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPhone 12 Pro Max': { viewport: { width: 428, height: 926 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPhone 13': { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPhone 13 Pro': { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPhone 13 Pro Max': { viewport: { width: 428, height: 926 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPhone 14': { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPhone 14 Pro': { viewport: { width: 393, height: 852 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPhone 14 Pro Max': { viewport: { width: 430, height: 932 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1', isMobile: true },
      
      // iPad 系列
      'iPad Pro': { viewport: { width: 1024, height: 1366 }, userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPad Pro 11': { viewport: { width: 834, height: 1194 }, userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPad Pro 12.9': { viewport: { width: 1024, height: 1366 }, userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPad Air': { viewport: { width: 820, height: 1180 }, userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPad Mini': { viewport: { width: 744, height: 1133 }, userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1', isMobile: true },
      
      // Android 系列
      'Pixel 5': { viewport: { width: 393, height: 851 }, userAgent: 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.95 Mobile Safari/537.36', isMobile: true },
      'Pixel 6': { viewport: { width: 412, height: 915 }, userAgent: 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.74 Mobile Safari/537.36', isMobile: true },
      'Pixel 6 Pro': { viewport: { width: 412, height: 915 }, userAgent: 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.74 Mobile Safari/537.36', isMobile: true },
      'Pixel 7': { viewport: { width: 412, height: 915 }, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.128 Mobile Safari/537.36', isMobile: true },
      'Pixel 7 Pro': { viewport: { width: 412, height: 915 }, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.128 Mobile Safari/537.36', isMobile: true },
      'Samsung Galaxy S21': { viewport: { width: 360, height: 800 }, userAgent: 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.93 Mobile Safari/537.36', isMobile: true },
      'Samsung Galaxy S22': { viewport: { width: 360, height: 800 }, userAgent: 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.101 Mobile Safari/537.36', isMobile: true },
      'Samsung Galaxy S23': { viewport: { width: 360, height: 800 }, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.5563.64 Mobile Safari/537.36', isMobile: true },
      
      // 桌面系列
      'Desktop': { viewport: { width: 1280, height: 720 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36', isMobile: false },
      'Desktop HD': { viewport: { width: 1920, height: 1080 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36', isMobile: false },
      'Desktop 2K': { viewport: { width: 2560, height: 1440 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36', isMobile: false },
      'Desktop 4K': { viewport: { width: 3840, height: 2160 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36', isMobile: false },
      'MacBook Pro': { viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36', isMobile: false },
      'MacBook Pro Retina': { viewport: { width: 2560, height: 1600 }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36', isMobile: false },
      
      // 平板横屏
      'iPad Pro Landscape': { viewport: { width: 1366, height: 1024 }, userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1', isMobile: true },
      'iPad Pro 11 Landscape': { viewport: { width: 1194, height: 834 }, userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1', isMobile: true }
    };
    
    const device = devices[deviceName];
    if (!device) {
      throw new Error(`Unknown device: ${deviceName}. Available: ${Object.keys(devices).join(', ')}`);
    }
    
    await page.setViewportSize(device.viewport);
    
    return { 
      status: 'ok', 
      device: deviceName, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 获取可用设备列表
function getAvailableDevices() {
  return {
    'iPhone 系列': ['iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max', 'iPhone 14', 'iPhone 14 Pro', 'iPhone 14 Pro Max'],
    'iPad 系列': ['iPad Pro', 'iPad Pro 11', 'iPad Pro 12.9', 'iPad Air', 'iPad Mini', 'iPad Pro Landscape', 'iPad Pro 11 Landscape'],
    'Android 系列': ['Pixel 5', 'Pixel 6', 'Pixel 6 Pro', 'Pixel 7', 'Pixel 7 Pro', 'Samsung Galaxy S21', 'Samsung Galaxy S22', 'Samsung Galaxy S23'],
    '桌面系列': ['Desktop', 'Desktop HD', 'Desktop 2K', 'Desktop 4K', 'MacBook Pro', 'MacBook Pro Retina']
  };
}

// ==================== 导出功能 ====================

// 导出为 PDF
async function exportPdf(options = {}) {
  const start = Date.now();
  try {
    if (!page) throw new Error('Browser not initialized');
    
    const timestamp = Date.now();
    const defaultPath = path.join(STATE_DIR, `page_${timestamp}.pdf`);
    const filePath = options.path || defaultPath;
    
    await page.pdf({
      path: filePath,
      format: options.format || 'A4',
      printBackground: options.printBackground !== false,
      landscape: options.landscape || false,
      margin: options.margin || {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });
    
    return { 
      status: 'ok', 
      path: filePath, 
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ==================== 持久化上下文 ====================

// 启动持久化上下文
async function launchPersistentContext(userDataDir, options = {}) {
  const start = Date.now();
  try {
    if (!chromium) {
      return { status: 'error', message: 'Playwright not installed. Run: npx playwright install chromium', time: Date.now() - start };
    }
    
    // 关闭现有浏览器
    if (browser) {
      await browser.close();
    }
    
    const contextOptions = {
      viewport: options.viewport || { width: 1280, height: 720 },
      userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    
    // 支持时区设置
    if (options.timezoneId) {
      contextOptions.timezoneId = options.timezoneId;
    }
    
    // 支持语言设置
    if (options.locale) {
      contextOptions.locale = options.locale;
    }
    
    // 支持颜色方案设置
    if (options.colorScheme) {
      contextOptions.colorScheme = options.colorScheme;
    }
    
    // 支持地理位置设置
    if (options.latitude !== undefined && options.longitude !== undefined) {
      contextOptions.geolocation = {
        latitude: options.latitude,
        longitude: options.longitude,
        accuracy: options.accuracy || 0
      };
      contextOptions.permissions = ['geolocation'];
    }
    
    // 启动持久化上下文
    context = await chromium.launchPersistentContext(userDataDir, contextOptions);
    browser = context.browser();
    
    // 获取或创建页面
    const pages = context.pages();
    if (pages.length > 0) {
      page = pages[0];
    } else {
      page = await context.newPage();
    }
    
    // 启用页面状态监控
    ensurePageState(page);
    
    return { 
      status: 'ok', 
      userDataDir,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

module.exports = {
  // 基础功能
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
  getPage,
  
  // 多页面管理
  newPage,
  getPages,
  switchPage,
  closePage,
  
  // 高级交互
  doubleClick,
  hover,
  drag,
  scroll,
  pressKey,
  
  // 表单批量操作
  fillForm,
  uploadFile,
  
  // 网络和调试
  getConsoleMessages,
  getPageErrors,
  getNetworkRequests,
  clearMonitoringData,
  
  // 性能监控
  startPerformanceTrace,
  stopPerformanceTrace,
  getPerformanceMetrics,
  
  // 设备模拟
  setViewport,
  setGeolocation,
  clearGeolocation,
  setTimezone,
  setLocale,
  setColorScheme,
  setOffline,
  emulateDevice,
  getAvailableDevices,
  
  // 导出功能
  exportPdf,
  
  // 持久化上下文
  launchPersistentContext
};