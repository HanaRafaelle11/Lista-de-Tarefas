import React, { useEffect } from 'react';
import { AppProvider, useAppContext } from './contexts/AppContext';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import TodoView from './components/TodoView';
import EvolutionView from './components/EvolutionView';
import HomeView from './components/HomeView';
import GoalsView from './components/GoalsView';
import SettingsView from './components/SettingsView';
import FocusView from './components/FocusView';
import ProfileView from './components/ProfileView';
import PerformanceView from './components/PerformanceView';
import AdminDashboard from './components/AdminDashboard';
import AchievementToastManager from './components/AchievementToast';

// ─── Layout interno (usa o contexto) ─────────────────────────────────────────
function AppLayout() {
  const {
    currentUser,
    isInitializing,
    activeTab,
    handleLoginSuccess,
    toastQueue,
    dismissToast,
    supabaseConfigError,
    logEvent,
    isPro
  } = useAppContext();

  // Registrar visualizações analíticas ao mudar de aba
  useEffect(() => {
    if (currentUser?.id && activeTab) {
      const tabEventMap = {
        home: 'home_viewed',
        goals: 'goals_viewed',
        tasks: 'tasks_viewed',
        focus: 'focus_viewed',
        analytics: 'analytics_viewed',
        performance: 'performance_viewed',
        profile: 'profile_viewed',
        admin: 'admin_viewed',
        settings: 'settings_viewed',
      };
      
      const eventName = tabEventMap[activeTab];
      if (eventName) {
        logEvent(eventName);
      }

      if (activeTab === 'analytics' && !isPro) {
        logEvent('paywall_viewed');
      }
    }
  }, [activeTab, currentUser?.id, logEvent, isPro]);

  // Tela de erro caso falte configuração do Supabase (Bloco 2)
  if (supabaseConfigError) {
    return (
      <div className="app-loading-container" style={{ padding: '32px', textAlign: 'center', maxWidth: '480px', margin: '100px auto' }}>
        <span style={{ fontSize: '48px' }}>⚠️</span>
        <h2 style={{ fontSize: '20px', margin: '16px 0 8px', color: 'var(--prio-alta-text)' }}>Erro de Configuração</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          As variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` não foram encontradas.
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '8px' }}>
          Por favor, crie um arquivo `.env.local` na raiz do projeto com as credenciais do seu projeto Supabase.
        </p>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="app-loading-container">
        <div className="app-loading-spinner" />
        <span className="app-loading-text">Carregando o Flowday...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-wrapper">
      <Navbar />

      <main className="app-main-content">
        <div className="container">
          {activeTab === 'home'        && <HomeView />}
          {activeTab === 'goals'       && <GoalsView />}
          {activeTab === 'tasks'       && <TodoView />}
          {activeTab === 'focus'       && <FocusView />}
          {activeTab === 'analytics'   && <EvolutionView />}
          {activeTab === 'performance' && <PerformanceView />}
          {activeTab === 'profile'     && <ProfileView />}
          {activeTab === 'admin'       && <AdminDashboard />}
          {activeTab === 'settings'    && <SettingsView />}
        </div>
      </main>


      <AchievementToastManager queue={toastQueue} onDismiss={dismissToast} />

      <footer className="app-footer">
        <p>© 2026 Flowday. Sistema de Evolução Pessoal. Integrado com o Supabase.</p>
      </footer>
    </div>
  );
}

// ─── App raiz — apenas providers + layout ────────────────────────────────────
export default function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}
