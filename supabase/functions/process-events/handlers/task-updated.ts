export async function handleTaskUpdated(supabase: any, event: any) {
  const payload = event.payload || {};
  
  // Cancela agendamentos anteriores pendentes para a mesma tarefa
  await supabase
    .from('notification_queue')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('task_id', payload.id)
    .eq('status', 'pending');

  if (payload.due_date && !payload.completed) {
    const dueTime = new Date(payload.due_date);
    const dispatchTime = new Date(dueTime.getTime() - 15 * 60 * 1000).toISOString();
    const idempotencyKey = `task_due_${payload.id}_${payload.due_date}`;

    await supabase
      .from('notification_queue')
      .upsert({
        task_id: payload.id,
        user_id: event.user_id,
        title: 'Tarefa Próxima do Vencimento ⏰',
        body: `"${payload.title}" vence em breve no MyFlowDay.`,
        scheduled_for: dispatchTime,
        status: 'pending',
        type: 'task',
        idempotency_key: idempotencyKey
      }, { onConflict: 'idempotency_key' });
  }

  return { success: true, action: 're-scheduled' };
}
