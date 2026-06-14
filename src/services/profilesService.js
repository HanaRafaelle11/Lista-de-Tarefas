import { supabase } from '../supabaseClient';

const requireUser = (userId) => {
  if (!userId) throw new Error('[profilesService] userId obrigatório — usuário não autenticado');
};

export const profilesService = {
  /**
   * Obtém o perfil do usuário do banco.
   * Se o perfil não existir, cria um perfil padrão (fallback).
   */
  getProfile: async (userId) => {
    requireUser(userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Perfil não existe, criar perfil básico default
          const defaultData = {
            id: userId,
            name: 'Usuário Flowday',
            nickname: 'user',
            profession: '',
            bio: '',
            avatar_url: ''
          };
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([defaultData])
            .select()
            .single();

          if (createError) throw createError;
          return { data: newProfile, error: null };
        }
        throw error;
      }
      return { data, error: null };
    } catch (error) {
      console.error('[profilesService.getProfile]', error);
      return { data: null, error };
    }
  },

  /**
   * Atualiza as informações textuais do perfil.
   */
  updateProfile: async (userId, profileData) => {
    requireUser(userId);
    try {
      const payload = {
        name: profileData.name,
        nickname: profileData.nickname,
        profession: profileData.profession || '',
        bio: profileData.bio || '',
        updated_at: new Date().toISOString()
      };

      if (profileData.avatar_url !== undefined) {
        payload.avatar_url = profileData.avatar_url;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[profilesService.updateProfile]', error);
      return { data: null, error };
    }
  },

  /**
   * Faz upload do arquivo de avatar para o Supabase Storage.
   * Aceita formatos jpeg, png e webp e valida tamanho máximo de 2MB.
   */
  uploadAvatar: async (userId, file) => {
    requireUser(userId);
    
    // Validações
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Apenas formatos JPG, PNG e WEBP são permitidos.');
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      throw new Error('O tamanho máximo do arquivo é de 2MB.');
    }

    try {
      const filePath = `${userId}/avatar.jpg`;

      // Upload do arquivo com upsert (sobrescreve se já existir)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obtém a URL pública do arquivo
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Retorna a URL pública com um timestamp para burlar cache do navegador
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      
      // Atualiza automaticamente o registro na tabela de profiles
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      return { publicUrl, error: null };
    } catch (error) {
      console.error('[profilesService.uploadAvatar]', error);
      return { publicUrl: null, error };
    }
  },

  /**
   * Remove o arquivo do Storage e limpa avatar_url no banco.
   */
  deleteAvatar: async (userId) => {
    requireUser(userId);
    try {
      const filePath = `${userId}/avatar.jpg`;

      // Remove do Storage
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([filePath]);

      if (deleteError) throw deleteError;

      // Limpa no banco
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: '' })
        .eq('id', userId);

      if (dbError) throw dbError;

      return { error: null };
    } catch (error) {
      console.error('[profilesService.deleteAvatar]', error);
      return { error };
    }
  }
};
