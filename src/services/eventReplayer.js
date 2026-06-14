/**
 * eventReplayer.js — Mecanismo de Replay de Eventos
 *
 * Lê um histórico ordenado de eventos (event stream) e projeta
 * estados consolidados de tarefas, onboarding e metas do usuário.
 * Garante reprodutibilidade total do estado independente do Supabase.
 */

export const eventReplayer = {
  /**
   * Reconstrói o estado projetado a partir de um log de eventos.
   *
   * @param {Array} events - stream de eventos ordenados por data
   * @returns {object} Projeção final do estado
   */
  replay(events = []) {
    // Estado inicial de projeção
    const projection = {
      onboarding: {
        started: false,
        completed: false,
        step: 0
      },
      tasks: {
        createdCount: 0,
        completedCount: 0,
        list: [] // projeção re-hidratada de tasks
      },
      sessions: {
        count: 0,
        lastActive: null
      },
      habits: {
        createdCount: 0,
        completedCount: 0
      },
      goals: {
        createdCount: 0
      },
      firstWinTimestamp: null,
      signupTimestamp: null
    };

    for (const ev of events) {
      const { event_type, metadata, created_at } = ev;

      switch (event_type) {
        case 'signup_completed':
        case 'signup':
          projection.signupTimestamp = created_at;
          break;

        case 'onboarding_started':
          projection.onboarding.started = true;
          projection.onboarding.step = 1;
          break;

        case 'onboarding_step':
          if (metadata && metadata.step !== undefined) {
            projection.onboarding.step = Math.max(projection.onboarding.step, metadata.step);
          }
          break;

        case 'onboarding_completed':
          projection.onboarding.completed = true;
          projection.onboarding.step = 5;
          break;

        case 'session_started':
          projection.sessions.count += 1;
          projection.sessions.lastActive = created_at;
          break;

        case 'session_ended':
          projection.sessions.lastActive = created_at;
          break;

        case 'task_created':
        case 'task_create':
          projection.tasks.createdCount += 1;
          if (metadata && metadata.taskId) {
            projection.tasks.list.push({
              id: metadata.taskId,
              title: metadata.title || 'Tarefa sem título',
              completed: false,
              completedAt: null,
              createdAt: created_at,
              updatedAt: created_at
            });
          }
          break;

        case 'task_completed':
          projection.tasks.completedCount += 1;
          if (!projection.firstWinTimestamp) {
            projection.firstWinTimestamp = created_at;
          }
          if (metadata && metadata.taskId) {
            const task = projection.tasks.list.find(t => t.id === metadata.taskId);
            if (task) {
              task.completed = true;
              task.completedAt = created_at;
              task.updatedAt = created_at;
            }
          }
          break;

        case 'first_success_action':
          if (!projection.firstWinTimestamp) {
            projection.firstWinTimestamp = created_at;
          }
          break;

        case 'task_update':
          if (metadata && metadata.taskId) {
            const task = projection.tasks.list.find(t => t.id === metadata.taskId);
            if (task) {
              Object.assign(task, metadata.updates || {});
              task.updatedAt = created_at;
            }
          }
          break;

        case 'task_delete':
          if (metadata && metadata.taskId) {
            projection.tasks.list = projection.tasks.list.filter(t => t.id !== metadata.taskId);
          }
          break;

        case 'habit_created':
          projection.habits.createdCount += 1;
          break;

        case 'habit_completed':
          projection.habits.completedCount += 1;
          break;

        case 'goal_created':
          projection.goals.createdCount += 1;
          break;
      }
    }

    return projection;
  }
};
