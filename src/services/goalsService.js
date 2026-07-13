import { supabase } from '../supabaseClient.js';
import { enqueue, dequeue, generateId } from './syncQueue.js';
import { localDB } from '../db/localDB.js';
import { goalTasksService } from './goalTasksService.js';
import { goalMediaService } from './goalMediaService.js';

const DEBUG = true;

const log = (...args) => {
  if (DEBUG) console.log('[GOALS_SERVICE]', ...args);
};

const requireUser = (userId) => {
  if (!userId) throw new Error('[goalsService] userId obrigatório — usuário não autenticado');
};

const mapGoal = (g) => {
  if (!g) return null;

  let start_time = g.start_time || null;
  let end_time = g.end_time || null;
  let attachments = [];
  let cleanDescription = g.description || '';

  if (g.description && g.description.includes('--flowday-meta--')) {
    const parts = g.description.split('--flowday-meta--');
    cleanDescription = parts[0].trim();

    try {
      const meta = JSON.parse(parts[1].trim());
      if (meta.start_time !== undefined) start_time = meta.start_time;
      if (meta.end_time !== undefined) end_time = meta.end_time;
      if (meta.attachments !== undefined) attachments = meta.attachments;
    } catch (e) {
      log('mapGoal parse error:', e.message);
    }
  }

  return {
    ...g,
    description: cleanDescription,
    start_time,
    end_time,
    attachments,
    deletedAt: g.deleted_at || null
  };
};

const buildEnrichedDescription = (description, start_time, end_time, attachments = []) => {
  const cleanDesc = (description || '').split('--flowday-meta--')[0].trim();

  const serializedMeta = {
    start_time: start_time || null,
    end_time: end_time || null,
    attachments: attachments || []
  };

  return `${cleanDesc}\n\n--flowday-meta--\n${JSON.stringify(serializedMeta)}`;
};

