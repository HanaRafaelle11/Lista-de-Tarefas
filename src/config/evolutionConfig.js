/**
 * evolutionConfig.js
 * 
 * Declarative configuration for the user's growth evolution system.
 * All stage images are imported from src/assets/images/evolution/
 * so Vite can hash and optimize them at build time.
 */

// ── Plant stages ──────────────────────────────────────────
import planta1 from '../assets/images/evolution/planta_1.webp';
import planta2 from '../assets/images/evolution/planta_2.webp';
import planta3 from '../assets/images/evolution/planta_3.webp';
import planta4 from '../assets/images/evolution/planta_4.webp';

// ── Baby stages ───────────────────────────────────────────
import bebe1 from '../assets/images/evolution/bebe_1.webp';
import bebe2 from '../assets/images/evolution/bebe_2.webp';
import bebe3 from '../assets/images/evolution/bebe_3.webp';
import bebe4 from '../assets/images/evolution/bebe_4.webp';

// ── Dog stages ────────────────────────────────────────────
import dog1 from '../assets/images/evolution/dog_1.webp';
import dog2 from '../assets/images/evolution/dog_2.webp';
import dog3 from '../assets/images/evolution/dog_3.webp';
import dog4 from '../assets/images/evolution/dog_4.webp';

// ── Cat stages ────────────────────────────────────────────
import cat1 from '../assets/images/evolution/cat_1.webp';
import cat2 from '../assets/images/evolution/cat_2.webp';
import cat3 from '../assets/images/evolution/cat_3.webp';
import cat4 from '../assets/images/evolution/cat_4.webp';

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
        asset: planta1,
        desc: 'De acordo com a sua constância e conclusão de tarefas e objetivos, sua plantinha vai evoluindo!',
        alt: 'Broto inicial da plantinha em um vaso futurista'
      },
      {
        level: 2,
        title: 'Planta Pequena',
        badge: 'Nível 2 • Em Evolução',
        color: 'var(--primary)',
        asset: planta2,
        desc: 'Sua constância está dando frutos! Mantenha a sequência de tarefas para fazer sua árvore crescer.',
        alt: 'Planta jovem em crescimento com duas folhas'
      },
      {
        level: 3,
        title: 'Muda',
        badge: 'Nível 3 • Alta Performance',
        color: '#10b981',
        asset: planta3,
        desc: 'Excelente progresso! Suas metas e constância diária fortaleceram suas raízes.',
        alt: 'Árvore frondosa em crescimento com mais folhas'
      },
      {
        level: 4,
        title: 'Planta Digital',
        badge: 'Nível 4 • Consistência Lendária',
        color: '#ec4899',
        asset: planta4,
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
        title: 'Bebê Futurista',
        badge: 'Nível 1 • Primeiros Passos',
        color: '#3b82f6',
        asset: bebe1,
        desc: 'Sua jornada começou! O bebê futurista dorme protegido em sua cápsula de berço de alta tecnologia. Conclua tarefas para ajudá-lo a crescer!',
        alt: 'Bebê futurista neon dormindo dentro de uma cápsula de berço de alta tecnologia'
      },
      {
        level: 2,
        title: 'Bebê Engatinhando',
        badge: 'Nível 2 • Aprendendo',
        color: 'var(--primary)',
        asset: bebe2,
        desc: 'Ganhando foco! Seu bebê engatinha em um caminho digital brilhante. Continue avançando para guiá-lo no progresso.',
        alt: 'Bebê neon fofo engatinhando por um caminho digital brilhante'
      },
      {
        level: 3,
        title: 'Criança Curiosa',
        badge: 'Nível 3 • Curiosa & Forte',
        color: '#10b981',
        asset: bebe3,
        desc: 'Fantástico! O bebê cresceu e agora é uma criança curiosa brincando com blocos holográficos gerados pela sua constância.',
        alt: 'Criança jovem neon de pé brincando com blocos holográficos'
      },
      {
        level: 4,
        title: 'Jovem Cibernético',
        badge: 'Nível 4 • Brilhante Master',
        color: '#f59e0b',
        asset: bebe4,
        desc: 'Consistência lendária! Seu companheiro se tornou um jovem cibernético super estiloso com mochila neon, de pé e confiante na sua rotina.',
        alt: 'Jovem cibernético futurista com mochila neon de pé confiante'
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
        asset: dog1,
        desc: 'Seu filhotinho neon chegou e está descansando em um travesseiro brilhante. Complete tarefas diárias para dar energia a ele!',
        alt: 'Cachorrinho filhote neon deitado dormindo em um travesseiro brilhante'
      },
      {
        level: 2,
        title: 'Cão Brincalhão',
        badge: 'Nível 2 • Ativo & Feliz',
        color: 'var(--primary)',
        asset: dog2,
        desc: 'Seu cãozinho está muito feliz, sentado e olhando para cima com detalhes de neon brilhantes. Continue realizando compromissos!',
        alt: 'Cachorrinho feliz neon sentado olhando para cima'
      },
      {
        level: 3,
        title: 'Cão Dinâmico',
        badge: 'Nível 3 • Companheiro',
        color: '#10b981',
        asset: dog3,
        desc: 'Ritmo acelerado! Seu pet corre cheio de energia com belos rastros de dados neon na cauda, acompanhando sua velocidade.',
        alt: 'Cachorro neon dinâmico correndo com rastros de dados na cauda'
      },
      {
        level: 4,
        title: 'Alfa Cibernético',
        badge: 'Nível 4 • Nobreza & Foco',
        color: '#8b5cf6',
        asset: dog4,
        desc: 'Desempenho lendário! Seu companheiro se tornou um cão alfa cibernético heroico, equipado com armadura holográfica e capa neon.',
        alt: 'Cão alfa cibernético heroico com capa neon e armadura holográfica'
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
        asset: cat1,
        desc: 'Seu filhote de gatinho neon está dormindo e encolhido na plataforma cibernética. Crie e cumpra metas para dar energia e fazê-lo explorar!',
        alt: 'Filhote de gato neon dormindo encolhido em uma plataforma cibernética brilhante'
      },
      {
        level: 2,
        title: 'Gato Explorador',
        badge: 'Nível 2 • Em Movimento',
        color: 'var(--primary)',
        asset: cat2,
        desc: 'Seu gatinho cresceu e agora está ativamente brincando e explorando a plataforma com energia! Mantenha seus hábitos para preservar o equilíbrio.',
        alt: 'Gato jovem neon brincando e explorando de forma ativa'
      },
      {
        level: 3,
        title: 'Gato Elegante',
        badge: 'Nível 3 • Presença Forte',
        color: '#10b981',
        asset: cat3,
        desc: 'Foco impecável! Seu gato se tornou um elegante felino neon adulto que observa graciosamente sua rotina produtiva.',
        alt: 'Gato adulto neon elegante em pé de forma graciosa'
      },
      {
        level: 4,
        title: 'Guardião Cibernético',
        badge: 'Nível 4 • Soberano Master',
        color: '#ec4899',
        asset: cat4,
        desc: 'Incrível! Seu pet se transformou em um poderoso gato guardião cibernético soberano, com uma coroa de neon e aura brilhante.',
        alt: 'Gato guardião cibernético poderoso com coroa de neon e efeitos de aura'
      }
    ]
  }
};

export const EVOLUTION_CATEGORY_LIST = Object.values(EVOLUTION_CATEGORIES);
export const DEFAULT_CATEGORY = 'plant';
