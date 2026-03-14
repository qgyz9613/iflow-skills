/**
 * 多数据源聚合模块
 * 整合PostgreSQL数据库、AKShare、东方财富API等多个数据源
 */

const fs = require('fs');
const path = require('path');

// PostgreSQL连接配置
const PG_CONFIG = {
  host: '38.165.21.21',
  port: 5432,
  database: 'postgres',
  user: 'admin',
  password: 'SX7YRCwXszkdtd4B'
};

/**
 * 数据源配置
 */
const DATA_SOURCES = {
  postgres: {
    name: 'PostgreSQL数据库',
    enabled: true,
    priority: 1,
    features: ['stock_info', 'flows', 'labels', 'prices']
  },
  akshare: {
    name: 'AKShare',
    enabled: true,
    priority: 2,
    features: ['realtime', 'history', 'financial']
  },
  eastmoney: {
    name: '东方财富',
    enabled: true,
    priority: 3,
    features: ['realtime', 'fund_flow']
  }
};

/**
 * 从PostgreSQL获取股票信息
 */
async function getStockFromPostgres(tsCode) {
  const { Client } = require('pg');
  const client = new Client(PG_CONFIG);

  try {
    await client.connect();
    const query = `
      SELECT 
        s.ts_code,
        s.name,
        s.industry,
        s.exchange,
        s.market_type,
        s.list_date
      FROM stocks s
      WHERE s.ts_code = $1;
    `;
    const result = await client.query(query, [tsCode]);
    await client.end();

    if (result.rows.length > 0) {
      return {
        source: 'postgres',
        data: result.rows[0],
        available: true
      };
    } else {
      return {
        source: 'postgres',
        available: false,
        message: '股票不存在'
      };
    }
  } catch (error) {
    await client.end();
    return {
      source: 'postgres',
      available: false,
      error: error.message
    };
  }
}

/**
 * 从PostgreSQL获取价格数据
 */
async function getPricesFromPostgres(tsCode, startDate, endDate) {
  const { Client } = require('pg');
  const client = new Client(PG_CONFIG);

  try {
    await client.connect();
    const query = `
      SELECT 
        ts_code,
        trade_date,
        open,
        high,
        low,
        close,
        pre_close,
        pct_chg,
        vol,
        amount
      FROM stock_prices
      WHERE ts_code = $1
        AND trade_date BETWEEN $2::date AND $3::date
      ORDER BY trade_date DESC;
    `;
    const result = await client.query(query, [tsCode, startDate, endDate]);
    await client.end();

    return {
      source: 'postgres',
      data: result.rows,
      count: result.rows.length
    };
  } catch (error) {
    await client.end();
    return {
      source: 'postgres',
      error: error.message,
      data: []
    };
  }
}

/**
 * 从PostgreSQL获取资金流向数据
 */
async function getFlowsFromPostgres(tsCode, startDate, endDate) {
  const { Client } = require('pg');
  const client = new Client(PG_CONFIG);

  try {
    await client.connect();
    const query = `
      SELECT 
        ts_code,
        trade_date,
        main_net_inflow,
        main_net_ratio,
        super_net,
        super_ratio,
        big_net,
        mid_net,
        small_net
      FROM stock_flows
      WHERE ts_code = $1
        AND trade_date BETWEEN $2::date AND $3::date
      ORDER BY trade_date DESC;
    `;
    const result = await client.query(query, [tsCode, startDate, endDate]);
    await client.end();

    return {
      source: 'postgres',
      data: result.rows,
      count: result.rows.length
    };
  } catch (error) {
    await client.end();
    return {
      source: 'postgres',
      error: error.message,
      data: []
    };
  }
}

/**
 * 使用AKShare获取股票数据
 */
async function getStockFromAkshare(tsCode) {
  try {
    // 检查AKShare是否安装
    const { execSync } = require('child_process');
    execSync('pip show akshare > nul 2>&1');

    const { exec } = require('child_process');
    const script = `
import akshare as ak
result = ak.stock_info(ts_code='${ts_code}')
print(result.to_json())
    `;

    const result = execSync(`python -c "${script}"`, { encoding: 'utf8' });
    const data = JSON.parse(result.stdout);

    return {
      source: 'akshare',
      data: data,
      available: true
    };
  } catch (error) {
    return {
      source: 'akshare',
      available: false,
      error: error.message
    };
  }
}

/**
 * 使用AKShare获取价格数据
 */
async function getPricesFromAkshare(tsCode, startDate, endDate) {
  try {
    const { exec } = require('child_process');
    const script = `
import akshare as ak
import pandas as pd
result = ak.stock_zh_a_hist(symbol='${tsCode}', period='daily', start_date='${startDate}', end_date='${endDate}')
print(result.to_json())
    `;
    const result = execSync(`python -c "${script}"`, { encoding: 'utf8' });
    const data = JSON.parse(result.stdout);

    return {
      source: 'akshare',
      data: data,
      count: data.length || 0
    };
  } catch (error) {
    return {
      source: 'akshare',
      error: error.message,
      data: []
    };
  }
}

/**
 * 使用东方财富获取实时数据
 */
async function getRealtimeFromEastmarket(tsCode) {
  try {
    const { exec } = require('child_process');
    const script = `
import akshare as ak
result = ak.stock_zh_a_spot_em()
stock = result[result['代码'] == '${tsCode}']
print(stock.to_json())
    `;
    const result = execSync(`python -c "${script}"`, { encoding: 'utf8' });
    const data = JSON.parse(result.stdout);

    return {
      source: 'eastmoney',
      data: data,
      available: true
    };
  } catch (error) {
    return {
      source: 'eastmoney',
      available: false,
      error: error.message
    };
  }
}

