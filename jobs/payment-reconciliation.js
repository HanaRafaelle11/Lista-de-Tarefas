import { supabaseAdmin } from '../lib/supabase.js';
import { BillingEngine } from '../lib/billing/engine.js';
import { PaymentGateway } from '../lib/paymentGateway/index.js';

export async function runReconciliation() {
  console.log('[Reconciliation] Iniciando conciliação via Asaas...');
  let fixedCount = 0;

  try {
    const { data: pendingPayments, error: dbError } = await supabaseAdmin
      .from('billing_events')
      .select('payment_id, status, user_id')
      .in('status', ['created', 'pending', 'in_process']);

    if (dbError) {
      return { success: false, error: dbError.message };
    }

    for (const p of pendingPayments || []) {
      if (!p.payment_id) continue;
      try {
        const asaasPayment = await PaymentGateway.getPayment(p.payment_id);
        if (asaasPayment && (asaasPayment.status === 'RECEIVED' || asaasPayment.status === 'CONFIRMED')) {
          await BillingEngine.processPaymentSuccess({
            userId: p.user_id,
            customerId: asaasPayment.customer,
            paymentId: p.payment_id,
            billingType: asaasPayment.billingType || 'pix',
            value: asaasPayment.value
          });
          fixedCount++;
        }
      } catch (_) {}
    }

    return { success: true, fixedCount };
  } catch (err) {
    console.error('[Reconciliation Error]', err.message);
    return { success: false, error: err.message };
  }
}
