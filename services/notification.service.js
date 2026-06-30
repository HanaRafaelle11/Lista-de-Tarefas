import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

/**
 * Processador de fila que atua como delegate, invocando a Edge Function 'push'
 * para centralizar todo o disparo em um único pipeline server-side.
 */
export async function processPendingNotificationQueue({ traceId }) {
  const now = new Date().toISOString();
  logger.info('notification.service.processPendingQueue.start', { traceId, timestamp: now });

  if (!supabaseAdmin) return { processed: 0, note: 'Mock environment' };

  // Busca notificações pendentes ou falhadas na fila
  const { data: queue, error: queueErr } = await supabaseAdmin
    .from('notification_queue')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('scheduled_for', now)
    .limit(50);

  if (queueErr) {
    logger.error('notification.service.queue_fetch_failed', { traceId, error: queueErr.message });
    return { processed: 0, error: queueErr.message };
  }

  if (!queue || queue.length === 0) {
    return { processed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const job of queue) {
    try {
      // Trava de Idempotência
      const { error: lockErr } = await supabaseAdmin
        .from('notification_queue')
        .update({ status: 'processing' })
        .eq('id', job.id);

      if (lockErr) throw lockErr;

      // Invoca a Edge Function 'push' para enviar a notificação
      const { data: invokeRes, error: invokeErr } = await supabaseAdmin.functions.invoke('push', {
        body: {
          type: 'send',
          payload: {
            user_id: job.user_id,
            title: job.title,
            body: job.body || '',
            url: '/tasks',
            entity_id: job.task_id || '',
            entity_type: 'task'
          }
        }
      });

      if (invokeErr) throw invokeErr;
      if (invokeRes?.error) throw new Error(invokeRes.error);

      if (invokeRes?.sent > 0) {
        // Sucesso no envio
        await supabaseAdmin
          .from('notification_queue')
          .update({ status: 'sent', sent_at: now, last_error: null })
          .eq('id', job.id);

        await supabaseAdmin.from('notification_logs').insert({
          user_id: job.user_id,
          notification_queue_id: job.id,
          status: 'sent',
          title: job.title,
          body: job.body || '',
          sent_at: now
        });

        processed++;
      } else {
        throw new Error(invokeRes?.msg || 'Nenhuma assinatura ativa encontrada para este usuário.');
      }

    } catch (err) {
      failed++;
      const errorMsg = err.message || JSON.stringify(err);
      logger.error('notification.service.job_processing_failed', { traceId, jobId: job.id, error: errorMsg });

      await supabaseAdmin
        .from('notification_queue')
        .update({
          status: 'failed',
          last_error: errorMsg,
          attempts: (job.attempts || 0) + 1
        })
        .eq('id', job.id);
    }
  }

  logger.info('notification.service.processPendingQueue.finish', { traceId, processed, failed, total: queue.length });
  return { processed, failed };
}
