/**
 * Billing Adapter - Unified Compatibility Layer
 * 
 * Abstrai e normaliza variações de gateways (Asaas, Mercado Pago, Stripe),
 * mapeando IDs de pagamento, status de assinaturas e valores para uma interface única.
 */

export const BillingAdapter = {
  /**
   * Normaliza um objeto de assinatura para garantir campos consistentes em dashboards e serviços.
   */
  normalizeSubscription(sub) {
    if (!sub) return null;

    const normalizedStatus = this.normalizeStatus(sub.status);
    const normalizedPrice = Number(sub.amount || sub.price || sub.value || 0);
    const normalizedGateway = (sub.gateway || 'asaas').toLowerCase();

    return {
      id: sub.id || sub.user_id,
      userId: sub.user_id,
      plan: (sub.plan || 'free').toLowerCase(),
      status: normalizedStatus,
      price: normalizedPrice,
      amount: normalizedPrice,
      billingType: sub.billing_type || 'pix',
      autoRenew: Boolean(sub.auto_renew),
      currentPeriodStart: sub.current_period_start || sub.created_at,
      currentPeriodEnd: sub.current_period_end || sub.expires_at,
      gateway: normalizedGateway,
      customerId: sub.asaas_customer_id,
      subscriptionId: sub.asaas_subscription_id,
      lastPaymentId: sub.last_payment_id || sub.payment_id,
      createdAt: sub.created_at,
      updatedAt: sub.updated_at
    };
  },

  /**
   * Normaliza status brutos de diferentes gateways para o padrão do Flowday.
   * Padrão Flowday: 'active' | 'expired' | 'canceled' | 'past_due' | 'pending'
   */
  normalizeStatus(rawStatus) {
    if (!rawStatus) return 'pending';
    const s = String(rawStatus).toLowerCase().trim();

    if (['active', 'approved', 'authorized', 'received', 'confirmed'].includes(s)) {
      return 'active';
    }
    if (['past_due', 'overdue', 'in_process', 'pending', 'waiting_payment'].includes(s)) {
      return 'past_due';
    }
    if (['canceled', 'cancelled', 'refunded', 'deleted', 'charged_back'].includes(s)) {
      return 'canceled';
    }
    if (['expired', 'inactive'].includes(s)) {
      return 'expired';
    }
    return s;
  },

  /**
   * Normaliza eventos de cobrança/ledger para exibição uniforme.
   */
  normalizeBillingEvent(evt) {
    if (!evt) return null;

    const paymentId = evt.payment_id || evt.asaas_payment_id || evt.reference_id || evt.resource_id;
    const value = Number(evt.value || evt.amount || evt.balance_change || 0);

    return {
      id: evt.id,
      userId: evt.user_id,
      eventType: evt.event_type || evt.type || 'payment_event',
      paymentId: paymentId,
      subscriptionId: evt.subscription_id,
      value: value,
      amount: value,
      status: this.normalizeStatus(evt.status),
      gateway: evt.provider || evt.gateway || 'asaas',
      createdAt: evt.created_at || evt.processed_at
    };
  }
};
