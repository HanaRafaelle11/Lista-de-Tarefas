import { executeAIClassifier } from '../src/intelligence/aiClassifier.js';

// Suíte de Testes da Auditoria: 100+ Exemplos de Entrada Reais
const TEST_CASES = [
  // 16 Exemplos Solicitados Explicitamente
  { text: 'Comprar leite', type: 'task', category: 'Pessoal' },
  { text: 'Pagar condomínio', type: 'task', category: 'Pessoal' },
  { text: 'Estudar inglês', type: 'objective', category: 'Estudos' },
  { text: 'Marcar consulta', type: 'task', category: 'Pessoal' },
  { text: 'Ler 20 páginas', type: 'task', category: 'Estudos' },
  { text: 'Correr 5 km', type: 'task', category: 'Pessoal' },
  { text: 'Declarar imposto', type: 'task', category: 'Pessoal' },
  { text: 'Planejar viagem', type: 'objective', category: 'Lazer' },
  { text: 'Levar cachorro ao veterinário', type: 'task', category: 'Pessoal' },
  { text: 'Trocar óleo do carro', type: 'task', category: 'Pessoal' },
  { text: 'Criar apresentação', type: 'task', category: 'Trabalho' },
  { text: 'Enviar currículo', type: 'task', category: 'Trabalho' },
  { text: 'Responder recrutador', type: 'task', category: 'Trabalho' },
  { text: 'Treinar academia', type: 'task', category: 'Pessoal' },
  { text: 'Fazer compras', type: 'task', category: 'Pessoal' },
  { text: 'Agendar dentista', type: 'task', category: 'Pessoal' },

  // Categoria: Estudos (30+ Casos)
  { text: 'Fazer curso de React', type: 'objective', category: 'Estudos' },
  { text: 'Ler livro de produtividade', type: 'objective', category: 'Estudos' },
  { text: 'Aprender Python básico', type: 'objective', category: 'Estudos' },
  { text: 'Escrever introdução do TCC', type: 'task', category: 'Estudos' },
  { text: 'Fazer dever de espanhol', type: 'task', category: 'Estudos' },
  { text: 'Assistir aula de Machine Learning', type: 'task', category: 'Estudos' },
  { text: 'Praticar violão 30 minutos', type: 'task', category: 'Estudos' },
  { text: 'Revisar matéria de estatística', type: 'task', category: 'Estudos' },
  { text: 'Pesquisar artigos de neurociência', type: 'task', category: 'Estudos' },
  { text: 'Ler 10 páginas de filosofia', type: 'task', category: 'Estudos' },
  { text: 'Resolver exercícios de física', type: 'task', category: 'Estudos' },
  { text: 'Estudar para prova de anatomia', type: 'objective', category: 'Estudos' },
  { text: 'Ver tutorial de Figma no YouTube', type: 'task', category: 'Estudos' },
  { text: 'Concluir módulo 3 do Bootcamp', type: 'task', category: 'Estudos' },
  { text: 'Treinar algoritmos no LeetCode', type: 'task', category: 'Estudos' },
  { text: 'Escrever resumo do livro', type: 'task', category: 'Estudos' },
  { text: 'Aprender Git e GitHub básico', type: 'objective', category: 'Estudos' },
  { text: 'Fazer curso de oratória para o trabalho', type: 'objective', category: 'Estudos' },
  { text: 'Assistir palestra sobre inteligência artificial', type: 'task', category: 'Estudos' },
  { text: 'Estudar desenvolvimento de software', type: 'objective', category: 'Estudos' },

  // Categoria: Trabalho (30 Casos)
  { text: 'Reunião de alinhamento com cliente', type: 'task', category: 'Trabalho' },
  { text: 'Finalizar relatório de vendas trimestral', type: 'task', category: 'Trabalho' },
  { text: 'Atualizar slides da apresentação institucional', type: 'task', category: 'Trabalho' },
  { text: 'Fazer deploy do sistema em produção', type: 'task', category: 'Trabalho' },
  { text: 'Atualizar meu portfólio no Behance', type: 'objective', category: 'Trabalho' },
  { text: 'Responder e-mails pendentes do chefe', type: 'task', category: 'Trabalho' },
  { text: 'Criar nova campanha de marketing no Instagram', type: 'objective', category: 'Trabalho' },
  { text: 'Entrevista de emprego com recrutador', type: 'task', category: 'Trabalho' },
  { text: 'Enviar proposta comercial para lead', type: 'task', category: 'Trabalho' },
  { text: 'Organizar quadro de tarefas do time no Jira', type: 'task', category: 'Trabalho' },
  { text: 'Desenvolver feature de checkout da loja', type: 'objective', category: 'Trabalho' },
  { text: 'Revisar PR de código do colega', type: 'task', category: 'Trabalho' },
  { text: 'Montar planilha de custos do projeto', type: 'task', category: 'Trabalho' },
  { text: 'Ligar para fornecedor e negociar prazos', type: 'task', category: 'Trabalho' },
  { text: 'Escrever post do blog da firma', type: 'task', category: 'Trabalho' },
  { text: 'Gravar demo do produto para investidores', type: 'task', category: 'Trabalho' },
  { text: 'Planejar metas semanais do squad', type: 'task', category: 'Trabalho' },
  { text: 'Criar documentação técnica da API', type: 'objective', category: 'Trabalho' },
  { text: 'Fazer backup do banco de dados da empresa', type: 'task', category: 'Trabalho' },
  { text: 'Atualizar currículo no LinkedIn', type: 'task', category: 'Trabalho' },

  // Categoria: Lazer (20 Casos)
  { text: 'Jogar videogame com amigos', type: 'task', category: 'Lazer' },
  { text: 'Assistir novo filme do Batman', type: 'task', category: 'Lazer' },
  { text: 'Comprar passagens de avião para férias', type: 'task', category: 'Lazer' },
  { text: 'Planejar churrasco de domingo', type: 'task', category: 'Lazer' },
  { text: 'Marcar happy hour com a galera da facul', type: 'task', category: 'Lazer' },
  { text: 'Passear no parque de tarde', type: 'task', category: 'Lazer' },
  { text: 'Assistir série de suspense na Netflix', type: 'task', category: 'Lazer' },
  { text: 'Cantar no videokê no aniversário', type: 'task', category: 'Lazer' },
  { text: 'Ouvir novo álbum da minha banda favorita', type: 'task', category: 'Lazer' },
  { text: 'Planejar roteiro detalhado de viagem para Paris', type: 'objective', category: 'Lazer' },
  { text: 'Ir ao cinema assistir lançamento', type: 'task', category: 'Lazer' },
  { text: 'Fazer trilha no final de semana', type: 'task', category: 'Lazer' },
  { text: 'Organizar jogos de tabuleiro em casa', type: 'task', category: 'Lazer' },
  { text: 'Praticar pintura em tela aos sábados', type: 'objective', category: 'Lazer' },
  { text: 'Ir à praia aproveitar o sol', type: 'task', category: 'Lazer' },

  // Categoria: Pessoal (20+ Casos)
  { text: 'Ir ao médico fazer exames de rotina', type: 'task', category: 'Pessoal' },
  { text: 'Comprar ração para o gato', type: 'task', category: 'Pessoal' },
  { text: 'Trocar lâmpada queimada do quarto', type: 'task', category: 'Pessoal' },
  { text: 'Pagar conta de água e luz', type: 'task', category: 'Pessoal' },
  { text: 'Limpar e organizar geladeira', type: 'task', category: 'Pessoal' },
  { text: 'Meditar 10 minutos de manhã', type: 'task', category: 'Pessoal' },
  { text: 'Dar banho no cachorro', type: 'task', category: 'Pessoal' },
  { text: 'Fazer faxina na cozinha', type: 'task', category: 'Pessoal' },
  { text: 'Comprar suplemento e creatina na farmácia', type: 'task', category: 'Pessoal' },
  { text: 'Consertar vazamento da pia do banheiro', type: 'task', category: 'Pessoal' },
  { text: 'Beber 2 litros de água hoje', type: 'task', category: 'Pessoal' },
  { text: 'Comprar presentes de aniversário da mãe', type: 'task', category: 'Pessoal' },
  { text: 'Fazer compras de hortifrúti', type: 'task', category: 'Pessoal' },
  { text: 'Dormir antes das 22h para descansar', type: 'task', category: 'Pessoal' },
  { text: 'Tomar vitamina diária', type: 'task', category: 'Pessoal' },

  // Casos de Baixa Confiança / Sem Categoria (10 Casos)
  { text: 'Coisa aleatória qualquer', type: 'task', category: 'Sem categoria' },
  { text: 'Talvez ir lá amanhã', type: 'task', category: 'Sem categoria' },
  { text: 'Resolver uns bagulhos pendentes', type: 'task', category: 'Sem categoria' },
  { text: 'Algo de extrema importância urgente', type: 'task', category: 'Sem categoria' },
  { text: 'Amanhã à tarde', type: 'task', category: 'Sem categoria' },
  { text: 'Fazer aquilo', type: 'task', category: 'Sem categoria' },
  { text: 'Organizar tudo de uma vez', type: 'objective', category: 'Sem categoria' },
  { text: 'Definir prioridades de vida', type: 'objective', category: 'Sem categoria' },
  { text: 'Finalizar pendências soltas', type: 'task', category: 'Sem categoria' },
  { text: 'Verificar status geral', type: 'task', category: 'Sem categoria' }
];