export const goalsService = {

  getAll: async (userId) => {
    requireUser(userId);

    try {
      log('getAll start', userId);

      let goalsData;
      let ge;

      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await supabase
          .from('goals')
          .select('*')
          .eq('user_id', userId)
          .or(`deleted_at.is.null,deleted_at.gte.${thirtyDaysAgo.toISOString()}`)
          .order('created_at', { ascending: false });

        goalsData = result.data;
        ge = result.error;

        if (ge && (ge.code === '42703' || ge.message?.includes('deleted_at'))) {
          log('fallback deleted_at');
          const fallback = await supabase
            .from('goals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          goalsData = fallback.data;
          ge = fallback.error;
        }
      } catch (e) {
        log('query crash fallback', e.message);

        const fallback = await supabase
          .from('goals')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        goalsData = fallback.data;
        ge = fallback.error;
      }

      if (ge) throw ge;

      const mappedGoals = (goalsData || []).map(mapGoal);

      let goalTasks = [];

      if (mappedGoals.length > 0) {
        const { data, error } = await supabase
          .from('goal_tasks')
          .select('goal_id, task_id')
          .in('goal_id', mappedGoals.map(g => g.id));

        if (error) throw error;
        goalTasks = data || [];

        // Atualiza cache local com os dados mais recentes do Supabase
        try {
          await localDB.clear('goal_tasks');
          const localItems = goalTasks.map(gt => ({
            id: `${gt.goal_id}_${gt.task_id}`,
            goal_id: gt.goal_id,
            task_id: gt.task_id
          }));
          await localDB.putMany('goal_tasks', localItems);
        } catch (e) {
          log('failed to update cache for goal_tasks', e.message);
        }
      }

      let allGoals = [...mappedGoals];

      try {
        const localGoals = await localDB.getAll('goals');
        const pendingOps = await localDB.getAll('pendingOps');

        const pendingCreateIds = new Set(
          pendingOps
            .filter(op => op.type === 'goal_create')
            .map(op => op.payload?.goalId || op.payload?.id)
            .filter(Boolean)
        );

        // REGRA CRÍTICA: Supabase é source of truth.
        // Só re-injetar goals locais que:
        //   1. NÃO existem no Supabase (pendentes de sync de criação)
        //   2. NÃO estão marcados como deletados localmente
        //   3. TÊM operação pendente de criação na fila
        const unsyncedToKeep = localGoals.filter(lg =>
          lg.user_id === userId &&
          !lg.deletedAt &&
          !mappedGoals.some(mg => mg.id === lg.id) &&
          pendingCreateIds.has(lg.id)
        );

        log('merge: supabase=' + mappedGoals.length + ', localPendingCreate=' + unsyncedToKeep.length);

        allGoals = [...mappedGoals, ...unsyncedToKeep];

        // Atualiza cache com dados limpos (sem goals deletados)
        await localDB.clear('goals');
        await localDB.putMany('goals', allGoals);

      } catch (e) {
        log('cache sync error', e.message);
      }

      return { data: { goals: allGoals, goalTasks }, error: null };

    } catch (error) {
      log('getAll failed -> offline fallback', error.message);

      let userGoals = [];
      try {
        const localGoals = await localDB.getAll('goals');
        userGoals = localGoals.filter(g => g.user_id === userId && !g.deletedAt);
      } catch (e) {
        log('failed to load local goals', e.message);
      }

      let localGT = [];
      try {
        localGT = await localDB.getAll('goal_tasks');
      } catch (e) {
        log('failed to load local goal_tasks', e.message);
      }

      return {
        data: { goals: userGoals, goalTasks: localGT },
        error,
        degraded: true
      };
    }
  },

  create: async (userId, goalData) => {
    requireUser(userId);

    log('create start', goalData);

    const clientId = goalData.id || generateId();
    const nowIso = new Date().toISOString();

    const cleanDesc = (goalData.description || '')
      .split('--flowday-meta--')[0]
      .trim();

    const enrichedDescription = buildEnrichedDescription(
      goalData.description,
      goalData.start_time,
      goalData.end_time,
      goalData.attachments
    );

    log('enrichedDescription', enrichedDescription);

    const optimistic = {
      id: clientId,
      user_id: userId,
      title: goalData.title,
      description: cleanDesc,
      color: goalData.color || '#4A654E',
      icon: goalData.icon || 'target',
      target_date: goalData.target_date || null,
      start_time: goalData.start_time || null,
      end_time: goalData.end_time || null,
      attachments: goalData.attachments || [],
      status: 'active',
      created_at: nowIso,
      updated_at: nowIso,
      deletedAt: null
    };

    await localDB.put('goals', optimistic);

    enqueue('goal_create', { userId, goalData, goalId: clientId }, clientId);

    try {
      log('supabase insert start');

      const { data, error } = await supabase
        .from('goals')
        .insert([{
          id: clientId,
          user_id: userId,
          title: goalData.title,
          description: enrichedDescription,
          color: goalData.color || '#4A654E',
          icon: goalData.icon || 'target',
          target_date: goalData.target_date || null,
          start_time: goalData.start_time || null,
          end_time: goalData.end_time || null,
          status: 'active',
        }])
        .select()
        .single();

      log('supabase result', { data, error });

      if (error) throw error;

      dequeue(clientId);

      return { data: mapGoal(data), error: null };

    } catch (error) {
      log('create failed -> queued', error.message);
      return { data: optimistic, error, degraded: true };
    }
  },

  update: async (userId, id, updates) => {
    requireUser(userId);

    const nowIso = new Date().toISOString();

    const existing = await localDB.get('goals', id);

    const cleanExistingDesc = existing?.description
      ? existing.description.split('--flowday-meta--')[0].trim()
      : '';

    const enrichedDescription = buildEnrichedDescription(
      updates.description !== undefined ? updates.description : cleanExistingDesc,
      updates.start_time ?? existing?.start_time,
      updates.end_time ?? existing?.end_time,
      updates.attachments ?? existing?.attachments ?? []
    );

    const payload = {
      ...updates,
      description: enrichedDescription,
      updated_at: nowIso
    };

    enqueue('goal_update', { userId, id, updates }, `update_${id}`);

    try {
      const { data, error } = await supabase
        .from('goals')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      log('update result', { data, error });

      if (error) {
        // Fallback para colunas inexistentes (start_time/end_time) no update
        if (error.code === 'PGRST204' || (error.message && error.message.includes("end_time"))) {
          const { start_time, end_time, ...fallbackPayload } = payload;
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
      log('update failed -> offline fallback', error.message);
      // Atualiza IndexedDB local de qualquer forma
      try {
        const localGoal = await localDB.get('goals', id);
        if (localGoal) {
          const updatedLocal = {
            ...localGoal,
            ...updates,
            description: enrichedDescription,
            updatedAt: nowIso
          };
          await localDB.put('goals', updatedLocal);
        }
      } catch (e) {}

      const fallbackGoal = { 
        id, 
        user_id: userId,
        ...existing,
        ...updates, 
        description: enrichedDescription,
        updated_at: nowIso 
      };

      return { 
        data: mapGoal(fallbackGoal), 
        error, 
        degraded: true 
      };
    }
  },

  delete: async (userId, id) => {
    requireUser(userId);

    const nowIso = new Date().toISOString();
    const syncKey = `delete_${id}`;

    // 1. Marca como deletado no IndexedDB IMEDIATAMENTE
    try {
      const existing = await localDB.get('goals', id);
      if (existing) {
        existing.deletedAt = nowIso;
        existing.deleted_at = nowIso;
        await localDB.put('goals', existing);
        log('delete: IndexedDB marcado com deletedAt', id);
      } else {
        // Se não existe no cache, remove por segurança
        await localDB.delete('goals', id).catch(() => {});
      }
    } catch (e) {
      log('delete: erro ao atualizar IndexedDB', e.message);
    }

    // 2. Enfileira para sync offline
    enqueue('goal_delete', { userId, id }, syncKey);

    try {
      // 3. Soft delete no Supabase
      const { error } = await supabase
        .from('goals')
        .update({ deleted_at: nowIso })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      // 4. Sucesso: remove da fila de sync (mantém no cache local com deletedAt para visualização na Lixeira)
      dequeue(syncKey);
      log('delete: sucesso completo', id);

      return { error: null };

    } catch (error) {
      log('delete failed, mantido na fila de sync', error.message);
      return { error, degraded: true };
    }
  },

  deletePermanent: async (userId, id) => {
    requireUser(userId);

    try {
      await localDB.delete('goals', id);

      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      return { error: null };

    } catch (error) {
      enqueue('goal_delete', { userId, id });
      return { error, degraded: true };
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMADA DE COMPATIBILIDADE (Fase 1 — wrappers temporários)
  // TODO: Remover na Fase 3 após migração completa dos consumidores
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * @deprecated Use goalsService.update(userId, id, { deleted_at: null }) diretamente.
   * Wrapper de compatibilidade para restaurar objetivo (undo soft delete).
   */
  restore: async (userId, id) => {
    requireUser(userId);
    log('[COMPAT] restore delegando para update', { id });

    try {
      // Restaura no cache local
      const existing = await localDB.get('goals', id);
      if (existing) {
        existing.deletedAt = null;
        await localDB.put('goals', existing);
      }

      // Restaura no Supabase
      const { error } = await supabase
        .from('goals')
        .update({ deleted_at: null })
        .eq('id', id)
        .eq('user_id', userId);

      // Se coluna deleted_at não existe, ignora silenciosamente
      if (error && error.code !== '42703') {
        log('[COMPAT] restore warning:', error.message);
      }
      return { error: null };
    } catch (error) {
      log('[COMPAT] restore failed', error.message);
      return { error: null }; // Não propaga: undo local ainda funciona
    }
  },

  /**
   * @deprecated Use goalTasksService.link(goalId, taskId) diretamente.
   * Wrapper de compatibilidade para vincular tarefa a objetivo.
   */
  linkTask: async (goalId, taskId) => {
    log('[COMPAT] linkTask delegando para goalTasksService.link');
    return goalTasksService.link(goalId, taskId);
  },

  /**
   * @deprecated Use goalTasksService.unlink(goalId, taskId) diretamente.
   * Wrapper de compatibilidade para desvincular tarefa de objetivo.
   */
  unlinkTask: async (goalId, taskId) => {
    log('[COMPAT] unlinkTask delegando para goalTasksService.unlink');
    return goalTasksService.unlink(goalId, taskId);
  },

  /**
   * @deprecated Use goalMediaService.uploadAttachment(userId, file) diretamente.
   * Wrapper de compatibilidade para upload de anexo.
   */
  uploadAttachment: async (userId, file) => {
    log('[COMPAT] uploadAttachment delegando para goalMediaService.uploadAttachment');
    return goalMediaService.uploadAttachment(userId, file);
  }
};