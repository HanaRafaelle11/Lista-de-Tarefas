import { supabase } from '../supabaseClient.js';
import { generateId } from './syncQueue.js';

const log = (...args) => console.log('[GOAL_MEDIA_SERVICE]', ...args);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Service responsável exclusivamente pelo upload de anexos
 * de objetivos para o Supabase Storage.
 */
export const goalMediaService = {
  /**
   * Faz upload de um arquivo para o Supabase Storage e retorna a URL pública.
   * @param {string} userId
   * @param {File} file
   * @returns {{ name?: string, url?: string, type?: string, size?: number, path?: string, error?: Error }}
   */
  uploadAttachment: async (userId, file) => {
    if (!userId) {
      return { error: new Error('userId obrigatório para upload de anexo.') };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { error: new Error('O tamanho máximo do arquivo é de 5MB.') };
    }

    try {
      log('upload start', { userId, fileName: file.name, size: file.size });

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueId = generateId();
      const filePath = `${userId}/objectives/${uniqueId}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      log('upload success', { publicUrl });

      return {
        name: file.name,
        url: publicUrl,
        type: file.type,
        size: file.size,
        path: filePath,
        error: null
      };
    } catch (error) {
      log('upload failed', error.message);
      return { error };
    }
  }
};
