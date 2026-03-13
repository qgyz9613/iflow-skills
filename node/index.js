/**
 * iFlow Node.js Native Modules
 * 完整模块套件
 */

const desktop = require('./desktop');
const browser = require('./modules/browser');
const files = require('./modules/files');
const session = require('./modules/session');
const channel = require('./modules/channel');
const summarize = require('./modules/summarize');
const agents = require('./modules/agents');
const autonomous = require('./modules/autonomous');
const decision = require('./modules/decision');
const heartbeat = require('./modules/heartbeat');
const improve = require('./modules/improve');
const lobster = require('./modules/lobster');
const sandbox = require('./modules/sandbox');
const selfrepair = require('./modules/selfrepair');
const skills = require('./modules/skills');
const subagent = require('./modules/subagent');
const triage = require('./modules/triage');
const state = require('./modules/state');
const cache = require('./modules/cache');
const llm = require('./modules/llm');
const hooks = require('./modules/hooks');
const retryPolicy = require('./modules/retry-policy');
const archive = require('./modules/archive');
const runtimeSystem = require('./modules/runtime-system');
const cacheUtils = require('./modules/cache-utils');
const utilsBase = require('./modules/utils-base');
const systemUtils = require('./modules/system-utils');
const securityUtils = require('./modules/security-utils');
const secrets = require('./modules/secrets');
const linkExtraction = require('./modules/link-extraction');
const webGateway = require('./modules/web-gateway');
const channelsEnhanced = require('./modules/channels-enhanced');
const contextEngine = require('./modules/context-engine');
const markdown = require('./modules/markdown');
const media = require('./modules/media');
const logging = require('./modules/logging');
const pluginTools = require('./modules/plugin-tools');
const cliFormat = require('./modules/cli-format');
const enhancedRetry = require('./modules/enhanced-retry');
const errorHandler = require('./modules/error-handler');
const dedupeCache = require('./modules/dedupe-cache');
const diagnosticEvents = require('./modules/diagnostic-events');
const rateLimit = require('./modules/rate-limit');
const httpGuard = require('./modules/http-guard');
const textChunking = require('./modules/text-chunking');
const netUtils = require('./modules/net-utils');
const processMonitor = require('./modules/process-monitor');
const stringUtils = require('./modules/string-utils');
const cluster = require('./modules/cluster');
const dataValidation = require('./modules/data-validation');
const gitUtils = require('./modules/git-utils');
const envConfig = require('./modules/env-config');
const clipboard = require('./modules/clipboard');
const frontmatter = require('./modules/frontmatter');
const objectSafety = require('./modules/object-safety');
const processRestart = require('./modules/process-restart');
const fileAtomic = require('./modules/file-atomic');
const agentEvents = require('./modules/agent-events');
const channelActivity = require('./modules/channel-activity');
const pathResolver = require('./modules/path-resolver');
const fileSecurity = require('./modules/file-security');
const shellEnv = require('./modules/shell-env');
const osSummary = require('./modules/os-summary');
const executablePath = require('./modules/executable-path');
const nodeCommands = require('./modules/node-commands');
const secretFile = require('./modules/secret-file');
const packageJson = require('./modules/package-json');
const jsonFile = require('./modules/json-file');
const mapSize = require('./modules/map-size');
const stableNodePath = require('./modules/stable-node-path');
const machineName = require('./modules/machine-name');
const wsl = require('./modules/wsl');
const pathPrepend = require('./modules/path-prepend');
const stringSample = require('./modules/string-sample');
const joinSegments = require('./modules/join-segments');
const codeRegions = require('./modules/code-regions');
const detectPackageManager = require('./modules/detect-package-manager');
const isMain = require('./modules/is-main');
const reasoningTags = require('./modules/reasoning-tags');
const subagentsFormat = require('./modules/subagents-format');
const assistantVisibleText = require('./modules/assistant-visible-text');
const sanitizeText = require('./modules/sanitize-text');
const pathGuards = require('./modules/path-guards');
const jsonFilesEnhanced = require('./modules/json-files-enhanced');
const abort = require('./modules/abort');
// 第十二阶段新增 - OpenClaw 模块
const fileLock = require('./file-lock');
const archivePath = require('./archive-path');
const fetchEnhanced = require('./fetch-enhanced');
const hostEnvSecurity = require('./host-env-security');
// 第十三阶段新增
const processRespawn = require('./process-respawn');
const gitRootEnhanced = require('./git-root-enhanced');
const tempPath = require('./temp-path');
const envManage = require('./env-manage');
const runtimeEnv = require('./runtime-env');
const jsonStoreEnhanced = require('./json-store-enhanced');
// 第十四阶段新增
const configEval = require('./config-eval');
const requirementsEval = require('./requirements-eval');
const stringNormalization = require('./string-normalization');
const queueHelpers = require('./queue-helpers');
const frontmatterSimple = require('./frontmatter-simple');
// 第十五阶段新增
const normalizeSecretInput = require('./normalize-secret-input');
const transcriptTools = require('./transcript-tools');
const directiveTags = require('./directive-tags');
const usageFormat = require('./usage-format');
const shellArgv = require('./shell-argv');
const pidAlive = require('./pid-alive');
const processScopedMap = require('./process-scoped-map');
const deviceAuth = require('./device-auth');
const deviceAuthStore = require('./device-auth-store');
const chatContent = require('./chat-content');
const chatEnvelope = require('./chat-envelope');
const providerUtils = require('./provider-utils');
// 第十六阶段新增
const nodeMatch = require('./node-match');
const avatarPolicy = require('./avatar-policy');
const usageAggregates = require('./usage-aggregates');
const runWithConcurrency = require('./run-with-concurrency');
const withTimeout = require('./with-timeout');
const safeJson = require('./safe-json');
// 第十七阶段新增
const secureRandom = require('./secure-random');
const spawnUtils = require('./spawn-utils');

