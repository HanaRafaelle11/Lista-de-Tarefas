/**
 * productIntelligence.js — Análise comportamental e insights
 *
 * Analisa o histórico de tarefas e eventos locais/remotos do usuário
 * para gerar dicas personalizadas, alertar sobre comportamentos
 * de procrastinação e parabenizar sequências ativas de produtividade.
 */

export function generateInsights(tasks = [], events = []) {
  const insights = [];
  if (tasks.length === 0) {
    insights.push({
      type: 'tip',
      emoji: '💡',
      message: 'Comece criando a sua primeira tarefa! Dividir metas grandes em pequenos passos é o segredo do foco.'
    });
    return insights;
  }

  const completed = tasks.filter(t => t.completed);
  const pending = tasks.filter(t => !t.completed);
  const completionRate = tasks.length > 0 ? (completed.length / tasks.length) : 0;

  // Insight 1: Acúmulo de tarefas pendentes vs concluídas (Procrastinação/Stagnation)
  if (pending.length > 8 && completionRate < 0.3) {
    insights.push({
      type: 'pattern',
      emoji: '📊',
      message: `Você acumulou ${pending.length} tarefas pendentes com apenas ${Math.round(completionRate * 100)}% de conclusão. Que tal arquivar ou priorizar apenas 3 tarefas hoje?`
    });
  }

  // Insight 2: Taxa de conclusão excelente
  if (tasks.length >= 5 && completionRate >= 0.75) {
    insights.push({
      type: 'celebrate',
      emoji: '⭐',
      message: `Incrível! Sua taxa de conclusão está em ${Math.round(completionRate * 100)}%. Você está mandando super bem no foco semanal.`
    });
  }

  // Insight 3: Análise de categoria de maior sucesso
  const categoryStats = {};
  for (const t of completed) {
    if (t.category) {
      categoryStats[t.category] = (categoryStats[t.category] || 0) + 1;
    }
  }
  let bestCategory = null;
  let bestCount = 0;
  for (const [cat, count] of Object.entries(categoryStats)) {
    if (count > bestCount) {
      bestCount = count;
      bestCategory = cat;
    }
  }
  if (bestCategory && bestCount >= 3) {
    insights.push({
      type: 'tip',
      emoji: '🏷️',
      message: `Você é muito produtivo na categoria "${bestCategory}" (${bestCount} tarefas concluídas). Use isso a seu favor!`
    });
  }

  // Insight 4: Tarefas sem data de entrega
  const noDueDate = pending.filter(t => !t.dueDate);
  if (noDueDate.length >= 5) {
    insights.push({
      type: 'tip',
      emoji: '📅',
      message: `Você tem ${noDueDate.length} tarefas sem prazo definido. Definir prazos curtos ativa o cérebro e reduz a procrastinação.`
    });
  }

  // Fallback se nenhum insight avançado foi ativado
  if (insights.length === 0) {
    insights.push({
      type: 'tip',
      emoji: '💡',
      message: 'Revise suas tarefas diariamente pelas manhãs para definir o seu foco do dia antes de iniciar as atividades.'
    });
  }

  return insights;
}
