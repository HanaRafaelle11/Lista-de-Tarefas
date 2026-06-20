import React, { useEffect, lazy, Suspense } from 'react';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import PrivacyView from './components/PrivacyView';
import TermsView from './components/TermsView';
import FaqView from './components/FaqView';

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

// Helper function to resolve public legal routes
const getLegalRoute = (path, hash) => {
  const cleanPath = path.toLowerCase().replace(/\/$/, '');
  const cleanHash = hash.toLowerCase().replace(/^#\/?/, '');

  if (
    cleanPath === '/privacidade' || 
    cleanPath === '/privacy' || 
    cleanHash === 'privacidade' || 
    cleanHash === 'privacy'
  ) {
    return 'privacy';
  }
  if (
    cleanPath === '/termos' || 
    cleanPath === '/terms' || 
    cleanHash === 'termos' || 
    cleanHash === 'terms'
  ) {
    return 'terms';
  }
  if (
    cleanPath === '/faq' ||
    cleanHash === 'faq'
  ) {
    return 'faq';
  }
  return null;
};

// ─── Layout interno (usa o contexto) ───────────────────────────────────
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
    isPro,
    isAdmin,
    undoAction,
    triggerUndo,
    handleLogout
  } = useAppContext();

  // Custom routing states
  const [currentPath, setCurrentPath] = React.useState(() => window.location.pathname);
  const [currentHash, setCurrentHash] = React.useState(() => window.location.hash);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      setCurrentHash(window.location.hash);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const [authMode, setAuthMode] = React.useState('login');
  // Controla se o usuário está na landing page pública (apenas para não-autenticados)
  const [showLanding, setShowLanding] = React.useState(() => {
    // Verifica se veio de um link direto para o app (ex: ?app=1)
    return !window.location.search.includes('app=1');
  });

  // Detectar hash de recuperação de senha (fallback)
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash.includes('type=recovery')) {
        setAuthMode('updatePassword');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Escutar eventos de autenticação do Supabase (prioritário)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('updatePassword');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Roda apenas uma vez no mount

  // Registrar visualizações analíticas ao mudar de aba
  useEffect(() => {
    if (currentUser?.id && activeTab) {
      logEvent('screen_view', { screen: activeTab });

      if (activeTab === 'analytics' && !isPro) {
        logEvent('paywall_viewed');
      }
    }
  }, [activeTab, currentUser?.id, logEvent, isPro]);

  // Interceptar rotas de Termos e Privacidade públicas
  const legalRoute = getLegalRoute(currentPath, currentHash);

  if (legalRoute === 'privacy') {
    return (
      <PrivacyView
        onGoBack={() => {
          window.history.pushState(null, '', '/');
          window.dispatchEvent(new Event('popstate'));
        }}
        onNavigateToTerms={() => {
          window.history.pushState(null, '', '/termos');
          window.dispatchEvent(new Event('popstate'));
        }}
      />
    );
  }

  if (legalRoute === 'terms') {
    return (
      <TermsView
        onGoBack={() => {
          window.history.pushState(null, '', '/');
          window.dispatchEvent(new Event('popstate'));
        }}
        onNavigateToPrivacy={() => {
          window.history.pushState(null, '', '/privacidade');
          window.dispatchEvent(new Event('popstate'));
        }}
      />
    );
  }

  if (legalRoute === 'faq') {
    return (
      <FaqView
        onGoBack={() => {
          window.history.pushState(null, '', '/');
          window.dispatchEvent(new Event('popstate'));
        }}
      />
    );
  }

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
    // Exibe landing page pública antes da tela de autenticação
    if (showLanding) {
      return <LandingPage onEnterApp={() => setShowLanding(false)} />;
    }
    return <Auth onLoginSuccess={handleLoginSuccess} initialMode={authMode} onBackToLanding={() => setShowLanding(true)} />;
  }

  return (
    <div className="app-wrapper">
      {currentUser?.isDemo && (
        <div className="demo-banner">
          <span>Você está no Modo de Demonstração. Crie uma conta gratuita para salvar e sincronizar seus dados.</span>
          <button className="demo-banner-btn" onClick={handleLogout}>Criar Conta</button>
        </div>
      )}
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

      {undoAction && (
        <div className="undo-toast animate-scale-up">
          <span className="undo-toast-text">
            {undoAction.type === 'task' 
              ? 'Tarefa removida' 
              : undoAction.type === 'bulk_task' 
                ? 'Tarefas removidas' 
                : 'Objetivo removido'}
          </span>
          <button className="undo-toast-btn" onClick={triggerUndo}>
            DESFAZER
          </button>
        </div>
      )}

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
