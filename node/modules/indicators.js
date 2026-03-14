/**
 * 技术指标增强模块
 * 支持MACD、KDJ、RSI、Bollinger Bands、MA、VOL等技术指标计算
 */

/**
 * 计算移动平均线
 */
function calculateMA(prices, period) {
  const mas = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    mas.push({
      date: i,
      value: sum / period
    });
  }
  return mas;
}

/**
 * 计算指数移动平均线
 */
function calculateEMA(prices, period) {
  const emas = [];
  const multiplier = 2 / (period + 1);

  // 第一个EMA使用简单平均
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  emas.push({ date: period - 1, value: ema });

  // 后续使用EMA公式
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
    emas.push({ date: i, value: ema });
  }

  return emas;
}

/**
 * 计算MACD指标
 */
function calculateMACD(prices, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
  const shortEMA = calculateEMA(prices, shortPeriod);
  const longEMA = calculateEMA(prices, longPeriod);

  // 计算DIF线
  const dif = [];
  const startIdx = longPeriod - shortPeriod;
  for (let i = 0; i < longEMA.length; i++) {
    const idx = startIdx + i;
    if (idx < shortEMA.length) {
      dif.push({
        date: longEMA[i].date,
        value: shortEMA[idx].value - longEMA[i].value
      });
    }
  }

  // 计算DEA线（信号线）
  const difValues = dif.map(d => d.value);
  const dea = calculateEMA(difValues, signalPeriod);

  // 计算MACD柱状图
  const macd = [];
  for (let i = 0; i < dif.length; i++) {
    const deaValue = dea[i] ? dea[i].value : null;
    if (deaValue !== null) {
      macd.push({
        date: dif[i].date,
        dif: dif[i].value,
        dea: deaValue,
        macd: (dif[i].value - deaValue) * 2
      });
    }
  }

  return {
    dif: dif,
    dea: dea,
    macd: macd,
    latest: macd.length > 0 ? macd[macd.length - 1] : null
  };
}

/**
 * 计算KDJ指标
 */
function calculateKDJ(highs, lows, closes, n = 9, m1 = 3, m2 = 3) {
  const kdj = [];

  for (let i = n - 1; i < closes.length; i++) {
    const periodHighs = highs.slice(i - n + 1, i + 1);
    const periodLows = lows.slice(i - n + 1, i + 1);

    const highN = Math.max(...periodHighs);
    const lowN = Math.min(...periodLows);

    const rsv = (highN === lowN) ? 50 : ((closes[i] - lowN) / (highN - lowN)) * 100;

    // K值
    const k = kdj.length > 0 ? (2 / 3) * kdj[kdj.length - 1].k + (1 / 3) * rsv : rsv;

    // D值
    const d = kdj.length > 0 ? (2 / 3) * kdj[kdj.length - 1].d + (1 / 3) * k : k;

    // J值
    const j = 3 * k - 2 * d;

    kdj.push({
      date: i,
      k: k,
      d: d,
      j: j,
      rsv: rsv
    });
  }

  return {
    k: kdj.map(d => ({ date: d.date, value: d.k })),
    d: kdj.map(d => ({ date: d.date, value: d.d })),
    j: kdj.map(d => ({ date: d.date, value: d.j })),
    latest: kdj.length > 0 ? kdj[kdj.length - 1] : null
  };
}

/**
 * 计算RSI指标
 */
function calculateRSI(prices, period = 14) {
  const rsi = [];
  let gains = 0;
  let losses = 0;

  // 计算第一个RSI
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) {
    rsi.push({ date: period, value: 100 });
  } else {
    const rs = avgGain / avgLoss;
    rsi.push({ date: period, value: 100 - (100 / (1 + rs)) });
  }

  // 计算后续RSI
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    const newAvgGain = (avgGain * (period - 1) + gain) / period;
    const newAvgLoss = (avgLoss * (period - 1) + loss) / period;

    if (newAvgLoss === 0) {
      rsi.push({ date: i, value: 100 });
    } else {
      const rs = newAvgGain / newAvgLoss;
      rsi.push({ date: i, value: 100 - (100 / (1 + rs)) });
    }
  }

  return {
    rsi: rsi,
    latest: rsi.length > 0 ? rsi[rsi.length - 1].value : null
  };
}

/**
 * 计算布林带
 */
