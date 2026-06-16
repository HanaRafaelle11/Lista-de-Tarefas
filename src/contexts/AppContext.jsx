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
import { ACHIEVEMENTS, calcStats } from '../hooks/useAchievements';
import { subscribe as subscribeSync, initSyncQueue } from '../services/syncQueue';
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
  { id: 'Lazer', name: 'Lazer', emoji: '🎸', color: '#A88891' }
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
  const [activeTab, setActiveTab] = useState('home');
  const [shouldOpenGoalModal, setShouldOpenGoalModal] = useState(false);

  // ── Tema ─────────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');

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

  // ── Ref para lock de conquistas ───────────────────────────────────────────────
  const achievementChecking = useRef(false);
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
    const newInsights = generateInsights(tasks);
    setInsights(newInsights);

    // 2. Recalcula sugestões de retenção baseadas no progresso
    const isObCompleted = !!currentUser?.user_metadata?.onboarding_completed;
    const newSuggestions = getEngagementSuggestions(userState, tasks, isObCompleted);
    setSuggestions(newSuggestions);
  }, [tasks, userState, currentUser?.id, currentUser?.user_metadata?.onboarding_completed]);

  // ── Feature Flags & Assinatura (SaaS) ───────────────────────────────────────
  const [isPro, setIsPro] = useState(false);

  // Determina se usuário logado é administrador
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const adminEmails = ['admin@flowday.app', 'rafaelle@flowday.app', 'rafox@flowday.app'];
    return !!currentUser.user_metadata?.is_admin || adminEmails.includes(currentUser.email);
  }, [currentUser]);

  const loadSubscription = useCallback(async (userId) => {
    if (!userId) {
      setIsPro(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error && data) {
        setIsPro(data.status === 'active');
      } else {
        setIsPro(false);
      }
    } catch (err) {
      console.warn('[AppContext] Erro ao carregar assinatura:', err.message);
      setIsPro(false);
    }
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
  }, [theme]);

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

    // Se a conta está limpa (sem dados base), score é absoluto 0.
    if (tasks.length === 0 && habits.length === 0 && goals.length === 0) {
      return 0;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Taxa de conclusão de tarefas nos últimos 7 dias (40% de peso)
    const recentTasks = tasks.filter(t => {
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
    const activeGoals = goals.filter(g => g.status === 'active');
    let totalPct = 0;
    activeGoals.forEach(goal => {
      const linkedIds = goalTasks.filter(gt => gt.goal_id === goal.id).map(gt => gt.task_id);
      const linked = tasks.filter(t => linkedIds.includes(t.id));
      const done = linked.filter(t => t.completed).length;
      const pct = linked.length > 0 ? (done / linked.length) : 0;
      totalPct += pct;
    });
    const goalRate = activeGoals.length > 0 ? (totalPct / activeGoals.length) : 0;

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

    const unseen = list.filter(a => !a.seen);
    if (unseen.length > 0) {
      unseen.forEach((a, i) => {
        const achievementInfo = ACHIEVEMENTS.find(ac => ac.key === a.achievement_key);
        if (achievementInfo) {
          setTimeout(async () => {
            const id = `${a.achievement_key}-${Date.now()}`;
            setToastQueue((prev) => [...prev, { id, achievement: achievementInfo }]);
            await achievementsService.markAsSeen(userId, [a.achievement_key]);

            // Atualizar estado local
            setUnlockedAchievements((prev) =>
              (prev || []).map((item) =>
                item.achievement_key === a.achievement_key
                  ? { ...item, seen: true }
                  : item
              )
            );
          }, i * 1200);
        }
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
        setCurrentUser(u);
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [runSilentHealthCheck]);

  // 2. Efeito central de carga de dados baseado em currentUser?.id
  useEffect(() => {
    if (!currentUser?.id) {
      setUserProfile(null);
      setTasks([]);
      setGoals([]);
      setGoalTasks([]);
      setUnlockedAchievements(null);
      setUnlockedKeys(null);
      setHabits([]);
      setHabitLogs([]);
      setIsPro(false);
      return;
    }

    const userId = currentUser.id;
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
          rehydrateUserState(userId),
        ]);
      } catch (err) {
        console.error('[AppContext] Erro ao carregar dados do usuário:', err);
      }
    };

    loadAll();

    return () => {
      active = false;
    };
  }, [currentUser?.id, loadTasks, loadGoals, loadAchievements, loadHabits, loadProfile, loadSubscription, rehydrateUserState]);

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
        const stats = calcStats(tasks, goals);

        // GUARD SECUNDÁRIO: conquistas que exigem ação real do usuário
        // só disparam se há evidência real de interação (não apenas dados carregados).
        const newlyUnlocked = ACHIEVEMENTS.filter((a) => {
          if (unlockedKeys.has(a.key)) return false;
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
          return a.check(stats);
        });

        if (newlyUnlocked.length === 0) return;

        const { error } = await achievementsService.unlock(
          currentUser.id,
          newlyUnlocked.map((a) => a.key)
        );
        if (error) return;

        newlyUnlocked.forEach((a, i) => {
          setTimeout(() => {
            setUnlockedKeys((prev) => { const n = new Set(prev); n.add(a.key); return n; });
            setUnlockedAchievements((prev) => [
              ...(prev || []),
              { achievement_key: a.key, unlocked_at: new Date().toISOString(), seen: true, viewed_at: new Date().toISOString() },
            ]);
            const id = `${a.key}-${Date.now()}`;
            setToastQueue((prev) => [...prev, { id, achievement: a }]);

            // Marca como visto no banco
            achievementsService.markAsSeen(currentUser.id, [a.key]);
          }, i * 1200);
        });
      } finally {
        achievementChecking.current = false;
      }
    };
    checkAchievements();
  }, [tasks, goals, currentUser?.id, unlockedKeys, unlockedAchievements]);

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
        await eventsService.logEvent(currentUser.id, 'logout');
      }
      await supabase.auth.signOut();
      // Reset do guard de conquistas para o próximo login
      dataLoadedOnce.current = false;
      firstSuccessLogged.current = false;
      setCurrentUser(null);
      setUserProfile(null);
      setTasks([]); setGoals([]); setGoalTasks([]);
      setUnlockedAchievements(null); setUnlockedKeys(null);
      setHabits([]); setHabitLogs([]);

      // Limpa caches locais no IndexedDB para isolamento multiusuário
      await localDB.clear('tasks').catch(() => {});
      await localDB.clear('goals').catch(() => {});
      await localDB.clear('habits').catch(() => {});
      await localDB.clear('profile').catch(() => {});
      await localDB.clear('events').catch(() => {});
    } catch (e) { console.error(e); }
  }, [currentUser?.id]);

  const dismissToast = useCallback((id) => {
    setToastQueue((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleCompleteOnboarding = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
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
    if (updatedTasks.length === 0 && updatedGoals.length === 0) {
      console.log('[AppContext] Limpeza total de tarefas e objetivos detectada. Resetando conquistas.');
      try {
        await achievementsService.resetAll(userId);
        setUnlockedAchievements([]);
        setUnlockedKeys(new Set());
      } catch (err) {
        console.warn('[AppContext] Erro ao resetar conquistas:', err);
      }
    }
  }, []);

  const handleAddTask = useCallback(async (taskData) => {
    if (!currentUser?.id) return;
    const { goal_id, ...payload } = taskData;
    const { data } = await tasksService.create(currentUser.id, payload);
    if (data) {
      setTasks((prev) => [data, ...prev]);
      logEvent('task_created', { taskId: data.id, title: payload.title });
      if (goal_id) {
        await goalsService.linkTask(goal_id, data.id);
        setGoalTasks((prev) => [...prev, { goal_id: goal_id, task_id: data.id }]);
      }
    }
  }, [currentUser?.id, logEvent]);

  const handleUpdateTask = useCallback(async (id, updatedData) => {
    if (!currentUser?.id) return;
    
    const existingTask = tasks.find(t => t.id === id);
    
    // OPTIMISTIC UPDATE: Atualiza UI na hora
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...updatedData } : t));
    
    // Dispara logs analíticos locais imediatamente (non-blocking)
    logEvent('task_updated', { task_id: id });
    
    // If completed was changed to true, log completion
    if (updatedData.completed === true) {
      logEvent('task_completed', { taskId: id });
      if (existingTask && existingTask.dueDate) {
        logEvent('calendar_task_completed', { taskId: id });
      }
      
      // Ensure tasks are actually loaded before calculating alreadyHadSuccess
      if (tasks.length > 0) {
        const alreadyHadSuccess = tasks.some(t => t.id !== id && t.completed);
        if (!alreadyHadSuccess && !firstSuccessLogged.current) {
          firstSuccessLogged.current = true;
          logEvent('first_success_action', { task_id: id });
        }
      }
    }

    // Check if dueDate is updated
    if (updatedData.dueDate !== undefined) {
      if (updatedData.dueDate && (!existingTask || !existingTask.dueDate)) {
        logEvent('calendar_task_scheduled', { taskId: id, date: updatedData.dueDate });
        logEvent('task_scheduled', { taskId: id, date: updatedData.dueDate });
      } else if (existingTask && existingTask.dueDate && updatedData.dueDate && existingTask.dueDate !== updatedData.dueDate) {
        logEvent('calendar_task_moved', { taskId: id, oldDate: existingTask.dueDate, newDate: updatedData.dueDate });
        logEvent('task_rescheduled', { taskId: id, oldDate: existingTask.dueDate, newDate: updatedData.dueDate });
      }
    }

    // Dispara atualização na rede de forma assíncrona
    tasksService.update(currentUser.id, id, updatedData).catch(err => {
      console.error('[AppContext] Erro ao atualizar tarefa:', err);
    });
  }, [currentUser?.id, logEvent, tasks]);

  const handleDeleteTask = useCallback(async (id) => {
    if (!currentUser?.id) return;
    if (!window.confirm('Excluir esta tarefa permanentemente?')) return;
    
    // OPTIMISTIC UPDATE
    const updatedTasks = tasks.filter((t) => t.id !== id);
    setTasks(updatedTasks);
    setGoalTasks((prev) => prev.filter((gt) => gt.task_id !== id));
    
    const { error, degraded } = await tasksService.delete(currentUser.id, id);
    if (!error || degraded) {
      logEvent('task_deleted', { task_id: id });
      resetAchievementsIfEmpty(currentUser.id, updatedTasks, goals);
    }
  }, [currentUser?.id, logEvent, tasks, goals, resetAchievementsIfEmpty]);

  const handleToggleComplete = useCallback(async (id) => {
    if (!currentUser?.id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    
    const next = !task.completed;
    const completedAt = next ? new Date().toISOString() : null;
    
    // OPTIMISTIC UPDATE: altera estado local antes da requisição
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: next, completedAt } : t));
    
    // Dispara logs analíticos locais imediatamente (non-blocking)
    if (next) {
      logEvent('task_completed', { taskId: id });

      // Detecta first_success_action
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

    // Executa chamada de rede assincronamente e lida com recorrência e reversão
    tasksService.toggleComplete(currentUser.id, id, task.completed).then(async ({ error, degraded }) => {
      if (!error || degraded) {
        if (next) {
          // Trata tarefas recorrentes
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
        // Revert em caso de falha real
        setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !next, completedAt: task.completedAt } : t));
      }
    }).catch((err) => {
      console.error('[AppContext] Erro ao toggleComplete:', err);
      // Revert em caso de falha real
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !next, completedAt: task.completedAt } : t));
    });
  }, [currentUser?.id, logEvent, tasks]);

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

  // ═══════════════════════════════════════════════════════════════════════════
  // GOALS CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddGoal = useCallback(async (goalData) => {
    if (!currentUser?.id) return;
    const { actions, ...goalPayload } = goalData;
    const { data } = await goalsService.create(currentUser.id, goalPayload);
    if (data) {
      setGoals((prev) => [data, ...prev]);
      logEvent('goal_created', { title: goalPayload.title });
      if (goalPayload.start_time && goalPayload.end_time) {
        logEvent('goal_scheduled', { title: goalPayload.title, start_time: goalPayload.start_time, end_time: goalPayload.end_time });
      }

      if (actions && actions.length > 0) {
        for (const actionTitle of actions) {
          const taskData = {
            title: actionTitle,
            description: '',
            category: 'Trabalho',
            priority: 'Média',
            dueDate: null,
          };
          const { data: taskResponse } = await tasksService.create(currentUser.id, taskData);
          if (taskResponse) {
             setTasks((prev) => [taskResponse, ...prev]);
             await goalsService.linkTask(data.id, taskResponse.id);
             setGoalTasks((prev) => [...prev, { goal_id: data.id, task_id: taskResponse.id }]);
          }
        }
      }
    }
  }, [currentUser?.id, logEvent]);

  const handleUpdateGoal = useCallback(async (id, updatedData) => {
    if (!currentUser?.id) return;
    const existingGoal = goals.find(g => g.id === id);
    const { data: payload } = await goalsService.update(currentUser.id, id, updatedData);
    if (payload) {
      setGoals((prev) => prev.map((g) => g.id === id ? { ...g, ...payload } : g));
      logEvent('goal_updated', { goal_id: id });
      if (updatedData.start_time !== undefined && existingGoal.start_time !== updatedData.start_time) {
        logEvent('goal_time_updated', { goal_id: id, start_time: updatedData.start_time, end_time: updatedData.end_time });
      }
      if (updatedData.status === 'completed') {
        logEvent('goal_completed', { goal_id: id });
        if (existingGoal.start_time) {
          logEvent('goal_completed_with_schedule', { goal_id: id });
        }
      } else if (updatedData.status === 'archived') {
        logEvent('goal_archived', { goal_id: id });
      } else if (existingGoal && (existingGoal.status === 'completed' || existingGoal.status === 'archived') && updatedData.status === 'active') {
        logEvent('goal_reopened', { goal_id: id });
      }
    }
  }, [currentUser?.id, logEvent, goals]);

  const handleDeleteGoal = useCallback(async (id) => {
    if (!currentUser?.id) return;
    
    const deleteGoalConfirm = window.confirm('Excluir este objetivo?');
    if (!deleteGoalConfirm) return;

    const linkedTasks = goalTasks.filter(gt => gt.goal_id === id).map(gt => gt.task_id);
    const deleteTasksConfirm = linkedTasks.length > 0 && window.confirm('Deseja excluir também todas as tarefas vinculadas a este objetivo?');

    const { error } = await goalsService.delete(currentUser.id, id);
    if (!error) {
      const updatedGoals = goals.filter((g) => g.id !== id);
      setGoals(updatedGoals);
      setGoalTasks((prev) => prev.filter((gt) => gt.goal_id !== id));
      
      let finalTasks = [...tasks];
      if (deleteTasksConfirm) {
        for (const taskId of linkedTasks) {
          const { error: errTask, degraded } = await tasksService.delete(currentUser.id, taskId);
          if (!errTask || degraded) {
            finalTasks = finalTasks.filter(t => t.id !== taskId);
          }
        }
        setTasks(finalTasks);
      }

      logEvent('goal_deleted', { goal_id: id, deleted_linked_tasks: deleteTasksConfirm });
      resetAchievementsIfEmpty(currentUser.id, finalTasks, updatedGoals);
    }
  }, [currentUser?.id, logEvent, tasks, goals, goalTasks, resetAchievementsIfEmpty]);

  const handleLinkTask = useCallback(async (goalId, taskId) => {
    if (goalTasks.some((gt) => gt.goal_id === goalId && gt.task_id === taskId)) return;
    const { error } = await goalsService.linkTask(goalId, taskId);
    if (!error) {
      setGoalTasks((prev) => [...prev, { goal_id: goalId, task_id: taskId }]);
      logEvent('task_linked_to_goal', { goal_id: goalId, task_id: taskId });
    }
  }, [goalTasks, currentUser?.id, logEvent]);

  const handleUnlinkTask = useCallback(async (goalId, taskId) => {
    const { error } = await goalsService.unlinkTask(goalId, taskId);
    if (!error) {
      setGoalTasks((prev) => prev.filter((gt) => !(gt.goal_id === goalId && gt.task_id === taskId)));
      logEvent('task_unlinked_from_goal', { goal_id: goalId, task_id: taskId });
    }
  }, [currentUser?.id, logEvent]);

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

  // ═══════════════════════════════════════════════════════════════════════════
  // SIMULADOR DE UPGRADE PRO (Bloco 6)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleSimulateUpgrade = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const nextPro = !isPro;
      logEvent(nextPro ? 'upgrade_clicked' : 'downgrade_clicked');
      logEvent(nextPro ? 'upgrade_started' : 'downgrade_started');
      
      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: currentUser.id,
          status: nextPro ? 'active' : 'canceled',
          plan: 'pro',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      if (error) throw error;
      
      setIsPro(nextPro);
      logEvent(nextPro ? 'upgrade_completed' : 'downgrade_completed');
      logEvent(nextPro ? 'subscription_started' : 'subscription_cancelled');
    } catch (e) {
      console.error('Erro ao mudar assinatura:', e);
    }
  }, [currentUser, isPro, logEvent]);

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
    if (!currentUser?.id) return;

    rehydrateUserState(currentUser.id).then((state) => {
      if (state?.has_first_success) firstSuccessLogged.current = true;
    });

    const unsub = eventEmitter.on('*', () => {
      rehydrateUserState(currentUser.id).then((state) => {
        if (state?.has_first_success) firstSuccessLogged.current = true;
      });
    });

    return unsub;
  }, [currentUser?.id, rehydrateUserState]);

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

    // Navigation
    activeTab,
    setActiveTab,
    shouldOpenGoalModal,
    setShouldOpenGoalModal,

    // Theme
    theme,
    setTheme,

    // Data
    tasks,
    goals,
    goalTasks,
    unlockedAchievements,
    toastQueue,
    dismissToast,

    // Tasks actions
    handleAddTask,
    handleUpdateTask,
    handleDeleteTask,
    handleToggleComplete,

    // Goals actions
    handleAddGoal,
    handleUpdateGoal,
    handleDeleteGoal,
    handleLinkTask,
    handleUnlinkTask,

    // Habits
    habitsManager,

    // SaaS additions
    isPro,
    isAdmin,
    handleSimulateUpgrade,
    categories,
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    logEvent,
    consistencyScore,
    handleCompleteOnboarding,
    supabaseConfigError,

    // Profiles additions
    userProfile,
    handleUpdateProfile,
    handleUploadAvatar,
    handleDeleteAvatar,

    // Sync / Resiliência
    syncStatus,
    syncWarnings,

    // Growth & Intelligence
    userState,
    insights,
    suggestions,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

