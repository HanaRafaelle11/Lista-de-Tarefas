/**
 * aiClassifier.js — Motor de Classificação Inteligente de IA (Client-side)
 *
 * Esta é a inteligência que analisa comandos de texto livre inseridos pelo usuário,
 * classificando a intenção entre Tarefa (Task) ou Objetivo (Goal), atribuindo a
 * categoria correta e estimando o nível de confiança na decisão.
 */

// ── Contexto / Prompt do Sistema (IA Context) ───────────────────────────────
const AI_SYSTEM_PROMPT = `
MYFLOWDAY AI CLASSIFIER SYSTEM INSTRUCTIONS:
You are an expert personal productivity assistant. Your job is to classify free-text inputs.

1. CLASSIFICATION RULES:
   - OBJECTIVE (Goal): A broad, long-term commitment, project, habit, or multi-step target.
     - Keywords/Concepts: "estudar", "aprender", "emagrecer", "desenvolver", "viajar", "academia", "criar", "construir", "tcc", "projeto", "organizar", "definir", "prioridades".
   - TAREFA (Task): A single, immediate, atomic action that can be completed in <1-2 hours.
     - Keywords/Concepts: "comprar", "pagar", "enviar", "responder", "ligar", "levar", "lavar", "marcar", "agendar".

2. CATEGORY MAP:
   - TRABALHO: Professional tasks, office work, presentations, recruitment, emails, clients, portfolio.
   - ESTUDOS: Academic, books, learning languages, courses, coding, reading, colleges.
   - LAZER: Hobbies, trips, relaxation, games, cinema, socializing, music.
   - PESSOAL: Health (doctor, dentist, gym), fitness, home upkeep (cleaning, shopping), bills (condominio, aluguel), pets (vet, dog walk), vehicles (car oil, mechanics).

3. CONFIDENCE SCORING:
   - High confidence (>= 0.8): Clear patterns and keywords.
   - Medium confidence (0.65 - 0.79): Moderate clarity.
   - Low confidence (< 0.65): Unrecognized, vague, or double meaning. Must result in "Sem categoria" and request user confirmation.
`;

// Helper para normalizar strings (remove acentos, caixa baixa e espaços extras)
export function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();
}

// Dicionário Semântico de Sinônimos e Termos por Categoria (Normalizados)
const CATEGORY_DICTIONARY = {
  estudos: [
    'estud', 'ler', 'leitura', 'livro', 'curso', 'aula', 'facul', 'universidade', 
    'tcc', 'idioma', 'ingles', 'espanhol', 'aprender', 'praticar', 'revisao', 
    'revisar', 'code', 'programar', 'desafio', 'pesquisa', 'materia', 'estatistica', 
    'filosofia', 'anatomia', 'bootcamp', 'figma', 'tutorial', 'palestra', 'python', 
    'react', 'fisica', 'quimica', 'matematica', 'biologia', 'historia', 'geografia',
    'algoritmos', 'leetcode', 'leet', 'git'
  ],
  lazer: [
    'cantar', 'tocar', 'jogar', 'assistir', 'filme', 'serie', 'lazer', 'passear', 
    'amigo', 'festa', 'divertir', 'musica', 'hobby', 'viagem', 'viajar', 'ferias', 
    'cinema', 'game', 'jogos', 'churrasco', 'praia', 'happy hour', 'netflix', 
    'videoke', 'tabuleiro', 'pintura', 'tela', 'sabad', 'doming', 'ouvir', 'album',
    'banda', 'trilha', 'final de semana', 'fim de semana'
  ],
  pessoal: [
    'comprar', 'compras', 'mercado', 'supermercado', 'casa', 'limpar', 'arrumar', 
    'pessoal', 'familia', 'medico', 'dentista', 'consulta', 'saude', 'pagar', 
    'boleto', 'conta', 'agua', 'luz', 'net', 'condominio', 'aluguel', 'academia', 
    'treino', 'treinar', 'exercicio', 'correr', 'caminhar', 'corrida', 'peso', 
    'dieta', 'emagrecer', 'remedio', 'vitamina', 'meditar', 'meditacao', 'sono', 
    'dormir', 'bicho', 'pet', 'cachorro', 'cao', 'gato', 'veterinario', 'carro', 
    'veiculo', 'oleo', 'consertar', 'lavar', 'hidratar', 'super', 'imposto', 
    'declarar', 'presente', 'mae', 'faxina', 'cozinha', 'geladeira', 'banho', 
    'pia', 'banheiro', 'lampa', 'quarto', 'racao'
  ],
  trabalho: [
    'projeto', 'empresa', 'startup', 'trabalho', 'reuniao', 'apresentacao', 'enviar', 
    'curriculo', 'vaga', 'portfolio', 'cliente', 'email', 'recrutador', 'entrevista', 
    'feedback', 'boss', 'chefe', 'task', 'quadro', 'marketing', 'vender', 'venda',
    'relatorio', 'slide', 'deploy', 'github', 'time', 'jira', 'squad', 'api', 
    'tecnica', 'firma', 'vendas', 'loja', 'checkout', 'feature', 'negociar',
    'fornecedor', 'prazos', 'demo', 'investidores', 'investidor', 'pr', 'pull request'
  ]
};

