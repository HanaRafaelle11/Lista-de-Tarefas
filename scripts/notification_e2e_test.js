import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { processPendingNotificationQueue } from '../services/notification.service.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function testNotificationPipeline() {
  const result = {
    pipelineSuccess: true,
    stepFailed: null,
    details: ''
  };

  if (!supabaseUrl || !supabaseServiceKey) {
    result.pipelineSuccess = false;
    result.stepFailed = 'ENV_CHECK';
    result.details = 'Ambiente Supabase não configurado.';
    return result;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  let testJobId = null;
  let testTaskId = null;
  let testUserId = null;
  let task = null;

  try {
    console.log('[Notification Checker] Iniciando teste de disparo ponta a ponta...');

    // 1. Localizar um usuário para o teste
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (profErr || !profile) {
      result.pipelineSuccess = false;
      result.stepFailed = 'PROFILE_SEARCH';
      result.details = `Falha ao localizar perfis no banco: ${profErr?.message || 'Nenhum usuário cadastrado'}`;
      return result;
    }
    testUserId = profile.id;

    // 2. Localizar ou criar uma tarefa para vincular a notificação
    const taskResult = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', testUserId)
      .limit(1)
      .maybeSingle();
    
    const taskErr = taskResult.error;
    task = taskResult.data;

    if (taskErr) {
      result.pipelineSuccess = false;
      result.stepFailed = 'TASK_SEARCH';
      result.details = `Erro ao buscar tarefas: ${taskErr.message}`;
      return result;
    }

    if (!task) {
      // Criar tarefa temporária
      const { data: newTask, error: createErr } = await supabase
        .from('tasks')
        .insert([{
          user_id: testUserId,
          title: 'Tarefa Temporária Deployment Safety Gate',
          completed: false,
          category: 'Trabalho',
          priority: 'Alta'
        }])
        .select('id')
        .single();

      if (createErr || !newTask) {
        result.pipelineSuccess = false;
        result.stepFailed = 'TASK_CREATE';
        result.details = `Falha ao criar tarefa temporária: ${createErr?.message}`;
        return result;
      }
      testTaskId = newTask.id;
    } else {
      testTaskId = task.id;
    }

    // 3. Inserir job pendente na fila
    const { data: insertedJob, error: insertErr } = await supabase
      .from('notification_queue')
      .insert([{
        user_id: testUserId,
        task_id: testTaskId,
        title: 'Gate Disparado 🛡️',
        body: 'Teste automático de validação do deploy pre-prod.',
        scheduled_for: new Date(Date.now() - 30 * 1000).toISOString(),
        status: 'pending'
      }])
      .select('id')
      .single();

    if (insertErr || !insertedJob) {
      result.pipelineSuccess = false;
      result.stepFailed = 'QUEUE_INSERT';
      result.details = `Erro ao agendar notificação na fila: ${insertErr?.message}`;
      return result;
    }
    testJobId = insertedJob.id;
    console.log(`[Notification Checker] Job criado com ID: ${testJobId}`);

    // 4. Executar processamento de fila
    const traceId = `trc_gate_${Date.now()}`;
    const runResult = await processPendingNotificationQueue({ traceId });

    // 5. Verificar transição na fila
    const { data: checkJob, error: checkJobErr } = await supabase
      .from('notification_queue')
      .select('status')
      .eq('id', testJobId)
      .single();

    if (checkJobErr) {
      result.pipelineSuccess = false;
      result.stepFailed = 'QUEUE_VERIFY';
      result.details = `Erro ao consultar fila pós-disparo: ${checkJobErr.message}`;
      return result;
    }

    // Verificamos a conformidade da verdade de envio:
    // Se o serviço mockou por falta de VAPID ou se não tem subscriptions,
    // o status deve ter mudado para 'failed' (com erro adequado) ou se enviou com sucesso deve ser 'sent'.
    // Mas não pode ficar 'pending' se ele tentou processar!
    if (checkJob.status === 'pending' || checkJob.status === 'processing') {
      result.pipelineSuccess = false;
      result.stepFailed = 'STATUS_IMMUTABLE';
      result.details = `Job permaneceu em status "${checkJob.status}" — worker não processou o registro.`;
      return result;
    }

    // Se falhou por 'No active push subscriptions found for this user',
    // isso é o comportamento esperado pelo nosso pipeline de verdade de dados (sem sent falso),
    // portanto, o processamento lógico em si PASSOU no gate. Mas se falhar por erro de schema, falhar o gate!
    const { data: failedJob } = await supabase
      .from('notification_queue')
      .select('last_error')
      .eq('id', testJobId)
      .single();

    if (checkJob.status === 'failed' && failedJob?.last_error?.includes('SCHEMA_MISMATCH')) {
      result.pipelineSuccess = false;
      result.stepFailed = 'SCHEMA_MISMATCH';
      result.details = `Erro de schema no pipeline: ${failedJob.last_error}`;
      return result;
    }

    console.log(`[Notification Checker] Disparo processado com sucesso. Status final: ${checkJob.status}`);

  } catch (err) {
    result.pipelineSuccess = false;
    result.stepFailed = 'UNEXPECTED';
    result.details = err.message;
  } finally {
    // Limpeza
    if (testJobId) {
      await supabase.from('notification_queue').delete().eq('id', testJobId);
    }
    if (testTaskId && !task) {
      await supabase.from('tasks').delete().eq('id', testTaskId);
    }
  }

  return result;
}
