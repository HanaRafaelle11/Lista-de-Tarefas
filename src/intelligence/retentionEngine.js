/**
 * retentionEngine.js — Gatilhos de engajamento e loops de retorno (v2.0)
 *
 * Gera sugestões ativas baseadas no ciclo de vida e no comportamento do usuário
 * para fechar o loop de retenção e motivar ações rápidas na UI.
 */

export function getEngagementSuggestions(userState = {}, tasks = [], onboardingCompleted = false) {
  const suggestions = [];
  const pending = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);

  // 1. Loop para Usuários em Risco ('at_risk' ou 'churned' recente)
  if (userState.stage === 'at_risk' || userState.stage === 'churned') {
    // Retenção ativa: simplificar a vida do usuário para reengajá-lo
    suggestions.push({
      id: 'churn_reengage_loop',
      type: 'reengage',
      title: 'Simplifique seu dia',
      message: 'Notamos que você está afastado. Que tal criar ou concluir uma única tarefa rápida hoje para reativar seu ritmo?',
      ctaText: 'Retomar Foco',
      actionTab: 'tasks',
      autoTrigger: 'focus_simplification'
    });
  }

  // 2. Loop de Onboarding (Usuários novos)
  if (!onboardingCompleted || userState.stage === 'new') {
    const step = userState.onboarding_step || 1;
    suggestions.push({
      id: 'onboarding_guided_loop',
      type: 'onboarding',
      title: `Jornada MyFlowDay (Passo ${step})`,
      message: step === 1 
        ? 'Defina seu primeiro grande Objetivo para conectar suas tarefas a metas maiores.'
        : 'Crie suas primeiras tarefas de foco diário para iniciar sua rotina.',
      ctaText: step === 1 ? 'Criar Primeiro Objetivo' : 'Começar Agora',
      actionTab: step === 1 ? 'goals' : 'tasks',
      autoTrigger: 'open_onboarding_helper'
    });
  }

  // 3. Loop de Hábitos (Usuários ativados que precisam consistência)
  if (userState.stage === 'activated' && completed.length >= 3) {
     suggestions.push({
       id: 'habit_reinforcement_loop',
       type: 'habit',
       title: 'Automatize sua Rotina',
       message: 'Você já concluiu tarefas importantes! Oficialize suas rotinas como Hábitos para rastreamento contínuo.',
       ctaText: 'Configurar Hábito',
       actionTab: 'goals'
     });
   }

  // 4. Loop de Engajamento Alto (Reforço positivo para streaks antigos)
  if (userState.stage === 'engaged') {
    suggestions.push({
      id: 'engagement_streak_loop',
      type: 'celebrate',
      title: 'Produtividade em Alta!',
      message: 'Seu foco está incrível nesta semana. Proteja seu tempo livre hoje para recarregar as energias.',
      ctaText: 'Ver Conquistas',
      actionTab: 'analytics'
    });
  }

  // 5. Loop de Estagnação (Muitas pendentes acumuladas)
  if (pending.length >= 7 && completed.length <= 1) {
    suggestions.push({
      id: 'stagnation_loop',
      type: 'action',
      title: 'Alivie sua carga',
      message: 'Você tem muitas tarefas acumuladas. Que tal adiar as menos importantes e focar em apenas uma?',
      ctaText: 'Organizar Tarefas',
      actionTab: 'tasks'
    });
  }

  const VALID_TABS = ['home', 'goals', 'tasks', 'focus', 'analytics', 'performance', 'profile', 'admin', 'settings'];
  return suggestions.map(s => {
    if (s.actionTab && !VALID_TABS.includes(s.actionTab)) {
      console.warn(`[retentionEngine] Aba de ação inválida detectada: "${s.actionTab}". Corrigido para "home".`);
      s.actionTab = 'home';
    }
    return s;
  });
}
