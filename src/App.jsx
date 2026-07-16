import React, { useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { useNotifications } from './hooks/useNotifications';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';
import CreatePasswordModal from './components/CreatePasswordModal';
import Sidebar from './components/Sidebar';
import PrivacyView from './components/PrivacyView';
import TermsView from './components/TermsView';
import FaqView from './components/FaqView';

import SyncStatusBanner from './components/SyncStatusBanner';
import PaywallModal from './components/PaywallModal';
import MFIcon from './components/MFIcon';
import Navbar from './components/Navbar';
import GuidedTour from './components/GuidedTour';

const LandingPage = lazy(() => import('./components/LandingPage'));
const HomeView = lazy(() => import('./components/HomeView'));
const MyDayView = lazy(() => import('./components/MyDayView'));
const FocusView = lazy(() => import('./components/FocusView'));
const EvolutionView = lazy(() => import('./components/EvolutionView'));
const ProfileView = lazy(() => import('./components/ProfileView'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const AchievementToastManager = lazy(() => import('./components/AchievementToast'));

const RevenueDashboard = lazy(() => import('./pages/RevenueDashboard'));
const Checkout = lazy(() => import('./pages/Checkout'));


const NotificationEngine = lazy(() => import('./components/NotificationEngine'));
const PwaInstallPrompt = lazy(() => import('./components/PwaInstallPrompt'));
const EvolutionCelebrationModal = lazy(() => import('./components/EvolutionCelebrationModal'));

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
      // Remove apenas chaves do flowday, mas mantém supabase.auth.token
      if (typeof window !== 'undefined') {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !key.startsWith('sb-') && !key.includes('supabase')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
      sessionStorage.clear();
    } catch (e) {
      console.warn('Erro ao restaurar cache local:', e);
    } finally {
      window.location.href = '/';
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}><MFIcon name="bolt" size={48} color="var(--primary)" /></div>
            <h2 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: '700', color: '#f8fafc' }}>
              MyFlowDay
            </h2>
            <p style={{ fontSize: '14.5px', color: '#94a3b8', lineHeight: '1.6', margin: '0 0 24px' }}>
              Ocorreu um erro temporário ao carregar esta seção. Seus dados estão salvos e seguros no servidor.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={this.handleRetry}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '15px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  transition: 'transform 0.1s ease'
                }}
              >
                Tentar novamente
              </button>
              <button 
                onClick={this.handleReset}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Limpar Cache e Recarregar
              </button>
            </div>
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
    handleLogout,
    userProfile
  } = useAppContext();

  // ── Create Password Modal ──────────────────────────────────────
  const [showCreatePasswordModal, setShowCreatePasswordModal] = React.useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.isDemo) return;
    
    // Se já tem senha ou se descartou o prompt (no banco ou localStorage), não exibe
    const hasPassword = userProfile?.has_password;
    const dismissed = userProfile?.dismissed_password_prompt || localStorage.getItem('dismissed_password_prompt') === 'true';
    if (hasPassword || dismissed) {
      setShowCreatePasswordModal(false);
      return;
    }

    const meta = currentUser.user_metadata || {};
    if (meta.password_created) return; // Já criou senha antes
    
    // Verifica o provider — se é google ou email sem senha
    const checkProvider = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data?.user) return;
        const identities = data.user.identities || [];
        const hasGoogleProvider = identities.some(i => i.provider === 'google');
        // Se entrou por Google, ou se tem email sem ter definido senha explicitamente
        // e não tem a flag password_created
        if (hasGoogleProvider && !data.user.user_metadata?.password_created) {
          setShowCreatePasswordModal(true);
        }
      } catch (e) {
        console.warn('Erro ao verificar provider:', e);
      }
    };
    checkProvider();
  }, [currentUser, userProfile]);



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

  // Scroll to top on routing or tab change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentPath, activeTab]);

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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}><MFIcon name="warning" size={48} color="var(--prio-alta-text)" /></div>
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

  if (!currentUser || authMode === 'updatePassword') {
    // Exibe landing page pública antes da tela de autenticação
    if (showLanding && authMode !== 'updatePassword') {
      return (
        <Suspense fallback={
          <div className="app-loading-container">
            <div className="app-loading-spinner" />
            <span className="app-loading-text">Carregando o Flowday...</span>
          </div>
        }>
          <LandingPage onEnterApp={() => setShowLanding(false)} />
        </Suspense>
      );
    }
    return <Auth onLoginSuccess={handleLoginSuccess} initialMode={authMode} onBackToLanding={() => setShowLanding(true)} />;
  }

  return (
    <div className={`app-wrapper ${currentUser?.isDemo ? 'has-demo-banner' : ''}`}>
      {currentUser?.isDemo && (
        <div className="demo-banner">
          <span className="hide-on-mobile">Você está no Modo de Demonstração. Crie uma conta gratuita para salvar e sincronizar seus dados.</span>
          <span className="hide-on-desktop" style={{ fontSize: '11px', textAlign: 'center' }}>Modo de Demonstração. Crie uma conta para salvar seus dados.</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="demo-banner-btn" onClick={() => handleLogout()}>Sair do modo teste</button>
            <button className="demo-banner-btn" style={{ backgroundColor: '#10b981' }} onClick={() => { setAuthMode('register'); setShowLanding(false); handleLogout(true); }}>Criar Conta</button>
          </div>
        </div>
      )}

      <SyncStatusBanner />
      
      <Navbar />
      
      <div className="app-body-container">
        <Sidebar />

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
                {activeTab === 'myday' && <MyDayView />}
                {activeTab === 'focus' && <FocusView />}
                {activeTab === 'evolution' && <EvolutionView />}
                {activeTab === 'profile' && <ProfileView />}
                {activeTab === 'admin' && <AdminDashboard />}
                {activeTab === 'revenue' && <RevenueDashboard />}
                {activeTab === 'settings' && <SettingsView />}
              </Suspense>
            </GlobalErrorBoundary>
          </div>
        </main>
      </div>

      {undoAction && createPortal(
        <div className="undo-toast animate-scale-up" style={{ zIndex: 12000 }}>
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
        </div>,
        document.body
      )}



      <PaywallModal />
      <Suspense fallback={null}>
        <EvolutionCelebrationModal />
      </Suspense>
      {showCreatePasswordModal && (
        <CreatePasswordModal
          onClose={() => setShowCreatePasswordModal(false)}
          onSuccess={() => setShowCreatePasswordModal(false)}
        />
      )}
      <Suspense fallback={null}>
        <AchievementToastManager queue={toastQueue} onDismiss={dismissToast} />
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