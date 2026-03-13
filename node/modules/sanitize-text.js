/**
 * Sanitize Model Output for Plain-Text Messaging Surfaces
 * HTML 转纯文本模块，将 Web HTML 转换为 WhatsApp/Signal/Telegram 格式
 */

/** Channels where HTML tags should be converted/stripped. */
const PLAIN_TEXT_SURFACES = new Set([
  'whatsapp',
  'signal',
  'sms',
  'irc',
  'telegram',
  'imessage',
  'googlechat'
]);

/**
 * Returns true when the channel cannot render raw HTML.
 * @param {string} channelId - 渠道ID
 * @returns {boolean}
 */
function isPlainTextSurface(channelId) {
  return PLAIN_TEXT_SURFACES.has(channelId.toLowerCase());
}

/**
 * Convert common HTML tags to their plain-text/lightweight-markup equivalents
 * and strip anything that remains.
 * 
 * 转换规则：
 * - <br> → \n
 * - <b>/<strong> → *text*
 * - <i>/<em> → _text_
 * - <s>/<strike>/<del> → ~text~
 * - <code> → `text`
 * - <h1-6> → \n*text*\n
 * - <li> → • text\n
 * 
 * @param {string} text - 输入文本
 * @returns {string} 清理后的文本
 */
function sanitizeForPlainText(text) {
  return text
    // Preserve angle-bracket autolinks as plain URLs before tag stripping.
    .replace(/<((?:https?:\/\/|mailto:)[^<>\s]+)>/gi, '$1')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Block elements → newlines
    .replace(/<\/?\s*(p|div)>/gi, '\n')
    // Bold → WhatsApp/Signal bold
    .replace(/<(b|strong)>(.*?)<\/\1>/gi, '*$2*')
    // Italic → WhatsApp/Signal italic
    .replace(/<(i|em)>(.*?)<\/\1>/gi, '_$2_')
    // Strikethrough → WhatsApp/Signal strikethrough
    .replace(/<(s|strike|del)>(.*?)<\/\1>/gi, '~$2~')
    // Inline code
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    // Headings → bold text with newline
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n*$1*\n')
    // List items → bullet points
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
    // Strip remaining HTML tags (require tag-like structure: <word...>)
    .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, '')
    // Collapse 3+ consecutive newlines into 2
    .replace(/\n{3,}/g, '\n\n');
}

module.exports = {
  isPlainTextSurface,
  sanitizeForPlainText
};