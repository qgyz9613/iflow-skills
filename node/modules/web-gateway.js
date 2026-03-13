/**
 * iFlow Web Gateway Module
 * 提供 Web 控制界面和 REST API
 * 远程控制 iFlow CLI
 */

const http = require('http');
const { EventEmitter } = require('events');
const { getSystemInfo } = require('./system-utils');

// ==================== 配置 ====================

const DEFAULT_CONFIG = {
  host: '127.0.0.1',
  port: 3456,
  corsEnabled: true,
  staticFiles: false
};

// ==================== Gateway 类 ====================

class WebGateway extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
    
    this.server = null;
    this.isRunning = false;
    this.connections = new Map();
    this.requestCount = 0;
  }

  /**
   * 创建 HTTP 服务器
   */
  createServer() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // 记录连接
    this.server.on('connection', (socket) => {
      const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
      this.connections.set(connectionId, {
        socket,
        connectedAt: Date.now()
      });

      socket.on('close', () => {
        this.connections.delete(connectionId);
      });
    });

    this.server.on('error', (err) => {
      this.emit('error', err);
    });
  }

  /**
   * 处理 HTTP 请求
   */
  async handleRequest(req, res) {
    this.requestCount++;

    // 设置 CORS 头
    if (this.config.corsEnabled) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 解析 URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    try {
      // 路由
      if (pathname === '/' && method === 'GET') {
        this.handleIndex(req, res);
      } else if (pathname === '/api/status' && method === 'GET') {
        await this.handleStatus(req, res);
      } else if (pathname === '/api/modules' && method === 'GET') {
        await this.handleModules(req, res);
      } else if (pathname === '/api/config' && method === 'GET') {
        await this.handleGetConfig(req, res);
      } else if (pathname === '/api/execute' && method === 'POST') {
        await this.handleExecute(req, res);
      } else if (pathname === '/api/shutdown' && method === 'POST') {
        await this.handleShutdown(req, res);
      } else {
        this.handleNotFound(req, res);
      }
    } catch (err) {
      this.handleError(req, res, err);
    }
  }

  /**
   * 处理首页
   */
  handleIndex(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>iFlow Web Gateway</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #4ade80; margin-bottom: 20px; }
    .card { background: #16213e; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #0f3460; }
    .card h2 { color: #4ade80; margin-bottom: 15px; font-size: 1.2em; }
    .status { display: flex; gap: 20px; flex-wrap: wrap; }
    .status-item { flex: 1; min-width: 200px; }
    .status-label { color: #888; font-size: 0.9em; margin-bottom: 5px; }
    .status-value { font-size: 1.5em; font-weight: bold; }
    .status-value.running { color: #4ade80; }
    .status-value.stopped { color: #f87171; }
    .api-list { list-style: none; }
    .api-list li { padding: 10px; border-bottom: 1px solid #0f3460; }
    .api-list li:last-child { border-bottom: none; }
    .method { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; margin-right: 10px; }
    .method.GET { background: #3b82f6; color: white; }
    .method.POST { background: #10b981; color: white; }
    .endpoint { font-family: monospace; color: #fbbf24; }
    button { background: #4ade80; color: #1a1a2e; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 1em; }
    button:hover { background: #22c55e; }
    button.shutdown { background: #f87171; color: white; }
    button.shutdown:hover { background: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 iFlow Web Gateway</h1>
    
    <div class="card">
      <h2>系统状态</h2>
      <div class="status">
        <div class="status-item">
          <div class="status-label">运行状态</div>
          <div class="status-value running">● 运行中</div>
        </div>
        <div class="status-item">
          <div class="status-label">端口</div>
          <div class="status-value">${this.config.port}</div>
        </div>
        <div class="status-item">
          <div class="status-label">请求数</div>
          <div class="status-value" id="requestCount">${this.requestCount}</div>
        </div>
        <div class="status-item">
          <div class="status-label">连接数</div>
          <div class="status-value" id="connectionCount">${this.connections.size}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>API 端点</h2>
      <ul class="api-list">
        <li><span class="method GET">GET</span> <span class="endpoint">/api/status</span> - 获取系统状态</li>
        <li><span class="method GET">GET</span> <span class="endpoint">/api/modules</span> - 获取模块列表</li>
        <li><span class="method GET">GET</span> <span class="endpoint">/api/config</span> - 获取配置</li>
        <li><span class="method POST">POST</span> <span class="endpoint">/api/execute</span> - 执行命令</li>
        <li><span class="method POST">POST</span> <span class="endpoint">/api/shutdown</span> - 关闭服务</li>
      </ul>
    </div>

    <div class="card">
      <h2>操作</h2>
      <button onclick="refreshStatus()">刷新状态</button>
      <button class="shutdown" onclick="shutdown()">关闭服务</button>
    </div>
  </div>

  <script>
    function refreshStatus() {
      fetch('/api/status')
        .then(r => r.json())
        .then(data => {
          document.getElementById('requestCount').textContent = data.requestCount || 0;
          document.getElementById('connectionCount').textContent = data.connectionCount || 0;
        });
    }

    function shutdown() {
      if (confirm('确定要关闭 Web Gateway 吗？')) {
        fetch('/api/shutdown', { method: 'POST' })
          .then(() => {
            alert('服务已关闭');
          });
      }
    }

    setInterval(refreshStatus, 5000);
  </script>
</body>
</html>
    `);
  }

  /**
   * 处理状态查询
   */
  async handleStatus(req, res) {
    const systemInfo = getSystemInfo();
    
    const status = {
      running: this.isRunning,
      uptime: process.uptime(),
      requestCount: this.requestCount,
      connectionCount: this.connections.size,
      system: systemInfo,
      config: {
        host: this.config.host,
        port: this.config.port
      }
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
  }

  /**
   * 处理模块列表
   */
  async handleModules(req, res) {
    try {
      const modules = require('../index.js');
      const capabilities = modules.getCapabilities();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(capabilities, null, 2));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }, null, 2));
    }
  }

  /**
   * 处理配置查询
   */
  async handleGetConfig(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.config, null, 2));
  }

  /**
   * 处理命令执行
   */
  async handleExecute(req, res) {
    try {
      const body = await this.parseBody(req);
      
      this.emit('execute', body);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'Command executed',
        command: body 
      }, null, 2));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }, null, 2));
    }
  }

  /**
   * 处理关闭请求
   */
  async handleShutdown(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Shutting down...' }, null, 2));
    
    setImmediate(() => this.stop());
  }

  /**
   * 处理 404
   */
  handleNotFound(req, res) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }, null, 2));
  }

  /**
   * 处理错误
   */
  handleError(req, res, err) {
    console.error('Gateway error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }, null, 2));
  }

  /**
   * 解析请求体
   */
  parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
   * 启动服务器
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Gateway is already running');
    }

    this.createServer();

    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        this.emit('started', {
          host: this.config.host,
          port: this.config.port
        });
        resolve();
      });

      this.server.once('error', reject);
    });
  }

  /**
   * 停止服务器
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        this.emit('stopped');
        resolve();
      });
    });
  }

  /**
   * 获取运行状态
   */
  getStatus() {
    return {
      running: this.isRunning,
      host: this.config.host,
      port: this.config.port,
      requestCount: this.requestCount,
      connectionCount: this.connections.size
    };
  }
}

// ==================== 导出 ====================

module.exports = {
  WebGateway,
  DEFAULT_CONFIG
};