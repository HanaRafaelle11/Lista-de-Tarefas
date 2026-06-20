import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Calendar, MoreVertical, Trash2, Archive, CheckCircle, RotateCcw, Link2, Edit2, Award, Clock } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

// Componente para renderizar ícone do objetivo (Lucide ou Emoji)
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
  return <IconComponent size={size} className={className} style={{ color: 'var(--goal-color, var(--primary))' }} />;
}

// Formata data para pt-BR legível
function formatDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${parts[2]} de ${months[parseInt(parts[1]) - 1]} de ${parts[0]}`;
}

// Menu de ações suspenso
function GoalMenu({ goal, onEdit, onComplete, onArchive, onRestore, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="goal-menu-wrap" ref={menuRef}>
      <button
        className="goal-menu-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label="Opções do objetivo"
        title="Opções"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="goal-menu-dropdown animate-scale-up">
          {goal.status === 'active' && (
            <>
              <button className="goal-menu-item" onClick={() => { onEdit(goal); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Edit2 size={13} /> Editar
              </button>
              <button className="goal-menu-item" onClick={() => { onComplete(goal.id); setOpen(false); }}>
                <CheckCircle size={14} /> Concluir objetivo
              </button>
              <button className="goal-menu-item" onClick={() => { onArchive(goal.id); setOpen(false); }}>
                <Archive size={14} /> Arquivar
              </button>
            </>
          )}
          {(goal.status === 'completed' || goal.status === 'archived') && (
            <button className="goal-menu-item" onClick={() => { onRestore(goal.id); setOpen(false); }}>
              <RotateCcw size={14} /> Restaurar como ativo
            </button>
          )}
          <div className="goal-menu-divider" />
          <button className="goal-menu-item goal-menu-item--danger" onClick={() => { onDelete(goal.id); setOpen(false); }}>
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}

export default function GoalCard({
  goal,
  linkedTasks,
  onEdit,
  onComplete,
  onArchive,
  onRestore,
  onDelete,
  onManageTasks,
}) {
  const totalTasks = linkedTasks.length;
  const completedTasks = linkedTasks.filter(t => t.completed).length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const isCompleted = goal.status === 'completed';
  const isArchived = goal.status === 'archived';

  // Classes do card baseadas no status
  const cardClass = [
    'goal-card',
    isCompleted ? 'goal-card--completed' : '',
    isArchived ? 'goal-card--archived' : '',
    progress === 100 && !isCompleted && !isArchived ? 'goal-card--ready' : '',
  ].filter(Boolean).join(' ');

  return (
    <article className={cardClass} style={{ '--goal-color': goal.color }}>
      {/* Borda de cor à esquerda */}
      <div className="goal-card-accent" />

      {/* Header */}
      <div className="goal-card-header">
        <div className="goal-card-identity">
          <span className="goal-card-icon-container" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', backgroundColor: 'color-mix(in srgb, var(--goal-color, var(--primary)) 8%, var(--bg-card))', border: '1px solid color-mix(in srgb, var(--goal-color, var(--primary)) 20%, var(--border-light))', flexShrink: 0 }}>
            <GoalIcon name={goal.icon} size={20} />
          </span>
          <div className="goal-card-title-block">
            <h3 className="goal-card-title">{goal.title}</h3>
            {goal.description && (
              <p className="goal-card-description">{goal.description}</p>
            )}
          </div>
        </div>

        <div className="goal-card-header-right">
          {/* Badges de status */}
          {isCompleted && <span className="goal-status-badge goal-status-badge--completed" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> Concluído</span>}
          {isArchived && <span className="goal-status-badge goal-status-badge--archived" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Archive size={12} /> Arquivado</span>}
          {progress === 100 && !isCompleted && !isArchived && (
            <span className="goal-status-badge goal-status-badge--ready" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Award size={12} /> Pronto!</span>
          )}

          <GoalMenu
            goal={goal}
            onEdit={onEdit}
            onComplete={onComplete}
            onArchive={onArchive}
            onRestore={onRestore}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* Progresso */}
      <div className="goal-card-progress-section">
        <div className="goal-card-progress-header">
          <span className="goal-card-progress-label">
            {totalTasks === 0
              ? 'Nenhuma tarefa vinculada'
              : `${completedTasks} de ${totalTasks} tarefas concluídas`}
          </span>
          <span className="goal-card-progress-pct">{progress}%</span>
        </div>

        <div className="goal-card-progress-track">
          <div
            className="goal-card-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer: data-alvo + botão de tarefas */}
      <div className="goal-card-footer">
        {goal.target_date ? (
          <div className="goal-card-date" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={13} />
              <span>Meta: {formatDate(goal.target_date)}</span>
            </div>
            {(goal.start_time || goal.end_time) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-light)', marginLeft: '17px' }}>
                <Clock size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                <span>{goal.start_time || ''} {goal.end_time ? `até ${goal.end_time}` : ''}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="goal-card-date" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
            <span className="goal-card-no-date">Sem data-alvo</span>
            {(goal.start_time || goal.end_time) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-light)' }}>
                <Clock size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                <span>{goal.start_time || ''} {goal.end_time ? `até ${goal.end_time}` : ''}</span>
              </div>
            )}
          </div>
        )}

        {!isArchived && (
          <button
            className="goal-card-tasks-btn"
            onClick={() => onManageTasks(goal)}
            title="Gerenciar tarefas vinculadas"
          >
            <Link2 size={13} />
            <span>{totalTasks === 0 ? 'Vincular tarefas' : 'Gerenciar tarefas'}</span>
          </button>
        )}
      </div>
    </article>
  );
}
