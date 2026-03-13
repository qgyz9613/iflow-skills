/**
 * iFlow Channel Module
 * 消息渠道集成
 */

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

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

// 企业微信发送消息
async function sendWeCom(message, options = {}) {
  const start = Date.now();
  try {
    const config = loadConfig();
    const webhookUrl = options.webhook || config.wecom?.webhook;
    
    if (!webhookUrl) {
      return { status: 'error', message: 'WeCom webhook not configured', time: Date.now() - start };
    }
    
    let body;
    const msgType = options.msgType || 'text';
    
    if (msgType === 'markdown') {
      body = JSON.stringify({
        msgtype: 'markdown',
        markdown: { content: message }
      });
    } else if (msgType === 'text') {
      body = JSON.stringify({
        msgtype: 'text',
        text: {
          content: message,
          mentioned_list: options.mentionedList || [],
          mentioned_mobile_list: options.mentionedMobileList || []
        }
      });
    } else if (msgType === 'card') {
      body = JSON.stringify({
        msgtype: 'template_card',
        template_card: options.cardData
      });
    } else {
      body = JSON.stringify({
        msgtype: 'text',
        text: { content: message }
      });
    }
    
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
          try {
            const result = JSON.parse(data);
            resolve({
              status: result.errcode === 0 ? 'ok' : 'error',
              message: result.errmsg,
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

// SMTP 直接发送邮件
async function sendSmtpEmail(to, subject, content, options = {}) {
  const start = Date.now();
  try {
    const config = loadConfig();
    const smtpConfig = options.smtp || config.smtp || {};
    
    // 默认 QQ 邮箱配置
    const host = smtpConfig.host || 'smtp.qq.com';
    const port = smtpConfig.port || 465;
    const secure = smtpConfig.secure !== false;
    const user = smtpConfig.user || config.smtp?.user;
    const pass = smtpConfig.pass || config.smtp?.pass;
    
    if (!user || !pass) {
      return { status: 'error', message: 'SMTP user or pass not configured', time: Date.now() - start };
    }
    
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
    
    const mailOptions = {
      from: options.from || `"iFlow Bot" <${user}>`,
      to,
      subject,
      text: options.isHtml ? undefined : content,
      html: options.isHtml ? content : undefined
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    return {
      status: 'ok',
      messageId: info.messageId,
      response: info.response,
      time: Date.now() - start
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ========== 企业微信回调服务器 ==========

const crypto = require('crypto');

// 消息处理器存储
const messageHandlers = new Map();

// 注册消息处理器
function onMessage(handlerName, handler) {
  messageHandlers.set(handlerName, handler);
  return { status: 'ok', handler: handlerName };
}

// 企业微信消息解密
function decryptWeComMessage(encryptedMsg, encodingAESKey) {
  try {
    const key = Buffer.from(encodingAESKey + '=', 'base64');
    const encrypted = Buffer.from(encryptedMsg, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, key.slice(0, 16));
    decipher.setAutoPadding(false);
    
    let decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    
    // 去除补位
    const pad = decrypted[decrypted.length - 1];
    decrypted = decrypted.slice(0, decrypted.length - pad);
    
    // 解析内容
    const content = decrypted.slice(16);
    const msgLen = content.readUInt32BE(0);
    const msg = content.slice(4, 4 + msgLen).toString();
    
    return JSON.parse(msg);
  } catch (e) {
    return null;
  }
}

// 企业微信消息加密（回复用）
function encryptWeComMessage(msg, encodingAESKey, corpId) {
  try {
    const key = Buffer.from(encodingAESKey + '=', 'base64');
    const msgBuffer = Buffer.from(msg);
    const msgLen = Buffer.alloc(4);
    msgLen.writeUInt32BE(msgBuffer.length, 0);
    
    // 随机16字节
    const random = crypto.randomBytes(16);
    const content = Buffer.concat([random, msgLen, msgBuffer, Buffer.from(corpId)]);
    
    // PKCS7 补位
    const padLen = 32 - (content.length % 32);
    const padded = Buffer.concat([content, Buffer.alloc(padLen, padLen)]);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, key.slice(0, 16));
    cipher.setAutoPadding(false);
    
    const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
    return encrypted.toString('base64');
  } catch (e) {
    return null;
  }
}

// 企业微信签名验证
function verifyWeComSignature(signature, token, timestamp, nonce, echostr) {
  const arr = [token, timestamp, nonce, echostr].sort();
  const sha1 = crypto.createHash('sha1').update(arr.join('')).digest('hex');
  return sha1 === signature;
}

// 创建回调服务器
function createWeComServer(options = {}) {
  const config = loadConfig();
  const port = options.port || config.wecom?.callbackPort || 8080;
  const token = options.token || config.wecom?.token;
  const encodingAESKey = options.encodingAESKey || config.wecom?.encodingAESKey;
  const corpId = options.corpId || config.wecom?.corpId;
  
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const query = Object.fromEntries(url.searchParams);
    
    // 验证 URL（首次配置时）
    if (req.method === 'GET') {
      const { msg_signature, timestamp, nonce, echostr } = query;
      
      if (verifyWeComSignature(msg_signature, token, timestamp, nonce, echostr)) {
        const decrypted = decryptWeComMessage(echostr, encodingAESKey);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(decrypted || echostr);
      } else {
        res.writeHead(403);
        res.end('Invalid signature');
      }
      return;
    }
    
    // 接收消息
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const decrypted = decryptWeComMessage(data.Encrypt, encodingAESKey);
          
          if (decrypted && messageHandlers.size > 0) {
            // 调用所有注册的处理器
            for (const [name, handler] of messageHandlers) {
              try {
                await handler(decrypted);
              } catch (e) {
                console.error(`Handler ${name} error:`, e.message);
              }
            }
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errcode: 0, errmsg: 'ok' }));
        } catch (e) {
          res.writeHead(500);
          res.end(e.message);
        }
      });
      return;
    }
    
    res.writeHead(404);
    res.end('Not found');
  });
  
  return {
    start: () => new Promise((resolve) => {
      server.listen(port, () => {
        console.log(`[WeCom Callback] Server started on port ${port}`);
        resolve({ status: 'ok', port });
      });
    }),
    stop: () => new Promise((resolve) => {
      server.close(() => resolve({ status: 'ok' }));
    })
  };
}

