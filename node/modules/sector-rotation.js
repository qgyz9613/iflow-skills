/**
 * 板块轮动分析模块
 * 基于A股数据库分析板块轮动规律
 */

const { Client } = require('pg');

// 数据库连接配置
const DB_CONFIG = {
  host: '38.165.21.21',
  port: 5432,
  database: 'postgres',
  user: 'admin',
  password: 'SX7YRCwXszkdtd4B'
};

/**
 * 分析主力资金流向板块
 */
async function analyzeSectorRotationByCapital(dateRange = 30) {
  const query = `
    WITH sector_flows AS (
      SELECT 
        DATE_TRUNC('day', sf.trade_date) as date,
        SUM(sf.main_net_inflow) as total_inflow,
        SUM(CASE WHEN sf.main_net_inflow > 0 THEN sf.main_net_inflow ELSE 0 END) as positive_inflow,
        COUNT(DISTINCT sf.ts_code) as stock_count
      FROM stock_flows sf
      WHERE sf.trade_date >= CURRENT_DATE - INTERVAL '${dateRange} days'
      GROUP BY DATE_TRUNC('day', sf.trade_date)
      ORDER BY date DESC
      LIMIT 30
    )
    SELECT 
      date,
      total_inflow,
      positive_inflow,
      stock_count,
      CASE 
        WHEN positive_inflow > total_inflow * 0.6 THEN '资金流入强势'
        WHEN positive_inflow > total_inflow * 0.4 THEN '资金流入平稳'
        WHEN positive_inflow > total_inflow * 0.2 THEN '资金流入弱势'
        ELSE '资金流出'
      END as trend
    FROM sector_flows
    ORDER BY date DESC;
  `;

  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    const result = await client.query(query);
    await client.end();
    return {
      success: true,
      data: result.rows,
      analysis: analyzeCapitalTrend(result.rows)
    };
  } catch (error) {
    await client.end();
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 分析趋势
 */
function analyzeCapitalTrend(rows) {
  if (rows.length < 3) return '数据不足，无法分析';

  const recent3Days = rows.slice(0, 3);
  const totalInflow = recent3Days.reduce((sum, row) => sum + row.total_inflow, 0);
  const avgPositiveInflow = recent3Days.reduce((sum, row) => sum + row.positive_inflow, 0) / 3;

  if (avgPositiveInflow > 0) {
    return `近3日主力净流入 ${(totalInflow / 100000000).toFixed(2)}亿元，${recent3Days[0].trend}`;
  } else {
    return `近3日主力净流出 ${Math.abs(totalInflow / 100000000).toFixed(2)}亿元，${recent3Days[0].trend}`;
  }
}

/**
 * 获取热门股票列表
 */
async function getHotStocks(limit = 20, days = 5) {
  const query = `
    SELECT 
      s.ts_code,
      s.name,
      s.industry,
      s.exchange,
      AVG(sf.main_net_inflow) as avg_net_inflow,
      COUNT(*) as data_days,
      SUM(CASE WHEN sf.main_net_inflow > 0 THEN 1 ELSE 0 END) as positive_days
    FROM stock_flows sf
    JOIN stocks s ON sf.ts_code = s.ts_code
    WHERE sf.trade_date >= CURRENT_DATE - INTERVAL '${days} days'
    GROUP BY s.ts_code, s.name, s.industry, s.exchange
    HAVING COUNT(*) >= 3
    ORDER BY avg_net_inflow DESC
    LIMIT $1;
  `;

  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    const result = await client.query(query, [limit]);
    await client.end();
    return {
      success: true,
      data: result.rows,
      summary: {
        total: result.rows.length,
        avg_inflow: result.rows.reduce((sum, r) => sum + r.avg_net_inflow, 0) / result.rows.length
      }
    };
  } catch (error) {
    await client.end();
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 按行业分析资金流向
 */
async function analyzeSectorByIndustry(days = 10) {
  const query = `
    SELECT 
      s.industry,
      COUNT(DISTINCT s.ts_code) as stock_count,
      AVG(sf.main_net_inflow) as avg_inflow,
      SUM(sf.main_net_inflow) as total_inflow,
      SUM(CASE WHEN sf.main_net_inflow > 0 THEN sf.main_net_inflow ELSE 0 END) as positive_inflow
    FROM stock_flows sf
    JOIN stocks s ON sf.ts_code = s.ts_code
    WHERE sf.trade_date >= CURRENT_DATE - INTERVAL '${days} days'
      AND s.industry IS NOT NULL
    GROUP BY s.industry
    ORDER BY total_inflow DESC
    LIMIT 15;
  `;

  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    const result = await client.query(query);
    await client.end();
    return {
      success: true,
      data: result.rows,
      hot_sectors: result.rows.filter(r => r.total_inflow > 0).slice(0, 5),
      cold_sectors: result.rows.filter(r => r.total_inflow < 0).slice(0, 5)
    };
  } catch (error) {
    await client.end();
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 生成板块轮动报告
 */
async function generateSectorRotationReport(days = 10) {
  const [capitalResult, hotStocksResult, industryResult] = await Promise.all([
    analyzeSectorRotationByCapital(days),
    getHotStocks(20, days),
    analyzeSectorByIndustry(days)
  ]);

  const report = {
    timestamp: new Date().toISOString(),
    analysis_period: `${days}天`,
    market_trend: capitalResult.analysis,
    hot_stocks: hotStocksResult.success ? hotStocksResult.data.slice(0, 10) : [],
    hot_sectors: industryResult.success ? industryResult.hot_sectors : [],
    cold_sectors: industryResult.success ? industryResult.cold_sectors : [],
    summary: generateSummary(capitalResult, hotStocksResult, industryResult)
  };

  return {
    success: true,
    report: report
  };
}

/**
 * 生成摘要
 */
function generateSummary(capitalResult, hotStocksResult, industryResult) {
  const parts = [];

  // 资金趋势
  if (capitalResult.success && capitalResult.analysis) {
    parts.push(`资金趋势：${capitalResult.analysis}`);
  }

  // 热门股票
  if (hotStocksResult.success && hotStocksResult.data.length > 0) {
    const topStocks = hotStocksResult.data.slice(0, 3).map(s => `${s.name}(${s.ts_code})`).join('、');
    parts.push(`热门股票：${topStocks}`);
  }

  // 热门板块
  if (industryResult.success && industryResult.hot_sectors.length > 0) {
    const hotIndustries = industryResult.hot_sectors.slice(0, 3).map(s => `行业${s.industry}`).join('、');
    parts.push(`热门板块：${hotIndustries}`);
  }

  return parts.join('；');
}

/**
 * 预测下一个热点板块
 */
async function predictNextHotSector(days = 5) {
  // 分析最近5天的资金流向变化
  const query = `
    WITH daily_sector_flow AS (
      SELECT 
        DATE_TRUNC('day', sf.trade_date) as date,
        s.industry,
        SUM(sf.main_net_inflow) as net_inflow,
        SUM(sf.super_net) as super_inflow
      FROM stock_flows sf
      JOIN stocks s ON sf.ts_code = s.ts_code
      WHERE sf.trade_date >= CURRENT_DATE - INTERVAL '${days * 2} days'
        AND s.industry IS NOT NULL
      GROUP BY DATE_TRUNC('day', sf.trade_date), s.industry
    ),
    sector_trend AS (
      SELECT 
        industry,
        AVG(net_inflow) OVER (PARTITION BY industry ORDER BY date ROWS BETWEEN ${days - 1} AND CURRENT ROW) as recent_avg,
        AVG(super_inflow) OVER (PARTITION BY industry ORDER BY date ROWS BETWEEN ${days - 1} AND CURRENT ROW) as recent_super,
        LAG(net_inflow, 1) OVER (PARTITION BY industry ORDER BY date) as prev_inflow
      FROM daily_sector_flow
    )
    SELECT 
      industry,
      recent_avg,
      recent_super,
      prev_inflow,
      CASE 
        WHEN recent_avg > 0 AND recent_avg > prev_inflow * 1.5 THEN '加速流入'
        WHEN recent_avg > 0 AND recent_avg > prev_inflow THEN '持续流入'
        WHEN recent_avg > 0 THEN '开始流入'
        WHEN recent_avg < 0 AND recent_avg < prev_inflow * 1.5 THEN '加速流出'
        WHEN recent_avg < 0 AND recent_avg < prev_inflow THEN '持续流出'
        ELSE '资金流出'
      END as flow_status,
      recent_super as super_inflow_strength
    FROM sector_trend
    WHERE date = (SELECT MAX(date) FROM sector_trend)
    ORDER BY recent_avg DESC
    LIMIT 10;
  `;

  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    const result = await client.query(query);
    await client.end();
    return {
      success: true,
      predictions: result.rows.map(row => ({
        industry: row.industry,
        trend: row.flow_status,
        strength: row.super_inflow_strength,
        recommendation: generateRecommendation(row)
      }))
    };
  } catch (error) {
    await client.end();
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 生成建议
 */
function generateRecommendation(row) {
  if (row.flow_status === '加速流入') {
    return `重点关注，${row.industry}板块资金加速流入，可能成为新热点`;
  } else if (row.flow_status === '持续流入') {
    return `持续跟踪，${row.industry}板块资金持续流入，维持关注`;
  } else if (row.flow_status === '开始流入') {
    return `谨慎观察，${row.industry}板块资金开始流入，待确认趋势`;
  } else if (row.flow_status === '加速流出') {
    return `规避风险，${row.industry}板块资金加速流出，注意止损`;
  } else if (row.flow_status === '持续流出') {
    return `等待时机，${row.industry}板块资金持续流出，暂时观望`;
  } else {
    return `保持观望，${row.industry}板块资金流出，寻找机会`;
  }
}

/**
 * 获取资金流向排行
 */
async function getCapitalFlowRanking(date, limit = 10) {
  const query = `
    SELECT 
      s.ts_code,
      s.name,
      s.industry,
      sf.main_net_inflow,
      sf.super_net,
      sf.big_net,
      sf.mid_net,
      sf.small_net
    FROM stock_flows sf
    JOIN stocks s ON sf.ts_code = s.ts_code
    WHERE sf.trade_date = $1::date
    ORDER BY sf.main_net_inflow DESC
    LIMIT $2;
  `;

  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    const result = await client.query(query, [date, limit]);
    await client.end();
    return {
      success: true,
      date: date,
      ranking: result.rows,
      summary: {
        total: result.rows.length,
        positive_count: result.rows.filter(r => r.main_net_inflow > 0).length,
        negative_count: result.rows.filter(r => r.main_net_inflow < 0).length
      }
    };
  } catch (error) {
    await client.end();
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 获取日期范围
 */
async function getDateRange() {
  const query = `
    SELECT 
      MIN(trade_date) as min_date,
      MAX(trade_date) as max_date,
      COUNT(DISTINCT trade_date) as total_days,
      COUNT(DISTINCT ts_code) as total_stocks
    FROM stock_flows;
  `;

  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    const result = await client.query(query);
    await client.end();
    return {
      success: true,
      ...result.rows[0]
    };
  } catch (error) {
    await client.end();
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 关闭连接池
 */
async function closePool() {
  await pool.end();
}

module.exports = {
  analyzeSectorRotationByCapital,
  getHotStocks,
  analyzeSectorByIndustry,
  generateSectorRotationReport,
  predictNextHotSector,
  getCapitalFlowRanking,
  getDateRange,
  closePool
};