/**
 * evolutionConfig.js
 * 
 * Declarative configuration for the user's growth evolution system.
 * Allows adding new categories or stages easily without code logic changes.
 */

export const EVOLUTION_CATEGORIES = {
  plant: {
    id: 'plant',
    name: 'Plantinha',
    emoji: '🌱',
    iconName: 'seedling',
    stages: [
      {
        level: 1,
        title: 'Broto',
        badge: 'Nível 1 • Início',
        color: '#3b82f6',
        asset: '/assets/evolution/plant/stage1.png',
        desc: 'De acordo com a sua constância e conclusão de tarefas e objetivos, sua plantinha vai evoluindo!',
        alt: 'Broto inicial da plantinha em um vaso futurista'
      },
      {
        level: 2,
        title: 'Planta Pequena',
        badge: 'Nível 2 • Em Evolução',
        color: 'var(--primary)',
        asset: '/assets/evolution/plant/stage2.png',
        desc: 'Sua constância está dando frutos! Mantenha a sequência de tarefas para fazer sua árvore crescer.',
        alt: 'Planta jovem em crescimento com duas folhas'
      },
      {
        level: 3,
        title: 'Muda',
        badge: 'Nível 3 • Alta Performance',
        color: '#10b981',
        asset: '/assets/evolution/plant/stage3.png',
        desc: 'Excelente progresso! Suas metas e constância diária fortaleceram suas raízes.',
        alt: 'Árvore frondosa em crescimento com mais folhas'
      },
      {
        level: 4,
        title: 'Planta Digital',
        badge: 'Nível 4 • Consistência Lendária',
        color: '#ec4899',
        asset: '/assets/evolution/plant/stage4.png',
        desc: 'Sua dedicação é extraordinária! Sua árvore floresceu totalmente com o seu foco e metas alcançadas.',
        alt: 'Árvore florida brilhante e desenvolvida'
      }
    ]
  },
  baby: {
    id: 'baby',
    name: 'Bebê',
    emoji: '👶',
    iconName: 'profile',
    stages: [
      {
        level: 1,
        title: 'Recém-nascido',
        badge: 'Nível 1 • Primeiros Passos',
        color: '#3b82f6',
        asset: '/assets/evolution/baby/stage1.png',
        desc: 'Sua jornada de foco começou! Conclua tarefas para ajudar seu bebê a crescer forte e saudável.',
        alt: 'Bebê recém-nascido deitado em um berço futurista brilhante'
      },
      {
        level: 2,
        title: 'Bebê Engatinhando',
        badge: 'Nível 2 • Aprendendo',
        color: 'var(--primary)',
        asset: '/assets/evolution/baby/stage2.png',
        desc: 'Ganhando mobilidade e foco! Continue a sequência diária para comemorar cada nova conquista.',
        alt: 'Bebê engatinhando e explorando'
      },
      {
        level: 3,
        title: 'Criança Ativa',
        badge: 'Nível 3 • Curiosa & Forte',
        color: '#10b981',
        asset: '/assets/evolution/baby/stage3.png',
        desc: 'Seus objetivos concluídos deram muita energia para aprender e explorar novos hábitos!',
        alt: 'Criança jovem dando os primeiros passos ativa e forte'
      },
      {
        level: 4,
        title: 'Jovem Campeão',
        badge: 'Nível 4 • Brilhante Master',
        color: '#f59e0b',
        asset: '/assets/evolution/baby/stage4.png',
        desc: 'Consistência incrível! Seu jovem campeão está no topo do desenvolvimento e autoconhecimento!',
        alt: 'Jovem campeão de pé com uma pequena mochila'
      }
    ]
  },
  dog: {
    id: 'dog',
    name: 'Cachorrinho',
    emoji: '🐶',
    iconName: 'paw',
    stages: [
      {
        level: 1,
        title: 'Filhotinho',
        badge: 'Nível 1 • Novo Amigo',
        color: '#3b82f6',
        asset: '/assets/evolution/dog/stage1.png',
        desc: 'Seu filhotinho chegou! Complete tarefas e objetivos diários para dar energia e carinho a ele.',
        alt: 'Cachorrinho filhote dormindo deitado em uma almofada'
      },
      {
        level: 2,
        title: 'Cão Brincalhão',
        badge: 'Nível 2 • Ativo & Feliz',
        color: 'var(--primary)',
        asset: '/assets/evolution/dog/stage2.png',
        desc: 'Sua constância deixa seu pet cheio de saúde! Continue realizando seus compromissos.',
        alt: 'Cachorrinho brincalhão sentado olhando para frente'
      },
      {
        level: 3,
        title: 'Cão Leal & Forte',
        badge: 'Nível 3 • Companheiro',
        color: '#10b981',
        asset: '/assets/evolution/dog/stage3.png',
        desc: 'Foco impecável! Seu cão se tornou um verdadeiro protetor e parceiro da sua rotina produtiva.',
        alt: 'Cão jovem correndo alegremente atrás de uma bola'
      },
      {
        level: 4,
        title: 'Cão Campeão',
        badge: 'Nível 4 • Nobreza & Foco',
        color: '#8b5cf6',
        asset: '/assets/evolution/dog/stage4.png',
        desc: 'Desempenho espetacular! Seu pet alcançou o nível máximo de lealdade e vitórias diárias!',
        alt: 'Cão adulto imponente e campeão com uma capa'
      }
    ]
  },
  cat: {
    id: 'cat',
    name: 'Gatinho',
    emoji: '🐱',
    iconName: 'paw',
    stages: [
      {
        level: 1,
        title: 'Filhote Curioso',
        badge: 'Nível 1 • Despertando',
        color: '#3b82f6',
        asset: '/assets/evolution/cat/stage1.png',
        desc: 'Seu gatinho está curioso! Crie e cumpra metas para desenvolver a agilidade e sabedoria dele.',
        alt: 'Gatinho filhote encolhido dormindo em uma plataforma'
      },
      {
        level: 2,
        title: 'Gato Ágil',
        badge: 'Nível 2 • Em Movimento',
        color: 'var(--primary)',
        asset: '/assets/evolution/cat/stage2.png',
        desc: 'Movimentos precisos e rotina em dia! Mantenha seus hábitos para preservar o equilíbrio.',
        alt: 'Gatinho jovem explorador com lupa nas mãos'
      },
      {
        level: 3,
        title: 'Gato Majestoso',
        badge: 'Nível 3 • Presença Forte',
        color: '#10b981',
        asset: '/assets/evolution/cat/stage3.png',
        desc: 'Sua constância deu um porte majestoso ao seu pet. Foco e elegância total no seu dia a dia!',
        alt: 'Gato majestoso de pé com pose ágil'
      },
      {
        level: 4,
        title: 'Gato Rei Master',
        badge: 'Nível 4 • Soberano Master',
        color: '#ec4899',
        asset: '/assets/evolution/cat/stage4.png',
        desc: 'Foco supremo! Seu gatinho reina sobre a sua produtividade e paz de espírito.',
        alt: 'Gato adulto com uma coroa brilhando em uma plataforma'
      }
    ]
  }
};

export const EVOLUTION_CATEGORY_LIST = Object.values(EVOLUTION_CATEGORIES);
export const DEFAULT_CATEGORY = 'plant';