// ========== 钉钉支持 ==========

// 钉钉发送消息
async function sendDingTalk(message, options = {}) {
  const start = Date.now();
  try {
    const config = loadConfig();
    const webhookUrl = options.webhook || config.dingtalk?.webhook;
    
    if (!webhookUrl) {
      return { status: 'error', message: 'DingTalk webhook not configured', time: Date.now() - start };
    }
    
    const msgType = options.msgType || 'text';
    let body;
    
    if (msgType === 'markdown') {
      body = JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title: options.title || '通知',
          text: message
        }
      });
    } else if (msgType === 'text') {
      body = JSON.stringify({
        msgtype: 'text',
        text: {
          content: message,
          atMobiles: options.atMobiles || [],
          isAtAll: options.atAll || false
        }
      });
    } else if (msgType === 'link') {
      body = JSON.stringify({
        msgtype: 'link',
        link: {
          title: options.title,
          text: message,
          messageUrl: options.messageUrl,
          picUrl: options.picUrl
        }
      });
    } else {
      body = JSON.stringify({
        msgtype: 'text',
        text: { content: message }
      });
    }
    
    // 签名（如果配置了 secret）
    const secret = options.secret || config.dingtalk?.secret;
    if (secret) {
      const timestamp = Date.now();
      const sign = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}\n${secret}`)
        .digest('base64');
      webhookUrl += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    }
    
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
          try {
            const result = JSON.parse(data);
            resolve({
              status: result.errcode === 0 ? 'ok' : 'error',
              message: result.errmsg,
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

// ========== 飞书支持 ==========

// 飞书发送消息
async function sendFeishu(message, options = {}) {
  const start = Date.now();
  try {
    const config = loadConfig();
    const webhookUrl = options.webhook || config.feishu?.webhook;
    
    if (!webhookUrl) {
      return { status: 'error', message: 'Feishu webhook not configured', time: Date.now() - start };
    }
    
    const msgType = options.msgType || 'text';
    let body;
    
    if (msgType === 'post') {
      body = JSON.stringify({
        msg_type: 'post',
        content: {
          post: {
            zh_cn: {
              title: options.title || '通知',
              content: [[{ tag: 'text', text: message }]]
            }
          }
        }
      });
    } else if (msgType === 'interactive') {
      body = JSON.stringify({
        msg_type: 'interactive',
        card: options.card || {
          elements: [{ tag: 'div', text: { tag: 'plain_text', content: message } }]
        }
      });
    } else {
      body = JSON.stringify({
        msg_type: 'text',
        content: { text: message }
      });
    }
    
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
          try {
            const result = JSON.parse(data);
            resolve({
              status: result.code === 0 ? 'ok' : 'error',
              message: result.msg,
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
  sendSmtpEmail,
  sendWeCom,
  sendDingTalk,
  sendFeishu,
  onMessage,
  createWeComServer,
  config,
  getConfig
};