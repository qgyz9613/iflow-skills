/**
 * 情感分析模块
 * 基于go-stock情感词典实现
 * 用于自动标注记忆的情感倾向（看涨/看跌/中性）
 */

const path = require('path');
const fs = require('fs');
const https = require('https');

// 情感词典（基于go-stock）
const sentimentKeywords = {
  // 看涨关键词
  bullish: [
    '上涨', '大涨', '暴涨', '突破', '新高', '利好', '买入', '增持',
    '推荐', '强势', '领涨', '龙头', '爆发', '抢筹', '拉升', '反弹',
    '收涨', '涨停', '一字涨停', '连续涨停', '放量', '资金流入', '主力买入',
    '机构加仓', '北上资金', '外资流入', '大单买入', '净买入', '看多',
    '乐观', '信心', '复苏', '回暖', '转好', '上涨空间', '目标价上调',
    '业绩超预期', '净利润增长', '营收增长', '订单饱满', '产能扩张',
    '政策扶持', '板块轮动', '热点', '主线', '龙头战法', '主升浪',
    '技术指标金叉', 'MACD金叉', '放量突破', '底部反转', '趋势向上',
    '多头排列', '量价齐升', '缩量回调', '强势调整', '洗盘结束',
    '突破压力位', '站稳', '支撑有效', '反弹确认', '拐点向上', '起涨',
    '建仓', '加仓', '满仓', '重仓', '低吸', '高抛', '做多',
    '长线持有', '价值投资', '成长股', '绩优股', '蓝筹股',
    '分红', '送转增', '回购', '增持', '股权激励', '员工持股',
    '涨价', '提价', '涨价预期', '降息', '降准', '宽松', '放水',
    '刺激政策', '经济刺激', '财政政策', '货币宽松', '流动性充裕',
    '新能源', '光伏', '风电', '储能', '锂电池', '芯片', '半导体',
    'AI', '人工智能', '大模型', 'GPT', 'DeepSeek', '机器人',
    '自动驾驶', '智能驾驶', '低空经济', '飞行汽车', '商业航天',
    '鸿蒙', '国产芯片', '半导体设备', '云计算', '工业互联网',
    '智能制造', '专精特新', '小巨人', '隐形冠军'
  ],
  
  // 看跌关键词
  bearish: [
    '下跌', '大跌', '暴跌', '跳水', '破位', '新低', '利空', '卖出', '减持',
    '规避', '走弱', '领跌', '砸盘', '恐慌', '抛售', '清仓', '止损',
    '出货', '获利回吐', '资金流出', '主力抛售', '北上资金流出', '外资流出',
    '大单卖出', '净流出', '看空', '悲观', '担忧', '恶化', '转弱',
    '回调', '下跌空间', '目标价下调', '业绩下滑', '净利润下滑', '营收下滑',
    '订单减少', '产能过剩', '供过于求', '需求萎缩', '消费疲软', '需求不足',
    '库存积压', '去库存', '政策收紧', '加息', '利率上调', '缩表',
    '流动性收紧', '资金面收紧', '去杠杆', '债务危机', '违约', '暴雷',
    '评级下调', '负面', '不利', '打击', '冲击', '拖累', '压制',
    '跌破', '失守', '冲高回落', '假突破', '诱多', '诱空', '出货',
    '被套', '深套', '浮亏', '亏损扩大', '止损离场', '割肉',
    '空仓', '轻仓', '减仓', '观望', '谨慎', '避险', '恐慌盘',
    '踩踏', '挤兑', '信用危机', '流动性危机', '金融危机', '经济衰退',
    'MACD死叉', '量价背离', '技术指标破位', '趋势向下', '空头排列',
    '持续下跌', '加速下跌', '恐慌性抛售', '深度回调', '闪崩', '崩盘'
  ],
  
  // 中性关键词
  neutral: [
    '持平', '震荡', '整理', '盘整', '横盘', '调整', '波动', '分化',
    '观望', '中性', '平衡', '平衡市', '震荡市', '技术调整',
    '区间震荡', '箱体震荡', '窄幅震荡', '小幅波动', '微涨', '微跌',
    '企稳', '支撑企稳', '平台整理', '趋势不明', '待观察',
    '符合预期', '市场观望', '情绪平稳', '资金观望', '成交低迷',
    '缩量', '地量', '低换手', '维持现状', '按兵不动',
    '涨跌互现', '板块轮动', '板块切换', '高低切换', '结构性行情'
  ]
};

