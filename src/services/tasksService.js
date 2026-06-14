import { supabase } from '../supabaseClient';
import { enqueue } from './syncQueue';

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
  completedAt: t.completed_at || null,
});

// Guard: bloqueia queries sem usuário autenticado
const requireUser = (userId) => {
  if (!userId) throw new Error('[tasksService] userId obrigatório — usuário não autenticado');
};

export const tasksService = {
  /**
   * Carrega todas as tarefas do usuário.
   * Em caso de falha, retorna array vazio (não bloqueia o app).
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
      console.warn('[tasksService.getAll] Falha ao carregar tarefas — usando estado local:', error.message);
      return { data: [], error, degraded: true };
    }
  },

  /**
   * Cria uma nova tarefa.
   * Se Supabase falhar, retorna um objeto otimista com id temporário
   * e enfileira o retry — a UI nunca trava.
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
          completed_at: null,
        }])
        .select()
        .single();

      if (error) throw error;
      return { data: mapTask(data), error: null };
    } catch (error) {
      console.warn('[tasksService.create] Falha ao criar tarefa no Supabase — modo otimista:', error.message);
      // Retorna objeto otimista com ID temporário para a UI não travar
      const optimistic = {
        id: `temp_${Date.now()}`,
        title: taskData.title,
        description: taskData.description || '',
        category: taskData.category,
        priority: taskData.priority,
        dueDate: taskData.dueDate || '',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      enqueue('task_create', { userId, taskData });
      return { data: optimistic, error, degraded: true };
    }
  },

  /**
   * Atualiza campos de uma tarefa existente.
   */
  update: async (userId, id, updates) => {
    requireUser(userId);
    // Tarefas temporárias (id começa com 'temp_') não podem ser atualizadas no Supabase ainda
    if (String(id).startsWith('temp_')) {
      console.warn('[tasksService.update] Task temporária, update apenas local');
      return { error: null, degraded: true };
    }
    try {
      const payload = {};
      if (updates.title !== undefined)       payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description || '';
      if (updates.category !== undefined)    payload.category = updates.category;
      if (updates.priority !== undefined)    payload.priority = updates.priority;
      if (updates.dueDate !== undefined)     payload.due_date = updates.dueDate || null;
      if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt;

      const { error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.warn('[tasksService.update] Falha — enfileirado para retry:', error.message);
      enqueue('task_update', { userId, id, updates });
      return { error, degraded: true };
    }
  },

  /**
   * Alterna o status de conclusão de uma tarefa.
   * Sempre retorna o novo estado para atualização otimista da UI.
   */
  toggleComplete: async (userId, id, currentCompleted) => {
    requireUser(userId);
    const next = !currentCompleted;
    const completedAt = next ? new Date().toISOString() : null;

    // Tarefas temporárias: apenas retorna o novo estado (sem sync)
    if (String(id).startsWith('temp_')) {
      return { data: next, completedAt, error: null, degraded: true };
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed: next, completed_at: completedAt })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { data: next, completedAt, error: null };
    } catch (error) {
      console.warn('[tasksService.toggleComplete] Falha — retorno otimista + retry enfileirado:', error.message);
      // UI atualiza imediatamente; Supabase sync fica na fila
      enqueue('task_update', { userId, id, updates: { completed: next, completedAt } });
      return { data: next, completedAt, error, degraded: true };
    }
  },

  /**
   * Exclui uma tarefa permanentemente.
   */
  delete: async (userId, id) => {
    requireUser(userId);
    // Tarefa temporária: remove apenas da UI
    if (String(id).startsWith('temp_')) {
      return { error: null };
    }
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.warn('[tasksService.delete] Falha ao excluir tarefa:', error.message);
      return { error, degraded: true };
    }
  },
};
