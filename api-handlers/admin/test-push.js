import { supabaseAdmin } from '../../lib/supabase.js';
import { processPendingNotificationQueue } from '../../services/notification.service.js';
import { logger } from '../../services/logger/index.js';
import { withAdminAuth } from '../../lib/auth/withAdminAuth.js';

async function handler(req, res) {
  const start = Date.now();
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId é obrigatório.' });
  }

  try {
    // 1. Verificar se o usuário possui inscrições de push ativas
    const { data: subs, error: subsErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subsErr) throw subsErr;

    if (!subs || subs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma inscrição de push encontrada para este usuário. Por favor, ative as notificações no navegador primeiro.'
      });
    }

    // 2. Detectar se o schema da tabela é legado (v16) ou atualizado (v17/v18)
    const { error: testErr } = await supabaseAdmin
      .from('notification_queue')
      .select('task_id')
      .limit(0);
    const isLegacy = !testErr;

    // 3. Obter ou criar um ID de entidade para vincular a notificação
    let entityId = '';
    
    if (isLegacy) {
      // Schema v16 exige task_id NOT NULL vinculado a uma task válida do usuário
      const { data: task, error: taskErr } = await supabaseAdmin
        .from('tasks')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (taskErr) throw taskErr;

      if (!task) {
        // Cria uma tarefa fictícia caso o usuário não tenha nenhuma
        const { data: newTask, error: createErr } = await supabaseAdmin
          .from('tasks')
          .insert([{
            user_id: userId,
            title: 'Tarefa de Teste para Push Notification 🔔',
            completed: false,
            category: 'Trabalho',
            priority: 'Alta'
          }])
          .select('id')
          .single();

        if (createErr) throw createErr;
        entityId = newTask.id;
      } else {
        entityId = task.id;
      }
    } else {
      entityId = 'test_push_entity_id';
    }

    // 4. Inserir na fila de notificações com status pending
    const idempotencyKey = `test_push_${userId}_${Date.now()}`;
    const nowIso = new Date().toISOString();
    
    let insertPayload = {};
    if (isLegacy) {
      insertPayload = {
        user_id: userId,
        task_id: entityId,
        title: '⚡ MyFlowDay Teste Real!',
        body: `Teste ponta a ponta disparado às ${new Date().toLocaleTimeString('pt-BR')}`,
        scheduled_for: nowIso,
        status: 'pending',
        idempotency_key: idempotencyKey
      };
    } else {
      insertPayload = {
        user_id: userId,
        event_type: 'TEST_PUSH',
        entity_type: 'system',
        entity_id: entityId,
        title: '⚡ MyFlowDay Teste Real!',
        body: `Teste ponta a ponta disparado às ${new Date().toLocaleTimeString('pt-BR')}`,
        scheduled_for: nowIso,
        status: 'pending',
        priority: 'high',
        idempotency_key: idempotencyKey
      };
    }

    const { data: job, error: insertErr } = await supabaseAdmin
      .from('notification_queue')
      .insert([insertPayload])
      .select('id')
      .single();

    if (insertErr || !job) throw insertErr;

    // 5. Executar o worker de disparo sincronamente para processar o item
    const traceId = `trc_test_push_${Date.now()}`;
    const workerRes = await processPendingNotificationQueue({ traceId });

    // 6. Consultar o status resultante do processamento
    const { data: finalJob, error: finalErr } = await supabaseAdmin
      .from('notification_queue')
      .select('status, last_error, sent_at')
      .eq('id', job.id)
      .single();

    if (finalErr) throw finalErr;

    // Limpar o job de teste criado para manter a tabela limpa
    await supabaseAdmin.from('notification_queue').delete().eq('id', job.id);

    const latency = Date.now() - start;
    logger.info('api.admin.testPush.success', { latency, status: finalJob.status });

    if (finalJob.status === 'sent') {
      return res.status(200).json({
        success: true,
        message: 'Notificação de teste enviada com sucesso ao seu dispositivo!',
        latencyMs: latency,
        sentAt: finalJob.sent_at
      });
    } else {
      return res.status(500).json({
        success: false,
        error: `O envio falhou no VAPID: ${finalJob.last_error || 'Erro desconhecido.'}`,
        latencyMs: latency
      });
    }
  } catch (err) {
    logger.error('api.admin.testPush.error', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
}

export default withAdminAuth(handler);
