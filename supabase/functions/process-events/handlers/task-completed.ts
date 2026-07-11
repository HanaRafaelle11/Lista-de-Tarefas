export async function handleTaskCompleted(supabase: any, event: any) {
  const payload = event.payload || {};
  const taskId = payload.id || payload.taskId || payload.task_id || event.aggregate_id;

  // Cancela agendamentos pendentes
  await supabase
    .from('notification_queue')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('task_id', taskId)
    .eq('status', 'pending');

  return { success: true, action: 'achievements_and_cancelled' };
}
