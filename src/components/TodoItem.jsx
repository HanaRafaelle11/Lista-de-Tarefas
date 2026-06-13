import React from 'react';
import { Calendar, Trash2, Edit2, AlertCircle } from 'lucide-react';

export default function TodoItem({ item, onToggleComplete, onDelete, onEdit }) {
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

        {item.description && (
          <p className="todo-item-description">
            {item.description}
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
              <span className="todo-item-date-text">{formatDueDate(item.dueDate)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Ações (Editar / Excluir) */}
      <div className="todo-item-actions">
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
