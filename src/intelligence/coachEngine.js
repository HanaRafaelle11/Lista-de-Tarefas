/**
 * coachEngine.js — Mecanismo do Coach Inteligente MyFlowDay
 *
 * Gera orientações personalizadas, explica estatísticas de forma humana,
 * adiciona pontuações semanais, analisa tendências e varia o tom de voz 
 * para guiar o usuário como um verdadeiro mentor de produtividade.
 */

import { metricsService } from '../services/metricsService';

export function generateCoachMessage({
  tasks = [],
  goals = [],
  goalTasks = [],
  habitsManager = {},
  consistencyScore = 0,
  currentUser = null,
  userProfile = null,
  isPro = false,
  userState = null,
  focusEvents = []
}) {
  const now = new Date();
  const userName = userProfile?.nickname || userProfile?.name || currentUser?.user_metadata?.name || currentUser?.name || 'Tester';

  const metrics = metricsService.calculateAllMetrics({
    tasks,
    goals,
    habits: habitsManager?.habits || [],
    habitLogs: habitsManager?.habitLogs || [],
    focusEvents,
    currentUser
  });

  const allActiveTasks = metrics.activeTasks;
  const activeGoals = metrics.activeGoals.filter(g => g.status === 'active');

  // 1. Tratamento de Workspace Vazio
  if (allActiveTasks.length === 0 && activeGoals.length === 0) {
    const formattedMessage = `Nota da semana: --/10
 
Você não possui nenhuma tarefa ou objetivo ativo no momento.
 
Tendência Atual:
Sem dados de uso.
 
Insights do Mentor:
- Crie seus primeiros objetivos ou tarefas para começar a organizar sua rotina.
- Mantenha a consistência diária para ver insights detalhados sobre seu ritmo.
 
Recomendação Prática:
Crie objetivos ou tarefas e comece a executar para receber conselhos personalizados do seu Mentor.`;

    return {
      isPro,
      greeting: `Olá, ${userName}! Vamos dar o primeiro passo?`,
      message: formattedMessage,
      stats: {
        weeklyScore: '--',
        completedTasks: 0,
        trend: 'Sem dados de uso.',
        suggestion: 'Crie seu primeiro objetivo ou tarefa.',
        tone: 'analytical'
      }
    };
  }

  // Helper para evitar deslocamento de fuso horário em strings de data local
  const parseLocalDate = metricsService.parseLocalDate;

  // 2. Identificar intervalo de tempo dos últimos 7 dias
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const completedRecentTasks = metrics.completedRecentTasks;

  const totalRecentTasks = tasks.filter(t => 
    !t.deletedAt && !t.deleted_at &&
    t.createdAt && (new Date(t.createdAt) >= sevenDaysAgo)
  ).length;

  const activeHabits = habitsManager?.habits || [];
  const activeHabitsCount = activeHabits.length;
  const recentLogs = habitsManager?.habitLogs
    ? habitsManager.habitLogs.filter(l => {
        const isLinked = activeHabits.some(h => h.id === l.habit_id);
        if (!isLinked) return false;
        const logDate = parseLocalDate(l.completed_date);
        return logDate >= sevenDaysAgo;
      })
    : [];
  
  const completedRecentHabitsCount = recentLogs.length;
  const targetHabitOccurrences = activeHabitsCount * 7;
  const pendingHabitsWeekCount = Math.max(0, targetHabitOccurrences - completedRecentHabitsCount);
  const pendingTasksCount = allActiveTasks.filter(t => !t.completed).length;

  // Hábito pendente hoje
  const getTodayDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getTodayDateStr();
  const pendingHabitsTodayCount = activeHabits.filter(h => 
    !habitsManager?.habitLogs?.some(l => l.habit_id === h.id && l.completed_date === todayStr)
  ).length;

  const currentStreak = metrics.streak || 0;

  // 2b. Verificação de Histórico Suficiente
  const completedRecentTasksCount = completedRecentTasks.length;
  const hasHistory = completedRecentTasksCount > 0 || completedRecentHabitsCount > 0 || currentStreak > 0;

  if (!hasHistory) {
    const formattedMessage = `Nota da semana: --/10
 
Sem dados suficientes para avaliar sua evolução.
 
Tendência Atual:
Sem histórico de atividades recente.
 
Insights do Mentor:
- Conclua suas tarefas e marque seus hábitos diariamente para gerar pontuações.
- Objetivos de longo prazo são alcançados com pequenos hábitos diários consistentes.
 
Recomendação Prática:
Tente realizar e concluir pelo menos uma tarefa ou hábito hoje para iniciar sua análise de evolução comportamental.`;

    return {
      isPro,
      greeting: `Olá, ${userName}! Vamos dar o primeiro passo?`,
      message: formattedMessage.replace(/\*/g, ''),
      stats: {
        weeklyScore: '--',
        completedTasks: 0,
        trend: 'Sem histórico de atividades recente.',
        suggestion: 'Conclua pelo menos uma tarefa ou hábito.',
        tone: 'motivator'
      }
    };
  }

  // Helper para obter tarefa mais urgente (overdue > today > future)
  const getMostUrgentTask = () => {
    const pending = tasks.filter(t => !t.completed && !t.deletedAt && !t.deleted_at);
    
    const overdue = pending.filter(t => t.dueDate && t.dueDate < todayStr).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const todayTasks = pending.filter(t => t.dueDate === todayStr);
    const futureTasks = pending.filter(t => t.dueDate && t.dueDate > todayStr).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const noDateTasks = pending.filter(t => !t.dueDate);

    if (overdue.length > 0) {
      return { task: overdue[0], type: 'overdue', count: overdue.length };
    }
    if (todayTasks.length > 0) {
      return { task: todayTasks[0], type: 'today', count: todayTasks.length };
    }
    if (futureTasks.length > 0) {
      return { task: futureTasks[0], type: 'future', count: futureTasks.length };
    }
    if (noDateTasks.length > 0) {
      return { task: noDateTasks[0], type: 'no_date', count: noDateTasks.length };
    }
    return null;
  };

  // 3. Cálculo da Nota da Semana (1.0 a 10.0)
  const completionRatio = totalRecentTasks > 0 ? completedRecentTasks.length / totalRecentTasks : 0;
  let baseScore = 5.0; // Pontuação inicial padrão por uso da plataforma
  
  if (totalRecentTasks > 0) {
    baseScore = completionRatio * 8.0 + 1.0;
  } else if (allActiveTasks.length > 0) {
    baseScore = 3.0;
  }
  
  const streakBonus = Math.min(1.0, currentStreak * 0.15);
  const habitsBonus = Math.min(1.0, completedRecentHabitsCount * 0.20);
  
  let finalScore = baseScore + streakBonus + habitsBonus;
  if (activeGoals.length > 0 && completedRecentTasks.length === 0) {
    finalScore -= 1.0;
  }
  finalScore = Math.max(1.0, Math.min(10.0, finalScore));
  const weeklyScore = finalScore.toFixed(1);

  // 4. Variação do Tom de Voz (Semanal)
  const getWeekNumber = (d) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  };
  const weekNum = getWeekNumber(now);
  const toneIndex = weekNum % 3;
  const tones = ['motivator', 'analytical', 'challenging'];
  const activeTone = tones[toneIndex];

  // 5. Identificar Projeto / Objetivo Ativo
  const targetGoal = activeGoals[0];
  const goalTitle = targetGoal ? targetGoal.title : '';

  // 6. Tendências de Consistência
  const totalTasksThisWeek = totalRecentTasks;
  const completedTasksThisWeek = completedRecentTasks.length;
  const completionRateThisWeek = totalTasksThisWeek > 0 
    ? Math.round((completedTasksThisWeek / totalTasksThisWeek) * 100) 
    : 0;

  const totalHabitTargetThisWeek = activeHabitsCount * 7;
  const completedHabitsThisWeek = completedRecentHabitsCount;
  const habitCompletionRateThisWeek = totalHabitTargetThisWeek > 0 
    ? Math.round((completedHabitsThisWeek / totalHabitTargetThisWeek) * 100) 
    : 0;

  let trendIndicator = `Esta semana você concluiu ${completedTasksThisWeek} de ${totalTasksThisWeek} tarefas (${completionRateThisWeek}% de taxa de conclusão).`;
  if (activeHabitsCount > 0) {
    trendIndicator += ` E realizou ${completedHabitsThisWeek} hábitos de um total planejado de ${totalHabitTargetThisWeek} repetições (${habitCompletionRateThisWeek}% de consistência semanal).`;
  } else {
    trendIndicator += ` Nenhum hábito ativo cadastrado para a análise semanal de consistência.`;
  }

  // 7. Insights Ocultos baseados nos dados reais do usuário
  const dayCounts = Array(7).fill(0);
  tasks.forEach(t => {
    if (t.completed && !t.deletedAt && !t.deleted_at) {
      let dateObj;
      if (t.completedAt) {
        dateObj = new Date(t.completedAt);
      } else if (t.createdAt) {
        dateObj = new Date(t.createdAt);
      } else if (t.dueDate) {
        dateObj = parseLocalDate(t.dueDate);
      }
      if (dateObj) {
        const day = dateObj.getDay();
        dayCounts[day]++;
      }
    }
  });

  const daysOfWeek = ['Domingos', 'Segundas', 'Terças', 'Quartas', 'Quintas', 'Sextas', 'Sábados'];
  let bestDayIdx = 2; // Terça-feira por padrão
  let maxDayCount = 0;
  dayCounts.forEach((count, idx) => {
    if (count > maxDayCount) {
      maxDayCount = count;
      bestDayIdx = idx;
    }
  });
  const bestDayName = daysOfWeek[bestDayIdx];
  const preposition = (bestDayIdx === 0 || bestDayIdx === 6) ? 'aos' : 'às';

  // 7a. Produtividade por dia e período da faixa horária
  const hourCompletions = {
    'Manhã': 0,
    'Tarde': 0,
    'Noite': 0,
    'Madrugada': 0
  };
  tasks.forEach(t => {
    if (t.completed && !t.deletedAt && !t.deleted_at && t.completedAt) {
      const hour = new Date(t.completedAt).getHours();
      if (hour >= 6 && hour < 12) hourCompletions['Manhã']++;
      else if (hour >= 12 && hour < 18) hourCompletions['Tarde']++;
      else if (hour >= 18 && hour < 24) hourCompletions['Noite']++;
      else hourCompletions['Madrugada']++;
    }
  });
  let bestTimeRange = 'Manhã';
  let maxHourCount = 0;
  Object.entries(hourCompletions).forEach(([range, count]) => {
    if (count > maxHourCount) {
      maxHourCount = count;
      bestTimeRange = range;
    }
  });

  const insightDayAndTime = maxDayCount > 0
    ? `Você rende muito mais ${preposition} ${bestDayName.toLowerCase()} no período da ${bestTimeRange.toLowerCase()}. Planeje suas tarefas mais difíceis para esse horário.`
    : `Seu dia mais produtivo tem sido ${bestDayName}. Experimente agendar blocos de foco profundo nesse dia.`;

  // 7b. Categoria mais concluída
  const completedCategoryCounts = {};
  tasks.forEach(t => {
    if (t.completed && !t.deletedAt && !t.deleted_at && t.category) {
      completedCategoryCounts[t.category] = (completedCategoryCounts[t.category] || 0) + 1;
    }
  });
  let mostCompletedCategory = 'Nenhuma';
  let maxCompletedCatCount = 0;
  Object.entries(completedCategoryCounts).forEach(([cat, count]) => {
    if (count > maxCompletedCatCount) {
      maxCompletedCatCount = count;
      mostCompletedCategory = cat;
    }
  });

  const insightCompletedCategory = maxCompletedCatCount > 0
    ? `Sua categoria mais concluída é ${mostCompletedCategory} (${maxCompletedCatCount} tarefas finalizadas). Ótimo progresso nessa área.`
    : `Comece a concluir tarefas em categorias variadas para ver qual área da sua vida se move mais rápido.`;

  // 7c. Categoria mais procrastinada
  const activeCategoryCounts = {};
  tasks.forEach(t => {
    if (!t.completed && !t.deletedAt && !t.deleted_at && t.category) {
      activeCategoryCounts[t.category] = (activeCategoryCounts[t.category] || 0) + 1;
    }
  });
  let mostProcrastinatedCategory = 'Nenhuma';
  let maxActiveCatCount = 0;
  Object.entries(activeCategoryCounts).forEach(([cat, count]) => {
    if (count > maxActiveCatCount) {
      maxActiveCatCount = count;
      mostProcrastinatedCategory = cat;
    }
  });

  const insightProcrastinatedCategory = maxActiveCatCount > 0
    ? `A categoria ${mostProcrastinatedCategory} é a mais procrastinada no momento (${maxActiveCatCount} pendências). Dedique seu próximo foco a ela.`
    : `Parabéns! Nenhuma categoria específica está acumulando tarefas pendentes no momento.`;

  // 7d. Horas economizadas
  const hoursSaved = metrics.hoursSaved;
  
  const insightHoursSaved = `Você economizou aproximadamente ${hoursSaved.toFixed(1)} horas esta semana com sessões de foco Pomodoro e conclusão de objetivos e tarefas.`;

  // 8. Geração de Textos com base no Tom de Voz e Concordância Gramatical
  let mainGreeting = `Olá, ${userName}! Sou seu mentor de produtividade.`;
  let feedbackParagraph = '';
  let suggestionText = '';

  const taskCountText = completedRecentTasks.length === 1 
    ? `Você concluiu apenas uma tarefa esta semana.`
    : `Você concluiu ${completedRecentTasks.length} tarefas esta semana.`;

  const pendingCountText = pendingTasksCount === 1
    ? `Atualmente, há uma tarefa pendente na fila.`
    : `Atualmente, há ${pendingTasksCount} tarefas pendentes na fila.`;

  const habitsCountText = activeHabitsCount === 0
    ? `Nenhum hábito cadastrado para hoje.`
    : pendingHabitsTodayCount === 0
    ? `Todos os seus hábitos de hoje já foram concluídos! Sensacional!`
    : pendingHabitsTodayCount === 1
    ? `Resta apenas 1 hábito pendente para ser realizado hoje.`
    : `Restam ${pendingHabitsTodayCount} hábitos pendentes para você concluir hoje.`;

  // Respeitar pontuação de consistência inteligente
  let consistencyText = '';
  if (consistencyScore >= 90) {
    consistencyText = `Sua consistência está excelente, em ${consistencyScore}%.`;
  } else if (consistencyScore >= 70) {
    consistencyText = `Sua consistência está boa, em ${consistencyScore}%.`;
  } else {
    consistencyText = `Sua consistência está em ${consistencyScore}%. Retomar seus hábitos hoje impedirá que perca o ritmo acumulado.`;
  }

  feedbackParagraph = `${taskCountText} ${pendingCountText} ${habitsCountText} ${consistencyText}`;

  const urgentInfo = getMostUrgentTask();

  if (activeTone === 'motivator') {
    mainGreeting = `Olá, ${userName}! Que alegria acompanhar sua jornada esta semana.`;
    if (urgentInfo) {
      if (urgentInfo.type === 'overdue') {
        suggestionText = `Atenção: Você tem a tarefa atrasada "${urgentInfo.task.title}". Que tal começar por ela hoje? Dedicar apenas 15 minutos ajudará a recuperar seu ritmo e aliviar a pressão!`;
      } else if (urgentInfo.type === 'today') {
        suggestionText = `Foque na tarefa planejada para hoje: "${urgentInfo.task.title}". Dar esse passo agora manterá seu planejamento semanal no trilho!`;
      } else {
        suggestionText = `Que tal adiantar a tarefa "${urgentInfo.task.title}"? Dar o primeiro passo hoje aumentará sua confiança para a semana!`;
      }
    } else {
      suggestionText = goalTitle 
        ? `Abra o objetivo ${goalTitle} e conclua apenas uma pequena tarefa hoje. Mesmo 15 minutos já ajudam a recuperar o ritmo e impulsionar sua confiança!`
        : `Escolha uma tarefa importante na sua lista e conclua hoje. Mesmo 15 minutos já ajudam a recuperar o ritmo e impulsionar sua confiança!`;
    }
  } else if (activeTone === 'analytical') {
    mainGreeting = `Olá, ${userName}. Vamos analisar seus padrões de produtividade desta semana:`;
    feedbackParagraph = `${feedbackParagraph} Identifiquei que manter uma rotina consistente evita o acúmulo de tarefas e ajuda a manter a mente tranquila.`;
    if (urgentInfo) {
      if (urgentInfo.type === 'overdue') {
        suggestionText = `Análise acionável: Identifiquei ${urgentInfo.count} tarefa(s) atrasada(s), sendo "${urgentInfo.task.title}" a principal pendência. Dedique seu próximo bloco de foco a ela para evitar estresse acumulado.`;
      } else if (urgentInfo.type === 'today') {
        suggestionText = `Análise acionável: A tarefa "${urgentInfo.task.title}" está agendada para hoje. Executá-la no seu melhor período produtivo otimizará seu rendimento diário.`;
      } else {
        suggestionText = `Análise acionável: Sua lista diária está livre. Dedique tempo para planejar ou adiantar "${urgentInfo.task.title}" para manter seu ritmo de evolução constante.`;
      }
    } else {
      suggestionText = goalTitle
        ? `Análise acionável: Dedique um bloco de tempo exclusivo para o objetivo ${goalTitle}. Resolver uma pendência simples dele hoje melhorará sua tendência da próxima semana.`
        : `Análise acionável: Dedique um bloco de tempo exclusivo para as tarefas gerais pendentes hoje. Concluir um item simples evitará acúmulo de pendências.`;
    }
  } else { // challenging
    mainGreeting = `Olá, ${userName}. Pronto para elevar seu nível de foco hoje?`;
    feedbackParagraph = `${feedbackParagraph} O progresso não acontece por acaso, ele exige atitude diária.`;
    if (urgentInfo) {
      if (urgentInfo.type === 'overdue') {
        suggestionText = `Desafio do dia: Você permitiu que a tarefa "${urgentInfo.task.title}" ficasse atrasada. Quebre a inércia agora e conclua esse item nos próximos 25 minutos!`;
      } else if (urgentInfo.type === 'today') {
        suggestionText = `Desafio do dia: Acesse sua lista e conclua a tarefa de hoje "${urgentInfo.task.title}" imediatamente. Sem desculpas para procrastinar!`;
      } else {
        suggestionText = `Desafio do dia: Vá além do planejado e adiante a tarefa "${urgentInfo.task.title}". Eleve sua barra de produtividade hoje!`;
      }
    } else {
      suggestionText = goalTitle
        ? `Desafio do dia: Acesse o objetivo ${goalTitle} agora e conclua apenas uma tarefa de 15 minutos. Quebre a inércia imediatamente!`
        : `Desafio do dia: Acesse sua lista de tarefas agora e conclua apenas um item de 15 minutos. Quebre a inércia imediatamente!`;
    }
  }

  // 9. Formatação final da mensagem em markdown (Limpando asteriscos)
  const rawMessage = `### Nota da semana: ${weeklyScore}/10
 
${feedbackParagraph}
 
Tendência Atual:
${trendIndicator}
 
Insights do Mentor:
- ${insightDayAndTime}
- ${insightCompletedCategory}
- ${insightProcrastinatedCategory}
- ${insightHoursSaved}
 
Recomendação Prática:
${suggestionText}`;

  // Remoção absoluta de quaisquer asteriscos (simples ou duplos)
  const cleanMessage = rawMessage.replace(/\*/g, '');

  return {
    isPro,
    greeting: mainGreeting.replace(/\*/g, ''),
    message: cleanMessage,
    stats: {
      weeklyScore,
      completedTasks: completedRecentTasks.length,
      trend: trendIndicator.replace(/\*/g, ''),
      suggestion: suggestionText.replace(/\*/g, ''),
      tone: activeTone
    }
  };
}
