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
import { ACHIEVEMENTS, calcStats } from '../hooks/useAchievements';

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

  // ── Feature Flags & Assinatura (SaaS) ───────────────────────────────────────
  const [isPro, setIsPro] = useState(false);

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
  // LOGGER DE EVENTOS (Bloco 5)
  // ═══════════════════════════════════════════════════════════════════════════
  const logEvent = useCallback(async (eventType, metadata = {}) => {
    if (!currentUser?.id) return;
    await eventsService.logEvent(currentUser.id, eventType, metadata);
  }, [currentUser?.id]);

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
      .then(({ data: { session } }) => {
        if (session?.user) {
          const u = buildUser(session.user);
          setCurrentUser(u);
          eventsService.logEvent(u.id, 'login', { method: 'session_restore' });
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((e, session) => {
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
    eventsService.logEvent(user.id, 'login', { method: 'explicit' });
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
      if (currentUser?.id) {
        await eventsService.logEvent(currentUser.id, 'logout');
      }
      await supabase.auth.signOut();
      setCurrentUser(null);
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
      eventsService.logEvent(currentUser.id, 'onboarding_completed');
    } catch (e) {
      console.error('Erro ao marcar onboarding como concluído:', e);
    }
  }, [currentUser]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TASKS CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddTask = useCallback(async (taskData) => {
    if (!currentUser?.id) return;
    const { data } = await tasksService.create(currentUser.id, taskData);
    if (data) {
      setTasks((prev) => [data, ...prev]);
      eventsService.logEvent(currentUser.id, 'task_created', { title: taskData.title });
    }
  }, [currentUser?.id]);

  const handleUpdateTask = useCallback(async (id, updatedData) => {
    if (!currentUser?.id) return;
    const { error } = await tasksService.update(currentUser.id, id, updatedData);
    if (!error) {
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...updatedData } : t));
      eventsService.logEvent(currentUser.id, 'task_updated', { task_id: id });
    }
  }, [currentUser?.id]);

  const handleDeleteTask = useCallback(async (id) => {
    if (!currentUser?.id) return;
    if (!window.confirm('Excluir esta tarefa permanentemente?')) return;
    const { error } = await tasksService.delete(currentUser.id, id);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setGoalTasks((prev) => prev.filter((gt) => gt.task_id !== id));
      eventsService.logEvent(currentUser.id, 'task_deleted', { task_id: id });
    }
  }, [currentUser?.id]);

  const handleToggleComplete = useCallback(async (id) => {
    if (!currentUser?.id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const { data: next } = await tasksService.toggleComplete(currentUser.id, id, task.completed);
    if (next !== null) {
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: next } : t));
      
      if (next) {
        eventsService.logEvent(currentUser.id, 'task_completed', { task_id: id });
        
        // Trata tarefas recorrentes
        const meta = parseTaskMetadata(task.description);
        if (meta && meta.recurrence && meta.recurrence !== 'nenhuma') {
          const nextDueDate = calculateNextOccurrence(task.dueDate, meta.recurrence);
          const nextTask = {
            title: task.title,
            description: task.description, // Mantém bloco de metadados
            category: task.category,
            priority: task.priority,
            dueDate: nextDueDate,
          };
          const { data: createdTask } = await tasksService.create(currentUser.id, nextTask);
          if (createdTask) {
            setTasks((prev) => [createdTask, ...prev]);
            eventsService.logEvent(currentUser.id, 'task_created', { title: nextTask.title, recurrence_parent: id });
          }
        }
      }
    }
  }, [currentUser?.id, tasks]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GOALS CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddGoal = useCallback(async (goalData) => {
    if (!currentUser?.id) return;
    const { data } = await goalsService.create(currentUser.id, goalData);
    if (data) {
      setGoals((prev) => [data, ...prev]);
      eventsService.logEvent(currentUser.id, 'goal_created', { title: goalData.title });
    }
  }, [currentUser?.id]);

  const handleUpdateGoal = useCallback(async (id, updatedData) => {
    if (!currentUser?.id) return;
    const { data: payload } = await goalsService.update(currentUser.id, id, updatedData);
    if (payload) {
      setGoals((prev) => prev.map((g) => g.id === id ? { ...g, ...payload } : g));
      eventsService.logEvent(currentUser.id, 'goal_updated', { goal_id: id });
    }
  }, [currentUser?.id]);

  const handleDeleteGoal = useCallback(async (id) => {
    if (!currentUser?.id) return;
    if (!window.confirm('Excluir este objetivo? As tarefas vinculadas não serão afetadas.')) return;
    const { error } = await goalsService.delete(currentUser.id, id);
    if (!error) {
      setGoals((prev) => prev.filter((g) => g.id !== id));
      setGoalTasks((prev) => prev.filter((gt) => gt.goal_id !== id));
      eventsService.logEvent(currentUser.id, 'goal_deleted', { goal_id: id });
    }
  }, [currentUser?.id]);

  const handleLinkTask = useCallback(async (goalId, taskId) => {
    if (goalTasks.some((gt) => gt.goal_id === goalId && gt.task_id === taskId)) return;
    const { error } = await goalsService.linkTask(goalId, taskId);
    if (!error) {
      setGoalTasks((prev) => [...prev, { goal_id: goalId, task_id: taskId }]);
      eventsService.logEvent(currentUser.id, 'task_linked_to_goal', { goal_id: goalId, task_id: taskId });
    }
  }, [goalTasks, currentUser?.id]);

  const handleUnlinkTask = useCallback(async (goalId, taskId) => {
    const { error } = await goalsService.unlinkTask(goalId, taskId);
    if (!error) {
      setGoalTasks((prev) => prev.filter((gt) => !(gt.goal_id === goalId && gt.task_id === taskId)));
      eventsService.logEvent(currentUser.id, 'task_unlinked_from_goal', { goal_id: goalId, task_id: taskId });
    }
  }, [currentUser?.id]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORIAS CRUD (Bloco 4)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddCategory = useCallback(async (newCat) => {
    if (!currentUser?.id) return;
    const currentCustom = currentUser.user_metadata?.custom_categories || [];
    
    // Evita duplicados em default ou customizado
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
      eventsService.logEvent(currentUser.id, 'category_created', { category: newCat.name });
    } catch (e) {
      console.error('Erro ao adicionar categoria:', e);
    }
  }, [currentUser]);

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
      eventsService.logEvent(currentUser.id, 'category_updated', { category: name });
    } catch (e) {
      console.error('Erro ao atualizar categoria:', e);
    }
  }, [currentUser]);

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
      eventsService.logEvent(currentUser.id, 'category_deleted', { category_id: id });
    } catch (e) {
      console.error('Erro ao excluir categoria:', e);
    }
  }, [currentUser]);

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
      eventsService.logEvent(currentUser.id, nextPro ? 'upgrade_clicked' : 'downgrade_clicked');
    } catch (e) {
      console.error('Erro ao mudar assinatura:', e);
    }
  }, [currentUser, isPro]);

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
        eventsService.logEvent(currentUser.id, 'habit_created', { title: habitData.title });
      }
      return data;
    }, [currentUser?.id]),
    updateHabit: useCallback(async (id, updates) => {
      if (!currentUser?.id) return null;
      const { data } = await habitsService.update(currentUser.id, id, updates);
      if (data) {
        setHabits((prev) => prev.map((h) => h.id === id ? data : h));
        eventsService.logEvent(currentUser.id, 'habit_updated', { habit_id: id });
      }
      return data;
    }, [currentUser?.id]),
    deleteHabit: useCallback(async (id) => {
      if (!currentUser?.id) return false;
      const { error } = await habitsService.delete(currentUser.id, id);
      if (!error) {
        setHabits((prev) => prev.filter((h) => h.id !== id));
        setHabitLogs((prev) => prev.filter((l) => l.habit_id !== id));
        eventsService.logEvent(currentUser.id, 'habit_deleted', { habit_id: id });
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
        eventsService.logEvent(currentUser.id, 'habit_completed', { habit_id: habitId, date: dateStr });
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

    // SaaS additions
    isPro,
    handleSimulateUpgrade,
    categories,
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    logEvent,
    consistencyScore,
    handleCompleteOnboarding,
    supabaseConfigError
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