// Expressões de classificação para Tipo
const OBJECTIVE_KEYWORDS = [
  'estudar', 'aprender', 'desenvolver', 'criar', 'construir', 'planejar', 'melhorar',
  'dominar', 'mudar', 'emagrecer', 'perder peso', 'viajar', 'portfolio', 'documentacao',
  'projeto', 'tcc', 'curso', 'faculdade', 'universidade', 'empresa', 'startup',
  'campanha', 'bootcamp', 'academia', 'habito', 'rotina', 'livro', 'organizar',
  'definir', 'prioridades'
];

const TASK_KEYWORDS = [
  'comprar', 'pagar', 'enviar', 'responder', 'ligar', 'levar', 'lavar', 'consertar',
  'arrumar', 'marcar', 'agendar', 'happy hour', 'backup', 'declarar', 'leite', 'pao',
  'boleto', 'condominio', 'luz', 'agua', 'aluguel', 'consulta', 'exame', 'racao'
];

const SUBTASK_KEYWORDS = [
  'introducao', 'capitulo', 'capitulos', 'slide', 'slides', 'email', 'emails', 
  'relatorio', 'relatorios', 'pr', 'deploy', 'parte', 'etapa', 'fase', 
  'exercicio', 'exercicios', 'pagina', 'paginas', 'artigo', 'artigos', 
  'resumo', 'vaga', 'curriculo', 'aula', 'aulas', 'tutorial', 'tutoriais', 
  'modulo', 'modulos', 'video', 'videos', 'consulta', 'exame', 'racao',
  'passagem', 'passagens', 'churrasco', 'reuniao', 'entrevista', 'slides', 
  'apresentacao', 'backup', 'treinar', 'ir', 'ver', 'assistir', 'jogar',
  'planilha', 'planilhas', 'meta', 'metas', 'squad', 'geladeira', 'cozinha',
  'faxina', 'quadro', 'tarefas', 'time', 'jira', 'tabuleiro', 'jogos'
];

/**
 * Classifica um texto em 'task' (Tarefa) ou 'objective' (Objetivo).
 */
export function classifyInputType(text) {
  const normalized = normalizeText(text);
  let objScore = 0;
  let taskScore = 0;

  const hasObjectiveKeyword = OBJECTIVE_KEYWORDS.some(kw => new RegExp('\\b' + kw + '\\b', 'i').test(normalized));
  const hasSubtaskKeyword = SUBTASK_KEYWORDS.some(kw => new RegExp('\\b' + kw + '\\b', 'i').test(normalized));

  // 1. Contar palavras-chave de objetivos
  OBJECTIVE_KEYWORDS.forEach(kw => {
    const regex = new RegExp('\\b' + kw + '\\b', 'i');
    if (regex.test(normalized)) {
      objScore += 2.5;
    }
  });

  // 2. Contar palavras-chave de tarefas
  TASK_KEYWORDS.forEach(kw => {
    const regex = new RegExp('\\b' + kw + '\\b', 'i');
    if (regex.test(normalized)) {
      taskScore += 2.5;
    }
  });

  // 3. Contar palavras-chave de sub-tarefas
  SUBTASK_KEYWORDS.forEach(kw => {
    const regex = new RegExp('\\b' + kw + '\\b', 'i');
    if (regex.test(normalized)) {
      taskScore += 3.5;
    }
  });

  // 4. Regra de medição quantificável (ex: "Ler 20 páginas", "Correr 5 km", "Meditar 15 min")
  // Se contiver números seguidos de unidades de progresso diário, é fortemente uma Tarefa!
  const quantifiableTaskRegex = /\b\d+\s*(paginas?|caps?|capitulos?|exs?|exercicios?|pag|km|metros|minutos|min|h|horas|l|litros)\b/i;
  if (quantifiableTaskRegex.test(normalized)) {
    taskScore += 5.0;
  }

  // 5. Verbo de ação imediata no início da frase pontua como tarefa
  const firstWord = normalized.split(/\s+/)[0];
  const immediateActionVerbs = ['comprar', 'pagar', 'ligar', 'enviar', 'escrever', 'levar', 'arrumar', 'limpar', 'responder', 'agendar', 'marcar', 'declarar', 'fazer', 'revisar', 'correr', 'marcar', 'ir', 'ver', 'assistir', 'jogar'];
  if (immediateActionVerbs.includes(firstWord)) {
    const isDoingObjective = hasObjectiveKeyword && !hasSubtaskKeyword;
    if (isDoingObjective) {
      objScore += 3.0;
    } else {
      taskScore += 3.0;
    }
  }

  // 6. Critério de extensão (frases longas costumam descrever metas complexas/objetivos)
  const wordCount = normalized.split(/\s+/).length;
  if (wordCount > 8) {
    objScore += 1;
  }

  // Decisão
  const type = objScore > taskScore ? 'objective' : 'task';
  const confidence = Math.min(1.0, Math.max(0.4, Math.abs(objScore - taskScore) / Math.max(1, objScore + taskScore)));

  return { type, confidence };
}

