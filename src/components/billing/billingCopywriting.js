/**
 * Sistema Central de Redação e Copywriting de Billing (Human-Centric Copy)
 * 
 * Centraliza 100% das mensagens exibidas ao usuário final.
 * Garante linguagem humana, empática, clara e totalmente livre de termos técnicos.
 */

export const billingCopy = {
  status: {
    active: 'Assinatura Ativa',
    pending: 'Aguardando Confirmação',
    failed: 'Pagamento Não Concluído',
    canceled: 'Assinatura Cancelada',
    processing: 'Em Processamento',
    paid: 'Pago'
  },
  
  statusDescription: {
    active: 'Seu acesso Premium está liberado e funcionando perfeitamente.',
    pending: 'Estamos processando seu pagamento junto à sua instituição financeira.',
    failed: 'Não conseguimos aprovar a última cobrança. Por favor, verifique seus dados.',
    canceled: 'Sua assinatura foi cancelada. Você ainda tem acesso até o fim do período atual.',
    processing: 'Seu pagamento está sendo validado com segurança.'
  },

  overview: {
    title: 'Minha Assinatura e Cobrança',
    subtitle: 'Gerencie seu plano, histórico de pagamentos e forma de cobrança.',
    currentPlan: 'Seu Plano Atual',
    nextBillingDate: 'Próxima Renovação',
    recurringAmount: 'Valor Recorrente',
    paymentMethod: 'Forma de Pagamento',
    manageButton: 'Gerenciar Assinatura',
    upgradeButton: 'Fazer Upgrade para Premium'
  },

  history: {
    title: 'Histórico de Pagamentos',
    subtitle: 'Confira todas as suas cobranças e comprovantes anteriores.',
    empty: 'Você ainda não possui pagamentos registrados.',
    viewDetails: 'Ver Detalhes'
  },

  explanation: {
    title: 'Por que fui cobrado?',
    renewsIn: (days) => `Sua próxima cobrança será realizada em ${days} dia(s).`,
    reasons: {
      subscription_renewed: 'Esta cobrança é referente à renovação mensal da sua assinatura Premium.',
      subscription_activated: 'Cobrança referente à primeira ativação do seu plano Premium.',
      payment_approved: 'Pagamento confirmado com sucesso referente ao seu período de uso.',
      default: 'Cobrança referente ao uso contínuo da plataforma Flowday.'
    }
  },

  support: {
    title: 'Precisa de ajuda com alguma cobrança?',
    description: 'Nossa equipe está pronta para esclarecer qualquer dúvida sobre seus pagamentos.',
    talkToSupport: 'Falar com Suporte',
    reportIssue: 'Reportar um Problema'
  }
};
