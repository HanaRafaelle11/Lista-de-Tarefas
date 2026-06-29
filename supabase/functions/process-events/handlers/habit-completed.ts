export async function handleHabitCompleted(supabase: any, event: any) {
  const payload = event.payload || {};
  console.log(`[HabitCompletedHandler] Processando hábito ${payload.id || event.aggregate_id} do usuário ${event.user_id}`);
  return { success: true, action: 'habit_gamification_processed' };
}
