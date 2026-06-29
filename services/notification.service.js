import webpush from 'web-push';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

const publicVapidKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_PUBLIC_VAPID_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || process.env.PRIVATE_VAPID_KEY || '';

if (publicVapidKey && privateVapidKey) {
  try {
    webpush.setVapidDetails('mailto:admin@myflowday.com', publicVapidKey, privateVapidKey);
  } catch (e) {
    logger.warn('notification.service.vapid_warning', { error: e.message });
  }
}

export async function processPendingNotificationQueue({ traceId }) {
  const now = new Date().toISOString();
  logger.info('notification.service.processPendingQueue.start', { traceId, timestamp: now });

  if (!supabaseAdmin) return { processed: 0, note: 'Mock environment' };

  // Fila de Notificações - buscar itens pendentes ou falhados
  const { data: queue, error: queueErr } = await supabaseAdmin
    .from('notification_queue')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('scheduled_for', now)
    .limit(50);

  if (queueErr) {
    logger.error('notification.service.queue_fetch_failed', {
      traceId,
      error: queueErr.message,
      code: queueErr.code
    });
    return {
      processed: 0,
      error: 'SCHEMA_MISMATCH',
      critical: true,
      details: queueErr.message
    };
  }

  if (!queue || queue.length === 0) {
    return { processed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const job of queue) {
    try {
      // 1. Marcar como processando (Trava de Idempotência)
      const { error: lockErr } = await supabaseAdmin
        .from('notification_queue')
        .update({ status: 'processing' })
        .eq('id', job.id);

      if (lockErr) throw lockErr;

      // 2. Buscar inscrições de push ativas do usuário
      const { data: subscriptions, error: subsErr } = await supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', job.user_id);

      if (subsErr) {
        logger.error('notification.service.subs_fetch_failed', { traceId, jobId: job.id, error: subsErr.message });
        throw new Error(`SCHEMA_MISMATCH: push_subscriptions table missing or inaccessible. (${subsErr.message})`);
      }

      // Se o usuário não tem nenhuma inscrição de push registrada, é uma falha de entrega (sem push_subscriptions)
      if (!subscriptions || subscriptions.length === 0) {
        throw new Error('No active push subscriptions found for this user.');
      }

      // 3. Disparar notificações reais via WebPush
      let pushSuccessCount = 0;
      let lastPushError = '';

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh || sub.keys?.p256dh,
                auth: sub.auth || sub.keys?.auth
              }
            },
            JSON.stringify({
              title: job.title,
              body: job.body || '',
              url: '/tasks',
              icon: '/branding/icon-192.png',
              badge: '/branding/notification-badge.png'
            })
          );
          pushSuccessCount++;
        } catch (err) {
          lastPushError = err.message;
          // Se o navegador reportar 404 (Not Found) ou 410 (Gone), removemos o endpoint expirado
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabaseAdmin
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint);
            logger.info('notification.service.expired_sub_cleaned', { traceId, endpoint: sub.endpoint });
          } else {
            logger.warn('notification.service.push_send_error', { traceId, endpoint: sub.endpoint, error: err.message });
          }
        }
      }

      // 4. Mapear status final com base na entrega real do VAPID (Sem "sent falso")
      if (pushSuccessCount === 0) {
        throw new Error(`WebPush delivery failed. Last VAPID error: ${lastPushError || 'unknown'}`);
      }

      // Sucesso real: marcar como enviado
      const { error: updateErr } = await supabaseAdmin
        .from('notification_queue')
        .update({
          status: 'sent',
          sent_at: now
        })
        .eq('id', job.id);

      if (updateErr) {
        // Fallback apenas para salvar o status de envio simples
        await supabaseAdmin
          .from('notification_queue')
          .update({ status: 'sent' })
          .eq('id', job.id);
      }

      // Inserir registro de auditoria completo na tabela de logs (sem silenciar erros de schema)
      const { error: logErr } = await supabaseAdmin.from('notification_logs').insert({
        user_id: job.user_id,
        notification_queue_id: job.id,
        status: 'sent',
        title: job.title,
        body: job.body || '',
        sent_at: now
      });

      if (logErr) {
        logger.error('notification.service.log_write_failed', {
          traceId,
          jobId: job.id,
          error: logErr.message,
          code: logErr.code
        });
        // Lança erro caso a tabela de logs tenha schema incorreto para alertar o admin
        throw new Error(`SCHEMA_MISMATCH: notification_logs table inconsistent. (${logErr.message})`);
      }

      processed++;
    } catch (err) {
      failed++;
      const errorMsg = err.message || JSON.stringify(err);
      logger.error('notification.service.job_processing_failed', { traceId, jobId: job.id, error: errorMsg });

      // Atualiza o job para status='failed' e guarda o log de erro no banco
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
