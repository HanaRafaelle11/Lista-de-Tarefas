import { supabaseAdmin } from '../../lib/supabase.js';
import { BillingEngine } from '../../lib/billing/engine.js';
import { logPaymentEvent } from '../../lib/payment-logger.js';
import { PLAN_PREMIUM_MONTHLY_PRICE } from '../../lib/billing/config.js';
import { RateLimiter } from '../../server/modules/rpl/rate-limiter.js';
import { CircuitBreakerFactory } from '../../server/modules/rpl/circuit-breaker.js';
import { WebhookQueue } from '../../server/modules/rpl/webhook-queue.js';

const webhookBreaker = CircuitBreakerFactory.getBreaker('asaas-webhook-db', { failureThreshold: 0.3, cooldownMs: 30000 });

export default async function handler(req, res) {
  // CORS & Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, asaas-access-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  // 0. RPL LAYER: RATE LIMITING (Max 30 reqs/min por IP)
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const rlCheck = RateLimiter.check(`webhook_${clientIp}`, { maxRequests: 30, windowMs: 60000 });
  if (!rlCheck.allowed) {
    res.setHeader('Retry-After', Math.ceil(rlCheck.resetMs / 1000));
    return res.status(429).json({ error: true, message: 'Too Many Requests. Limite de requisições excedido.' });
  }

  const startTime = Date.now();

  try {
    // 1. AUTENTICAÇÃO DE SEGURANÇA ESTRITA (SOMENTE ASAAS_WEBHOOK_TOKEN)
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
    const receivedToken = req.headers['asaas-access-token'] || req.headers['access_token'];

    if (webhookToken) {
      if (!receivedToken || receivedToken !== webhookToken) {
        console.warn('[ASAAS WEBHOOK AUTH FAIL] Tentativa de acesso não autorizada.', {
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          receivedTokenPartial: receivedToken ? `${receivedToken.substring(0, 4)}***` : 'null',
          timestamp: new Date().toISOString()
        });
        return res.status(401).json({ error: true, message: 'Não autorizado. Token de webhook inválido.' });
      }
    }

    const body = req.body || {};
    const event = body.event || body.type;
    const payment = body.payment || body.data || {};
    const subscription = body.subscription || {};

    const paymentId = payment.id || body.id;
    const subscriptionId = payment.subscription || subscription.id || body.subscriptionId;
    const externalReference = payment.externalReference || subscription.externalReference || body.externalReference;
    const customerId = payment.customer || subscription.customer;
    const billingType = payment.billingType || subscription.billingType || 'PIX';

    console.log('[ASAAS WEBHOOK RECEIVED]', {
      event,
      paymentId,
      subscriptionId,
      customerId,
      billingType,
      externalReference,
      timestamp: new Date().toISOString()
    });

    // Observability: log do recebimento do webhook (antes de qualquer processamento)
    logPaymentEvent({
      userId: null,
      subscriptionId: subscriptionId || null,
      paymentId: paymentId || null,
      customerId: customerId || null,
      gateway: 'asaas',
      status: 'pending',
      event: 'webhook_received',
      payload: { event, billingType, externalReference },
      source: 'webhook'
    }).catch(() => {});

    if (!event) {
      return res.status(200).json({ message: 'Evento ignorado por falta de tipo de evento.' });
    }

    // 2. CORRIGIR WEBHOOK IDEMPOTÊNCIA (event_id DETERMINÍSTICO E IMUTÁVEL)
    const eventId = body.id 
      ? String(body.id) 
      : `${event}_${paymentId || subscriptionId || 'none'}`;

    try {
      const { data: alreadyProcessed, error: checkErr } = await supabaseAdmin
        .from('webhook_events')
        .select('id, status')
        .eq('event_id', eventId)
        .maybeSingle();

      if (checkErr) {
        console.error('[ASAAS WEBHOOK DB ERROR Check Idempotency]', checkErr);
      }

      if (alreadyProcessed) {
        console.log(`[ASAAS WEBHOOK IDEMPOTENT] Evento ${eventId} já processado anteriormente.`);
        return res.status(200).json({ message: 'Evento já processado.', idempotent: true });
      }
    } catch (checkEx) {
      console.error('[ASAAS WEBHOOK EXCEPTION Check Idempotency]', checkEx);
    }

    // 3. IDENTIFICAÇÃO DO USUÁRIO (Multi-Layer Resolution)
    let userId = null;
    if (externalReference) {
      if (externalReference.startsWith('mfd_pix_')) {
        // Formato: mfd_pix_USERID_YYYY-MM-DD
        const parts = externalReference.split('_');
        if (parts.length >= 3) userId = parts[2];
      } else if (externalReference.startsWith('mfd_premium_')) {
        userId = externalReference.replace('mfd_premium_', '');
      } else if (externalReference.startsWith('mfd_')) {
        const parts = externalReference.split('_');
        if (parts.length >= 2) userId = parts[1];
      } else if (externalReference.startsWith('order_')) {
        const parts = externalReference.split('_');
        if (parts.length >= 2) userId = parts[1];
      }
    }

    // Fallback 1: Busca na tabela de assinaturas por subscriptionId, paymentId ou externalReference
    if (!userId) {
      try {
        const targetRef = externalReference || paymentId || subscriptionId;
        if (targetRef) {
          const { data: subRow, error: subErr } = await supabaseAdmin
            .from('subscriptions')
            .select('user_id')
            .or(`asaas_subscription_id.eq.${targetRef},provider_id.eq.${targetRef},idempotency_key.eq.${targetRef}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (subErr) console.error('[ASAAS WEBHOOK DB ERROR Find Sub User]', subErr);
          userId = subRow?.user_id || null;
        }
      } catch (subEx) {
        console.error('[ASAAS WEBHOOK EXCEPTION Find Sub User]', subEx);
      }
    }

    // Fallback 2: Busca na tabela de perfis por asaas_customer_id
    if (!userId && customerId) {
      try {
        const { data: profRow, error: profErr } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('asaas_customer_id', customerId)
          .maybeSingle();
        if (profErr) console.error('[ASAAS WEBHOOK DB ERROR Find Customer User]', profErr);
        userId = profRow?.id || null;
      } catch (profEx) {
        console.error('[ASAAS WEBHOOK EXCEPTION Find Customer User]', profEx);
      }
    }

    // 4. TRATAMENTO DE USUÁRIO NÃO IDENTIFICADO
    if (!userId && (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_OVERDUE')) {
      console.warn('[ASAAS WEBHOOK UNRESOLVED USER] Usuário não identificado para o pagamento:', { event, paymentId, customerId, externalReference });

      // Observability: log de erro por usuário não identificado
      logPaymentEvent({
        userId: null,
        subscriptionId: subscriptionId || null,
        paymentId: paymentId || null,
        customerId: customerId || null,
        gateway: 'asaas',
        status: 'error',
        event: 'error',
        error: `Usuário não identificado. event=${event} customerId=${customerId} externalRef=${externalReference}`,
        payload: { event, externalReference },
        source: 'webhook'
      }).catch(() => {});

      try {
        const { error: insertUnresolvedErr } = await supabaseAdmin.from('webhook_events').insert([{
          event_id: eventId,
          event_type: event,
          resource_id: paymentId || subscriptionId,
          status: 'unresolved_user',
          payload: body,
          created_at: new Date().toISOString()
        }]);
        if (insertUnresolvedErr) console.error('[ASAAS WEBHOOK DB ERROR Insert Unresolved]', insertUnresolvedErr);
      } catch (dbErr) {
        console.error('[ASAAS WEBHOOK EXCEPTION Insert Unresolved]', dbErr);
      }
      return res.status(200).json({ success: false, unresolved: true, message: 'Evento registrado para resolução de usuário.' });
    }

    // 5. DEDUPLICAÇÃO DE PAGAMENTOS (PAYMENT_RECEIVED vs PAYMENT_CONFIRMED)
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      if (event === 'PAYMENT_CONFIRMED' && paymentId) {
        try {
          const { data: existingReceived, error: recCheckErr } = await supabaseAdmin
            .from('webhook_events')
            .select('event_id')
            .eq('resource_id', paymentId)
            .eq('event_type', 'PAYMENT_RECEIVED')
            .maybeSingle();

          if (recCheckErr) console.error('[ASAAS WEBHOOK DB ERROR Check PAYMENT_RECEIVED Dedup]', recCheckErr);

          if (existingReceived) {
            console.log(`[ASAAS WEBHOOK DEDUPLICATION] PAYMENT_CONFIRMED ignorado pois PAYMENT_RECEIVED já processou paymentId=${paymentId}`);
            try {
              await supabaseAdmin.from('webhook_events').insert([{
                event_id: eventId,
                event_type: event,
                resource_id: paymentId,
                user_id: userId,
                status: 'deduplicated',
                payload: body,
                created_at: new Date().toISOString()
              }]);
            } catch (dedupInsertErr) {
              console.error('[ASAAS WEBHOOK DB ERROR Insert Deduplicated Event]', dedupInsertErr);
            }
            return res.status(200).json({ success: true, deduplicated: true, message: 'Pagamento já processado via evento primário PAYMENT_RECEIVED.' });
          }
        } catch (dedupEx) {
          console.error('[ASAAS WEBHOOK EXCEPTION Check Deduplication]', dedupEx);
        }
      }

      if (!userId) {
        console.error('[WEBHOOK LOST USER MAPPING]', body);
        return res.status(200).json({ error: true, message: 'WEBHOOK_LOST_USER_MAPPING' });
      }

      const normalizedBillingType = String(billingType).toLowerCase() === 'credit_card' ? 'credit_card' : 'pix';
      const finalValue = Number(payment.value) || PLAN_PREMIUM_MONTHLY_PRICE;

        await BillingEngine.processPaymentSuccess({
          userId,
          customerId,
          paymentId,
          subscriptionId,
          billingType: normalizedBillingType,
          value: finalValue
        });

        // Observability: log de pagamento aprovado
        logPaymentEvent({
          userId,
          subscriptionId: subscriptionId || null,
          paymentId: paymentId || null,
          customerId: customerId || null,
          gateway: 'asaas',
          status: 'success',
          event: 'payment_approved',
          payload: { event, billingType: normalizedBillingType, value: finalValue },
          processingTime: Date.now() - startTime,
          processed: true,
          source: 'webhook'
        }).catch(() => {});
    } else if (event === 'PAYMENT_OVERDUE') {
      if (userId) {
        await BillingEngine.processPaymentOverdue({ userId, paymentId });

        logPaymentEvent({
          userId,
          subscriptionId: subscriptionId || null,
          paymentId: paymentId || null,
          customerId: customerId || null,
          gateway: 'asaas',
          status: 'error',
          event: 'payment_overdue',
          payload: { event, billingType },
          processingTime: Date.now() - startTime,
          processed: true,
          source: 'webhook'
        }).catch(() => {});
      }
    } else if (event === 'PAYMENT_DELETED' || event === 'SUBSCRIPTION_DELETED') {
      if (userId) {
        await BillingEngine.processSubscriptionCanceled({ userId, reason: 'canceled' });

        logPaymentEvent({
          userId,
          subscriptionId: subscriptionId || null,
          paymentId: paymentId || null,
          customerId: customerId || null,
          gateway: 'asaas',
          status: 'success',
          event: 'subscription_canceled',
          payload: { event },
          processingTime: Date.now() - startTime,
          processed: true,
          source: 'webhook'
        }).catch(() => {});
      }
    }

    // 6. REGISTRO DE AUDITORIA DE SUCESSO EM WEBHOOK_EVENTS
    try {
      const { error: auditInsertErr } = await supabaseAdmin.from('webhook_events').insert([{
        event_id: eventId,
        event_type: event,
        resource_id: paymentId || subscriptionId,
        user_id: userId,
        status: 'processed',
        payload: body,
        created_at: new Date().toISOString()
      }]);
      if (auditInsertErr) console.error('[ASAAS WEBHOOK DB ERROR Insert Processed Event]', auditInsertErr);
    } catch (dbErr) {
      console.error('[ASAAS WEBHOOK EXCEPTION Insert Processed Event]', dbErr);
    }

    return res.status(200).json({ success: true, event, paymentId, processed: true });
  } catch (error) {
    console.error('[ERROR] [ASAAS WEBHOOK UNHANDLED EXCEPTION]', error);

    // Observability: log de exceção não tratada
    logPaymentEvent({
      userId: null,
      gateway: 'asaas',
      status: 'error',
      event: 'error',
      error: error?.message || 'Exceção não tratada no webhook Asaas',
      payload: { stack: error?.stack?.substring(0, 500) },
      processingTime: Date.now() - startTime,
      source: 'webhook'
    }).catch(() => {});

    return res.status(200).json({ error: true, message: error.message || 'Erro interno no processamento do webhook.' });
  }
}
