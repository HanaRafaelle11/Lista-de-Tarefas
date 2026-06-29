import React, { useState } from 'react';
import { Calendar, Trash2, Edit2, AlertCircle, CalendarPlus, Check, Repeat, Unlink, Copy, Clock } from 'lucide-react';
import { parseTaskMetadata, formatDescriptionWithoutMetadata, useAppContext } from '../contexts/AppContext';
import { formatTaskDateDisplay, formatTaskTimeDisplay } from '../utils/dateUtils';
import CategoryIcon from './CategoryIcon';

// ─── Redireciona para o Google Calendar web pré-preenchido ───────────────────
function exportTaskToCalendar(task) {
  const cleanDescription = formatDescriptionWithoutMetadata(task.description);
  const dataLimite = task.dueDate ? task.dueDate.split('T')[0] : new Date().toISOString().split('T')[0];
  const tarefa = {
    titulo: task.title,
    data_limite: dataLimite,
    descricao: cleanDescription || '',
  };
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=[MyFlowDay]%20${encodeURIComponent(tarefa.titulo)}&dates=${tarefa.data_limite.replace(/-/g, '')}/${tarefa.data_limite.replace(/-/g, '')}&details=${encodeURIComponent(tarefa.descricao)}&sf=true&output=xml`;
  window.open(url, '_blank');
}

export default function TodoItem({ item, onToggleComplete, onDelete, onEdit, goalId, onUnlinkGoal, onDuplicate }) {
  const [calExported, setCalExported] = useState(false);
  const { isPro, openPaywall } = useAppContext();

  const handleExportCalendar = () => {
    if (!isPro) {
      openPaywall('google_calendar_task_item');
      return;
    }
    exportTaskToCalendar(item);
    setCalExported(true);
    setTimeout(() => setCalExported(false), 2500);
  };

  // Verificar se a tarefa está atrasada
  const isOverdue = () => {
    if (item.completed || !item.dueDate) return false;
    
    const now = new Date();
    const dateStr = item.dueDate.includes('T') ? item.dueDate : `${item.dueDate}T23:59:59`;
    const taskDate = new Date(dateStr);
    
    return taskDate < now;
  };

  const overdue = isOverdue();
  const meta = parseTaskMetadata(item.description);
  const cleanDescription = formatDescriptionWithoutMetadata(item.description);

  const dateText = formatTaskDateDisplay(item.dueDate);
  const timeText = formatTaskTimeDisplay(item.dueDate, meta.due_time);

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

        {/* Metadados: Tags, Data e Hora */}
        <div className="todo-item-meta-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          {/* Categoria */}
          <span className={`badge-category ${item.category ? item.category.toLowerCase() : 'trabalho'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CategoryIcon categoryId={item.category || 'Trabalho'} size={12} />
            <span>{item.category || 'Trabalho'}</span>
          </span>

          {/* Prioridade */}
          <span className={`badge-priority ${(item.priority || 'Média').toLowerCase()}`}>
            {item.priority || 'Média'}
          </span>

          {/* Vencimento com Horário Limpo */}
          {item.dueDate && (
            <div className={`todo-item-date-wrapper ${overdue ? 'date-overdue' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600' }}>
              <Calendar size={13} />
              <span className="todo-item-date-text">
                {dateText}
              </span>
              {timeText && (
                <>
                  <span style={{ opacity: 0.5 }}>•</span>
                  <Clock size={12} style={{ marginLeft: '2px' }} />
                  <span>{timeText}</span>
                </>
              )}
            </div>
          )}

          {/* Recorrência */}
          {meta.recurrence && meta.recurrence !== 'nenhuma' && (
            <span className="badge-priority baixa" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Repeat size={12} />
              <span style={{ textTransform: 'capitalize' }}>{meta.recurrence}</span>
            </span>
          )}
        </div>
      </div>

      {/* Ações (Agenda / Editar / Excluir) */}
      <div className="todo-item-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Botão Adicionar à Agenda */}
        <button
          onClick={handleExportCalendar}
          className="todo-item-action-btn"
          title={calExported ? 'Abrindo Google Calendar...' : 'Adicionar ao Google Calendar'}
          aria-label="Adicionar tarefa ao Google Calendar"
          style={{
            color: calExported ? '#22c55e' : 'var(--text-light)',
            transition: 'color 0.3s',
          }}
        >
          {calExported ? <Check size={15} /> : <CalendarPlus size={15} />}
        </button>

        {goalId && onUnlinkGoal && (
          <button 
            onClick={() => {
              if (window.confirm("Deseja realmente desvincular esta tarefa do objetivo? Ela voltará para a lista de tarefas gerais.")) {
                onUnlinkGoal(goalId, item.id);
              }
            }}
            className="todo-item-action-btn unlink-btn"
            title="Desvincular do objetivo"
            aria-label="Desvincular do objetivo"
            style={{ color: 'var(--text-light)' }}
          >
            <Unlink size={15} />
          </button>
        )}

        {onDuplicate && (
          <button 
            onClick={() => onDuplicate(item.id)}
            className="todo-item-action-btn duplicate-btn"
            title="Duplicar tarefa"
          >
            <Copy size={14} />
          </button>
        )}

        {!item.completed && (
          <button 
            onClick={() => onEdit(item)}
            className="todo-item-action-btn edit-btn"
            title="Editar tarefa"
          >
            <Edit2 size={15} />
          </button>
        )}
        
        {/* Botão Excluir Restaurado e Destacado */}
        <button 
          onClick={() => {
            if (onDelete) onDelete(item.id);
          }}
          className="todo-item-action-btn delete-btn"
          title="Excluir tarefa"
          aria-label="Excluir tarefa"
          style={{ color: 'var(--danger)', cursor: 'pointer' }}
        >
          <Trash2 size={15} />
        </button>
      </div>

    </div>
  );
}