// 版本信息
const VERSION = '1.0.0';

// 获取所有模块
function getModules() {
  return {
    desktop: Object.keys(desktop).filter(k => typeof desktop[k] === 'function'),
    browser: Object.keys(browser).filter(k => typeof browser[k] === 'function'),
    files: Object.keys(files).filter(k => typeof files[k] === 'function'),
    session: Object.keys(session).filter(k => typeof session[k] === 'function'),
    channel: Object.keys(channel).filter(k => typeof channel[k] === 'function'),
    summarize: Object.keys(summarize).filter(k => typeof summarize[k] === 'function'),
    agents: Object.keys(agents).filter(k => typeof agents[k] === 'function'),
    autonomous: Object.keys(autonomous).filter(k => typeof autonomous[k] === 'function'),
    decision: Object.keys(decision).filter(k => typeof decision[k] === 'function'),
    heartbeat: Object.keys(heartbeat).filter(k => typeof heartbeat[k] === 'function'),
    improve: Object.keys(improve).filter(k => typeof improve[k] === 'function'),
    lobster: Object.keys(lobster).filter(k => typeof lobster[k] === 'function'),
    sandbox: Object.keys(sandbox).filter(k => typeof sandbox[k] === 'function'),
    selfrepair: Object.keys(selfrepair).filter(k => typeof selfrepair[k] === 'function'),
    skills: Object.keys(skills).filter(k => typeof skills[k] === 'function'),
    subagent: Object.keys(subagent).filter(k => typeof subagent[k] === 'function'),
    triage: Object.keys(triage).filter(k => typeof triage[k] === 'function'),
    state: Object.keys(state).filter(k => typeof state[k] === 'function'),
    cache: Object.keys(cache).filter(k => typeof cache[k] === 'function'),
    llm: Object.keys(llm).filter(k => typeof llm[k] === 'function'),
    hooks: Object.keys(hooks).filter(k => typeof hooks[k] === 'function'),
    retryPolicy: Object.keys(retryPolicy).filter(k => typeof retryPolicy[k] === 'function'),
    archive: Object.keys(archive).filter(k => typeof archive[k] === 'function'),
    runtimeSystem: Object.keys(runtimeSystem).filter(k => typeof runtimeSystem[k] === 'function'),
    cacheUtils: Object.keys(cacheUtils).filter(k => typeof cacheUtils[k] === 'function'),
    utilsBase: Object.keys(utilsBase).filter(k => typeof utilsBase[k] === 'function'),
    systemUtils: Object.keys(systemUtils).filter(k => typeof systemUtils[k] === 'function'),
    securityUtils: Object.keys(securityUtils).filter(k => typeof securityUtils[k] === 'function'),
    secrets: Object.keys(secrets).filter(k => typeof secrets[k] === 'function'),
    linkExtraction: Object.keys(linkExtraction).filter(k => typeof linkExtraction[k] === 'function'),
    webGateway: Object.keys(webGateway).filter(k => typeof webGateway[k] === 'function'),
    channelsEnhanced: Object.keys(channelsEnhanced).filter(k => typeof channelsEnhanced[k] === 'function'),
    contextEngine: Object.keys(contextEngine).filter(k => typeof contextEngine[k] === 'function'),
    markdown: Object.keys(markdown).filter(k => typeof markdown[k] === 'function'),
    media: Object.keys(media).filter(k => typeof media[k] === 'function'),
    logging: Object.keys(logging).filter(k => typeof logging[k] === 'function'),
    pluginTools: Object.keys(pluginTools).filter(k => typeof pluginTools[k] === 'function'),
    cliFormat: Object.keys(cliFormat).filter(k => typeof cliFormat[k] === 'function'),
    cluster: Object.keys(cluster).filter(k => typeof cluster[k] === 'function'),
    enhancedRetry: Object.keys(enhancedRetry).filter(k => typeof enhancedRetry[k] === 'function'),
    errorHandler: Object.keys(errorHandler).filter(k => typeof errorHandler[k] === 'function'),
    dedupeCache: Object.keys(dedupeCache).filter(k => typeof dedupeCache[k] === 'function'),
    diagnosticEvents: Object.keys(diagnosticEvents).filter(k => typeof diagnosticEvents[k] === 'function'),
    rateLimit: Object.keys(rateLimit).filter(k => typeof rateLimit[k] === 'function'),
    httpGuard: Object.keys(httpGuard).filter(k => typeof httpGuard[k] === 'function'),
    textChunking: Object.keys(textChunking).filter(k => typeof textChunking[k] === 'function'),
    netUtils: Object.keys(netUtils).filter(k => typeof netUtils[k] === 'function'),
    processMonitor: Object.keys(processMonitor).filter(k => typeof processMonitor[k] === 'function'),
    stringUtils: Object.keys(stringUtils).filter(k => typeof stringUtils[k] === 'function'),
    dataValidation: Object.keys(dataValidation).filter(k => typeof dataValidation[k] === 'function'),
    gitUtils: Object.keys(gitUtils).filter(k => typeof gitUtils[k] === 'function'),
    envConfig: Object.keys(envConfig).filter(k => typeof envConfig[k] === 'function'),
    clipboard: Object.keys(clipboard).filter(k => typeof clipboard[k] === 'function'),
    frontmatter: Object.keys(frontmatter).filter(k => typeof frontmatter[k] === 'function'),
    objectSafety: Object.keys(objectSafety).filter(k => typeof objectSafety[k] === 'function'),
    processRestart: Object.keys(processRestart).filter(k => typeof processRestart[k] === 'function'),
    fileAtomic: Object.keys(fileAtomic).filter(k => typeof fileAtomic[k] === 'function'),
    agentEvents: Object.keys(agentEvents).filter(k => typeof agentEvents[k] === 'function'),
    channelActivity: Object.keys(channelActivity).filter(k => typeof channelActivity[k] === 'function'),
    pathResolver: Object.keys(pathResolver).filter(k => typeof pathResolver[k] === 'function'),
    fileSecurity: Object.keys(fileSecurity).filter(k => typeof fileSecurity[k] === 'function'),
    shellEnv: Object.keys(shellEnv).filter(k => typeof shellEnv[k] === 'function'),
    osSummary: Object.keys(osSummary).filter(k => typeof osSummary[k] === 'function'),
    executablePath: Object.keys(executablePath).filter(k => typeof executablePath[k] === 'function'),
    nodeCommands: Object.keys(nodeCommands).filter(k => typeof nodeCommands[k] === 'function'),
    secretFile: Object.keys(secretFile).filter(k => typeof secretFile[k] === 'function'),
    packageJson: Object.keys(packageJson).filter(k => typeof packageJson[k] === 'function'),
    jsonFile: Object.keys(jsonFile).filter(k => typeof jsonFile[k] === 'function'),
    mapSize: Object.keys(mapSize).filter(k => typeof mapSize[k] === 'function'),
    stableNodePath: Object.keys(stableNodePath).filter(k => typeof stableNodePath[k] === 'function'),
    machineName: Object.keys(machineName).filter(k => typeof machineName[k] === 'function'),
    wsl: Object.keys(wsl).filter(k => typeof wsl[k] === 'function'),
    pathPrepend: Object.keys(pathPrepend).filter(k => typeof pathPrepend[k] === 'function'),
    stringSample: Object.keys(stringSample).filter(k => typeof stringSample[k] === 'function'),
    joinSegments: Object.keys(joinSegments).filter(k => typeof joinSegments[k] === 'function'),
    codeRegions: Object.keys(codeRegions).filter(k => typeof codeRegions[k] === 'function'),
    detectPackageManager: Object.keys(detectPackageManager).filter(k => typeof detectPackageManager[k] === 'function'),
    isMain: Object.keys(isMain).filter(k => typeof isMain[k] === 'function'),
    reasoningTags: Object.keys(reasoningTags).filter(k => typeof reasoningTags[k] === 'function'),
    subagentsFormat: Object.keys(subagentsFormat).filter(k => typeof subagentsFormat[k] === 'function'),
    assistantVisibleText: Object.keys(assistantVisibleText).filter(k => typeof assistantVisibleText[k] === 'function'),
    sanitizeText: Object.keys(sanitizeText).filter(k => typeof sanitizeText[k] === 'function'),
    pathGuards: Object.keys(pathGuards).filter(k => typeof pathGuards[k] === 'function'),
    jsonFilesEnhanced: Object.keys(jsonFilesEnhanced).filter(k => typeof jsonFilesEnhanced[k] === 'function'),
    abort: Object.keys(abort).filter(k => typeof abort[k] === 'function'),
    // 第十二阶段新增
    fileLock: Object.keys(fileLock).filter(k => typeof fileLock[k] === 'function'),
    archivePath: Object.keys(archivePath).filter(k => typeof archivePath[k] === 'function'),
    fetchEnhanced: Object.keys(fetchEnhanced).filter(k => typeof fetchEnhanced[k] === 'function'),
    hostEnvSecurity: Object.keys(hostEnvSecurity).filter(k => typeof hostEnvSecurity[k] === 'function'),
    // 第十五阶段新增
    normalizeSecretInput: Object.keys(normalizeSecretInput).filter(k => typeof normalizeSecretInput[k] === 'function'),
    transcriptTools: Object.keys(transcriptTools).filter(k => typeof transcriptTools[k] === 'function'),
    directiveTags: Object.keys(directiveTags).filter(k => typeof directiveTags[k] === 'function'),
    usageFormat: Object.keys(usageFormat).filter(k => typeof usageFormat[k] === 'function'),
    shellArgv: Object.keys(shellArgv).filter(k => typeof shellArgv[k] === 'function'),
    pidAlive: Object.keys(pidAlive).filter(k => typeof pidAlive[k] === 'function'),
    processScopedMap: Object.keys(processScopedMap).filter(k => typeof processScopedMap[k] === 'function'),
    deviceAuth: Object.keys(deviceAuth).filter(k => typeof deviceAuth[k] === 'function'),
    deviceAuthStore: Object.keys(deviceAuthStore).filter(k => typeof deviceAuthStore[k] === 'function'),
    chatContent: Object.keys(chatContent).filter(k => typeof chatContent[k] === 'function'),
    chatEnvelope: Object.keys(chatEnvelope).filter(k => typeof chatEnvelope[k] === 'function'),
    providerUtils: Object.keys(providerUtils).filter(k => typeof providerUtils[k] === 'function'),
    // 第十六阶段新增
    nodeMatch: Object.keys(nodeMatch).filter(k => typeof nodeMatch[k] === 'function'),
    avatarPolicy: Object.keys(avatarPolicy).filter(k => typeof avatarPolicy[k] === 'function'),
    usageAggregates: Object.keys(usageAggregates).filter(k => typeof usageAggregates[k] === 'function'),
    runWithConcurrency: Object.keys(runWithConcurrency).filter(k => typeof runWithConcurrency[k] === 'function'),
    withTimeout: Object.keys(withTimeout).filter(k => typeof withTimeout[k] === 'function'),
    safeJson: Object.keys(safeJson).filter(k => typeof safeJson[k] === 'function'),
    // 第十七阶段新增
    secureRandom: Object.keys(secureRandom).filter(k => typeof secureRandom[k] === 'function'),
    spawnUtils: Object.keys(spawnUtils).filter(k => typeof spawnUtils[k] === 'function')
  };
}