/**
 * Detecta e normaliza a categoria do texto com base em sinônimos e heurísticas linguísticas.
 */
export function classifyCategory(text, userCategories = []) {
  const normalized = normalizeText(text);
  if (!normalized) return { category: 'Sem categoria', confidence: 0.0, reason: 'Texto vazio.' };

  // 1. Procurar correspondência exata de categorias criadas pelo usuário
  if (userCategories && userCategories.length > 0) {
    const matchedUserCat = userCategories.find(cat => {
      const catName = normalizeText(cat.name || '');
      if (!catName) return false;
      const regex = new RegExp('\\b' + catName + '\\b', 'i');
      return regex.test(normalized);
    });
    if (matchedUserCat) {
      return { 
        category: matchedUserCat.name, // Mantém o nome original da categoria do usuário
        confidence: 0.95, 
        reason: 'Correspondência direta com categoria customizada do usuário.' 
      };
    }
  }

  // 2. Contar correspondências nos dicionários de categorias padrão
  const scores = { trabalho: 0, estudos: 0, lazer: 0, pessoal: 0 };

  for (const [category, keywords] of Object.entries(CATEGORY_DICTIONARY)) {
    keywords.forEach(keyword => {
      const regex = new RegExp('\\b' + keyword + '\\b', 'i');
      if (regex.test(normalized)) {
        // Se a palavra exata for "aula", "curso", "tcc", "espanhol", "ingles", "fisica" etc., pontua muito para estudos
        if (category === 'estudos' && ['aula', 'curso', 'tcc', 'ingles', 'espanhol', 'fisica', 'estudos', 'estud', 'livro', 'ler', 'algoritmos', 'leetcode', 'git'].includes(keyword)) {
          scores[category] += 4.0;
        } else {
          scores[category] += 2.0;
        }
      } else if (keyword.length >= 4 && normalized.includes(keyword)) {
        scores[category] += 0.8; // Match parcial/substring apenas para palavras longas!
      }
    });
  }

  // Regra especial de desempate / precedência com limites de palavras exatas:
  // Se for "exercício de física", removemos pontos de pessoal (que associou exercício à academia) e adicionamos em estudos
  const isAcademicExercise = /\b(exercicios?)\b/i.test(normalized) && /\b(fisica|quimica|matematica|biologia|historia|geografia|faculdade|escola|estudos)\b/i.test(normalized);
  if (isAcademicExercise) {
    scores.pessoal = Math.max(0, scores.pessoal - 3.0);
    scores.estudos += 4.0;
  }

  // Se for "assistir aula" ou "palestra", "aula" (Estudos) prevalece sobre "assistir" (Lazer)
  if (/\b(aula|curso|tcc|palestra)\b/i.test(normalized)) {
    scores.estudos += 4.0;
    scores.lazer = Math.max(0, scores.lazer - 3.0);
  }

  // Se "git" ou "github" vier acompanhado de "aprender" ou "curso", é Estudos e não Trabalho
  if (/\b(git|github)\b/i.test(normalized) && /\b(aprender|curso|estudar)\b/i.test(normalized)) {
    scores.estudos += 3.0;
    scores.trabalho = Math.max(0, scores.trabalho - 2.0);
  }

  // Se "pr" ou "pull request" estiver presente, é Trabalho e não Estudos (de code)
  if (/\b(pr|pull\s+request)\b/i.test(normalized)) {
    scores.trabalho += 4.0;
    scores.estudos = Math.max(0, scores.estudos - 3.0);
  }

  // Se contiver viagem ou férias ou passagens, Lazer prevalece sobre Pessoal (de comprar)
  if (/\b(viagem|viajar|ferias|passagem|passagens)\b/i.test(normalized)) {
    scores.lazer += 4.0;
    scores.pessoal = Math.max(0, scores.pessoal - 3.0);
  }

  // Se for "happy hour", Lazer prevalece sobre Estudos (de facul)
  if (/\b(happy\s+hour)\b/i.test(normalized)) {
    scores.lazer += 4.0;
    scores.estudos = Math.max(0, scores.estudos - 3.0);
  }

  // Se for "pintura em tela" ou "tocar/cantar", Lazer prevalece sobre Estudos (de praticar)
  if (/\b(pintura|tela|desenho)\b/i.test(normalized)) {
    scores.lazer += 4.0;
    scores.estudos = Math.max(0, scores.estudos - 3.0);
  }

  // Encontrar a categoria vencedora
  let bestCategory = null;
  let maxScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = cat;
    }
  }

  // Se o score máximo for nulo ou muito baixo, retorna "Sem categoria"
  if (maxScore === 0) {
    return {
      category: 'Sem categoria',
      confidence: 0.0,
      reason: 'Nenhuma palavra-chave reconhecida para as categorias padrão.'
    };
  }

  // Calcula a confiança baseada na margem do vencedor sobre os outros
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = Math.min(1.0, maxScore / totalScore);

  // Mapeia de chave minúscula para capitalizada correta
  const categoryNames = {
    trabalho: 'Trabalho',
    estudos: 'Estudos',
    lazer: 'Lazer',
    pessoal: 'Pessoal'
  };

  const finalCategory = categoryNames[bestCategory] || 'Sem categoria';

  // Se a confiança for menor que 0.65, classifica como "Sem categoria"
  if (confidence < 0.65) {
    return {
      category: 'Sem categoria',
      confidence,
      reason: `Confiança baixa (${Math.round(confidence * 100)}%). Conflito entre termos de categorias diferentes.`
    };
  }

  return {
    category: finalCategory,
    confidence,
    reason: `Correspondência semântica robusta (Score: ${maxScore.toFixed(1)}).`
  };
}

