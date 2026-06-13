import React, { useState, useMemo } from 'react';
import { X, Search, Check, Link2, Unlink } from 'lucide-react';

function formatDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const priorityDot = { Alta: '🔴', Média: '🟡', Baixa: '🟢' };
const categoryEmoji = { Trabalho: '💼', Pessoal: '🏠', Estudos: '📚', Lazer: '🎸' };

export default function GoalTasksModal({ isOpen, onClose, goal, tasks, linkedTaskIds, onLink, onUnlink }) {
  const [search, setSearch] = useState('');

  const pendingTasks = useMemo(
    () => tasks.filter(t => !t.completed),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const q = search.toLowerCase();
    return pendingTasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      t.category.toLowerCase().includes(q)
    );
  }, [pendingTasks, search]);

  const linkedCount = linkedTaskIds.length;

  if (!isOpen || !goal) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content goal-tasks-modal animate-scale-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="todo-modal-header">
          <div className="tasks-modal-title-wrap">
            <span className="tasks-modal-icon">{goal.icon}</span>
            <div>
              <h2 className="todo-modal-title">Tarefas vinculadas</h2>
              <p className="goal-tasks-modal-subtitle">
                {goal.title} · {linkedCount} tarefa{linkedCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="todo-modal-close-btn" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div className="goal-tasks-modal-body">
          {/* Instruções */}
          <p className="goal-tasks-modal-info">
            Selecione tarefas pendentes para vincular a este objetivo. O progresso é calculado automaticamente.
          </p>

          {/* Busca */}
          <div className="tasks-search-wrap" style={{ marginBottom: '12px' }}>
            <Search size={15} className="tasks-search-icon" />
            <input
              type="text"
              placeholder="Buscar tarefas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="tasks-search-input"
              autoFocus
            />
          </div>

          {/* Lista de tarefas */}
          <div className="goal-tasks-list">
            {filteredTasks.length === 0 ? (
              <div className="goal-tasks-empty">
                <span style={{ fontSize: '28px' }}>📭</span>
                <p>{search ? 'Nenhuma tarefa encontrada para essa busca.' : 'Nenhuma tarefa pendente disponível.'}</p>
              </div>
            ) : (
              filteredTasks.map(task => {
                const isLinked = linkedTaskIds.includes(task.id);
                return (
                  <div
                    key={task.id}
                    className={`goal-task-row ${isLinked ? 'goal-task-row--linked' : ''}`}
                    onClick={() => isLinked ? onUnlink(task.id) : onLink(task.id)}
                  >
                    {/* Checkbox visual */}
                    <div className={`goal-task-check ${isLinked ? 'checked' : ''}`}>
                      {isLinked && <Check size={12} strokeWidth={3} />}
                    </div>

                    {/* Conteúdo da tarefa */}
                    <div className="goal-task-content">
                      <span className="goal-task-title">{task.title}</span>
                      <div className="goal-task-meta">
                        <span>{categoryEmoji[task.category] || '📋'} {task.category}</span>
                        <span>{priorityDot[task.priority]} {task.priority}</span>
                        {task.dueDate && (
                          <span>📅 {formatDate(task.dueDate)}</span>
                        )}
                      </div>
                    </div>

                    {/* Ação */}
                    <button
                      className={`goal-task-action-btn ${isLinked ? 'unlink' : 'link'}`}
                      onClick={e => {
                        e.stopPropagation();
                        isLinked ? onUnlink(task.id) : onLink(task.id);
                      }}
                      title={isLinked ? 'Desvincular' : 'Vincular'}
                    >
                      {isLinked ? <Unlink size={14} /> : <Link2 size={14} />}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="goal-tasks-modal-footer">
          <span className="goal-tasks-modal-count">
            {linkedCount} tarefa{linkedCount !== 1 ? 's' : ''} vinculada{linkedCount !== 1 ? 's' : ''}
          </span>
          <button onClick={onClose} className="btn-primary-glow" style={{ padding: '9px 20px', borderRadius: '8px', fontSize: '13.5px' }}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
