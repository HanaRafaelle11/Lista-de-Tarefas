import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../services/logger/index.js';
import { withAdminAuth } from '../../lib/auth/withAdminAuth.js';

async function handler(req, res) {
  const start = Date.now();

  try {
    // 1. Busca contagem de inscrições de push ativas
    const { count: subCount, error: subErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true });

    if (subErr) throw subErr;

    // 2. Busca contagem de status da fila
    const [pendingRes, processingRes, sentRes, failedRes] = await Promise.all([
      supabaseAdmin.from('notification_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('notification_queue').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
      supabaseAdmin.from('notification_queue').select('id', { count: 'exact', head: true }).in('status', ['sent', 'success']),
      supabaseAdmin.from('notification_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed')
    ]);

    const stats = {
      totalSubscriptions: subCount || 0,
      pending: pendingRes.count || 0,
      processing: processingRes.count || 0,
      success: sentRes.count || 0,
      failed: failedRes.count || 0,
      total: (pendingRes.count || 0) + (processingRes.count || 0) + (sentRes.count || 0) + (failedRes.count || 0)
    };

    // 3. Busca lista recente de itens da fila (com fallback resiliente)
    let queueData = [];
    let isLegacy = false;

    const { data, error: qErr } = await supabaseAdmin
      .from('notification_queue')
      .select('id, event_type, entity_type, scheduled_for, status, attempts, last_error, created_at, sent_at, clicked_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!qErr) {
      queueData = data || [];
    } else {
      const isColumnError = qErr.code === '42703' || qErr.code === 'PGRST204' || qErr.message?.includes('column');
      if (!isColumnError) throw qErr;

      isLegacy = true;
      console.warn('[Admin Notifications] Schema v17 ausente no DB, executando fallback v16 para a tabela...');
      
      const { data: legacyData, error: legacyErr } = await supabaseAdmin
        .from('notification_queue')
        .select('id, task_id, title, body, scheduled_for, status, attempts, last_error, created_at, sent_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (legacyErr) throw legacyErr;

      queueData = (legacyData || []).map(item => ({
        id: item.id,
        event_type: 'TASK_DUE',
        entity_type: 'task',
        entity_id: item.task_id || '',
        title: item.title,
        body: item.body || '',
        scheduled_for: item.scheduled_for,
        status: item.status,
        attempts: item.attempts || 0,
        last_error: item.last_error || null,
        created_at: item.created_at,
        sent_at: item.sent_at || null,
        clicked_at: null
      }));
    }

    logger.info('api.admin.notifications.success', { latency: Date.now() - start, schema: isLegacy ? 'v16_fallback' : 'v17' });
    return res.status(200).json({
      stats,
      queue: queueData
    });
  } catch (err) {
    logger.error('api.admin.notifications.error', { latency: Date.now() - start, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}

export default withAdminAuth(handler);
