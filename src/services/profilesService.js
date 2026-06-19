import { supabase } from '../supabaseClient';
import { enqueue } from './syncQueue';

/**
 * profilesService — Perfis com fallback resiliente.
 *
 * Se o Supabase estiver indisponível, retorna um perfil local temporário
 * e enfileira a sincronização para depois. O usuário nunca vê erro.
 */

const requireUser = (userId) => {
  if (!userId) throw new Error('[profilesService] userId obrigatório — usuário não autenticado');
};

/** Gera um perfil local temporário a partir do userId */
function localFallbackProfile(userId, name = '') {
  return {
    id: userId,
    name: name || 'Usuário MyFlowDay',
    nickname: 'user',
    profession: '',
    bio: '',
    avatar_url: null,
    updated_at: new Date().toISOString(),
    _local: true, // marca que é temporário
  };
}

export const profilesService = {
  /**
   * Obtém o perfil do usuário.
   * Fallback: perfil local temporário se banco indisponível.
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
          // Perfil não existe ainda — tenta criar
          const defaultData = {
            id: userId,
            name: 'Usuário MyFlowDay',
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

          if (createError) {
            // Criação também falhou — retorna fallback local
            console.warn('[profilesService.getProfile] Não foi possível criar perfil — usando local temporário');
            return { data: localFallbackProfile(userId), error: null, degraded: true };
          }
          return { data: newProfile, error: null };
        }

        // Outro erro (tabela não existe, rede, etc.) — retorna fallback local
        console.warn('[profilesService.getProfile] Erro ao carregar perfil — usando local temporário:', error.message);
        return { data: localFallbackProfile(userId), error: null, degraded: true };
      }

      return { data, error: null };
    } catch (error) {
      // Falha de rede — retorna fallback local
      console.warn('[profilesService.getProfile] Falha de rede — usando local temporário:', error.message);
      return { data: localFallbackProfile(userId), error: null, degraded: true };
    }
  },

  /**
   * Atualiza as informações textuais do perfil.
   * Se falhar, enfileira para retry — retorna sucesso otimista.
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
      console.warn('[profilesService.updateProfile] Falha — enfileirado para retry:', error.message);
      enqueue('profile_update', { userId, data: profileData });
      // Retorna otimisticamente os dados que o usuário enviou
      return { data: { id: userId, ...profileData, _local: true }, error: null, degraded: true };
    }
  },

  /**
   * Faz upload do avatar para o Supabase Storage.
   * Se falhar, retorna degraded sem lançar erro visível.
   */
  uploadAvatar: async (userId, file) => {
    requireUser(userId);

    // Validações de formato e tamanho (sempre executadas localmente)
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

      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      // Atualiza o profile com a nova URL
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      return { publicUrl, error: null };
    } catch (error) {
      // Upload falhou — retorna degraded silenciosamente
      console.warn('[profilesService.uploadAvatar] Falha no upload — avatar não atualizado:', error.message);
      return { publicUrl: null, error: null, degraded: true };
    }
  },

  /**
   * Remove o avatar do Storage e limpa avatar_url no banco.
   */
  deleteAvatar: async (userId) => {
    requireUser(userId);
    try {
      const filePath = `${userId}/avatar.jpg`;

      await supabase.storage.from('avatars').remove([filePath]);
      await supabase.from('profiles').update({ avatar_url: '' }).eq('id', userId);

      return { error: null };
    } catch (error) {
      console.warn('[profilesService.deleteAvatar] Falha ao remover avatar:', error.message);
      return { error: null, degraded: true }; // silencia o erro para o usuário
    }
  }
};
