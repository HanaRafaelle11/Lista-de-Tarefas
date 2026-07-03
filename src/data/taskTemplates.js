export const TASK_TEMPLATES = [
  {
    id: 'dog_care',
    title: 'Cuidados com Cachorro',
    category: 'Pets',
    description: 'Rotina diária essencial para manter seu cão feliz e saudável.',
    tasks: [
      { title: 'Dar ração e água fresca', description: 'Garantir comedouro limpo e água gelada' },
      { title: 'Passear de manhã/tarde', description: 'Passeio de pelo menos 20 minutos' },
      { title: 'Limpar a área do pet', description: 'Trocar tapete higiênico ou lavar quintal' },
      { title: 'Brincar/Escovar pelo', description: 'Gastar energia do cão e manter pelo alinhado' }
    ]
  },
  {
    id: 'plant_care',
    title: 'Rotina de Plantas',
    category: 'Pessoal',
    description: 'Cuidados essenciais para manter suas plantas verdes e vivas.',
    tasks: [
      { title: 'Regar plantas da sala', description: 'Checar umidade do solo com o dedo antes' },
      { title: 'Limpar folhas com pano úmido', description: 'Ajuda na fotossíntese' },
      { title: 'Adubar vasos da varanda', description: 'Fazer adubação mensal com húmus' }
    ]
  },
  {
    id: 'remote_work',
    title: 'Trabalho Remoto Produtivo',
    category: 'Trabalho',
    description: 'Hábitos diários para manter o foco e evitar a estafa trabalhando de casa.',
    tasks: [
      { title: 'Organizar mesa de trabalho', description: 'Copos vazios fora e ambiente limpo' },
      { title: 'Fazer reuniões diárias', description: 'Alinhar entregas e impedimentos' },
      { title: 'Pausa ativa de 10 min', description: 'Alongar costas e pernas longe da tela' }
    ]
  },
  {
    id: 'baby_care',
    title: 'Cuidados com Bebê',
    category: 'Pessoal',
    description: 'Rotina diária recomendada para o cuidado e bem-estar de bebês e lactentes.',
    tasks: [
      { title: 'Registrar mamadas/alimentação', description: 'Marcar horários e quantidade de leite/papinha' },
      { title: 'Troca de fraldas', description: 'Checar fralda a cada 3 horas e aplicar pomada' },
      { title: 'Banho do bebê', description: 'Garantir água em temperatura morna (37°C) e sabonete neutro' },
      { title: 'Hora da soneca', description: 'Colocar no berço com luz suave e ruído branco' }
    ]
  },
  {
    id: 'fitness_trainer',
    title: 'Rotina de Treinos e Nutrição',
    category: 'Pessoal',
    description: 'Hábitos diários focados em atividade física e alimentação saudável.',
    tasks: [
      { title: 'Treino de força/cardio', description: 'Executar o treino planejado para o dia (45-60 min)' },
      { title: 'Preparar refeições saudáveis', description: 'Focar em macros equilibrados e alimentos limpos' },
      { title: 'Beber 3L de água', description: 'Manter garrafa sempre cheia e acompanhar consumo' },
      { title: 'Alongamento/Mobilidade', description: 'Fazer 10 minutos de alongamento para flexibilidade' }
    ]
  },
  {
    id: 'student_routine',
    title: 'Rotina de Estudos Acadêmicos',
    category: 'Estudos',
    description: 'Métodos diários para impulsionar a retenção de conteúdo e o progresso acadêmico.',
    tasks: [
      { title: 'Revisar matéria do dia', description: 'Reler anotações da aula e criar resumos/flashcards' },
      { title: 'Fazer exercícios práticos', description: 'Resolver pelo menos 10 questões teóricas' },
      { title: 'Organizar espaço de estudo', description: 'Manter mesa limpa e materiais de apoio à mão' },
      { title: 'Leitura ativa de capítulo', description: 'Ler e grifar livro-texto indicado pela disciplina' }
    ]
  },
  {
    id: 'concurso_prep',
    title: 'Ciclo de Estudos para Concurso',
    category: 'Estudos',
    description: 'Rotina de alto rendimento focada em edital e resolução de questões de concurso público.',
    tasks: [
      { title: 'Estudo teórico por ciclo', description: 'Focar em 2 matérias do edital por dia (Método Pomodoro)' },
      { title: 'Simulado de questões', description: 'Resolver 30 questões comentadas na plataforma de questões' },
      { title: 'Revisão espaçada', description: 'Revisar flashcards do dia no Anki para fixação de longo prazo' },
      { title: 'Ler lei seca/jurisprudência', description: 'Dedicar 30 minutos a textos de leis puras e súmulas' }
    ]
  }
];

