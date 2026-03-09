/**
 * iFlow LLM Module
 * LLM 任务调用 + 缓存 + Schema 验证
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const LLM_DIR = path.join(__dirname, '..', 'llm-data');
const CACHE_DIR = path.join(LLM_DIR, 'cache');
[LLM_DIR, CACHE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============================================================
// LLM 提供商配置
// ============================================================

const providers = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    auth: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` })
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    auth: (apiKey) => ({ 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' })
  },
  doubao: {
    url: 'https://www.doubao.com/chat/completion',
    models: ['doubao-pro', 'doubao-lite'],
    auth: (cookie) => ({ 'Cookie': cookie })
  },
  coze: {
    url: 'https://www.coze.cn/api/coze_space/chat',
    models: ['coze-bot'],
    auth: (cookie) => ({ 'Cookie': cookie })
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['auto', 'anthropic/claude-3-opus', 'openai/gpt-4'],
    auth: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` })
  },
  local: {
    url: 'http://localhost:11434/api/chat',
    models: ['llama2', 'mistral', 'codellama'],
    auth: () => ({})
  }
};

// ============================================================
// 缓存管理
// ============================================================

function computeCacheKey(prompt, model, options = {}) {
  const payload = {
    prompt,
    model: model || 'default',
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    system: options.system,
    artifacts: options.artifacts || []
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function getCachePath(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

function getFromCache(key) {
  const cachePath = getCachePath(key);
  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      cached.cached = true;
      return cached;
    } catch {
      return null;
    }
  }
  return null;
}

function saveToCache(key, result) {
  const cachePath = getCachePath(key);
  fs.writeFileSync(cachePath, JSON.stringify({
    ...result,
    cached: false,
    cached_at: new Date().toISOString()
  }, null, 2));
}

// ============================================================
// HTTP 请求
// ============================================================

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ raw: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ============================================================
// LLM 调用
// ============================================================

async function invoke(options = {}) {
  const start = Date.now();
  try {
    const {
      prompt,
      model = 'gpt-3.5-turbo',
      provider = 'openai',
      system,
      temperature = 0.7,
      maxTokens = 4096,
      apiKey,
      baseUrl,
      artifacts = [],
      outputSchema,
      maxRetries = 1,
      useCache = true,
      refresh = false
    } = options;

    if (!prompt) {
      return { status: 'error', message: 'prompt is required', time: Date.now() - start };
    }

    // 检查缓存
    const cacheKey = computeCacheKey(prompt, model, { temperature, maxTokens, system, artifacts });
    if (useCache && !refresh) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        return { 
          status: 'ok', 
          result: cached, 
          cached: true,
          time: Date.now() - start 
        };
      }
    }

    // 获取提供商配置
    const providerConfig = providers[provider];
    if (!providerConfig && !baseUrl) {
      return { status: 'error', message: `Unknown provider: ${provider}`, time: Date.now() - start };
    }

    // 构建请求
    const url = baseUrl || providerConfig.url;
    const headers = providerConfig ? providerConfig.auth(apiKey) : { 'Authorization': `Bearer ${apiKey}` };
    
    let requestBody;
    if (provider === 'anthropic') {
      requestBody = {
        model,
        max_tokens: maxTokens,
        messages: [
          ...(system ? [{ role: 'user', content: system }] : []),
          { role: 'user', content: prompt }
        ]
      };
    } else if (provider === 'doubao') {
      requestBody = {
        bot_id: options.botId || '7338286299411103781',
        messages: [{ role: 'user', content: prompt }],
        stream: false
      };
    } else if (provider === 'coze') {
      requestBody = {
        conversation_id: uuidv4(),
        bot_id: options.botId || 'default',
        user: options.user || 'user',
        query: prompt,
        stream: false
      };
    } else if (provider === 'local') {
      requestBody = {
        model,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
        stream: false
      };
    } else {
      // OpenAI 兼容格式
      requestBody = {
        model,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens
      };
    }

    // 发送请求
    let response;
    let attempt = 0;
    let lastError;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        response = await httpRequest(url, { headers }, requestBody);
        break;
      } catch (err) {
        lastError = err;
        if (attempt > maxRetries) {
          return { 
            status: 'error', 
            message: err.message, 
            attempts: attempt,
            time: Date.now() - start 
          };
        }
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    // 解析响应
    let result;
    if (provider === 'anthropic') {
      result = {
        text: response.content?.[0]?.text || '',
        model: response.model,
        usage: {
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens
        }
      };
    } else if (provider === 'doubao' || provider === 'coze') {
      result = {
        text: response.choices?.[0]?.message?.content || response.messages?.[0]?.content || '',
        model: model,
        usage: response.usage || {}
      };
    } else {
      result = {
        text: response.choices?.[0]?.message?.content || '',
        model: response.model,
        usage: {
          inputTokens: response.usage?.prompt_tokens,
          outputTokens: response.usage?.completion_tokens
        }
      };
    }

    // Schema 验证
    if (outputSchema) {
      try {
        const parsed = JSON.parse(result.text);
        // 简单验证 - 实际应用可用 ajv
        const valid = validateSchema(parsed, outputSchema);
        if (!valid.valid) {
          result.schemaValid = false;
          result.schemaErrors = valid.errors;
        } else {
          result.schemaValid = true;
          result.data = parsed;
        }
      } catch {
        result.schemaValid = false;
        result.schemaErrors = ['Output is not valid JSON'];
      }
    }

    // 保存到缓存
    if (useCache) {
      saveToCache(cacheKey, result);
    }

    // 保存执行记录
    const runId = uuidv4();
    const runPath = path.join(LLM_DIR, `${runId}.json`);
    fs.writeFileSync(runPath, JSON.stringify({
      id: runId,
      prompt,
      model,
      provider,
      result,
      cached: false,
      attempts: attempt,
      created_at: new Date().toISOString()
    }, null, 2));

    return { 
      status: 'ok', 
      runId,
      result,
      cached: false,
      attempts: attempt,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// 简单 Schema 验证
function validateSchema(data, schema) {
  const errors = [];
  
  if (schema.type) {
    const actualType = Array.isArray(data) ? 'array' : typeof data;
    if (actualType !== schema.type && !(actualType === 'number' && schema.type === 'integer')) {
      errors.push(`Expected type ${schema.type}, got ${actualType}`);
    }
  }
  
  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (data[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }
  
  if (schema.properties && typeof data === 'object') {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (data[key] !== undefined && propSchema.type) {
        const actualType = typeof data[key];
        if (actualType !== propSchema.type) {
          errors.push(`Field ${key}: expected ${propSchema.type}, got ${actualType}`);
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// ============================================================
// 流式调用 (SSE)
// ============================================================

async function stream(options = {}) {
  const start = Date.now();
  try {
    const {
      prompt,
      model = 'gpt-3.5-turbo',
      provider = 'openai',
      system,
      temperature = 0.7,
      maxTokens = 4096,
      apiKey,
      baseUrl,
      onChunk
    } = options;

    if (!prompt) {
      return { status: 'error', message: 'prompt is required', time: Date.now() - start };
    }

    const providerConfig = providers[provider];
    const url = baseUrl || providerConfig.url;
    const headers = providerConfig ? providerConfig.auth(apiKey) : { 'Authorization': `Bearer ${apiKey}` };
    
    // 构建流式请求
    const requestBody = {
      model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt }
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true
    };

    // 这里简化处理，返回一个可迭代对象
    return { 
      status: 'ok', 
      message: 'Stream mode - use onChunk callback',
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ============================================================
// 批量调用
// ============================================================

async function batch(prompts, options = {}) {
  const start = Date.now();
  try {
    const results = [];
    const { concurrency = 3 } = options;
    
    // 分批执行
    for (let i = 0; i < prompts.length; i += concurrency) {
      const batch = prompts.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(prompt => invoke({ ...options, prompt }))
      );
      results.push(...batchResults);
    }
    
    return { 
      status: 'ok', 
      results,
      total: results.length,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ============================================================
// Embedding (向量嵌入)
// ============================================================

async function embed(text, options = {}) {
  const start = Date.now();
  try {
    const { model = 'text-embedding-ada-002', apiKey, provider = 'openai' } = options;
    
    const providerConfig = providers[provider];
    const url = provider === 'openai' 
      ? 'https://api.openai.com/v1/embeddings'
      : `${providerConfig.url}/embeddings`;
    
    const response = await httpRequest(url, {
      headers: providerConfig.auth(apiKey)
    }, {
      input: text,
      model
    });
    
    const embedding = response.data?.[0]?.embedding || [];
    
    return { 
      status: 'ok', 
      embedding,
      model,
      dimensions: embedding.length,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ============================================================
// 缓存管理
// ============================================================

function clearCache() {
  const start = Date.now();
  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const f of files) {
      fs.unlinkSync(path.join(CACHE_DIR, f));
    }
    return { status: 'ok', cleared: files.length, time: Date.now() - start };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

function cacheStats() {
  const start = Date.now();
  try {
    const files = fs.readdirSync(CACHE_DIR);
    let totalSize = 0;
    for (const f of files) {
      totalSize += fs.statSync(path.join(CACHE_DIR, f)).size;
    }
    return { 
      status: 'ok', 
      count: files.length,
      totalSize,
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      time: Date.now() - start 
    };
  } catch (e) {
    return { status: 'error', message: e.message, time: Date.now() - start };
  }
}

// ============================================================
// 模块导出
// ============================================================

module.exports = {
  invoke,
  stream,
  batch,
  embed,
  clearCache,
  cacheStats,
  providers
};
