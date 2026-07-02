import React from 'react';
import { Sun, Moon, User } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import MFIcon from './MFIcon';
import DefaultAvatar from './DefaultAvatar';
import NotificationCenter from './NotificationCenter';
import { useTheme } from '../design-system/theme/useTheme';
import { getLogo } from '../design-system/branding/logo';

export default function Navbar() {
  const { activeTab, setActiveTab, currentUser, handleLogout, userProfile, isAdmin, theme, setTheme } = useAppContext();
  const { mode } = useTheme();
  const logo = getLogo(mode);
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
    { key: 'coach',       icon: 'insights',     label: 'Coach'     },
    { key: 'analytics',   icon: 'evolution',    label: 'Evolução'  },
    { key: 'performance', icon: 'performance',  label: 'Desempenho'},
  ];

  if (isAdmin) {
    navItems.push({ key: 'admin', icon: 'admin', label: 'Admin' });
    navItems.push({ key: 'revenue', icon: 'performance', label: 'Finanças' });
  }

  return (
    <>
      {/* ── Cabeçalho Superior ──────────────────────────── */}
      <header className="app-top-header">
        <div className="app-top-header-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0 16px', height: '64px' }}>
          
          {/* Logo — símbolo SVG oficial com marca integrada */}
          <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-start', cursor: 'pointer' }} onClick={() => setActiveTab('home')}>
            <img 
              src={logo.src}
              alt={logo.alt} 
              style={{ height: '36px', width: 'auto', objectFit: 'contain', background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
            />
          </div>

          {/* Navegação */}
          <nav className="desktop-nav-links hide-on-mobile" style={{ display: 'flex', gap: '16px', height: '100%', justifyContent: 'center' }}>
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

          {/* Ações com Alinhamento Perfeito */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', height: '100%', flex: 1 }}>
            <NotificationCenter />
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="header-btn"
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, margin: 0, flexShrink: 0 }}
            >
              {theme === 'dark'
                ? <Sun size={20} aria-hidden="true" />
                : <Moon size={20} aria-hidden="true" />}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className="header-btn"
              title="Configurações"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, margin: 0, flexShrink: 0, color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-muted)' }}
            >
              <User size={22} strokeWidth={2} className="header-btn-icon" />
            </button>
            
            <div 
              className={`app-top-profile ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', margin: 0, flexShrink: 0 }}
            >
              <div className="app-top-avatar" title={userProfile?.name || currentUser?.name} style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Avatar" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <DefaultAvatar size={38} />
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

