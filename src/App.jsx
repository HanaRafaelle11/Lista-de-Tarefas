import React from 'react';
import { AppProvider, useAppContext } from './contexts/AppContext';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import TodoView from './components/TodoView';
import EvolutionView from './components/EvolutionView';
import HomeView from './components/HomeView';
import GoalsView from './components/GoalsView';
import SettingsView from './components/SettingsView';
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
  } = useAppContext();

  if (isInitializing) {
    return (
      <div className="app-loading-container">
        <div className="app-loading-spinner" />
        <span className="app-loading-text">Carregando o FocusList...</span>
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
          {activeTab === 'home'      && <HomeView />}
          {activeTab === 'goals'     && <GoalsView />}
          {activeTab === 'tasks'     && <TodoView />}
          {activeTab === 'analytics' && <EvolutionView />}
          {activeTab === 'settings'  && <SettingsView />}
        </div>
      </main>

      <AchievementToastManager queue={toastQueue} onDismiss={dismissToast} />

      <footer className="app-footer">
        <p>© 2026 FocusList. Criado com React e Vanilla CSS. Integrado com o Supabase.</p>
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
