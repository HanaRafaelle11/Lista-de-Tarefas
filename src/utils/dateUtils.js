/**
 * Central de Utilitários de Data e Hora com Suporte Robusto a Timezones (UTC / Local)
 * Garantia de conversão precisa de horário local para UTC antes da persistência no banco.
 */

/**
 * Combina data local (YYYY-MM-DD) e hora local (HH:mm) e converte para string ISO UTC exata.
 * Exemplo em UTC-3: '2026-06-28' + '23:30' -> '2026-06-29T02:30:00.000Z'
 */
export function combineDateAndTime(dateStr, timeStr) {
  if (!dateStr) return null;

  // Se já for uma string ISO completa contendo 'T' e 'Z', retorna limpa
  if (typeof dateStr === 'string' && dateStr.includes('T') && dateStr.endsWith('Z')) {
    return dateStr;
  }

  const cleanDate = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.split('T')[0] : String(dateStr);
  const parts = cleanDate.split('-');
  if (parts.length < 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month index 0-11
  const day = parseInt(parts[2], 10);

  let hours = 0;
  let minutes = 0;

  if (timeStr && typeof timeStr === 'string' && timeStr.trim().length >= 4) {
    const timeParts = timeStr.trim().split(':');
    hours = parseInt(timeParts[0], 10) || 0;
    minutes = parseInt(timeParts[1], 10) || 0;
  }

  // Cria o objeto Date no fuso horário local do navegador do usuário
  const localDate = new Date(year, month, day, hours, minutes, 0, 0);
  
  if (isNaN(localDate.getTime())) return null;

  // Retorna em formato ISO UTC padrão (Z) para salvar no Supabase (TIMESTAMPTZ)
  return localDate.toISOString();
}

/**
 * Extrai componentes de data (YYYY-MM-DD) e hora (HH:mm) no FUSO HORÁRIO LOCAL do usuário
 * a partir de uma string ISO UTC vinda do banco de dados.
 * Exemplo em UTC-3: '2026-06-29T02:30:00.000Z' -> { datePart: '2026-06-28', timePart: '23:30' }
 */
export function extractDateAndTimeParts(isoOrDateStr) {
  if (!isoOrDateStr) return { datePart: '', timePart: '' };

  const str = String(isoOrDateStr).trim();

  // Se não contiver indicação de horário, trata como data pura YYYY-MM-DD
  if (!str.includes('T') && str.length === 10) {
    return { datePart: str, timePart: '' };
  }

  const d = new Date(str);
  if (isNaN(d.getTime())) {
    const clean = str.includes('T') ? str.split('T')[0] : str.substring(0, 10);
    return { datePart: clean, timePart: '' };
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  const datePart = `${year}-${month}-${day}`;
  const timePart = (hours === '00' && minutes === '00') ? '' : `${hours}:${minutes}`;

  return { datePart, timePart };
}

/**
 * Formata a data para exibição no fuso horário local do usuário (ex: "Hoje", "Amanhã", "Ontem" ou "28/06/2026").
 */
export function formatTaskDateDisplay(dueDateStr) {
  if (!dueDateStr) return '';

  const { datePart } = extractDateAndTimeParts(dueDateStr);
  if (!datePart || datePart.length < 10) return String(dueDateStr);

  const parts = datePart.split('-');
  if (parts.length !== 3) return datePart;

  const [year, month, day] = parts;
  const targetDateStr = `${year}-${month}-${day}`;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (targetDateStr === todayStr) return 'Hoje';
  if (targetDateStr === tomorrowStr) return 'Amanhã';
  if (targetDateStr === yesterdayStr) return 'Ontem';

  return `${day}/${month}/${year}`;
}

/**
 * Extrai e formata a hora no fuso horário local do usuário (ex: "23:30").
 */
export function formatTaskTimeDisplay(dueDateStr, legacyDueTime) {
  // O legacyDueTime (meta.due_time) é a única fonte real de horário definida pelo usuário
  return legacyDueTime && legacyDueTime !== '00:00' ? legacyDueTime : '';
}

/**
 * Verifica se a tarefa está atrasada comparando o timestamp com o horário atual do usuário.
 */
export function isTaskOverdue(dueDateStr, completed, userDueTime = '') {
  if (completed || !dueDateStr) return false;

  const { datePart } = extractDateAndTimeParts(dueDateStr);
  if (!datePart) return false;

  const now = new Date();
  const activeTime = userDueTime || '';
  if (activeTime) {
    const [hours, minutes] = activeTime.split(':').map(Number);
    const [year, month, day] = datePart.split('-').map(Number);
    const taskDateTime = new Date(year, month - 1, day, hours, minutes, 59, 999);
    return taskDateTime < now;
  } else {
    const [year, month, day] = datePart.split('-').map(Number);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    return endOfDay < now;
  }
}

/**
 * Intercepta datas no formato puro YYYY-MM-DD e as define no formato de meio-dia local (T12:00:00).
 * Isso impede que a conversão ISO subsequente desloque a data para o dia anterior no Brasil.
 */
export function ensureDateTimezoneNoon(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return `${str}T12:00:00`;
  }
  return dateStr;
}
