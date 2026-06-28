import { sendPushNotification } from './push-notification-service.js';

/**
 * PushWorkerEngine
 * Worker de alta performance para processar a fila notification_queue de forma atômica e idenfutável.
 */
export async function processNotificationQueue(supabaseClient, limit = 50) {
  if (!supabaseClient) {
    console.error('[WorkerEngine] Supabase client não fornecido.');
    return { processed: 0, errors: 1 };
  }

  const now = new Date().toISOString();

  try {
    // 1. Buscar notificações pendentes que já atingiram o horário programado
    const { data: pendingItems, error: fetchError } = await supabaseClient
      .from('notification_queue')
      .select('*')
      .lte('scheduled_for', now)
      .in('status', ['pending', 'failed'])
      .lt('attempts', 3)
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (fetchError) {
      console.error('[WorkerEngine] Erro ao buscar fila:', fetchError.message);
      return { processed: 0, errors: 1 };
    }

    if (!pendingItems || pendingItems.length === 0) {
      return { processed: 0, errors: 0 };
    }

    console.log(`[WorkerEngine] Processando ${pendingItems.length} notificações agendadas...`);

    let successCount = 0;
    let failCount = 0;

    for (const item of pendingItems) {
      // 2. Transição atômica para 'processing' para evitar race conditions em múltiplas instâncias
      const { error: lockError } = await supabaseClient
        .from('notification_queue')
        .update({ status: 'processing', attempts: item.attempts + 1 })
        .eq('id', item.id)
        .eq('status', item.status); // Garante controle concorrente otimista

      if (lockError) {
        console.warn(`[WorkerEngine] Item ${item.id} sendo processado por outro worker.`);
        continue;
      }

      // 3. Tentar o envio Web Push real via VAPID
      const result = await sendPushNotification(supabaseClient, item.user_id, {
        title: item.title,
        body: item.body,
        url: item.url,
        entity_id: item.entity_id,
        entity_type: item.entity_type,
        tag: item.idempotency_key
      });

      // 4. Atualizar status final na fila
      if (result.success) {
        await supabaseClient
          .from('notification_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_error: null
          })
          .eq('id', item.id);
        successCount++;
      } else {
        const nextStatus = item.attempts + 1 >= item.max_attempts ? 'failed' : 'failed';
        await supabaseClient
          .from('notification_queue')
          .update({
            status: nextStatus,
            last_error: result.reason || 'Falha no envio de dispositivos'
          })
          .eq('id', item.id);
        failCount++;
      }
    }

    return { processed: pendingItems.length, success: successCount, failed: failCount };
  } catch (err) {
    console.error('[WorkerEngine] Erro inesperado no worker:', err.message);
    return { processed: 0, errors: 1, message: err.message };
  }
}
