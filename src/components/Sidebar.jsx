import React, { useState } from 'react';
import { Sun, Moon, Settings, Bell, ChevronLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import MFIcon from './MFIcon';
import DefaultAvatar from './DefaultAvatar';
import NotificationCenter from './NotificationCenter';
import { useTheme } from '../design-system/theme/useTheme';
import { getLogo } from '../design-system/branding/logo';

export default function Sidebar() {
  const { 
    activeTab, 
    setActiveTab, 
    currentUser, 
    handleLogout, 
    userProfile, 
    isAdmin, 
    theme, 
    setTheme, 
    isPro,
    isSidebarCollapsed,
    toggleSidebarCollapse 
  } = useAppContext();
  const { mode } = useTheme();
  const logo = getLogo(mode);

  // Estado para controlar o menu drawer no mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      <header className="mobile-top-header hide-on-desktop">
        <div className="mobile-header-container">
          {/* Logo à esquerda */}
          <div 
            className="navbar-brand"
            onClick={() => currentUser?.isDemo ? handleLogout() : setActiveTab('home')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <img 
              src={logo.src}
              alt={logo.alt} 
              className="mobile-logo"
            />
          </div>

          {/* Hambúrguer à direita */}
          <button 
            className="mobile-header-menu-btn"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={26} />
          </button>
        </div>
      </header>

      {/* ── Mobile Side Drawer Menu ── */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="mobile-drawer-backdrop animate-fade-in" 
            onClick={() => setIsMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 11000,
            }}
          />
          {/* Drawer Panel */}
          <aside 
            className="mobile-drawer-aside animate-slide-right"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '280px',
              backgroundColor: 'var(--bg-card)',
              borderRight: '1px solid var(--border-medium)',
              zIndex: 11001,
              display: 'flex',
              flexDirection: 'column',
              padding: '24px 20px',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            {/* Header of Drawer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <img src={logo.src} alt={logo.alt} style={{ height: '38px', width: 'auto' }} />
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Nav Items */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              {mainNavItems.map(item => {
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActiveTab(item.key);
                      setIsMobileMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                      color: isActive ? 'var(--primary)' : 'var(--text-main)',
                      fontWeight: isActive ? '700' : '550',
                      fontSize: '14.5px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.15s'
                    }}
                  >
                    <MFIcon name={item.icon} size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* Admin Nav Items */}
              {adminNavItems.map(item => {
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActiveTab(item.key);
                      setIsMobileMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                      color: isActive ? 'var(--primary)' : 'var(--text-main)',
                      fontWeight: isActive ? '700' : '550',
                      fontSize: '14.5px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.15s'
                    }}
                  >
                    <MFIcon name={item.icon} size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Footer Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
              
              {/* Profile Card */}
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'profile' ? 'var(--bg-card-hover)' : 'transparent'
                }}
                onClick={() => {
                  setActiveTab('profile');
                  setIsMobileMenuOpen(false);
                }}
              >
                <div className="sidebar-avatar-container" style={{ width: '56px', height: '56px' }}>
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="Avatar" className="sidebar-avatar" />
                  ) : (
                    <DefaultAvatar size={56} />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: '14px', fontWeight: '750', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userProfile?.nickname || userProfile?.name || currentUser?.name || 'Perfil'}
                  </span>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-light)' }}>
                    {isPro ? 'Pro Member' : 'Membro Free'}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Notificações, Tema, Configurações, Sair */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', padding: '0 4px' }}>
                <NotificationCenter placement="bottom-left" />
                
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                  title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setIsMobileMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: activeTab === 'settings' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                    backgroundColor: activeTab === 'settings' ? 'var(--primary-light)' : 'var(--bg-app)',
                    color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                  title="Configurações"
                >
                  <Settings size={18} />
                </button>

                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    color: '#ef4444',
                    cursor: 'pointer'
                  }}
                  title="Sair do App"
                >
                  <LogOut size={18} />
                </button>
              </div>

            </div>
          </aside>
        </>
      )}


      {/* ── Desktop Sidebar (Fixo à Esquerda - Expansível) ── */}
      <aside className={`app-sidebar hide-on-mobile ${isSidebarCollapsed ? 'app-sidebar--collapsed' : ''}`}>
        <div className="sidebar-brand-wrapper" onClick={() => currentUser?.isDemo ? handleLogout() : setActiveTab('home')}>
          {isSidebarCollapsed ? (
            <img src="/favicon.svg" alt="M" className="sidebar-logo" style={{ height: '32px', width: '32px', objectFit: 'contain' }} onError={(e) => { e.target.src = logo.src }} />
          ) : (
            <img src={logo.src} alt={logo.alt} className="sidebar-logo" />
          )}
        </div>

        {/* Botão de Toggle para expandir/recolher a sidebar */}
        <button 
          onClick={toggleSidebarCollapse} 
          className="sidebar-collapse-toggle-btn"
          title={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
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
              {!isSidebarCollapsed && <div className="sidebar-section-divider" />}
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
                <DefaultAvatar size={56} />
              )}
            </div>
            <div className="sidebar-profile-info">
              <span className="sidebar-username">{userProfile?.nickname || userProfile?.name || currentUser?.name || 'Usuário'}</span>
              <span className="sidebar-user-tier">{isPro ? 'Pro Member' : 'Membro Free'}</span>
            </div>
          </div>
        </div>
      </aside>

    </>
  );
}
