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
  const marker = '--flowday-meta--';
  const meta = { due_time, recurrence };
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

  useEffect(() => {
    if (currentUser) {
      setIsPro(!!currentUser.user_metadata?.is_pro);
    } else {
      setIsPro(false);
    }
  }, [currentUser]);

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

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Taxa de conclusão de tarefas nos últimos 7 dias (40% de peso)
    const recentTasks = tasks.filter(t => {
      const date = t.dueDate || t.createdAt?.split('T')[0];
      return date && new Date(date) >= sevenDaysAgo;
    });
    const taskCount = recentTasks.length;
    const completedTaskCount = recentTasks.filter(t => t.completed).length;
    const taskRate = taskCount > 0 ? (completedTaskCount / taskCount) : 0.5;

    // 2. Taxa de conclusão de hábitos nos últimos 7 dias (40% de peso)
    const recentLogs = habitLogs.filter(l => new Date(l.completed_date) >= sevenDaysAgo);
    const totalPossibleLogs = habits.length * 7;
    const habitRate = totalPossibleLogs > 0 ? (recentLogs.length / totalPossibleLogs) : 0.5;

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
    const goalRate = activeGoals.length > 0 ? (totalPct / activeGoals.length) : 0.5;

    const finalScore = Math.min(100, Math.round(
      (taskRate * 40) + 
      (habitRate * 40) + 
      (goalRate * 20)
    ));
    return isNaN(finalScore) ? 50 : finalScore;
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
  useEffect(() => {
    const buildUser = (u) => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.email.split('@')[0],
      user_metadata: u.user_metadata || {},
    });

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        const userId = session?.user?.id || null;

        // Health check SILENCIOSO — não bloqueia, apenas loga
        runSilentHealthCheck(userId);

        if (session?.user) {
          const u = buildUser(session.user);
          setCurrentUser(u);
          eventsService.logEvent(u.id, 'login', { method: 'session_restore' });
          Promise.all([
            loadTasks(u.id),
            loadGoals(u.id),
            loadAchievements(u.id),
            loadHabits(u.id),
            loadProfile(u.id),
            rehydrateUserState(u.id),
          ]).finally(() => setIsInitializing(false));
        } else {
          setIsInitializing(false);
        }
      })
      .catch((err) => {
        console.error('[AppContext] Erro ao verificar sessão:', err);
        setIsInitializing(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (e, session) => {
      if (session?.user) {
        const u = buildUser(session.user);
        setCurrentUser(u);
        loadTasks(u.id);
        loadGoals(u.id);
        loadAchievements(u.id);
        loadHabits(u.id);
        loadProfile(u.id);
        rehydrateUserState(u.id);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setTasks([]); setGoals([]); setGoalTasks([]);
        setUnlockedAchievements([]); setUnlockedKeys(new Set());
        setHabits([]); setHabitLogs([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadTasks, loadGoals, loadAchievements, loadHabits, loadProfile, runSilentHealthCheck, rehydrateUserState]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONQUISTAS — detecção automática
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const checkAchievements = async () => {
      if (!currentUser?.id || achievementChecking.current || unlockedKeys === null) return;
      achievementChecking.current = true;
      try {
        const stats = calcStats(tasks, goals);
        const newlyUnlocked = ACHIEVEMENTS.filter(
          (a) => !unlockedKeys.has(a.key) && a.check(stats)
        );
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
              { achievement_key: a.key, unlocked_at: new Date().toISOString() },
            ]);
            const id = `${a.key}-${Date.now()}`;
            setToastQueue((prev) => [...prev, { id, achievement: a }]);
          }, i * 1200);
        });
      } finally {
        achievementChecking.current = false;
      }
    };
    checkAchievements();
  }, [tasks, goals, currentUser?.id, unlockedKeys]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const handleLoginSuccess = useCallback((user) => {
    setCurrentUser(user);
    eventsService.logEvent(user.id, 'login', { method: 'explicit' });
    Promise.all([
      loadTasks(user.id),
      loadGoals(user.id),
      loadAchievements(user.id),
      loadHabits(user.id),
      loadProfile(user.id),
      rehydrateUserState(user.id)
    ]);
    setActiveTab('home');
  }, [loadTasks, loadGoals, loadAchievements, loadHabits, loadProfile, rehydrateUserState]);

  const handleLogout = useCallback(async () => {
    try {
      if (currentUser?.id) {
        await eventsService.logEvent(currentUser.id, 'logout');
      }
      await supabase.auth.signOut();
      setCurrentUser(null);
      setUserProfile(null);
      setTasks([]); setGoals([]); setGoalTasks([]);
      setUnlockedAchievements([]); setUnlockedKeys(new Set());
      setHabits([]); setHabitLogs([]);
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
  const handleAddTask = useCallback(async (taskData) => {
    if (!currentUser?.id) return;
    const { data } = await tasksService.create(currentUser.id, taskData);
    if (data) {
      setTasks((prev) => [data, ...prev]);
      logEvent('task_created', { taskId: data.id, title: taskData.title });
    }
  }, [currentUser?.id, logEvent]);

  const handleUpdateTask = useCallback(async (id, updatedData) => {
    if (!currentUser?.id) return;
    const { error } = await tasksService.update(currentUser.id, id, updatedData);
    if (!error) {
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...updatedData } : t));
      logEvent('task_updated', { task_id: id });
    }
  }, [currentUser?.id, logEvent]);

  const handleDeleteTask = useCallback(async (id) => {
    if (!currentUser?.id) return;
    if (!window.confirm('Excluir esta tarefa permanentemente?')) return;
    const { error } = await tasksService.delete(currentUser.id, id);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setGoalTasks((prev) => prev.filter((gt) => gt.task_id !== id));
      logEvent('task_deleted', { task_id: id });
    }
  }, [currentUser?.id, logEvent]);

  const handleToggleComplete = useCallback(async (id) => {
    if (!currentUser?.id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const { error } = await tasksService.toggleComplete(currentUser.id, id, task.completed);
    if (!error) {
      const next = !task.completed;
      const completedAt = next ? new Date().toISOString() : null;
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: next, completedAt } : t));

      if (next) {
        logEvent('task_completed', { taskId: id });

        // ─ Detecta first_success_action (emit apenas uma vez por usuário) ─
        const alreadyHadSuccess = tasks.some(t => t.id !== id && t.completed);
        if (!alreadyHadSuccess && !firstSuccessLogged.current) {
          firstSuccessLogged.current = true;
          logEvent('first_success_action', {
            task_id: id,
            task_title: task.title,
            ts: new Date().toISOString(),
          });
        }

        // ─ Trata tarefas recorrentes ─
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
    }
  }, [currentUser?.id, tasks, logEvent]);

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
    const { data } = await goalsService.create(currentUser.id, goalData);
    if (data) {
      setGoals((prev) => [data, ...prev]);
      logEvent('goal_created', { title: goalData.title });
    }
  }, [currentUser?.id, logEvent]);

  const handleUpdateGoal = useCallback(async (id, updatedData) => {
    if (!currentUser?.id) return;
    const { data: payload } = await goalsService.update(currentUser.id, id, updatedData);
    if (payload) {
      setGoals((prev) => prev.map((g) => g.id === id ? { ...g, ...payload } : g));
      logEvent('goal_updated', { goal_id: id });
    }
  }, [currentUser?.id, logEvent]);

  const handleDeleteGoal = useCallback(async (id) => {
    if (!currentUser?.id) return;
    if (!window.confirm('Excluir este objetivo? As tarefas vinculadas não serão afetadas.')) return;
    const { error } = await goalsService.delete(currentUser.id, id);
    if (!error) {
      setGoals((prev) => prev.filter((g) => g.id !== id));
      setGoalTasks((prev) => prev.filter((gt) => gt.goal_id !== id));
      logEvent('goal_deleted', { goal_id: id });
    }
  }, [currentUser?.id, logEvent]);

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
      const { error } = await supabase.auth.updateUser({
        data: { is_pro: nextPro }
      });
      if (error) throw error;
      setCurrentUser(prev => ({
        ...prev,
        user_metadata: { ...prev.user_metadata, is_pro: nextPro }
      }));
      logEvent(nextPro ? 'upgrade_clicked' : 'downgrade_clicked');
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
    isInitializing,
    handleLoginSuccess,
    handleLogout,

    // Navigation
    activeTab,
    setActiveTab,

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

