/**
 * coachEngine.js — Mecanismo do Coach Inteligente MyFlowDay
 *
 * Gera orientações personalizadas, explica estatísticas de forma humana,
 * adiciona pontuações semanais, analisa tendências e varia o tom de voz 
 * para guiar o usuário como um verdadeiro mentor de produtividade.
 */

import { calcStreak } from '../hooks/useAchievements';

export function generateCoachMessage({
  tasks = [],
  goals = [],
  goalTasks = [],
  habitsManager = {},
  consistencyScore = 0,
  currentUser = null,
  userProfile = null,
  isPro = false,
  userState = null
}) {
  const now = new Date();
  const userName = userProfile?.nickname || userProfile?.name || currentUser?.user_metadata?.name || currentUser?.name || 'Tester';

  const allActiveTasks = tasks.filter(t => !t.deletedAt && !t.deleted_at);
  const activeGoals = goals.filter(g => g.status === 'active' && !g.deletedAt && !g.deleted_at);

  // 1. Tratamento de Workspace Vazio
  if (allActiveTasks.length === 0 && activeGoals.length === 0) {
    const formattedMessage = `### Nota da semana: --/10

Você não possui nenhuma tarefa ou objetivo ativo no momento.

**Tendência Atual:**
📉 Sem dados de uso.

**Insights do Mentor:**
* 💡 Crie seus primeiros objetivos ou tarefas para começar a organizar sua rotina.
* 💡 Mantenha a consistência diária para ver insights detalhados sobre seu ritmo.

**Recomendação Prática:**
👉 Crie objetivos ou tarefas e comece a executar para receber conselhos personalizados do seu Mentor.`;

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

  // 2. Identificar intervalo de tempo dos últimos 7 dias
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const completedRecentTasks = tasks.filter(t => 
    t.completed && 
    !t.deletedAt && !t.deleted_at &&
    (t.completedAt ? new Date(t.completedAt) >= sevenDaysAgo : true)
  );

  const totalRecentTasks = tasks.filter(t => 
    !t.deletedAt && !t.deleted_at &&
    (t.createdAt ? new Date(t.createdAt) >= sevenDaysAgo : true)
  ).length;

  const activeHabitIds = (habitsManager?.habits || []).map(h => h.id);
  const recentHabitsCount = habitsManager?.habitLogs
    ? habitsManager.habitLogs.filter(l => activeHabitIds.includes(l.habit_id) && new Date(l.completed_date) >= sevenDaysAgo).length
    : 0;

  const currentStreak = calcStreak(tasks) || 0;

  // 3. Cálculo da Nota da Semana (1.0 a 10.0)
  const completionRatio = totalRecentTasks > 0 ? completedRecentTasks.length / totalRecentTasks : 0;
  let baseScore = 5.0; // Pontuação inicial padrão por uso da plataforma
  
  if (totalRecentTasks > 0) {
    baseScore = completionRatio * 8.0 + 1.0;
  } else if (allActiveTasks.length > 0) {
    // Se tem tarefas mas nenhuma criada nos últimos 7 dias
    baseScore = 3.0;
  }
  
  const streakBonus = Math.min(1.0, currentStreak * 0.15);
  const habitsBonus = Math.min(1.0, recentHabitsCount * 0.20);
  
  let finalScore = baseScore + streakBonus + habitsBonus;
  // Penalidade se houver objetivos pendentes sem nenhuma tarefa realizada
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
  let trendIndicator = '📈 Você está em uma fase de recuperação.';
  if (currentStreak >= 5) {
    trendIndicator = `🔥 Você manteve consistência por ${currentStreak} dias seguidos.`;
  } else if (completedRecentTasks.length < 2) {
    trendIndicator = '📉 Seu ritmo caiu nas últimas duas semanas.';
  }

  // 7. Insights Ocultos baseados nos dados reais do usuário
  const dayCounts = Array(7).fill(0);
  tasks.forEach(t => {
    const dateStr = t.completedAt || t.dueDate || t.createdAt;
    if (t.completed && !t.deletedAt && !t.deleted_at && dateStr) {
      const day = new Date(dateStr).getDay();
      dayCounts[day]++;
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
    ? `Sua categoria mais concluída é **${mostCompletedCategory}** (${maxCompletedCatCount} tarefas finalizadas). Bom trabalho!`
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
    ? `A categoria **${mostProcrastinatedCategory}** é a mais procrastinada no momento (${maxActiveCatCount} pendências). Dedique seu próximo foco a ela.`
    : `Parabéns! Nenhuma categoria específica está acumulando tarefas pendentes no momento.`;

  // 7d. Horas economizadas
  const completedGoalsCount = goals.filter(g => g.status === 'completed' && !g.deletedAt && !g.deleted_at).length;
  const focusCount = userState?.stats?.sessions || 0;
  const finalFocusCount = (currentUser?.isDemo && focusCount === 0) ? 8 : focusCount;
  const hoursSaved = (finalFocusCount * 0.5) + (completedRecentTasks.length * 0.25) + (completedGoalsCount * 2.0);
  
  const insightHoursSaved = `Você economizou aproximadamente **${hoursSaved.toFixed(1)} horas** esta semana com sessões de foco Pomodoro e conclusão de objetivos/tarefas.`;

  // 8. Geração de Textos com base no Tom de Voz
  let mainGreeting = `Olá, ${userName}! Sou seu mentor de produtividade.`;
  let feedbackParagraph = '';
  let suggestionText = '';

  const taskCountText = completedRecentTasks.length === 1 
    ? `Você concluiu apenas 1 tarefa esta semana. Que tal escolher uma prioridade para amanhã e criar uma sequência de vitórias?`
    : `Você concluiu ${completedRecentTasks.length} tarefa${completedRecentTasks.length > 1 || completedRecentTasks.length === 0 ? 's' : ''} esta semana. Cada pequena vitória conta para aproximar você dos seus sonhos!`;

  const dynamicDrop = (consistencyScore < 85) 
    ? Math.max(3, Math.min(15, 100 - consistencyScore)) 
    : 6;

  const consistencyDropText = `Sua consistência caiu ${dynamicDrop}% em relação à semana passada. Retomar sua rotina hoje pode evitar que esse hábito seja perdido.`;

  if (activeTone === 'motivator') {
    mainGreeting = `Olá, ${userName}! ✨ Que alegria acompanhar sua jornada esta semana.`;
    feedbackParagraph = `${taskCountText}\n\n${consistencyDropText}`;
    suggestionText = goalTitle 
      ? `Abra o objetivo "${goalTitle}" e conclua apenas uma pequena tarefa hoje. Mesmo 15 minutos já ajudam a recuperar o ritmo e impulsionar sua confiança!`
      : `Escolha uma tarefa importante na sua lista e conclua hoje. Mesmo 15 minutos já ajudam a recuperar o ritmo e impulsionar sua confiança!`;
  } else if (activeTone === 'analytical') {
    mainGreeting = `Olá, ${userName}. Vamos analisar seus padrões de produtividade desta semana:`;
    feedbackParagraph = `${taskCountText}\n\n${consistencyDropText}\n\nIdentifiquei que manter uma rotina consistente evita o acúmulo de tarefas e ajuda a manter a mente tranquila.`;
    suggestionText = goalTitle
      ? `Análise acionável: Dedique um bloco de tempo exclusivo para o objetivo "${goalTitle}". Resolver uma pendência simples dele hoje melhorará sua tendência da próxima semana em até 40%.`
      : `Análise acionável: Dedique um bloco de tempo exclusivo para as tarefas gerais pendentes hoje. Concluir um item simples evitará acúmulo e melhorará sua tendência da próxima semana em até 40%.`;
  } else { // challenging
    mainGreeting = `Olá, ${userName}. Pronto para elevar seu nível de foco hoje?`;
    feedbackParagraph = `${taskCountText}\n\n${consistencyDropText}\n\nO progresso não acontece por acaso, ele exige atitude diária.`;
    suggestionText = goalTitle
      ? `Desafio do dia: Acesse o objetivo "${goalTitle}" agora e conclua apenas uma tarefa de 15 minutos. Quebre a inércia imediatamente!`
      : `Desafio do dia: Acesse sua lista de tarefas agora e conclua apenas um item de 15 minutos. Quebre a inércia imediatamente!`;
  }

  // 9. Formatação final da mensagem em markdown
  const formattedMessage = `### Nota da semana: ${weeklyScore}/10

${feedbackParagraph}

**Tendência Atual:**
${trendIndicator}

**Insights do Mentor:**
* 💡 ${insightDayAndTime}
* 💡 ${insightCompletedCategory}
* 💡 ${insightProcrastinatedCategory}
* 💡 ${insightHoursSaved}

**Recomendação Prática:**
👉 ${suggestionText}`;

  return {
    isPro,
    greeting: mainGreeting,
    message: formattedMessage,
    stats: {
      weeklyScore,
      completedTasks: completedRecentTasks.length,
      trend: trendIndicator,
      suggestion: suggestionText,
      tone: activeTone
    }
  };
}
