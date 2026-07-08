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

let lastValidState = null;

export const stateEngine = {
  /**
   * Reconstrói o estado comportamental completo do usuário.
   *
   * @param {Array} events - stream de eventos do usuário
   * @returns {object} Projeção consolidade do estado de ativação e retenção
   */
  computeUserState(events = []) {
    try {
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
      const taskRate = projection.tasks.createdCount > 0 
        ? (projection.tasks.completedCount / projection.tasks.createdCount) 
        : 0;
      const sessionScore = Math.min(projection.sessions.count * 5, 40);
      const engagementScore = Math.min(Math.round((taskRate * 60) + sessionScore), 100);

      // 4. Deriva o Estágio de Retenção
      const daysSinceActive = daysSince(projection.sessions.lastActive);
      let stage = 'new';

      if (daysSinceActive > 30) {
        stage = 'churned';
      } else if (daysSinceActive > 7) {
        stage = 'at_risk';
      } else if (!projection.onboarding.completed || projection.tasks.createdCount === 0) {
        stage = 'new';
      } else if (projection.tasks.completedCount >= 5) {
        stage = 'engaged';
      } else {
        stage = 'activated';
      }

      const userState = {
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
          goalsCreated:      projection.goals.createdCount,
          sessions:          projection.focusSessions.count
        }
      };

      // Salva snapshot no cache e no localStorage
      lastValidState = userState;
      if (window.BETA_SAFE_MODE) {
        try {
          localStorage.setItem('flowday_userstate_snapshot', JSON.stringify(userState));
        } catch (e) {
          console.warn('[stateEngine] Falha ao salvar snapshot no localStorage:', e);
        }
      }

      return userState;
    } catch (err) {
      console.error('[stateEngine] Falha crítica ao computar userState, aplicando fallback:', err);
      if (lastValidState) return lastValidState;
      try {
        const saved = localStorage.getItem('flowday_userstate_snapshot');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('[stateEngine] Erro ao carregar snapshot salvo:', e);
      }
      return {
        stage: 'new',
        activationScore: 0,
        engagementScore: 0,
        timeToValue: null,
        onboardingCompleted: false,
        stats: {
          tasksCreated: 0,
          tasksCompleted: 0,
          habitsCreated: 0,
          goalsCreated: 0,
          sessions: 0
        }
      };
    }
  }
};