/**
 * 分析文本的情感倾向
 * @param {string} text - 要分析的文本
 * @returns {object} - 情感分析结果
 */
function analyzeSentiment(text) {
  const start = Date.now();
  
  let bullishScore = 0;
  let bearishScore = 0;
  let neutralScore = 0;
  
  const lowerText = text.toLowerCase();
  
  // 计算情感得分
  for (const keyword of sentimentKeywords.bullish) {
    if (lowerText.includes(keyword)) {
      bullishScore += 1;
    }
  }
  
  for (const keyword of sentimentKeywords.bearish) {
    if (lowerText.includes(keyword)) {
      bearishScore += 1;
    }
  }
  
  for (const keyword of sentimentKeywords.neutral) {
    if (lowerText.includes(keyword)) {
      neutralScore += 1;
    }
  }
  
  // 确定主导情感
  let sentiment = 'neutral';
  let confidence = 0;
  const total = bullishScore + bearishScore + neutralScore;
  
  if (bullishScore > bearishScore && bullishScore > neutralScore) {
    sentiment = 'bullish';
    confidence = total > 0 ? bullishScore / total : 0;
  } else if (bearishScore > bullishScore && bearishScore > neutralScore) {
    sentiment = 'bearish';
    confidence = total > 0 ? bearishScore / total : 0;
  } else {
    sentiment = 'neutral';
    confidence = 0.5;
  }
  
  return {
    sentiment, // bullish/bearish/neutral
    sentimentLabel: sentiment === 'bullish' ? '看涨' : sentiment === 'bearish' ? '看跌' : '中性',
    confidence: confidence,
    scores: {
      bullish: bullishScore,
      bearish: bearishScore,
      neutral: neutralScore
    },
    time: Date.now() - start
  };
}

/**
 * 批量分析文本情感
 * @param {Array<string>} texts - 文本数组
 * @returns {Array} - 情感分析结果数组
 */
function batchAnalyzeSentiment(texts) {
  return texts.map((text, index) => {
    const result = analyzeSentiment(text);
    return {
      index,
      ...result
    };
  });
}

/**
 * 添加情感标签到记忆
 * @param {object} memory - 记忆对象
 * @returns {object} - 带情感标签的记忆
 */
function tagMemoryWithSentiment(memory) {
  const sentiment = analyzeSentiment(memory.content);
  
  return {
    ...memory,
    sentiment: sentiment.sentimentLabel, // 看涨/看跌/中性
    sentimentScore: sentiment.confidence,  // 情感置信度 0-1
    sentimentScores: sentiment.scores, // 详细得分
    sentimentAnalyzedAt: new Date().toISOString() // 分析时间
  };
}

/**
 * 过滤记忆按情感
 * @param {string} sentiment - 情感类型（bullish/bearish/neutral）
 * @param {number} minConfidence - 最小置信度
 * @returns {Array} - 匹配的记忆ID列表
 */