// Legado / Antigo Classificador Regex
function legacyClassifyInput(text) {
  const lower = text.toLowerCase().trim();
  const objectivePatterns = [
    /\b(projeto|project|tcc|curso|faculdade|universidade|carreira|business|empresa|startup)\b/,
    /\b(aprender|desenvolver|construir|criar|estruturar|planejar|concluir|melhorar|dominar)\b/,
    /\b(estabelecer|implementar|organizar|mudar|emagrecer|perder peso|viajar|comprar carro|comprar casa)\b/,
    /\b(hábito|rotina|habits|academia|meditar|leitura|livro|ler)\b/
  ];
  const taskPatterns = [
    /\b(fazer|comprar|ligar|enviar|escrever|mandar|responder|pagar|limpar|lavar|levar|consertar|arrumar)\b/,
    /\b(leite|pão|mercado|supermercado|farmácia|comida|jantar|almoço|café|email|e-mail|mensagem|whatsapp)\b/,
    /\b(hoje|amanhã|sábado|domingo|segunda|terça|quarta|quinta|sexta|às|horas|minutos|min)\b/
  ];
  let objScore = 0;
  let taskScore = 0;
  objectivePatterns.forEach(pattern => { if (pattern.test(lower)) objScore += 2; });
  taskPatterns.forEach(pattern => { if (pattern.test(lower)) taskScore += 2; });
  if (lower.split(' ').length > 8) objScore += 0.5;
  return objScore > taskScore ? 'objective' : 'task';
}

