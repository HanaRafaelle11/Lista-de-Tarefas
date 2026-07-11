export async function handleTaskDeleted(supabase: any, event: any) {
  const payload = event.payload || {};
  const taskId = payload.id || payload.taskId || payload.task_id || event.aggregate_id;

  await supabase
    .from('notification_queue')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('task_id', taskId);

  return { success: true, action: 'cancelled_queue' };
}