function filterMemoriesBySentiment(sentiment, minConfidence = 0) {
  const memoryDir = path.join(__dirname, '../../memory/facts');
  const results = [];
  
  try {
    const categories = ['fact', 'general', 'preference', 'code'];
    
    for (const category of categories) {
      const categoryDir = path.join(memoryDir, category);
      if (fs.existsSync(categoryDir)) {
        const files = fs.readdirSync(categoryDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(categoryDir, file);
            const memory = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // 检查情感和置信度
            if (memory.sentiment === sentiment && 
                (!minConfidence || memory.sentimentScore >= minConfidence)) {
              results.push({
                id: memory.id,
                category: memory.category,
                sentiment: memory.sentiment,
                sentimentScore: memory.sentimentScore,
                content: memory.content
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('过滤情感记忆失败:', error);
  }
  
  return results;
}

/**
 * 获取情感统计
 * @returns {object} - 情感统计信息
 */
function getSentimentStats() {
  const stats = {
    bullish: 0,
    bearish: 0,
    neutral: 0,
    total: 0,
    averageConfidence: 0
  };
  
  const memoryDir = path.join(__dirname, '../../memory/facts');
  
  try {
    const categories = ['fact', 'general', 'preference', 'code'];
    
    for (const category of categories) {
      const categoryDir = path.join(memoryDir, category);
      if (fs.existsSync(categoryDir)) {
        const files = fs.readdirSync(categoryDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const memory = JSON.parse(fs.readFileSync(path.join(categoryDir, file), 'utf8'));
            
            if (memory.sentiment) {
              stats[memory.sentiment]++;
              stats.averageConfidence += memory.sentimentScore || 0;
              stats.total++;
            } else {
              stats.neutral++;
              stats.total++;
            }
          }
        }
      }
    }
    
    if (stats.total > 0) {
      stats.averageConfidence = stats.averageConfidence / stats.total;
    }
  } catch (error) {
    console.error('获取情感统计失败:', error);
  }
  
  return stats;
}

/**
 * 获取情感趋势（最近N条记忆的情感变化）
 * @param {number} limit - 记忆数量限制
 * @returns {Array} - 情感趋势数据
 */
function getSentimentTrend(limit = 20) {
  const memoryDir = path.join(__dirname, '../../memory/facts');
  const trends = [];
  
  try {
    const categories = ['fact', 'general', 'preference', 'code'];
    const allMemories = [];
    
    // 收集所有记忆
    for (const category of categories) {
      const categoryDir = path.join(memoryDir, category);
      if (fs.existsSync(categoryDir)) {
        const files = fs.readdirSync(categoryDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const memory = JSON.parse(fs.readFileSync(path.join(categoryDir, file), 'utf8'));
            allMemories.push(memory);
          }
        }
      }
    }
    
    // 按创建时间排序
    allMemories.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB - dateA;
    });
    
    // 取最近的N条
    const recent = allMemories.slice(0, limit);
    
    // 构建趋势数据
    for (let i = 0; i < recent.length; i++) {
      trends.push({
        index: i,
        id: recent[i].id,
        date: recent[i].created_at,
        sentiment: recent[i].sentiment || 'neutral',
        sentimentScore: recent[i].sentimentScore || 0,
        content: recent[i].content.substring(0, 50) + '...'
      });
    }
  } catch (error) {
    console.error('获取情感趋势失败:', error);
  }
  
  return trends;
}

// ================== 财联社电报API ==================

// 财联社API配置
const CLS_CONFIG = {
  baseUrl: 'https://www.cls.cn',
  telegraphEndpoint: '/nodeapi/telegraphList',
  timeout: 10000, // 10秒超时
  maxNews: 50 // 最大获取数量
};

/**
 * 获取财联社电报新闻
 * @param {Object} options - 选项
 * @param {number} options.limit - 获取数量限制
 * @param {string} options.subject - 主题筛选（可选）
 * @returns {Promise<Array>} - 新闻列表
 */
async function fetchCLSTelegraph(options = {}) {
  const { limit = 20, subject } = options;
  
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      app: 'CailianpressWeb',
      os: 'web',
      sv: '8.4.6',
      sign: ''
    });
    
    if (subject) {
      params.append('subject', subject);
    }
    
    const url = `${CLS_CONFIG.baseUrl}${CLS_CONFIG.telegraphEndpoint}?${params.toString()}`;
    
    const req = https.get(url, {
      timeout: CLS_CONFIG.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.cls.cn/telegraph'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (json.error_code === 0 && json.data && json.data.roll_data) {
            const news = json.data.roll_data.slice(0, Math.min(limit, CLS_CONFIG.maxNews));
            
            resolve(news.map(item => ({
              id: item.id,
              title: item.title || '',
              content: item.content || item.brief || '',
              ctime: item.ctime,
              timestamp: new Date(item.ctime * 1000).toISOString(),
              source: 'cls',
              subject: item.subject || '',
              level: item.level || 'normal', // 重要程度
              readingCount: item.reading_count || 0
            })));
          } else {
            resolve([]);
          }
        } catch (e) {
          reject(new Error(`解析财联社API响应失败: ${e.message}`));
        }
      });
    });
    
    req.on('error', (e) => {
      reject(new Error(`请求财联社API失败: ${e.message}`));
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求财联社API超时'));
    });
  });
}

