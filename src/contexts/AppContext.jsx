import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { supabase } from '../supabaseClient';
import { tasksService }        from '../services/tasksService';
import { goalsService }         from '../services/goalsService';
import { habitsService }        from '../services/habitsService';
import { achievementsService }  from '../services/achievementsService';
import { eventsService }        from '../services/eventsService';
import { profilesService }      from '../services/profilesService';
import { ACHIEVEMENTS, calcStats, calcStreak } from '../hooks/useAchievements';
import { subscribe as subscribeSync, initSyncQueue, generateId } from '../services/syncQueue';
import { initEventBatcher } from '../services/eventBatcher';
import { generateInsights } from '../intelligence/productIntelligence';
import { getEngagementSuggestions } from '../intelligence/retentionEngine';
import { eventStore } from '../services/eventStore';
import { stateEngine } from '../services/stateEngine';
import { eventEmitter } from '../services/eventEmitter';
import { localDB } from '../db/localDB';

// ─── Helpers para Metadados de Tarefas (Horário e Recorrência) ───────────────
export function parseTaskMetadata(description = '') {
  if (!description) return { due_time: '', recurrence: 'nenhuma' };
  const marker = '--flowday-meta--';
  const parts = description.split(marker);
  if (parts.length < 2) return { due_time: '', recurrence: 'nenhuma' };
  try {
    return JSON.parse(parts[1].trim());
  } catch (e) {
    return { due_time: '', recurrence: 'nenhuma' };
  }
}

export function formatDescriptionWithoutMetadata(description = '') {
  if (!description) return '';
  const marker = '--flowday-meta--';
  return description.split(marker)[0].trim();
}

export function buildDescriptionWithMetadata(userDesc = '', due_time = '', recurrence = 'nenhuma') {
  const cleanDesc = formatDescriptionWithoutMetadata(userDesc);
  const existingMeta = parseTaskMetadata(userDesc);
  const marker = '--flowday-meta--';
  const meta = { ...existingMeta, due_time, recurrence };
  return `${cleanDesc}\n\n${marker}\n${JSON.stringify(meta)}`;
}

