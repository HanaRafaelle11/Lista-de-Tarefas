/**
 * retentionEngine.js — Gatilhos de engajamento e loops de retorno
 *
 * Gera sugestões contextuais na UI para reter o usuário baseando-se
 * no seu progresso de onboarding, streak atual e estado comportamental.
 */

export function getEngagementSuggestions(userState = {}, tasks = [], onboardingCompleted = false) {
  const suggestions = [];

  // 1. Loop de onboarding (Novos usuários)
  if (!onboardingCompleted) {
    suggestions.push({
      id: 'onboarding_loop',
      type: 'onboarding',
      title: '🌱 Complete seu Onboarding',
      message: 'Aprenda a configurar seus primeiros hábitos e objetivos para extrair o máximo do Flowday.',
      ctaText: 'Ir para Onboarding',
      actionTab: 'home' // UI abre widget de onboarding
    });
  }

  // 2. Loop de estagnação (Sem vitória recente)
  const pending = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);
  
  if (completed.length === 0 && pending.length > 0) {
    suggestions.push({
      id: 'first_win_loop',
      type: 'action',
      title: '🎯 Sua primeira vitória',
      message: 'Escolha uma tarefa simples da sua lista hoje e marque como concluída para dar o primeiro passo!',
      ctaText: 'Ver tarefas',
      actionTab: 'tasks'
    });
  }

  // 3. Loop de hábitos (Usuários que ativaram mas não têm hábitos estruturados)
  if (userState.stage === 'activated' || (completed.length >= 3 && userState.stage === 'new')) {
    // Sugere criar um hábito para manter consistência diária
    suggestions.push({
      id: 'habit_loop',
      type: 'guide',
      title: '🔥 Construa Consistência',
      message: 'Tarefas avulsas funcionam, mas automatizar rotinas com Hábitos é o que gera mudança de longo prazo.',
      ctaText: 'Criar um Hábito',
      actionTab: 'habits'
    });
  }

  // 4. Loop de objetivos (Usuários engajados sem objetivos ativos)
  if (userState.stage === 'engaged' && tasks.length >= 10) {
    suggestions.push({
      id: 'goal_loop',
      type: 'guide',
      title: '🏆 Defina um Grande Objetivo',
      message: 'Conecte suas tarefas diárias a metas maiores. Crie um Objetivo e vincule tarefas a ele.',
      ctaText: 'Definir Objetivo',
      actionTab: 'goals'
    });
  }

  // 5. Card de reforço positivo para streaks ativos
  if (userState.days_since_active === 0 && completed.length >= 2) {
    suggestions.push({
      id: 'streak_celebrate',
      type: 'celebrate',
      title: '⚡ Sequência Ativa!',
      message: 'Você está no fluxo de produtividade hoje. Mantenha o ritmo e evite sobrecarregar o seu dia.',
      ctaText: null,
      actionTab: null
    });
  }

  return suggestions;
}
