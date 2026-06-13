import { supabase } from '../supabaseClient';

// Mapper: converte registro do banco para objeto do app
const mapTask = (t) => ({
  id: t.id,
  title: t.title,
  description: t.description || '',
  category: t.category,
  priority: t.priority,
  dueDate: t.due_date || '',
  completed: t.completed,
  createdAt: t.created_at,
});

// Guard: bloqueia queries sem usuário autenticado
const requireUser = (userId) => {
  if (!userId) throw new Error('[tasksService] userId obrigatório — usuário não autenticado');
};

export const tasksService = {
  /**
   * Carrega todas as tarefas do usuário.
   * @returns {{ data: Task[], error: null } | { data: null, error: Error }}
   */
  getAll: async (userId) => {
    requireUser(userId);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: (data || []).map(mapTask), error: null };
    } catch (error) {
      console.error('[tasksService.getAll]', error);
      return { data: null, error };
    }
  },

  /**
   * Cria uma nova tarefa.
   */
  create: async (userId, taskData) => {
    requireUser(userId);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          user_id: userId,
          title: taskData.title,
          description: taskData.description || '',
          category: taskData.category,
          priority: taskData.priority,
          due_date: taskData.dueDate || null,
          completed: false,
        }])
        .select()
        .single();

      if (error) throw error;
      return { data: mapTask(data), error: null };
    } catch (error) {
      console.error('[tasksService.create]', error);
      return { data: null, error };
    }
  },

  /**
   * Atualiza campos de uma tarefa existente.
   */
  update: async (userId, id, updates) => {
    requireUser(userId);
    try {
      const payload = {};
      if (updates.title !== undefined)       payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description || '';
      if (updates.category !== undefined)    payload.category = updates.category;
      if (updates.priority !== undefined)    payload.priority = updates.priority;
      if (updates.dueDate !== undefined)     payload.due_date = updates.dueDate || null;

      const { error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId); // double-check ownership

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[tasksService.update]', error);
      return { error };
    }
  },

  /**
   * Alterna o status de conclusão de uma tarefa.
   */
  toggleComplete: async (userId, id, currentCompleted) => {
    requireUser(userId);
    try {
      const next = !currentCompleted;
      const { error } = await supabase
        .from('tasks')
        .update({ completed: next })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { data: next, error: null };
    } catch (error) {
      console.error('[tasksService.toggleComplete]', error);
      return { data: null, error };
    }
  },

  /**
   * Exclui uma tarefa permanentemente.
   */
  delete: async (userId, id) => {
    requireUser(userId);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[tasksService.delete]', error);
      return { error };
    }
  },
};
