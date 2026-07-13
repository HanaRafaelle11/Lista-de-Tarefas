import React, { useState } from 'react';
import { Zap, Calendar, User, Trash2, Edit2, AlertCircle, Move } from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import { parseTaskMetadata, formatDescriptionWithoutMetadata } from '../contexts/AppContext';

export default function EisenhowerMatrix({ tasks, onEditTask, onDeleteTask, onUpdateTask, onToggleComplete }) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [activeMoveMenuId, setActiveMoveMenuId] = useState(null);

  const pendingTasks = tasks.filter(t => !t.completed);

  // Classificar em quadrantes
  const q1 = []; // Urgente & Importante (Alta + com data)
  const q2 = []; // Importante & Não Urgente (Alta + sem data)
  const q3 = []; // Urgente & Não Importante (Média/Baixa + com data)
  const q4 = []; // Não Urgente & Não Importante (Média/Baixa + sem data)

  pendingTasks.forEach(task => {
    const isImportant = task.priority === 'Alta';
    const isUrgent = !!task.dueDate;

    if (isImportant && isUrgent) q1.push(task);
    else if (isImportant && !isUrgent) q2.push(task);
    else if (!isImportant && isUrgent) q3.push(task);
    else q4.push(task);
  });

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, quadrantId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);
    if (!taskId) return;

    handleQuickMove(taskId, quadrantId);
  };

  const handleQuickMove = (taskId, targetQuadrant) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    let updates = {};
    const today = new Date().toISOString().split('T')[0];

    if (targetQuadrant === 'q1') {
      updates = { priority: 'Alta', dueDate: task.dueDate || today };
    } else if (targetQuadrant === 'q2') {
      updates = { priority: 'Alta', dueDate: null };
    } else if (targetQuadrant === 'q3') {
      updates = { priority: 'Média', dueDate: task.dueDate || today };
    } else if (targetQuadrant === 'q4') {
      updates = { priority: 'Baixa', dueDate: null };
    }

    onUpdateTask(taskId, updates);
  };

  const renderQuadrant = (id, title, desc, icon, color, list) => {
    return (
      <div 
        className={`eisenhower-quadrant eisenhower-quadrant--${id}`}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, id)}
        style={{
          background: 'var(--bg-card)',
          border: `1px solid var(--border-medium)`,
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minHeight: '220px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          transition: 'all 0.25s',
          position: 'relative',
        }}
      >
        {/* Accent border with HSL tint */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          backgroundColor: color,
          borderRadius: 'var(--radius-md) var(--radius-md) 0 0'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '4px' }}>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color }}>{icon}</span> {title}
            </h4>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</p>
          </div>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', backgroundColor: 'var(--border-light)', padding: '2px 8px', borderRadius: '99px' }}>
            {list.length}
          </span>
        </div>

        <div 
          className="eisenhower-tasks-list"
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '260px',
            paddingRight: '4px',
            marginTop: '8px'
          }}
        >
          {list.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '16px', color: 'var(--text-light)', fontSize: '12px', fontStyle: 'italic', textAlign: 'center' }}>
              Arraste tarefas para cá
            </div>
          ) : (
            list.map(task => {
              const cleanDesc = formatDescriptionWithoutMetadata(task.description);
              return (
                <div
                  key={task.id}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    cursor: 'grab',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'transform 0.15s, box-shadow 0.15s'
                  }}
                  className="eisenhower-task-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>{task.title}</span>
                    <input 
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => onToggleComplete(task.id)}
                      style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                    />
                  </div>
                  {cleanDesc && <span style={{ fontSize: '11px', color: 'var(--text-light)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{cleanDesc}</span>}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span className={`badge-category ${task.category.toLowerCase()}`} style={{ fontSize: '9px', padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <CategoryIcon categoryId={task.category} size={8} />
                        <span>{task.category}</span>
                      </span>
                      {task.dueDate && (
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <Calendar size={10} />
                          <span>{(() => {
                            const cleanDate = task.dueDate.split('T')[0];
                            const parts = cleanDate.split('-');
                            return parts.length === 3 ? `${parts[2]}/${parts[1]}` : task.dueDate;
                          })()}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', position: 'relative' }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMoveMenuId(activeMoveMenuId === task.id ? null : task.id);
                        }} 
                        style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '2px' }} 
                        title="Mover Quadrante"
                      >
                        <Move size={11} />
                      </button>

                      {activeMoveMenuId === task.id && (
                        <>
                          <div 
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMoveMenuId(null);
                            }}
                          />
                          <div 
                            style={{
                              position: 'absolute',
                              bottom: '22px',
                              right: '0',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-medium)',
                              borderRadius: '6px',
                              padding: '4px 0',
                              zIndex: 999,
                              minWidth: '130px',
                              boxShadow: 'var(--shadow-md)',
                              display: 'flex',
                              flexDirection: 'column'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[
                              { q: 'q1', label: '1. Fazer Agora', color: 'hsl(0, 75%, 60%)' },
                              { q: 'q2', label: '2. Agendar', color: 'hsl(217, 91%, 60%)' },
                              { q: 'q3', label: '3. Delegar', color: 'hsl(38, 92%, 50%)' },
                              { q: 'q4', label: '4. Eliminar', color: 'hsl(180, 75%, 40%)' }
                            ].map(opt => (
                              <button
                                key={opt.q}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickMove(task.id, opt.q);
                                  setActiveMoveMenuId(null);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-main)',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: opt.color }} />
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); onEditTask(task); }} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '2px' }} title="Editar"><Edit2 size={11} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }} style={{ background: 'none', border: 'none', color: 'var(--danger-light)', cursor: 'pointer', padding: '2px' }} title="Excluir"><Trash2 size={11} /></button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="eisenhower-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
      <div 
        className="eisenhower-tip-banner"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-main)',
          fontSize: '12.5px',
          lineHeight: '1.5'
        }}
      >
        <AlertCircle size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ display: 'block', marginBottom: '2px', fontWeight: '700' }}>Como funciona a Matriz de Eisenhower?</strong>
          Por padrão, tarefas sem prazo e com prioridade normal começam em <strong style={{ color: 'hsl(180, 75%, 45%)' }}>Eliminar (Q4)</strong>. 
          Arraste e solte os cartões de tarefas entre os quadrantes para ajustar automaticamente seus prazos e prioridades de acordo com a sua importância real.
        </div>
      </div>

      <div 
        className="eisenhower-matrix-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {renderQuadrant('q1', '1. Fazer Agora', 'Urgente e Importante', <Zap size={14} />, 'hsl(0, 75%, 60%)', q1)}
        {renderQuadrant('q2', '2. Agendar', 'Importante, Não Urgente', <Calendar size={14} />, 'hsl(217, 91%, 60%)', q2)}
        {renderQuadrant('q3', '3. Delegar', 'Urgente, Não Importante', <User size={14} />, 'hsl(38, 92%, 50%)', q3)}
        {renderQuadrant('q4', '4. Eliminar', 'Não Urgente, Não Importante', <Trash2 size={14} />, 'hsl(180, 75%, 40%)', q4)}
      </div>
    </div>
  );
}
