import { supabase } from '../supabaseClient.js';

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

      return { data: { goals: mappedGoals, goalTasks }, error: null };
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
      // 1. Tentar gravar diretamente com colunas nativas
      const { data, error } = await supabase
        .from('goals')
        .insert([{
          user_id: userId,
          title: goalData.title,
          description: goalData.description || '',
          color: goalData.color || '#4A654E',
          icon: goalData.icon || '🎯',
          target_date: goalData.target_date || null,
          start_time: goalData.start_time || null,
          end_time: goalData.end_time || null,
          status: 'active',
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
              user_id: userId,
              title: goalData.title,
              description: enrichedDescription,
              color: goalData.color || '#4A654E',
              icon: goalData.icon || '🎯',
              target_date: goalData.target_date || null,
              status: 'active',
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
      console.error('[goalsService.update]', error);
      return { data: null, error };
    }
  },

  /**
   * Exclui um objetivo logicamente (Soft Delete).
   */
  delete: async (userId, id) => {
    requireUser(userId);
    const nowIso = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('goals')
        .update({ deleted_at: nowIso })
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
   * Exclui um objetivo permanentemente (Hard Delete).
   */
  deletePermanent: async (userId, id) => {
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
      console.error('[goalsService.deletePermanent]', error);
      return { error };
    }
  },

  /**
   * Restaura um objetivo (limpa deleted_at).
   */
  restore: async (userId, id) => {
    requireUser(userId);
    try {
      const { error } = await supabase
        .from('goals')
        .update({ deleted_at: null })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[goalsService.restore]', error);
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
