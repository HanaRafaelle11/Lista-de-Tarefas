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

  if (tasks.length === 0) {
    return [{
      type: 'suggestion',
      emoji: '🌱',
      confidence: 1.0,
      message: 'Crie sua primeira tarefa! Dividir metas grandes em pequenos passos é a chave da produtividade consistente.',
      action: 'tasks'
    }];
  }

  const completed = tasks.filter(t => t.completed);
  const pending = tasks.filter(t => !t.completed);
  const now = Date.now();

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
      emoji: "⚠️",
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
        emoji: "⚠️",
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
      emoji: '🔥',
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
        emoji: '⚡',
        confidence,
        message: `Foco Máximo: Você é mais produtivo no período da ${bestPeriod} (${Math.round(confidence * 100)}% das suas conclusões). Agende suas tarefas difíceis para este horário!`
      });
    }
  }

  // ─── 4. Análise de Dia de Semana Mais Produtivo ───────────────────────────────
  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const dayCounts = Array(7).fill(0);
  completed.forEach(t => {
    if (!t.completedAt) return;
    const day = new Date(t.completedAt).getDay();
    dayCounts[day]++;
  });

  const totalDayStats = dayCounts.reduce((a, b) => a + b, 0);
  if (totalDayStats >= 4) {
    let bestDayIdx = 0;
    let maxDayCount = 0;
    for (let i = 0; i < 7; i++) {
      if (dayCounts[i] > maxDayCount) {
        maxDayCount = dayCounts[i];
        bestDayIdx = i;
      }
    }
    const dayConfidence = Math.round((maxDayCount / totalDayStats) * 100) / 100;
    if (dayConfidence >= 0.3) {
      insights.push({
        type: "achievement",
        emoji: "📅",
        confidence: dayConfidence,
        message: `Dia de Foco: ${dayNames[bestDayIdx]} é seu dia mais produtivo, concentrando ${Math.round(dayConfidence * 100)}% de suas conclusões.`
      });
    }
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
      emoji: '🏆',
      confidence: bestPct,
      message: `Alta Performance na categoria "${bestCat}": você conclui ${Math.round(bestPct * 100)}% das tarefas propostas. Excelente trabalho!`
    });
  }

  // Fallback se nenhum insight avançado foi gerado
  if (insights.length === 0) {
    insights.push({
      type: 'suggestion',
      emoji: '💡',
      confidence: 0.60,
      message: 'Organizar suas tarefas por prioridade (Alta, Média, Baixa) ajuda a reduzir a fadiga de decisão no início do dia.'
    });
  }

  return insights;
}
