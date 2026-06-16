import React from 'react';
import { useAppContext } from '../contexts/AppContext';

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
    { key: 'home',        icon: 'home_max',     label: 'Início'    },
    { key: 'goals',       icon: 'target',       label: 'Objetivos' },
    { key: 'tasks',       icon: 'check_circle', label: 'Tarefas'   },
    { key: 'focus',       icon: 'timer',        label: 'Foco'      },
    { key: 'analytics',   icon: 'auto_graph',   label: 'Evolução'  },
    { key: 'performance', icon: 'trending_up',  label: 'Desempenho'},
  ];

  if (isAdmin) {
    navItems.push({ key: 'admin', icon: 'admin_panel_settings', label: 'Admin' });
  }

  return (
    <>
      {/* ── Cabeçalho Superior ──────────────────────────── */}
      <header className="app-top-header">
        <div className="app-top-header-container">
          <div 
            className={`app-top-profile ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <div className="app-top-avatar" title={userProfile?.name || currentUser?.name}>
              {userProfile?.avatar_url ? (
                <img 
                  src={userProfile.avatar_url} 
                  alt="Avatar" 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                getInitials(userProfile?.name || currentUser?.name)
              )}
            </div>
            <h1 className="app-top-greeting">
              Olá, {(userProfile?.name || currentUser?.name)?.split(' ')[0] || 'Usuário'}
            </h1>
          </div>
          
          <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', marginLeft: '16px', gap: '10px' }}>
            <div style={{ 
              width: '32px', height: '32px', 
              backgroundColor: 'var(--bg-card)', 
              borderRadius: '8px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid var(--border)'
            }}>
              <img 
                src="/branding/logo.svg" 
                alt="MyFlowDay Symbol" 
                style={{ height: '16px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
            <span className="hide-on-mobile" style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-main)', margin: 0 }}>MyFlowDay</span>
          </div>

          {/* Desktop Navigation Links (Adequada para Desktop) */}
          <nav className="desktop-nav-links hide-on-mobile" style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--primary-light)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
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
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: 'calc(var(--radius-md) - 4px)',
                  color: activeTab === key ? 'var(--primary)' : 'var(--text-muted)'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="app-top-logout-btn"
              title="Alternar Tema"
              style={{ padding: '8px', minWidth: 'auto', display: 'inline-flex', alignItems: 'center' }}
            >
              <span className="material-symbols-outlined">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className="app-top-logout-btn"
              title="Configurações"
              style={{ padding: '8px', minWidth: 'auto', color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-light)' }}
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
            <button
              onClick={onLogout}
              className="app-top-logout-btn hide-on-mobile"
              title="Sair do Flowday"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="logout-text">Sair</span>
            </button>
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
            <span className="material-symbols-outlined nav-icon">{icon}</span>
            <span className="nav-text">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

