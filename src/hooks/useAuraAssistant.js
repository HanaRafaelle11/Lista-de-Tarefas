import { useMemo } from 'react';

export function useAuraAssistant(tasks = [], goals = [], goalTasks = [], streak = 0, unlockedCount = 0) {
  return useMemo(() => {
    let nextBestAction = null;
    let risk = null;
    let summary = null;
    let insight = null;

    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    // 1. Próxima Melhor Ação
    // Procura por uma tarefa Alta ou Média que esteja vinculada a um Objetivo
    if (pendingTasks.length > 0) {
      const highTasks = pendingTasks.filter(t => t.priority === 'Alta');
      const medTasks = pendingTasks.filter(t => t.priority === 'Média');
      const candidates = [...highTasks, ...medTasks, ...pendingTasks];

      for (const task of candidates) {
        const link = goalTasks.find(gt => gt.task_id === task.id);
        if (link) {
          const goal = goals.find(g => g.id === link.goal_id);
          if (goal) {
            nextBestAction = {
              task,
              goal,
              message: `Concluir "${task.title}"`
            };
            break;
          }
        }
      }
      
      // Fallback se nenhuma tiver objetivo vinculado
      if (!nextBestAction && candidates.length > 0) {
        nextBestAction = {
          task: candidates[0],
          goal: null,
          message: `Concluir "${candidates[0].title}"`
        };
      }
    }

    // 2. Detecção de Riscos
    // Verifica tarefas atrasadas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueTasks = pendingTasks.filter(t => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate + 'T12:00:00');
      return dueDate < today;
    });

    if (overdueTasks.length > 0) {
      risk = {
        type: 'overdue',
        message: `Você possui ${overdueTasks.length} tarefa${overdueTasks.length > 1 ? 's' : ''} em atraso. Que tal reagendá-las?`,
        tasks: overdueTasks
      };
    } else {
      // Verifica objetivos sem progresso recente
      const activeGoals = goals.filter(g => g.status === 'active');
      for (const goal of activeGoals) {
        const linkedTaskIds = goalTasks.filter(gt => gt.goal_id === goal.id).map(gt => gt.task_id);
        const goalCompletedTasks = completedTasks.filter(t => linkedTaskIds.includes(t.id));
        
        if (goalCompletedTasks.length === 0 && linkedTaskIds.length > 0) {
           risk = {
             type: 'stagnant_goal',
             message: `O objetivo "${goal.title}" não tem avanços recentes.`
           };
           break;
        }
      }
    }

    // 3. Resumo Semanal (Simplificado para consistência)
    if (streak > 0 || completedTasks.length > 0) {
      summary = {
        message: `Você já concluiu ${completedTasks.length} tarefas e está num ritmo de ${streak} ${streak === 1 ? 'dia seguido' : 'dias seguidos'}. Continue assim!`
      };
    }

    // 4. Insights (Categoria mais produtiva)
    if (completedTasks.length > 0) {
      const categoryCounts = {};
      completedTasks.forEach(t => {
        const cat = t.category || 'Geral';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      let topCategory = Object.keys(categoryCounts)[0];
      for (const cat in categoryCounts) {
        if (categoryCounts[cat] > categoryCounts[topCategory]) {
          topCategory = cat;
        }
      }
      insight = {
        message: `Sua área de maior foco recente é "${topCategory}".`
      };
    }

    // Retorna as análises para o AuraAssistantWidget
    return {
      nextBestAction,
      risk,
      summary,
      insight
    };
  }, [tasks, goals, goalTasks, streak, unlockedCount]);
}