function calculateBollingerBands(prices, period = 20, stdDevMultiplier = 2) {
  const ma = calculateMA(prices, period);
  const bands = [];

  for (let i = 0; i < ma.length; i++) {
    const dateIndex = ma[i].date;
    const slice = prices.slice(dateIndex - period + 1, dateIndex + 1);

    // 计算标准差
    const mean = ma[i].value;
    const squaredDiffs = slice.map(price => Math.pow(price - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(variance);

    bands.push({
      date: dateIndex,
      upper: mean + (stdDev * stdDevMultiplier),
      middle: mean,
      lower: mean - (stdDev * stdDevMultiplier),
      bandwidth: (stdDev * stdDevMultiplier * 2) / mean
    });
  }

  return {
    upper: bands.map(b => ({ date: b.date, value: b.upper })),
    middle: bands.map(b => ({ date: b.date, value: b.middle })),
    lower: bands.map(b => ({ date: b.date, value: b.lower })),
    bandwidth: bands.map(b => ({ date: b.date, value: b.bandwidth })),
    latest: bands.length > 0 ? bands[bands.length - 1] : null
  };
}

/**
 * 计算成交量指标
 */
function calculateVolumeAnalysis(volumes, prices, period = 20) {
  const analysis = [];

  for (let i = period - 1; i < volumes.length; i++) {
    const slice = volumes.slice(i - period + 1, i + 1);
    const avgVolume = slice.reduce((a, b) => a + b, 0) / period;
    const currentVolume = volumes[i];

    // 成交量比率
    const volumeRatio = currentVolume / avgVolume;

    // 价量关系
    const priceChange = prices[i] - prices[i - 1];
    let volumePriceRelation = 'unknown';

    if (priceChange > 0 && volumeRatio > 1.5) {
      volumePriceRelation = '量价齐升';
    } else if (priceChange > 0 && volumeRatio < 1) {
      volumePriceRelation = '量价背离';
    } else if (priceChange < 0 && volumeRatio > 1.5) {
      volumePriceRelation = '放量下跌';
    } else if (priceChange < 0 && volumeRatio < 1) {
      volumePriceRelation = '缩量下跌';
    }

    analysis.push({
      date: i,
      volume: currentVolume,
      avgVolume: avgVolume,
      volumeRatio: volumeRatio,
      volumePriceRelation: volumePriceRelation,
      volumeIncrease: currentVolume > volumes[i - 1],
      isHighVolume: volumeRatio > 1.5,
      isLowVolume: volumeRatio < 0.5
    });
  }

  return {
    analysis: analysis,
    latest: analysis.length > 0 ? analysis[analysis.length - 1] : null
  };
}

/**
 * 综合技术分析
 */
function comprehensiveTechnicalAnalysis(prices, volumes, highs, lows) {
  if (!prices || prices.length < 30) {
    return {
      error: '数据不足，至少需要30个交易日的数据'
    };
  }

  const macd = calculateMACD(prices);
  const kdj = calculateKDJ(highs, lows, prices);
  const rsi = calculateRSI(prices);
  const bollinger = calculateBollingerBands(prices);
  const volume = calculateVolumeAnalysis(volumes, prices);

  // 生成交易信号
  const signals = generateTradingSignals(macd, kdj, rsi, bollinger, volume);

  return {
    macd: macd,
    kdj: kdj,
    rsi: rsi,
    bollinger: bollinger,
    volume: volume,
    signals: signals,
    summary: generateSummary(macd, kdj, rsi, bollinger)
  };
}

/**
 * 生成交易信号
 */
function generateTradingSignals(macd, kdj, rsi, bollinger, volume) {
  const signals = [];

  if (!macd.latest || !kdj.latest || !rsi.latest || !bollinger.latest) {
    return { message: '数据不足，无法生成信号' };
  }

  // MACD信号
  const macdSignal = {
    name: 'MACD',
    value: macd.latest.macd,
    status: macd.latest.macd > 0 ? '多头' : '空头',
    cross: macd.latest.dif > macd.latest.dea ? '金叉' : '死叉'
  };

  // KDJ信号
  const kdjSignal = {
    name: 'KDJ',
    k: kdj.latest.k,
    d: kdj.latest.d,
    j: kdj.latest.j,
    status: kdj.latest.j > 80 ? '超买' : kdj.latest.j < 20 ? '超卖' : '中性',
    cross: kdj.latest.k > kdj.latest.d ? '金叉' : '死叉'
  };

  // RSI信号
  const rsiSignal = {
    name: 'RSI',
    value: rsi.latest,
    status: rsi.latest > 70 ? '超买' : rsi.latest < 30 ? '超卖' : '中性'
  };

  // 布林带信号
  const bollingerSignal = {
    name: 'Bollinger',
    price: bollinger.latest.middle,
    upper: bollinger.latest.upper,
    lower: bollinger.latest.lower,
    position: '中性'
  };

  // 成交量信号
  const volumeSignal = {
    name: 'Volume',
    relation: volume.latest ? volume.latest.volumePriceRelation : 'unknown',
    ratio: volume.latest ? volume.latest.volumeRatio : 1
  };

  return {
    macd: macdSignal,
    kdj: kdjSignal,
    rsi: rsiSignal,
    bollinger: bollingerSignal,
    volume: volumeSignal,
    overall: generateOverallSignal(macdSignal, kdjSignal, rsiSignal, bollingerSignal)
  };
}

/**
 * 生成整体信号
 */
function generateOverallSignal(macd, kdj, rsi, bollinger) {
  let score = 0;
  let reasons = [];

  // MACD评分
  if (macd.cross === '金叉') {
    score += 2;
    reasons.push('MACD金叉');
  } else if (macd.cross === '死叉') {
    score -= 2;
    reasons.push('MACD死叉');
  }

  // KDJ评分
  if (kdj.cross === '金叉' && kdj.status === '中性') {
    score += 1;
    reasons.push('KDJ金叉');
  } else if (kdj.status === '超买') {
    score -= 1;
    reasons.push('KDJ超买');
  } else if (kdj.status === '超卖') {
    score += 1;
    reasons.push('KDJ超卖');
  }

  // RSI评分
  if (rsi.status === '超卖') {
    score += 1;
    reasons.push('RSI超卖');
  } else if (rsi.status === '超买') {
    score -= 1;
    reasons.push('RSI超买');
  }

  // 整体判断
  let overallSignal;
  if (score >= 3) {
    overallSignal = '强烈买入';
  } else if (score >= 1) {
    overallSignal = '买入';
  } else if (score <= -3) {
    overallSignal = '强烈卖出';
  } else if (score <= -1) {
    overallSignal = '卖出';
  } else {
    overallSignal = '观望';
  }

  return {
    signal: overallSignal,
    score: score,
    reasons: reasons
  };
}

/**
 * 生成技术分析摘要
 */
function generateSummary(macd, kdj, rsi, bollinger) {
  const summary = {
    trend: 'unknown',
    momentum: 'unknown',
    volatility: 'unknown',
    support: bollinger.latest ? bollinger.latest.lower : null,
    resistance: bollinger.latest ? bollinger.latest.upper : null
  };

  if (macd.latest && kdj.latest) {
    if (macd.latest.macd > 0 && kdj.latest.k > kdj.latest.d) {
      summary.trend = '上升趋势';
    } else if (macd.latest.macd < 0 && kdj.latest.k < kdj.latest.d) {
      summary.trend = '下降趋势';
    } else {
      summary.trend = '震荡';
    }
  }

  if (rsi.latest) {
    if (rsi.latest > 70) {
      summary.momentum = '强势';
    } else if (rsi.latest < 30) {
      summary.momentum = '弱势';
    } else {
      summary.momentum = '中性';
    }
  }

  if (bollinger.latest) {
    if (bollinger.latest.bandwidth > 0.1) {
      summary.volatility = '高波动';
    } else if (bollinger.latest.bandwidth < 0.05) {
      summary.volatility = '低波动';
    } else {
      summary.volatility = '中等波动';
    }
  }

  return summary;
}

// ==================== 综合评分系统 ====================

/**
 * 计算均线系统分析
 * @param {Array} prices - 价格数组
 * @returns {Object} 均线系统分析结果
 */
function analyzeMASystem(prices) {
  const ma5 = calculateMA(prices, 5);
  const ma10 = calculateMA(prices, 10);
  const ma20 = calculateMA(prices, 20);
  const ma60 = calculateMA(prices, 60);

  const result = {
    ma5: ma5.length > 0 ? ma5[ma5.length - 1].value : null,
    ma10: ma10.length > 0 ? ma10[ma10.length - 1].value : null,
    ma20: ma20.length > 0 ? ma20[ma20.length - 1].value : null,
    ma60: ma60.length > 0 ? ma60[ma60.length - 1].value : null,
    trend: '震荡',
    signal: '观望',
    goldenCross: [],
    deathCross: []
  };

  // 判断多头排列/空头排列
  if (result.ma5 && result.ma10 && result.ma20) {
    if (result.ma5 > result.ma10 && result.ma10 > result.ma20) {
      result.trend = '多头排列';
      result.signal = '买入';
    } else if (result.ma5 < result.ma10 && result.ma10 < result.ma20) {
      result.trend = '空头排列';
      result.signal = '卖出';
    }
  }

  // 检测金叉/死叉
  if (ma5.length >= 2 && ma10.length >= 2) {
    const prev5 = ma5[ma5.length - 2].value;
    const prev10 = ma10[ma10.length - 2].value;
    const curr5 = ma5[ma5.length - 1].value;
    const curr10 = ma10[ma10.length - 1].value;

    if (prev5 <= prev10 && curr5 > curr10) {
      result.goldenCross.push('MA5上穿MA10');
    } else if (prev5 >= prev10 && curr5 < curr10) {
      result.deathCross.push('MA5下穿MA10');
    }
  }

  if (ma10.length >= 2 && ma20.length >= 2) {
    const prev10 = ma10[ma10.length - 2].value;
    const prev20 = ma20[ma20.length - 2].value;
    const curr10 = ma10[ma10.length - 1].value;
    const curr20 = ma20[ma20.length - 1].value;

    if (prev10 <= prev20 && curr10 > curr20) {
      result.goldenCross.push('MA10上穿MA20');
    } else if (prev10 >= prev20 && curr10 < curr20) {
      result.deathCross.push('MA10下穿MA20');
    }
  }

  return result;
}

/**
 * 计算OBV能量潮指标
 * @param {Array} closes - 收盘价数组
 * @param {Array} volumes - 成交量数组
 * @returns {Array} OBV值数组
 */
function calculateOBV(closes, volumes) {
  if (closes.length === 0 || volumes.length === 0) {
    return [];
  }

  const obvValues = [];
  obvValues[0] = volumes[0];  // 首日OBV = 首日成交量

  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      // 上涨：加成交量
      obvValues[i] = obvValues[i - 1] + volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      // 下跌：减成交量
      obvValues[i] = obvValues[i - 1] - volumes[i];
    } else {
      // 平盘：不变
      obvValues[i] = obvValues[i - 1];
    }
  }

  return obvValues;
}

