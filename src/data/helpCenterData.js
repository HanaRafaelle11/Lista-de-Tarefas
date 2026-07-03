// Base de Dados Oficial da Central de Ajuda & FAQ do MyFlowDay
export const HELP_CATEGORIES = [
  { id: 'onboarding', title: 'Primeiros Passos', icon: 'Rocket' },
  { id: 'tasks', title: 'Tarefas', icon: 'CheckSquare' },
  { id: 'goals', title: 'Metas & Objetivos', icon: 'Target' },
  { id: 'habits', title: 'Hábitos & Streaks', icon: 'Flame' },
  { id: 'focus', title: 'Foco Pomodoro & Lo-Fi', icon: 'Clock' },
  { id: 'ai', title: 'IA (Coach MyFlowDay)', icon: 'Sparkles' },
  { id: 'gamification', title: 'Gamificação & Mascotes', icon: 'Award' },
  { id: 'billing', title: 'Assinaturas & Pagamentos', icon: 'CreditCard' },
  { id: 'account', title: 'Conta & Privacidade', icon: 'User' },
  { id: 'technical', title: 'PWA, Offline & Notificações', icon: 'Wifi' },
];

export const HELP_ARTICLES = [
  // PRIMEIROS PASSOS
  {
    id: 'create-account',
    categoryId: 'onboarding',
    title: 'Como criar sua conta no MyFlowDay',
    whatIs: 'O cadastro inicial que permite sincronizar seus dados em nuvem com total segurança.',
    purpose: 'Garante que suas tarefas, metas e históricos fiquem salvos e acessíveis em qualquer dispositivo.',
    howToAccess: 'Acesse a página inicial (myflowday.com.br) e clique em "Criar Conta Gratuita".',
    howToUse: 'Preencha seu Nome Completo, E-mail válido e crie uma Senha forte com no mínimo 6 caracteres.',
    fieldGuide: [
      { field: 'Nome Completo', tip: 'Informe como gosta de ser chamado. O Coach MyFlowDay usará este nome nas interações diárias.' },
      { field: 'E-mail', tip: 'Use seu e-mail principal para receber confirmações e links de recuperação de senha.' },
      { field: 'Senha', tip: 'Crie uma combinação com letras e números para maior segurança.' }
    ],
    examples: {
      bad: 'Nome: "User123" | Senha: "123"',
      good: 'Nome: "Hana Oliveira" | Senha: "FlowDay#2026!Secure"'
    },
    bestPractices: 'Guarde suas credenciais em um gerenciador de senhas confiável.',
    commonErrors: 'Digitar o e-mail com erro de grafia e não conseguir recuperar a senha posteriormente.',
    faq: 'Posso usar a mesma conta no computador e no celular? Sim! A sincronização é automática.'
  },
  {
    id: 'login-recovery',
    categoryId: 'onboarding',
    title: 'Como fazer login e redefinir sua senha',
    whatIs: 'O procedimento para acessar seu painel ou recuperar o acesso caso tenha esquecido a senha.',
    purpose: 'Protege seus dados e oferece um caminho seguro de autorrecuperação.',
    howToAccess: 'Na tela inicial, toque em "Já tenho uma conta" ou no botão "Entrar".',
    howToUse: 'Insira seu e-mail e senha cadastrados. Se esqueceu a senha, clique em "Esqueci minha senha" e siga as instruções enviadas para seu e-mail.',
    fieldGuide: [
      { field: 'E-mail cadastrado', tip: 'Digite o mesmo e-mail utilizado na criação da conta.' }
    ],
    examples: {
      bad: 'Tentar fazer login antes de confirmar a criação da conta.',
      good: 'Clicar no link de redefinição enviado para a sua caixa de entrada.'
    },
    bestPractices: 'Verifique sua caixa de Spam caso o e-mail de redefinição demore mais de 2 minutos.',
    commonErrors: 'Tentar redefinir a senha usando um e-mail diferente do cadastrado.',
    faq: 'O link de recuperação expira? Sim, por motivos de segurança o link é válido por 24 horas.'
  },

  // TAREFAS
  {
    id: 'tasks-create',
    categoryId: 'tasks',
    title: 'Como criar, priorizar e organizar suas tarefas',
    whatIs: 'O gerenciador de afazeres completo integrado à Matriz de Priorização Eisenhower.',
    purpose: 'Ajuda a focar no que é realmente urgente e importante, eliminando a sensação de sobrecarga.',
    howToAccess: 'Acesse a aba "Tarefas" no menu inferior ou lateral.',
    howToUse: 'Clique no botão "+ Nova Tarefa", defina o título, prazo, categoria e nível de prioridade.',
    fieldGuide: [
      { field: 'Título da Tarefa', tip: 'Use verbos de ação claros. Ex: "Enviar relatório mensal de vendas".' },
      { field: 'Prioridade (Eisenhower)', tip: 'Escolha Alta (Urgente e Importante), Média (Importante) ou Baixa.' },
      { field: 'Data e Horário de Vencimento', tip: 'O app enviará uma notificação no celular 15 minutos antes deste horário!' }
    ],
    examples: {
      bad: 'Título: "Estudar" (muito vago)',
      good: 'Título: "Estudar Capítulos 3 e 4 de Filosofia para a prova de sexta-feira"'
    },
    bestPractices: 'Divida grandes projetos em tarefas menores que possam ser concluídas em até 45 minutos.',
    commonErrors: 'Criar tarefas demais para o mesmo dia e não conseguir concluir nenhuma.',
    faq: 'Como funciona a notificação? O Service Worker dispara um alerta nativo com som 15 min antes do prazo.'
  },

  // METAS
  {
    id: 'goals-guide',
    categoryId: 'goals',
    title: 'Como criar e vincular metas a tarefas práticas',
    whatIs: 'Um sistema de acompanhamento de objetivos de médio e longo prazo conectado às suas tarefas diárias.',
    purpose: 'Garante que suas ações do dia a dia estejam alinhadas aos seus grandes sonhos e projetos.',
    howToAccess: 'Acesse a aba "Objetivos" no menu.',
    howToUse: 'Clique em "+ Novo Objetivo", defina a meta principal e vincule tarefas específicas a ela. A barra de progresso avança automaticamente conforme você conclui as tarefas vinculadas.',
    fieldGuide: [
      { field: 'Título do Objetivo', tip: 'Defina uma meta mensurável e com prazo final claro.' },
      { field: 'Tarefas Vinculadas', tip: 'Selecione ou crie as etapas práticas necessárias para alcançar o objetivo.' }
    ],
    examples: {
      bad: 'Objetivo: "Ficar em forma"',
      good: 'Objetivo: "Correr 5 km sem parar até o final do mês de Outubro"'
    },
    bestPractices: 'Revise seus objetivos semanalmente para ajustar prazos e tarefas pendentes.',
    commonErrors: 'Criar um objetivo sem vincular nenhuma tarefa prática a ele.',
    faq: 'O que acontece ao concluir todas as tarefas vinculadas? O objetivo é automaticamente marcado como concluído!'
  },

  // HÁBITOS
  {
    id: 'habits-guide',
    categoryId: 'habits',
    title: 'Como construir rotinas e manter sequências (Streaks)',
    whatIs: 'Um monitor de hábitos diários que premia a sua regularidade através do cálculo de dias consecutivos.',
    purpose: 'Desenvolve disciplina contínua e fortalece novos hábitos de forma sustentável.',
    howToAccess: 'Acesse a aba "Hábitos" no menu.',
    howToUse: 'Clique em "+ Novo Hábito", escolha o nome e os dias da semana. Todos os dias, marque o hábito no seu painel para não quebrar sua sequência (streak).',
    fieldGuide: [
      { field: 'Nome do Hábito', tip: 'Defina uma rotina clara e diária. Ex: "Meditar 10 minutos".' },
      { field: 'Frequência Semanal', tip: 'Escolha quais dias da semana pretende realizar esta rotina.' }
    ],
    examples: {
      bad: 'Hábito: "Ler a biblioteca inteira"',
      good: 'Hábito: "Ler 15 minutos do livro atual após o café da manhã"'
    },
    bestPractices: 'Comece com apenas 1 ou 2 hábitos simples até que se tornem automáticos.',
    commonErrors: 'Tentar mudar 10 hábitos de uma só vez e desistir na primeira semana.',
    faq: 'Se eu esquecer de marcar um dia, perco a sequência? Sim, a sequência (streak) reinicia para incentivar a consistência real.'
  },

  // FOCO
  {
    id: 'focus-guide',
    categoryId: 'focus',
    title: 'Como utilizar o Foco Pomodoro e Sons Ambientes Lo-Fi',
    whatIs: 'Um temporizador de produtividade baseado no método Pomodoro combinado com gerador de som relaxante.',
    purpose: 'Aumenta sua concentração em tarefas exigentes e evita o cansaço mental prematuro.',
    howToAccess: 'Acesse a aba "Foco" no menu.',
    howToUse: 'Defina o tempo do ciclo (padrão de 25 min), selecione o som ambiente desejado (Chuva, Café, Lo-Fi) e clique em "Iniciar Foco".',
    fieldGuide: [
      { field: 'Tempo do Ciclo', tip: '25 minutos de foco total seguidos por 5 minutos de pausa recomendados.' },
      { field: 'Som de Fundo', tip: 'Escolha ruído marrom, som de chuva ou música Lo-Fi para isolar ruídos externos.' }
    ],
    examples: {
      bad: 'Tentar fazer 4 horas de foco ininterrupto sem pausa.',
      good: 'Completar 4 ciclos Pomodoro intercalados por pausas curtas de 5 minutos.'
    },
    bestPractices: 'Coloque o celular no modo "Não Perturbe" durante o tempo do temporizador.',
    commonErrors: 'Trabalhar durante a pausa do Pomodoro.',
    faq: 'O som continua tocando se eu mudar de aba? Sim, o reprodutor de áudio foi otimizado para rodar em segundo plano.'
  },

  // IA (COACH MYFLOWDAY)
  {
    id: 'ai-guide',
    categoryId: 'ai',
    title: 'Tudo sobre o Coach MyFlowDay: Seu assistente de produtividade com IA',
    whatIs: 'Um motor de inteligência comportamental exclusivo do Plano Pro que analisa sua rotina.',
    purpose: 'Oferece insights valiosos e sugestões personalizadas sobre como otimizar seu tempo e energia.',
    howToAccess: 'Acesse a aba "Coach" no menu (exclusivo assinantes Pro).',
    howToUse: 'Converse diretamente com o Coach MyFlowDay ou clique nos botões de análise rápida para obter relatórios comportamentais.',
    fieldGuide: [
      { field: 'Caixa de Mensagem / Prompt', tip: 'Seja específico sobre o que deseja analisar ou melhorar na sua rotina.' }
    ],
    examples: {
      bad: 'Prompt: "Me ajuda"',
      good: 'Prompt: "Analise minhas tarefas concluídas na última semana e me diga em qual dia fui mais produtivo."'
    },
    bestPractices: 'Peça conselhos práticos para reorganizar tarefas quando estiver se sentindo sobrecarregado.',
    commonErrors: 'Esperar que a IA conclua suas tarefas por você em vez de utilizá-la como guia estratégico.',
    faq: 'Meus dados são compartilhados com terceiros? Não! Toda a análise é processada de forma restrita e segura.'
  },

  // GAMIFICAÇÃO
  {
    id: 'gamification-guide',
    categoryId: 'gamification',
    title: 'Sistema de Gamificação: Níveis, XP e Mascotes (Pets)',
    whatIs: 'Um sistema motivacional completo com ganho de pontos de experiência (XP), badges e pets de crescimento.',
    purpose: 'Transforma a conclusão de tarefas e hábitos em um jogo divertido e gratificante.',
    howToAccess: 'Na tela inicial (Home), visualize o card "Seu ritmo de crescimento".',
    howToUse: 'Escolha seu mascote favorito (Plantinha, Bebê, Cachorrinho ou Gatinho). Conclua tarefas e hábitos para ganhar XP e evoluir seu pet por 4 estágios únicos!',
    fieldGuide: [
      { field: 'Seleção de Pet', tip: 'Escolha a identidade visual que mais se conecta com o seu momento atual.' }
    ],
    examples: {
      bad: 'Deixar tarefas acumuladas e perder pontos de consistência.',
      good: 'Marcar hábitos diários para subir de nível e ver seu mascote crescer.'
    },
    bestPractices: 'Alterne o mascote nas configurações do card sempre que quiser renovar sua motivação visual.',
    commonErrors: 'Achar que a escolha do pet altera as regras do aplicativo; a mudança é 100% visual e motivacional.',
    faq: 'Como ganho mais XP? Concluindo tarefas antes do prazo e mantendo sequências longas nos hábitos.'
  },

  // ASSINATURAS E PAGAMENTOS (CATEGORIA EXCLUSIVA)
  {
    id: 'billing-plans',
    categoryId: 'billing',
    title: 'Diferença entre o Plano Free e o Plano Pro',
    whatIs: 'O comparativo oficial dos recursos disponíveis na versão gratuita e na versão premium.',
    purpose: 'Permite escolher a opção ideal para a sua jornada de progresso pessoal.',
    howToAccess: 'Acesse Configurações > Planos ou clique no banner "Quero ser Pro".',
    howToUse: 'Analise os recursos e faça o upgrade para desbloquear inteligência artificial e sincronizações avançadas.',
    fieldGuide: [
      { field: 'Plano Free', tip: 'Gratuito para sempre. Inclui tarefas, hábitos, metas e temporizador Pomodoro.' },
      { field: 'Plano Pro', tip: 'R$ 14,90/mês. Inclui Coach de IA, Google Calendar Sync e relatórios ilimitados.' }
    ],
    examples: {
      bad: 'Achar que o Plano Free expira após alguns dias. O Free é gratuito para sempre!',
      good: 'Assinar o Plano Pro para automatizar o planejamento semanal via IA e Google Calendar.'
    },
    bestPractices: 'Aproveite os 7 dias de garantia para testar todos os recursos Pro sem risco.',
    commonErrors: 'Confundir o valor do plano mensal (R$ 14,90).',
    faq: 'Posso cancelar quando quiser? Sim, sem fidelidade ou multas.'
  },
  {
    id: 'billing-pix',
    categoryId: 'billing',
    title: 'Como pagar via Pix e prazo de ativação',
    whatIs: 'O método de pagamento instantâneo via QRCode ou código Copia e Cola fornecido pelo gateway Asaas.',
    purpose: 'Oferece ativação imediata do Plano Pro sem necessidade de cartão de crédito.',
    howToAccess: 'Na tela de checkout, selecione a opção "Pix".',
    howToUse: 'Copie o código gerado ou escaneie o QRCode no aplicativo do seu banco. A liberação ocorre em menos de 5 segundos após a confirmação bancária!',
    fieldGuide: [
      { field: 'Pix Copia e Cola', tip: 'Copie a chave alfanumérica longa e cole na opção "Pix Copia e Cola" do seu banco.' }
    ],
    examples: {
      bad: 'Deixar o QRCode expirar (validade de 30 minutos) e tentar pagar depois.',
      good: 'Concluir o pagamento no app do banco imediatamente após gerar o código no MyFlowDay.'
    },
    bestPractices: 'Aguarde a confirmação na tela; o sistema atualiza automaticamente via webhook.',
    commonErrors: 'Agendar o Pix para uma data futura em vez de pagar na hora.',
    faq: 'E se o Pix expirar? Basta fechar a janela e gerar um novo Pix no aplicativo.'
  },
  {
    id: 'billing-card',
    categoryId: 'billing',
    title: 'Pagamento via Cartão de Crédito e Renovação Automática',
    whatIs: 'A modalidade de assinatura recorrente mensal via cartão de crédito com cobrança automática a cada 30 dias.',
    purpose: 'Garante acesso ininterrupto aos recursos Pro sem necessidade de pagamento manual todo mês.',
    howToAccess: 'Na tela de checkout, selecione "Cartão de Crédito".',
    howToUse: 'Preencha o número do cartão, nome do titular, validade e código CVV. Para alterar o cartão cadastrado no futuro, vá em Configurações > Gerenciar Assinatura.',
    fieldGuide: [
      { field: 'Dados do Cartão', tip: 'Preencha exatamente como impresso no cartão físico ou gerado no cartão virtual.' }
    ],
    examples: {
      bad: 'Usar um cartão virtual temporário de compra única para uma assinatura recorrente.',
      good: 'Utilizar um cartão virtual recorrente configurado no aplicativo do seu banco.'
    },
    bestPractices: 'Mantenha os dados do cartão atualizados para evitar a interrupção dos serviços.',
    commonErrors: 'Cartão recusado por falta de limite ou bloqueio de compras online.',
    faq: 'Como altero o cartão? Acesse Configurações > Minha Assinatura > Atualizar Cartão.'
  },
  {
    id: 'billing-cancel',
    categoryId: 'billing',
    title: 'Como cancelar sua assinatura e politica de acesso',
    whatIs: 'O procedimento para interromper a renovação automática da sua assinatura Pro.',
    purpose: 'Dá total controle ao usuário para encerrar cobranças futuras quando desejar.',
    howToAccess: 'Vá em Configurações > Minha Assinatura > Cancelar Assinatura.',
    howToUse: 'Clique no botão de cancelamento e confirme a ação na tela.',
    fieldGuide: [
      { field: 'Confirmação de Cancelamento', tip: 'Leia os detalhes exibidos antes de confirmar.' }
    ],
    examples: {
      bad: 'Achar que cancelar a assinatura apaga suas tarefas. Seus dados continuam 100% salvos!',
      good: 'Cancelar a renovação e continuar utilizando os recursos Pro até o final do período já pago.'
    },
    bestPractices: 'Cancele pelo menos 24 horas antes da data de renovação para evitar novas cobranças no cartão.',
    commonErrors: 'Desinstalar o aplicativo achando que isso cancela a cobrança no banco.',
    faq: 'Até quando continuo com acesso Pro? Você mantém acesso total até a data final do ciclo mensal já pago!'
  },
  {
    id: 'billing-troubleshooting',
    categoryId: 'billing',
    title: 'Resolvendo problemas: Paguei e não liberou, Pix expirado ou recusado',
    whatIs: 'O guia de resolução para eventuais falhas de comunicação ou cobrança.',
    purpose: 'Garante que qualquer inconsistência seja resolvida rapidamente.',
    howToAccess: 'Consulte este artigo ou envie uma mensagem no suporte interno em Configurações > Feedback.',
    howToUse: 'Siga os passos de diagnóstico abaixo de acordo com o seu caso.',
    fieldGuide: [
      { field: 'Paguei o Pix mas continuei Free', tip: 'Faça logout da conta e entre novamente. A checagem Zero-Trust atualizará o perfil.' },
      { field: 'Cartão Recusado', tip: 'Verifique limite disponível e se a função de compras virtuais está ativa no app do banco.' }
    ],
    examples: {
      bad: 'Tentar pagar novamente um Pix expirado.',
      good: 'Fazer um novo login para forçar a sincronização imediata com o servidor.'
    },
    bestPractices: 'Envie o comprovante de pagamento pelo canal de suporte caso o acesso demore mais de 15 min.',
    commonErrors: 'Criar uma conta com e-mail diferente na hora do pagamento.',
    faq: 'Existe cobrança duplicada? Não! Nosso sistema possui travas rigorosas de idempotência contra pagamentos duplicados.'
  },

  // CONTA
  {
    id: 'account-privacy',
    categoryId: 'account',
    title: 'Privacidade de Dados, LGPD e Exclusão de Conta',
    whatIs: 'As políticas e ferramentas de proteção e controle sobre seus dados pessoais.',
    purpose: 'Assegura total conformidade com a Lei Geral de Proteção de Dados (LGPD).',
    howToAccess: 'Acesse Configurações > Privacidade.',
    howToUse: 'Você pode solicitar o download de todos os seus dados ou clicar em "Excluir Minha Conta" para apagar permanentemente seus registros dos nossos servidores.',
    fieldGuide: [
      { field: 'Excluir Conta', tip: 'Ação irreversível. Apaga todas as tarefas, hábitos, metas e históricos salvos.' }
    ],
    examples: {
      bad: 'Excluir a conta achando que é apenas um logout.',
      good: 'Fazer o download do histórico antes de solicitar o encerramento da conta.'
    },
    bestPractices: 'Mantenha suas preferências de privacidade ajustadas no painel de configurações.',
    commonErrors: 'Confundir exclusão de conta com cancelamento de assinatura.',
    faq: 'O MyFlowDay vende meus dados? Nunca! Seus dados são privados e criptografados.'
  },
  {
    id: 'account-deletion',
    categoryId: 'account',
    title: 'Como excluir sua conta permanentemente',
    whatIs: 'O procedimento para apagar de forma definitiva sua conta e todos os dados associados do MyFlowDay.',
    purpose: 'Garante o direito ao esquecimento e a eliminação completa dos seus dados pessoais em conformidade com as leis de privacidade.',
    howToAccess: 'Acesso pelo menu lateral ou superior: Configurações > aba "Privacidade" (ou "Minha Conta") > botão "Excluir Minha Conta".',
    howToUse: 'Acesse a tela de Configurações, selecione a aba de "Privacidade" (ou "Perfil"), role até a base e clique no botão vermelho "Excluir Minha Conta". Por segurança, confirme o processo digitando a palavra "EXCLUIR".',
    fieldGuide: [
      { field: 'Confirmação', tip: 'Digite exatamente a palavra chave em maiúsculas "EXCLUIR" para efetivar a remoção.' }
    ],
    examples: {
      bad: 'Excluir a conta achando que pode recuperar as tarefas antigas depois. A exclusão é 100% definitiva!',
      good: 'Fazer o download das metas e tarefas antes de efetuar a exclusão definitiva.'
    },
    bestPractices: 'Se possuir uma assinatura ativa do Asaas, cancele-a previamente nas configurações para evitar cobranças pendentes antes de apagar a conta.',
    commonErrors: 'Apenas deletar o aplicativo do smartphone sem efetuar o cancelamento e a exclusão da conta no sistema.',
    faq: 'Posso reativar uma conta excluída? Não. Uma vez excluída, os dados e o histórico de streaks são apagados permanentemente.'
  },

  // TÉCNICA
  {
    id: 'tech-pwa-offline',
    categoryId: 'technical',
    title: 'Como funciona o Modo Offline e a Instalação como App (PWA)',
    whatIs: 'A tecnologia Progressive Web App que permite instalar e usar o MyFlowDay mesmo sem internet.',
    purpose: 'Garante acesso contínuo aos seus compromissos em viagens ou locais sem sinal.',
    howToAccess: 'No Chrome ou Safari, selecione a opção "Adicionar à tela inicial".',
    howToUse: 'Instale o app e utilize-o normalmente. As tarefas criadas offline ficam gravadas numa fila segura (SyncQueue) e são enviadas automaticamente ao servidor assim que a internet voltar!',
    fieldGuide: [
      { field: 'Instalação no Android', tip: 'No Chrome, toque nos 3 pontinhos > "Instalar aplicativo".' },
      { field: 'Instalação no iPhone', tip: 'No Safari, toque em Compartilhar > "Adicionar à Tela de Início".' }
    ],
    examples: {
      bad: 'Achando que precisa de internet para abrir o app instalado.',
      good: 'Criar tarefas no metrô offline e ver a sincronização automática ao chegar em casa.'
    },
    bestPractices: 'Mantenha o navegador atualizado para melhor desempenho do Service Worker.',
    commonErrors: 'Tentar instalar usando navegadores não compatíveis com PWA.',
    faq: 'O app ocupa muito espaço no celular? Não! O PWA é leve e ocupa menos de 5 MB.'
  }
];
