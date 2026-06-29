import { supabaseAdmin } from '../../services/supabase/client.js';
import { logger } from '../../services/logger/logger.js';
import { handleSubscriptionCreated } from '../../domain/events/handlers/subscriptionCreated.handler.js';
import { handlePaymentSuccess } from '../../domain/events/handlers/paymentSuccess.handler.js';
import { handleTaskCreated } from '../../domain/events/handlers/taskCreated.handler.js';
import { handleNotificationScheduled } from '../../domain/events/handlers/notificationScheduled.handler.js';

function getExponentialBackoffTime(attempts) {
  const minutes = attempts === 1 ? 5 : attempts === 2 ? 15 : attempts === 3 ? 30 : 60;
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export default async function handler(req, res) {
  const now = new Date().toISOString();
  logger.info('[EventProcessorWorker] Iniciando ciclo de processamento assíncrono do Event Store');

  if (!supabaseAdmin) {
    return res.status(200).json({ processed: 0, note: 'Supabase admin not configured in local environment', timestamp: now });
  }

  try {
    // 1. Buscar eventos com status 'pending' ou 'failed' elegíveis para retry
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lt('attempts', 5)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      logger.error('[EventProcessorWorker] Erro ao buscar eventos:', { error: error.message });
      return res.status(500).json({ error: error.message });
    }

    if (!events || events.length === 0) {
      return res.status(200).json({ processed: 0, timestamp: now });
    }

    let processedCount = 0;

    for (const event of events) {
      // 2. Marcar como processing
      await supabaseAdmin
        .from('events')
        .update({ status: 'processing', attempts: (event.attempts || 0) + 1, updated_at: now })
        .eq('id', event.id);

      try {
        let result = { success: true };

        // 3. Roteamento para Handlers de Domínio especializados
        switch (event.type) {
          case 'subscription.created':
          case 'subscription_created':
            result = await handleSubscriptionCreated(event.payload);
            break;
          case 'payment.success':
          case 'payment_success':
            result = await handlePaymentSuccess(event.payload);
            break;
          case 'task.created':
          case 'task_created':
            result = await handleTaskCreated(event.payload);
            break;
          case 'notification.scheduled':
          case 'notification_scheduled':
            result = await handleNotificationScheduled(event.payload);
            break;
          default:
            logger.warn(`[EventProcessorWorker] Nenhum handler registrado para tipo: ${event.type}`);
            break;
        }

        // 4. Atualizar status para 'processed'
        await supabaseAdmin
          .from('events')
          .update({ status: 'processed', processed_at: now, updated_at: now, last_error: null })
          .eq('id', event.id);

        processedCount++;

      } catch (err) {
        const errMsg = String(err.message || err);
        logger.error(`[EventProcessorWorker] Falha ao processar evento ${event.id}:`, { error: errMsg });

        await supabaseAdmin
          .from('events')
          .update({ status: 'failed', last_error: errMsg, updated_at: now })
          .eq('id', event.id);
      }
    }

    return res.status(200).json({
      processed: processedCount,
      timestamp: now
    });

  } catch (globalErr) {
    logger.error('[EventProcessorWorker] Erro crítico no worker:', { error: globalErr.message });
    return res.status(500).json({ error: globalErr.message || String(globalErr) });
  }
}
