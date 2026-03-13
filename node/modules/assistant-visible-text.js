/**
 * Assistant Visible Text Processing
 * Strips internal scaffolding from AI assistant output
 */

const codeRegions = require('./code-regions');
const reasoningTags = require('./reasoning-tags');

const MEMORY_TAG_RE = /<\s*(\/?)\s*relevant[-_]memories\b[^<>]*>/gi;
const MEMORY_TAG_QUICK_RE = /<\s*\/?\s*relevant[-_]memories\b/i;

function stripRelevantMemoriesTags(text) {
  if (!text || !MEMORY_TAG_QUICK_RE.test(text)) {
    return text;
  }
  MEMORY_TAG_RE.lastIndex = 0;

  const codeRegionsList = codeRegions.findCodeRegions(text);
  let result = '';
  let lastIndex = 0;
  let inMemoryBlock = false;

  for (const match of text.matchAll(MEMORY_TAG_RE)) {
    const idx = match.index ?? 0;
    if (codeRegions.isInsideCode(idx, codeRegionsList)) {
      continue;
    }

    const isClose = match[1] === '/';
    if (!inMemoryBlock) {
      result += text.slice(lastIndex, idx);
      if (!isClose) {
        inMemoryBlock = true;
      }
    } else if (isClose) {
      inMemoryBlock = false;
    }

    lastIndex = idx + match[0].length;
  }

  if (!inMemoryBlock) {
    result += text.slice(lastIndex);
  }

  return result;
}

function stripAssistantInternalScaffolding(text) {
  const withoutReasoning = reasoningTags.stripReasoningTagsFromText(text, { mode: 'preserve', trim: 'start' });
  return stripRelevantMemoriesTags(withoutReasoning).trimStart();
}

module.exports = {
  stripRelevantMemoriesTags,
  stripAssistantInternalScaffolding
};