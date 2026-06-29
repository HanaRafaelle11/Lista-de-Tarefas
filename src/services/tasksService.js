import { supabase } from '../supabaseClient';
import { enqueue, generateId } from './syncQueue';
import { localDB } from '../db/localDB';

// Mapper: converte registro do banco para objeto do app
const mapTask = (t) => ({
  id: t.id,
  user_id: t.user_id,
  title: t.title,
  description: t.description || '',
  category: t.category,
  priority: t.priority,
  dueDate: t.due_date || '',
  completed: t.completed,
  createdAt: t.created_at || new Date().toISOString(),
  completedAt: t.completed_at || null,
  updatedAt: t.updated_at || new Date().toISOString(),
  deletedAt: t.deleted_at || null
});

// Guard: bloqueia queries sem usuário autenticado
const requireUser = (userId) => {
  if (!userId) throw new Error('[tasksService] userId obrigatório — usuário não autenticado');
};

export const tasksService = {
  /**
   * Carrega todas as tarefas do usuário.
   * Se der sucesso, atualiza o cache do IndexedDB.
   * Se falhar (offline), retorna os dados locais do IndexedDB.
   */
  getAll: async (userId) => {
    requireUser(userId);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mapped = (data || []).map(mapTask);
      
      try {
        await localDB.clear('tasks');
        await localDB.putMany('tasks', mapped);
      } catch (err) {
        console.warn('[tasksService.getAll] Erro ao sincronizar com cache local:', err.message);
      }

      return { data: mapped, error: null };
    } catch (error) {
      console.warn('[tasksService.getAll] Falha ao carregar tarefas — usando IndexedDB offline:', error.message);
      try {
        const localTasks = await localDB.getAll('tasks');
        const userTasks = localTasks.filter(t => t.user_id === userId);
        return { data: userTasks, error, degraded: true };
      } catch (dbErr) {
        return { data: [], error: dbErr, degraded: true };
      }
    }
  },

  /**
   * Cria uma nova tarefa.
   * Salva no cache local IndexedDB imediatamente e tenta enviar ao Supabase.
   */
  create: async (userId, taskData) => {
    requireUser(userId);
    const clientId = generateId();
    const nowIso = new Date().toISOString();
    
    const optimistic = {
      id:          clientId,
      user_id:     userId,
      title:       taskData.title,
      description: taskData.description || '',
      category:    taskData.category,
      priority:    taskData.priority,
      dueDate:     taskData.dueDate || '',
      completed:   false,
      createdAt:   nowIso,
      completedAt: null,
      updatedAt:   nowIso
    };

    // 1. Salva no cache do IndexedDB imediatamente
    try {
      await localDB.put('tasks', optimistic);
    } catch (err) {
      console.warn('[tasksService.create] Erro ao salvar no cache local:', err.message);
    }

    // 2. Tenta enviar para o Supabase
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          id:          clientId,
          user_id:     userId,
          title:       taskData.title,
          description: taskData.description || '',
          category:    taskData.category,
          priority:    taskData.priority,
          due_date:    taskData.dueDate || null,
          completed:   false,
          completed_at: null
        }])
        .select()
        .single();

      if (error) throw error;
      return { data: mapTask(data), error: null };
    } catch (error) {
      console.warn('[tasksService.create] Falha ao criar no Supabase — enfileirado para sync:', error.message);
      enqueue('task_create', { userId, taskData, taskId: clientId }, clientId);
      return { data: optimistic, error, degraded: true };
    }
  },

  /**
   * Atualiza campos de uma tarefa existente.
   * Salva no cache local e tenta enviar ao Supabase.
   */
  update: async (userId, id, updates) => {
    requireUser(userId);
    const nowIso = new Date().toISOString();
    
    // 1. Atualiza no cache do IndexedDB
    try {
      const existing = await localDB.get('tasks', id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          updatedAt: nowIso
        };
        await localDB.put('tasks', updated);
      }
    } catch (err) {
      console.warn('[tasksService.update] Erro ao atualizar cache local:', err.message);
    }

    // 2. Tenta sincronizar com o Supabase
    try {
      const payload = {};
      if (updates.title !== undefined)       payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description || '';
      if (updates.category !== undefined)    payload.category = updates.category;
      if (updates.priority !== undefined)    payload.priority = updates.priority;
      if (updates.dueDate !== undefined)     payload.due_date = updates.dueDate || null;
      if (updates.completed !== undefined)   payload.completed = updates.completed;
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
      const queueUpdates = { ...updates, updated_at: nowIso };
      enqueue('task_update', { userId, id, updates: queueUpdates });
      return { error, degraded: true };
    }
  },

  /**
   * Alterna o status de conclusão de uma tarefa.
   * Atualiza localDB imediatamente e sincroniza.
   */
  toggleComplete: async (userId, id, currentCompleted) => {
    requireUser(userId);
    const next        = !currentCompleted;
    const completedAt = next ? new Date().toISOString() : null;
    
    return tasksService.update(userId, id, { completed: next, completedAt });
  },

  /**
   * Exclui uma tarefa logicamente (Soft Delete).
   * Define deletedAt no cache local e tenta sincronizar com o Supabase.
   * Fallback: se a coluna deleted_at não existir no banco, faz hard delete.
   */
  delete: async (userId, id) => {
    requireUser(userId);
    const nowIso = new Date().toISOString();
    
    // 1. Marca como excluído logicamente no cache local (para UX de undo)
    try {
      const existing = await localDB.get('tasks', id);
      if (existing) {
        existing.deletedAt = nowIso;
        await localDB.put('tasks', existing);
      }
    } catch (err) {
      console.warn('[tasksService.delete] Erro ao marcar soft delete local:', err.message);
    }

    // 2. Tenta fazer soft delete (UPDATE deleted_at) no Supabase
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ deleted_at: nowIso })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        // Se a coluna deleted_at não existe no banco (42703), fazer hard delete
        if (error.code === '42703' || (error.message && error.message.includes('deleted_at'))) {
          console.warn('[tasksService.delete] Coluna deleted_at ausente — executando hard delete no Supabase.');
          const { error: hardError } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
          if (hardError) {
            enqueue('task_delete', { userId, id });
            return { error: hardError, degraded: true };
          }
          // Mantém no cache local com deletedAt para que vá para a lixeira
          return { error: null };
        }
        throw error;
      }
      return { error: null };
    } catch (error) {
      console.warn('[tasksService.delete] Falha ao excluir no Supabase — enfileirado:', error.message);
      enqueue('task_delete', { userId, id });
      return { error, degraded: true };
    }
  },

  /**
   * Exclui uma tarefa permanentemente (Hard Delete).
   */
  deletePermanent: async (userId, id) => {
    requireUser(userId);
    
    // 1. Remove do cache local
    try {
      await localDB.delete('tasks', id);
    } catch (err) {
      console.warn('[tasksService.deletePermanent] Erro ao excluir do cache local:', err.message);
    }

    // 2. Tenta deletar no Supabase
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.warn('[tasksService.deletePermanent] Falha ao excluir fisicamente do Supabase — enfileirado:', error.message);
      enqueue('task_delete', { userId, id });
      return { error, degraded: true };
    }
  },

  /**
   * Restaura uma tarefa soft-deletada (limpa deletedAt no cache local).
   * Como deleted_at pode não existir no banco, apenas restaura o cache local.
   */
  restore: async (userId, id) => {
    requireUser(userId);
    
    try {
      const existing = await localDB.get('tasks', id);
      if (existing) {
        existing.deletedAt = null;
        await localDB.put('tasks', existing);

        // Tenta upsert para recriar no Supabase caso tenha sido hard-deleted
        const { error } = await supabase
          .from('tasks')
          .upsert({
            id:          existing.id,
            user_id:     userId,
            title:       existing.title,
            description: existing.description || '',
            category:    existing.category || 'Pessoal',
            priority:    existing.priority || 'Média',
            due_date:    existing.dueDate || null,
            completed:   existing.completed || false,
            completed_at: existing.completedAt || null,
            deleted_at:  null
          });

        if (error) {
          // Se a coluna deleted_at não existe no banco, tenta sem ela
          if (error.code === '42703' || (error.message && error.message.includes('deleted_at'))) {
            const { error: upsertErr } = await supabase
              .from('tasks')
              .upsert({
                id:          existing.id,
                user_id:     userId,
                title:       existing.title,
                description: existing.description || '',
                category:    existing.category || 'Pessoal',
                priority:    existing.priority || 'Média',
                due_date:    existing.dueDate || null,
                completed:   existing.completed || false,
                completed_at: existing.completedAt || null
              });
            if (upsertErr) throw upsertErr;
          } else {
            throw error;
          }
        }
      }
      return { error: null };
    } catch (error) {
      console.warn('[tasksService.restore] Erro ao restaurar:', error.message);
      return { error };
    }
  },
};
