import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { supabase } from '../supabaseClient';
import { tasksService }        from '../services/tasksService';
import { goalsService }         from '../services/goalsService';
import { habitsService }        from '../services/habitsService';
import { achievementsService }  from '../services/achievementsService';
import { ACHIEVEMENTS, calcStats } from '../hooks/useAchievements';

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

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH — inicialização e listener
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const buildUser = (u) => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.email.split('@')[0],
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          const u = buildUser(session.user);
          setCurrentUser(u);
          Promise.all([
            loadTasks(u.id),
            loadGoals(u.id),
            loadAchievements(u.id),
            loadHabits(u.id),
          ]).finally(() => setIsInitializing(false));
        } else {
          setIsInitializing(false);
        }
      })
      .catch((err) => {
        console.error('[AppContext] Erro ao verificar sessão:', err);
        setIsInitializing(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        const u = buildUser(session.user);
        setCurrentUser(u);
        loadTasks(u.id);
        loadGoals(u.id);
        loadAchievements(u.id);
        loadHabits(u.id);
      } else {
        setCurrentUser(null);
        setTasks([]); setGoals([]); setGoalTasks([]);
        setUnlockedAchievements([]); setUnlockedKeys(new Set());
        setHabits([]); setHabitLogs([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadTasks, loadGoals, loadAchievements, loadHabits]);

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
    Promise.all([
      loadTasks(user.id),
      loadGoals(user.id),
      loadAchievements(user.id),
      loadHabits(user.id),
    ]);
    setActiveTab('home');
  }, [loadTasks, loadGoals, loadAchievements, loadHabits]);

  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setTasks([]); setGoals([]); setGoalTasks([]);
      setUnlockedAchievements([]); setUnlockedKeys(new Set());
      setHabits([]); setHabitLogs([]);
    } catch (e) { console.error(e); }
  }, []);

  const dismissToast = useCallback((id) => {
    setToastQueue((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // TASKS CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddTask = useCallback(async (taskData) => {
    if (!currentUser?.id) return;
    const { data } = await tasksService.create(currentUser.id, taskData);
    if (data) setTasks((prev) => [data, ...prev]);
  }, [currentUser?.id]);

  const handleUpdateTask = useCallback(async (id, updatedData) => {
    if (!currentUser?.id) return;
    const { error } = await tasksService.update(currentUser.id, id, updatedData);
    if (!error) setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...updatedData } : t));
  }, [currentUser?.id]);

  const handleDeleteTask = useCallback(async (id) => {
    if (!currentUser?.id) return;
    if (!window.confirm('Excluir esta tarefa permanentemente?')) return;
    const { error } = await tasksService.delete(currentUser.id, id);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setGoalTasks((prev) => prev.filter((gt) => gt.task_id !== id));
    }
  }, [currentUser?.id]);

  const handleToggleComplete = useCallback(async (id) => {
    if (!currentUser?.id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const { data: next } = await tasksService.toggleComplete(currentUser.id, id, task.completed);
    if (next !== null) setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: next } : t));
  }, [currentUser?.id, tasks]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GOALS CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddGoal = useCallback(async (goalData) => {
    if (!currentUser?.id) return;
    const { data } = await goalsService.create(currentUser.id, goalData);
    if (data) setGoals((prev) => [data, ...prev]);
  }, [currentUser?.id]);

  const handleUpdateGoal = useCallback(async (id, updatedData) => {
    if (!currentUser?.id) return;
    const { data: payload } = await goalsService.update(currentUser.id, id, updatedData);
    if (payload) setGoals((prev) => prev.map((g) => g.id === id ? { ...g, ...payload } : g));
  }, [currentUser?.id]);

  const handleDeleteGoal = useCallback(async (id) => {
    if (!currentUser?.id) return;
    if (!window.confirm('Excluir este objetivo? As tarefas vinculadas não serão afetadas.')) return;
    const { error } = await goalsService.delete(currentUser.id, id);
    if (!error) {
      setGoals((prev) => prev.filter((g) => g.id !== id));
      setGoalTasks((prev) => prev.filter((gt) => gt.goal_id !== id));
    }
  }, [currentUser?.id]);

  const handleLinkTask = useCallback(async (goalId, taskId) => {
    if (goalTasks.some((gt) => gt.goal_id === goalId && gt.task_id === taskId)) return;
    const { error } = await goalsService.linkTask(goalId, taskId);
    if (!error) setGoalTasks((prev) => [...prev, { goal_id: goalId, task_id: taskId }]);
  }, [goalTasks]);

  const handleUnlinkTask = useCallback(async (goalId, taskId) => {
    const { error } = await goalsService.unlinkTask(goalId, taskId);
    if (!error) setGoalTasks((prev) => prev.filter((gt) => !(gt.goal_id === goalId && gt.task_id === taskId)));
  }, []);

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
      if (data) setHabits((prev) => [data, ...prev]);
      return data;
    }, [currentUser?.id]),
    updateHabit: useCallback(async (id, updates) => {
      if (!currentUser?.id) return null;
      const { data } = await habitsService.update(currentUser.id, id, updates);
      if (data) setHabits((prev) => prev.map((h) => h.id === id ? data : h));
      return data;
    }, [currentUser?.id]),
    deleteHabit: useCallback(async (id) => {
      if (!currentUser?.id) return false;
      const { error } = await habitsService.delete(currentUser.id, id);
      if (!error) {
        setHabits((prev) => prev.filter((h) => h.id !== id));
        setHabitLogs((prev) => prev.filter((l) => l.habit_id !== id));
      }
      return !error;
    }, [currentUser?.id]),
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
      }
      return checked ?? false;
    }, [currentUser?.id, habitLogs]),
  };

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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