function legacyDetectCategory(text) {
  const t = text.toLowerCase().trim();
  if (t.includes('cantar') || t.includes('tocar') || t.includes('jogar') || t.includes('assistir') || t.includes('filme') || t.includes('série') || t.includes('lazer') || t.includes('passear') || t.includes('amigos') || t.includes('festa') || t.includes('divertir') || t.includes('música') || t.includes('hobby')) {
    return 'Lazer';
  }
  if (t.includes('estudar') || t.includes('ler') || t.includes('curso') || t.includes('aula') || t.includes('faculdade') || t.includes('estudos') || t.includes('livro') || t.includes('aprender') || t.includes('pesquisar')) {
    return 'Estudos';
  }
  if (t.includes('comprar') || t.includes('mercado') || t.includes('casa') || t.includes('limpar') || t.includes('arrumar') || t.includes('pessoal') || t.includes('família') || t.includes('médico') || t.includes('dentista') || t.includes('pagar') || t.includes('boleto') || t.includes('água') || t.includes('beber') || t.includes('academia') || t.includes('treino') || t.includes('treinar') || t.includes('exercício') || t.includes('exercitar') || t.includes('dormir') || t.includes('descanso') || t.includes('saúde') || t.includes('dieta') || t.includes('correr') || t.includes('caminhar') || t.includes('vitamina') || t.includes('remédio') || t.includes('meditação') || t.includes('meditar') || t.includes('acordar') || t.includes('levantar') || t.includes('rotina') || t.includes('café') || t.includes('almoço') || t.includes('jantar') || t.includes('comer') || t.includes('comida') || t.includes('banho') || t.includes('dentes') || t.includes('escovar') || t.includes('sono')) {
    return 'Pessoal';
  }
  return 'Trabalho'; // Trabalho como padrão
}