/**
 * 分析财联社新闻情感
 * @param {Object} news - 新闻对象
 * @returns {Object} - 带情感分析的新闻
 */
function analyzeCLSSentiment(news) {
  const text = `${news.title} ${news.content}`.trim();
  const sentiment = analyzeSentiment(text);
  
  // 提取关键实体（股票代码、板块名称等）
  const stockCodes = extractStockCodes(text);
  const sectors = extractSectors(text);
  
  return {
    ...news,
    sentiment: sentiment.sentiment,
    sentimentLabel: sentiment.sentimentLabel,
    confidence: sentiment.confidence,
    sentimentScores: sentiment.scores,
    entities: {
      stockCodes,
      sectors
    },
    analyzedAt: new Date().toISOString()
  };
}

/**
 * 从文本中提取股票代码
 * @param {string} text - 文本内容
 * @returns {Array<string>} - 股票代码列表
 */
function extractStockCodes(text) {
  const codes = [];
  
  // 匹配6位数字股票代码
  const codePattern = /(?<![0-9])([036]\d{5})(?![0-9])/g;
  let match;
  
  while ((match = codePattern.exec(text)) !== null) {
    const code = match[1];
    // 验证是否为有效股票代码前缀
    if (/^(00|01|02|03|06|30|60|61|62|63|68|69)/.test(code)) {
      codes.push(code);
    }
  }
  
  // 匹配带后缀的股票代码
  const codeWithSuffix = /(\d{6})\.(SH|SZ|BJ)/g;
  while ((match = codeWithSuffix.exec(text)) !== null) {
    codes.push(match[0]);
  }
  
  return [...new Set(codes)];
}

/**
 * 从文本中提取板块名称
 * @param {string} text - 文本内容
 * @returns {Array<string>} - 板块名称列表
 */
function extractSectors(text) {
  const sectorKeywords = [
    '半导体', '芯片', '人工智能', 'AI', '新能源', '光伏', '风电', '储能',
    '锂电池', '新能源汽车', '汽车', '医药', '医疗', '白酒', '消费',
    '银行', '保险', '证券', '券商', '地产', '房地产', '基建',
    '军工', '航天', '航空', '有色', '煤炭', '石油', '化工',
    '钢铁', '水泥', '建材', '机械', '电力', '水务', '环保',
    '通信', '5G', '互联网', '软件', '计算机', '电子', '传媒',
    '旅游', '酒店', '餐饮', '零售', '商业', '服装', '纺织',
    '农业', '养殖', '种植', '食品', '饮料', '家电', '家居'
  ];
  
  const found = [];
  for (const sector of sectorKeywords) {
    if (text.includes(sector)) {
      found.push(sector);
    }
  }
  
  return [...new Set(found)];
}

/**
 * 获取热门新闻情感统计
 * @param {number} limit - 新闻数量限制
 * @returns {Promise<Object>} - 情感统计结果
 */
