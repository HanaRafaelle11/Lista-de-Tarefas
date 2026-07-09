import React, { useState, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { X, Search, Check, Link2, Unlink, Tag, AlertCircle, Calendar, Inbox, Trash2, Plus } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

function GoalIcon({ name, size = 18, className = '' }) {
  if (!name) return null;
  const isEmoji = /\p{Emoji}/u.test(name) && !/^[a-zA-Z0-9-]+$/.test(name);
  if (isEmoji) {
    return <span className={className} role="img" aria-label="ícone">{name}</span>;
  }
  
  const iconMap = {
    target: LucideIcons.Target,
    rocket: LucideIcons.Rocket,
    book: LucideIcons.BookOpen,
    dollar: LucideIcons.DollarSign,
    home: LucideIcons.Home,
    globe: LucideIcons.Globe,
    dumbbell: LucideIcons.Dumbbell,
    brain: LucideIcons.Brain,
    heart: LucideIcons.Heart,
    palette: LucideIcons.Palette,
    music: LucideIcons.Music,
    plane: LucideIcons.Plane,
    sprout: LucideIcons.Sprout,
    trending: LucideIcons.TrendingUp,
    star: LucideIcons.Star,
    users: LucideIcons.Users,
  };

  const IconComponent = iconMap[name.toLowerCase()] || LucideIcons.Target;
  return <IconComponent size={size} className={className} />;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const priorityColors = { Alta: '#ef4444', Média: '#f59e0b', Baixa: '#10b981' };

export default function GoalTasksModal({ isOpen, onClose, goal, tasks, linkedTaskIds, onLink, onUnlink, onDeleteTask }) {
  console.log('[GoalTasksModal] isOpen:', isOpen, 'goal:', goal?.title, 'tasksCount:', tasks?.length, 'linkedTaskIds:', linkedTaskIds);
  const { handleAddTask, openCustomConfirm, handleUpdateTask } = useAppContext();
  const [search, setSearch] = useState('');
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [isCreatingQuickTask, setIsCreatingQuickTask] = useState(false);

  // ESC key listener
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleQuickCreate = async (e) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    
    setIsCreatingQuickTask(true);
    try {
      const newTask = await handleAddTask({
        title: quickTaskTitle.trim(),
        category: 'Geral',
        priority: 'Média',
        dueDate: '',
        description: '',
      });
      if (newTask && newTask.id) {
        await onLink(newTask.id);
      }
      setQuickTaskTitle('');
    } catch (err) {
      console.error('[GoalTasksModal] Error creating quick task:', err);
    } finally {
      setIsCreatingQuickTask(false);
    }
  };

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

  const completedLinkedTasks = useMemo(() => {
    return tasks.filter(t => linkedTaskIds.includes(t.id) && t.completed && !t.deletedAt && !t.deleted_at);
  }, [tasks, linkedTaskIds]);

  const linkedCount = linkedTaskIds.length;

  if (!isOpen || !goal) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content goal-tasks-modal animate-scale-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="todo-modal-header">
          <div className="tasks-modal-title-wrap">
            <span className="tasks-modal-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <GoalIcon name={goal.icon} size={20} />
            </span>
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

          {/* Criar nova tarefa rápido */}
          <form onSubmit={handleQuickCreate} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Criar nova tarefa e vincular..."
              value={quickTaskTitle}
              onChange={(e) => setQuickTaskTitle(e.target.value)}
              disabled={isCreatingQuickTask}
              className="tasks-search-input"
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              disabled={!quickTaskTitle.trim() || isCreatingQuickTask}
              className="btn-primary-glow"
              style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', fontSize: '13px' }}
            >
              <Plus size={14} />
              <span>{isCreatingQuickTask ? '...' : 'Adicionar'}</span>
            </button>
          </form>

          {/* Lista de tarefas */}
          <div className="goal-tasks-list">
            {filteredTasks.length === 0 ? (
              <div className="goal-tasks-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
                <Inbox size={28} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                <p style={{ margin: 0, textAlign: 'center' }}>{search ? 'Nenhuma tarefa encontrada para essa busca.' : 'Nenhuma tarefa pendente disponível.'}</p>
              </div>
            ) : (
              filteredTasks.map(task => {
                const isLinked = linkedTaskIds.includes(task.id);
                const priorityColor = priorityColors[task.priority] || 'var(--text-muted)';
                return (
                  <div
                    key={task.id}
                    className={`goal-task-row ${isLinked ? 'goal-task-row--linked' : ''}`}
                    onClick={() => {
                      console.log('[GoalTasksModal] Row clicked, isLinked:', isLinked, 'task.id:', task.id);
                      isLinked ? onUnlink(task.id) : onLink(task.id);
                    }}
                  >
                    {/* Checkbox visual */}
                    <div className={`goal-task-check ${isLinked ? 'checked' : ''}`}>
                      {isLinked && <Check size={12} strokeWidth={3} />}
                    </div>

                    {/* Conteúdo da tarefa */}
                    <div className="goal-task-content">
                      <span className="goal-task-title">{task.title}</span>
                      <div className="goal-task-meta">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Tag size={11} /> {task.category}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: priorityColor }}>
                          <AlertCircle size={11} color={priorityColor} /> {task.priority}
                        </span>
                        {task.dueDate && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Calendar size={11} /> {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        className={`goal-task-action-btn ${isLinked ? 'unlink' : 'link'}`}
                        onClick={e => {
                          e.stopPropagation();
                          console.log('[GoalTasksModal] Button clicked, isLinked:', isLinked, 'task.id:', task.id);
                          isLinked ? onUnlink(task.id) : onLink(task.id);
                        }}
                        title={isLinked ? 'Desvincular' : 'Vincular'}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {isLinked ? <Unlink size={14} /> : <Link2 size={14} />}
                      </button>

                      {isLinked && onDeleteTask && (
                        <button
                          className="goal-task-action-btn delete"
                          onClick={e => {
                            e.stopPropagation();
                            openCustomConfirm(
                              "Deseja realmente apagar esta tarefa por completo? Ela será removida de toda a lista de tarefas.",
                              "Excluir Tarefa",
                              () => onDeleteTask(task.id)
                            );
                          }}
                          title="Excluir tarefa por completo"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {completedLinkedTasks.length > 0 && (
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '750', color: 'var(--text-light)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={14} style={{ color: '#10b981' }} />
                <span>Tarefas Concluídas Vinculadas ({completedLinkedTasks.length})</span>
              </h3>
              <div className="goal-tasks-list">
                {completedLinkedTasks.map(task => {
                  return (
                    <div key={task.id} className="goal-task-row goal-task-row--linked" style={{ opacity: 0.8, cursor: 'default' }}>
                      <div className="goal-task-check checked" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981' }}>
                        <Check size={12} strokeWidth={3} style={{ color: '#10b981' }} />
                      </div>
                      <div className="goal-task-content" style={{ textDecoration: 'line-through', opacity: 0.6 }}>
                        <span className="goal-task-title">{task.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          className="goal-task-reactivate-btn"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleUpdateTask(task.id, { completed: false, completedAt: null });
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            color: 'var(--primary)',
                            backgroundColor: 'var(--primary-glow)',
                            border: '1px solid var(--primary-light)',
                            cursor: 'pointer'
                          }}
                        >
                          <LucideIcons.RotateCcw size={10} />
                          Reativar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
