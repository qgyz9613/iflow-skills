/**
 * Abort Utility Module
 * 中止信号检查模块
 */

/**
 * Throws an AbortError if the given signal has been aborted.
 * Use at async checkpoints to support cancellation.
 * @param {AbortSignal} abortSignal - 中止信号
 * @throws {Error} AbortError when signal is aborted
 */
function throwIfAborted(abortSignal) {
  if (abortSignal?.aborted) {
    const err = new Error('Operation aborted');
    err.name = 'AbortError';
    throw err;
  }
}

/**
 * Wait for abort signal
 * @param {AbortSignal} signal - 中止信号
 * @returns {Promise<void>}
 */
async function waitForAbortSignal(signal) {
  if (!signal || signal.aborted) {
    return;
  }
  await new Promise(resolve => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

module.exports = {
  throwIfAborted,
  waitForAbortSignal
};