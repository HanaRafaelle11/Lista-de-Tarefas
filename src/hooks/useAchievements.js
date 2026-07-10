
// ─── Definições de Conquistas ────────────────────────────────────────────────
export const ACHIEVEMENTS = [
  {
    key: 'first_task',
    icon: 'medal',
    title: 'Primeira conquista',
    desc: 'Você concluiu sua primeira tarefa.',
    check: (s) => s.completedTasks >= 1,
    rarity: 'Comum',
    rarityName: 'Bronze',
    color: '#cd7f32',
    bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.03) 100%)',
    border: '1px solid rgba(205, 127, 50, 0.35)'
  },
  {
    key: 'tasks_10',
    icon: 'rocket',
    title: 'Em ritmo',
    desc: '10 tarefas concluídas. O hábito está se formando.',
    check: (s) => s.completedTasks >= 10,
    rarity: 'Comum',
    rarityName: 'Bronze',
    color: '#cd7f32',
    bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.03) 100%)',
    border: '1px solid rgba(205, 127, 50, 0.35)'
  },
  {
    key: 'tasks_50',
    icon: 'strength',
    title: 'Meio centenário',
    desc: '50 tarefas concluídas. Consistência de nível avançado.',
    check: (s) => s.completedTasks >= 50,
    rarity: 'Rara',
    rarityName: 'Prata',
    color: '#9ca3af',
    bg: 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(156, 163, 175, 0.03) 100%)',
    border: '1px solid rgba(156, 163, 175, 0.35)'
  },
  {
    key: 'tasks_100',
    icon: 'sparkle',
    title: 'Centenário',
    desc: '100 tarefas. Uma prova de comprometimento raro.',
    check: (s) => s.completedTasks >= 100,
    rarity: 'Épica',
    rarityName: 'Ouro',
    color: '#fbbf24',
    bg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.03) 100%)',
    border: '1px solid rgba(251, 191, 36, 0.35)'
  },
  {
    key: 'streak_3',
    icon: 'fire',
    title: '3 dias seguidos',
    desc: 'Três dias consecutivos de progresso.',
    check: (s) => s.currentStreak >= 3,
    rarity: 'Comum',
    rarityName: 'Bronze',
    color: '#cd7f32',
    bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.03) 100%)',
    border: '1px solid rgba(205, 127, 50, 0.35)'
  },
  {
    key: 'streak_7',
    icon: 'fire',
    title: 'Semana perfeita',
    desc: '7 dias consecutivos. Isso é um hábito real.',
    check: (s) => s.currentStreak >= 7,
    rarity: 'Rara',
    rarityName: 'Prata',
    color: '#9ca3af',
    bg: 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(156, 163, 175, 0.03) 100%)',
    border: '1px solid rgba(156, 163, 175, 0.35)'
  },
  {
    key: 'streak_30',
    icon: 'gem',
    title: '30 dias de consistência',
    desc: 'Um mês inteiro de progresso diário.',
    check: (s) => s.currentStreak >= 30,
    rarity: 'Épica',
    rarityName: 'Ouro',
    color: '#fbbf24',
    bg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.03) 100%)',
    border: '1px solid rgba(251, 191, 36, 0.35)'
  },
  {
    key: 'first_goal',
    icon: 'objectives',
    title: 'Primeiro objetivo',
    desc: 'Você criou seu primeiro objetivo. O caminho começa aqui.',
    check: (s) => s.totalGoals >= 1,
    rarity: 'Comum',
    rarityName: 'Bronze',
    color: '#cd7f32',
    bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.03) 100%)',
    border: '1px solid rgba(205, 127, 50, 0.35)'
  },
  {
    key: 'first_goal_completed',
    icon: 'trophy',
    title: 'Objetivo alcançado',
    desc: 'Você alcançou um objetivo. Isso é raro e valioso.',
    check: (s) => s.completedGoals >= 1,
    rarity: 'Rara',
    rarityName: 'Prata',
    color: '#9ca3af',
    bg: 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(156, 163, 175, 0.03) 100%)',
    border: '1px solid rgba(156, 163, 175, 0.35)'
  },
  {
    key: 'goals_10',
    icon: 'globe',
    title: 'Visionário',
    desc: '10 objetivos concluídos. Você constrói grandes coisas.',
    check: (s) => s.completedGoals >= 10,
    rarity: 'Épica',
    rarityName: 'Ouro',
    color: '#fbbf24',
    bg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.03) 100%)',
    border: '1px solid rgba(251, 191, 36, 0.35)'
  },
  {
    key: 'pet_lover',
    icon: 'paw',
    title: 'Amigo dos Animais',
    desc: 'Você concluiu 3 ou mais tarefas de cuidados com pets.',
    check: (s) => s.petTasksCompleted >= 3,
    rarity: 'Rara',
    rarityName: 'Prata',
    color: '#9ca3af',
    bg: 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(156, 163, 175, 0.03) 100%)',
    border: '1px solid rgba(156, 163, 175, 0.35)'
  },
  {
    key: 'financista',
    icon: 'coin',
    title: 'Mestre Financeiro',
    desc: 'Você concluiu 3 ou mais tarefas de finanças pessoais.',
    check: (s) => s.financeTasksCompleted >= 3,
    rarity: 'Rara',
    rarityName: 'Prata',
    color: '#9ca3af',
    bg: 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(156, 163, 175, 0.03) 100%)',
    border: '1px solid rgba(156, 163, 175, 0.35)'
  },
  {
    key: 'carreira',
    icon: 'rocket',
    title: 'Foco Profissional',
    desc: 'Você concluiu 3 ou mais tarefas de transição de carreira.',
    check: (s) => s.careerTasksCompleted >= 3,
    rarity: 'Rara',
    rarityName: 'Prata',
    color: '#9ca3af',
    bg: 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(156, 163, 175, 0.03) 100%)',
    border: '1px solid rgba(156, 163, 175, 0.35)'
  },
  {
    key: 'perfect_habits',
    icon: 'trophy',
    title: 'Foco Total',
    desc: 'Você concluiu 100% dos seus hábitos de hoje.',
    check: (s) => s.habits100PercentToday === true,
    rarity: 'Lendária',
    rarityName: 'Lendária',
    color: '#eab308',
    bg: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(234, 179, 8, 0.03) 100%)',
    border: '2px solid #eab308'
  },
];

