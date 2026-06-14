import React, { useState, useEffect } from 'react';
import { User, Shield, Briefcase, FileText, Camera, Trash2, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

export default function ProfileView() {
  const { 
    currentUser, 
    userProfile, 
    handleUpdateProfile, 
    handleUploadAvatar, 
    handleDeleteAvatar 
  } = useAppContext();

  // Estados locais do form
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [profession, setProfession] = useState('');
  const [bio, setBio] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Sincroniza dados com o profile vindo do banco
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setNickname(userProfile.nickname || '');
      setProfession(userProfile.profession || '');
      setBio(userProfile.bio || '');
    }
  }, [userProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await handleUpdateProfile({
        name,
        nickname,
        profession,
        bio
      });
      setSuccessMsg('Perfil atualizado com sucesso! ⚡');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg('Erro ao atualizar perfil: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await handleUploadAvatar(file);
      setSuccessMsg('Avatar atualizado com sucesso! 📸');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao carregar imagem de avatar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!window.confirm('Deseja remover sua foto de perfil?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await handleDeleteAvatar();
      setSuccessMsg('Foto de perfil removida!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg('Erro ao remover foto.');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    return currentUser?.email?.substring(0, 2).toUpperCase() || 'US';
  };

  return (
    <div className="profile-view-container animate-fade-in" style={{ padding: '24px 0', maxWidth: '640px', margin: '0 auto' }}>
      <div className="tasks-page-header" style={{ marginBottom: '32px' }}>
        <h1 className="tasks-page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={24} /> Meu Perfil
        </h1>
        <p className="tasks-page-subtitle">Configure suas informações pessoais no Flowday</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Bloco de Foto / Avatar */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          
          <div style={{ position: 'relative', width: '100px', height: '100px' }}>
            {userProfile?.avatar_url ? (
              <img 
                src={userProfile.avatar_url} 
                alt="Avatar" 
                style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
              />
            ) : (
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
                {getInitials()}
              </div>
            )}

            {/* Label click triggers input file */}
            <label 
              htmlFor="avatar-input"
              style={{ position: 'absolute', bottom: '0', right: '0', backgroundColor: 'var(--primary)', color: 'white', padding: '6px', borderRadius: '50%', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Mudar foto"
            >
              <Camera size={14} />
            </label>
            <input 
              id="avatar-input" 
              type="file" 
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>Foto de Perfil</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-light)', maxWidth: '320px' }}>
              Suporta JPG, PNG ou WEBP. Tamanho máximo de 2MB.
            </p>
            {userProfile?.avatar_url && (
              <button 
                onClick={handleDeletePhoto}
                disabled={loading}
                style={{ alignSelf: 'flex-start', marginTop: '4px', fontSize: '12px', color: '#C06C6C', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px', background: 'var(--prio-alta-bg)', border: '1px solid var(--prio-alta-border)' }}
              >
                <Trash2 size={12} /> Remover Foto
              </button>
            )}
          </div>
        </div>

        {/* Formulário de Dados */}
        <form onSubmit={handleSubmit} style={{ backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {successMsg && (
            <div style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}

          {/* Nome */}
          <div className="todo-form-group">
            <label className="todo-form-label" htmlFor="profile-name">Nome Completo</label>
            <div className="todo-date-input-wrapper">
              <User size={15} className="todo-date-icon" />
              <input
                id="profile-name"
                type="text"
                placeholder="Ex: Hana Rafaelle"
                value={name}
                onChange={e => setName(e.target.value)}
                className="todo-modal-date-input"
                style={{ paddingLeft: '38px' }}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Apelido */}
          <div className="todo-form-group">
            <label className="todo-form-label" htmlFor="profile-nickname">Como quer ser chamado (Apelido)</label>
            <div className="todo-date-input-wrapper">
              <Shield size={15} className="todo-date-icon" />
              <input
                id="profile-nickname"
                type="text"
                placeholder="Ex: Hana"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                className="todo-modal-date-input"
                style={{ paddingLeft: '38px' }}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Profissão */}
          <div className="todo-form-group">
            <label className="todo-form-label" htmlFor="profile-profession">Profissão</label>
            <div className="todo-date-input-wrapper">
              <Briefcase size={15} className="todo-date-icon" />
              <input
                id="profile-profession"
                type="text"
                placeholder="Ex: Engenheira de Software"
                value={profession}
                onChange={e => setProfession(e.target.value)}
                className="todo-modal-date-input"
                style={{ paddingLeft: '38px' }}
                disabled={loading}
              />
            </div>
          </div>

          {/* Bio */}
          <div className="todo-form-group">
            <label className="todo-form-label" htmlFor="profile-bio">Biografia (Fale um pouco sobre você)</label>
            <textarea
              id="profile-bio"
              placeholder="Ex: Buscando evoluir 1% a cada dia, focando em consistência e metas a longo prazo."
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="todo-modal-textarea"
              disabled={loading}
              style={{ minHeight: '100px' }}
            />
          </div>

          {/* Botão de Salvar */}
          <button 
            type="submit" 
            className="btn-primary-glow" 
            style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' }}
            disabled={loading}
          >
            {loading ? 'Processando...' : 'Salvar Alterações'}
          </button>
        </form>
      </div>
    </div>
  );
}
