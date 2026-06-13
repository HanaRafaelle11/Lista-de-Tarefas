import { supabase } from '../supabaseClient';

const requireUser = (userId) => {
  if (!userId) throw new Error('[goalsService] userId obrigatório — usuário não autenticado');
};

export const goalsService = {
  /**
   * Carrega todos os objetivos do usuário + tabela de vínculos.
   */
  getAll: async (userId) => {
    requireUser(userId);
    try {
      const { data: goalsData, error: ge } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (ge) throw ge;

      let goalTasks = [];
      if (goalsData && goalsData.length > 0) {
        const { data: gtData, error: gte } = await supabase
          .from('goal_tasks')
          .select('goal_id, task_id')
          .in('goal_id', goalsData.map((g) => g.id));

        if (gte) throw gte;
        goalTasks = gtData || [];
      }

      return { data: { goals: goalsData || [], goalTasks }, error: null };
    } catch (error) {
      console.error('[goalsService.getAll]', error);
      return { data: null, error };
    }
  },

  /**
   * Cria um novo objetivo.
   */
  create: async (userId, goalData) => {
    requireUser(userId);
    try {
      const { data, error } = await supabase
        .from('goals')
        .insert([{
          user_id: userId,
          title: goalData.title,
          description: goalData.description || '',
          color: goalData.color || '#4A654E',
          icon: goalData.icon || '🎯',
          target_date: goalData.target_date || null,
          status: 'active',
        }])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[goalsService.create]', error);
      return { data: null, error };
    }
  },

  /**
   * Atualiza campos de um objetivo.
   */
  update: async (userId, id, updates) => {
    requireUser(userId);
    try {
      const payload = {};
      ['title', 'description', 'color', 'icon', 'status'].forEach((k) => {
        if (updates[k] !== undefined) payload[k] = updates[k];
      });
      if (updates.target_date !== undefined) payload.target_date = updates.target_date || null;

      const { error } = await supabase
        .from('goals')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { data: payload, error: null };
    } catch (error) {
      console.error('[goalsService.update]', error);
      return { data: null, error };
    }
  },

  /**
   * Exclui um objetivo.
   */
  delete: async (userId, id) => {
    requireUser(userId);
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[goalsService.delete]', error);
      return { error };
    }
  },

  /**
   * Vincula uma tarefa a um objetivo.
   */
  linkTask: async (goalId, taskId) => {
    try {
      const { error } = await supabase
        .from('goal_tasks')
        .insert([{ goal_id: goalId, task_id: taskId }]);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[goalsService.linkTask]', error);
      return { error };
    }
  },

  /**
   * Remove o vínculo entre tarefa e objetivo.
   */
  unlinkTask: async (goalId, taskId) => {
    try {
      const { error } = await supabase
        .from('goal_tasks')
        .delete()
        .eq('goal_id', goalId)
        .eq('task_id', taskId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[goalsService.unlinkTask]', error);
      return { error };
    }
  },
};
