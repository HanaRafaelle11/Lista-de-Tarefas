import React, { useEffect, lazy, Suspense } from 'react';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { useNotifications } from './hooks/useNotifications';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import PrivacyView from './components/PrivacyView';
import TermsView from './components/TermsView';
import FaqView from './components/FaqView';

import AchievementToastManager from './components/AchievementToast';
import SyncStatusBanner from './components/SyncStatusBanner';
import PaywallModal from './components/PaywallModal';

import HomeView from './components/HomeView';
import GoalsView from './components/GoalsView';
import TodoView from './components/TodoView';
import FocusView from './components/FocusView';
import EvolutionView from './components/EvolutionView';
import PerformanceView from './components/PerformanceView';
import ProfileView from './components/ProfileView';
import AdminDashboard from './components/AdminDashboard';
import SettingsView from './components/SettingsView';
import CoachView from './components/CoachView';

const RevenueDashboard = lazy(() => import('./pages/RevenueDashboard'));
const Checkout = lazy(() => import('./pages/Checkout'));

const GuidedTour = lazy(() => import('./components/GuidedTour'));
const NotificationEngine = lazy(() => import('./components/NotificationEngine'));
const PwaInstallPrompt = lazy(() => import('./components/PwaInstallPrompt'));

// Classe Global Error Boundary para resiliência total e imunidade a telas brancas
class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[GlobalErrorBoundary] Erro global capturado:', error, errorInfo);
  }
  handleReset = async () => {
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Erro ao restaurar cache local:', e);
    } finally {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
            <h2 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: '700', color: '#f8fafc' }}>
              MyFlowDay
            </h2>
            <p style={{ fontSize: '14.5px', color: '#94a3b8', lineHeight: '1.6', margin: '0 0 24px' }}>
              O sistema foi atualizado para uma versão mais recente ou identificou uma oscilação temporária de cache no seu navegador.
            </p>
            <button 
              onClick={this.handleReset}
              style={{
                width: '100%',
                padding: '14px 24px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                transition: 'transform 0.1s ease'
              }}
            >
              Atualizar e Carregar Aplicativo 🚀
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    isAccessChecked,
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

  // Detectar hash de recuperação de senha — verificação simples via hash, sem listener duplicado de auth
  useEffect(() => {
    const checkRecoveryHash = () => {
      if (window.location.hash.includes('type=recovery')) {
        setAuthMode('updatePassword');
      }
    };
    checkRecoveryHash();
    window.addEventListener('hashchange', checkRecoveryHash);
    return () => window.removeEventListener('hashchange', checkRecoveryHash);
  }, []);

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

  if (currentPath === '/checkout') {
    return (
      <Suspense fallback={
        <div className="app-loading-container">
          <div className="app-loading-spinner" />
          <span className="app-loading-text">Carregando Checkout...</span>
        </div>
      }>
        <Checkout />
      </Suspense>
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
      {!isInitializing && isAccessChecked && !isPro && (
        <div className="pro-upgrade-banner" style={{
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
          padding: '10px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#10b981',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>Desbloqueie o MyFlowDay Pro para ter acesso a relatórios e análises completas!</span>
          <button 
            onClick={() => {
              window.history.pushState(null, '', '/checkout');
              window.dispatchEvent(new Event('popstate'));
            }}
            style={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Quero ser Pro ⚡
          </button>
        </div>
      )}
      <SyncStatusBanner />
      <Navbar />

      <main className="app-main-content">
        <div className="container">
          <GlobalErrorBoundary>
            <Suspense fallback={
              <div className="app-loading-container">
                <div className="app-loading-spinner" />
                <span className="app-loading-text">Carregando...</span>
              </div>
            }>
              {activeTab === 'home' && <HomeView />}
              {activeTab === 'goals' && <GoalsView />}
              {activeTab === 'tasks' && <TodoView />}
              {activeTab === 'focus' && <FocusView />}
              {activeTab === 'coach' && <CoachView />}
              {activeTab === 'analytics' && <EvolutionView />}
              {activeTab === 'performance' && <PerformanceView />}
              {activeTab === 'profile' && <ProfileView />}
              {activeTab === 'admin' && <AdminDashboard />}
              {activeTab === 'revenue' && <RevenueDashboard />}
              {activeTab === 'settings' && <SettingsView />}
            </Suspense>
          </GlobalErrorBoundary>
        </div>
      </main>

      {undoAction && (
        <div className="undo-toast animate-scale-up">
          <span className="undo-toast-text">
            {undoAction.type === 'task'
              ? 'Tarefa removida'
              : undoAction.type === 'bulk_task'
                ? 'Tarefas removidas'
                : undoAction.type === 'bulk_goal'
                  ? 'Objetivos removidos'
                  : 'Objetivo removido'}
          </span>
          <button className="undo-toast-btn" onClick={triggerUndo}>
            DESFAZER
          </button>
        </div>
      )}



      <AchievementToastManager queue={toastQueue} onDismiss={dismissToast} />
      <PaywallModal />
      <Suspense fallback={null}>
        <GuidedTour />
        <NotificationEngine />
        <PwaInstallPrompt />
      </Suspense>
    </div>
  );
}

// ─── App raiz — apenas providers + layout com imunidade a falhas ────────────
export default function App() {
  return (
    <GlobalErrorBoundary>
      <AppProvider>
        <AppLayout />
      </AppProvider>
    </GlobalErrorBoundary>
  );
}