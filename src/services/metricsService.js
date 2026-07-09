import { calcStreak, calcActiveDays } from '../hooks/useAchievements';

export const metricsService = {
  parseLocalDate(dateStr) {
    if (!dateStr) return new Date(0);
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  calculateAllMetrics({
    tasks = [],
    goals = [],
    habits = [],
    habitLogs = [],
    focusEvents = [],
    currentUser = null
  }) {
    // Filter out deleted items
    const activeTasks = tasks.filter(t => !t.deletedAt && !t.deleted_at);
    const activeGoals = goals.filter(g => !g.deletedAt && !g.deleted_at);

    // 7 days interval
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Completed within last 7 days
    const completedRecentTasks = activeTasks.filter(t => 
      t.completed && 
      t.completedAt && (new Date(t.completedAt) >= sevenDaysAgo)
    );

    const completedRecentGoals = activeGoals.filter(g => 
      g.status === 'completed' &&
      (g.updated_at ? new Date(g.updated_at) : new Date()) >= sevenDaysAgo
    );

    // Recent focus sessions count (last 7 days)
    let recentFocusCount = focusEvents.filter(e => {
      if (!e.created_at) return false;
      return new Date(e.created_at) >= sevenDaysAgo;
    }).length;

    // Global focus sessions count
    let globalFocusCount = focusEvents.length;

    // Fallbacks for demo mode if no events logged yet
    if (currentUser?.isDemo && focusEvents.length === 0) {
      recentFocusCount = 8;
      globalFocusCount = 8;
    }

    // Weekly consistency hours saved formula
    const hoursSaved = (recentFocusCount * 0.5) + (completedRecentTasks.length * 0.25) + (completedRecentGoals.length * 2.0);

    // General counters
    const completedTasksCount = activeTasks.filter(t => t.completed).length;
    const completedGoalsCount = activeGoals.filter(g => g.status === 'completed').length;
    const totalGoalsCount = activeGoals.length;

    const streak = calcStreak(activeTasks);
    const activeDays = calcActiveDays(activeTasks);

    // Habits consistency
    const todayStr = new Date().toISOString().split('T')[0];
    const completedHabitsToday = habitLogs.filter(l => l.completed_date === todayStr).length;
    const habits100PercentToday = habits.length > 0 && completedHabitsToday === habits.length;

    return {
      activeTasks,
      activeGoals,
      completedRecentTasks,
      completedRecentGoals,
      recentFocusCount,
      globalFocusCount,
      hoursSaved,
      completedTasksCount,
      completedGoalsCount,
      totalGoalsCount,
      streak,
      activeDays,
      habits100PercentToday
    };
  }
};
