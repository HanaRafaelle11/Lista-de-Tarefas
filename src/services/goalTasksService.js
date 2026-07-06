import { supabase } from '../supabaseClient.js';
import { enqueue, dequeue } from './syncQueue.js';
import { localDB } from '../db/localDB.js';

const log = (...args) => console.log('[GOAL_TASKS_SERVICE]', ...args);

/**
 * Service responsável exclusivamente por vínculos goal <-> task
 * na tabela goal_tasks do Supabase e IndexedDB.
 */
export const goalTasksService = {
  /**
   * Vincula uma tarefa a um objetivo.
   * @param {string} goalId
   * @param {string} taskId
   * @returns {{ error: Error|null }}
   */
  link: async (goalId, taskId) => {
    const linkId = `${goalId}_${taskId}`;
    const linkData = { id: linkId, goal_id: goalId, task_id: taskId };

    // 1. Salva no IndexedDB local
    try {
      await localDB.put('goal_tasks', linkData);
    } catch (err) {
      console.warn('[goalTasksService.link] Erro ao salvar no cache local:', err.message);
    }

    // 2. Enfileira a sync
    enqueue('goal_tasks_link', { goalId, taskId }, linkId);

    // 3. Tenta enviar para o Supabase
    try {
      log('link start', { goalId, taskId });
      const { error } = await supabase
        .from('goal_tasks')
        .insert([{ goal_id: goalId, task_id: taskId }]);

      if (error && error.code !== '23505') throw error;

      // Sucesso: remove da fila
      dequeue(linkId);
      return { error: null };
    } catch (error) {
      log('link failed -> queued', error.message);
      return { error, degraded: true };
    }
  },

  /**
   * Remove o vínculo entre tarefa e objetivo.
   * @param {string} goalId
   * @param {string} taskId
   * @returns {{ error: Error|null }}
   */
  unlink: async (goalId, taskId) => {
    const linkId = `${goalId}_${taskId}`;

    // 1. Remove do IndexedDB local
    try {
      await localDB.delete('goal_tasks', linkId);
    } catch (err) {
      console.warn('[goalTasksService.unlink] Erro ao deletar no cache local:', err.message);
    }

    // 2. Enfileira a sync
    enqueue('goal_tasks_unlink', { goalId, taskId }, linkId);

    // 3. Tenta enviar para o Supabase
    try {
      log('unlink start', { goalId, taskId });
      const { error } = await supabase
        .from('goal_tasks')
        .delete()
        .eq('goal_id', goalId)
        .eq('task_id', taskId);

      if (error) throw error;

      // Sucesso: remove da fila
      dequeue(linkId);
      return { error: null };
    } catch (error) {
      log('unlink failed -> queued', error.message);
      return { error, degraded: true };
    }
  }
};
