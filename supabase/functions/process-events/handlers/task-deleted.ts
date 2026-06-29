export async function handleTaskDeleted(supabase: any, event: any) {
  const payload = event.payload || {};

  await supabase
    .from('notification_queue')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('task_id', payload.id);

  return { success: true, action: 'cancelled_queue' };
}
