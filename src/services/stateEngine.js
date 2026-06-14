/**
 * stateEngine.js — User State Engine por Event Sourcing
 *
 * Reconstrói dinamicamente o estado de ativação e retenção do usuário
 * a partir do replay das ações geradas. O estado nunca é salvo estático:
 * ele é sempre a projeção do log de eventos.
 */

import { eventReplayer } from './eventReplayer';

function daysSince(isoString) {
  if (!isoString) return Infinity;
  return (Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60 * 24);
}

export const stateEngine = {
  /**
   * Reconstrói o estado comportamental completo do usuário.
   *
   * @param {Array} events - stream de eventos do usuário
   * @returns {object} Projeção consolidade do estado de ativação e retenção
   */
  computeUserState(events = []) {
    const projection = eventReplayer.replay(events);
    
    // 1. Calcula Activation Score (0-100)
    let activationScore = 0;
    if (projection.onboarding.completed)        activationScore += 20;
    if (projection.tasks.createdCount > 0)      activationScore += 20;
    if (projection.firstWinTimestamp)           activationScore += 30;
    if (projection.habits.createdCount > 0)     activationScore += 15;
    if (projection.goals.createdCount > 0)      activationScore += 15;
    activationScore = Math.min(activationScore, 100);

    // 2. Calcula Time To Value (TTV)
    let timeToValueMs = null;
    if (projection.signupTimestamp && projection.firstWinTimestamp) {
      const diff = new Date(projection.firstWinTimestamp).getTime() - new Date(projection.signupTimestamp).getTime();
      if (diff > 0) timeToValueMs = diff;
    }

    // 3. Calcula Engagement Score (0-100)
    // Combina sessões acumuladas, taxas de conclusão de hábitos e tarefas
    const taskRate = projection.tasks.createdCount > 0 
      ? (projection.tasks.completedCount / projection.tasks.createdCount) 
      : 0;
    const sessionScore = Math.min(projection.sessions.count * 5, 40); // até 40 pontos por sessões
    const engagementScore = Math.min(Math.round((taskRate * 60) + sessionScore), 100);

    // 4. Deriva o Estágio de Retenção
    const daysSinceActive = daysSince(projection.sessions.lastActive);
    let stage = 'new';

    if (daysSinceActive > 30) {
      stage = 'churned';
    } else if (daysSinceActive > 7) {
      stage = 'at_risk';
    } else if (!projection.onboarding.completed || projection.tasks.completedCount === 0) {
      stage = 'new';
    } else if (projection.tasks.completedCount >= 5 || projection.habits.completedCount >= 3) {
      stage = 'engaged';
    } else {
      stage = 'activated';
    }

    return {
      stage,
      activation_score:    activationScore,
      engagement_score:    engagementScore,
      last_success_action: projection.firstWinTimestamp,
      time_to_value_ms:    timeToValueMs,
      days_since_active:   daysSinceActive === Infinity ? 0 : Math.floor(daysSinceActive),
      has_first_success:   !!projection.firstWinTimestamp,
      sessions_count:      projection.sessions.count,
      onboarding_step:     projection.onboarding.step,
      onboarding_completed:projection.onboarding.completed,
      projected_tasks:     projection.tasks.list,

      // Prompt 3.0 explicit fields:
      activationScore,
      engagementScore,
      timeToValue:         timeToValueMs,
      onboardingCompleted: projection.onboarding.completed,
      stats: {
        tasksCreated:      projection.tasks.createdCount,
        tasksCompleted:    projection.tasks.completedCount,
        habitsCreated:     projection.habits.createdCount,
        goalsCreated:      projection.goals.createdCount
      }
    };
  }
};
