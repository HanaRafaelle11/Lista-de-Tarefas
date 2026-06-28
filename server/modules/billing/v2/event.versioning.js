/**
 * Event Versioning Module (V2)
 * 
 * Padroniza a criação e interpretação de eventos financeiros com suporte explicito a versões.
 */

export function createVersionedEvent({ eventId, eventType, payload, source, idempotencyKey, version = '2.0' }) {
  const now = new Date().toISOString();
  const resolvedId = eventId || `evt_v2_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  return {
    eventId: resolvedId,
    eventType: eventType || 'unknown_event',
    version: version || '2.0',
    payload: payload || {},
    source: source || 'system',
    idempotencyKey: idempotencyKey || resolvedId,
    createdAt: now
  };
}

export function parseEventVersion(eventObj) {
  if (!eventObj) return '1.0';
  return eventObj.version || '1.0';
}