/**
 * 计算CCI指标
 * @param {Array} highs - 最高价数组
 * @param {Array} lows - 最低价数组
 * @param {Array} closes - 收盘价数组
 * @param {number} n - 周期，默认14
 * @returns {Object} CCI指标结果
 */
function calculateCCI(highs, lows, closes, n = 14) {
  const cciValues = [];

  for (let i = n - 1; i < closes.length; i++) {
    // 计算典型价格 (TP) = (High + Low + Close) / 3
    const tp = (highs[i] + lows[i] + closes[i]) / 3;

    // 计算TP的N日简单移动平均
    let tpSum = 0;
    for (let j = i - n + 1; j <= i; j++) {
      tpSum += (highs[j] + lows[j] + closes[j]) / 3;
    }
    const tpSMA = tpSum / n;

    // 计算平均绝对偏差
    let meanDeviation = 0;
    for (let j = i - n + 1; j <= i; j++) {
      meanDeviation += Math.abs((highs[j] + lows[j] + closes[j]) / 3 - tpSMA);
    }
    meanDeviation /= n;

    // 计算CCI
    const cciVal = meanDeviation === 0 ? 0 : (tp - tpSMA) / (0.015 * meanDeviation);
    cciValues.push(cciVal);
  }

  const currentCCI = cciValues.length > 0 ? cciValues[cciValues.length - 1] : 0;

  // 判断信号
  let signal = '观望';
  if (cciValues.length >= 2) {
    const prevCCI = cciValues[cciValues.length - 2];
    if (prevCCI <= -100 && currentCCI > -100) {
      signal = '买入';
    } else if (prevCCI >= 100 && currentCCI < 100) {
      signal = '卖出';
    }
  }

  // 判断超买超卖
  let status = '正常';
  if (currentCCI > 100) {
    status = '超买';
  } else if (currentCCI < -100) {
    status = '超卖';
  }

  return {
    value: currentCCI,
    signal: signal,
    status: status
  };
}

/**
 * 分析OBV背离
 * @param {Array} obvValues - OBV值数组
 * @param {Array} closes - 收盘价数组
 * @returns {string} 背离类型
 */
function analyzeOBVDivergence(obvValues, closes) {
  if (obvValues.length < 5 || closes.length < 5) {
    return '无背离';
  }

  const recentOBV = obvValues.slice(-5);
  const recentCloses = closes.slice(-5);
  const maxOBV = Math.max(...recentOBV.slice(0, -1));
  const minOBV = Math.min(...recentOBV.slice(0, -1));
  const maxPrice = Math.max(...recentCloses.slice(0, -1));
  const minPrice = Math.min(...recentCloses.slice(0, -1));

  // 顶背离：价格新高，OBV未新高
  if (recentCloses[recentCloses.length - 1] > maxPrice && 
      recentOBV[recentOBV.length - 1] < maxOBV) {
    return '顶背离';
  }
  // 底背离：价格新低，OBV未新低
  if (recentCloses[recentCloses.length - 1] < minPrice && 
      recentOBV[recentOBV.length - 1] > minOBV) {
    return '底背离';
  }

  return '无背离';
}

/**
 * 分析量价关系
 * @param {Array} volumes - 成交量数组
 * @param {Array} closes - 收盘价数组
 * @returns {Object} 量价关系分析结果
 */
function analyzeVolumePriceRelation(volumes, closes) {
  if (volumes.length < 5 || closes.length < 5) {
    return {
      pattern: '数据不足',
      signal: '观望',
      strength: 50,
      volumeRatio: 1,
      description: ''
    };
  }

  // 计算近期平均成交量
  const avgVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const currentVolume = volumes[volumes.length - 1];
  const currentClose = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2];

  // 涨跌幅
  const priceChangePct = ((currentClose - prevClose) / prevClose) * 100;

  // 量比
  const volumeRatio = currentVolume / avgVolume;

  let pattern = '正常';
  let signal = '观望';
  let strength = 50;
  let description = '';

  // 量价齐升（健康上涨）
  if (priceChangePct > 2 && volumeRatio > 1.5) {
    pattern = '量价齐升';
    signal = '买入';
    strength = 70 + Math.min(priceChangePct, 20);
    description = `价格上涨${priceChangePct.toFixed(2)}%，成交量放大${volumeRatio.toFixed(2)}倍，资金积极入场`;
  }
  // 缩量上涨（可能乏力）
  else if (priceChangePct > 2 && volumeRatio < 0.8) {
    pattern = '缩量上涨';
    signal = '观望';
    strength = 40;
    description = '价格上涨但成交量萎缩，上涨动力可能不足';
  }
  // 放量下跌（恐慌抛售）
  else if (priceChangePct < -2 && volumeRatio > 1.5) {
    pattern = '放量下跌';
    signal = '卖出';
    strength = 30;
    description = `价格下跌${Math.abs(priceChangePct).toFixed(2)}%，成交量放大，资金出逃`;
  }
  // 缩量下跌（可能企稳）
  else if (priceChangePct < -2 && volumeRatio < 0.8) {
    pattern = '缩量下跌';
    signal = '观望';
    strength = 45;
    description = '价格下跌但成交量萎缩，抛压减轻，可能接近底部';
  }
  // 天量（异常放量）
  else if (volumeRatio > 3) {
    pattern = '异常放量';
    signal = '观望';
    strength = 50;
    description = `成交量突增${volumeRatio.toFixed(2)}倍，需警惕变盘`;
  }
  // 地量（极度缩量）
  else if (volumeRatio < 0.3) {
    pattern = '极度缩量';
    signal = '观望';
    strength = 50;
    description = '成交量极度萎缩，市场观望情绪浓厚，可能即将选择方向';
  }

  return {
    pattern,
    signal,
    strength: Math.min(100, Math.max(0, Math.round(strength))),
    volumeRatio: parseFloat(volumeRatio.toFixed(2)),
    description
  };
}

/**
 * 综合评分系统（0-100分）
 * @param {Array} prices - 价格数组
 * @param {Array} volumes - 成交量数组
 * @param {Array} highs - 最高价数组
 * @param {Array} lows - 最低价数组
 * @returns {Object} 综合评分结果
 */
