/**
 * Billing Mapper — Antídoto Contra Caos Futuro
 * 
 * Mapeia e normaliza registros brutos do banco de dados nos contratos estáveis DTO.
 */

function normalizeType(typeStr) {
  if (!typeStr) return 'payment';
  const t = String(typeStr).toLowerCase().trim();
  if (t.includes('refund') || t.includes('estorno')) return 'refund';
  if (t.includes('sub') || t.includes('assinatura')) return 'subscription';
  if (t.includes('chargeback')) return 'chargeback';
  return 'payment';
}

function normalizeStatus(statusStr) {
  if (!statusStr) return 'pending';
  const s = String(statusStr).toLowerCase().trim();
  if (s === 'active' || s === 'paid' || s === 'received' || s === 'confirmed' || s === 'success') return 'paid';
  if (s === 'failed' || s === 'canceled' || s === 'expired') return 'failed';
  return 'pending';
}

export function mapBillingEvent(e) {
  if (!e) return null;
  const val = Number(e.amount ?? e.value ?? 0);
  return {
    id: e.id || '',
    userId: e.user_id || '',
    type: normalizeType(e.event_type || e.type),
    status: normalizeStatus(e.status),
    amount: val,
    currency: e.currency || 'BRL',
    provider: e.provider || e.gateway || 'asaas',
    createdAt: e.created_at || new Date().toISOString(),
    raw: e
  };
}

export function mapBillingEvents(events = []) {
  return (events || []).map(mapBillingEvent).filter(Boolean);
}

export function mapBillingLedger(l) {
  if (!l) return null;
  return {
    id: l.id || '',
    userId: l.user_id || '',
    balanceChange: Number(l.balance_change ?? 0),
    reason: l.reason || '',
    referenceId: l.reference_id || '',
    createdAt: l.created_at || new Date().toISOString(),
    raw: l
  };
}

export function mapBillingLedgers(ledgerList = []) {
  return (ledgerList || []).map(mapBillingLedger).filter(Boolean);
}
