import React from 'react';
import { useAppContext } from '../contexts/AppContext';

export default function Navbar() {
  const { activeTab, setActiveTab, currentUser, handleLogout } = useAppContext();
  const onLogout = handleLogout;

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const navItems = [
    { key: 'home',      icon: 'home_max',     label: 'Início'    },
    { key: 'goals',     icon: 'target',       label: 'Objetivos' },
    { key: 'tasks',     icon: 'check_circle', label: 'Tarefas'   },
    { key: 'focus',     icon: 'timer',        label: 'Foco'      },
    { key: 'analytics', icon: 'auto_graph',   label: 'Evolução'  },
  ];

  return (
    <>
      {/* ── Cabeçalho Superior ──────────────────────────── */}
      <header className="app-top-header">
        <div className="app-top-header-container">
          <div className="app-top-profile">
            <div className="app-top-avatar" title={currentUser?.name}>
              {getInitials(currentUser?.name)}
            </div>
            <h1 className="app-top-greeting">
              Olá, {currentUser?.name?.split(' ')[0] || 'Usuário'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
      <nav className="app-bottom-nav" role="navigation" aria-label="Navegação principal">
        {navItems.map(({ key, icon, label }) => (
          <button
            key={key}
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
