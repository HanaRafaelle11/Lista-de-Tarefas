import React, { useState } from 'react';
import { Sun, Moon, Settings, Bell, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import MFIcon from './MFIcon';
import DefaultAvatar from './DefaultAvatar';
import NotificationCenter from './NotificationCenter';
import { useTheme } from '../design-system/theme/useTheme';
import { getLogo } from '../design-system/branding/logo';

export default function Sidebar() {
  const { activeTab, setActiveTab, currentUser, handleLogout, userProfile, isAdmin, theme, setTheme, isPro } = useAppContext();
  const { mode } = useTheme();
  const logo = getLogo(mode);

  // Estado para controlar a sidebar colapsada/recolhida
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('flowday_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const toggleCollapse = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('flowday_sidebar_collapsed', String(nextVal));
    }
  };

  const mainNavItems = [
    { key: 'home',      icon: 'consistency', label: 'Início' },
    { key: 'myday',     icon: 'tasks',       label: 'Meu Dia' },
    { key: 'focus',     icon: 'focus',       label: 'Foco' },
    { key: 'evolution', icon: 'evolution',   label: 'Evolução' },
  ];

  const adminNavItems = [];
  if (isAdmin) {
    adminNavItems.push({ key: 'admin', icon: 'admin', label: 'Admin' });
    adminNavItems.push({ key: 'revenue', icon: 'performance', label: 'Finanças' });
  }

  return (
    <>
      {/* ── Mobile/Tablet Top Header (Compacto) ── */}
      <header className="mobile-top-header hide-on-desktop">
        <div className="mobile-header-container">
          <div 
            className="navbar-brand"
            onClick={() => currentUser?.isDemo ? handleLogout() : setActiveTab('home')}
          >
            <img 
              src={logo.src}
              alt={logo.alt} 
              className="mobile-logo"
            />
          </div>
          
          <div className="mobile-header-actions">
            <NotificationCenter />
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="header-btn"
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`header-btn ${activeTab === 'settings' ? 'active' : ''}`}
              title="Configurações"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={handleLogout}
              className="header-btn"
              title="Sair do App"
              aria-label="Sair do App"
              style={{ color: '#ef4444' }}
            >
              <LogOut size={20} />
            </button>
            <div 
              className={`mobile-avatar-wrapper ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt="Avatar" className="mobile-avatar-img" />
              ) : (
                <DefaultAvatar size={32} />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Desktop Sidebar (Fixo à Esquerda - Expansível) ── */}
      <aside className={`app-sidebar hide-on-mobile ${isCollapsed ? 'app-sidebar--collapsed' : ''}`}>
        <div className="sidebar-brand-wrapper" onClick={() => currentUser?.isDemo ? handleLogout() : setActiveTab('home')}>
          {isCollapsed ? (
            <img src="/favicon.svg" alt="M" className="sidebar-logo" style={{ height: '32px', width: '32px', objectFit: 'contain' }} onError={(e) => { e.target.src = logo.src }} />
          ) : (
            <img src={logo.src} alt={logo.alt} className="sidebar-logo" />
          )}
        </div>

        {/* Botão de Toggle para expandir/recolher a sidebar */}
        <button 
          onClick={toggleCollapse} 
          className="sidebar-collapse-toggle-btn"
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <nav className="sidebar-nav">
          <div className="sidebar-nav-section">
            {mainNavItems.map(({ key, icon, label }) => (
              <button
                key={key}
                id={`tour-nav-sidebar-${key}`}
                onClick={() => setActiveTab(key)}
                className={`sidebar-nav-item ${activeTab === key ? 'active' : ''}`}
                title={label}
              >
                <MFIcon name={icon} size={20} className="sidebar-icon" />
                <span className="sidebar-label">{label}</span>
              </button>
            ))}
          </div>

          {isAdmin && (
            <div className="sidebar-nav-section admin-section">
              {!isCollapsed && <div className="sidebar-section-divider" />}
              {adminNavItems.map(({ key, icon, label }) => (
                <button
                  key={key}
                  id={`tour-nav-sidebar-${key}`}
                  onClick={() => setActiveTab(key)}
                  className={`sidebar-nav-item ${activeTab === key ? 'active' : ''}`}
                  title={label}
                >
                  <MFIcon name={icon} size={18} className="sidebar-icon" />
                  <span className="sidebar-label">{label}</span>
                </button>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-actions">
            <NotificationCenter placement="bottom-left" />
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="sidebar-footer-btn"
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              id="tour-nav-settings"
              onClick={() => setActiveTab('settings')}
              className={`sidebar-footer-btn ${activeTab === 'settings' ? 'active' : ''}`}
              title="Configurações"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={handleLogout}
              className="sidebar-footer-btn"
              title="Sair do App"
              aria-label="Sair do App"
              style={{ color: '#ef4444' }}
            >
              <LogOut size={18} />
            </button>
          </div>

          <div 
            className={`sidebar-profile-card ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
            title={userProfile?.nickname || userProfile?.name || currentUser?.name || 'Perfil'}
          >
            <div className="sidebar-avatar-container">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt="Avatar" className="sidebar-avatar" />
              ) : (
                <DefaultAvatar size={36} />
              )}
            </div>
            <div className="sidebar-profile-info">
              <span className="sidebar-username">{userProfile?.nickname || userProfile?.name || currentUser?.name || 'Usuário'}</span>
              <span className="sidebar-user-tier">{isPro ? 'Pro Member' : 'Membro Free'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Navigation (4 Itens Fixos) ── */}
      <nav className="mobile-bottom-nav hide-on-desktop" role="navigation" aria-label="Navegação principal mobile">
        {mainNavItems.map(({ key, icon, label }) => (
          <button
            key={key}
            id={`tour-nav-mobile-${key}`}
            onClick={() => setActiveTab(key)}
            className={`mobile-bottom-nav-btn ${activeTab === key ? 'active' : ''}`}
            aria-current={activeTab === key ? 'page' : undefined}
          >
            <MFIcon name={icon} size={22} className="nav-icon" />
            <span className="nav-text">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
