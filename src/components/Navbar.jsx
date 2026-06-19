import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import MFIcon from './MFIcon';

export default function Navbar() {
  const { activeTab, setActiveTab, currentUser, handleLogout, userProfile, isAdmin, theme, setTheme } = useAppContext();
  const onLogout = handleLogout;

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const navItems = [
    { key: 'home',        icon: 'consistency',  label: 'Início'    },
    { key: 'goals',       icon: 'objectives',   label: 'Objetivos' },
    { key: 'tasks',       icon: 'tasks',        label: 'Tarefas'   },
    { key: 'focus',       icon: 'focus',        label: 'Foco'      },
    { key: 'analytics',   icon: 'evolution',    label: 'Evolução'  },
    { key: 'performance', icon: 'performance',  label: 'Desempenho'},
  ];

  if (isAdmin) {
    navItems.push({ key: 'admin', icon: 'profile', label: 'Admin' });
  }

  return (
    <>
      {/* ── Cabeçalho Superior ──────────────────────────── */}
      <header className="app-top-header">
        <div className="app-top-header-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '64px' }}>
          
          {/* Logo — símbolo SVG oficial e texto da marca */}
          <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setActiveTab('home')}>
            <img 
              src={theme === 'dark' ? '/branding/logo-dark.svg' : '/branding/logo.svg'}
              alt="MyFlowDay Logo" 
              style={{ height: '38px', width: 'auto', objectFit: 'contain' }}
            />
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', fontFamily: 'var(--font-display)' }}>
              MyFlowDay
            </span>
          </div>

          {/* Navegação */}
          <nav className="desktop-nav-links hide-on-mobile" style={{ display: 'flex', gap: '24px', height: '100%' }}>
            {navItems.map(({ key, icon, label }) => (
              <button
                key={key}
                id={`tour-nav-desktop-${key}`}
                onClick={() => setActiveTab(key)}
                className={`nav-tab-button ${activeTab === key ? 'active-nav-tab' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 4px',
                  height: '100%',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: activeTab === key ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === key ? '2px solid var(--primary)' : '2px solid transparent',
                  borderRadius: '0',
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                <MFIcon name={icon} size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Ações */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="app-top-logout-btn"
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              style={{ padding: '8px', minWidth: 'auto', display: 'inline-flex', alignItems: 'center' }}
            >
              {theme === 'dark'
                ? <Sun size={18} aria-hidden="true" />
                : <Moon size={18} aria-hidden="true" />}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className="app-top-logout-btn"
              title="Configurações"
              style={{ padding: '8px', minWidth: 'auto', color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-light)', display: 'inline-flex', alignItems: 'center' }}
            >
              <MFIcon name="profile" size={18} />
            </button>
            
            <div 
              className={`app-top-profile ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
              style={{ cursor: 'pointer', marginLeft: '8px' }}
            >
              <div className="app-top-avatar" title={userProfile?.name || currentUser?.name} style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border)' }}>
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)', color: 'white', fontWeight: '700', fontSize: '12.5px', fontFamily: 'var(--font-display)' }}>
                    {getInitials(userProfile?.name || currentUser?.name)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Menu Flutuante Inferior ──────────────────────── */}
      <nav className="app-bottom-nav hide-on-desktop" role="navigation" aria-label="Navegação principal">
        {navItems.map(({ key, icon, label }) => (
          <button
            key={key}
            id={`tour-nav-mobile-${key}`}
            onClick={() => setActiveTab(key)}
            className={`app-bottom-nav-btn ${activeTab === key ? 'active' : ''}`}
            aria-current={activeTab === key ? 'page' : undefined}
          >
            <MFIcon name={icon} size={20} className="nav-icon" />
            <span className="nav-text">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

