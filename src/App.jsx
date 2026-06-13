import React, { useState, useEffect, useCallback } from 'react';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import TodoView from './components/TodoView';
import EvolutionView from './components/EvolutionView';
import HomeView from './components/HomeView';
import GoalsView from './components/GoalsView';
import SettingsView from './components/SettingsView';
import AchievementToastManager from './components/AchievementToast';
import useAchievements from './hooks/useAchievements';
import { useHabits } from './hooks/useHabits';
import { supabase } from './supabaseClient';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [goalTasks, setGoalTasks] = useState([]);
  const [isInitializing, setIsInitializing] = useState(true);

  // ─── Hábitos ─────────────────────────────────────────────────────────────────
  const habitsManager = useHabits(currentUser);

  // ─── Estado de Conquistas ────────────────────────────────────────────────────
  // unlockedAchievements: array de { achievement_key, unlocked_at }
  const [unlockedAchievements, setUnlockedAchievements] = useState(null); // null = ainda carregando
  // unlockedKeys: Set<string> para lookups O(1)
  const [unlockedKeys, setUnlockedKeys] = useState(null);
  // Fila de toasts: [{ id, achievement }]
  const [toastQueue, setToastQueue] = useState([]);

  // ─── Carregar Tarefas ────────────────────────────────────────────────────────
  const loadTasks = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setTasks(data.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description || '',
          category: t.category,
          priority: t.priority,
          dueDate: t.due_date || '',
          completed: t.completed,
          createdAt: t.created_at,
        })));
      } else {
        setTasks([]);
      }
    } catch (e) {
      console.error('Erro ao carregar tarefas:', e);
    }
  };

  // ─── Carregar Objetivos ──────────────────────────────────────────────────────
  const loadGoals = async (userId) => {
    try {
      const { data: goalsData, error: ge } = await supabase
        .from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (ge) throw ge;
      setGoals(goalsData || []);

      if (goalsData && goalsData.length > 0) {
        const { data: gtData, error: gte } = await supabase
          .from('goal_tasks').select('goal_id, task_id').in('goal_id', goalsData.map(g => g.id));
        if (gte) throw gte;
        setGoalTasks(gtData || []);
      } else {
        setGoalTasks([]);
      }
    } catch (e) {
      console.error('Erro ao carregar objetivos:', e);
    }
  };

  // ─── Carregar Conquistas ─────────────────────────────────────────────────────
  const loadAchievements = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_achievements').select('achievement_key, unlocked_at').eq('user_id', userId);
      if (error) throw error;
      const list = data || [];
      setUnlockedAchievements(list);
      setUnlockedKeys(new Set(list.map(a => a.achievement_key)));
    } catch (e) {
      console.error('Erro ao carregar conquistas:', e);
      setUnlockedAchievements([]);
      setUnlockedKeys(new Set());
    }
  };

  // ─── Carregamento inicial ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email.split('@')[0],
        };
        setCurrentUser(u);
        Promise.all([loadTasks(u.id), loadGoals(u.id), loadAchievements(u.id)])
          .finally(() => setIsInitializing(false));
      } else {
        setIsInitializing(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        const u = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email.split('@')[0],
        };
        setCurrentUser(u);
        loadTasks(u.id);
        loadGoals(u.id);
        loadAchievements(u.id);
      } else {
        setCurrentUser(null);
        setTasks([]); setGoals([]); setGoalTasks([]);
        setUnlockedAchievements([]); setUnlockedKeys(new Set());
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    Promise.all([loadTasks(user.id), loadGoals(user.id), loadAchievements(user.id)]);
    setActiveTab('home');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setTasks([]); setGoals([]); setGoalTasks([]);
      setUnlockedAchievements([]); setUnlockedKeys(new Set());
    } catch (e) { console.error(e); }
  };

  // ─── Callbacks para o hook de conquistas ─────────────────────────────────────
  const handleUnlock = useCallback((key) => {
    setUnlockedKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setUnlockedAchievements(prev => [
      ...(prev || []),
      { achievement_key: key, unlocked_at: new Date().toISOString() },
    ]);
  }, []);

  const handleToast = useCallback((achievement) => {
    const id = `${achievement.key}-${Date.now()}`;
    setToastQueue(prev => [...prev, { id, achievement }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToastQueue(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─── Hook de detecção de conquistas ──────────────────────────────────────────
  useAchievements({
    tasks,
    goals,
    userId: currentUser?.id,
    unlockedKeys,
    onUnlock: handleUnlock,
    onToast: handleToast,
  });

  // ─── CRUD Tarefas ────────────────────────────────────────────────────────────
  const handleAddTask = async (taskData) => {
    try {
      const { data, error } = await supabase.from('tasks').insert([{
        user_id: currentUser.id, title: taskData.title,
        description: taskData.description || '', category: taskData.category,
        priority: taskData.priority, due_date: taskData.dueDate || null, completed: false,
      }]).select();
      if (error) throw error;
      if (data?.[0]) {
        setTasks(prev => [{
          id: data[0].id, title: data[0].title, description: data[0].description || '',
          category: data[0].category, priority: data[0].priority,
          dueDate: data[0].due_date || '', completed: false, createdAt: data[0].created_at,
        }, ...prev]);
      }
    } catch (e) { console.error(e); }
  };

  const handleUpdateTask = async (id, updatedData) => {
    try {
      const { error } = await supabase.from('tasks').update({
        title: updatedData.title, description: updatedData.description || '',
        category: updatedData.category, priority: updatedData.priority,
        due_date: updatedData.dueDate || null,
      }).eq('id', id);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updatedData } : t));
    } catch (e) { console.error(e); }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Excluir esta tarefa permanentemente?')) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== id));
      setGoalTasks(prev => prev.filter(gt => gt.task_id !== id));
    } catch (e) { console.error(e); }
  };

  const handleToggleComplete = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
      const next = !task.completed;
      const { error } = await supabase.from('tasks').update({ completed: next }).eq('id', id);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: next } : t));
    } catch (e) { console.error(e); }
  };

  // ─── CRUD Objetivos ──────────────────────────────────────────────────────────
  const handleAddGoal = async (goalData) => {
    try {
      const { data, error } = await supabase.from('goals').insert([{
        user_id: currentUser.id, title: goalData.title,
        description: goalData.description || '', color: goalData.color || '#4A654E',
        icon: goalData.icon || '🎯', target_date: goalData.target_date || null, status: 'active',
      }]).select();
      if (error) throw error;
      if (data?.[0]) setGoals(prev => [data[0], ...prev]);
    } catch (e) { console.error(e); }
  };

  const handleUpdateGoal = async (id, updatedData) => {
    try {
      const payload = {};
      ['title', 'description', 'color', 'icon', 'status'].forEach(k => {
        if (updatedData[k] !== undefined) payload[k] = updatedData[k];
      });
      if (updatedData.target_date !== undefined) payload.target_date = updatedData.target_date || null;
      const { error } = await supabase.from('goals').update(payload).eq('id', id);
      if (error) throw error;
      setGoals(prev => prev.map(g => g.id === id ? { ...g, ...payload } : g));
    } catch (e) { console.error(e); }
  };

  const handleDeleteGoal = async (id) => {
    if (!window.confirm('Excluir este objetivo? As tarefas vinculadas não serão afetadas.')) return;
    try {
      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (error) throw error;
      setGoals(prev => prev.filter(g => g.id !== id));
      setGoalTasks(prev => prev.filter(gt => gt.goal_id !== id));
    } catch (e) { console.error(e); }
  };

  const handleLinkTask = async (goalId, taskId) => {
    if (goalTasks.some(gt => gt.goal_id === goalId && gt.task_id === taskId)) return;
    try {
      const { error } = await supabase.from('goal_tasks').insert([{ goal_id: goalId, task_id: taskId }]);
      if (error) throw error;
      setGoalTasks(prev => [...prev, { goal_id: goalId, task_id: taskId }]);
    } catch (e) { console.error(e); }
  };

  const handleUnlinkTask = async (goalId, taskId) => {
    try {
      const { error } = await supabase.from('goal_tasks').delete()
        .eq('goal_id', goalId).eq('task_id', taskId);
      if (error) throw error;
      setGoalTasks(prev => prev.filter(gt => !(gt.goal_id === goalId && gt.task_id === taskId)));
    } catch (e) { console.error(e); }
  };

  // ─── Loading / Auth ──────────────────────────────────────────────────────────
  if (isInitializing) {
    return (
      <div className="app-loading-container">
        <div className="app-loading-spinner" />
        <span className="app-loading-text">Carregando o FocusList...</span>
      </div>
    );
  }

  if (!currentUser) return <Auth onLoginSuccess={handleLoginSuccess} />;

  return (
    <div className="app-wrapper">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} onLogout={handleLogout} />

      <main className="app-main-content">
        <div className="container">
          {activeTab === 'home' && (
            <HomeView
              tasks={tasks}
              goals={goals}
              goalTasks={goalTasks}
              currentUser={currentUser}
              onStartTask={() => setActiveTab('tasks')}
              setActiveTab={setActiveTab}
              unlockedAchievements={unlockedAchievements || []}
            />
          )}
          {activeTab === 'goals' && (
            <GoalsView
              goals={goals}
              goalTasks={goalTasks}
              tasks={tasks}
              habitsManager={habitsManager}
              onAddGoal={handleAddGoal}
              onUpdateGoal={handleUpdateGoal}
              onDeleteGoal={handleDeleteGoal}
              onLinkTask={handleLinkTask}
              onUnlinkTask={handleUnlinkTask}
            />
          )}
          {activeTab === 'tasks' && (
            <TodoView
              tasks={tasks}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onToggleComplete={handleToggleComplete}
            />
          )}
          {activeTab === 'analytics' && (
            <EvolutionView
              tasks={tasks}
              goals={goals}
              unlockedAchievements={unlockedAchievements || []}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          )}
        </div>
      </main>

      {/* Toast de conquistas — global, posição fixed */}
      <AchievementToastManager queue={toastQueue} onDismiss={dismissToast} />

      <footer className="app-footer">
        <p>© 2026 FocusList. Criado com React e Vanilla CSS. Integrado com o Supabase.</p>
      </footer>
    </div>
  );
}
