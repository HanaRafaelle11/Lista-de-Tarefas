export async function handleGoalCompleted(supabase: any, event: any) {
  const payload = event.payload || {};
  console.log(`[GoalCompletedHandler] Processando meta ${payload.id || event.aggregate_id} do usuário ${event.user_id}`);
  return { success: true, action: 'goal_achievement_processed' };
}
