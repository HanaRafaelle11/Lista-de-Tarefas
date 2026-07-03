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
      if (!ev) continue;
      try {
        const { event_type, metadata, created_at, event_version = 1 } = ev;
        const normMetadata = metadata || {};

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
            if (normMetadata && normMetadata.step !== undefined) {
              projection.onboarding.step = Math.max(projection.onboarding.step, normMetadata.step);
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
            if (normMetadata && normMetadata.taskId) {
              projection.tasks.list.push({
                id: normMetadata.taskId,
                title: normMetadata.title || 'Tarefa sem título',
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
            if (normMetadata && normMetadata.taskId) {
              const task = projection.tasks.list.find(t => t.id === normMetadata.taskId);
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

          case 'task_updated':
          case 'task_update': {
            const updId = normMetadata && (normMetadata.taskId || normMetadata.task_id);
            if (updId) {
              const task = projection.tasks.list.find(t => t.id === updId);
              if (task) {
                Object.assign(task, normMetadata.updates || {});
                task.updatedAt = created_at;
              }
            }
            break;
          }

          case 'task_deleted':
          case 'task_delete': {
            const delId = normMetadata && (normMetadata.taskId || normMetadata.task_id);
            if (delId) {
              projection.tasks.list = projection.tasks.list.filter(t => t.id !== delId);
            }
            break;
          }

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
      } catch (err) {
        console.error(`[eventReplayer] Falha ao reprocessar evento tipo="${ev?.event_type}" id="${ev?.id}":`, err);
      }
    }

    return projection;
  }
};
