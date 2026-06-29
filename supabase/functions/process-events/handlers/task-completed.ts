export async function handleTaskCompleted(supabase: any, event: any) {
  const payload = event.payload || {};

  // Cancela agendamentos pendentes
  await supabase
    .from('notification_queue')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('task_id', payload.id)
    .eq('status', 'pending');

  return { success: true, action: 'achievements_and_cancelled' };
}