// ─── Cálculo de Streak ───────────────────────────────────────────────────────
export function calcStreak(tasks) {
  const activeTasks = (tasks || []).filter(t => !t.deletedAt && !t.deleted_at);
  const completedDates = [
    ...new Set(
      activeTasks
        .filter(t => t.completed)
        .map(t => {
          if (t.completedAt) return t.completedAt.split('T')[0];
          if (t.dueDate) return t.dueDate;
          return t.createdAt ? t.createdAt.split('T')[0] : '';
        })
        .filter(d => d !== '')
    )
  ].sort().reverse();


  if (completedDates.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (completedDates[0] !== todayStr && completedDates[0] !== yesterdayStr) return 0;

  let streak = 1;
  for (let i = 1; i < completedDates.length; i++) {
    const prev = new Date(completedDates[i - 1] + 'T00:00:00');
    const curr = new Date(completedDates[i] + 'T00:00:00');
    const diffDays = Math.round((prev - curr) / 86400000);
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}

// ─── Cálculo de dias ativos ──────────────────────────────────────────────────
export function calcActiveDays(tasks) {
  const activeTasks = (tasks || []).filter(t => !t.deletedAt && !t.deleted_at);
  return new Set(
    activeTasks
      .filter(t => t.completed)
      .map(t => {
        if (t.completedAt) return t.completedAt.split('T')[0];
        if (t.dueDate) return t.dueDate;
        return t.createdAt ? t.createdAt.split('T')[0] : '';
      })
      .filter(d => d !== '')
  ).size;
}

// ─── Calcular todas as stats ─────────────────────────────────────────────────
export function calcStats(tasks, goals, habits = [], habitLogs = []) {
  const activeTasks = (tasks || []).filter(t => !t.deletedAt && !t.deleted_at);
  const activeGoals = (goals || []).filter(g => !g.deletedAt && !g.deleted_at);
  let petTasksCompleted = 0;
  let financeTasksCompleted = 0;
  let careerTasksCompleted = 0;

  activeTasks.forEach(t => {
    if (t.completed) {
      const marker = '--flowday-meta--';
      if (t.description && t.description.includes(marker)) {
        try {
          const parts = t.description.split(marker);
          const meta = JSON.parse(parts[1].trim());
          if (meta.template_name === 'Cuidados com Cachorrinho') petTasksCompleted++;
          if (meta.template_name === 'Organizar Finanças Pessoais') financeTasksCompleted++;
          if (meta.template_name === 'Transição de Carreira') careerTasksCompleted++;
        } catch (e) {
          // ignore
        }
      }
    }
  });

  // Cálculo de hábitos completos hoje
  const todayStr = new Date().toISOString().split('T')[0];
  const completedHabitsToday = habitLogs.filter(l => l.completed_date === todayStr).length;
  const habits100PercentToday = habits.length > 0 && completedHabitsToday === habits.length;

  return {
    completedTasks: activeTasks.filter(t => t.completed).length,
    totalTasks: activeTasks.length,
    totalGoals: activeGoals.length,
    activeGoals: activeGoals.filter(g => g.status === 'active').length,
    completedGoals: activeGoals.filter(g => g.status === 'completed').length,
    currentStreak: calcStreak(activeTasks),
    activeDays: calcActiveDays(activeTasks),
    completionRate: activeTasks.length > 0
      ? Math.round((activeTasks.filter(t => t.completed).length / activeTasks.length) * 100)
      : 0,
    petTasksCompleted,
    financeTasksCompleted,
    careerTasksCompleted,
    habits100PercentToday
  };
}


