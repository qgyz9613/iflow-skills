/**
 * Heartbeat Cron Support - Cron 表达式解析器
 * 参考 OpenClaw cron 模块
 */

// Cron 表达式解析
function parseCronExpression(expr) {
  // 简化版 cron 解析：支持 "分 时 日 月 周" 格式
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  return {
    minute: parseCronPart(minute, 0, 59),
    hour: parseCronPart(hour, 0, 23),
    dayOfMonth: parseCronPart(dayOfMonth, 1, 31),
    month: parseCronPart(month, 1, 12),
    dayOfWeek: parseCronPart(dayOfWeek, 0, 6),
    raw: expr
  };
}

function parseCronPart(part, min, max) {
  if (part === '*') return null;
  
  if (part.startsWith('*/')) {
    const step = parseInt(part.slice(2));
    return { type: 'step', step, min, max };
  }
  
  if (part.includes('-')) {
    const [start, end] = part.split('-').map(Number);
    return { type: 'range', start, end };
  }
  
  if (part.includes(',')) {
    const values = part.split(',').map(Number);
    return { type: 'list', values };
  }
  
  return { type: 'exact', value: parseInt(part) };
}

function matchCronPart(parsed, value) {
  if (!parsed) return true;
  
  switch (parsed.type) {
    case 'exact':
      return value === parsed.value;
    case 'range':
      return value >= parsed.start && value <= parsed.end;
    case 'list':
      return parsed.values.includes(value);
    case 'step':
      return (value - parsed.min) % parsed.step === 0;
    default:
      return false;
  }
}

function matchCron(cronParsed, date) {
  return (
    matchCronPart(cronParsed.minute, date.getMinutes()) &&
    matchCronPart(cronParsed.hour, date.getHours()) &&
    matchCronPart(cronParsed.dayOfMonth, date.getDate()) &&
    matchCronPart(cronParsed.month, date.getMonth() + 1) &&
    matchCronPart(cronParsed.dayOfWeek, date.getDay())
  );
}

function getNextCronTime(expr, from = new Date()) {
  const parsed = parseCronExpression(expr);
  if (!parsed) return null;
  
  const next = new Date(from);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(next.getMinutes() + 1);
  
  for (let i = 0; i < 527040; i++) {
    if (matchCron(parsed, next)) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }
  
  return null;
}

module.exports = {
  parseCronExpression,
  matchCron,
  getNextCronTime
};