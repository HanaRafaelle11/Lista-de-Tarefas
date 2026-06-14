import { supabase } from '../supabaseClient';

export const eventsService = {
  /**
   * Registra um evento analítico no Supabase (com fallback local).
   */
  logEvent: async (userId, eventType, metadata = {}) => {
    if (!userId) return { error: 'userId obrigatório' };
    try {
      const { error } = await supabase
        .from('events')
        .insert([{ user_id: userId, event_type: eventType, metadata }]);
      
      if (error) {
        console.warn('[eventsService] Erro ao salvar evento no DB (tabela pode não existir), salvando localmente:', error.message);
        saveEventLocally(userId, eventType, metadata);
        return { error };
      }
      return { error: null };
    } catch (e) {
      console.warn('[eventsService] Falha de comunicação ao salvar evento, salvando localmente:', e);
      saveEventLocally(userId, eventType, metadata);
      return { error: e };
    }
  }
};

function saveEventLocally(userId, eventType, metadata) {
  try {
    const key = `flowday_events_${userId}`;
    const localEvents = JSON.parse(localStorage.getItem(key) || '[]');
    localEvents.push({ event_type: eventType, metadata, created_at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(localEvents.slice(-100))); // Limita a 100 registros
  } catch (e) {
    console.error('[eventsService.saveEventLocally] Erro:', e);
  }
}
