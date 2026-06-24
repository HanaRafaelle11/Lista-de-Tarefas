export const BillingTracer = {
  async runWithTrace(id, fn) { return await fn(); },
  async recordTrace(data) { console.log('[BillingTracer Record]', data); }
};

export const BillingLogger = {
  info: (msg, id, extra, obj) => console.log('[BillingInfo: ' + msg + ']', obj || ''),
  warn: (msg, id, extra, obj) => console.warn('[BillingWarn: ' + msg + ']', obj || ''),
  error: (msg, id, extra, err, obj) => console.error('[BillingError: ' + msg + ']', err, obj || '')
};