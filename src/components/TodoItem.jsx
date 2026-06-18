import React, { useState } from 'react';
import { Calendar, Trash2, Edit2, AlertCircle, CalendarPlus, Check } from 'lucide-react';
import { parseTaskMetadata, formatDescriptionWithoutMetadata } from '../contexts/AppContext';

// ─── Gera e faz download de um arquivo .ics (iCalendar) para a tarefa ─────────
function exportTaskToCalendar(task) {
  const now = new Date();
  const uid = `flowday-${task.id}-${Date.now()}@myflowday.app`;

  // Formata data no padrão iCal: YYYYMMDD
  const formatICalDate = (dateStr) => {
    if (!dateStr) return null;
    return dateStr.replace(/-/g, '');
  };

  // Formata timestamp no padrão iCal: YYYYMMDDTHHmmssZ
  const formatICalDateTime = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const dtStamp = formatICalDateTime(now);
  const startDate = task.dueDate ? formatICalDate(task.dueDate) : formatICalDate(now.toISOString().split('T')[0]);

  // Constrói o conteúdo do arquivo .ics
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MyFlowDay//MyFlowDay App//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${startDate}`,
    `SUMMARY:${task.title}`,
    task.description ? `DESCRIPTION:${task.description.replace(/\n/g, '\\n').substring(0, 255)}` : '',
    `CATEGORIES:${task.category || 'Geral'},${task.priority || 'Normal'}`,
    `STATUS:${task.completed ? 'COMPLETED' : 'CONFIRMED'}`,
    `PRIORITY:${task.priority === 'Alta' ? 1 : task.priority === 'Média' ? 5 : 9}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lembrete — MyFlowDay',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  // Cria e dispara o download do arquivo .ics
  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${task.title.replace(/[^a-zA-Z0-9\u00C0-\u017F ]/g, '').trim().substring(0, 40)}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


export default function TodoItem({ item, onToggleComplete, onDelete, onEdit }) {
  const [calExported, setCalExported] = useState(false);

  const handleExportCalendar = () => {
    exportTaskToCalendar(item);
    setCalExported(true);
    setTimeout(() => setCalExported(false), 2500);
  };

  // Verificar se a tarefa está atrasada
  const isOverdue = () => {
    if (item.completed) return false;
    if (!item.dueDate) return false;
    
    // Obter data atual zerada (sem horas)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Obter data de vencimento zerada
    const dueDate = new Date(item.dueDate + 'T00:00:00'); // Trata timezone local
    dueDate.setHours(0, 0, 0, 0);
    
    return dueDate < today;
  };

  // Formatar data em formato brasileiro dd/mm/aaaa
  const formatDueDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const overdue = isOverdue();
  const meta = parseTaskMetadata(item.description);
  const cleanDescription = formatDescriptionWithoutMetadata(item.description);

  return (
    <div 
      className={`todo-item-card ${item.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''} animate-fade-in`}
    >
      {/* Checkbox Customizado */}
      <div 
        onClick={() => onToggleComplete(item.id)}
        className={`custom-checkbox ${item.completed ? 'checked' : ''}`}
        title={item.completed ? 'Marcar como pendente' : 'Marcar como concluída'}
      />

      {/* Conteúdo Central */}
      <div className="todo-item-content">
        <div className="todo-item-title-wrapper">
          <h3 className="todo-item-title">
            {item.title}
          </h3>
          
          {/* Seletor de data atrasada */}
          {overdue && (
            <span className="todo-item-overdue-badge" title="Tarefa atrasada!">
              <AlertCircle size={11} />
              <span>Atrasada</span>
            </span>
          )}
        </div>

        {cleanDescription && (
          <p className="todo-item-description">
            {cleanDescription}
          </p>
        )}

        {/* Metadados: Tags e Data */}
        <div className="todo-item-meta-row">
          {/* Categoria */}
          <span className={`badge-category ${item.category.toLowerCase()}`}>
            {item.category}
          </span>

          {/* Prioridade */}
          <span className={`badge-priority ${item.priority.toLowerCase()}`}>
            {item.priority}
          </span>

          {/* Vencimento */}
          {item.dueDate && (
            <div className={`todo-item-date-wrapper ${overdue ? 'date-overdue' : ''}`}>
              <Calendar size={13} />
              <span className="todo-item-date-text">
                {formatDueDate(item.dueDate)}
                {meta.due_time && ` às ${meta.due_time}`}
              </span>
            </div>
          )}

          {/* Recorrência */}
          {meta.recurrence && meta.recurrence !== 'nenhuma' && (
            <span className="badge-priority baixa" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>🔄</span>
              <span style={{ textTransform: 'capitalize' }}>{meta.recurrence}</span>
            </span>
          )}
        </div>
      </div>

      {/* Ações (Agenda / Editar / Excluir) */}
      <div className="todo-item-actions">
        {/* Botão Adicionar à Agenda */}
        <button
          onClick={handleExportCalendar}
          className="todo-item-action-btn"
          title={calExported ? 'Adicionado!' : 'Adicionar à Agenda (.ics)'}
          aria-label={calExported ? 'Tarefa exportada para agenda' : 'Exportar para agenda'}
          style={{
            color: calExported ? '#22c55e' : 'var(--text-light)',
            transition: 'color 0.3s',
          }}
        >
          {calExported ? <Check size={15} /> : <CalendarPlus size={15} />}
        </button>

        {!item.completed && (
          <button 
            onClick={() => onEdit(item)}
            className="todo-item-action-btn edit-btn"
            title="Editar tarefa"
          >
            <Edit2 size={15} />
          </button>
        )}
        
        <button 
          onClick={() => onDelete(item.id)}
          className="todo-item-action-btn delete-btn"
          title="Excluir tarefa"
        >
          <Trash2 size={15} />
        </button>
      </div>

    </div>
  );
}
