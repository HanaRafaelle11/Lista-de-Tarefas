import React, { useEffect, lazy, Suspense } from 'react';
import { AppProvider, useAppContext } from './contexts/AppContext';
import Auth from './components/Auth';
import Navbar from './components/Navbar';

import AchievementToastManager from './components/AchievementToast';
import SyncStatusBanner from './components/SyncStatusBanner';
const HomeView = lazy(() => import('./components/HomeView'));
const GoalsView = lazy(() => import('./components/GoalsView'));
const TodoView = lazy(() => import('./components/TodoView'));
const FocusView = lazy(() => import('./components/FocusView'));
const EvolutionView = lazy(() => import('./components/EvolutionView'));
const PerformanceView = lazy(() => import('./components/PerformanceView'));
const ProfileView = lazy(() => import('./components/ProfileView'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const DevToolsWidget = lazy(() => import('./components/DevToolsWidget'));
const GuidedTour = lazy(() => import('./components/GuidedTour'));
const NotificationEngine = lazy(() => import('./components/NotificationEngine'));
const PwaInstallPrompt = lazy(() => import('./components/PwaInstallPrompt'));

// ─── Layout interno (usa o contexto) ─────────────────────────────────────────
function AppLayout() {
  console.error("DEBUG_APP_LAYOUT_MOUNT");
  const {
    currentUser,
    isInitializing,
    activeTab,
    handleLoginSuccess,
    toastQueue,
    dismissToast,
    supabaseConfigError,
    logEvent,
    isPro,
    isAdmin,
  } = useAppContext();

  // Registrar visualizações analíticas ao mudar de aba
  useEffect(() => {
    if (currentUser?.id && activeTab) {
      logEvent('screen_view', { screen: activeTab });

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
      <SyncStatusBanner />
      <Navbar />

      <main className="app-main-content">
        <div className="container">
          <Suspense fallback={
            <div className="app-loading-container">
              <div className="app-loading-spinner" />
              <span className="app-loading-text">Carregando...</span>
            </div>
          }>
            {activeTab === 'home'        && <HomeView />}
            {activeTab === 'goals'       && <GoalsView />}
            {activeTab === 'tasks'       && <TodoView />}
            {activeTab === 'focus'       && <FocusView />}
            {activeTab === 'analytics'   && <EvolutionView />}
            {activeTab === 'performance' && <PerformanceView />}
            {activeTab === 'profile'     && <ProfileView />}
            {activeTab === 'admin'       && <AdminDashboard />}
            {activeTab === 'settings'    && <SettingsView />}
          </Suspense>
        </div>
      </main>

      {isAdmin && (
        <Suspense fallback={null}>
          <DevToolsWidget />
        </Suspense>
      )}

      <AchievementToastManager queue={toastQueue} onDismiss={dismissToast} />
      <Suspense fallback={null}>
        <GuidedTour />
        <NotificationEngine />
        <PwaInstallPrompt />
      </Suspense>
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
