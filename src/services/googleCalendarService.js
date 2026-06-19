export function addToGoogleCalendar(task) {
  if (!task || !task.title || !task.dueDate) {
    console.warn("Não é possível adicionar ao Google Calendar: A tarefa deve ter um título e uma data de vencimento.");
    return;
  }

  // Formata data e hora para a URL do Google Calendar
  // Google Calendar espera YYYYMMDD ou YYYYMMDDTHHMMSSZ
  const startDate = new Date(task.dueDate);
  const endDate = new Date(task.dueDate); // Para eventos de um único dia

  let dates = startDate.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD

  if (task.dueTime) {
    // Assumindo que task.dueTime está no formato HH:MM
    const [hours, minutes] = task.dueTime.split(':').map(Number);
    startDate.setHours(hours, minutes, 0, 0);
    endDate.setHours(hours + 1, minutes, 0, 0); // Padrão para evento de 1 hora

    const formatTime = (date) => {
      // Supabase armazena datas em UTC, então convertemos para local antes de formatar para GCal para evitar deslocamento de fuso.
      // Ou, se a data do Supabase for sem fuso, tratamos como local. Aqui, estamos tratando task.dueDate como local.
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      const second = String(date.getSeconds()).padStart(2, '0');
      return `${year}${month}${day}T${hour}${minute}${second}`; // YYYYMMDDTHHMMSS (sem Z para ser interpretado como local)
    };
    dates = `${formatTime(startDate)}/${formatTime(endDate)}`;
  } else {
    // Evento de dia inteiro
    endDate.setDate(endDate.getDate() + 1); // Eventos de dia inteiro do Google Calendar são exclusivos da data final
    dates = `${startDate.toISOString().split('T')[0].replace(/-/g, '')}/${endDate.toISOString().split('T')[0].replace(/-/g, '')}`;
  }

  const calendarUrl = new URL('https://calendar.google.com/calendar/render');
  calendarUrl.searchParams.append('action', 'TEMPLATE');
  calendarUrl.searchParams.append('text', task.title);
  calendarUrl.searchParams.append('dates', dates);
  if (task.description) {
    calendarUrl.searchParams.append('details', task.description);
  }
  // Opcional: location (task.location se existir)
  // calendarUrl.searchParams.append('location', task.location);

  console.log("URL do Google Calendar gerada:", calendarUrl.toString());
  window.open(calendarUrl.toString(), '_blank');
}

export function exportAllTasksToCalendar(tasks) {
  if (!tasks || !Array.isArray(tasks)) {
    console.warn("Nenhuma tarefa para exportar.");
    return;
  }

  const scheduledTasks = tasks.filter(t => t.dueDate && !t.completed);
  if (scheduledTasks.length === 0) {
    alert("Você não possui tarefas ativas agendadas no momento.");
    return;
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
