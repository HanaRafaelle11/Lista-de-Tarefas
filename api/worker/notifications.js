import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Configuração de VAPID keys para Web Push
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_PUBLIC_VAPID_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || process.env.PRIVATE_VAPID_KEY || '';

if (publicVapidKey && privateVapidKey) {
  try {
    webpush.setVapidDetails(
      'mailto:admin@myflowday.com',
      publicVapidKey,
      privateVapidKey
    );
  } catch (e) {
    console.warn('[Vercel Worker] VAPID initialization warning:', e.message);
  }
}

export default async function handler(req, res) {
  const now = new Date().toISOString();

  if (!supabase) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    // 1. Buscar notificações pendentes com scheduled_for <= now()
    const { data: queue, error } = await supabase
      .from('notification_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('scheduled_for', now)
      .lt('attempts', 5)
      .order('scheduled_for', { ascending: true })
      .limit(100);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!queue || queue.length === 0) {
      return res.status(200).json({ processed: 0, timestamp: now });
    }

    let processed = 0;

    for (const job of queue) {
      const taskId = job.task_id || job.entity_id || job.id;

      try {
        // 2. Anti-duplicação: verificar se já existe log para task_id + scheduled_for
        const { data: existing } = await supabase
          .from('notification_logs')
          .select('id')
          .eq('user_id', job.user_id)
          .eq('status', 'sent')
          .eq('notification_queue_id', job.id)
          .maybeSingle();

        if (existing) {
          await supabase.from('notification_queue').update({ status: 'sent', updated_at: now }).eq('id', job.id);
          continue;
        }

        // 3. Marcar como processing
        await supabase
          .from('notification_queue')
          .update({ status: 'processing', attempts: (job.attempts || 0) + 1, updated_at: now })
          .eq('id', job.id);

        // 4. ENVIAR NOTIFICAÇÃO PUSH REAL
        const pushResult = await sendPushNotificationReal(job);

        // 5. Marcar como sent (ou success)
        await supabase
          .from('notification_queue')
          .update({ status: 'sent', sent_at: now, updated_at: now })
          .eq('id', job.id);

        // 6. Registrar Log de Auditoria em notification_logs
        await supabase.from('notification_logs').insert({
          user_id: job.user_id,
          notification_queue_id: job.id,
          status: 'sent',
          title: job.title,
          body: job.body || '',
          payload: pushResult.payload || {},
          sent_at: now
        });

        processed++;

      } catch (err) {
        // Erro por item não quebra o loop do worker
        const errMsg = String(err.message || err);
        await supabase
          .from('notification_queue')
          .update({ status: 'failed', last_error: errMsg, updated_at: now })
          .eq('id', job.id);

        await supabase.from('notification_logs').insert({
          user_id: job.user_id,
          notification_queue_id: job.id,
          status: 'failed',
          title: job.title || 'Notification',
          error_message: errMsg,
          sent_at: now
        });
      }
    }

    return res.status(200).json({
      processed,
      timestamp: now
    });

  } catch (globalError) {
    return res.status(500).json({
      error: globalError.message || String(globalError)
    });
  }
}

async function sendPushNotificationReal(job) {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', job.user_id);

  const payload = {
    title: job.title,
    body: job.body || '',
    url: job.entity_type === 'focus' ? '/focus' : job.entity_type === 'goal' ? '/goals' : '/tasks',
    tag: `push_${job.entity_type || 'task'}_${job.entity_id || job.id}`,
    entity_id: job.entity_id || job.task_id,
    entity_type: job.entity_type || 'task'
  };

  if (!subscriptions || subscriptions.length === 0) {
    console.log('[Worker] Nenhuma assinatura push localizada para o usuário:', job.user_id);
    return { success: true, payload, note: 'No active subscriptions' };
  }

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh || sub.keys?.p256dh, auth: sub.auth || sub.keys?.auth } },
        JSON.stringify(payload)
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }

  return { success: true, payload };
}
