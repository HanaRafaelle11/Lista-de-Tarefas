export function addToGoogleCalendar(task) {
  if (!task || !task.title || !task.dueDate) {
    console.warn("Não é possível adicionar ao Google Calendar: A tarefa deve ter um título e uma data de vencimento.");
    return;
  }

  const cleanDescription = task.description ? task.description.split('--flowday-meta--')[0].trim() : '';
  const tarefa = {
    titulo: task.title,
    data_limite: task.dueDate,
    descricao: cleanDescription,
  };
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=[MyFlowDay]%20${encodeURIComponent(tarefa.titulo)}&dates=${tarefa.data_limite.replace(/-/g, '')}/${tarefa.data_limite.replace(/-/g, '')}&details=${encodeURIComponent(tarefa.descricao)}&sf=true&output=xml`;
  window.open(url, '_blank');
}

export function exportAllTasksToCalendar(tasks) {
  if (!tasks || !Array.isArray(tasks)) {
    console.warn("Nenhuma tarefa para exportar.");
    return;
  }

  const scheduledTasks = tasks.filter(t => t.dueDate && !t.completed);
  if (scheduledTasks.length === 0) {
    throw new Error("Você não possui tarefas ativas agendadas no momento.");
  }

  const now = new Date();
  const formatICalDate = (dateStr) => {
    if (!dateStr) return '';
    return dateStr.replace(/-/g, '');
  };

  const formatICalDateTime = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const dtStamp = formatICalDateTime(now);

  const events = scheduledTasks.map(task => {
    const uid = `flowday-${task.id}-${Date.now()}@myflowday.com.br`;
    const startDate = formatICalDate(task.dueDate);
    
    let descriptionText = '';
    if (task.description) {
      descriptionText = task.description.split('--flowday-meta--')[0].trim();
    }

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${startDate}`,
      `SUMMARY:${task.title}`,
      descriptionText ? `DESCRIPTION:${descriptionText.replace(/\n/g, '\\n').substring(0, 255)}` : '',
      `CATEGORIES:${task.category || 'Geral'},${task.priority || 'Normal'}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Lembrete — MyFlowDay',
      'END:VALARM',
      'END:VEVENT'
    ].filter(Boolean).join('\r\n');
  }).join('\r\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MyFlowDay//MyFlowDay App//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `myflowday-calendar.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
