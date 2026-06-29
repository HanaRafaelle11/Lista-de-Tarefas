/**
 * Utilities para manipulação unificada de Data + Hora (Timestamp) no MyFlowDay
 */

/**
 * Combina uma string de data (YYYY-MM-DD) e uma string de hora (HH:mm) em um timestamp ISO completo.
 * Exemplo: '2026-06-28' e '22:55' -> '2026-06-28T22:55:00'
 */
export function combineDateAndTime(dateStr, timeStr) {
  if (!dateStr) return null;
  
  // Se já for uma string ISO contendo 'T', extrai apenas a parte da data YYYY-MM-DD
  const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  
  if (!cleanDate || cleanDate.length < 10) return null;

  const cleanTime = (timeStr && timeStr.trim().length >= 4) ? timeStr.trim() : '00:00';
  const seconds = cleanTime.length === 5 ? ':00' : '';

  return `${cleanDate}T${cleanTime}${seconds}`;
}

/**
 * Extrai componentes YYYY-MM-DD e HH:mm de uma string ISO ou data legada.
 */
export function extractDateAndTimeParts(isoOrDateStr) {
  if (!isoOrDateStr) return { datePart: '', timePart: '' };

  const str = String(isoOrDateStr).trim();
  if (str.includes('T')) {
    const [d, t] = str.split('T');
    const timePart = t ? t.substring(0, 5) : '';
    return { datePart: d, timePart: timePart === '00:00' ? '' : timePart };
  }

  // Se for apenas YYYY-MM-DD
  if (str.length >= 10) {
    return { datePart: str.substring(0, 10), timePart: '' };
  }

  return { datePart: str, timePart: '' };
}

/**
 * Formata a data para exibição amigável em português (ex: "Hoje", "Amanhã", "Ontem" ou "28/06/2026").
 * Nunca gera strings corrompidas como "28T00:00:00...".
 */
export function formatTaskDateDisplay(dueDateStr) {
  if (!dueDateStr) return '';
  
  const cleanDate = String(dueDateStr).includes('T') ? String(dueDateStr).split('T')[0] : String(dueDateStr).substring(0, 10);
  const parts = cleanDate.split('-');
  
  if (parts.length !== 3) return cleanDate;

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
 * Extrai e formata o horário para exibição (ex: "22:55").
 */
export function formatTaskTimeDisplay(dueDateStr, legacyDueTime) {
  if (dueDateStr && String(dueDateStr).includes('T')) {
    const timePart = String(dueDateStr).split('T')[1]?.substring(0, 5);
    if (timePart && timePart !== '00:00') return timePart;
  }
  return legacyDueTime && legacyDueTime !== '00:00' ? legacyDueTime : '';
}