function comprehensiveScore(prices, volumes, highs, lows) {
  const scores = {};

  // 均线系统评分 (20分)
  const maResult = analyzeMASystem(prices);
  if (maResult.trend === '多头排列') {
    scores['均线'] = 20;
  } else if (maResult.trend === '空头排列') {
    scores['均线'] = 0;
  } else {
    scores['均线'] = 10;
  }

  // KDJ评分 (20分)
  const kdjResult = calculateKDJ(highs, lows, prices);
  if (kdjResult.latest) {
    if (kdjResult.latest.k > kdjResult.latest.d) {
      scores['KDJ'] = kdjResult.latest.j < 20 ? 20 : 15;
    } else {
      scores['KDJ'] = kdjResult.latest.j > 80 ? 0 : 5;
    }
  } else {
    scores['KDJ'] = 10;
  }

  // CCI评分 (15分)
  const cciResult = calculateCCI(highs, lows, prices);
  if (cciResult.signal === '买入') {
    scores['CCI'] = 15;
  } else if (cciResult.signal === '卖出') {
    scores['CCI'] = 0;
  } else {
    scores['CCI'] = cciResult.status === '超卖' ? 7 : (cciResult.status === '超买' ? 8 : 10);
  }

  // OBV评分 (15分)
  const obvValues = calculateOBV(prices, volumes);
  const obvDivergence = analyzeOBVDivergence(obvValues, prices);
  if (obvDivergence === '底背离') {
    scores['OBV'] = 15;
  } else if (obvDivergence === '顶背离') {
    scores['OBV'] = 0;
  } else if (obvValues.length >= 3) {
    // 判断OBV趋势
    let obvTrend = 0;
    if (obvValues[obvValues.length - 1] > obvValues[obvValues.length - 2] && 
        obvValues[obvValues.length - 2] > obvValues[obvValues.length - 3]) {
      obvTrend = 1;  // 上升
    } else if (obvValues[obvValues.length - 1] < obvValues[obvValues.length - 2] && 
               obvValues[obvValues.length - 2] < obvValues[obvValues.length - 3]) {
      obvTrend = -1;  // 下降
    }
    
    if (obvTrend > 0) {
      scores['OBV'] = 12;
    } else if (obvTrend < 0) {
      scores['OBV'] = 3;
    } else {
      scores['OBV'] = 8;
    }
  } else {
    scores['OBV'] = 8;
  }

  // 量价关系评分 (20分)
  const vpResult = analyzeVolumePriceRelation(volumes, prices);
  if (vpResult.pattern === '量价齐升') {
    scores['量价'] = 20;
  } else if (vpResult.pattern === '放量下跌') {
    scores['量价'] = 0;
  } else {
    scores['量价'] = Math.floor(vpResult.strength / 5);
  }

  // 趋势一致性加分 (10分)
  const buySignals = [maResult.signal].filter(s => s === '买入').length;
  const sellSignals = [maResult.signal].filter(s => s === '卖出').length;

  if (buySignals >= 3) {
    scores['共振'] = 10;
  } else if (buySignals >= 2) {
    scores['共振'] = 5;
  } else if (sellSignals >= 3) {
    scores['共振'] = 0;
  } else if (sellSignals >= 2) {
    scores['共振'] = 3;
  } else {
    scores['共振'] = 5;
  }

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  // 评级
  let rating;
  if (totalScore >= 80) {
    rating = '强烈买入';
  } else if (totalScore >= 65) {
    rating = '买入';
  } else if (totalScore >= 45) {
    rating = '观望';
  } else if (totalScore >= 30) {
    rating = '卖出';
  } else {
    rating = '强烈卖出';
  }

  // 生成综合建议
  const suggestions = [];
  if (maResult.goldenCross.length > 0) {
    suggestions.push(`均线金叉: ${maResult.goldenCross.join(', ')}`);
  }
  if (cciResult.signal === '买入') {
    suggestions.push('CCI突破超卖区');
  }
  if (obvDivergence === '底背离') {
    suggestions.push('OBV底背离');
  }
  if (vpResult.pattern === '量价齐升') {
    suggestions.push('量价配合良好');
  }

  const summary = suggestions.length > 0 ? suggestions.join('；') : '多指标信号不一致，建议观望';

  return {
    totalScore,
    rating,
    details: scores,
    summary,
    rawIndicators: {
      均线: maResult,
      KDJ: kdjResult,
      CCI: cciResult,
      OBV: {
        values: calculateOBV(prices, volumes),
        divergence: analyzeOBVDivergence(calculateOBV(prices, volumes), prices)
      },
      量价: vpResult
    }
  };
}

// ==================== TDX (通达信) 公式解析器 ====================

/**
 * Token类型定义
 */
const TOKEN_TYPES = {
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  IDENTIFIER: 'IDENTIFIER',
  OPERATOR: 'OPERATOR',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  SEMICOLON: 'SEMICOLON',
  EOF: 'EOF'
};

/**
 * 词法分析器 - 将公式字符串转换为Token序列
 * @param {string} expr - 公式表达式
 * @returns {Array} Token数组
 */
function tokenize(expr) {
  const tokens = [];
  let i = 0;

  const patterns = {
    SPACE: /^\s+/,
    NUMBER: /^\d+(?:\.\d+)?/,
    STRING: /^'[^']*'/,
    OPERATOR: /^(?:<=|>=|<>|!=|==|:=|[+\-*/(),:<>])/,
    IDENTIFIER: /^[A-Za-z_]\w*/
  };

  while (i < expr.length) {
    // 跳过空白
    if (patterns.SPACE.test(expr.slice(i))) {
      i += expr.slice(i).match(patterns.SPACE)[0].length;
      continue;
    }

    // 数字
    if (patterns.NUMBER.test(expr.slice(i))) {
      const match = expr.slice(i).match(patterns.NUMBER)[0];
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(match) });
      i += match.length;
      continue;
    }

    // 字符串
    if (patterns.STRING.test(expr.slice(i))) {
      const match = expr.slice(i).match(patterns.STRING)[0];
      tokens.push({ type: TOKEN_TYPES.STRING, value: match.slice(1, -1) });
      i += match.length;
      continue;
    }

    // 操作符
    if (patterns.OPERATOR.test(expr.slice(i))) {
      const match = expr.slice(i).match(patterns.OPERATOR)[0];
      tokens.push({ type: TOKEN_TYPES.OPERATOR, value: match });
      i += match.length;
      continue;
    }

    // 标识符
    if (patterns.IDENTIFIER.test(expr.slice(i))) {
      const match = expr.slice(i).match(patterns.IDENTIFIER)[0];
      tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: match });
      i += match.length;
      continue;
    }

    throw new Error(`Unknown token at position ${i}: ${expr.slice(i, i + 10)}`);
  }

  tokens.push({ type: TOKEN_TYPES.EOF, value: null });
  return tokens;
}

/**
 * TDX公式解析器
 */
class TdxParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  current() {
    return this.tokens[this.pos];
  }

  next() {
    return this.tokens[++this.pos];
  }

  expect(type, value) {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` (${value})` : ''}, got ${token.type} (${token.value})`);
    }
    return token;
  }

  parse() {
    const statements = [];
    while (this.current().type !== TOKEN_TYPES.EOF) {
      statements.push(this.parseStatement());
    }
    return statements;
  }

  parseStatement() {
    // 赋值语句: VAR := EXPR
    if (this.current().type === TOKEN_TYPES.IDENTIFIER) {
      const name = this.current().value;
      this.next();
      if (this.current().type === TOKEN_TYPES.OPERATOR && this.current().value === ':=') {
        this.next();
        const expr = this.parseExpression();
        if (this.current().type === TOKEN_TYPES.OPERATOR && this.current().value === ':') {
          this.next(); // 输出标记
        }
        return { type: 'assign', name, expr };
      }
    }
    // 输出变量: EXPR:
    const expr = this.parseExpression();
    if (this.current().type === TOKEN_TYPES.OPERATOR && this.current().value === ':') {
      this.next();
    }
    return { type: 'output', expr };
  }

  parseExpression() {
    return this.parseLogicalOr();
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (this.current().type === TOKEN_TYPES.OPERATOR && this.current().value === 'OR') {
      const op = this.current().value;
      this.next();
      const right = this.parseLogicalAnd();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseEquality();
    while (this.current().type === TOKEN_TYPES.OPERATOR && this.current().value === 'AND') {
      const op = this.current().value;
      this.next();
      const right = this.parseEquality();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  parseEquality() {
    let left = this.parseRelational();
    while (this.current().type === TOKEN_TYPES.OPERATOR && ['<=', '>=', '<>', '!=', '==', '=', '<', '>'].includes(this.current().value)) {
      const op = this.current().value;
      this.next();
      const right = this.parseRelational();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  parseRelational() {
    let left = this.parseAdditive();
    while (this.current().type === TOKEN_TYPES.OPERATOR && ['+', '-'].includes(this.current().value)) {
      const op = this.current().value;
      this.next();
      const right = this.parseMultiplicative();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.current().type === TOKEN_TYPES.OPERATOR && ['+', '-'].includes(this.current().value)) {
      const op = this.current().value;
      this.next();
      const right = this.parseMultiplicative();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    while (this.current().type === TOKEN_TYPES.OPERATOR && ['*', '/'].includes(this.current().value)) {
      const op = this.current().value;
      this.next();
      const right = this.parseUnary();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  parseUnary() {
    if (this.current().type === TOKEN_TYPES.OPERATOR && ['-', 'NOT'].includes(this.current().value)) {
      const op = this.current().value;
      this.next();
      const operand = this.parseUnary();
      return { type: 'unary', op, operand };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    // 数字
    if (this.current().type === TOKEN_TYPES.NUMBER) {
      const value = this.current().value;
      this.next();
      return { type: 'number', value };
    }

    // 字符串
    if (this.current().type === TOKEN_TYPES.STRING) {
      const value = this.current().value;
      this.next();
      return { type: 'string', value };
    }

    // 标识符或函数调用
    if (this.current().type === TOKEN_TYPES.IDENTIFIER) {
      const name = this.current().value;
      this.next();

      // 函数调用
      if (this.current().type === TOKEN_TYPES.OPERATOR && this.current().value === '(') {
        this.next();
        const args = [];
        if (this.current().type !== TOKEN_TYPES.OPERATOR || this.current().value !== ')') {
          args.push(this.parseExpression());
          while (this.current().type === TOKEN_TYPES.OPERATOR && this.current().value === ',') {
            this.next();
            args.push(this.parseExpression());
          }
        }
        this.expect(TOKEN_TYPES.OPERATOR, ')');
        this.next();
        return { type: 'call', name, args };
      }

      // 变量引用
      return { type: 'variable', name };
    }

    // 括号表达式
    if (this.current().type === TOKEN_TYPES.OPERATOR && this.current().value === '(') {
      this.next();
      const expr = this.parseExpression();
      this.expect(TOKEN_TYPES.OPERATOR, ')');
      this.next();
      return expr;
    }

    throw new Error(`Unexpected token: ${this.current().type} (${this.current().value})`);
  }
}

// 预定义的TDX策略
const TDX_STRATEGIES = {
  // b1: 低吸策略
  b1: `RSV:=(CLOSE-LLV(LOW,9))/(HHV(HIGH,9)-LLV(LOW,9))*100;
K:=SMA(RSV,3,1);
D:=SMA(K,3,1);
J:=3*K-2*D;
短期趋势线:=EMA(EMA(C,10),10);
知行多空线:=(MA(CLOSE,14)+MA(CLOSE,28)+MA(CLOSE,57)+MA(CLOSE,114))/4;
振幅:=(HIGH-LOW)/REF(CLOSE,1)*100;
涨跌幅:=(CLOSE-REF(CLOSE,1))/REF(CLOSE,1)*100;
选股条件:
J<=13 AND 
短期趋势线>知行多空线 AND 
CLOSE>=知行多空线 AND 
振幅<=4 AND 
涨跌幅>=-2 AND 涨跌幅<=1.8 AND 
NOT INBLOCK('创业板') AND NOT INBLOCK('科创板') AND NOT INBLOCK('北证A股') AND NOT NAMELIKE('ST')`,

  // b2: 追涨策略
  b2: `RSV:=(CLOSE-LLV(LOW,9))/(HHV(HIGH,9)-LLV(LOW,9))*100;
