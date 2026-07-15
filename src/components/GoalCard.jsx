import React from 'react';
import ReactDOM from 'react-dom';
import * as LucideIcons from 'lucide-react';
import { Calendar, MoreVertical, Trash2, Archive, CheckCircle, RotateCcw, Link2, Edit2, Award, Clock, Copy, FileText, Paperclip } from 'lucide-react';
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

const isImageFile = (file) => {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  if (file.name && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name)) return true;
  return false;
};

// Formata data para pt-BR legível
function formatDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${parts[2]} de ${months[parseInt(parts[1]) - 1]} de ${parts[0]}`;
}

// Menu de ações suspenso
function GoalMenu({ goal, onEdit, onComplete, onArchive, onRestore, onDelete, onDuplicate }) {
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
              {onDuplicate && (
                <button className="goal-menu-item" onClick={() => { onDuplicate(goal.id); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Copy size={13} /> Duplicar
                </button>
              )}
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
  onDuplicate,
}) {
  const [activeLightboxFile, setActiveLightboxFile] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    setZoomLevel(1);
  }, [activeLightboxFile]);

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
            {goal.attachments && goal.attachments.length > 0 && (
              <div className="goal-card-attachments" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {goal.attachments.map((file, idx) => {
                  const isImage = isImageFile(file);
                  return (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLightboxFile(file);
                      }}
                      className="goal-attachment-chip"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--primary-glow)',
                        color: 'var(--primary)',
                        border: '1px solid var(--border-light)',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      title={`${file.name} (${(file.size / 1024).toFixed(1)} KB)`}
                    >
                      {isImage ? (
                        <div style={{ width: '16px', height: '16px', borderRadius: '2px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <img src={file.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <FileText size={12} />
                      )}
                      <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="goal-card-header-right">
          {/* Badges de status */}
          {isCompleted && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="goal-status-badge goal-status-badge--completed" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> Concluído</span>
              <button
                className="goal-card-reactivate-btn"
                onClick={() => onRestore(goal.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--primary)',
                  backgroundColor: 'var(--primary-glow)',
                  border: '1px solid var(--primary-light)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                title="Reativar objetivo"
              >
                <RotateCcw size={10} />
                Reativar
              </button>
            </div>
          )}
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
            onDuplicate={onDuplicate}
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

      {activeLightboxFile && ReactDOM.createPortal(
        <div 
          className="goal-lightbox-overlay animate-fade-in"
          onClick={() => setActiveLightboxFile(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px'
          }}
        >
          <div 
            className="goal-lightbox-content animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card, #1e1e26)',
              border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.1))',
              borderRadius: 'var(--radius-lg, 16px)',
              padding: '24px',
              maxWidth: '640px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Botão Fechar */}
            <button 
              onClick={() => setActiveLightboxFile(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-light, #94a3b8)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.03)'
              }}
            >
              <LucideIcons.X size={18} />
            </button>

            {/* Nome do arquivo e Controles de Zoom */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #ffffff)', paddingRight: '32px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeLightboxFile.name}
                </h4>
                <span style={{ fontSize: '12px', color: 'var(--text-light, #94a3b8)' }}>
                  {(activeLightboxFile.size / 1024).toFixed(1)} KB • {activeLightboxFile.type || 'Tipo desconhecido'}
                </span>
              </div>
              {isImageFile(activeLightboxFile) && (
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-light, rgba(255,255,255,0.1))' }}>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
                    style={{ background: 'transparent', border: 'none', color: '#fff', padding: '4px 8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                    title="Zoom Out"
                  >
                    -
                  </button>
                  <span style={{ color: '#fff', fontSize: '12px', alignSelf: 'center', minWidth: '40px', textAlign: 'center' }}>
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}
                    style={{ background: 'transparent', border: 'none', color: '#fff', padding: '4px 8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                    title="Zoom In"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-light, #94a3b8)', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                    title="Reset"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            {/* Visualização de Mídia */}
            <div style={{ 
              backgroundColor: 'rgba(0, 0, 0, 0.2)', 
              borderRadius: '8px', 
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.05))',
              minHeight: '200px', 
              maxHeight: '380px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              overflow: 'auto',
              position: 'relative'
            }}>
              {isImageFile(activeLightboxFile) ? (
                <img 
                  src={activeLightboxFile.url} 
                  alt={activeLightboxFile.name} 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '380px', 
                    transform: `scale(${zoomLevel})`, 
                    transition: 'transform 0.2s ease',
                    transformOrigin: 'center center',
                    display: 'block'
                  }} 
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-light, #94a3b8)', padding: '20px' }}>
                  <FileText size={48} color="var(--primary)" />
                  <span style={{ fontSize: '13.5px' }}>Sem visualização disponível para este arquivo</span>
                </div>
              )}
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button 
                onClick={() => setActiveLightboxFile(null)}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}
              >
                Fechar
              </button>
              <a 
                href={activeLightboxFile.url} 
                download={activeLightboxFile.name}
                className="btn-primary-glow"
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '13px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
              >
                <LucideIcons.Download size={14} />
                Baixar arquivo
              </a>
            </div>
          </div>
        </div>
      , document.body)}
    </article>
  );
}
