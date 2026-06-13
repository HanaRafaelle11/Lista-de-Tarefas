import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';

// ─── Definições de Conquistas ────────────────────────────────────────────────
export const ACHIEVEMENTS = [
  {
    key: 'first_task',
    emoji: '🏅',
    title: 'Primeira conquista',
    desc: 'Você concluiu sua primeira tarefa.',
    check: (s) => s.completedTasks >= 1,
  },
  {
    key: 'tasks_10',
    emoji: '🚀',
    title: 'Em ritmo',
    desc: '10 tarefas concluídas. O hábito está se formando.',
    check: (s) => s.completedTasks >= 10,
  },
  {
    key: 'tasks_50',
    emoji: '💪',
    title: 'Meio centenário',
    desc: '50 tarefas concluídas. Consistência de nível avançado.',
    check: (s) => s.completedTasks >= 50,
  },
  {
    key: 'tasks_100',
    emoji: '🌟',
    title: 'Centenário',
    desc: '100 tarefas. Uma prova de comprometimento raro.',
    check: (s) => s.completedTasks >= 100,
  },
  {
    key: 'streak_3',
    emoji: '🔥',
    title: '3 dias seguidos',
    desc: 'Três dias consecutivos de progresso.',
    check: (s) => s.currentStreak >= 3,
  },
  {
    key: 'streak_7',
    emoji: '🔥',
    title: 'Semana perfeita',
    desc: '7 dias consecutivos. Isso é um hábito real.',
    check: (s) => s.currentStreak >= 7,
  },
  {
    key: 'streak_30',
    emoji: '💎',
    title: '30 dias de consistência',
    desc: 'Um mês inteiro de progresso diário.',
    check: (s) => s.currentStreak >= 30,
  },
  {
    key: 'first_goal',
    emoji: '🎯',
    title: 'Primeiro objetivo',
    desc: 'Você criou seu primeiro objetivo. O caminho começa aqui.',
    check: (s) => s.totalGoals >= 1,
  },
  {
    key: 'first_goal_completed',
    emoji: '🏆',
    title: 'Objetivo alcançado',
    desc: 'Você alcançou um objetivo. Isso é raro e valioso.',
    check: (s) => s.completedGoals >= 1,
  },
  {
    key: 'goals_10',
    emoji: '🌍',
    title: 'Visionário',
    desc: '10 objetivos concluídos. Você constrói grandes coisas.',
    check: (s) => s.completedGoals >= 10,
  },
];

// ─── Cálculo de Streak ───────────────────────────────────────────────────────
export function calcStreak(tasks) {
  const completedDates = [
    ...new Set(
      tasks
        .filter(t => t.completed && t.dueDate)
        .map(t => t.dueDate)
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
  return new Set(
    tasks
      .filter(t => t.completed && t.dueDate)
      .map(t => t.dueDate)
  ).size;
}

// ─── Calcular todas as stats ─────────────────────────────────────────────────
export function calcStats(tasks, goals) {
  return {
    completedTasks: tasks.filter(t => t.completed).length,
    totalTasks: tasks.length,
    totalGoals: goals.length,
    activeGoals: goals.filter(g => g.status === 'active').length,
    completedGoals: goals.filter(g => g.status === 'completed').length,
    currentStreak: calcStreak(tasks),
    activeDays: calcActiveDays(tasks),
    completionRate: tasks.length > 0
      ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
      : 0,
  };
}

// ─── Hook Principal ──────────────────────────────────────────────────────────
export default function useAchievements({
  tasks,
  goals,
  userId,
  unlockedKeys,          // Set<string> — chaves já no banco
  onUnlock,              // (achievement) => void — atualiza estado local
  onToast,               // (achievement) => void — dispara toast
}) {
  // Ref para evitar re-check enquanto está gravando
  const checking = useRef(false);

  const checkAndUnlock = useCallback(async () => {
    if (!userId || checking.current || unlockedKeys === null) return;
    checking.current = true;

    try {
      const stats = calcStats(tasks, goals);
      const newlyUnlocked = [];

      for (const achievement of ACHIEVEMENTS) {
        if (!unlockedKeys.has(achievement.key) && achievement.check(stats)) {
          newlyUnlocked.push(achievement);
        }
      }

      if (newlyUnlocked.length === 0) return;

      // Gravar todas de uma vez no Supabase
      const rows = newlyUnlocked.map(a => ({
        user_id: userId,
        achievement_key: a.key,
      }));

      const { error } = await supabase
        .from('user_achievements')
        .upsert(rows, { onConflict: 'user_id,achievement_key', ignoreDuplicates: true });

      if (error) {
        console.error('Erro ao gravar conquistas:', error);
        return;
      }

      // Atualizar estado local e disparar toasts com delay entre eles
      newlyUnlocked.forEach((a, i) => {
        setTimeout(() => {
          onUnlock(a.key);
          onToast(a);
        }, i * 1200);
      });
    } finally {
      checking.current = false;
    }
  }, [tasks, goals, userId, unlockedKeys, onUnlock, onToast]);

  // Re-verifica toda vez que tasks ou goals mudarem
  useEffect(() => {
    checkAndUnlock();
  }, [checkAndUnlock]);
}