export const GOAL_TEMPLATES = [
  {
    id: 'pet_parent',
    title: 'Tutor de Pet Perfeito',
    category: 'Pets',
    description: 'Criar uma rotina consistente de cuidados, saúde e bem-estar para o seu animal de estimação.',
    icon: 'target',
    color: '#B5A296',
    actions: [
      'Agendar consulta de rotina no veterinário',
      'Comprar ração premium e petiscos saudáveis',
      'Estabelecer rotina diária de passeios e brincadeiras',
      'Atualizar carteira de vacinação'
    ]
  },
  {
    id: 'finances',
    title: 'Organizar Finanças Pessoais',
    category: 'Pessoal',
    description: 'Alcançar controle total sobre receitas, despesas e poupar para investimentos.',
    icon: 'dollar',
    color: '#10b981',
    actions: [
      'Registrar todos os gastos mensais fixos',
      'Definir teto de gastos por categoria',
      'Criar conta de reserva de emergência',
      'Cancelar assinaturas que não são utilizadas'
    ]
  },
  {
    id: 'career',
    title: 'Transição de Carreira',
    category: 'Trabalho',
    description: 'Migrar para uma nova área profissional definindo plano de estudos e networking.',
    icon: 'rocket',
    color: '#6366f1',
    actions: [
      'Mapear principais habilidades exigidas no mercado',
      'Atualizar perfil do LinkedIn e portfólio',
      'Concluir curso básico da nova área de atuação',
      'Conversar com 3 profissionais da área de interesse'
    ]
  },
  {
    id: 'baby_routine_goal',
    title: 'Rotina de Cuidados com o Bebê',
    category: 'Pessoal',
    description: 'Criar uma rotina saudável e organizada de cuidados com o recém-nascido ou lactente.',
    icon: 'target',
    color: '#F472B6',
    actions: [
      'Organizar estoque de fraldas',
      'Montar cronograma de consultas',
      'Higienizar brinquedos',
      'Registrar padrão de sono'
    ]
  },
  {
    id: 'healthy_life_goal',
    title: 'Vida Saudável e Treinos',
    category: 'Pessoal',
    description: 'Estabelecer hábitos consistentes de exercícios físicos, alimentação balanceada e hidratação.',
    icon: 'dumbbell',
    color: '#F97316',
    actions: [
      'Mapear treinos com profissional',
      'Fazer avaliação física mensal',
      'Planejar lista de feira saudável',
      'Comprar suplementos'
    ]
  },
  {
    id: 'academic_excellence_goal',
    title: 'Excelência Acadêmica',
    category: 'Estudos',
    description: 'Desenvolver uma rotina eficiente de estudos para provas, trabalhos e projetos acadêmicos.',
    icon: 'book',
    color: '#3B82F6',
    actions: [
      'Criar calendário de entregas',
      'Formar grupo de estudos',
      'Organizar pastas de arquivos',
      'Ler referências'
    ]
  },
  {
    id: 'concurso_approval_goal',
    title: 'Aprovação em Concurso Público',
    category: 'Estudos',
    description: 'Dedicar-se de forma sistemática à preparação para o cargo dos sonhos com ciclos estruturados.',
    icon: 'globe',
    color: '#EAB308',
    actions: [
      'Analisar o edital e pesos',
      'Montar cronograma de ciclo',
      'Realizar simulado geral no fim de semana',
      'Mapear informativos de jurisprudência'
    ]
  }
];
