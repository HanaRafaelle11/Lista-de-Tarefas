import { supabase } from '../supabaseClient';

const requireUser = (userId) => {
  if (!userId) throw new Error('[achievementsService] userId obrigatório — usuário não autenticado');
};

export const achievementsService = {
  /**
   * Carrega todas as conquistas desbloqueadas do usuário.
   */
  getAll: async (userId) => {
    requireUser(userId);
    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select('achievement_key, unlocked_at, seen, viewed_at')
        .eq('user_id', userId);

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('[achievementsService.getAll]', error);
      return { data: null, error };
    }
  },

  /**
   * Desbloqueia uma ou mais conquistas (upsert seguro contra duplicatas).
   * @param {string[]} keys - array de achievement_key
   */
  unlock: async (userId, keys) => {
    requireUser(userId);
    if (!keys || keys.length === 0) return { error: null };
    try {
      const rows = keys.map((key) => ({ user_id: userId, achievement_key: key }));

      const { error } = await supabase
        .from('user_achievements')
        .upsert(rows, { onConflict: 'user_id,achievement_key', ignoreDuplicates: true });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[achievementsService.unlock]', error);
      return { error };
    }
  },

  /**
   * Marca conquistas como visualizadas (seen = true).
   * @param {string[]} keys - array de achievement_key
   */
  markAsSeen: async (userId, keys) => {
    requireUser(userId);
    if (!keys || keys.length === 0) return { error: null };
    try {
      const { error } = await supabase
        .from('user_achievements')
        .update({ seen: true, viewed_at: new Date().toISOString() })
        .eq('user_id', userId)
        .in('achievement_key', keys);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[achievementsService.markAsSeen]', error);
      return { error };
    }
  },
};
