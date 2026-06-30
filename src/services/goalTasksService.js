import { supabase } from '../supabaseClient.js';

const log = (...args) => console.log('[GOAL_TASKS_SERVICE]', ...args);

/**
 * Service responsável exclusivamente por vínculos goal <-> task
 * na tabela goal_tasks do Supabase.
 */
export const goalTasksService = {
  /**
   * Vincula uma tarefa a um objetivo.
   * @param {string} goalId
   * @param {string} taskId
   * @returns {{ error: Error|null }}
   */
  link: async (goalId, taskId) => {
    try {
      log('link', { goalId, taskId });

      const { error } = await supabase
        .from('goal_tasks')
        .insert([{ goal_id: goalId, task_id: taskId }]);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      log('link failed', error.message);
      return { error };
    }
  },

  /**
   * Remove o vínculo entre tarefa e objetivo.
   * @param {string} goalId
   * @param {string} taskId
   * @returns {{ error: Error|null }}
   */
  unlink: async (goalId, taskId) => {
    try {
      log('unlink', { goalId, taskId });

      const { error } = await supabase
        .from('goal_tasks')
        .delete()
        .eq('goal_id', goalId)
        .eq('task_id', taskId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      log('unlink failed', error.message);
      return { error };
    }
  }
};