// 系统状态
function getSystemStatus() {
  const start = Date.now();
  const os = require('os');
  
  return {
    status: 'ok',
    version: VERSION,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    cpuCount: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
    freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + 'GB',
    uptime: Math.round(process.uptime()) + 's',
    modules: Object.keys(getModules()).length,
    time: Date.now() - start
  };
}

// 完整功能列表
function getCapabilities() {
  return {
    desktop: ['mouse', 'keyboard', 'screen', 'window', 'clipboard', 'screenshot'],
    browser: ['init', 'navigate', 'click', 'fill', 'getText', 'getContent', 'screenshot', 'wait', 'evaluate', 'saveState', 'loadState', 'getCookies', 'setCookies', 'close', 'getPage', 'newPage', 'getPages', 'switchPage', 'closePage', 'doubleClick', 'hover', 'drag', 'scroll', 'pressKey', 'fillForm', 'uploadFile', 'getConsoleMessages', 'getPageErrors', 'getNetworkRequests', 'clearMonitoringData', 'startPerformanceTrace', 'stopPerformanceTrace', 'getPerformanceMetrics', 'setViewport', 'setGeolocation', 'clearGeolocation', 'setTimezone', 'setLocale', 'setColorScheme', 'setOffline', 'emulateDevice', 'getAvailableDevices', 'exportPdf', 'launchPersistentContext'],
    files: ['scan', 'read', 'write', 'tree', 'search', 'copy', 'remove'],
    session: ['create', 'load', 'addMessage', 'getMessages', 'list', 'remove', 'exportSession', 'compress'],
    channel: ['sendTelegram', 'sendWebhook', 'sendDiscord', 'sendSlack', 'notify', 'config'],
    summarize: ['extractUrl', 'extractFile', 'summarizeText', 'summarizeBatch', 'status'],
    agents: ['assign', 'dispatch', 'collaborate', 'listTypes', 'defineRole', 'removeRole', 'selectModel'],
    autonomous: ['start', 'stop', 'getStatus', 'recordAction', 'setGoal'],
    decision: ['make', 'updatePreference', 'getPreferences', 'getHistory', 'clearHistory'],
    heartbeat: ['beat', 'getLastBeat', 'startInterval', 'stopInterval', 'healthCheck', 'productivity', 'updateProductivity', 'setConfig', 'getConfig', 'getTradingLog', 'runAnalysis', 'manualTrade', 'getQuotes', 'getPanwatchHoldings', 'easythsBuy', 'easythsSell', 'easythsHolding', 'registerSkill', 'unregisterSkill', 'getSkills', 'enableSkill', 'updateSkillConfig', 'triggerSkill'],
    improve: ['recordLearning', 'recordError', 'queryLearnings', 'updateConfidence', 'detectPatterns', 'suggestImprovements', 'reflect', 'stats', 'getPromotionStatus', 'checkAndPromote'],
    lobster: ['run', 'resume', 'list', 'state', 'cancel', 'addStep', 'where', 'pick', 'head', 'tail', 'map', 'sort', 'dedupe', 'groupBy', 'count', 'sum', 'avg', 'pipe', 'approve', 'respond'],
    sandbox: ['execute', 'shell', 'runScript', 'createIsolation', 'cleanup', 'listSandboxes'],
    selfrepair: ['check', 'repair', 'getState', 'reset', 'logError', 'getHistory'],
    skills: ['search', 'install', 'list', 'info', 'uninstall', 'execute', 'recommend', 'update'],
    subagent: ['plan', 'delegate', 'delegateParallel', 'report', 'status', 'review', 'aggregate', 'cancel', 'templates', 'autoDelegate', 'assessComplexity'],
    triage: ['classify', 'prioritize', 'getHistory', 'getStats', 'batchClassify'],
    state: ['get', 'set', 'list', 'delete', 'clear', 'exportState', 'importState'],
    cache: ['get', 'set', 'delete', 'clear', 'cleanup', 'stats', 'hash', 'has'],
    llm: ['invoke', 'stream', 'batch', 'embed', 'clearCache', 'cacheStats'],
    hooks: ['register', 'trigger', 'unregister', 'list', 'toggle', 'clear', 'getTypes'],
    retryPolicy: ['createRetryConfig', 'calculateRetryDelay', 'shouldRetry', 'extractRetryAfter', 'retryAsync', 'retryWithTimeout'],
    archive: ['createArchive', 'extractArchive', 'listArchives', 'deleteArchive', 'formatBytes'],
    runtimeSystem: ['enqueueSystemEvent', 'getSystemEvents', 'clearSystemEvents', 'requestHeartbeatNow', 'runCommandWithTimeout', 'formatNativeDependencyHint', 'getRuntimeStatus', 'saveRuntimeSnapshot'],
    cacheUtils: ['resolveCacheTtlMs', 'isCacheEnabled', 'getCacheKey', 'getCachePath', 'getFileStatSnapshot', 'get', 'set', 'del', 'clear', 'stats', 'cleanup', 'formatBytes'],
    utilsBase: ['chunkItems', 'runTasksWithConcurrency', 'withTimeout', 'safeJsonStringify', 'safeJsonParse', 'maskApiKey', 'deepClone', 'deduplicate', 'delay', 'randomString', 'uuid', 'isValidUrl', 'isValidEmail'],
    systemUtils: ['tryListenOnPort', 'ensurePortAvailable', 'findAvailablePort', 'getProcessInfo', 'enqueueSystemEvent', 'getSystemEvents', 'isSystemEventContextChanged', 'clearSystemEvents', 'copyToClipboard', 'substituteEnvVars', 'deepSubstituteEnvVars', 'spawnCommand', 'spawnCommandSync', 'acquireFileLock', 'releaseFileLock', 'getSystemInfo', 'getNetworkInterfaces', 'normalizePath', 'isPathInside', 'normalizeWindowsPath', 'CommandQueueManager', 'CommandLane', 'enqueueCommand', 'clearCommandLane', 'getCommandLaneStatus', 'getAllCommandLaneStatus', 'setGatewayDraining', 'isProcessAlive', 'killProcessTree', 'killProcessTreeWindows', 'killProcessTreeUnix', 'runCommandsConcurrent'],
    securityUtils: ['isAbsolutePath', 'hasPathTraversal', 'isDangerousPath', 'validatePath', 'isLikelyPath', 'isSafeExecutableValue', 'validateCommandArgs', 'sanitizeInput', 'isValidFilename', 'isValidJson', 'isValidInteger', 'isValidPort', 'isSafeRegExp', 'isDangerousKey', 'sanitizeObjectKeys', 'RateLimiter', 'containsSensitiveContent', 'maskSensitiveContent', 'escapeRegExp'],
    secrets: ['getSecretsDir', 'getSecretPath', 'storeSecret', 'getSecret', 'deleteSecret', 'listSecrets', 'getSecretFromEnv', 'getSecretsFromEnv', 'resolveSecretRefs', 'deepResolveSecretRefs', 'maskSecretValue', 'maskSecretsInObject', 'isValidSecretName', 'isValidSecretRef', 'getSecretAudit'],
    linkExtraction: ['extractLinksFromMessage', 'stripMarkdownLinks', 'isAllowedUrl', 'isBlockedHostname', 'fetchLinkContent', 'fetchMultipleLinks', 'extractLinkSummary', 'formatLinkAsMarkdown', 'processLinksInMessage'],
    webGateway: ['start', 'stop', 'getStatus', 'createServer', 'handleRequest'],
    channelsEnhanced: ['loadConfig', 'saveConfig', 'getDefaultConfig', 'addRoute', 'setRoute', 'createSession', 'getSession', 'updateSession', 'deleteSession', 'addMessage', 'getMessageHistory', 'bindMessageToSession', 'addRole', 'addUserPermissions', 'hasPermission', 'setUserRole', 'generateMessageId', 'isSeen', 'markSeen', 'normalizeAccountId', 'normalizeOptionalAccountId', 'lookupAccount', 'findMatches', 'findBestMatch', 'listBoundAccounts', 'trackProvenance', 'applyToMessage', 'setSendPolicy', 'resolvePolicy', 'isAllowed', 'emitTranscriptUpdate', 'onTranscriptUpdate'],
    contextEngine: ['ContextEngine', 'InMemoryContextEngine', 'ContextManager', 'createContext', 'getContext', 'deleteContext', 'addMessage', 'getMessages', 'clearContext', 'estimateTokens', 'selectRelevantMessages', 'compactContext'],
    markdown: ['parseFrontmatter', 'generateFrontmatter', 'renderToHtml', 'renderToPlainText', 'generateMarkdown', 'extractHeaders', 'extractLinks', 'extractCodeBlocks', 'validateMarkdown'],
    media: ['getMimeType', 'getExtensionFromMime', 'fileToBase64', 'base64ToFile', 'detectBase64Mime', 'getImageInfo', 'isValidImageFormat', 'validateMediaFile', 'checkFileSizeLimit', 'formatFileSize', 'extractMediaMetadata', 'getMediaStoragePath', 'generateUniqueFileName', 'generateStoragePath', 'saveMediaFile', 'saveBase64Media', 'deleteMediaFile'],
    logging: ['LOG_LEVELS', 'LOG_LEVEL_NAMES', 'getLogLevelValue', 'shouldLog', 'formatTimestamp', 'redactSensitiveInfo', 'redactObject', 'formatLogEntry', 'formatAsText', 'formatAsJson', 'Logger', 'getLogger', 'setLogger', 'createSubsystemLogger', 'debug', 'info', 'warn', 'error', 'fatal'],
    pluginTools: ['KeyedAsyncQueue', 'enqueue', 'getStatus', 'clear', 'size', 'PersistentDeduper', 'checkAndRecord', 'warmup', 'clearMemory', 'memorySize', 'TextChunker', 'chunk', 'chunkBySentence', 'chunkByParagraph', 'RuntimeStore', 'getStore', 'set', 'get', 'delete', 'has', 'clear', 'clearAll', 'keys', 'values', 'entries', 'size', 'SSRFProtection', 'isBlocked', 'addBlockedHost', 'removeBlockedHost', 'addAllowedScheme'],
    cliFormat: ['ansiColor', 'colorize', 'stripAnsi', 'visibleWidth', 'splitGraphemes', 'Palette', 'use', 'custom', 'useCustom', 'TableRenderer', 'render', 'ProgressBar', 'render', 'update', 'complete', 'SafeText', 'sanitize', 'escape', 'truncate', 'truncateWords', 'Theme', 'setTheme', 'getTheme', 'use', 'PALETTES'],
    cluster: ['loadConfig', 'saveConfig', 'addNode', 'removeNode', 'listNodes', 'testNode', 'execOnNode', 'broadcast', 'status', 'uploadFile'],
    utilsBase: ['chunkItems', 'runTasksWithConcurrency', 'withTimeout', 'safeJsonStringify', 'safeJsonParse', 'maskApiKey', 'deepClone', 'deduplicate', 'delay', 'randomString', 'uuid', 'isValidUrl', 'isValidEmail', 'resolveTimezone', 'formatUtcTimestamp', 'formatZonedTimestamp', 'formatDurationSeconds', 'formatDurationPrecise', 'formatDurationCompact', 'formatTimeAgo', 'formatRelativeTimestamp'],
    // 第十二阶段新增 - OpenClaw 模块
    fileLock: ['acquireFileLock', 'withFileLock', 'isPidAlive', 'DEFAULT_FILE_LOCK_OPTIONS'],
    archivePath: ['isWindowsDrivePath', 'normalizeArchiveEntryPath', 'validateArchiveEntryPath', 'stripArchivePath', 'resolveArchiveOutputPath', 'resolveArchiveKind', 'DEFAULT_MAX_ARCHIVE_BYTES_ZIP', 'DEFAULT_MAX_ENTRIES', 'DEFAULT_MAX_EXTRACTED_BYTES', 'DEFAULT_MAX_ENTRY_BYTES'],
    fetchEnhanced: ['fetchWithTimeout', 'wrapFetchWithAbortSignal', 'resolveFetch', 'createFetchWithPreconnect', 'getEnhancedFetch', 'setEnhancedFetch', 'bindAbortRelay'],
    hostEnvSecurity: ['normalizeEnvVarKey', 'isDangerousHostEnvVarName', 'isDangerousHostEnvOverrideVarName', 'sanitizeHostExecEnv', 'createSafeEnv', 'SECURITY_POLICY', 'HOST_DANGEROUS_ENV_KEY_VALUES', 'HOST_DANGEROUS_ENV_PREFIXES', 'HOST_DANGEROUS_OVERRIDE_ENV_KEY_VALUES', 'HOST_DANGEROUS_OVERRIDE_ENV_PREFIXES', 'HOST_SHELL_WRAPPER_ALLOWED_OVERRIDE_ENV_KEY_VALUES', 'HOST_DANGEROUS_ENV_KEYS', 'HOST_DANGEROUS_OVERRIDE_ENV_KEYS', 'HOST_SHELL_WRAPPER_ALLOWED_OVERRIDE_ENV_KEYS'],
    // 第十五阶段新增
    normalizeSecretInput: ['normalizeSecretInput', 'normalizeOptionalSecretInput'],
    transcriptTools: ['extractToolCallNames', 'hasToolCall', 'countToolResults'],
    directiveTags: ['stripInlineDirectiveTagsForDisplay', 'stripInlineDirectiveTagsFromMessageForDisplay', 'parseInlineDirectives'],
    usageFormat: ['formatTokenCount', 'formatUsd', 'resolveModelCostConfig', 'estimateUsageCost'],
    shellArgv: ['splitShellArgs'],
    pidAlive: ['isPidAlive', 'getProcessStartTime'],
    processScopedMap: ['resolveProcessScopedMap'],
    deviceAuth: ['normalizeDeviceAuthRole', 'normalizeDeviceAuthScopes'],
    deviceAuthStore: ['loadDeviceAuthTokenFromStore', 'storeDeviceAuthTokenInStore', 'clearDeviceAuthTokenFromStore'],
    chatContent: ['extractTextFromChatContent'],
    chatEnvelope: ['stripEnvelope', 'stripMessageIdHints'],
    providerUtils: ['isReasoningTagProvider'],
    // 第十六阶段新增
    nodeMatch: ['normalizeNodeKey', 'resolveNodeMatches', 'resolveNodeIdFromCandidates'],
    avatarPolicy: ['AVATAR_MAX_BYTES', 'resolveAvatarMime', 'isAvatarDataUrl', 'isAvatarImageDataUrl', 'isAvatarHttpUrl', 'hasAvatarUriScheme', 'isWindowsAbsolutePath', 'isWorkspaceRelativeAvatarPath', 'isPathWithinRoot', 'looksLikeAvatarPath', 'isSupportedLocalAvatarExtension'],
    usageAggregates: ['mergeUsageLatency', 'mergeUsageDailyLatency', 'buildUsageAggregateTail'],
    runWithConcurrency: ['runTasksWithConcurrency'],
    withTimeout: ['withTimeout'],
    safeJson: ['safeJsonStringify'],
    // 第十七阶段新增 - OpenClaw 模块
    secureRandom: ['generateSecureUuid', 'generateSecureToken', 'generateSecureHex', 'generateSecureRandomInt', 'generateSecureRandomString'],
    spawnUtils: ['resolveCommandStdio', 'formatSpawnError', 'isProcessAlive', 'spawnWithFallback', 'spawnWithTimeout', 'DEFAULT_RETRY_CODES'],
    // 补充缺失模块描述
    netUtils: ['isValidIPv4', 'isValidIPv6', 'isValidIP', 'isPrivateIPv4', 'isLoopback', 'getSpecialUseType', 'isInRange', 'parseHostname', 'normalizeHostname', 'isInternalHostname', 'parseURL', 'getURLPort', 'buildURL', 'stripIpv6Brackets', 'createNetmask'],
    stringUtils: ['normalizeStringEntries', 'normalizeStringEntriesLower', 'normalizeHyphenSlug', 'normalizeAtHashSlug', 'capitalize', 'titleize', 'camelize', 'pascalize', 'snakeize', 'kebabize', 'truncate', 'truncateWords', 'escapeHtml', 'unescapeHtml', 'isBlank', 'isNotBlank', 'trim', 'trimStart', 'trimEnd', 'removeAllWhitespace', 'normalizeWhitespace', 'reverse', 'repeat', 'pad', 'padStart', 'padEnd', 'slugify', 'includesIgnoreCase', 'startsWithIgnoreCase', 'endsWithIgnoreCase', 'replaceAllIgnoreCase', 'toString', 'toSafeString', 'format'],
    machineName: ['getMachineDisplayName', 'getMachineDisplayNameSync', 'getHostname', 'getShortHostname', 'getMachineType', 'getMachineId', 'isLocalhost', 'getMachineInfo', 'clearMachineNameCache'],
    reasoningTags: ['stripReasoningTagsFromText', 'stripRelevantMemoriesTags'],
    subagentsFormat: ['formatDurationCompact', 'formatTokenShort', 'truncateLine', 'resolveTotalTokens', 'resolveIoTokens', 'formatTokenUsageDisplay']
  };
}

