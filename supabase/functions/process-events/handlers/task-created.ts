export async function handleTaskCreated(supabase: any, event: any) {
  let payload = event.payload || {};

  const taskId = payload.id || payload.taskId || payload.task_id || event.aggregate_id;
  if (taskId && (!payload.title || !payload.due_date)) {
    const { data: dbTask } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    if (dbTask) {
      payload = { ...dbTask, ...payload };
    }
  }

  if (!payload.due_date || payload.completed) return { success: true, action: 'skipped' };

  const dueTime = new Date(payload.due_date);
  const dispatchTime = new Date(dueTime.getTime() - 15 * 60 * 1000).toISOString();
  const idempotencyKey = `task_due_${payload.id || taskId}_${payload.due_date}`;

  const { error } = await supabase
    .from('notification_queue')
    .upsert({
      task_id: payload.id || taskId,
      user_id: event.user_id,
      title: 'Tarefa Próxima do Vencimento ⏰',
      body: `"${payload.title}" vence em breve no MyFlowDay.`,
      scheduled_for: dispatchTime,
      status: 'pending',
      type: 'task',
      idempotency_key: idempotencyKey
    }, { onConflict: 'idempotency_key' });

  if (error && !error.message.includes('unique constraint')) {
    throw new Error(`TaskCreated notification handler failed: ${error.message}`);
  }

  return { success: true, action: 'queued_notification' };
}
