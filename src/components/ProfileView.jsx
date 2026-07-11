import React, { useState, useEffect } from 'react';
import { User, Shield, Briefcase, FileText, Camera, Trash2, CheckCircle2, Sun, Moon, Palette } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import DefaultAvatar from './DefaultAvatar';

// ── Gerador dinâmico de avatares SVG inline ──
const generateAvatarDataUrl = (type, color1, color2) => {
  const bgGradient = `<linearGradient id="bg-grad-${type}-${color1.replace('#','')}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/></linearGradient>`;
  
  let headAndBody = '';
  if (type === 'female') {
    headAndBody = `
      <circle cx="50" cy="40" r="16" fill="#F3E8FF" />
      <path d="M50 20 C40 20, 36 28, 36 38 C36 44, 40 45, 40 48 C42 52, 46 54, 50 54 C54 54, 58 52, 60 48 C60 45, 64 44, 64 38 C64 28, 60 20, 50 20 Z" fill="#4B5563" />
      <circle cx="50" cy="38" r="14" fill="#FCE7F3" />
      <path d="M25 82 C25 65, 34 58, 50 58 C66 58, 75 65, 75 82 Z" fill="#EC4899" />
    `;
  } else if (type === 'male') {
    headAndBody = `
      <circle cx="50" cy="38" r="15" fill="#FEF3C7" />
      <path d="M35 32 C35 20, 65 20, 65 32 Z" fill="#1F2937" />
      <path d="M25 82 C25 65, 34 58, 50 58 C66 58, 75 65, 75 82 Z" fill="#3B82F6" />
    `;
  } else if (type === 'neutral') {
    headAndBody = `
      <circle cx="50" cy="38" r="16" fill="#E0F2FE" />
      <path d="M25 82 C25 64, 34 56, 50 56 C66 56, 75 64, 75 82 Z" fill="#0F172A" />
      <path d="M50 56 L42 66 L58 66 Z" fill="#FFFFFF" />
      <path d="M50 66 L46 82 L54 82 Z" fill="#312E81" />
    `;
  } else {
    headAndBody = `
      <circle cx="50" cy="38" r="16" fill="#F87171" />
      <path d="M30 35 L40 20 L60 20 L70 35 Z" fill="#F59E0B" />
      <path d="M22 82 C22 62, 34 54, 50 54 C66 54, 78 62, 78 82 Z" fill="#10B981" />
    `;
  }
  
  const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs>${bgGradient}</defs><circle cx="50" cy="50" r="50" fill="url(#bg-grad-${type}-${color1.replace('#','')})" />${headAndBody}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const LIBRARY_AVATARS = {
  Masculino: [
    { id: 'm1', label: 'Tech Lead', url: generateAvatarDataUrl('male', '#1E3A8A', '#3B82F6') },
    { id: 'm2', label: 'Esportista', url: generateAvatarDataUrl('male', '#10B981', '#047857') },
    { id: 'm3', label: 'Minimalista', url: generateAvatarDataUrl('male', '#4B5563', '#1F2937') }
  ],
  Feminino: [
    { id: 'f1', label: 'Gestora', url: generateAvatarDataUrl('female', '#6D28D9', '#A78BFA') },
    { id: 'f2', label: 'Artista', url: generateAvatarDataUrl('female', '#DB2777', '#F472B6') },
    { id: 'f3', label: 'Criativa', url: generateAvatarDataUrl('female', '#D97706', '#F59E0B') }
  ],
  Neutro: [
    { id: 'n1', label: 'Profissional', url: generateAvatarDataUrl('neutral', '#0F172A', '#334155') },
    { id: 'n2', label: 'Foco Limpo', url: generateAvatarDataUrl('neutral', '#06B6D4', '#22D3EE') }
  ],
  Ilustrado: [
    { id: 'i1', label: 'Moderna', url: generateAvatarDataUrl('illustrated', '#8B5CF6', '#EC4899') },
    { id: 'i2', label: 'Inovador', url: generateAvatarDataUrl('illustrated', '#F59E0B', '#EF4444') }
  ]
};

export default function ProfileView() {
  const { 
    currentUser, 
    userProfile, 
    handleUpdateProfile, 
    handleUploadAvatar, 
    handleDeleteAvatar,
    handleSelectLibraryAvatar,
    theme,
    setTheme,
    openCustomConfirm
  } = useAppContext();

  // Estados locais do form
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [profession, setProfession] = useState('');
  const [bio, setBio] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showAvatarLibrary, setShowAvatarLibrary] = useState(false);
  const [activeAvatarTab, setActiveAvatarTab] = useState('Masculino');

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
      setSuccessMsg('Perfil atualizado com sucesso!');
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
      setSuccessMsg('Avatar atualizado com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao carregar imagem de avatar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = () => {
    openCustomConfirm(
      'Deseja remover sua foto de perfil?',
      'Remover Foto',
      async () => {
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
      }
    );
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
          
          <div 
            style={{ position: 'relative', width: '140px', height: '140px', cursor: 'pointer' }}
            onClick={() => setShowPhotoOptions(true)}
            title="Mudar foto"
          >
            {userProfile?.avatar_url ? (
              <img 
                src={userProfile.avatar_url} 
                alt="Avatar" 
                style={{ width: '140px', height: '140px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', transition: 'opacity 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              />
            ) : (
              <DefaultAvatar size={140} />
            )}

            <div 
              style={{ position: 'absolute', bottom: '0', right: '0', backgroundColor: 'var(--primary)', color: 'white', padding: '6px', borderRadius: '50%', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Camera size={14} />
            </div>
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

        {/* Bloco de Aparência (Tema) */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Palette size={18} /> Aparência
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-light)', margin: 0 }}>
            Escolha o tema do aplicativo (salvo localmente).
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => setTheme('light')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm)',
                border: theme === 'light' ? '2px solid var(--primary)' : '1px solid var(--border-medium)',
                backgroundColor: theme === 'light' ? 'var(--primary-glow)' : 'var(--bg-card)',
                fontWeight: theme === 'light' ? '700' : '500',
                color: theme === 'light' ? 'var(--primary)' : 'var(--text-main)',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Sun size={14} /> Claro</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm)',
                border: theme === 'dark' ? '2px solid var(--primary)' : '1px solid var(--border-medium)',
                backgroundColor: theme === 'dark' ? 'var(--primary-glow)' : 'var(--bg-card)',
                fontWeight: theme === 'dark' ? '700' : '500',
                color: theme === 'dark' ? 'var(--primary)' : 'var(--text-main)',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Moon size={14} /> Escuro</span>
            </button>
          </div>
        </div>

      </div>

      {/* Modal de Opções de Foto */}
      {showPhotoOptions && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(9, 13, 18, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }} onClick={() => setShowPhotoOptions(false)}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '320px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            textAlign: 'center'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>Alterar Foto de Perfil</h3>
            
            <button 
              type="button"
              onClick={() => {
                setShowPhotoOptions(false);
                document.getElementById('camera-input').click();
              }}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card-hover)',
                color: 'var(--text-main)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              📷 Tirar Foto (Câmera)
            </button>
            <input 
              id="camera-input" 
              type="file" 
              accept="image/*"
              capture="user"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={loading}
            />

            <button 
              type="button"
              onClick={() => {
                setShowPhotoOptions(false);
                document.getElementById('gallery-input').click();
              }}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card-hover)',
                color: 'var(--text-main)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              🖼️ Escolher da Galeria
            </button>
            <input 
              id="gallery-input" 
              type="file" 
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={loading}
            />

            <button 
              type="button"
              onClick={() => {
                setShowPhotoOptions(false);
                setShowAvatarLibrary(true);
              }}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card-hover)',
                color: 'var(--text-main)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              👤 Escolher Avatar Pronto
            </button>

            <button 
              type="button"
              onClick={() => setShowPhotoOptions(false)}
              style={{
                marginTop: '8px',
                padding: '8px',
                border: 'none',
                background: 'none',
                color: 'var(--text-light)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal da Biblioteca de Avatares */}
      {showAvatarLibrary && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(9, 13, 18, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }} onClick={() => setShowAvatarLibrary(false)}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>Escolha um Avatar</h3>
              <button 
                type="button"
                onClick={() => setShowAvatarLibrary(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}
              >
                &times;
              </button>
            </div>

            {/* Abas */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', gap: '12px' }}>
              {Object.keys(LIBRARY_AVATARS).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveAvatarTab(tab)}
                  style={{
                    padding: '8px 4px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeAvatarTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeAvatarTab === tab ? 'var(--primary)' : 'var(--text-light)',
                    fontWeight: activeAvatarTab === tab ? '700' : '500',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '8px 0'
            }}>
              {LIBRARY_AVATARS[activeAvatarTab].map(avatar => (
                <div 
                  key={avatar.id}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await handleSelectLibraryAvatar(avatar.url);
                      setSuccessMsg('Avatar selecionado com sucesso!');
                      setTimeout(() => setSuccessMsg(''), 3000);
                    } catch (err) {
                      setErrorMsg('Erro ao salvar avatar.');
                    } finally {
                      setLoading(false);
                      setShowAvatarLibrary(false);
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    padding: '10px',
                    borderRadius: '12px',
                    border: '1px solid transparent',
                    transition: 'all 0.2s',
                    backgroundColor: 'rgba(255,255,255,0.02)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--primary-light)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <img 
                    src={avatar.url} 
                    alt={avatar.label} 
                    style={{ width: '70px', height: '70px', borderRadius: '50%' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '600', textAlign: 'center' }}>
                    {avatar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
