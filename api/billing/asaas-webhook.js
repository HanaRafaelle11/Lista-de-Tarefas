import { supabaseAdmin } from '../../lib/supabase.js';
import { BillingEngine } from '../../lib/billing/engine.js';
import { logPaymentEvent } from '../../lib/payment-logger.js';

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
    // Não aguarda (fire-and-forget) para não atrasar o handler
    logPaymentEvent({
      userId: null, // userId ainda não resolvido aqui
      eventType: 'webhook_received',
      status: 'pending',
      referenceId: paymentId || subscriptionId || null,
      payload: { event, paymentId, subscriptionId, customerId, billingType, externalReference },
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

    // 3. IDENTIFICAÇÃO DO USUÁRIO
    let userId = null;
    if (externalReference && externalReference.startsWith('mfd_premium_')) {
      userId = externalReference.replace('mfd_premium_', '');
    } else if (externalReference && externalReference.startsWith('order_')) {
      const parts = externalReference.split('_');
      if (parts.length >= 2) userId = parts[1];
    }

    if (!userId && subscriptionId) {
      try {
        const { data: subRow, error: subErr } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('asaas_subscription_id', subscriptionId)
          .maybeSingle();
        if (subErr) console.error('[ASAAS WEBHOOK DB ERROR Find Sub User]', subErr);
        userId = subRow?.user_id || null;
      } catch (subEx) {
        console.error('[ASAAS WEBHOOK EXCEPTION Find Sub User]', subEx);
      }
    }

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
        eventType: 'error',
        status: 'error',
        referenceId: paymentId || subscriptionId || null,
        errorMessage: `Usuário não identificado. event=${event} customerId=${customerId} externalRef=${externalReference}`,
        payload: { event, paymentId, subscriptionId, customerId, externalReference },
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

      if (userId) {
        await BillingEngine.processPaymentSuccess({
          userId,
          customerId,
          paymentId,
          subscriptionId,
          billingType,
          value: payment.value || 14.90
        });

        // Observability: log de pagamento aprovado
        logPaymentEvent({
          userId,
          eventType: 'payment_approved',
          status: 'success',
          referenceId: paymentId || null,
          payload: {
            event,
            billingType,
            value: payment.value || 14.90,
            subscriptionId: subscriptionId || null,
            customerId: customerId || null,
          },
        }).catch(() => {});

        // Gravar Auditoria Financeira em billing_events (com type='payment_success' para satisfazer o CHECK constraint) e billing_ledger
        try {
          const payVal = Number(payment.value) || 14.90;
          const { error: bEvtErr } = await supabaseAdmin.from('billing_events').insert([{
            user_id: userId,
            type: 'payment_success',
            event_type: event,
            payment_id: paymentId,
            asaas_payment_id: paymentId,
            subscription_id: subscriptionId || null,
            amount: payVal,
            value: payVal,
            provider: 'asaas',
            status: 'approved',
            created_at: new Date().toISOString()
          }]);
          if (bEvtErr) console.error('[ASAAS WEBHOOK DB ERROR Insert billing_events]', bEvtErr);

          const { error: bLedgerErr } = await supabaseAdmin.from('billing_ledger').insert([{
            user_id: userId,
            balance_change: payVal,
            reason: `Pagamento ${billingType.toUpperCase()} aprovado`,
            reference_id: paymentId,
            created_at: new Date().toISOString()
          }]);
          if (bLedgerErr) console.error('[ASAAS WEBHOOK DB ERROR Insert billing_ledger]', bLedgerErr);
        } catch (auditEx) {
          console.error('[ASAAS WEBHOOK EXCEPTION Insert Financial Audit]', auditEx);
        }
      }
    } else if (event === 'PAYMENT_OVERDUE') {
      if (userId) {
        await BillingEngine.processPaymentOverdue({ userId, paymentId });
        logPaymentEvent({
          userId,
          eventType: 'payment_overdue',
          status: 'error',
          referenceId: paymentId || null,
          payload: { event, paymentId, billingType },
        }).catch(() => {});
      }
    } else if (event === 'PAYMENT_DELETED' || event === 'SUBSCRIPTION_DELETED') {
      if (userId) {
        await BillingEngine.processSubscriptionCanceled({ userId, reason: 'canceled' });
        logPaymentEvent({
          userId,
          eventType: 'subscription_canceled',
          status: 'success',
          referenceId: subscriptionId || paymentId || null,
          payload: { event, subscriptionId, customerId },
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
      eventType: 'error',
      status: 'error',
      errorMessage: error?.message || 'Excessão não tratada no webhook Asaas',
      payload: { stack: error?.stack?.substring(0, 500) },
    }).catch(() => {});
    return res.status(200).json({ error: true, message: error.message || 'Erro interno no processamento do webhook.' });
  }
}
