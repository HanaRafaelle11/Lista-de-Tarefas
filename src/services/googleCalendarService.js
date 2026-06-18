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