K:=SMA(RSV,3,1);
D:=SMA(K,3,1);
J:=3*K-2*D;
REF(J,1)<=13 AND 
涨跌幅>=4 AND 
VOL>REF(VOL,1)*1.5 AND 
NOT INBLOCK('创业板') AND NOT INBLOCK('科创板') AND NOT INBLOCK('北证A股') AND NOT NAMELIKE('ST')`
};

// ==================== 多因子选股 ====================

/**
 * 多因子选股 - 基于价值、动量、技术因子
 * @param {Object} stockData - 股票数据对象，包含价格、成交量等
 * @param {Object} factors - 因子权重配置
 * @returns {Object} 选股结果
 */
function multiFactorSelect(stockData, factors = {
  value: 0.3,
  momentum: 0.3,
  technical: 0.4
}) {
  const { prices, volumes, highs, lows } = stockData;
  
  if (!prices || prices.length < 60) {
    return {
      selected: false,
      reason: '数据不足，至少需要60个交易日',
      score: 0
    };
  }

  const scores = {};
  
  // 价值因子评分 (30分)
  const currentPrice = prices[prices.length - 1];
  const ma20 = calculateMA(prices, 20);
  const ma20Value = ma20.length > 0 ? ma20[ma20.length - 1].value : 0;
  
  // 价格相对MA20的位置（越低越好）
  const pricePosition = ma20Value > 0 ? 1 - (currentPrice / ma20Value) : 0.5;
  scores.value = Math.max(0, Math.min(30, pricePosition * 60 + 15));
  
  // 动量因子评分 (30分)
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  
  // 近期动量（最近20天）
  const recentReturns = returns.slice(-20);
  const momentumScore = recentReturns.reduce((a, b) => a + b, 0) * 100;
  scores.momentum = Math.max(0, Math.min(30, momentumScore + 15));
  
  // 技术因子评分 (40分)
  const technical = comprehensiveScore(prices, volumes, highs, lows);
  scores.technical = technical.totalScore * 0.4;
  
  // 综合得分
  const totalScore = scores.value * factors.value + 
                    scores.momentum * factors.momentum + 
                    scores.technical * factors.technical;
  
  // 选股阈值
  const selected = totalScore >= 60;
  
  return {
    selected,
    reason: selected ? '综合得分达到选股标准' : '综合得分未达到选股标准',
    score: totalScore,
    details: scores,
    rating: technical.rating
  };
}

// ==================== 回测引擎 ====================

/**
 * 回测引擎类
 */
class BacktestEngine {
  constructor(initialCapital = 100000, commission = 0.0003, slippage = 0.001) {
    this.initialCapital = initialCapital;
    this.commission = commission;
    this.slippage = slippage;
    
    this.cash = initialCapital;
    this.positions = {};
    this.trades = [];
    this.dailyValues = [];
  }

  reset() {
    this.cash = this.initialCapital;
    this.positions = {};
    this.trades = [];
    this.dailyValues = [];
  }

  buy(date, code, price, shares, name = '') {
    // 考虑滑点
    const actualPrice = price * (1 + this.slippage);
    const totalCost = actualPrice * shares * (1 + this.commission);
    
    if (totalCost > this.cash) {
      return false;
    }
    
    this.cash -= totalCost;
    
    if (code in this.positions) {
      const oldShares = this.positions[code].shares;
      const oldCost = this.positions[code].cost;
      const newShares = oldShares + shares;
      this.positions[code].shares = newShares;
      this.positions[code].cost = (oldShares * oldCost + shares * actualPrice) / newShares;
    } else {
      this.positions[code] = {
        shares: shares,
        cost: actualPrice,
        name: name
      };
    }
    
    this.trades.push({
      date,
      code,
      name,
      action: 'BUY',
      price: actualPrice,
      shares,
      amount: actualPrice * shares,
      cash: this.cash
    });
    
    return true;
  }

  sell(date, code, price, shares = null, name = '') {
    if (!(code in this.positions)) {
      return false;
    }
    
    const position = this.positions[code];
    const sellShares = shares === null ? position.shares : Math.min(shares, position.shares);
    
    // 考虑滑点
    const actualPrice = price * (1 - this.slippage);
    const totalIncome = actualPrice * sellShares * (1 - this.commission);
    
    const costPrice = position.cost;
    const profit = (actualPrice - costPrice) * sellShares;
    const profitPct = (actualPrice - costPrice) / costPrice * 100;
    
    this.cash += totalIncome;
    position.shares -= sellShares;
    
    if (position.shares === 0) {
      delete this.positions[code];
    }
    
    this.trades.push({
      date,
      code,
      name,
      action: 'SELL',
      price: actualPrice,
      shares: sellShares,
      amount: actualPrice * sellShares,
      profit,
      profitPct,
      cash: this.cash
    });
    
    return true;
  }

  getPortfolioValue(date, prices) {
    let stockValue = 0;
    for (const code in this.positions) {
      if (code in prices) {
        stockValue += prices[code] * this.positions[code].shares;
      }
    }
    
    const totalValue = this.cash + stockValue;
    
    this.dailyValues.push({
      date,
      cash: this.cash,
      stockValue,
      totalValue
    });
    
    return totalValue;
  }

  getReport() {
    if (this.dailyValues.length === 0) {
      return {};
    }
    
    const finalValue = this.dailyValues[this.dailyValues.length - 1].totalValue;
    const totalReturn = (finalValue - this.initialCapital) / this.initialCapital;
    
    // 计算最大回撤
    let maxDrawdown = 0;
    let peak = this.initialCapital;
    
    for (const record of this.dailyValues) {
      if (record.totalValue > peak) {
        peak = record.totalValue;
      }
      const drawdown = (peak - record.totalValue) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    // 计算胜率
    const sellTrades = this.trades.filter(t => t.action === 'SELL');
    let winRate = 0;
    let profitLossRatio = 0;
    
    if (sellTrades.length > 0) {
      const winTrades = sellTrades.filter(t => t.profit > 0);
      winRate = winTrades.length / sellTrades.length;
      
      const avgProfit = winTrades.length > 0 ? 
        winTrades.reduce((a, b) => a + b.profit, 0) / winTrades.length : 0;
      const lossTrades = sellTrades.filter(t => t.profit <= 0);
      const avgLoss = lossTrades.length > 0 ? 
        Math.abs(lossTrades.reduce((a, b) => a + b.profit, 0)) / lossTrades.length : 1;
      profitLossRatio = avgLoss > 0 ? avgProfit / avgLoss : 0;
    }
    
    return {
      initialCapital: this.initialCapital,
      finalValue,
      totalReturn,
      totalReturnPct: `${(totalReturn * 100).toFixed(2)}%`,
      maxDrawdown,
      maxDrawdownPct: `${(maxDrawdown * 100).toFixed(2)}%`,
      winRate,
      winRatePct: `${(winRate * 100).toFixed(2)}%`,
      profitLossRatio,
      totalTrades: this.trades.filter(t => t.action === 'BUY').length
    };
  }
}

// ================== 强势股缩量回调战法（从tdxbot移植）==================

/**
 * 强势股策略配置参数
 */
const STRATEGY_CONFIG = {
  // 强势股条件
  upLimitLookbackDays: 10,      // 10日内寻找涨停板
  upLimitConsecutive: 2,        // 2连板及以上
  bandRiseThreshold: 30,        // 波段涨幅 ≥30%
  bandDays: 20,                 // 波段计算周期
  
  // 回调条件
  pullbackDaysMin: 2,           // 最小回调天数
  pullbackDaysMax: 5,           // 最大回调天数
  volumeShrinkPct: 30,          // 量能比上涨时缩小30%以上
  
  // 企稳信号参数
  dojiBodyRatio: 0.1,           // 十字星实体占振幅比例(≤10%)
  smallUpPct: 2.0,              // 小阳线最大涨幅(≤2%)
  longLowerShadowRatio: 2.0,    // 长下影线长度与实体比例(≥2倍)
  
  // 支撑位容差
  supportTolerancePct: 2.0,     // 回踩均线容差百分比(±2%)
  
  // 仓位管理
  singlePositionPct: 20,        // 单只票仓位(%)
  totalPositionMaxPct: 50,      // 总仓位上限(%)
  stopLossPct: 5.0              // 止损百分比
};

/**
 * 检查强势股条件
 * @param {Array} ohlcv - OHLCV数据
 * @returns {Object} {isStrong, reason, details}
 */
function checkStrongStockCondition(ohlcv) {
  const closes = ohlcv.map(d => d.close);
  const highs = ohlcv.map(d => d.high);
  const cfg = STRATEGY_CONFIG;
  
  // 计算涨跌幅和涨停判断
  const pctChg = [];
  const isUpLimit = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      pctChg.push(0);
      isUpLimit.push(false);
    } else {
      const chg = ((closes[i] - closes[i - 1]) / closes[i - 1]) * 100;
      pctChg.push(chg);
      isUpLimit.push(chg >= 9.5);
    }
  }
  
  // 检查连板
  const recentUpLimits = isUpLimit.slice(-cfg.upLimitLookbackDays);
  let consecutiveCount = 0;
  let maxConsecutive = 0;
  
  for (let i = 0; i < recentUpLimits.length; i++) {
    if (recentUpLimits[i]) {
      consecutiveCount++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
    } else {
      consecutiveCount = 0;
    }
  }
  
  // 检查波段涨幅
  const n = closes.length;
  const startIdx = Math.max(0, n - cfg.bandDays);
  const slice = closes.slice(startIdx);
  const bandHigh = Math.max(...highs.slice(startIdx));
  const bandLow = Math.min(...highs.slice(startIdx));
  const bandRisePct = bandLow > 0 ? ((bandHigh - bandLow) / bandLow) * 100 : 0;
  
  // 判断是否强势股
  let isStrong = false;
  let reason = '';
  const details = {
    maxConsecutive: 0,
    bandRisePct: 0
  };
  
  if (maxConsecutive >= cfg.upLimitConsecutive) {
    isStrong = true;
    reason = `近期出现${maxConsecutive}连板`;
    details.maxConsecutive = maxConsecutive;
  }
  
  if (!isStrong && bandRisePct >= cfg.bandRiseThreshold) {
    isStrong = true;
    reason = `${cfg.bandDays}日波段涨幅${bandRisePct.toFixed(1)}%`;
    details.bandRisePct = bandRisePct;
  }
  
  return {
    isStrong,
    reason: isStrong ? reason : '不满足强势股条件',
    details
  };
}

/**
 * 检查首次回调买入点
 * @param {Array} ohlcv - OHLCV数据
 * @returns {Object} {isEntry, reason, details}
 */
function checkFirstPullbackEntry(ohlcv) {
  const { closes, highs, lows, opens, volumes } = ohlcv.reduce((acc, d) => {
    acc.closes.push(d.close);
    acc.highs.push(d.high);
    acc.lows.push(d.low);
    acc.opens.push(d.open);
    acc.volumes.push(d.volume);
    return acc;
  }, { closes: [], highs: [], lows: [], opens: [], volumes: [] });
  
  const cfg = STRATEGY_CONFIG;
  const n = closes.length;
  
  if (n < 10) {
    return {
      isEntry: false,
      reason: '数据不足，需要至少10天数据',
      details: {}
    };
  }
  
  // 计算均线
  const ma5 = calculateMA(closes, 5);
  const ma10 = calculateMA(closes, 10);
  const ma20 = calculateMA(closes, 20);
  
  const currentPrice = closes[n - 1];
  const ma5Last = ma5.length > 0 ? ma5[ma5.length - 1].value : 0;
  const ma10Last = ma10.length > 0 ? ma10[ma10.length - 1].value : 0;
  const ma20Last = ma20.length > 0 ? ma20[ma20.length - 1].value : 0;
  
  // 检查回调天数
  let pullbackDays = 0;
  for (let i = n - 1; i >= Math.max(0, n - cfg.pullbackDaysMax); i--) {
    if (closes[i] < closes[i - 1]) {
      pullbackDays++;
    } else {
      break;
    }
  }
  
  // 检查量能萎缩
  const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const currentVolume = volumes[n - 1];
  const volumeShrinkPct = avgVolume > 0 ? ((avgVolume - currentVolume) / avgVolume) * 100 : 0;
  
  // 检查企稳信号
  const bodyRatio = Math.abs(closes[n - 1] - opens[n - 1]) / (highs[n - 1] - lows[n - 1]);
  const lowerShadow = Math.min(opens[n - 1], closes[n - 1]) - lows[n - 1];
  const body = Math.abs(closes[n - 1] - opens[n - 1]);
  const longLowerShadow = body > 0 ? lowerShadow / body >= cfg.longLowerShadowRatio : false;
  
  // 判断是否满足买入条件
  let isEntry = false;
  let reason = '';
  const details = {
    pullbackDays,
    volumeShrinkPct: volumeShrinkPct.toFixed(1),
    ma5: ma5Last.toFixed(2),
    ma10: ma10Last.toFixed(2),
    ma20: ma20Last.toFixed(2)
  };
  
  // 回调天数符合
  const pullbackValid = pullbackDays >= cfg.pullbackDaysMin && pullbackDays <= cfg.pullbackDaysMax;
  
  // 量能萎缩符合
  const volumeValid = volumeShrinkPct >= cfg.volumeShrinkPct;
  
  // 回踩支撑
  const supportValid = Math.abs(currentPrice - ma10Last) / ma10Last <= cfg.supportTolerancePct / 100;
  
  // 企稳信号
  const stabilizationValid = bodyRatio <= cfg.dojiBodyRatio || longLowerShadow;
  
  if (pullbackValid && volumeValid && supportValid && stabilizationValid) {
    isEntry = true;
    reason = `回调${pullbackDays}天，量能萎缩${volumeShrinkPct.toFixed(1)}%，回踩MA${ma10Last.toFixed(2)}企稳`;
  }
  
  return {
    isEntry,
    reason: isEntry ? reason : '不满足买入条件',
    details
  };
}

// ================== 缠论分型识别（从GU_PIAO_TO_REDIS移植）==================

/**
 * 滑动窗口最大值（单调队列实现）
 * @param {number[]} arr - 数组
 * @param {number} windowSize - 窗口大小
 * @returns {number[]} 每个位置的最大值
 */
function slidingMax(arr, windowSize) {
  const n = arr.length;
  const result = new Array(n).fill(-Infinity);
  const dq = []; // 存储索引，队首为当前窗口最大值索引
  
  for (let i = 0; i < n; i++) {
    // 移除窗口外的元素
    while (dq.length > 0 && dq[0] <= i - windowSize) {
      dq.shift();
    }
    // 移除队列中小于当前元素的索引
    while (dq.length > 0 && arr[dq[dq.length - 1]] <= arr[i]) {
      dq.pop();
    }
    dq.push(i);
    // 窗口完全形成后开始记录结果
    if (i >= windowSize - 1) {
      result[i] = arr[dq[0]];
    }
  }
  return result;
}

/**
 * 滑动窗口最小值（单调队列实现）
 * @param {number[]} arr - 数组
 * @param {number} windowSize - 窗口大小
 * @returns {number[]} 每个位置的最小值
 */
function slidingMin(arr, windowSize) {
  const n = arr.length;
  const result = new Array(n).fill(Infinity);
  const dq = []; // 存储索引，队首为当前窗口最小值索引
  
  for (let i = 0; i < n; i++) {
    // 移除窗口外的元素
    while (dq.length > 0 && dq[0] <= i - windowSize) {
      dq.shift();
    }
    // 移除队列中大于当前元素的索引
    while (dq.length > 0 && arr[dq[dq.length - 1]] >= arr[i]) {
      dq.pop();
    }
    dq.push(i);
    // 窗口完全形成后开始记录结果
    if (i >= windowSize - 1) {
      result[i] = arr[dq[0]];
    }
  }
  return result;
}

/**
 * 识别顶底分型
 * @param {number[]} highs - 最高价数组
 * @param {number[]} lows - 最低价数组
 * @returns {Object} {tops: [], bottoms: []}
 */
function identifyTurns(highs, lows) {
  const tops = [];
  const bottoms = [];
  const windowSize = 3;
  
  const maxHighs = slidingMax(highs, windowSize);
  const minLows = slidingMin(lows, windowSize);
  
  for (let i = windowSize - 1; i < highs.length; i++) {
    // 顶分型：当前K线的高点是窗口内最大，且左右高点都低于
    if (highs[i] === maxHighs[i]) {
      const leftHigh = i > 0 ? highs[i - 1] : highs[i];
      const rightHigh = i < highs.length - 1 ? highs[i + 1] : highs[i];
      if (highs[i] > leftHigh && highs[i] > rightHigh) {
        tops.push({
          index: i,
          price: highs[i],
          type: 'top'
        });
      }
    }
    
    // 底分型：当前K线的低点是窗口内最小，且左右低点都高于
    if (lows[i] === minLows[i]) {
      const leftLow = i > 0 ? lows[i - 1] : lows[i];
      const rightLow = i < lows.length - 1 ? lows[i + 1] : lows[i];
      if (lows[i] < leftLow && lows[i] < rightLow) {
        bottoms.push({
          index: i,
          price: lows[i],
          type: 'bottom'
        });
      }
    }
  }
  
  return { tops, bottoms };
}

// ================== 口袋支点检测（从tdx-ss移植）==================

/**
 * 计算相对强度(RPS - Relative Price Strength)
 * @param {number[]} prices - 价格数组
 * @param {number[]} benchmarkPrices - 基准价格数组（如指数）
 * @param {number} period - 计算周期（10/20/50/120/250日）
 * @returns {number[]} RPS值数组
 */
function calculateRPS(prices, benchmarkPrices, period) {
  const n = prices.length;
  const rps = [];
  
  for (let i = period - 1; i < n; i++) {
    const stockReturn = (prices[i] - prices[i - period]) / prices[i - period] * 100;
    const benchmarkReturn = (benchmarkPrices[i] - benchmarkPrices[i - period]) / benchmarkPrices[i - period] * 100;
    rps.push(stockReturn - benchmarkReturn);
  }
  
  return rps;
}

/**
 * 计算回调深度
 * @param {number[]} prices - 价格数组
 * @param {number} peakIndex - 波峰索引
 * @returns {number} 回调深度百分比
 */
function calculatePullbackDepth(prices, peakIndex) {
  const peakPrice = prices[peakIndex];
  let minPrice = peakPrice;
  
  for (let i = peakIndex + 1; i < prices.length; i++) {
    minPrice = Math.min(minPrice, prices[i]);
  }
  
  return peakPrice > 0 ? ((peakPrice - minPrice) / peakPrice) * 100 : 0;
}

/**
 * 检测口袋支点
 * @param {number[]} highs - 最高价数组
 * @param {number[]} lows - 最低价数组
 * @param {number[]} closes - 收盘价数组
 * @param {number[]} volumes - 成交量数组
 * @returns {Array} 口袋支点数组
 */
function detectPivotPoint(highs, lows, closes, volumes) {
  const pivotPoints = [];
  const windowSize = 10;
  
  if (highs.length < windowSize) {
    return pivotPoints;
  }
  
  for (let i = windowSize; i < highs.length; i++) {
    const windowHighs = highs.slice(i - windowSize, i);
    const windowLows = lows.slice(i - windowSize, i);
    const maxHigh = Math.max(...windowHighs);
    const maxHighIndex = i - windowSize + windowHighs.indexOf(maxHigh);
    
    // 检查当前是否为口袋支点：
    // 1. 价格在突破点附近（±2%）
    // 2. 成交量放大（高于10日平均）
    const currentPrice = closes[i];
    const isNearHigh = Math.abs(currentPrice - maxHigh) / maxHigh <= 0.02;
    
    const avgVolume = volumes.slice(i - 10, i).reduce((a, b) => a + b, 0) / 10;
    const isVolumeHigh = volumes[i] > avgVolume * 1.2;
    
    if (isNearHigh && isVolumeHigh) {
      const pullbackDepth = calculatePullbackDepth(closes.slice(0, i + 1), maxHighIndex);
      
      pivotPoints.push({
        index: i,
        price: currentPrice,
        type: 'pivot',
        volumeRatio: (volumes[i] / avgVolume).toFixed(2),
        pullbackDepth: pullbackDepth.toFixed(2),
        pivotHigh: maxHigh,
        pivotHighIndex: maxHighIndex
      });
    }
  }
  
  return pivotPoints;
}

// ================== 三买变体信号检测（从GU_PIAO_TO_REDIS移植）==================

/**
 * 检测三买变体信号
 * @param {number[]} highs - 最高价数组
 * @param {number[]} lows - 最低价数组
 * @param {number[]} closes - 收盘价数组
 * @returns {Object} {hasSignal, signal, details}
 */
function detectThreeBuyVariant(highs, lows, closes) {
  // 识别底分型
  const { bottoms } = identifyTurns(highs, lows);
  
  if (bottoms.length < 2) {
    return {
      hasSignal: false,
      signal: '无三买信号',
      details: { reason: '底分型数量不足' }
    };
  }
  
  // 找到最后两个底分型
  const lastBottom = bottoms[bottoms.length - 1];
  const secondLastBottom = bottoms[bottoms.length - 2];
  
  // 检查三买条件：
  // 1. 第二个底分型价格高于第一个（抬升）
  // 2. 当前收盘价站稳在第二个底分型之上
  const priceHigher = lastBottom.price > secondLastBottom.price;
  const currentPrice = closes[closes.length - 1];
  const priceStable = currentPrice > lastBottom.price * 1.02; // 站稳2%以上
  
  // 检查是否有企稳K线
  const isStableKline = checkStableKline(closes, highs, lows);
  
  const hasSignal = priceHigher && priceStable && isStableKline;
  
  return {
    hasSignal,
    signal: hasSignal ? '三买变体信号' : '无三买信号',
    details: {
      secondLastBottom: secondLastBottom.price.toFixed(2),
      lastBottom: lastBottom.price.toFixed(2),
      currentPrice: currentPrice.toFixed(2),
      priceHigher,
      priceStable,
      isStableKline
    }
  };
}

/**
 * 检查企稳K线
 * @param {number[]} closes - 收盘价数组
 * @param {number[]} highs - 最高价数组
 * @param {number[]} lows - 最低价数组
 * @returns {boolean}
 */
function checkStableKline(closes, highs, lows) {
  const n = closes.length;
  if (n < 3) return false;
  
  const i = n - 1;
  const open = closes[i - 1];
  const close = closes[i];
  const high = highs[i];
  const low = lows[i];
  
  // 检查是否为小阳线或十字星
  const body = Math.abs(close - open);
  const range = high - low;
  const bodyRatio = range > 0 ? body / range : 0;
  
  // 检查是否有长下影线
  const lowerShadow = Math.min(open, close) - low;
  const lowerShadowRatio = body > 0 ? lowerShadow / body : 0;
  
  // 小阳线或十字星 + 长下影线
  return (bodyRatio <= 0.3 || lowerShadowRatio >= 1.5);
}

/**
 * 缠论三买综合分析
 * @param {number[]} highs - 最高价数组
 * @param {number[]} lows - 最低价数组
 * @param {number[]} closes - 收盘价数组
 * @returns {Object} 分析结果
 */
function analyzeThreeBuySignal(highs, lows, closes) {
  const signal = detectThreeBuyVariant(highs, lows, closes);
  const { bottoms } = identifyTurns(highs, lows);
  
  return {
    ...signal,
    bottomCount: bottoms.length,
    recommendation: signal.hasSignal ? '建议关注，等待确认' : '暂无操作建议',
    riskLevel: signal.hasSignal ? '中等' : '低'
  };
}

module.exports = {
  calculateMA,
  calculateEMA,
  calculateMACD,
  calculateKDJ,
  calculateRSI,
  calculateBollingerBands,
  calculateVolumeAnalysis,
  comprehensiveTechnicalAnalysis,
  generateTradingSignals,
  generateOverallSignal,
  generateSummary,
  // 新增：综合评分系统
  analyzeMASystem,
  calculateCCI,
  analyzeOBVDivergence,
  analyzeVolumePriceRelation,
  comprehensiveScore,
  // 新增：TDX公式解析器
  tokenize,
  TdxParser,
  TDX_STRATEGIES,
  // 新增：多因子选股
  multiFactorSelect,
  // 新增：回测引擎
  BacktestEngine,
  // 新增：强势股缩量回调战法
  STRATEGY_CONFIG,
  checkStrongStockCondition,
  checkFirstPullbackEntry,
  // 新增：缠论分型识别
  slidingMax,
  slidingMin,
  identifyTurns,
  // 新增：口袋支点检测
  calculateRPS,
  calculatePullbackDepth,
  detectPivotPoint,
  // 新增：三买变体信号检测
  detectThreeBuyVariant,
  checkStableKline,
  analyzeThreeBuySignal
};