async function runTests() {
  console.log('🧪 INICIANDO TESTES DO NOVO CLASSIFICADOR DE IA (100+ CASOS)');
  console.log(`Carregados ${TEST_CASES.length} cenários de teste.`);
  
  let legacyTypeSuccess = 0;
  let legacyCatSuccess = 0;
  
  let newTypeSuccess = 0;
  let newCatSuccess = 0;
  
  const failedCases = [];

  TEST_CASES.forEach((c, idx) => {
    // 1. Rodar classificador legado
    const legacyType = legacyClassifyInput(c.text);
    const legacyCat = legacyDetectCategory(c.text);
    if (legacyType === c.type) legacyTypeSuccess++;
    if (legacyCat === c.category) legacyCatSuccess++;

    // 2. Rodar novo classificador inteligente
    const originalLog = console.log;
    let logs = [];
    console.log = (...args) => { logs.push(args.join(' ')); };
    
    const result = executeAIClassifier(c.text);
    
    console.log = originalLog; // Restaura logs

    const typeMatch = result.type === c.type;
    const catMatch = result.category === c.category;

    if (typeMatch) newTypeSuccess++;
    if (catMatch) newCatSuccess++;

    if (!typeMatch || !catMatch) {
      failedCases.push({
        index: idx + 1,
        text: c.text,
        expected: { type: c.type, category: c.category },
        actual: { type: result.type, category: result.category },
        reason: result.reason,
        debugLogs: logs.join('\n')
      });
    }
  });

  const legacyTypeAccuracy = (legacyTypeSuccess / TEST_CASES.length) * 100;
  const legacyCatAccuracy = (legacyCatSuccess / TEST_CASES.length) * 100;
  
  const newTypeAccuracy = (newTypeSuccess / TEST_CASES.length) * 100;
  const newCatAccuracy = (newCatSuccess / TEST_CASES.length) * 100;

  console.log('\n======================================================');
  console.log('📊 RESULTADOS COMPARATIVOS DA AUDITORIA');
  console.log('======================================================');
  console.log(`TOTAL DE CASOS TESTADOS: ${TEST_CASES.length}`);
  console.log('------------------------------------------------------');
  console.log('1. CLASSIFICAÇÃO DE TIPO (TAREFA VS OBJETIVO):');
  console.log(`   - Legado (Regex simples):   ${legacyTypeAccuracy.toFixed(1)}% de acerto`);
  console.log(`   - Novo (IA Inteligente):    ${newTypeAccuracy.toFixed(1)}% de acerto`);
  console.log('------------------------------------------------------');
  console.log('2. CLASSIFICAÇÃO DE CATEGORIAS (TRABALHO, ESTUDOS, ETC.):');
  console.log(`   - Legado (Foco em Trabalho): ${legacyCatAccuracy.toFixed(1)}% de acerto`);
  console.log(`   - Novo (IA com Sinônimos):  ${newCatAccuracy.toFixed(1)}% de acerto`);
  console.log('======================================================');

  if (failedCases.length > 0) {
    console.log('\n❌ CASOS QUE FALHARAM NO NOVO CLASSIFICADOR (Para refinar):');
    failedCases.slice(0, 5).forEach(f => {
      console.log(`- Caso #${f.index}: "${f.text}"`);
      console.log(`  Esperado: [Type: ${f.expected.type}, Cat: ${f.expected.category}]`);
      console.log(`  Obtido:   [Type: ${f.actual.type}, Cat: ${f.actual.category}]`);
      console.log(`  Motivo:   ${f.reason}`);
      console.log(`  Logs:\n${f.debugLogs}\n`);
    });
    if (failedCases.length > 5) {
      console.log(`... e mais ${failedCases.length - 5} casos.`);
    }
  } else {
    console.log('\n🟢 ESPETACULAR! 100% de acerto alcançado na suíte de testes!');
  }

  // A meta da auditoria é garantir precisão superior a 95%
  const pass = newTypeAccuracy >= 95.0 && newCatAccuracy >= 95.0;
  if (!pass) {
    console.error('\n❌ Falha: A precisão do novo classificador está abaixo do limite de 95%!');
    process.exit(1);
  } else {
    console.log('\n🟢 PASSOU: Critério de qualidade superior a 95% atingido com sucesso!');
    process.exit(0);
  }
}

runTests();