// 导出
module.exports = {
  VERSION,
  // 核心模块
  desktop,
  browser,
  files,
  session,
  channel,
  summarize,
  // 高级模块
  agents,
  autonomous,
  decision,
  heartbeat,
  improve,
  lobster,
  sandbox,
  selfrepair,
  skills,
  subagent,
  triage,
  state,
  cache,
  llm,
  hooks,
  // 工具模块
  retryPolicy,
  archive,
  runtimeSystem,
  cacheUtils,
  utilsBase,
  systemUtils,
  securityUtils,
  secrets,
  linkExtraction,
  webGateway,
  channelsEnhanced,
  contextEngine,
  markdown,
  media,
  logging,
  pluginTools,
  cliFormat,
  cluster,
  // 增强模块
  enhancedRetry,
  errorHandler,
  dedupeCache,
  diagnosticEvents,
  // 第二阶段新增
  rateLimit,
  httpGuard,
  textChunking,
  // 第三阶段新增
  netUtils,
  processMonitor,
  stringUtils,
  // 第四阶段新增
  dataValidation,
  gitUtils,
  envConfig,
  clipboard,
  frontmatter,
  objectSafety,
  processRestart,
  // 第五阶段新增
  fileAtomic,
  agentEvents,
  channelActivity,
  pathResolver,
  // 第六阶段新增
  fileSecurity,
  shellEnv,
  osSummary,
  executablePath,
  nodeCommands,
  // 第七阶段新增
  secretFile,
  packageJson,
  jsonFile,
  mapSize,
  stableNodePath,
  machineName,
  // 第八阶段新增
  wsl,
  pathPrepend,
  stringSample,
  // 第九阶段新增
  joinSegments,
  codeRegions,
  detectPackageManager,
  isMain,
  // 第十阶段新增
  reasoningTags,
  subagentsFormat,
  assistantVisibleText,
  // 第十一阶段新增
  sanitizeText,
  pathGuards,
  jsonFilesEnhanced,
  abort,
  // 第十二阶段新增 - OpenClaw 模块
  fileLock,
  archivePath,
  fetchEnhanced,
  hostEnvSecurity,
  // 第十三阶段新增
  processRespawn,
  gitRootEnhanced,
  tempPath,
  envManage,
  runtimeEnv,
  jsonStoreEnhanced,
  // 第十四阶段新增
  configEval,
  requirementsEval,
  stringNormalization,
  queueHelpers,
  frontmatterSimple,
  // 第十五阶段新增
  normalizeSecretInput,
  transcriptTools,
  directiveTags,
  usageFormat,
  shellArgv,
  pidAlive,
  processScopedMap,
  deviceAuth,
  deviceAuthStore,
  chatContent,
  chatEnvelope,
  providerUtils,
  // 第十六阶段新增
  nodeMatch,
  avatarPolicy,
  usageAggregates,
  runWithConcurrency,
  withTimeout,
  safeJson,
  // 第十七阶段新增
  secureRandom,
  spawnUtils,
  // 工具函数
  getModules,
  getSystemStatus,
  getCapabilities
};