/**
 * 聚合股票信息（优先使用数据库）
 */
async function getStockInfo(tsCode) {
  // 按优先级尝试各个数据源
  const sources = [
    { name: 'postgres', fn: () => getStockFromPostgres(tsCode) },
    { name: 'akshare', fn: () => getStockFromAkshare(tsCode) },
    { name: 'eastmoney', fn: () => getRealtimeFromEastmarket(tsCode) }
  ];

  for (const source of sources) {
    if (!DATA_SOURCES[source.name].enabled) continue;

    try {
      const result = await source.fn();
      if (result.available) {
        return {
          ...result,
          primary_source: source.name
        };
      }
    } catch (error) {
      console.error(`${source.name} error:`, error.message);
    }
  }

  return {
    available: false,
    message: '所有数据源均无法获取数据'
  };
}

/**
 * 聚合价格数据（优先使用数据库，然后AKShare）
 */
async function getAggregatedPrices(tsCode, startDate, endDate) {
  const sources = [
    { name: 'postgres', fn: () => getPricesFromPostgres(tsCode, startDate, endDate) },
    { name: 'akshare', fn: () => getPricesFromAkshare(tsCode, startDate, endDate) }
  ];

  for (const source of sources) {
    if (!DATA_SOURCES[source.name].enabled) continue;

    try {
      const result = await source.fn();
      if (result.data && result.data.length > 0) {
        return {
          ...result,
          primary_source: source.name,
          merged_from: [source.name]
        };
      }
    } catch (error) {
      console.error(`${source.name} error:`, error.message);
    }
  }

  return {
    data: [],
    primary_source: 'none',
    merged_from: []
  };
}

/**
 * 聚合资金流向数据
 */
async function getAggregatedFlows(tsCode, startDate, endDate) {
  const sources = [
    { name: 'postgres', fn: () => getFlowsFromPostgres(tsCode, startDate, endDate) }
  ];

  for (const source of sources) {
    if (!DATA_SOURCES[source.name].enabled) continue;

    try {
      const result = await source.fn();
      if (result.data && result.data.length > 0) {
        return {
          ...result,
          primary_source: source.name
        };
      }
    } catch (error) {
      console.error(`${source.name} error:`, error.message);
    }
  }

  return {
    data: [],
    primary_source: 'none'
  };
}

/**
 * 获取数据源状态
 */
function getDataSourcesStatus() {
  return {
    sources: DATA_SOURCES,
    total: Object.keys(DATA_SOURCES).length,
    enabled: Object.values(DATA_SOURCES).filter(s => s.enabled).length,
    disabled: Object.values(DATA_SOURCES).filter(s => !s.enabled).length
  };
}

/**
 * 更新数据源配置
 */
function updateDataSourceConfig(sourceName, config) {
  if (DATA_SOURCES[sourceName]) {
    DATA_SOURCES[sourceName] = {
      ...DATA_SOURCES[sourceName],
      ...config
    };
    return {
      success: true,
      updated: sourceName,
      config: DATA_SOURCES[sourceName]
    };
  } else {
    return {
      success: false,
      error: `数据源 ${sourceName} 不存在`
    };
  }
}

/**
 * 批量获取股票信息
 */
async function batchGetStockInfo(tsCodes) {
  const results = [];

  for (const tsCode of tsCodes) {
    const result = await getStockInfo(tsCode);
    results.push({
      ts_code: tsCode,
      ...result
    });
  }

  return {
    total: tsCodes.length,
    success: results.filter(r => r.available).length,
    results: results
  };
}

/**
 * 数据源健康检查
 */
async function healthCheck() {
  const healthStatus = {};

  // 检查PostgreSQL
  try {
    const { Client } = require('pg');
    const client = new Client(PG_CONFIG);
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    healthStatus.postgres = { status: 'ok', message: '连接正常' };
  } catch (error) {
    healthStatus.postgres = { status: 'error', message: error.message };
  }

  // 检查AKShare
  try {
    const { execSync } = require('child_process');
    execSync('python -c "import akshare as ak"', { encoding: 'utf8' });
    healthStatus.akshare = { status: 'ok', message: 'AKShare可用' };
  } catch (error) {
    healthStatus.akshare = { status: 'error', message: 'AKShare不可用' };
  }

  // 检查东方财富
  try {
    const { execSync } = require('child_process');
    execSync('python -c "import akshare as ak; ak.stock_zh_a_spot_em()"', { 
      encoding: 'utf8',
      timeout: 10000 
    });
    healthStatus.eastmoney = { status: 'ok', message: '东方财富API可用' };
  } catch (error) {
    healthStatus.eastmoney = { status: 'error', message: '东方财富API不可用' };
  }

  return {
    timestamp: new Date().toISOString(),
    sources: healthStatus,
    overall: Object.values(healthStatus).filter(s => s.status === 'ok').length
  };
}

module.exports = {
  getStockFromPostgres,
  getPricesFromPostgres,
  getFlowsFromPostgres,
  getStockFromAkshare,
  getPricesFromAkshare,
  getRealtimeFromEastmarket,
  getStockInfo,
  getAggregatedPrices,
  getAggregatedFlows,
  batchGetStockInfo,
  getDataSourcesStatus,
  updateDataSourceConfig,
  healthCheck
};