export function calculateNextOccurrence(dueDateStr, recurrence) {
  if (!dueDateStr) {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  }
  
  const [year, month, day] = dueDateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  if (recurrence === 'diaria') {
    date.setDate(date.getDate() + 1);
  } else if (recurrence === 'semanal') {
    date.setDate(date.getDate() + 7);
  } else if (recurrence === 'mensal') {
    date.setMonth(date.getMonth() + 1);
  }
  
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ─── Categorias Padrão ────────────────────────────────────────────────────────
const defaultCategories = [
  { id: 'Trabalho', name: 'Trabalho', emoji: '💼', color: '#6B7F8A' },
  { id: 'Pessoal', name: 'Pessoal', emoji: '🏠', color: '#7A8B7B' },
  { id: 'Estudos', name: 'Estudos', emoji: '📚', color: '#B09E86' },
  { id: 'Lazer', name: 'Lazer', emoji: '🎸', color: '#A88891' },
  { id: 'Pets', name: 'Pets', emoji: '🐾', color: '#B5A296' }
];

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext deve ser usado dentro de <AppProvider>');
  return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {

  // ── Auth ────────────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser]       = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // ── Sync Status (resilience) ─────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState('healthy'); // 'healthy' | 'degraded' | 'offline'
  const [syncWarnings, setSyncWarnings] = useState([]);

  // ── Perfil do Usuário ──
  const [userProfile, setUserProfile]       = useState(null);

  // ── Navegação ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) return tabParam;
      const hashParam = window.location.hash.replace(/^#\/?/, '');
      if (hashParam) return hashParam;
    } catch (_) {}
    return 'home';
  });
  const [settingsTab, setSettingsTab] = useState('general'); // 'general' | 'trash'

  // ── Som Ambiente Global ──
  const [ambientSoundFile, setAmbientSoundFile] = useState(() => localStorage.getItem('flowday_ambient_sound_file') || 'none');
  const [ambientSoundVolume, setAmbientSoundVolume] = useState(() => {
    const vol = localStorage.getItem('flowday_ambient_sound_volume');
    return vol !== null ? Number(vol) : 0.5;
  });
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const ambientAudioRef = useRef(null);
  const fadeIntervalRef = useRef(null);

  // Inicializa o elemento Audio e configura loops
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.onerror = (e) => {
      console.warn('[Audio] Erro ao reproduzir som ambiente:', e);
    };
    ambientAudioRef.current = audio;

    return () => {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        ambientAudioRef.current = null;
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, []);

  // Controla reprodução do som ambiente com fades suaves
  useEffect(() => {
    const audio = ambientAudioRef.current;
    if (!audio) return;

    if (ambientSoundFile === 'none') {
      audio.pause();
      audio.src = '';
      setIsAmbientPlaying(false);
      setAudioBlocked(false);
      localStorage.setItem('flowday_ambient_is_playing', 'false');
      localStorage.setItem('flowday_ambient_sound_file', 'none');
      return;
    }

    const targetSrc = `${window.location.origin}/assets/audio/${ambientSoundFile}`;
    if (audio.src !== targetSrc) {
      audio.src = targetSrc;
      audio.load();
    }

    localStorage.setItem('flowday_ambient_sound_file', ambientSoundFile);
    localStorage.setItem('flowday_ambient_sound_volume', String(ambientSoundVolume));
    localStorage.setItem('flowday_ambient_is_playing', String(isAmbientPlaying));

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    if (isAmbientPlaying) {
      audio.volume = 0;
      audio.play()
        .then(() => {
          setAudioBlocked(false);
          const step = 0.05;
          const intervalMs = 50;
          fadeIntervalRef.current = setInterval(() => {
            if (!ambientAudioRef.current) return;
            const nextVol = audio.volume + step;
            if (nextVol >= ambientSoundVolume) {
              audio.volume = ambientSoundVolume;
              clearInterval(fadeIntervalRef.current);
              fadeIntervalRef.current = null;
            } else {
              audio.volume = nextVol;
            }
          }, intervalMs);
        })
        .catch(e => {
          if (e.name === 'NotAllowedError') {
            setAudioBlocked(true);
            setIsAmbientPlaying(false);
            console.info('[Audio] Autoplay bloqueado pelo navegador.');
          } else {
            console.error('[Audio] Erro ao tocar som ambiente:', e);
          }
        });
    } else {
      const step = 0.05;
      const intervalMs = 50;
      const startVol = audio.volume;
      if (startVol > 0 && !audio.paused) {
        fadeIntervalRef.current = setInterval(() => {
          if (!ambientAudioRef.current) return;
          const nextVol = audio.volume - step;
          if (nextVol <= 0) {
            audio.volume = 0;
            audio.pause();
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
          } else {
            audio.volume = nextVol;
          }
        }, intervalMs);
      } else {
        audio.pause();
        audio.volume = 0;
      }
    }
  }, [ambientSoundFile, isAmbientPlaying]);

  // Sincroniza volume ao arrastar slider se não estiver no meio do fade
  useEffect(() => {
    const audio = ambientAudioRef.current;
    if (!audio || ambientSoundFile === 'none') return;
    if (!fadeIntervalRef.current) {
      audio.volume = ambientSoundVolume;
    }
    localStorage.setItem('flowday_ambient_sound_volume', String(ambientSoundVolume));
  }, [ambientSoundVolume, ambientSoundFile]);
  const [shouldOpenGoalModal, setShouldOpenGoalModal] = useState(false);

  // ── Tema ─────────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
  const [appBgColor, setAppBgColor] = useState(localStorage.getItem('app_bg_color') || '#F8FAFC');

  // ── Dados ────────────────────────────────────────────────────────────────────
  const [tasks, setTasks]           = useState([]);
  const [goals, setGoals]           = useState([]);
  const [goalTasks, setGoalTasks]   = useState([]);

  // ── Conquistas ───────────────────────────────────────────────────────────────
  const [unlockedAchievements, setUnlockedAchievements] = useState(null);
  const [unlockedKeys, setUnlockedKeys]                 = useState(null);
  const [toastQueue, setToastQueue]                     = useState([]);

  // ── Hábitos ──────────────────────────────────────────────────────────────────
  const [habits, setHabits]         = useState([]);
  const [habitLogs, setHabitLogs]   = useState([]);
  const [habitsLoading, setHabitsLoading] = useState(false);

  // ── Notificações & Undo (Soft Delete) ──────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [undoAction, setUndoAction]       = useState(null);

  // ── Ref para lock de conquistas ───────────────────────────────────────────────
  const achievementChecking = useRef(false);
  const unlockedKeysRef = useRef(new Set());
  // Garante que first_success_action é emitido apenas uma vez por sessão
  const firstSuccessLogged = useRef(false);
  // Garante que conquistas só são verificadas APÓS o primeiro carregamento completo dos dados
  // Isso impede o popup falso na inicialização antes dos dados carregarem do Supabase
  const dataLoadedOnce = useRef(false);

  // ── User State Intelligence (Growth) ─────────────────────────────────────────────
  const [userState, setUserState] = useState({
    stage:               'new',
    activation_score:    0,
    last_success_action: null,
    time_to_value_ms:    null,
    days_since_active:   0,
    has_first_success:   false,
  });

  // ── Product Intelligence & Retention (Fase 2.0) ──
  const [insights, setInsights]       = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!currentUser?.id) {
      setInsights([]);
      setSuggestions([]);
      return;
    }
    // 1. Recalcula insights comportamentais
    const activeTasks = tasks.filter(t => !t.deletedAt);
    const newInsights = generateInsights(activeTasks);
    setInsights(newInsights);

    // 2. Recalcula sugestões de retenção baseadas no progresso
    const isObCompleted = !!currentUser?.user_metadata?.onboarding_completed;
    const newSuggestions = getEngagementSuggestions(userState, activeTasks, isObCompleted);
    setSuggestions(newSuggestions);
  }, [tasks, userState, currentUser?.id, currentUser?.user_metadata?.onboarding_completed]);

  // ── Feature Flags & Assinatura (SaaS) ───────────────────────────────────────
  const [isPro, setIsPro] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallSource, setPaywallSource] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('free'); // 'ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING'
  const [subscriptionPlan, setSubscriptionPlan] = useState('free'); // 'pro', 'free'
  const [churnScore, setChurnScore] = useState(0);
  const [churnRisk, setChurnRisk] = useState('low');

  // Determina se usuário logado é administrador
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const adminEmails = ['admin@flowday.app', 'rafaelle@flowday.app', 'rafox@flowday.app'];
    return !!currentUser.user_metadata?.is_admin || adminEmails.includes(currentUser.email);
  }, [currentUser]);

  const loadSubscription = useCallback(async (userId) => {
    // A assinatura agora é derivada do userProfile carregado por loadProfile e atualizado em tempo real.
  }, []);

  // ── Categorias Customizadas (SaaS) ──────────────────────────────────────────
  const categories = useMemo(() => {
    const custom = currentUser?.user_metadata?.custom_categories || [];
    return [...defaultCategories, ...custom];
  }, [currentUser]);

  // ── Validação Supabase ──────────────────────────────────────────────────────
  const supabaseConfigError = typeof window !== 'undefined' && !!window.supabaseConfigError;

  // ── Subscrição ao syncQueue ───────────────────────────────────────────────────
  useEffect(() => {
    // Inicialização assíncrona do IndexedDB da fila e do batcher
    initSyncQueue().catch(err => console.error('[AppContext] Erro initSyncQueue:', err));
    initEventBatcher().catch(err => console.error('[AppContext] Erro initEventBatcher:', err));

    const unsub = subscribeSync((state) => {
      setSyncStatus(state.supabase || state.syncStatus || 'healthy');
      setSyncWarnings(state.warnings || []);
    });
    return unsub;
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMA — aplicação e persistência
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const applyTheme = (t) => {
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (t === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', prefersDark);
      }
    };
    applyTheme(theme);
    localStorage.setItem('theme', theme);

    // Aplicar a cor de fundo customizada
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.style.setProperty('--bg-app', '#0F172A');
    } else {
      document.documentElement.style.setProperty('--bg-app', appBgColor);
    }
    localStorage.setItem('app_bg_color', appBgColor);
  }, [theme, appBgColor]);

  // Sincronização de tema entre abas
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'theme' && e.newValue && e.newValue !== theme) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [theme]);

  // Sincronização de unlockedKeysRef com o estado unlockedKeys
  useEffect(() => {
    if (unlockedKeys) {
      unlockedKeysRef.current = new Set(unlockedKeys);
    } else {
      unlockedKeysRef.current = new Set();
    }
  }, [unlockedKeys]);

  // ── Re-hidratação de Estado por Event Sourcing (Fase 3.0) ──
  const rehydrateUserState = useCallback(async (userId) => {
    if (!userId) return null;
    try {
      const evs = await eventStore.getEventsForUser(userId);
      const projected = stateEngine.computeUserState(evs);
      setUserState(projected);
      return projected;
    } catch (err) {
      console.warn('[AppContext] Erro ao re-hidratar estado:', err.message);
      return null;
    }
  }, []);

  // ── Notificações Helpers ──
  const loadNotifications = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const localNotifs = await localDB.getAll('notifications');
      const userNotifs = localNotifs.filter(n => n.user_id === userId);
      setNotifications(userNotifs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (err) {
      console.warn('[AppContext] Erro ao carregar notificações:', err.message);
    }
  }, []);

  const addNotification = useCallback(async (type, title, description, metadata = {}) => {
    if (!currentUser?.id) return;
    const newNotif = {
      id: generateId(),
      user_id: currentUser.id,
      type,
      title,
      description,
      timestamp: new Date().toISOString(),
      read: false,
      metadata
    };
    setNotifications(prev => [newNotif, ...prev]);
    try {
      await localDB.put('notifications', newNotif);
    } catch (err) {
      console.warn('[AppContext] Erro ao salvar notificação local:', err.message);
    }
  }, [currentUser?.id]);

  const markNotificationsAsRead = useCallback(async () => {
    if (!currentUser?.id) return;
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    try {
      for (const n of updated) {
        await localDB.put('notifications', n);
      }
    } catch (err) {
      console.warn('[AppContext] Erro ao marcar notificações como lidas:', err.message);
    }
  }, [currentUser?.id, notifications]);

  const clearNotifications = useCallback(async () => {
    if (!currentUser?.id) return;
    setNotifications([]);
    try {
      const all = await localDB.getAll('notifications');
      const userNotifs = all.filter(n => n.user_id === currentUser.id);
      for (const n of userNotifs) {
        await localDB.delete('notifications', n.id);
      }
    } catch (err) {
      console.warn('[AppContext] Erro ao limpar notificações:', err.message);
    }
  }, [currentUser?.id]);

  // ── Modo Demo Helpers ──
  const initDemoData = () => {
    const demoTasksKey = `flowday_demo_tasks_${currentUser.id}`;
    const demoGoalsKey = `flowday_demo_goals_${currentUser.id}`;
    const demoHabitsKey = `flowday_demo_habits_${currentUser.id}`;
    const demoAchievementsKey = `flowday_demo_achievements_${currentUser.id}`;

    let localTasks = localStorage.getItem(demoTasksKey);
    let localGoals = localStorage.getItem(demoGoalsKey);
    let localHabits = localStorage.getItem(demoHabitsKey);
    let localAchievements = localStorage.getItem(demoAchievementsKey);

    const now = new Date();
    if (localTasks) {
      setTasks(JSON.parse(localTasks));
    } else {
      const mockTasks = [
        { id: 'dt1', user_id: currentUser.id, title: 'Revisar hooks avançados do React', description: 'Focar em useMemo e useCallback', category: 'Estudos', priority: 'Alta', dueDate: now.toISOString().split('T')[0], completed: true, createdAt: now.toISOString(), completedAt: now.toISOString(), deletedAt: null },
        { id: 'dt2', user_id: currentUser.id, title: 'Correr 5km no parque', description: 'Treinar endurance e ritmo constante', category: 'Lazer', priority: 'Alta', dueDate: now.toISOString().split('T')[0], completed: false, createdAt: now.toISOString(), deletedAt: null },
        { id: 'dt3', user_id: currentUser.id, title: 'Refatorar design system do Flowday', description: 'Ajustar variáveis de cores e glassmorphism', category: 'Trabalho', priority: 'Alta', dueDate: now.toISOString().split('T')[0], completed: false, createdAt: now.toISOString(), deletedAt: null },
        { id: 'dt4', user_id: currentUser.id, title: 'Comprar tênis de corrida com amortecimento', description: 'Focar em proteção de articulações', category: 'Pessoal', priority: 'Média', dueDate: '', completed: true, createdAt: now.toISOString(), completedAt: now.toISOString(), deletedAt: null },
        { id: 'dt5', user_id: currentUser.id, title: 'Ler 20 páginas do livro atual', description: 'Hábito de leitura offline diária', category: 'Pessoal', priority: 'Baixa', dueDate: now.toISOString().split('T')[0], completed: true, createdAt: now.toISOString(), completedAt: now.toISOString(), deletedAt: null },
        { id: 'dt6', user_id: currentUser.id, title: 'Aprender sobre App Router do Next.js', description: 'Estudar layouts e subrotas dinâmicas', category: 'Estudos', priority: 'Média', dueDate: '', completed: false, createdAt: now.toISOString(), deletedAt: null },
        { id: 'dt7', user_id: currentUser.id, title: 'Preparar marmitas saudáveis', description: 'Alimentação equilibrada para a semana', category: 'Pessoal', priority: 'Média', dueDate: '', completed: false, createdAt: now.toISOString(), deletedAt: null }
      ];
      setTasks(mockTasks);
      localStorage.setItem(demoTasksKey, JSON.stringify(mockTasks));
    }

    if (localGoals) {
      const parsed = JSON.parse(localGoals);
      setGoals(parsed.goals);
      setGoalTasks(parsed.goalTasks);
    } else {
      const mockGoals = [
        { id: 'dg1', user_id: currentUser.id, title: '🚀 Dominar o React', description: 'Ficar proficiente em React, hooks e Next.js', color: '#6366f1', icon: '💻', target_date: '', status: 'active', deletedAt: null },
        { id: 'dg2', user_id: currentUser.id, title: '🏃‍♂️ Corrida 10K', description: 'Treinar para correr 10km direto sem paradas', color: '#10b981', icon: '👟', target_date: '', status: 'active', deletedAt: null },
        { id: 'dg3', user_id: currentUser.id, title: '📚 Hábito de Leitura', description: 'Ler pelo menos 1 livro por mês este ano', color: '#f59e0b', icon: '📖', target_date: '', status: 'active', deletedAt: null }
      ];
      const mockGoalTasks = [
        { goal_id: 'dg1', task_id: 'dt1' },
        { goal_id: 'dg1', task_id: 'dt6' },
        { goal_id: 'dg2', task_id: 'dt2' },
        { goal_id: 'dg2', task_id: 'dt4' },
        { goal_id: 'dg3', task_id: 'dt5' }
      ];
      setGoals(mockGoals);
      setGoalTasks(mockGoalTasks);
      localStorage.setItem(demoGoalsKey, JSON.stringify({ goals: mockGoals, goalTasks: mockGoalTasks }));
    }

    if (localHabits) {
      const parsed = JSON.parse(localHabits);
      setHabits(parsed.habits);
      setHabitLogs(parsed.habitLogs);
    } else {
      const mockHabits = [
        { id: 'dh1', user_id: currentUser.id, title: 'Meditar 10 min', description: 'Foco na respiração mindfulness', frequency: 'diaria', created_at: new Date().toISOString() },
        { id: 'dh2', user_id: currentUser.id, title: 'Beber 2L de água', description: 'Garrafa na mesa sempre cheia', frequency: 'diaria', created_at: new Date().toISOString() }
      ];
      const mockLogs = [];
      const today = now.toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      mockLogs.push({ id: 'dl1', habit_id: 'dh2', completed_date: today, user_id: currentUser.id });
      mockLogs.push({ id: 'dl2', habit_id: 'dh1', completed_date: yesterdayStr, user_id: currentUser.id });
      mockLogs.push({ id: 'dl3', habit_id: 'dh2', completed_date: yesterdayStr, user_id: currentUser.id });
      
      setHabits(mockHabits);
      setHabitLogs(mockLogs);
      localStorage.setItem(demoHabitsKey, JSON.stringify({ habits: mockHabits, habitLogs: mockLogs }));
    }

    if (localAchievements) {
      const parsed = JSON.parse(localAchievements);
      setUnlockedAchievements(parsed);
      setUnlockedKeys(new Set(parsed.map(a => a.achievement_key)));
    } else {
      const mockAchievements = [
        { achievement_key: 'first_task', unlocked_at: now.toISOString(), seen: true, dismissed_at: null }
      ];
      setUnlockedAchievements(mockAchievements);
      setUnlockedKeys(new Set(['first_task']));
      localStorage.setItem(demoAchievementsKey, JSON.stringify(mockAchievements));
    }

    setIsPro(true);
    setSubscriptionStatus('active');
    setSubscriptionPlan('pro');
    setIsInitializing(false);
    
    // Notificação de boas vindas
    setTimeout(() => {
      addNotification('system', 'Modo Demo Ativo', 'Você está experimentando o Flowday com uma conta temporária. Fique à vontade para explorar!');
    }, 1000);
  };

  const handleStartDemoMode = () => {
    const demoUser = {
      id: 'demo-user',
      email: 'demo@flowday.app',
      name: 'Explorador Demo',
      isDemo: true,
      user_metadata: { name: 'Explorador Demo', onboarding_completed: true }
    };
    setCurrentUser(demoUser);
    logEvent('demo_started');
    setActiveTab('home');
  };

  // ── Purga automática de lixeira 30 dias ──
  const purgeTrash = useCallback(async (userId) => {
    if (!userId || currentUser?.isDemo) return;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const allTasks = await localDB.getAll('tasks');
      const oldTasks = allTasks.filter(t => t.user_id === userId && t.deletedAt && new Date(t.deletedAt) < thirtyDaysAgo);
      for (const t of oldTasks) {
        await tasksService.deletePermanent(userId, t.id);
      }
      
      const { data: oldGoals } = await supabase
        .from('goals')
        .select('id')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .lt('deleted_at', thirtyDaysAgo.toISOString());
      
      if (oldGoals && oldGoals.length > 0) {
        for (const g of oldGoals) {
          await goalsService.deletePermanent(userId, g.id);
        }
      }
    } catch (err) {
      console.warn('[AppContext] Erro ao purgar lixeira:', err.message);
    }
  }, [currentUser?.isDemo]);

  // LOGGER DE EVENTOS com session tracking
  // ═══════════════════════════════════════════════════════════════════════════
  const logEvent = useCallback(async (eventType, metadata = {}) => {
    if (!currentUser?.id) return;
    try {
      // 1. Salva localmente via Event Sourcing (e emite no barramento síncrono)
      await eventStore.saveEvent(currentUser.id, eventType, metadata);

      // 2. Envia ao batcher para sincronização eventual
      await eventsService.logEvent(currentUser.id, eventType, metadata);

      // 3. Atualiza estado projetado do usuário a partir dos eventos
      await rehydrateUserState(currentUser.id);
    } catch (e) {
      console.warn('[AppContext.logEvent] Falha ao rastrear:', e.message);
    }
  }, [currentUser?.id, rehydrateUserState]);

  // Session tracking: emite session_started no login e session_ended no unload
  useEffect(() => {
    if (!currentUser?.id) return;

    logEvent('session_started', {
      ts: new Date().toISOString()
    });

    const handleUnload = () => {
      logEvent('session_ended', {
        ts: new Date().toISOString()
      });
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [currentUser?.id, logEvent]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE DE CONSISTÊNCIA (Bloco 5)
  // ═══════════════════════════════════════════════════════════════════════════
  const consistencyScore = useMemo(() => {
    if (!currentUser) return 0;

    const activeTasks = tasks.filter(t => !t.deletedAt);
    const activeGoals = goals.filter(g => !g.deletedAt);

    // Se a conta está limpa (sem dados base), score é absoluto 0.
    if (activeTasks.length === 0 && habits.length === 0 && activeGoals.length === 0) {
      return 0;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Taxa de conclusão de tarefas nos últimos 7 dias (40% de peso)
    const recentTasks = activeTasks.filter(t => {
      const date = t.dueDate || t.createdAt?.split('T')[0];
      return date && new Date(date) >= sevenDaysAgo;
    });
    const taskCount = recentTasks.length;
    const completedTaskCount = recentTasks.filter(t => t.completed).length;
    const taskRate = taskCount > 0 ? (completedTaskCount / taskCount) : 0;

    // 2. Taxa de conclusão de hábitos nos últimos 7 dias (40% de peso)
    const recentLogs = habitLogs.filter(l => new Date(l.completed_date) >= sevenDaysAgo);
    const totalPossibleLogs = habits.length * 7;
    const habitRate = totalPossibleLogs > 0 ? (recentLogs.length / totalPossibleLogs) : 0;

    // 3. Progresso dos objetivos ativos (20% de peso)
    const activeGoalsFiltered = activeGoals.filter(g => g.status === 'active');
    let totalPct = 0;
    activeGoalsFiltered.forEach(goal => {
      const linkedIds = goalTasks.filter(gt => gt.goal_id === goal.id).map(gt => gt.task_id);
      const linked = activeTasks.filter(t => linkedIds.includes(t.id));
      const done = linked.filter(t => t.completed).length;
      const pct = linked.length > 0 ? (done / linked.length) : 0;
      totalPct += pct;
    });
    const goalRate = activeGoalsFiltered.length > 0 ? (totalPct / activeGoalsFiltered.length) : 0;

    const finalScore = Math.min(100, Math.round(
      (taskRate * 40) + 
      (habitRate * 40) + 
      (goalRate * 20)
    ));
    return isNaN(finalScore) ? 0 : finalScore;
  }, [tasks, habits, habitLogs, goals, goalTasks, currentUser]);

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADERS
  // ═══════════════════════════════════════════════════════════════════════════
  const loadTasks = useCallback(async (userId) => {
    const { data } = await tasksService.getAll(userId);
    if (data) setTasks(data);
  }, []);

  const loadGoals = useCallback(async (userId) => {
    const { data } = await goalsService.getAll(userId);
    if (data) {
      setGoals(data.goals);
      setGoalTasks(data.goalTasks);
    }
  }, []);

  const loadAchievements = useCallback(async (userId) => {
    const { data } = await achievementsService.getAll(userId);
    const list = data || [];
    setUnlockedAchievements(list);
    setUnlockedKeys(new Set(list.map((a) => a.achievement_key)));

    // Usa localStorage como ÚNICA fonte de verdade para "já foi dispensado".
    // (Colunas seen/dismissed_at podem não existir no banco — não dependemos delas.)
    const dismissedLocalKey = `myflowday_dismissed_achievements_${userId}`;
    let dismissedLocal = {};
    try {
      const val = localStorage.getItem(dismissedLocalKey);
      if (val) dismissedLocal = JSON.parse(val);
    } catch (_) {}

    // Só exibe toasts de conquistas que não foram dispensadas pelo usuário
    const pendingToasts = list.filter((a) => !dismissedLocal[a.achievement_key]);

    if (pendingToasts.length > 0) {
      // ACHIEVEMENTS já está importado estaticamente no topo do arquivo
      setToastQueue((prev) => {
        const existingKeys = new Set(prev.map(t => t.achievement?.key));
        const toAdd = pendingToasts
          .filter(a => !existingKeys.has(a.achievement_key))
          .map(a => ({
            id: `${a.achievement_key}-restore-${Date.now()}`,
            achievement: ACHIEVEMENTS.find(d => d.key === a.achievement_key)
          }))
          .filter(t => t.achievement);
        return [...prev, ...toAdd];
      });
    }
  }, []);

  const loadHabits = useCallback(async (userId) => {
    setHabitsLoading(true);
    try {
      const { data } = await habitsService.getAll(userId);
      if (data) {
        setHabits(data.habits);
        setHabitLogs(data.habitLogs);
      }
    } finally {
      setHabitsLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async (userId) => {
    const { data } = await profilesService.getProfile(userId);
    if (data) setUserProfile(data);
  }, []);

  // ── Health Check SILENCIOSO (não-bloqueante) ──────────────────────────────────
  // Diagnostica o Supabase mas NUNCA impede o app de carregar.
  // Apenas popula syncWarnings para observabilidade.
  const runSilentHealthCheck = useCallback(async (userId) => {
    const issues = [];
    try {
      const { error: profilesErr } = await supabase.from('profiles').select('id').limit(0);
      if (profilesErr && profilesErr.message?.includes('Could not find the table')) {
        issues.push('Tabela profiles ausente no Supabase (usando fallback local)');
      }

      const { error: eventsErr } = await supabase.from('events').select('id').limit(0);
      if (eventsErr && eventsErr.message?.includes('Could not find the table')) {
        issues.push('Tabela events ausente (eventos serão enfileirados localmente)');
      }

      const { error: tasksErr } = await supabase.from('tasks').select('completed_at').limit(0);
      if (tasksErr && tasksErr.message?.includes('completed_at')) {
        issues.push('Coluna completed_at ausente em tasks');
      }
    } catch (err) {
      issues.push(`Supabase inacessível: ${err.message}`);
    }

    if (issues.length > 0) {
      issues.forEach(w => console.warn('[SilentHealthCheck]', w));
      // O syncQueue já vai atualizar o syncStatus via subscribe
    }
    // Nunca bloqueia — sempre retorna true
    return true;
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH — inicialização e listener
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Efeito para Auth State (getSession e onAuthStateChange)
  useEffect(() => {
    const buildUser = (u) => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.email.split('@')[0],
      user_metadata: u.user_metadata || {},
    });

    let active = true;

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!active) return;
        const userId = session?.user?.id || null;
        runSilentHealthCheck(userId);
        if (session?.user) {
          const u = buildUser(session.user);
          setCurrentUser(u);
          eventsService.logEvent(u.id, 'login', { method: 'session_restore' }).catch(() => {});
        }
        setIsInitializing(false);
      })
      .catch((err) => {
        console.error('[AppContext] Erro ao verificar sessão:', err);
        if (active) setIsInitializing(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((e, session) => {
      if (!active) return;
      if (session?.user) {
        const u = buildUser(session.user);
        if (e === 'USER_UPDATED') {
          setCurrentUser(prev => {
            if (!prev) return u;
            const localWeeklyPlan = prev.user_metadata?.weekly_plan;
            const updatedWeeklyPlan = u.user_metadata?.weekly_plan;
            return {
              ...u,
              user_metadata: {
                ...u.user_metadata,
                weekly_plan: localWeeklyPlan === null ? null : updatedWeeklyPlan
              }
            };
          });
        } else {
          setCurrentUser(u);
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [runSilentHealthCheck]);

  // ── Verificação centralizada server-side do plano (Zero Trust) ──
  const checkServerAccess = useCallback(async (userId) => {
    if (!userId) {
      setIsPro(false);
      setSubscriptionStatus('free');
      setSubscriptionPlan('free');
      setChurnScore(0);
      setChurnRisk('low');
      return false;
    }
    try {
      const response = await fetch(`/api/access/check?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        const active = !!data.isPro;
        
        // Só atualiza se realmente mudar, prevenindo loops de re-render
        setIsPro(prev => prev !== active ? active : prev);
        setSubscriptionStatus(prev => prev !== (data.status || 'free').toUpperCase() ? (data.status || 'free').toUpperCase() : prev);
        setSubscriptionPlan(prev => prev !== (data.plano || 'free') ? (data.plano || 'free') : prev);
        
        if (data.churn) {
          setChurnScore(prev => prev !== data.churn.score ? data.churn.score : prev);
          setChurnRisk(prev => prev !== data.churn.risk ? data.churn.risk : prev);
        }

        return active;
      }
    } catch (err) {
      console.warn('[AppContext] Erro ao verificar acesso no servidor:', err.message);
    }
    return false;
  }, []);

  // 2. Efeito central de carga de dados baseado em currentUser?.id
  useEffect(() => {
    setIsAmbientPlaying(false);

    if (!currentUser?.id) {
      setUserProfile(null);
      setTasks([]);
      setGoals([]);
      setGoalTasks([]);
      setUnlockedAchievements(null);
      setUnlockedKeys(null);
      setHabits([]);
      setHabitLogs([]);
      setNotifications([]);
      setIsPro(false);
      setSubscriptionStatus('free');
      setSubscriptionPlan('free');
      return;
    }

    const userId = currentUser.id;
    
    // Tratamento para Modo Demo
    if (currentUser.isDemo) {
      initDemoData();
      loadNotifications(userId);
      return;
    }

    let active = true;

    const loadAll = async () => {
      try {
        await Promise.all([
          loadTasks(userId),
          loadGoals(userId),
          loadAchievements(userId),
          loadHabits(userId),
          loadProfile(userId),
          loadSubscription(userId),
          loadNotifications(userId),
          rehydrateUserState(userId),
          purgeTrash(userId),
          checkServerAccess(userId), // Validação Zero-Trust na carga inicial
        ]);
      } catch (err) {
        console.error('[AppContext] Erro ao carregar dados do usuário:', err);
      }
    };

    loadAll();

    return () => {
      active = false;
    };
  }, [currentUser?.id, loadTasks, loadGoals, loadAchievements, loadHabits, loadProfile, loadSubscription, loadNotifications, rehydrateUserState, purgeTrash, checkServerAccess]);

  // ── Projeção do Estado de Assinatura a partir do Perfil do Usuário ──
  useEffect(() => {
    if (userProfile) {
      const plano = userProfile.plano || 'free';
      const status = userProfile.assinatura_status || 'free';
      const expiresAt = userProfile.assinatura_expira_em;
      
      // Valida se o plano é premium, status ativo e não expirou
      const active = plano === 'premium' && 
                     status === 'active' && 
                     (!expiresAt || new Date(expiresAt) > new Date());
      
      // Só atualiza os estados locais se eles realmente mudarem de valor para evitar renders/loops desnecessários
      setIsPro(prev => prev !== active ? active : prev);
      setSubscriptionStatus(prev => prev !== status ? status : prev);
      setSubscriptionPlan(prev => prev !== plano ? plano : prev);
    } else {
      setIsPro(prev => prev !== false ? false : prev);
      setSubscriptionStatus(prev => prev !== 'free' ? 'free' : prev);
      setSubscriptionPlan(prev => prev !== 'free' ? 'free' : prev);
    }
  }, [userProfile]);

  // ── Temporizador de Expiração em Background para Revalidação Automática (Validade Real) ──
  useEffect(() => {
    if (!isPro || !userProfile?.assinatura_expira_em) return;

    const checkExpiration = () => {
      const expiresAt = new Date(userProfile.assinatura_expira_em);
      if (expiresAt <= new Date()) {
        console.log('[BillingEngine] Assinatura expirou em background. Invalidando acesso.');
        setIsPro(false);
        setSubscriptionStatus('CANCELED'); // Máquina de Estados
        setSubscriptionPlan('free');
      }
    };

    // Executa a cada 60 segundos
    const intervalId = setInterval(checkExpiration, 60000);
    
    // Executa imediatamente na inicialização/mudança
    checkExpiration();

    return () => clearInterval(intervalId);
  }, [isPro, userProfile?.assinatura_expira_em]);

  // ── Escuta em tempo real (Supabase Realtime) para atualizações de faturamento no Perfil ──
  useEffect(() => {
    if (!currentUser?.id || currentUser.isDemo) return;

    console.log(`[Realtime] Iniciando canal de escuta para perfil do usuário ${currentUser.id}`);
    const channel = supabase
      .channel(`profile-realtime-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`
        },
        (payload) => {
          console.log('[Realtime] Perfil do usuário atualizado remotamente:', payload.new);
          
          setUserProfile(prevProfile => {
            if (!prevProfile) return payload.new;
            
            // Só atualiza o estado do perfil se houver mudanças estruturais ou de cobrança
            const planoChanged = prevProfile.plano !== payload.new.plano;
            const statusChanged = prevProfile.assinatura_status !== payload.new.assinatura_status;
            const expiraChanged = prevProfile.assinatura_expira_em !== payload.new.assinatura_expira_em;
            const infoChanged = prevProfile.name !== payload.new.name || 
                                prevProfile.nickname !== payload.new.nickname ||
                                prevProfile.avatar_url !== payload.new.avatar_url ||
                                prevProfile.bio !== payload.new.bio ||
                                prevProfile.profession !== payload.new.profession;
            
            if (planoChanged || statusChanged || expiraChanged || infoChanged) {
              return payload.new;
            }
            
            return prevProfile; // Previne re-render se o registro for idêntico
          });

          // Revalida a assinatura com o servidor para obter a decisão final oficial (Zero Trust!)
          checkServerAccess(currentUser.id);
        }
      )
      .subscribe();

    return () => {
      console.log(`[Realtime] Removendo canal de escuta para perfil do usuário ${currentUser.id}`);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUser?.isDemo, checkServerAccess]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONQUISTAS — detecção automática (PROTEGIDA contra false positives)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const checkAchievements = async () => {
      if (!currentUser?.id || achievementChecking.current || unlockedKeys === null) return;

      // GUARD CRÍTICO: Só verifica conquistas após os dados terem sido carregados ao menos uma vez.
      // Isso evita o popup falso que acontecia quando tasks=[] e goals=[] logo após o login.
      if (!dataLoadedOnce.current) {
        // Considera dados carregados quando tasks OU goals foram populados, ou quando unlockedAchievements foi hidratado.
        // unlockedAchievements === null significa que o fetch ainda não completou.
        // unlockedAchievements é Array (mesmo vazio) significa que já carregou.
        if (unlockedAchievements === null) return;
        dataLoadedOnce.current = true;
        // Na primeira carga, só prossegue se existem dados reais — se não, aborta silenciosamente.
        if (tasks.length === 0 && goals.length === 0) return;
      }

      achievementChecking.current = true;
      try {
        const stats = calcStats(tasks, goals, habits, habitLogs);

        // GUARD SECUNDÁRIO: conquistas que exigem ação real do usuário
        // só disparam se há evidência real de interação (não apenas dados carregados).
        const newlyUnlocked = ACHIEVEMENTS.filter((a) => {
          if (unlockedKeys.has(a.key) || unlockedKeysRef.current.has(a.key)) return false;
          // Conquistas baseadas em tarefas concluídas: só disparam se há completedTasks > 0
          if (['first_task', 'tasks_10', 'tasks_50', 'tasks_100'].includes(a.key)) {
            if (stats.completedTasks === 0) return false;
          }
          // Conquistas baseadas em streak: só disparam se streak > 0 (ou seja, há atividade real)
          if (['streak_3', 'streak_7', 'streak_30'].includes(a.key)) {
            if (stats.currentStreak === 0) return false;
          }
          // Conquistas baseadas em objetivos concluídos
          if (['first_goal_completed', 'goals_10'].includes(a.key)) {
            if (stats.completedGoals === 0) return false;
          }
          // Conquistas baseadas em hábitos
          if (a.key === 'perfect_habits') {
            if (!stats.habits100PercentToday) return false;
          }
          return a.check(stats);
        });

        if (currentUser.isDemo) {
          newlyUnlocked.forEach((a) => {
            unlockedKeysRef.current.add(a.key);
            setUnlockedKeys((prev) => { const n = new Set(prev); n.add(a.key); return n; });
            setUnlockedAchievements((prev) => [
              ...(prev || []),
              { 
                achievement_key: a.key, 
                unlocked_at: new Date().toISOString(), 
                seen: true, 
                viewed_at: new Date().toISOString(),
                dismissed_at: null
              },
            ]);
            const id = `${a.key}-${Date.now()}`;
            setToastQueue((prev) => [...prev, { id, achievement: a }]);
            addNotification('achievement', `Nova conquista: ${a.title}`, a.desc, { tab: 'evolution' });

            // Salva no localStorage para o demo
            const demoAchievementsKey = `flowday_demo_achievements_${currentUser.id}`;
            const localAchievements = JSON.parse(localStorage.getItem(demoAchievementsKey) || '[]');
            localAchievements.push({
              achievement_key: a.key,
              unlocked_at: new Date().toISOString(),
              seen: true,
              viewed_at: new Date().toISOString(),
              dismissed_at: null
            });
            localStorage.setItem(demoAchievementsKey, JSON.stringify(localAchievements));
          });
          return;
        }

        try {
          const { error } = await achievementsService.unlock(
            currentUser.id,
            newlyUnlocked.map((a) => a.key)
          );
          if (error) {
            console.warn('[AppContext] Falha ao sincronizar conquistas com o Supabase, continuando fluxo local:', error);
          }
        } catch (err) {
          console.warn('[AppContext] Erro ao invocar achievementsService.unlock, prosseguindo localmente:', err);
        }

        newlyUnlocked.forEach((a) => {
          // Guard: se já foi dispensada anteriormente (localStorage ou banco), não re-exibe
          const dismissedLocalKey = `myflowday_dismissed_achievements_${currentUser.id}`;
          let dismissedLocal = {};
          try {
            const val = localStorage.getItem(dismissedLocalKey);
            if (val) dismissedLocal = JSON.parse(val);
          } catch (_) {}

          if (dismissedLocal[a.key]) {
            // Já foi dispensada antes — apenas marca no unlockedKeys, sem toast
            unlockedKeysRef.current.add(a.key);
            setUnlockedKeys((prev) => { const n = new Set(prev); n.add(a.key); return n; });
            setUnlockedAchievements((prev) => [
              ...(prev || []),
              { achievement_key: a.key, unlocked_at: new Date().toISOString(), seen: true, viewed_at: new Date().toISOString(), dismissed_at: dismissedLocal[a.key] },
            ]);
            achievementsService.markAsSeen(currentUser.id, [a.key]);
            return;
          }

          unlockedKeysRef.current.add(a.key);
          setUnlockedKeys((prev) => { const n = new Set(prev); n.add(a.key); return n; });
          setUnlockedAchievements((prev) => [
            ...(prev || []),
            { 
              achievement_key: a.key, 
              unlocked_at: new Date().toISOString(), 
              seen: true, 
              viewed_at: new Date().toISOString(),
              dismissed_at: null
            },
          ]);
          // Só adiciona ao toast se ainda não estiver na fila (evita duplicata com loadAchievements)
          setToastQueue((prev) => {
            if (prev.some(t => t.achievement?.key === a.key)) return prev;
            const id = `${a.key}-${Date.now()}`;
            return [...prev, { id, achievement: a }];
          });
          addNotification('achievement', `Nova conquista: ${a.title}`, a.desc, { tab: 'evolution' });

          // Marca como visto no banco
          achievementsService.markAsSeen(currentUser.id, [a.key]);
        });
      } finally {
        achievementChecking.current = false;
      }
    };
    checkAchievements();
  }, [tasks, goals, habits, habitLogs, currentUser?.id, unlockedKeys, unlockedAchievements]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const handleLoginSuccess = useCallback((user) => {
    setCurrentUser(user);
    eventsService.logEvent(user.id, 'login', { method: 'explicit' }).catch(() => {});
    setActiveTab('home');
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      if (currentUser?.id) {
        if (!currentUser.isDemo) {
          await eventsService.logEvent(currentUser.id, 'logout');
        }
      }
      if (!currentUser?.isDemo) {
        await supabase.auth.signOut();
      }
      
      // Limpa dados demo se for o caso
      if (currentUser?.isDemo) {
        localStorage.removeItem(`flowday_demo_tasks_${currentUser.id}`);
        localStorage.removeItem(`flowday_demo_goals_${currentUser.id}`);
        localStorage.removeItem(`flowday_demo_habits_${currentUser.id}`);
        localStorage.removeItem(`flowday_demo_achievements_${currentUser.id}`);
      }

      window.location.href = window.location.origin + '/login';
      // Reset do guard de conquistas para o próximo login
      dataLoadedOnce.current = false;
      firstSuccessLogged.current = false;
      setCurrentUser(null);
      setUserProfile(null);
      setTasks([]); setGoals([]); setGoalTasks([]);
      setUnlockedAchievements(null); setUnlockedKeys(null);
      setToastQueue([]); // Limpa a fila de exibição no logout
      setHabits([]); setHabitLogs([]);
      setNotifications([]);

      // Limpa caches locais no IndexedDB para isolamento multiusuário
      await localDB.clear('tasks').catch(() => {});
      await localDB.clear('goals').catch(() => {});
      await localDB.clear('habits').catch(() => {});
      await localDB.clear('profile').catch(() => {});
      await localDB.clear('events').catch(() => {});
      await localDB.clear('notifications').catch(() => {});
    } catch (e) { console.error(e); }
  }, [currentUser]);

  const dismissToast = useCallback(async (id, key) => {
    // Remove localmente do toastQueue para resposta visual instantiva
    setToastQueue((prev) => prev.filter((t) => t.id !== id));

    if (currentUser?.id && key) {
      const userId = currentUser.id;
      const dismissedLocalKey = `myflowday_dismissed_achievements_${userId}`;
      try {
        let localDismissed = {};
        const localVal = localStorage.getItem(dismissedLocalKey);
        if (localVal) localDismissed = JSON.parse(localVal);
        localDismissed[key] = new Date().toISOString();
        localStorage.setItem(dismissedLocalKey, JSON.stringify(localDismissed));
      } catch (e) {
        console.warn('[AppContext] Falha ao salvar no localStorage:', e);
      }

      setUnlockedAchievements((prev) =>
        (prev || []).map((item) =>
          item.achievement_key === key
            ? { ...item, seen: true, dismissed_at: new Date().toISOString() }
            : item
        )
      );

      const { error } = await achievementsService.markAsDismissed(userId, key);
      if (error) {
        console.warn('[AppContext] Erro ao salvar dismissed_at no banco de dados (usando fallback local):', error.message);
      }
    }
  }, [currentUser?.id]);

  const handleCompleteOnboarding = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      localStorage.setItem(`flowday_onboarding_completed_${currentUser.id}`, 'true');
      if (currentUser.isDemo) {
        setCurrentUser(prev => ({
          ...prev,
          user_metadata: {
            ...prev.user_metadata,
            onboarding_completed: true
          }
        }));
        logEvent('onboarding_completed');
        return;
      }
      const { error } = await supabase.auth.updateUser({
        data: { onboarding_completed: true }
      });
      if (error) throw error;
      setCurrentUser(prev => ({
        ...prev,
        user_metadata: {
          ...prev.user_metadata,
          onboarding_completed: true
        }
      }));
      logEvent('onboarding_completed');
    } catch (e) {
      console.error('Erro ao marcar onboarding como concluído:', e);
    }
  }, [currentUser, logEvent]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TASKS CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  const resetAchievementsIfEmpty = useCallback(async (userId, updatedTasks, updatedGoals) => {
    const activeTasks = updatedTasks.filter(t => !t.deletedAt);
    const activeGoals = updatedGoals.filter(g => !g.deletedAt);
    if (activeTasks.length === 0 && activeGoals.length === 0) {
      console.log('[AppContext] Limpeza total de tarefas e objetivos detectada. Resetando conquistas.');
      try {
        if (currentUser?.isDemo) {
          const demoAchievementsKey = `flowday_demo_achievements_${currentUser.id}`;
          localStorage.setItem(demoAchievementsKey, JSON.stringify([]));
        } else {
          await achievementsService.resetAll(userId);
        }
        setUnlockedAchievements([]);
        setUnlockedKeys(new Set());
        if (unlockedKeysRef.current) {
          unlockedKeysRef.current = new Set();
        }
      } catch (err) {
        console.warn('[AppContext] Erro ao resetar conquistas:', err);
      }
    }
  }, [currentUser]);

  const handleAddTask = useCallback(async (taskData) => {
    if (!currentUser?.id) return;
    const { goal_id, ...payload } = taskData;
    
    if (currentUser.isDemo) {
      const demoId = 'dt_' + Date.now();
      const newTask = {
        id: demoId,
        user_id: currentUser.id,
        title: payload.title,
        description: payload.description || '',
        category: payload.category,
        priority: payload.priority,
        dueDate: payload.dueDate || '',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        updatedAt: new Date().toISOString(),
        deletedAt: null
      };
      const updated = [newTask, ...tasks];
      setTasks(updated);
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      logEvent('task_created', { taskId: demoId, title: payload.title });
      
      if (goal_id) {
        const updatedGT = [...goalTasks, { goal_id, task_id: demoId }];
        setGoalTasks(updatedGT);
        localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals, goalTasks: updatedGT }));
      }
      addNotification('task', 'Tarefa criada', payload.title);
      return;
    }

    // Optimistic UI Update
    const tempId = 'temp_task_' + Date.now();
    const optimisticTask = {
      id: tempId,
      user_id: currentUser.id,
      title: payload.title,
      description: payload.description || '',
      category: payload.category || 'Pessoal',
      priority: payload.priority || 'Média',
      dueDate: payload.dueDate || '',
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null
    };

    setTasks((prev) => [optimisticTask, ...prev]);
    if (goal_id) {
      setGoalTasks((prev) => [...prev, { goal_id, task_id: tempId }]);
    }

    try {
      const { data } = await tasksService.create(currentUser.id, payload);
      if (data) {
        setTasks((prev) => prev.map(t => t.id === tempId ? data : t));
        logEvent('task_created', { taskId: data.id, title: payload.title });
        if (goal_id) {
          await goalsService.linkTask(goal_id, data.id);
          setGoalTasks((prev) => prev.map(gt => gt.task_id === tempId ? { goal_id, task_id: data.id } : gt));
        }
      } else {
        // Rollback
        setTasks((prev) => prev.filter(t => t.id !== tempId));
        if (goal_id) {
          setGoalTasks((prev) => prev.filter(gt => gt.task_id !== tempId));
        }
      }
    } catch (err) {
      // Rollback
      setTasks((prev) => prev.filter(t => t.id !== tempId));
      if (goal_id) {
        setGoalTasks((prev) => prev.filter(gt => gt.task_id !== tempId));
      }
    }
  }, [currentUser, tasks, goals, goalTasks, logEvent, addNotification]);

  const handleUpdateTask = useCallback(async (id, updatedData) => {
    if (!currentUser?.id) return;
    
    const existingTask = tasks.find(t => t.id === id);
    
    // OPTIMISTIC UPDATE
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...updatedData } : t));
    logEvent('task_updated', { task_id: id });
    
    if (updatedData.completed === true) {
      logEvent('task_completed', { taskId: id });
      if (existingTask && existingTask.dueDate) {
        logEvent('calendar_task_completed', { taskId: id });
      }
      
      if (tasks.length > 0) {
        const alreadyHadSuccess = tasks.some(t => t.id !== id && t.completed);
        if (!alreadyHadSuccess && !firstSuccessLogged.current) {
          firstSuccessLogged.current = true;
          logEvent('first_success_action', { task_id: id });
        }
      }
    }

    if (updatedData.dueDate !== undefined) {
      if (updatedData.dueDate && (!existingTask || !existingTask.dueDate)) {
        logEvent('calendar_task_scheduled', { taskId: id, date: updatedData.dueDate });
        logEvent('task_scheduled', { taskId: id, date: updatedData.dueDate });
      } else if (existingTask && existingTask.dueDate && updatedData.dueDate && existingTask.dueDate !== updatedData.dueDate) {
        logEvent('calendar_task_moved', { taskId: id, oldDate: existingTask.dueDate, newDate: updatedData.dueDate });
        logEvent('task_rescheduled', { taskId: id, oldDate: existingTask.dueDate, newDate: updatedData.dueDate });
      }
    }

    if (currentUser.isDemo) {
      const updatedList = tasks.map((t) => t.id === id ? { ...t, ...updatedData, updatedAt: new Date().toISOString() } : t);
      setTasks(updatedList);
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updatedList));
      return;
    }

    tasksService.update(currentUser.id, id, updatedData).catch(err => {
      console.error('[AppContext] Erro ao atualizar tarefa:', err);
    });
  }, [currentUser, tasks, logEvent]);

  const handleDeleteTask = useCallback(async (id) => {
    if (!currentUser?.id) return;
    
    if (undoAction && undoAction.id === id) {
      clearTimeout(undoAction.timerId);
    }

    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    // 1. Marca visualmente como excluído na UI (esconde definindo deletedAt temporário)
    const nowIso = new Date().toISOString();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, deletedAt: nowIso } : t));

    // 2. Executa a deleção lógica imediatamente no banco/cache
    if (currentUser.isDemo) {
      const updatedList = tasks.filter(t => t.id !== id);
      setTasks(updatedList);
      const updatedGT = goalTasks.filter(gt => gt.task_id !== id);
      setGoalTasks(updatedGT);
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updatedList));
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals, goalTasks: updatedGT }));
      logEvent('task_deleted', { task_id: id });
    } else {
      tasksService.delete(currentUser.id, id).then(({ error, degraded }) => {
        if (!error || degraded) {
          logEvent('task_deleted', { task_id: id });
        }
      });
    }

    // 3. Agenda a expiração do undo
    const timerId = setTimeout(() => {
      setUndoAction(null);
      const finalTasks = tasks.filter(t => t.id !== id);
      if (!currentUser.isDemo) {
        setTasks(finalTasks);
      }
      resetAchievementsIfEmpty(currentUser.id, finalTasks, goals);
    }, 5000);

    // 4. Ativa o Undo Action
    setUndoAction({
      type: 'task',
      id,
      timerId,
      item: taskToDelete
    });
  }, [currentUser, tasks, goals, goalTasks, undoAction, logEvent, resetAchievementsIfEmpty]);

  // Exclusão em lote de tarefas concluídas (soft delete com undo em 5s)
  const handleBulkDeleteCompleted = useCallback(async () => {
    if (!currentUser?.id) return;
    const completedTasks = tasks.filter(t => t.completed && !t.deletedAt);
    if (completedTasks.length === 0) return;

    const nowIso = new Date().toISOString();
    const ids = completedTasks.map(t => t.id);

    // 1. Soft delete imediato na UI
    setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, deletedAt: nowIso } : t));

    // 2. Cancela qualquer undo ativo anterior para não conflitar
    if (undoAction) clearTimeout(undoAction.timerId);

    // 3. Executa a deleção no banco imediatamente
    if (currentUser.isDemo) {
      const updatedList = tasks.filter(t => !ids.includes(t.id));
      const updatedGT = goalTasks.filter(gt => !ids.includes(gt.task_id));
      setTasks(updatedList);
      setGoalTasks(updatedGT);
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updatedList));
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals, goalTasks: updatedGT }));
      logEvent('bulk_tasks_deleted', { count: ids.length });
    } else {
      Promise.all(ids.map(id => tasksService.delete(currentUser.id, id))).then(() => {
        logEvent('bulk_tasks_deleted', { count: ids.length });
      });
    }

    // 4. Agenda a expiração do undo (10 segundos)
    const timerId = setTimeout(() => {
      setUndoAction(null);
      const finalTasks = tasks.filter(t => !ids.includes(t.id));
      if (!currentUser.isDemo) {
        setTasks(finalTasks);
      }
      resetAchievementsIfEmpty(currentUser.id, finalTasks, goals);
    }, 10000);

    // 5. Undo action para lote (restaura todos)
    setUndoAction({
      type: 'bulk_task',
      ids,
      timerId,
      items: completedTasks,
    });

    return completedTasks.length;
  }, [currentUser, tasks, goals, goalTasks, undoAction, logEvent]);

  const handleToggleComplete = useCallback(async (id) => {
    if (!currentUser?.id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    
    const next = !task.completed;
    const completedAt = next ? new Date().toISOString() : null;
    
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: next, completedAt } : t));
    
    if (next) {
      logEvent('task_completed', { taskId: id });
      const alreadyHadSuccess = tasks.some(t => t.id !== id && t.completed);
      if (!alreadyHadSuccess && !firstSuccessLogged.current) {
        firstSuccessLogged.current = true;
        logEvent('first_success_action', {
          task_id: id,
          task_title: task.title,
          ts: new Date().toISOString(),
        });
      }
    }

    if (currentUser.isDemo) {
      const updated = tasks.map((t) => t.id === id ? { ...t, completed: next, completedAt, updatedAt: new Date().toISOString() } : t);
      setTasks(updated);
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      return;
    }

    tasksService.toggleComplete(currentUser.id, id, task.completed).then(async ({ error, degraded }) => {
      if (!error || degraded) {
        if (next) {
          const meta = parseTaskMetadata(task.description);
          if (meta && meta.recurrence && meta.recurrence !== 'nenhuma') {
            const nextDueDate = calculateNextOccurrence(task.dueDate, meta.recurrence);
            const nextTask = {
              title: task.title,
              description: task.description,
              category: task.category,
              priority: task.priority,
              dueDate: nextDueDate,
            };
            const { data: createdTask } = await tasksService.create(currentUser.id, nextTask);
            if (createdTask) {
              setTasks((prev) => [createdTask, ...prev]);
              logEvent('task_created', { title: nextTask.title, recurrence_parent: id });
            }
          }
        }
      } else {
        setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !next, completedAt: task.completedAt } : t));
      }
    }).catch((err) => {
      console.error('[AppContext] Erro ao toggleComplete:', err);
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !next, completedAt: task.completedAt } : t));
    });
  }, [currentUser, tasks, logEvent]);

  const handleUpdateProfile = useCallback(async (profileData) => {
    if (!currentUser?.id) return;
    const { data } = await profilesService.updateProfile(currentUser.id, profileData);
    if (data) {
      setUserProfile(data);
      logEvent('profile_updated');
    }
  }, [currentUser?.id, logEvent]);

  const handleUploadAvatar = useCallback(async (file) => {
    if (!currentUser?.id) return;
    const { publicUrl } = await profilesService.uploadAvatar(currentUser.id, file);
    if (publicUrl) {
      setUserProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      logEvent('profile_updated', { avatar: true });
    }
  }, [currentUser?.id, logEvent]);

  const handleDeleteAvatar = useCallback(async () => {
    if (!currentUser?.id) return;
    const { error } = await profilesService.deleteAvatar(currentUser.id);
    if (!error) {
      setUserProfile(prev => ({ ...prev, avatar_url: '' }));
      logEvent('profile_updated', { avatar: false });
    }
  }, [currentUser?.id, logEvent]);

  // Duplicar Objetivos e Tarefas
  const handleDuplicateGoal = useCallback(async (goalId) => {
    if (!currentUser?.id) return;
    const origin = goals.find(g => g.id === goalId);
    if (!origin) return;

    const duplicatePayload = {
      title: `${origin.title} (Cópia)`,
      description: origin.description || '',
      color: origin.color || '#4A654E',
      icon: origin.icon || '🎯',
      target_date: origin.target_date || null,
      start_time: origin.start_time || null,
      end_time: origin.end_time || null,
      attachments: origin.attachments || [],
      status: 'active'
    };

    if (currentUser.isDemo) {
      const demoGoalId = 'dg_' + Date.now();
      const newGoal = {
        id: demoGoalId,
        user_id: currentUser.id,
        title: duplicatePayload.title,
        description: duplicatePayload.description,
        color: duplicatePayload.color,
        icon: duplicatePayload.icon,
        target_date: duplicatePayload.target_date,
        start_time: duplicatePayload.start_time,
        end_time: duplicatePayload.end_time,
        attachments: duplicatePayload.attachments,
        status: 'active',
        deletedAt: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const updatedGoals = [newGoal, ...goals];
      setGoals(updatedGoals);
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: updatedGoals, goalTasks }));
      logEvent('goal_created', { title: duplicatePayload.title, duplicated_from: goalId });
      addNotification('goal', 'Objetivo duplicado', duplicatePayload.title);
      return;
    }

    const tempGoalId = 'temp_goal_' + Date.now();
    const optimisticGoal = {
      id: tempGoalId,
      user_id: currentUser.id,
      title: duplicatePayload.title,
      description: duplicatePayload.description,
      color: duplicatePayload.color,
      icon: duplicatePayload.icon,
      target_date: duplicatePayload.target_date,
      start_time: duplicatePayload.start_time,
      end_time: duplicatePayload.end_time,
      attachments: duplicatePayload.attachments,
      status: 'active',
      deletedAt: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setGoals((prev) => [optimisticGoal, ...prev]);

    try {
      const { data } = await goalsService.create(currentUser.id, duplicatePayload);
      if (data) {
        setGoals((prev) => prev.map(g => g.id === tempGoalId ? data : g));
        logEvent('goal_created', { title: duplicatePayload.title, duplicated_from: goalId });
        addNotification('goal', 'Objetivo duplicado', duplicatePayload.title);
      } else {
        setGoals((prev) => prev.filter(g => g.id !== tempGoalId));
      }
    } catch (err) {
      setGoals((prev) => prev.filter(g => g.id !== tempGoalId));
    }
  }, [currentUser, goals, goalTasks, logEvent, addNotification]);

  const handleDuplicateTask = useCallback(async (taskId) => {
    if (!currentUser?.id) return;
    const origin = tasks.find(t => t.id === taskId);
    if (!origin) return;

    const linkedGoal = goalTasks.find(gt => gt.task_id === taskId);
    const goal_id = linkedGoal ? linkedGoal.goal_id : null;

    const duplicatePayload = {
      title: `${origin.title} (Cópia)`,
      description: origin.description || '',
      category: origin.category || 'Pessoal',
      priority: origin.priority || 'Média',
      dueDate: origin.dueDate || '',
      completed: false
    };

    if (currentUser.isDemo) {
      const demoId = 'dt_' + Date.now();
      const newTask = {
        id: demoId,
        user_id: currentUser.id,
        title: duplicatePayload.title,
        description: duplicatePayload.description,
        category: duplicatePayload.category,
        priority: duplicatePayload.priority,
        dueDate: duplicatePayload.dueDate,
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        updatedAt: new Date().toISOString(),
        deletedAt: null
      };
      const updated = [newTask, ...tasks];
      setTasks(updated);
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      logEvent('task_created', { taskId: demoId, title: duplicatePayload.title, duplicated_from: taskId });
      
      if (goal_id) {
        const updatedGT = [...goalTasks, { goal_id, task_id: demoId }];
        setGoalTasks(updatedGT);
        localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals, goalTasks: updatedGT }));
      }
      addNotification('task', 'Tarefa duplicada', duplicatePayload.title);
      return;
    }

    const tempId = 'temp_task_' + Date.now();
    const optimisticTask = {
      id: tempId,
      user_id: currentUser.id,
      title: duplicatePayload.title,
      description: duplicatePayload.description,
      category: duplicatePayload.category,
      priority: duplicatePayload.priority,
      dueDate: duplicatePayload.dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null
    };

    setTasks((prev) => [optimisticTask, ...prev]);
    if (goal_id) {
      setGoalTasks((prev) => [...prev, { goal_id, task_id: tempId }]);
    }

    try {
      const { data } = await tasksService.create(currentUser.id, duplicatePayload);
      if (data) {
        setTasks((prev) => prev.map(t => t.id === tempId ? data : t));
        logEvent('task_created', { taskId: data.id, title: duplicatePayload.title, duplicated_from: taskId });
        if (goal_id) {
          await goalsService.linkTask(goal_id, data.id);
          setGoalTasks((prev) => prev.map(gt => gt.task_id === tempId ? { goal_id, task_id: data.id } : gt));
        }
        addNotification('task', 'Tarefa duplicada', duplicatePayload.title);
      } else {
        setTasks((prev) => prev.filter(t => t.id !== tempId));
        if (goal_id) {
          setGoalTasks((prev) => prev.filter(gt => gt.task_id !== tempId));
        }
      }
    } catch (err) {
      setTasks((prev) => prev.filter(t => t.id !== tempId));
      if (goal_id) {
        setGoalTasks((prev) => prev.filter(gt => gt.task_id !== tempId));
      }
    }
  }, [currentUser, tasks, goals, goalTasks, logEvent, addNotification]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GOALS CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddGoal = useCallback(async (goalData) => {
    if (!currentUser?.id) return;
    const { actions, category, ...goalPayload } = goalData;
    
    if (currentUser.isDemo) {
      const demoGoalId = 'dg_' + Date.now();
      const newGoal = {
        id: demoGoalId,
        user_id: currentUser.id,
        title: goalPayload.title,
        description: goalPayload.description || '',
        color: goalPayload.color || '#4A654E',
        icon: goalPayload.icon || '🎯',
        target_date: goalPayload.target_date || null,
        start_time: goalPayload.start_time || null,
        end_time: goalPayload.end_time || null,
        status: 'active',
        deletedAt: null
      };

      const updatedGoals = [newGoal, ...goals];
      setGoals(updatedGoals);
      logEvent('goal_created', { title: goalPayload.title });

      let currentDemoTasks = [...tasks];
      let currentDemoGT = [...goalTasks];

      if (actions && actions.length > 0) {
        for (const actionTitle of actions) {
          const actionId = 'dt_' + Math.random().toString(36).substr(2, 9);
          const taskData = {
            id: actionId,
            user_id: currentUser.id,
            title: actionTitle,
            description: '',
            category: category || 'Trabalho',
            priority: 'Média',
            dueDate: null,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
            deletedAt: null
          };
          currentDemoTasks.push(taskData);
          currentDemoGT.push({ goal_id: demoGoalId, task_id: actionId });
        }
        setTasks(currentDemoTasks);
        setGoalTasks(currentDemoGT);
      }

      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: updatedGoals, goalTasks: currentDemoGT }));
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(currentDemoTasks));
      addNotification('goal', 'Objetivo criado', goalPayload.title);
      return;
    }

    const tempGoalId = 'temp_goal_' + Date.now();
    const optimisticGoal = {
      id: tempGoalId,
      user_id: currentUser.id,
      title: goalPayload.title,
      description: goalPayload.description || '',
      color: goalPayload.color || '#4A654E',
      icon: goalPayload.icon || '🎯',
      target_date: goalPayload.target_date || null,
      start_time: goalPayload.start_time || null,
      end_time: goalPayload.end_time || null,
      status: 'active',
      deletedAt: null
    };

    setGoals((prev) => [optimisticGoal, ...prev]);

    const tempActions = [];
    if (actions && actions.length > 0) {
      actions.forEach((actionTitle, index) => {
        const tempActionId = `temp_action_${index}_${Date.now()}`;
        tempActions.push({
          tempId: tempActionId,
          task: {
            id: tempActionId,
            user_id: currentUser.id,
            title: actionTitle,
            description: '',
            category: category || 'Trabalho',
            priority: 'Média',
            dueDate: null,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
            deletedAt: null
          }
        });
      });
      
      setTasks((prev) => [...tempActions.map(ta => ta.task), ...prev]);
      setGoalTasks((prev) => [...prev, ...tempActions.map(ta => ({ goal_id: tempGoalId, task_id: ta.tempId }))]);
    }

    try {
      const { data } = await goalsService.create(currentUser.id, goalPayload);
      if (data) {
        setGoals((prev) => prev.map(g => g.id === tempGoalId ? data : g));
        logEvent('goal_created', { title: goalPayload.title });
        if (goalPayload.start_time && goalPayload.end_time) {
          logEvent('goal_scheduled', { title: goalPayload.title, start_time: goalPayload.start_time, end_time: goalPayload.end_time });
        }

        if (tempActions.length > 0) {
          for (let i = 0; i < tempActions.length; i++) {
            const ta = tempActions[i];
            const taskData = {
              title: ta.task.title,
              description: '',
              category: category || 'Trabalho',
              priority: 'Média',
              dueDate: null,
            };
            const { data: taskResponse } = await tasksService.create(currentUser.id, taskData);
            if (taskResponse) {
              setTasks((prev) => prev.map(t => t.id === ta.tempId ? taskResponse : t));
              await goalsService.linkTask(data.id, taskResponse.id);
              setGoalTasks((prev) => prev.map(gt => 
                (gt.goal_id === tempGoalId && gt.task_id === ta.tempId) 
                  ? { goal_id: data.id, task_id: taskResponse.id } 
                  : gt
              ));
            } else {
              setTasks((prev) => prev.filter(t => t.id !== ta.tempId));
              setGoalTasks((prev) => prev.filter(gt => gt.task_id !== ta.tempId));
            }
          }
        }
      } else {
        // Rollback
        setGoals((prev) => prev.filter(g => g.id !== tempGoalId));
        if (tempActions.length > 0) {
          const tempIds = tempActions.map(ta => ta.tempId);
          setTasks((prev) => prev.filter(t => !tempIds.includes(t.id)));
          setGoalTasks((prev) => prev.filter(gt => gt.goal_id !== tempGoalId));
        }
      }
    } catch (err) {
      // Rollback
      setGoals((prev) => prev.filter(g => g.id !== tempGoalId));
      if (tempActions.length > 0) {
        const tempIds = tempActions.map(ta => ta.tempId);
        setTasks((prev) => prev.filter(t => !tempIds.includes(t.id)));
        setGoalTasks((prev) => prev.filter(gt => gt.goal_id !== tempGoalId));
      }
    }
  }, [currentUser, goals, tasks, goalTasks, logEvent, addNotification]);

  const handleUpdateGoal = useCallback(async (id, updatedData) => {
    if (!currentUser?.id) return;
    const existingGoal = goals.find(g => g.id === id);
    
    if (currentUser.isDemo) {
      const updatedGoals = goals.map((g) => g.id === id ? { ...g, ...updatedData } : g);
      setGoals(updatedGoals);
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: updatedGoals, goalTasks }));
      logEvent('goal_updated', { goal_id: id });
      if (updatedData.status === 'completed') {
        logEvent('goal_completed', { goal_id: id });
        addNotification('goal', 'Objetivo Concluído! 🏆', existingGoal.title);
      }
      return;
    }

    const { data: payload } = await goalsService.update(currentUser.id, id, updatedData);
    if (payload) {
      setGoals((prev) => prev.map((g) => g.id === id ? { ...g, ...payload } : g));
      logEvent('goal_updated', { goal_id: id });
      if (updatedData.start_time !== undefined && existingGoal.start_time !== updatedData.start_time) {
        logEvent('goal_time_updated', { goal_id: id, start_time: updatedData.start_time, end_time: updatedData.end_time });
      }
      if (updatedData.status === 'completed') {
        logEvent('goal_completed', { goal_id: id });
        addNotification('goal', 'Objetivo Concluído! 🏆', existingGoal.title);
        if (existingGoal.start_time) {
          logEvent('goal_completed_with_schedule', { goal_id: id });
        }
      } else if (updatedData.status === 'archived') {
        logEvent('goal_archived', { goal_id: id });
      } else if (existingGoal && (existingGoal.status === 'completed' || existingGoal.status === 'archived') && updatedData.status === 'active') {
        logEvent('goal_reopened', { goal_id: id });
      }
    }
  }, [currentUser, goals, goalTasks, logEvent, addNotification]);

  const handleDeleteGoal = useCallback(async (id) => {
    if (!currentUser?.id) return;
    
    if (undoAction && undoAction.id === id) {
      clearTimeout(undoAction.timerId);
    }

    const goalToDelete = goals.find(g => g.id === id);
    if (!goalToDelete) return;

    // 1. Marca visualmente como excluído
    const nowIso = new Date().toISOString();
    setGoals(prev => prev.map(g => g.id === id ? { ...g, deletedAt: nowIso } : g));

    // 2. Executa a deleção imediatamente no banco
    if (currentUser.isDemo) {
      const mockGoals = goals.filter(g => g.id !== id);
      const updatedGT = goalTasks.filter(gt => gt.goal_id !== id);
      setGoals(mockGoals);
      setGoalTasks(updatedGT);
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: mockGoals, goalTasks: updatedGT }));
      logEvent('goal_deleted', { goal_id: id });
    } else {
      goalsService.delete(currentUser.id, id).then(({ error }) => {
        if (!error) {
          logEvent('goal_deleted', { goal_id: id });
        }
      });
    }

    // 3. Agenda a expiração do undo
    const timerId = setTimeout(() => {
      setUndoAction(null);
      const updatedGoals = goals.filter((g) => g.id !== id);
      if (!currentUser.isDemo) {
        setGoals(updatedGoals);
        setGoalTasks((prev) => prev.filter((gt) => gt.goal_id !== id));
      }
      resetAchievementsIfEmpty(currentUser.id, tasks, updatedGoals);
    }, 5000);

    // 4. Ativa o Undo
    setUndoAction({
      type: 'goal',
      id,
      timerId,
      item: goalToDelete
    });
  }, [currentUser, goals, goalTasks, tasks, undoAction, logEvent, resetAchievementsIfEmpty]);

  const handleBulkDeleteCompletedGoals = useCallback(async () => {
    if (!currentUser?.id) return;
    const completedGoals = goals.filter(g => g.status === 'completed' && !g.deletedAt);
    if (completedGoals.length === 0) return;

    const nowIso = new Date().toISOString();
    const ids = completedGoals.map(g => g.id);

    // 1. Soft delete imediato na UI
    setGoals(prev => prev.map(g => ids.includes(g.id) ? { ...g, deletedAt: nowIso } : g));

    // 2. Cancela qualquer undo ativo anterior para não conflitar
    if (undoAction) clearTimeout(undoAction.timerId);

    // 3. Executa a deleção no banco imediatamente
    if (currentUser.isDemo) {
      const mockGoals = goals.filter(g => !ids.includes(g.id));
      const updatedGT = goalTasks.filter(gt => !ids.includes(gt.goal_id));
      setGoals(mockGoals);
      setGoalTasks(updatedGT);
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: mockGoals, goalTasks: updatedGT }));
      logEvent('bulk_goals_deleted', { count: ids.length });
    } else {
      Promise.all(ids.map(id => goalsService.delete(currentUser.id, id))).then(() => {
        logEvent('bulk_goals_deleted', { count: ids.length });
      });
    }

    // 4. Agenda a expiração do undo (10 segundos)
    const timerId = setTimeout(() => {
      setUndoAction(null);
      const finalGoals = goals.filter(g => !ids.includes(g.id));
      if (!currentUser.isDemo) {
        setGoals(finalGoals);
        setGoalTasks(prev => prev.filter(gt => !ids.includes(gt.goal_id)));
      }
      resetAchievementsIfEmpty(currentUser.id, tasks, finalGoals);
    }, 10000);

    // 5. Ativa o Undo
    setUndoAction({
      type: 'bulk_goal',
      ids,
      timerId,
      items: completedGoals
    });
  }, [currentUser, goals, goalTasks, tasks, undoAction, logEvent, resetAchievementsIfEmpty]);

  const handleDeleteAllGoals = useCallback(async () => {
    if (!currentUser?.id) return;
    const activeGoals = goals.filter(g => !g.deletedAt);
    if (activeGoals.length === 0) return;

    const nowIso = new Date().toISOString();
    const ids = activeGoals.map(g => g.id);

    // 1. Soft delete imediato na UI
    setGoals(prev => prev.map(g => ids.includes(g.id) ? { ...g, deletedAt: nowIso } : g));

    // 2. Cancela qualquer undo ativo anterior para não conflitar
    if (undoAction) clearTimeout(undoAction.timerId);

    // 3. Executa a deleção no banco imediatamente
    if (currentUser.isDemo) {
      setGoals([]);
      setGoalTasks([]);
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: [], goalTasks: [] }));
      logEvent('all_goals_deleted', { count: ids.length });
    } else {
      Promise.all(ids.map(id => goalsService.delete(currentUser.id, id))).then(() => {
        logEvent('all_goals_deleted', { count: ids.length });
      });
    }

    // 4. Agenda a expiração do undo (10 segundos)
    const timerId = setTimeout(() => {
      setUndoAction(null);
      const finalGoals = goals.filter(g => !ids.includes(g.id));
      if (!currentUser.isDemo) {
        setGoals(finalGoals);
        setGoalTasks(prev => prev.filter(gt => !ids.includes(gt.goal_id)));
      }
      resetAchievementsIfEmpty(currentUser.id, tasks, finalGoals);
    }, 10000);

    // 5. Ativa o Undo
    setUndoAction({
      type: 'bulk_goal',
      ids,
      timerId,
      items: activeGoals
    });
  }, [currentUser, goals, goalTasks, tasks, undoAction, logEvent, resetAchievementsIfEmpty]);

  const handleLinkTask = useCallback(async (goalId, taskId) => {
    if (goalTasks.some((gt) => gt.goal_id === goalId && gt.task_id === taskId)) return;
    
    if (currentUser?.isDemo) {
      const updatedGT = [...goalTasks, { goal_id: goalId, task_id: taskId }];
      setGoalTasks(updatedGT);
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals, goalTasks: updatedGT }));
      return;
    }

    const { error } = await goalsService.linkTask(goalId, taskId);
    if (!error) {
      setGoalTasks((prev) => [...prev, { goal_id: goalId, task_id: taskId }]);
      logEvent('task_linked_to_goal', { goal_id: goalId, task_id: taskId });
    }
  }, [goalTasks, currentUser, goals, logEvent]);

  const handleUnlinkTask = useCallback(async (goalId, taskId) => {
    if (currentUser?.isDemo) {
      const updatedGT = goalTasks.filter(gt => !(gt.goal_id === goalId && gt.task_id === taskId));
      setGoalTasks(updatedGT);
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals, goalTasks: updatedGT }));
      return;
    }

    const { error } = await goalsService.unlinkTask(goalId, taskId);
    if (!error) {
      setGoalTasks((prev) => prev.filter((gt) => !(gt.goal_id === goalId && gt.task_id === taskId)));
      logEvent('task_unlinked_from_goal', { goal_id: goalId, task_id: taskId });
    }
  }, [currentUser, goalTasks, goals, logEvent]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORIAS CRUD (Bloco 4)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddCategory = useCallback(async (newCat) => {
    if (!currentUser?.id) return;
    const currentCustom = currentUser.user_metadata?.custom_categories || [];
    
    if (currentCustom.some(c => c.id.toLowerCase() === newCat.id.toLowerCase()) || 
        defaultCategories.some(c => c.id.toLowerCase() === newCat.id.toLowerCase())) {
      alert('Essa categoria já existe.');
      return;
    }
    const updatedCustom = [...currentCustom, newCat];
    try {
      const { error } = await supabase.auth.updateUser({
        data: { custom_categories: updatedCustom }
      });
      if (error) throw error;
      setCurrentUser(prev => ({
        ...prev,
        user_metadata: { ...prev.user_metadata, custom_categories: updatedCustom }
      }));
      logEvent('category_created', { category: newCat.name });
    } catch (e) {
      console.error('Erro ao adicionar categoria:', e);
    }
  }, [currentUser, logEvent]);

  const handleUpdateCategory = useCallback(async (id, name, emoji, color) => {
    if (!currentUser?.id) return;
    const currentCustom = currentUser.user_metadata?.custom_categories || [];
    const updatedCustom = currentCustom.map(c => c.id === id ? { ...c, name, emoji, color } : c);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { custom_categories: updatedCustom }
      });
      if (error) throw error;
      setCurrentUser(prev => ({
        ...prev,
        user_metadata: { ...prev.user_metadata, custom_categories: updatedCustom }
      }));
      logEvent('category_updated', { category: name });
    } catch (e) {
      console.error('Erro ao atualizar categoria:', e);
    }
  }, [currentUser, logEvent]);

  const handleDeleteCategory = useCallback(async (id) => {
    if (!currentUser?.id) return;
    const currentCustom = currentUser.user_metadata?.custom_categories || [];
    const updatedCustom = currentCustom.filter(c => c.id !== id);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { custom_categories: updatedCustom }
      });
      if (error) throw error;
      setCurrentUser(prev => ({
        ...prev,
        user_metadata: { ...prev.user_metadata, custom_categories: updatedCustom }
      }));
      logEvent('category_deleted', { category_id: id });
    } catch (e) {
      console.error('Erro ao excluir categoria:', e);
    }
  }, [currentUser, logEvent]);

  const openPaywall = useCallback((source) => {
    setIsPaywallOpen(true);
    setPaywallSource(source || '');
    logEvent('paywall_viewed', { source: source || 'unknown' });
  }, [logEvent]);

  const closePaywall = useCallback(() => {
    setIsPaywallOpen(false);
  }, []);

  const handleCancelSubscription = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      logEvent('downgrade_clicked');
      // Apenas exibe instruções de cancelamento
      alert('Para gerenciar ou cancelar sua assinatura, acesse sua conta do Mercado Pago e gerencie seus pagamentos autorizados.');
    } catch (e) {
      console.error('Erro ao registrar clique de downgrade:', e);
    }
  }, [currentUser, logEvent]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HABITS — interface compatível com useHabits anterior
  // ═══════════════════════════════════════════════════════════════════════════
  const habitsManager = {
    habits,
    habitLogs,
    loading: habitsLoading,
    addHabit: useCallback(async (habitData) => {
      if (!currentUser?.id) return null;
      const { data } = await habitsService.create(currentUser.id, habitData);
      if (data) {
        setHabits((prev) => [data, ...prev]);
        logEvent('habit_created', { title: habitData.title });
      }
      return data;
    }, [currentUser?.id, logEvent]),
    updateHabit: useCallback(async (id, updates) => {
      if (!currentUser?.id) return null;
      const { data } = await habitsService.update(currentUser.id, id, updates);
      if (data) {
        setHabits((prev) => prev.map((h) => h.id === id ? data : h));
        logEvent('habit_updated', { habit_id: id });
      }
      return data;
    }, [currentUser?.id, logEvent]),
    deleteHabit: useCallback(async (id) => {
      if (!currentUser?.id) return false;
      const { error } = await habitsService.delete(currentUser.id, id);
      if (!error) {
        setHabits((prev) => prev.filter((h) => h.id !== id));
        setHabitLogs((prev) => prev.filter((l) => l.habit_id !== id));
        logEvent('habit_deleted', { habit_id: id });
      }
      return !error;
    }, [currentUser?.id, logEvent]),
    toggleHabitLog: useCallback(async (habitId, dateStr) => {
      if (!currentUser?.id) return false;
      const existing = habitLogs.find((l) => l.habit_id === habitId && l.completed_date === dateStr);
      const { data: checked, logData } = await habitsService.toggleLog(
        currentUser.id, habitId, dateStr, existing?.id ?? null
      );
      if (checked === false && existing) {
        setHabitLogs((prev) => prev.filter((l) => l.id !== existing.id));
      } else if (checked === true && logData) {
        setHabitLogs((prev) => [...prev, logData]);
        logEvent('habit_completed', { habit_id: habitId, date: dateStr });
      }
      return checked ?? false;
    }, [currentUser?.id, habitLogs, logEvent]),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // USER STATE INTELLIGENCE — Re-hidratação baseada em eventos (Event Sourcing)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!currentUser?.id || currentUser.isDemo) return;

    rehydrateUserState(currentUser.id).then((state) => {
      if (state?.has_first_success) firstSuccessLogged.current = true;
    });

    const unsub = eventEmitter.on('*', () => {
      rehydrateUserState(currentUser.id).then((state) => {
        if (state?.has_first_success) firstSuccessLogged.current = true;
      });
    });

    return unsub;
  }, [currentUser?.id, currentUser?.isDemo, rehydrateUserState]);

  // ── Lógica do Desfazer (Undo) e Lixeira ──
  const triggerUndo = useCallback(async () => {
    if (!undoAction) return;
    clearTimeout(undoAction.timerId);
    
    // Restaura localmente na UI e no banco
    if (undoAction.type === 'task') {
      setTasks(prev => prev.map(t => t.id === undoAction.id ? { ...t, deletedAt: null } : t));
      if (!currentUser.isDemo) {
        await tasksService.restore(currentUser.id, undoAction.id);
      } else {
        const updated = tasks.map(t => t.id === undoAction.id ? { ...t, deletedAt: null } : t);
        localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      }
    } else if (undoAction.type === 'bulk_task') {
      const restoredIds = new Set(undoAction.ids);
      setTasks(prev => prev.map(t => restoredIds.has(t.id) ? { ...t, deletedAt: null } : t));
      if (!currentUser.isDemo) {
        await Promise.all(undoAction.ids.map(id => tasksService.restore(currentUser.id, id)));
      } else {
        const updated = tasks.map(t => restoredIds.has(t.id) ? { ...t, deletedAt: null } : t);
        localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      }
    } else if (undoAction.type === 'goal') {
      setGoals(prev => prev.map(g => g.id === undoAction.id ? { ...g, deletedAt: null } : g));
      if (!currentUser.isDemo) {
        await goalsService.restore(currentUser.id, undoAction.id);
      } else {
        const mockGoals = goals.map(g => g.id === undoAction.id ? { ...g, deletedAt: null } : g);
        localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: mockGoals, goalTasks }));
      }
    } else if (undoAction.type === 'bulk_goal') {
      const restoredIds = new Set(undoAction.ids);
      setGoals(prev => prev.map(g => restoredIds.has(g.id) ? { ...g, deletedAt: null } : g));
      if (!currentUser.isDemo) {
        await Promise.all(undoAction.ids.map(id => goalsService.restore(currentUser.id, id)));
      } else {
        const mockGoals = goals.map(g => restoredIds.has(g.id) ? { ...g, deletedAt: null } : g);
        localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: mockGoals, goalTasks }));
      }
    }
    
    setUndoAction(null);
    addNotification('system', 'Ação Desfeita', 'Os itens removidos foram restaurados com sucesso.');
  }, [currentUser, undoAction, tasks, goals, goalTasks, addNotification]);


  const handleRestoreTask = useCallback(async (id) => {
    if (!currentUser?.id) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, deletedAt: null } : t));
    
    if (currentUser.isDemo) {
      const updated = tasks.map(t => t.id === id ? { ...t, deletedAt: null } : t);
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      return;
    }
    await tasksService.restore(currentUser.id, id);
    addNotification('system', 'Tarefa restaurada', 'A tarefa foi movida de volta à lista ativa.');
  }, [currentUser, tasks, addNotification]);

  const handleDeleteTaskPermanent = useCallback(async (id) => {
    if (!currentUser?.id) return;
    if (!window.confirm('Excluir esta tarefa permanentemente? Esta ação não pode ser desfeita.')) return;
    
    setTasks(prev => prev.filter(t => t.id !== id));
    setGoalTasks(prev => prev.filter(gt => gt.task_id !== id));
    
    if (currentUser.isDemo) {
      const updated = tasks.filter(t => t.id !== id);
      const updatedGT = goalTasks.filter(gt => gt.task_id !== id);
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals, goalTasks: updatedGT }));
      return;
    }
    await tasksService.deletePermanent(currentUser.id, id);
    addNotification('system', 'Tarefa excluída', 'A tarefa foi removida em definitivo.');
  }, [currentUser, tasks, goalTasks, goals, addNotification]);

  const handleRestoreGoal = useCallback(async (id) => {
    if (!currentUser?.id) return;
    setGoals(prev => prev.map(g => g.id === id ? { ...g, deletedAt: null } : g));
    
    if (currentUser.isDemo) {
      const mockGoals = goals.map(g => g.id === id ? { ...g, deletedAt: null } : g);
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: mockGoals, goalTasks }));
      return;
    }
    await goalsService.restore(currentUser.id, id);
    addNotification('system', 'Objetivo restaurado', 'O objetivo foi restaurado com sucesso.');
  }, [currentUser, goals, goalTasks, addNotification]);

  const handleDeleteGoalPermanent = useCallback(async (id) => {
    if (!currentUser?.id) return;
    if (!window.confirm('Excluir este objetivo permanentemente? Isso removerá todas as referências dele.')) return;
    
    setGoals(prev => prev.filter(g => g.id !== id));
    setGoalTasks(prev => prev.filter(gt => gt.goal_id !== id));
    
    if (currentUser.isDemo) {
      const mockGoals = goals.filter(g => g.id !== id);
      const updatedGT = goalTasks.filter(gt => gt.goal_id !== id);
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: mockGoals, goalTasks: updatedGT }));
      return;
    }
    await goalsService.deletePermanent(currentUser.id, id);
    addNotification('system', 'Objetivo excluído', 'O objetivo foi removido em definitivo.');
  }, [currentUser, goals, goalTasks, addNotification]);

  // ── Explicação Detalhada do Health Score (Consistency Score) ──
  const consistencyScoreExplanation = useMemo(() => {
    if (!currentUser) return { positives: [], negatives: [], breakdown: {}, motivationalMessage: '' };
    
    const positives = [];
    const negatives = [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const activeTasks = tasks.filter(t => !t.deletedAt);
    const activeGoals = goals.filter(g => !g.deletedAt);

    // 1. Conclusão de tarefas nos últimos 7 dias
    const recentTasks = activeTasks.filter(t => {
      const date = t.dueDate || t.createdAt?.split('T')[0];
      return date && new Date(date) >= sevenDaysAgo;
    });
    const taskCount = recentTasks.length;
    const completedTaskCount = recentTasks.filter(t => t.completed).length;
    
    if (completedTaskCount > 0) {
      positives.push({ text: `${completedTaskCount} tarefas concluídas nos últimos 7 dias`, value: `+${Math.round((completedTaskCount / Math.max(1, taskCount)) * 40)}%` });
    } else if (taskCount > 0) {
      negatives.push({ text: 'Nenhuma das tarefas recentes foi concluída', value: '-15%' });
    }

    // 2. Conclusão de hábitos nos últimos 7 dias
    const recentLogs = habitLogs.filter(l => new Date(l.completed_date) >= sevenDaysAgo);
    if (recentLogs.length > 0) {
      positives.push({ text: `${recentLogs.length} execuções de hábitos registradas`, value: `+${Math.round((recentLogs.length / Math.max(1, habits.length * 7)) * 40)}%` });
    } else if (habits.length > 0) {
      negatives.push({ text: 'Nenhum hábito realizado recentemente', value: '-20%' });
    }

    // 3. Progresso dos objetivos ativos
    const activeGoalsFiltered = activeGoals.filter(g => g.status === 'active');
    let totalPct = 0;
    activeGoalsFiltered.forEach(goal => {
      const linkedIds = goalTasks.filter(gt => gt.goal_id === goal.id).map(gt => gt.task_id);
      const linked = activeTasks.filter(t => linkedIds.includes(t.id));
      const done = linked.filter(t => t.completed).length;
      const pct = linked.length > 0 ? (done / linked.length) : 0;
      totalPct += pct;
    });
    
    if (activeGoalsFiltered.length > 0) {
      const avgGoalProgress = Math.round((totalPct / activeGoalsFiltered.length) * 100);
      if (avgGoalProgress > 0) {
        positives.push({ text: `Objetivos em andamento avançando (média de ${avgGoalProgress}% concluído)`, value: `+${Math.round((avgGoalProgress / 100) * 20)}%` });
      }
    }

    // Penalidade: Tarefas Atrasadas
    const lateTasks = activeTasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < new Date());
    if (lateTasks.length > 0) {
      negatives.push({ text: `${lateTasks.length} tarefas estão com prazo atrasado`, value: `-${Math.min(15, lateTasks.length * 2)}%` });
    }

    // Planejamento semanal
    const weeklyPlan = currentUser?.user_metadata?.weekly_plan || null;
    if (weeklyPlan) {
      positives.push({ text: 'Planejamento semanal concluído', value: '+10% (Bônus)' });
    } else {
      negatives.push({ text: 'Nenhum planejamento semanal feito para este ciclo', value: '-5%' });
    }

    // ─── CÁLCULO DO DETALHAMENTO TRANSPARENTE (6 COMPONENTES) ───
    
    // A. Dias ativos recentes
    const activeDates = new Set();
    activeTasks.filter(t => t.completed && t.completedAt).forEach(t => {
      const dateStr = t.completedAt.split('T')[0];
      if (dateStr >= sevenDaysAgoStr) activeDates.add(dateStr);
    });
    habitLogs.filter(l => l.completed_date >= sevenDaysAgoStr).forEach(l => {
      activeDates.add(l.completed_date);
    });
    const activeDaysRecent = activeDates.size;
    const diasAtivosPct = Math.round((activeDaysRecent / 7) * 100);
    const diasAtivosOk = activeDaysRecent >= 3;

    // B. Sequência atual
    const streak = calcStreak(tasks);
    const sequenciaPct = Math.min(100, Math.round((streak / 7) * 100));
    const sequenciaOk = streak >= 1;

    // C. Sessões de foco concluídas
    const focusCount = userState?.stats?.sessions || 0;
    const finalFocusCount = (currentUser?.isDemo && focusCount === 0) ? 8 : focusCount;
    const focoPct = Math.min(100, Math.round((finalFocusCount / 5) * 100));
    const focoOk = finalFocusCount >= 1;

    // D. Tarefas finalizadas
    const completedTasksCount = activeTasks.filter(t => t.completed).length;
    const totalTasksCount = activeTasks.length;
    const taskRate = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) : 0;
    const tarefasPct = Math.round(taskRate * 100);
    const tarefasOk = completedTasksCount >= 1;

    // E. Objetivos movimentados
    const completedGoalsCount = activeGoals.filter(g => g.status === 'completed').length;
    const totalGoalsCount = activeGoals.length;
    const goalRate = activeGoalsFiltered.length > 0 ? (totalPct / activeGoalsFiltered.length) : 0;
    const objetivosPct = Math.round((completedGoalsCount > 0 || goalRate > 0) ? (completedGoalsCount / Math.max(1, totalGoalsCount) * 50 + goalRate * 50) : 0);
    const objetivosOk = activeGoals.length > 0;

    // F. Regularidade semanal
    const hasWeeklyPlan = !!(weeklyPlan && (weeklyPlan.focus || weeklyPlan.linkedGoals?.length > 0));
    const regularidadePct = hasWeeklyPlan ? 100 : 0;
    const regularidadeOk = hasWeeklyPlan;

    const breakdown = {
      diasAtivos: {
        pct: diasAtivosPct,
        valueText: `${activeDaysRecent} de 7 dias`,
        label: 'Dias ativos recentes',
        desc: 'Sua frequência diária de atividades concluídas na última semana.',
        ok: diasAtivosOk
      },
      sequencia: {
        pct: sequenciaPct,
        valueText: `${streak} ${streak === 1 ? 'dia' : 'dias'}`,
        label: 'Sequência atual',
        desc: 'Dias consecutivos em ação. A regularidade constrói hábitos sólidos.',
        ok: sequenciaOk
      },
      foco: {
        pct: focoPct,
        valueText: `${finalFocusCount} ${finalFocusCount === 1 ? 'sessão' : 'sessões'}`,
        label: 'Sessões de foco concluídas',
        desc: 'Períodos de concentração profunda no modo foco (Pomodoro).',
        ok: focoOk
      },
      tarefas: {
        pct: tarefasPct,
        valueText: `${completedTasksCount} de ${totalTasksCount}`,
        label: 'Tarefas finalizadas',
        desc: 'A proporção de tarefas concluídas em relação às criadas.',
        ok: tarefasOk
      },
      objetivos: {
        pct: objetivosPct,
        valueText: `${completedGoalsCount} concluídos`,
        label: 'Objetivos movimentados',
        desc: 'Progresso das suas grandes metas de longo prazo.',
        ok: objetivosOk
      },
      regularidade: {
        pct: regularidadePct,
        valueText: hasWeeklyPlan ? 'Planejado' : 'Pendente',
        label: 'Regularidade semanal',
        desc: 'Planejar sua semana no planejador acalma a mente e define o rumo.',
        ok: regularidadeOk
      }
    };

    // Mensagem motivacional amigável baseada em score
    let motivationalMessage = "Você está construindo seu ritmo. Continue com pequenos avanços!";
    if (consistencyScore >= 85) {
      motivationalMessage = "Incrível! Sua consistência está fantástica. Você está no controle absoluto da sua evolução.";
    } else if (consistencyScore >= 50) {
      motivationalMessage = "Pequenos avanços aumentam sua consistência. Mantenha o foco!";
    } else if (consistencyScore > 0) {
      motivationalMessage = "Você está definindo seu ritmo. Cada pequena ação conta para sua evolução!";
    } else {
      motivationalMessage = "Sua jornada de evolução começa agora. Defina uma tarefa ou objetivo para iniciar!";
    }

    return { positives, negatives, breakdown, motivationalMessage };
  }, [tasks, habits, habitLogs, goals, goalTasks, currentUser, userState, consistencyScore]);

  // ═══════════════════════════════════════════════════════════════════════════
  // VISIBLE DATA & HIDDEN COUNTS (SaaS History Limits)
  // ═══════════════════════════════════════════════════════════════════════════
  const visibleTasks = useMemo(() => {
    const activeTasks = tasks.filter(t => !t.deletedAt);
    if (isPro) return activeTasks;
    const limit = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return activeTasks.filter(task => {
      const dateStr = task.completedAt || task.dueDate || task.createdAt;
      if (!dateStr) return true;
      const time = new Date(dateStr).getTime();
      return time >= limit || time > Date.now();
    });
  }, [tasks, isPro]);

  const visibleGoals = useMemo(() => {
    const activeGoals = goals.filter(g => !g.deletedAt);
    if (isPro) return activeGoals;
    const limit = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return activeGoals.filter(goal => {
      const dateStr = goal.updated_at || goal.created_at;
      if (!dateStr) return true;
      const time = new Date(dateStr).getTime();
      return time >= limit || time > Date.now();
    });
  }, [goals, isPro]);

  const hiddenTasksCount = useMemo(() => {
    if (isPro) return 0;
    const activeTasks = tasks.filter(t => !t.deletedAt);
    return activeTasks.length - visibleTasks.length;
  }, [tasks, visibleTasks, isPro]);

  const hiddenGoalsCount = useMemo(() => {
    if (isPro) return 0;
    const activeGoals = goals.filter(g => !g.deletedAt);
    return activeGoals.length - visibleGoals.length;
  }, [goals, visibleGoals, isPro]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════════════════════
  const value = {
    // Auth
    currentUser,
    setCurrentUser,
    isInitializing,
    handleLoginSuccess,
    handleLogout,
    handleStartDemoMode,

    // Navigation
    activeTab,
    setActiveTab,
    shouldOpenGoalModal,
    setShouldOpenGoalModal,

    // Theme
    theme,
    setTheme,
    appBgColor,
    setAppBgColor,

    // Data
    tasks: visibleTasks,
    goals: visibleGoals,
    allTasks: tasks,
    allGoals: goals,
    deletedTasks: tasks.filter(t => t.deletedAt),
    deletedGoals: goals.filter(g => g.deletedAt),
    goalTasks,
    unlockedAchievements,
    toastQueue,
    dismissToast,

    // Notificações
    notifications,
    addNotification,
    markNotificationsAsRead,
    clearNotifications,

    // Undo Action
    undoAction,
    triggerUndo,

    // Tasks actions
    handleAddTask,
    handleUpdateTask,
    handleDeleteTask,
    handleBulkDeleteCompleted,
    handleToggleComplete,
    handleRestoreTask,
    handleDeleteTaskPermanent,

    // Goals actions
    handleAddGoal,
    handleUpdateGoal,
    handleDeleteGoal,
    handleBulkDeleteCompletedGoals,
    handleDeleteAllGoals,
    handleLinkTask,
    handleUnlinkTask,
    handleRestoreGoal,
    handleDeleteGoalPermanent,

    // Habits
    habitsManager,

    // SaaS additions
    isPro,
    isAdmin,
    categories,
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    logEvent,
    consistencyScore,
    consistencyScoreExplanation,
    handleCompleteOnboarding,
    supabaseConfigError,

    // Paywall and billing state/actions
    isPaywallOpen,
    paywallSource,
    subscriptionStatus,
    subscriptionPlan,
    hiddenTasksCount,
    hiddenGoalsCount,
    openPaywall,
    closePaywall,
    handleCancelSubscription,
    checkServerAccess,
    churnScore,
    churnRisk,

    // Profiles additions
    userProfile,
    handleUpdateProfile,
    handleUploadAvatar,
    handleDeleteAvatar,

    // Sync / Resiliência
    syncStatus,
    syncWarnings,

    // Settings state
    settingsTab,
    setSettingsTab,

    // Audio global states
    ambientSoundFile,
    setAmbientSoundFile,
    ambientSoundVolume,
    setAmbientSoundVolume,
    isAmbientPlaying,
    setIsAmbientPlaying,
    audioBlocked,
    setAudioBlocked,

    // Duplications
    handleDuplicateGoal,
    handleDuplicateTask,

    // Growth & Intelligence
    userState,
    insights,
    suggestions,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

