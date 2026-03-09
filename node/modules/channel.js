/**
 * iFlow Channel Module
 * 消息渠道集成
 */

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(__dirname, '..', 'channel-config.json');

// 加载配置
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

// 保存配置
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Telegram 发送
async function sendTelegram(message, options = {}) {
  const start = Date.now();
  try {
    const config = loadConfig();
    const token = options.token || config.telegram?.token;
    const chatId = options.chatId || config.telegram?.chatId;
    
    if (!token || !chatId) {
      return { status: 'error', message: 'Telegram token or chatId not configured', time: Date.now() - start };
    }
    
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: options.parseMode || 'HTML'
    });
    
    return new Promise((resolve) => {
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({
              status: result.ok ? 'ok' : 'error',
              message: result.description,
              messageId: result.result?.message_id,
              time: Date.now() - start
            });
          } catch (e) {
            resolve({ status: 'error', message: e.message, time: Date.now() - start });
          }
        });
      });
      
      req.on('error', (e) => {
        resolve({ status: 'error', message: e.message, time: Date.now() - start });
      });
      
      req.write(body);
      req.end();
    });
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// Discord 发送
async function sendDiscord(message, options = {}) {
  const start = Date.now();
  try {
    const config = loadConfig();
    const webhookUrl = options.webhook || config.discord?.webhook;
    
    if (!webhookUrl) {
      return { status: 'error', message: 'Discord webhook not configured', time: Date.now() - start };
    }
    
    const body = JSON.stringify({
      content: message,
      username: options.username || 'iFlow Bot',
      avatar_url: options.avatarUrl
    });
    
    return new Promise((resolve) => {
      const url = new URL(webhookUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode === 204 || res.statusCode === 200 ? 'ok' : 'error',
            message: res.statusCode === 204 ? 'Sent' : data,
            time: Date.now() - start
          });
        });
      });
      
      req.on('error', (e) => {
        resolve({ status: 'error', message: e.message, time: Date.now() - start });
      });
      
      req.write(body);
      req.end();
    });
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// Slack 发送
async function sendSlack(message, options = {}) {
  const start = Date.now();
  try {
    const config = loadConfig();
    const webhookUrl = options.webhook || config.slack?.webhook;
    
    if (!webhookUrl) {
      return { status: 'error', message: 'Slack webhook not configured', time: Date.now() - start };
    }
    
    const body = JSON.stringify({
      text: message,
      username: options.username || 'iFlow Bot',
      icon_emoji: options.iconEmoji || ':robot_face:'
    });
    
    return new Promise((resolve) => {
      const url = new URL(webhookUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode === 200 ? 'ok' : 'error',
            message: data || 'Sent',
            time: Date.now() - start
          });
        });
      });
      
      req.on('error', (e) => {
        resolve({ status: 'error', message: e.message, time: Date.now() - start });
      });
      
      req.write(body);
      req.end();
    });
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// Webhook 发送
async function sendWebhook(url, data, options = {}) {
  const start = Date.now();
  try {
    const body = JSON.stringify(data);
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    return new Promise((resolve) => {
      const req = client.request(url, {
        method: options.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(options.headers || {})
        }
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode >= 200 && res.statusCode < 300 ? 'ok' : 'error',
            statusCode: res.statusCode,
            data: responseData,
            time: Date.now() - start
          });
        });
      });
      
      req.on('error', (e) => {
        resolve({ status: 'error', message: e.message, time: Date.now() - start });
      });
      
      req.write(body);
      req.end();
    });
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// Email 发送 (通过 Webhook 代理)
async function sendEmail(to, subject, body, options = {}) {
  const start = Date.now();
  try {
    const config = loadConfig();
    const emailWebhook = config.email?.webhook;
    
    if (!emailWebhook) {
      return { status: 'error', message: 'Email webhook not configured', time: Date.now() - start };
    }
    
    return await sendWebhook(emailWebhook, {
      to,
      subject,
      body,
      from: options.from || config.email?.from
    });
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 配置管理
function config(channel, settings) {
  const currentConfig = loadConfig();
  currentConfig[channel] = settings;
  saveConfig(currentConfig);
  return { status: 'ok', channel, settings };
}

function getConfig(channel) {
  const currentConfig = loadConfig();
  return {
    status: 'ok',
    channel,
    settings: currentConfig[channel] || {}
  };
}

module.exports = {
  sendTelegram,
  sendDiscord,
  sendSlack,
  sendWebhook,
  sendEmail,
  config,
  getConfig
};