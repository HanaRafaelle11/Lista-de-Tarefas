import { supabase } from '../supabaseClient.js';
import { enqueue, generateId } from './syncQueue.js';
import { localDB } from '../db/localDB.js';

const requireUser = (userId) => {
  if (!userId) throw new Error('[goalsService] userId obrigatório — usuário não autenticado');
};

const mapGoal = (g) => {
  if (!g) return null;
  let start_time = g.start_time || null;
  let end_time = g.end_time || null;
  let cleanDescription = g.description || '';

  if (g.description && g.description.includes('--flowday-meta--')) {
    const parts = g.description.split('--flowday-meta--');
    cleanDescription = parts[0].trim();
    try {
      const meta = JSON.parse(parts[1].trim());
      if (meta.start_time !== undefined) start_time = meta.start_time;
      if (meta.end_time !== undefined) end_time = meta.end_time;
    } catch (e) {
      console.warn('[goalsService.mapGoal] Falha ao analisar metadados:', e.message);
    }
  }
  return {
    ...g,
    description: cleanDescription,
    start_time,
    end_time,
    deletedAt: g.deleted_at || null
  };
};

export const goalsService = {
  /**
   * Carrega todos os objetivos do usuário + tabela de vínculos.
   * Integra com IndexedDB para cache e suporte offline.
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

      const mappedGoals = (goalsData || []).map(mapGoal);

      let goalTasks = [];
      if (mappedGoals && mappedGoals.length > 0) {
        const { data: gtData, error: gte } = await supabase
          .from('goal_tasks')
          .select('goal_id, task_id')
          .in('goal_id', mappedGoals.map((g) => g.id));

        if (gte) throw gte;
        goalTasks = gtData || [];
      }

      // Sincroniza em background o cache do IndexedDB
      let allGoals = [...mappedGoals];
      try {
        const localGoals = await localDB.getAll('goals');
        const localDeleted = localGoals.filter(g => g.user_id === userId && g.deletedAt);
        allGoals = [...mappedGoals, ...localDeleted];

        await localDB.clear('goals');
        await localDB.putMany('goals', allGoals);
      } catch (err) {
        console.warn('[goalsService.getAll] Erro ao sincronizar cache local:', err.message);
      }

      return { data: { goals: allGoals, goalTasks }, error: null };
    } catch (error) {
      console.warn('[goalsService.getAll] Falha ao carregar objetivos — usando IndexedDB offline:', error.message);
      try {
        const localGoals = await localDB.getAll('goals');
        const userGoals = localGoals.filter(g => g.user_id === userId);
        return { data: { goals: userGoals, goalTasks: [] }, error, degraded: true };
      } catch (dbErr) {
        return { data: { goals: [], goalTasks: [] }, error: dbErr, degraded: true };
      }
    }
  },

  /**
   * Cria um novo objetivo.
   * Salva no cache local do IndexedDB e tenta enviar ao Supabase.
   */
  create: async (userId, goalData) => {
    requireUser(userId);
    const clientId = goalData.id || generateId();
    const nowIso = new Date().toISOString();

    const optimistic = {
      id:          clientId,
      user_id:     userId,
      title:       goalData.title,
      description: goalData.description || '',
      color:       goalData.color || '#4A654E',
      icon:        goalData.icon || '🎯',
      target_date: goalData.target_date || null,
      start_time:  goalData.start_time || null,
      end_time:    goalData.end_time || null,
      status:      'active',
      created_at:  nowIso,
      updated_at:  nowIso,
      deletedAt:   null
    };

    // 1. Salva no cache do localDB imediatamente
    try {
      await localDB.put('goals', optimistic);
    } catch (err) {
      console.warn('[goalsService.create] Erro ao salvar no cache local:', err.message);
    }

    try {
      // 1. Tentar gravar diretamente com colunas nativas
      const { data, error } = await supabase
        .from('goals')
        .insert([{
          id:          clientId,
          user_id:     userId,
          title:       goalData.title,
          description: goalData.description || '',
          color:       goalData.color || '#4A654E',
          icon:        goalData.icon || '🎯',
          target_date: goalData.target_date || null,
          start_time:  goalData.start_time || null,
          end_time:    goalData.end_time || null,
          status:      'active',
        }])
        .select()
        .single();

      if (error) {
        // Se falhar por coluna inexistente, usar o fallback de serialização na descrição
        if (error.code === 'PGRST204' || (error.message && error.message.includes("end_time"))) {
          console.warn('[goalsService.create] Colunas de horário não encontradas. Usando fallback de descrição...');
          const serializedMeta = {
            start_time: goalData.start_time || null,
            end_time: goalData.end_time || null
          };
          const cleanDesc = (goalData.description || '').split('\n\n--flowday-meta--')[0].trim();
          const enrichedDescription = `${cleanDesc}\n\n--flowday-meta--\n${JSON.stringify(serializedMeta)}`;

          const { data: fallbackData, error: fallbackError } = await supabase
            .from('goals')
            .insert([{
              id:          clientId,
              user_id:     userId,
              title:       goalData.title,
              description: enrichedDescription,
              color:       goalData.color || '#4A654E',
              icon:        goalData.icon || '🎯',
              target_date: goalData.target_date || null,
              status:      'active',
            }])
            .select()
            .single();

          if (fallbackError) throw fallbackError;
          return { data: mapGoal(fallbackData), error: null };
        }
        throw error;
      }
      return { data: mapGoal(data), error: null };
    } catch (error) {
      console.warn('[goalsService.create] Falha ao criar no Supabase — enfileirado para sync:', error.message);
      enqueue('goal_create', { userId, goalData, goalId: clientId }, clientId);
      return { data: optimistic, error, degraded: true };
    }
  },

  /**
   * Atualiza campos de um objetivo.
   * Atualiza cache local e sincroniza com o Supabase.
   */
  update: async (userId, id, updates) => {
    requireUser(userId);
    const nowIso = new Date().toISOString();

    // 1. Salva no cache do localDB imediatamente
    try {
      const existing = await localDB.get('goals', id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          updated_at: nowIso
        };
        await localDB.put('goals', updated);
      }
    } catch (err) {
      console.warn('[goalsService.update] Erro ao atualizar cache local:', err.message);
    }

    try {
      const payload = {};
      ['title', 'description', 'color', 'icon', 'status', 'start_time', 'end_time'].forEach((k) => {
        if (updates[k] !== undefined) payload[k] = updates[k];
      });
      if (updates.target_date !== undefined) payload.target_date = updates.target_date || null;

      // 1. Tentar atualizar diretamente com colunas nativas
      const { data, error } = await supabase
        .from('goals')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        // Se falhar por coluna inexistente, usar o fallback de serialização na descrição
        if (error.code === 'PGRST204' || (error.message && error.message.includes("end_time"))) {
          console.warn('[goalsService.update] Colunas de horário não encontradas. Usando fallback de descrição...');
          
          // Buscar objetivo atual para recuperar metadados existentes
          const { data: currentGoal, error: fetchErr } = await supabase
            .from('goals')
            .select('description')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

          if (fetchErr) throw fetchErr;

          let currentStart = null;
          let currentEnd = null;
          let currentDescClean = currentGoal.description || '';

          if (currentGoal.description && currentGoal.description.includes('--flowday-meta--')) {
            const parts = currentGoal.description.split('--flowday-meta--');
            currentDescClean = parts[0].trim();
            try {
              const meta = JSON.parse(parts[1].trim());
              currentStart = meta.start_time || null;
              currentEnd = meta.end_time || null;
            } catch (e) {}
          }

          const updatedDescClean = updates.description !== undefined ? (updates.description || '') : currentDescClean;
          const nextStart = updates.start_time !== undefined ? updates.start_time : currentStart;
          const nextEnd = updates.end_time !== undefined ? updates.end_time : currentEnd;

          const serializedMeta = {
            start_time: nextStart,
            end_time: nextEnd
          };
          const enrichedDescription = `${updatedDescClean}\n\n--flowday-meta--\n${JSON.stringify(serializedMeta)}`;

          const fallbackPayload = {};
          if (updates.title !== undefined) fallbackPayload.title = updates.title;
          fallbackPayload.description = enrichedDescription;
          if (updates.color !== undefined) fallbackPayload.color = updates.color;
          if (updates.icon !== undefined) fallbackPayload.icon = updates.icon;
          if (updates.status !== undefined) fallbackPayload.status = updates.status;
          if (updates.target_date !== undefined) fallbackPayload.target_date = updates.target_date || null;

          const { data: fallbackData, error: fallbackError } = await supabase
            .from('goals')
            .update(fallbackPayload)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

          if (fallbackError) throw fallbackError;
          return { data: mapGoal(fallbackData), error: null };
        }
        throw error;
      }
      return { data: mapGoal(data), error: null };
    } catch (error) {
      console.warn('[goalsService.update] Falha ao atualizar objetivo no Supabase — enfileirado para retry:', error.message);
      enqueue('goal_update', { userId, id, updates }, id);
      return { error, degraded: true };
    }
  },

  /**
   * Exclui um objetivo logicamente (Soft Delete).
   * Fallback: se a coluna deleted_at não existir no banco, faz hard delete no Supabase
   * mas mantém no IndexedDB para que apareça na lixeira.
   */
  delete: async (userId, id) => {
    requireUser(userId);
    const nowIso = new Date().toISOString();
    
    // 1. Marca como excluído logicamente no cache local (para UX de lixeira)
    try {
      const existing = await localDB.get('goals', id);
      if (existing) {
        existing.deletedAt = nowIso;
        await localDB.put('goals', existing);
      }
    } catch (err) {
      console.warn('[goalsService.delete] Erro ao marcar soft delete local:', err.message);
    }

    try {
      const { error } = await supabase
        .from('goals')
        .update({ deleted_at: nowIso })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        // Se a coluna deleted_at não existe no banco (42703), fazer hard delete
        if (error.code === '42703' || (error.message && error.message.includes('deleted_at'))) {
          console.warn('[goalsService.delete] Coluna deleted_at ausente — executando hard delete no Supabase.');
          const { error: hardError } = await supabase
            .from('goals')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
          if (hardError) {
            enqueue('goal_delete', { userId, id });
            return { error: hardError, degraded: true };
          }
          // Mantém no cache local com deletedAt para que vá para a lixeira
          return { error: null };
        }
        throw error;
      }
      return { error: null };
    } catch (error) {
      console.warn('[goalsService.delete] Falha ao excluir no Supabase — enfileirado:', error.message);
      enqueue('goal_delete', { userId, id });
      return { error, degraded: true };
    }
  },

  /**
   * Exclui um objetivo permanentemente (Hard Delete).
   */
  deletePermanent: async (userId, id) => {
    requireUser(userId);
    
    // 1. Remove do cache local
    try {
      await localDB.delete('goals', id);
    } catch (err) {
      console.warn('[goalsService.deletePermanent] Erro ao excluir do cache local:', err.message);
    }

    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.warn('[goalsService.deletePermanent] Falha ao excluir do Supabase — enfileirado:', error.message);
      enqueue('goal_delete', { userId, id });
      return { error, degraded: true };
    }
  },

  /**
   * Restaura um objetivo.
   * Recria o registro (upsert) no Supabase caso ele tenha sido hard-deleted.
   */
  restore: async (userId, id) => {
    requireUser(userId);
    
    try {
      const existing = await localDB.get('goals', id);
      if (existing) {
        existing.deletedAt = null;
        await localDB.put('goals', existing);

        // Tenta upsert para recriar no Supabase caso tenha sido hard-deleted
        const { error } = await supabase
          .from('goals')
          .upsert({
            id:          existing.id,
            user_id:     userId,
            title:       existing.title,
            description: existing.description || '',
            color:       existing.color || '#4A654E',
            icon:        existing.icon || '🎯',
            target_date: existing.target_date || null,
            status:      existing.status || 'active',
            start_time:  existing.start_time || null,
            end_time:    existing.end_time || null,
            deleted_at:  null
          });

        if (error) {
          // Se a coluna deleted_at ou start_time/end_time não existe no banco, tenta o fallback de descrição
          if (error.code === '42703' || error.code === 'PGRST204' || (error.message && (error.message.includes('deleted_at') || error.message.includes('end_time')))) {
            const serializedMeta = {
              start_time: existing.start_time || null,
              end_time: existing.end_time || null
            };
            const cleanDesc = (existing.description || '').split('\n\n--flowday-meta--')[0].trim();
            const enrichedDescription = `${cleanDesc}\n\n--flowday-meta--\n${JSON.stringify(serializedMeta)}`;

            const { error: upsertErr } = await supabase
              .from('goals')
              .upsert({
                id:          existing.id,
                user_id:     userId,
                title:       existing.title,
                description: enrichedDescription,
                color:       existing.color || '#4A654E',
                icon:        existing.icon || '🎯',
                target_date: existing.target_date || null,
                status:      existing.status || 'active'
              });
            if (upsertErr) throw upsertErr;
          } else {
            throw error;
          }
        }
      }
      return { error: null };
    } catch (error) {
      console.warn('[goalsService.restore] Erro ao restaurar objetivo:', error.message);
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
