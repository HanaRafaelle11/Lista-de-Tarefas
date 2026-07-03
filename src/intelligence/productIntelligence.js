/**
 * productIntelligence.js — Motor de Inteligência de Produto (Preditivo)
 *
 * Analisa logs de eventos e tarefas para extrair insights preditivos:
 * - Churn Risk (Probabilidade do usuário abandonar o app/fluxo)
 * - Hábitos Emergentes (Sugere transformar tarefas recorrentes em Hábitos estruturados)
 * - Padrões temporais de conclusão (Dias/períodos de maior sucesso)
 */

export function generateInsights(tasks = [], events = []) {
  const insights = [];

  const completed = tasks.filter(t => t.completed);
  const pending = tasks.filter(t => !t.completed);
  const now = Date.now();

  if (completed.length < 7) {
    return [{
      type: 'info',
      emoji: 'chart',
      confidence: 1.0,
      confidenceLevel: 'alta',
      sampleSize: tasks.length || 1,
      timeRangeWeeks: 1,
      estimatedAccuracy: 100,
      message: 'Ainda estamos aprendendo sobre sua rotina.',
      action: 'tasks'
    }];
  }

  // ─── 1. Detecção de Churn Preditivo (Risco de Inatividade) ───────────────────
  // Verifica o tempo desde a última conclusão de tarefa
  let lastCompletedTime = 0;
  completed.forEach(t => {
    const time = new Date(t.completedAt || t.dueDate || t.createdAt).getTime();
    if (time > lastCompletedTime) lastCompletedTime = time;
  });

  const daysSinceLastCompletion = lastCompletedTime > 0 
    ? (now - lastCompletedTime) / (1000 * 60 * 60 * 24) 
    : Infinity;

  // Risco 1: Inatividade > 5 dias
  if (daysSinceLastCompletion > 5 && daysSinceLastCompletion !== Infinity) {
    insights.push({
      type: "risk",
      emoji: "warning",
      confidence: 0.85,
      message: `Detectamos inatividade superior a 5 dias. Que tal concluir uma tarefa simples hoje para recuperar o ritmo?`,
      action: "tasks"
    });
  }

  // Risco 2: queda > 40% na conclusão semanal de tarefas
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

  const completedThisWeek = completed.filter(t => {
    const time = new Date(t.completedAt || t.dueDate || t.createdAt).getTime();
    return time >= oneWeekAgo;
  }).length;

  const completedLastWeek = completed.filter(t => {
    const time = new Date(t.completedAt || t.dueDate || t.createdAt).getTime();
    return time >= twoWeeksAgo && time < oneWeekAgo;
  }).length;

  if (completedLastWeek >= 3) {
    const pctDrop = (completedLastWeek - completedThisWeek) / completedLastWeek;
    if (pctDrop > 0.40) {
      insights.push({
        type: "risk",
        emoji: "warning",
        confidence: 0.85,
        message: `Sua taxa de conclusão de tarefas caiu ${Math.round(pctDrop * 100)}% esta semana em comparação com a semana anterior. Que tal retomar o foco?`,
        action: "tasks"
      });
    }
  }

  // ─── 2. Detecção de Hábitos Emergentes (Tarefa recorrente não-oficializada) ──
  // Agrupa tarefas concluídas por título (ignora maiúsculas/minúsculas e limpa espaços)
  const titleCounts = {};
  completed.forEach(t => {
    const key = t.title.toLowerCase().trim();
    if (key.length > 3) {
      titleCounts[key] = (titleCounts[key] || 0) + 1;
    }
  });

  let emergenteTitle = null;
  let emergenteCount = 0;
  for (const [title, count] of Object.entries(titleCounts)) {
    if (count >= 3 && count > emergenteCount) {
      emergenteCount = count;
      emergenteTitle = title;
    }
  }

  if (emergenteTitle) {
    insights.push({
      type: 'habit',
      emoji: 'fire',
      confidence: 0.90,
      message: `Você completou a tarefa "${emergenteTitle}" ${emergenteCount} vezes recentemente. Que tal transformá-la em um Hábito diário oficial para ganhar mais pontos?`,
      action: 'habits'
    });
  }

  // ─── 3. Análise de Correlação Temporal (Melhor período de foco) ─────────────
  // Analisa o horário de criação/conclusão de tarefas se disponível
  let morningCompleted = 0;
  let afternoonCompleted = 0;
  let nightCompleted = 0;

  completed.forEach(t => {
    if (!t.completedAt) return;
    const hour = new Date(t.completedAt).getHours();
    if (hour >= 5 && hour < 12) morningCompleted++;
    else if (hour >= 12 && hour < 18) afternoonCompleted++;
    else nightCompleted++;
  });

  const totalHourStats = morningCompleted + afternoonCompleted + nightCompleted;
  if (totalHourStats >= 4) {
    let bestPeriod = '';
    let bestCount = 0;
    if (morningCompleted > bestCount) { bestCount = morningCompleted; bestPeriod = 'Manhã'; }
    if (afternoonCompleted > bestCount) { bestCount = afternoonCompleted; bestPeriod = 'Tarde'; }
    if (nightCompleted > bestCount) { bestCount = nightCompleted; bestPeriod = 'Noite'; }

    const confidence = Math.round((bestCount / totalHourStats) * 100) / 100;
    if (confidence >= 0.5) {
      insights.push({
        type: 'achievement',
        emoji: 'bolt',
        confidence,
        message: `Foco Máximo: Você é mais produtivo no período da ${bestPeriod} (${Math.round(confidence * 100)}% das suas conclusões). Agende suas tarefas difíceis para este horário!`
      });
    }
  }

  // ─── 4. Análise de Dia de Semana Mais e Menos Produtivo ───────────────────────
  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const tasksScheduledPerDay = Array(7).fill(0);
  const tasksCompletedPerDay = Array(7).fill(0);

  tasks.forEach(t => {
    if (!t.dueDate) return;
    const dateStr = t.dueDate + 'T12:00:00';
    const day = new Date(dateStr).getDay();
    tasksScheduledPerDay[day]++;
    if (t.completed) {
      tasksCompletedPerDay[day]++;
    }
  });

  // Procurar melhor e pior dia com base em uma amostragem mínima de 5 tarefas
  let bestDayIdx = -1;
  let bestRate = -1;
  let worstDayIdx = -1;
  let worstCount = 0;

  for (let i = 0; i < 7; i++) {
    const totalScheduled = tasksScheduledPerDay[i];
    if (totalScheduled >= 5) {
      const rate = tasksCompletedPerDay[i] / totalScheduled;
      if (rate > bestRate) {
        bestRate = rate;
        bestDayIdx = i;
      }
    }
  }

  if (completed.length > 0) {
    const lateOrOverduePerDay = Array(7).fill(0);
    tasks.forEach(t => {
      const isOverdue = !t.completed && t.dueDate && new Date(t.dueDate + 'T23:59:59') < new Date();
      let isLate = false;
      if (t.completed && t.dueDate && t.completedAt) {
        const complDate = new Date(t.completedAt.split('T')[0] + 'T12:00:00');
        const dueDate = new Date(t.dueDate + 'T12:00:00');
        if (complDate > dueDate) {
          isLate = true;
        }
      }
      if ((isOverdue || isLate) && t.dueDate) {
        const day = new Date(t.dueDate + 'T12:00:00').getDay();
        lateOrOverduePerDay[day]++;
      }
    });

    for (let i = 0; i < 7; i++) {
      if (lateOrOverduePerDay[i] > worstCount && tasksScheduledPerDay[i] >= 3) {
        worstCount = lateOrOverduePerDay[i];
        worstDayIdx = i;
      }
    }
  }

  // Se houver um melhor dia válido
  if (bestDayIdx !== -1 && bestRate >= 0.6) {
    insights.push({
      type: "achievement",
      emoji: "calendar",
      confidence: bestRate,
      message: `Dia de Foco: ${dayNames[bestDayIdx]} é seu dia mais produtivo, com uma taxa de conclusão de ${Math.round(bestRate * 100)}% (de ${tasksScheduledPerDay[bestDayIdx]} tarefas).`,
      sampleSize: tasksScheduledPerDay[bestDayIdx]
    });
  }

  // Se houver um pior dia válido
  if (worstDayIdx !== -1 && worstDayIdx !== bestDayIdx) {
    const totalScheduled = tasksScheduledPerDay[worstDayIdx];
    const failRate = totalScheduled > 0 ? worstCount / totalScheduled : 0;
    insights.push({
      type: "risk",
      emoji: "chart",
      confidence: failRate > 1 ? 1 : failRate,
      message: `Ritmo de Atenção: ${dayNames[worstDayIdx]} é o dia com mais tarefas atrasadas ou pendentes (${worstCount} de ${totalScheduled} tarefas). Tente programar menos atividades para este dia.`,
      sampleSize: totalScheduled
    });
  }

  // ─── 5. Padrões de consistência por Categoria ───────────────────────────────
  const catTotal = {};
  const catDone = {};
  tasks.forEach(t => {
    if (t.category) {
      catTotal[t.category] = (catTotal[t.category] || 0) + 1;
      if (t.completed) {
        catDone[t.category] = (catDone[t.category] || 0) + 1;
      }
    }
  });

  let bestCat = null;
  let bestPct = 0;
  for (const cat of Object.keys(catTotal)) {
    const pct = catDone[cat] / catTotal[cat];
    if (pct > bestPct && catTotal[cat] >= 3) {
      bestPct = pct;
      bestCat = cat;
    }
  }

  if (bestCat && bestPct >= 0.75) {
    insights.push({
      type: 'achievement',
      emoji: 'trophy',
      confidence: bestPct,
      message: `Alta Performance na categoria "${bestCat}": você conclui ${Math.round(bestPct * 100)}% das tarefas propostas. Excelente trabalho!`,
      sampleSize: catTotal[bestCat]
    });
  }

  // Fallback se nenhum insight avançado foi gerado (Coletando Dados / Estado Inicial)
  if (insights.length === 0) {
    insights.push({
      type: 'suggestion',
      emoji: 'bulb',
      confidence: 0.60,
      message: 'Estamos analisando seus padrões. Organizar suas tarefas por prioridade (Alta, Média, Baixa) ajuda a reduzir a fadiga de decisão no início do dia.',
      sampleSize: tasks.length || 1
    });
  }

  const allTaskDates = tasks.map(t => new Date(t.completedAt || t.dueDate || t.createdAt).getTime()).filter(Boolean);
  const timeRangeWeeks = allTaskDates.length > 1
    ? Math.max(1, Math.ceil((Math.max(...allTaskDates) - Math.min(...allTaskDates)) / (7 * 24 * 60 * 60 * 1000)))
    : 1;

  return insights.map(ins => {
    let sampleSize = ins.sampleSize;
    if (!sampleSize) {
      if (ins.type === 'risk') {
        sampleSize = completed.length;
      } else if (ins.type === 'habit') {
        sampleSize = emergenteCount || completed.length;
      } else if (ins.message?.includes('Foco Máximo')) {
        sampleSize = totalHourStats;
      } else if (ins.message?.includes('Dia de Foco')) {
        sampleSize = ins.sampleSize || 1;
      } else if (ins.message?.includes('Performance')) {
        sampleSize = bestCat ? catTotal[bestCat] : completed.length;
      } else {
        sampleSize = completed.length || tasks.length || 1;
      }
    }

    const confidence = ins.confidence ?? 0.6;
    const confidenceLevel = confidence >= 0.8 ? 'alta' : confidence >= 0.5 ? 'média' : 'baixa';
    const estimatedAccuracy = Math.round(confidence * 100);

    return {
      ...ins,
      confidenceLevel,
      sampleSize,
      timeRangeWeeks,
      estimatedAccuracy
    };
  });
}
