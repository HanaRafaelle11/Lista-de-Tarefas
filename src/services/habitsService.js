import { supabase } from '../supabaseClient';

const requireUser = (userId) => {
  if (!userId) throw new Error('[habitsService] userId obrigatório — usuário não autenticado');
};

export const habitsService = {
  /**
   * Carrega hábitos e logs do usuário.
   * CORRIGIDO: habits agora filtrados por user_id (antes estava sem filtro).
   */
  getAll: async (userId) => {
    requireUser(userId);
    try {
      const [habitsRes, logsRes] = await Promise.all([
        supabase
          .from('habits')
          .select('*')
          .eq('user_id', userId)          // ← segurança: filtro por user_id
          .order('created_at', { ascending: false }),
        supabase
          .from('habit_logs')
          .select('*')
          .eq('user_id', userId),
      ]);

      if (habitsRes.error) throw habitsRes.error;
      if (logsRes.error) throw logsRes.error;

      return {
        data: { habits: habitsRes.data || [], habitLogs: logsRes.data || [] },
        error: null,
      };
    } catch (error) {
      console.error('[habitsService.getAll]', error);
      return { data: null, error };
    }
  },

  /**
   * Cria um novo hábito.
   */
  create: async (userId, habitData) => {
    requireUser(userId);
    try {
      const { data, error } = await supabase
        .from('habits')
        .insert([{ ...habitData, user_id: userId }])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[habitsService.create]', error);
      return { data: null, error };
    }
  },

  /**
   * Atualiza um hábito.
   */
  update: async (userId, id, updates) => {
    requireUser(userId);
    try {
      const { data, error } = await supabase
        .from('habits')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[habitsService.update]', error);
      return { data: null, error };
    }
  },

  /**
   * Exclui um hábito e seus logs.
   */
  delete: async (userId, id) => {
    requireUser(userId);
    try {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[habitsService.delete]', error);
      return { error };
    }
  },

  /**
   * Alterna o registro de conclusão de um hábito em uma data.
   * @returns {{ data: boolean, error }} — true = marcado, false = desmarcado
   */
  toggleLog: async (userId, habitId, dateStr, existingLogId = null) => {
    requireUser(userId);
    try {
      if (existingLogId) {
        // Desmarcar
        const { error } = await supabase
          .from('habit_logs')
          .delete()
          .eq('id', existingLogId)
          .eq('user_id', userId);

        if (error) throw error;
        return { data: false, error: null };
      } else {
        // Marcar
        const { data, error } = await supabase
          .from('habit_logs')
          .insert([{ habit_id: habitId, user_id: userId, completed_date: dateStr }])
          .select()
          .single();

        if (error) throw error;
        return { data: true, logData: data, error: null };
      }
    } catch (error) {
      console.error('[habitsService.toggleLog]', error);
      return { data: null, error };
    }
  },
};
