/**
 * Reasoning Tags Processing
 * Strips AI reasoning tags from text (e.g., <thinking>, <final>)
 */

const codeRegions = require('./code-regions');

function stripRelevantMemoriesTags(text) {
  // This is a simplified version for now
  return text;
}

const QUICK_TAG_RE = /<\s*\/?\s*(?:think(?:ing)?|thought|antthinking|final)\b/i;
const FINAL_TAG_RE = /<\s*\/?\s*final\b[^<>]*>/gi;
const THINKING_TAG_RE = /<\s*(\/?)\s*(?:think(?:ing)?|thought|antthinking)\b[^<>]*>/gi;

function applyTrim(value, mode) {
  if (mode === 'none') {
    return value;
  }
  if (mode === 'start') {
    return value.trimStart();
  }
  return value.trim();
}

function stripReasoningTagsFromText(text, options = {}) {
  if (!text) {
    return text;
  }
  if (!QUICK_TAG_RE.test(text)) {
    return text;
  }

  const mode = options.mode ?? 'strict';
  const trimMode = options.trim ?? 'both';

  let cleaned = text;
  if (FINAL_TAG_RE.test(cleaned)) {
    FINAL_TAG_RE.lastIndex = 0;
    const finalMatches = [];
    const preCodeRegions = codeRegions.findCodeRegions(cleaned);
    
    for (const match of cleaned.matchAll(FINAL_TAG_RE)) {
      const start = match.index ?? 0;
      const inCode = codeRegions.isInsideCode(start, preCodeRegions);
      finalMatches.push({
        start,
        length: match[0].length,
        inCode
      });
    }

    for (let i = finalMatches.length - 1; i >= 0; i--) {
      const m = finalMatches[i];
      if (!m.inCode) {
        cleaned = cleaned.slice(0, m.start) + cleaned.slice(m.start + m.length);
      }
    }
  } else {
    FINAL_TAG_RE.lastIndex = 0;
  }

  const codeRegionsList = codeRegions.findCodeRegions(cleaned);

  THINKING_TAG_RE.lastIndex = 0;
  let result = '';
  let lastIndex = 0;
  let inThinking = false;

  for (const match of cleaned.matchAll(THINKING_TAG_RE)) {
    const idx = match.index ?? 0;
    const isClose = match[1] === '/';

    if (codeRegions.isInsideCode(idx, codeRegionsList)) {
      continue;
    }

    if (!inThinking) {
      result += cleaned.slice(lastIndex, idx);
      if (!isClose) {
        inThinking = true;
      }
    } else if (isClose) {
      inThinking = false;
    }

    lastIndex = idx + match[0].length;
  }

  if (!inThinking || mode === 'preserve') {
    result += cleaned.slice(lastIndex);
  }

  return applyTrim(result, trimMode);
}

module.exports = {
  stripReasoningTagsFromText,
  stripRelevantMemoriesTags
};