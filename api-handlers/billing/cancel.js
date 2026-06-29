import { supabaseAdmin } from '../../lib/supabase.js';
import { AsaasGateway } from '../../lib/paymentGateway/asaas.js';
import { BillingEngine } from '../../lib/billing/engine.js';
import { logger } from '../../services/logger/index.js';

export default async function handler(req, res) {
  const start = Date.now();
  const userId = req.body?.userId || req.query?.userId;

  if (!userId) {
    return res.status(400).json({ error: 'userId é obrigatório' });
  }

  try {
    // 1. Buscar a assinatura ativa do usuário
    const { data: sub, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (subError) throw subError;

    // 2. Se houver id de assinatura do Asaas ativo e não for simulado, cancelamos no gateway
    if (sub?.asaas_subscription_id && !sub.asaas_subscription_id.startsWith('sub_simulated_')) {
      logger.info('api.billing.cancel.gateway_cancel', { userId, subscriptionId: sub.asaas_subscription_id });
      await AsaasGateway.cancelSubscription(sub.asaas_subscription_id);
    }

    // 3. Processar cancelamento local no BillingEngine (SSOT)
    await BillingEngine.processSubscriptionCanceled({ userId, reason: 'canceled' });

    logger.info('api.billing.cancel.success', { userId, latency: Date.now() - start });
    return res.status(200).json({ success: true, message: 'Assinatura cancelada com sucesso.' });
  } catch (err) {
    logger.error('api.billing.cancel.error', { userId, latency: Date.now() - start, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