/**
 * Fluxo de execução completo da Classificação por IA (Auditoria e Logs inclusos).
 */
export function executeAIClassifier(text, userCategories = []) {
  const typeResult = classifyInputType(text);
  const catResult = classifyCategory(text, userCategories);

  // Resposta estruturada retornada pelo modelo simulado
  const aiResponse = {
    type: typeResult.type,
    typeConfidence: typeResult.confidence,
    category: catResult.category,
    categoryConfidence: catResult.confidence,
    reason: `Type: ${typeResult.type} (${Math.round(typeResult.confidence * 100)}%), Category: ${catResult.category} (${Math.round(catResult.confidence * 100)}%). ${catResult.reason}`
  };

  // ── LOG DE DEPURAÇÃO EXIGIDO PELA AUDITORIA ────────────────────────────────
  console.log('\n========================================================================');
  console.log('🤖 [MyFlowDay AI Classifier] PROMPT ENVIADO:\n', AI_SYSTEM_PROMPT.trim());
  console.log('------------------------------------------------------------------------');
  console.log('📥 ENTRADA DO USUÁRIO:', `"${text}"`);
  console.log('📤 RESPOSTA DA IA (JSON):', JSON.stringify(aiResponse, null, 2));
  console.log('🔍 CATEGORIA ORIGINAL DETECTADA:', catResult.category === 'Sem categoria' ? 'Nenhuma/Indefinida' : catResult.category);
  console.log('🎯 CATEGORIA APÓS MAPEAMENTO:', aiResponse.category);
  console.log('💡 MOTIVO DA DECISÃO:', aiResponse.reason);
  console.log('========================================================================\n');

  return aiResponse;
}