async function getHotNewsSentiment(limit = 30) {
  try {
    const news = await fetchCLSTelegraph({ limit });
    const analyzed = news.map(analyzeCLSSentiment);
    
    const stats = {
      total: analyzed.length,
      bullish: 0,
      bearish: 0,
      neutral: 0,
      highImportance: 0,
      stockMentions: {},
      sectorMentions: {},
      news: analyzed
    };
    
    for (const item of analyzed) {
      // 统计情感分布
      if (item.sentiment === 'bullish') stats.bullish++;
      else if (item.sentiment === 'bearish') stats.bearish++;
      else stats.neutral++;
      
      // 统计重要新闻
      if (item.level === 'important' || item.level === 'A') {
        stats.highImportance++;
      }
      
      // 统计股票提及
      for (const code of item.entities.stockCodes) {
        stats.stockMentions[code] = (stats.stockMentions[code] || 0) + 1;
      }
      
      // 统计板块提及
      for (const sector of item.entities.sectors) {
        stats.sectorMentions[sector] = (stats.sectorMentions[sector] || 0) + 1;
      }
    }
    
    // 计算市场情绪指数 (-1 到 1)
    if (stats.total > 0) {
      stats.marketSentimentIndex = (stats.bullish - stats.bearish) / stats.total;
    } else {
      stats.marketSentimentIndex = 0;
    }
    
    // 市场情绪标签
    if (stats.marketSentimentIndex > 0.3) {
      stats.marketSentimentLabel = '看多';
    } else if (stats.marketSentimentIndex < -0.3) {
      stats.marketSentimentLabel = '看空';
    } else {
      stats.marketSentimentLabel = '中性';
    }
    
    // 排序热门股票和板块
    stats.hotStocks = Object.entries(stats.stockMentions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count }));
    
    stats.hotSectors = Object.entries(stats.sectorMentions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sector, count]) => ({ sector, count }));
    
    stats.fetchedAt = new Date().toISOString();
    
    return stats;
  } catch (error) {
    return {
      error: error.message,
      total: 0,
      marketSentimentIndex: 0,
      marketSentimentLabel: '未知',
      fetchedAt: new Date().toISOString()
    };
  }
}

/**
 * 生成市场情绪报告
 * @param {Object} stats - 情感统计数据
 * @returns {string} - 格式化报告
 */
function generateMarketSentimentReport(stats) {
  if (stats.error) {
    return `【市场情绪报告】\n⚠️ 获取数据失败: ${stats.error}`;
  }
  
  const lines = [];
  lines.push('═'.repeat(50));
  lines.push('【财联社电报 - 市场情绪报告】');
  lines.push(`生成时间: ${stats.fetchedAt}`);
  lines.push('═'.repeat(50));
  
  lines.push(`\n📊 情绪概览:`);
  lines.push(`   市场情绪: ${stats.marketSentimentLabel} (${(stats.marketSentimentIndex * 100).toFixed(1)}%)`);
  lines.push(`   新闻总数: ${stats.total}条`);
  lines.push(`   看涨: ${stats.bullish}条 | 看跌: ${stats.bearish}条 | 中性: ${stats.neutral}条`);
  lines.push(`   重要新闻: ${stats.highImportance}条`);
  
  if (stats.hotStocks && stats.hotStocks.length > 0) {
    lines.push(`\n📈 热门股票提及:`);
    for (const item of stats.hotStocks) {
      lines.push(`   ${item.code}: ${item.count}次`);
    }
  }
  
  if (stats.hotSectors && stats.hotSectors.length > 0) {
    lines.push(`\n🏭 热门板块提及:`);
    for (const item of stats.hotSectors) {
      lines.push(`   ${item.sector}: ${item.count}次`);
    }
  }
  
  // 显示最近的重要新闻
  const importantNews = stats.news
    .filter(n => n.sentiment !== 'neutral')
    .slice(0, 5);
  
  if (importantNews.length > 0) {
    lines.push(`\n📰 重要新闻摘要:`);
    for (const news of importantNews) {
      const emoji = news.sentiment === 'bullish' ? '🟢' : '🔴';
      lines.push(`   ${emoji} [${news.sentimentLabel}] ${news.title || news.content.substring(0, 50)}`);
    }
  }
  
  return lines.join('\n');
}

// 导出函数
module.exports = {
  analyzeSentiment,
  batchAnalyzeSentiment,
  tagMemoryWithSentiment,
  filterMemoriesBySentiment,
  getSentimentStats,
  getSentimentTrend,
  // 财联社电报API
  fetchCLSTelegraph,
  analyzeCLSSentiment,
  getHotNewsSentiment,
  generateMarketSentimentReport,
  extractStockCodes,
  extractSectors
};
