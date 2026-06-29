export const logger = {
  info(event, meta = {}) {
    console.log(JSON.stringify({
      level: 'INFO',
      event,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  warn(event, meta = {}) {
    console.warn(JSON.stringify({
      level: 'WARN',
      event,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  error(event, meta = {}) {
    console.error(JSON.stringify({
      level: 'ERROR',
      event,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};
