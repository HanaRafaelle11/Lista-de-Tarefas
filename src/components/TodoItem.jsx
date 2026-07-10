import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, Trash2, Edit2, AlertCircle, CalendarPlus, Check, Repeat, Unlink, Copy, Clock, Play, MoreVertical, Sparkles, Flame, Archive } from 'lucide-react';
import { parseTaskMetadata, formatDescriptionWithoutMetadata, buildDescriptionWithMetadata, useAppContext } from '../contexts/AppContext';
import { formatTaskDateDisplay, formatTaskTimeDisplay, extractDateAndTimeParts } from '../utils/dateUtils';
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

export default function TodoItem({ item, onToggleComplete, onDelete, onEdit, goalId, onUnlinkGoal, onDuplicate, isRecommended, isCritical, isStreak }) {
  const [calExported, setCalExported] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const { isPro, openPaywall, openCustomConfirm, setActiveTab, handleUpdateTask } = useAppContext();

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
    const meta = parseTaskMetadata(item.description || '');
    const { datePart } = extractDateAndTimeParts(item.dueDate);
    if (!datePart) return false;

    const activeTime = meta.due_time || '';
    if (activeTime) {
      const [hours, minutes] = activeTime.split(':').map(Number);
      const [year, month, day] = datePart.split('-').map(Number);
      const taskDateTime = new Date(year, month - 1, day, hours, minutes, 59, 999);
      return taskDateTime < now;
    } else {
      const [year, month, day] = datePart.split('-').map(Number);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
      return endOfDay < now;
    }
  };

  const overdue = isOverdue();
  const meta = parseTaskMetadata(item.description);
  const cleanDescription = formatDescriptionWithoutMetadata(item.description);

  const dateText = formatTaskDateDisplay(item.dueDate);
  const timeText = formatTaskTimeDisplay(item.dueDate, meta.due_time);

  const getCardStyle = () => {
    if (item.completed) return {};
    if (isRecommended) return { border: '1px dashed var(--primary)', boxShadow: '0 0 10px rgba(94, 96, 206, 0.15)' };
    if (isCritical) return { border: '1px dashed rgba(239, 68, 68, 0.4)', boxShadow: '0 0 10px rgba(239, 68, 68, 0.08)' };
    if (isStreak) return { border: '1px dashed rgba(16, 185, 129, 0.4)', boxShadow: '0 0 10px rgba(16, 185, 129, 0.08)' };
    return {};
  };

  return (
    <div 
      className={`todo-item-card ${item.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''} ${isRecommended ? 'todo-item-recommended' : ''} animate-fade-in`}
      style={getCardStyle()}
    >
      {/* Checkbox Customizado */}
      <div 
        onClick={() => onToggleComplete(item.id)}
        className={`custom-checkbox ${item.completed ? 'checked' : ''}`}
        title={item.completed ? 'Marcar como pendente' : 'Marcar como concluída'}
      />

      {/* Conteúdo Central */}
      <div className="todo-item-content">
        <div className="todo-item-title-wrapper" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          <h3 className="todo-item-title" style={{ margin: 0 }}>
            {item.title}
          </h3>
          
          {/* Seletor de data atrasada */}
          {overdue && (
            <span className="todo-item-overdue-badge" title="Tarefa atrasada!">
              <AlertCircle size={11} />
              <span>Atrasada</span>
            </span>
          )}

          {/* Badges de Destaque */}
          {isRecommended && !item.completed && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: '800', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(94, 96, 206, 0.2)', textTransform: 'uppercase' }}>
              <Sparkles size={11} />
              <span>Recomendada IA</span>
            </span>
          )}
          
          {isCritical && !item.completed && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: '800', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)', textTransform: 'uppercase' }}>
              <AlertCircle size={11} />
              <span>Crítica</span>
            </span>
          )}

          {isStreak && !item.completed && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: '800', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)', textTransform: 'uppercase' }}>
              <Flame size={11} />
              <span>Mantém Sequência</span>
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

      {/* Ações Simplificadas (Execução) */}
      <div className="todo-item-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
        {!item.completed && (
          <button 
            onClick={() => {
              localStorage.setItem('flowday_pomodoro_selected_task_id', item.id);
              setActiveTab('focus');
            }}
            className="todo-item-action-btn play-btn"
            title="Iniciar modo Foco (Pomodoro)"
            aria-label="Focar nesta tarefa"
            style={{ color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Play size={16} fill="var(--primary)" />
          </button>
        )}

        {/* Menu Kebab */}
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            if (!showMenu && buttonRef.current) {
              const rect = buttonRef.current.getBoundingClientRect();
              setCoords({
                top: rect.bottom + window.scrollY,
                left: Math.min(window.innerWidth - 168 + window.scrollX, Math.max(8, rect.right - 160 + window.scrollX))
              });
            }
            setShowMenu(!showMenu);
          }}
          className="todo-item-action-btn more-btn"
          title="Mais Ações"
          style={{ color: 'var(--text-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <MoreVertical size={16} />
        </button>

        {/* Dropdown Menu */}
        {showMenu && ReactDOM.createPortal(
          <>
            <div 
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />
            <div 
              className="todo-item-dropdown animate-scale-up" 
              style={{
                position: 'absolute',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                marginTop: '4px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-md)',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                minWidth: '160px',
                padding: '4px 0',
                overflow: 'hidden'
              }}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); handleExportCalendar(); setShowMenu(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12.5px', border: 'none', background: 'none', color: 'var(--text-main)', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              >
                {calExported ? <Check size={14} style={{ color: '#10b981' }} /> : <CalendarPlus size={14} />}
                <span>{calExported ? 'Adicionado!' : 'Exportar Google'}</span>
              </button>

              {onDuplicate && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onDuplicate(item.id); setShowMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12.5px', border: 'none', background: 'none', color: 'var(--text-main)', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                >
                  <Copy size={14} />
                  <span>Duplicar</span>
                </button>
              )}

              {goalId && onUnlinkGoal && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    openCustomConfirm(
                      "Deseja realmente desvincular esta tarefa do objetivo? Ela voltará para a lista de tarefas gerais.",
                      "Desvincular Tarefa",
                      () => onUnlinkGoal(goalId, item.id)
                    );
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12.5px', border: 'none', background: 'none', color: 'var(--text-main)', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                >
                  <Unlink size={14} />
                  <span>Desvincular</span>
                </button>
              )}

              {!item.completed && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onEdit(item); setShowMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12.5px', border: 'none', background: 'none', color: 'var(--text-main)', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                >
                  <Edit2 size={14} />
                  <span>Editar</span>
                </button>
              )}
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  openCustomConfirm(
                    "Deseja realmente arquivar esta tarefa?",
                    "Arquivar Tarefa",
                    () => {
                      const meta = parseTaskMetadata(item.description);
                      const updatedDesc = buildDescriptionWithMetadata(item.description, '', meta.recurrence, true);
                      handleUpdateTask(item.id, { description: updatedDesc });
                    }
                  );
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12.5px', border: 'none', background: 'none', color: 'var(--text-muted)', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              >
                <Archive size={14} />
                <span>Arquivar</span>
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(item); setShowMenu(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12.5px', border: 'none', background: 'none', color: 'var(--danger)', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              >
                <Trash2 size={14} />
                <span>Excluir</span>
              </button>
            </div>
          </>,
          document.body
        )}
      </div>
    </div>
  );
}
