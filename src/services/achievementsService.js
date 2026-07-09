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
   * Silencia erro 42703 se coluna não existir no banco.
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

      // Silencia erro de coluna ausente (42703) — estado é gerenciado via localStorage
      if (error && error.code !== '42703') {
        console.warn('[achievementsService.markAsSeen]', error.message);
      }
      return { error: null };
    } catch (error) {
      console.warn('[achievementsService.markAsSeen]', error.message);
      return { error: null }; // Não propaga: localStorage é fonte de verdade
    }
  },

  /**
   * Marca uma conquista como dispensada (dismissed_at = agora).
   * Silencia erro 42703 se coluna não existir — localStorage é fonte de verdade.
   */
  markAsDismissed: async (userId, key) => {
    requireUser(userId);
    if (!key) return { error: null };
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('user_achievements')
        .update({ seen: true, viewed_at: now })
        .eq('user_id', userId)
        .eq('achievement_key', key);

      // Silencia erro de coluna ausente (42703)
      if (error && error.code !== '42703') {
        console.warn('[achievementsService.markAsDismissed]', error.message);
      }
      return { error: null };
    } catch (error) {
      console.warn('[achievementsService.markAsDismissed]', error.message);
      return { error: null };
    }
  },

  /**
   * Reseta todas as conquistas do usuário (deleta todas as linhas correspondentes).
   */
  resetAll: async (userId) => {
    requireUser(userId);
    try {
      const { error } = await supabase
        .from('user_achievements')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[achievementsService.resetAll]', error);
      return { error };
    }
  },

  /**
   * Bloqueia/deleta conquistas específicas do usuário (deleta as linhas).
   */
  lock: async (userId, keys) => {
    requireUser(userId);
    if (!keys || keys.length === 0) return { error: null };
    try {
      const { error } = await supabase
        .from('user_achievements')
        .delete()
        .eq('user_id', userId)
        .in('achievement_key', keys);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[achievementsService.lock]', error);
      return { error };
    }
  },
};

