import React, { useState } from 'react';
import { Calendar, Trash2, Edit2, AlertCircle, CalendarPlus, Check, Repeat } from 'lucide-react';
import { parseTaskMetadata, formatDescriptionWithoutMetadata } from '../contexts/AppContext';
import CategoryIcon from './CategoryIcon';

// ─── Redireciona para o Google Calendar web pré-preenchido ───────────────────
function exportTaskToCalendar(task) {
  const cleanDescription = formatDescriptionWithoutMetadata(task.description);
  const tarefa = {
    titulo: task.title,
    data_limite: task.dueDate || new Date().toISOString().split('T')[0],
    descricao: cleanDescription || '',
  };
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=[MyFlowDay]%20${encodeURIComponent(tarefa.titulo)}&dates=${tarefa.data_limite.replace(/-/g, '')}/${tarefa.data_limite.replace(/-/g, '')}&details=${encodeURIComponent(tarefa.descricao)}&sf=true&output=xml`;
  window.open(url, '_blank');
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
  const formatarDataBR = (str) => {
    if (!str) return '';
    const p = str.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : new Date(str).toLocaleDateString('pt-BR');
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
          <span className={`badge-category ${item.category.toLowerCase()}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CategoryIcon categoryId={item.category} size={12} />
            <span>{item.category}</span>
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
                {formatarDataBR(item.dueDate)}
                {meta.due_time && ` às ${meta.due_time}`}
              </span>
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
      <div className="todo-item-actions">
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
