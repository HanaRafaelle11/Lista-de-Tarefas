import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Zap, Calendar, User, Trash2, Edit2, AlertCircle, Move } from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import { parseTaskMetadata, formatDescriptionWithoutMetadata } from '../contexts/AppContext';

// ── Touch Drag & Drop constants ──────────────────────────────
const HOLD_TO_DRAG_MS = 250;       // ms to hold before drag starts
const AUTO_SCROLL_ZONE = 60;       // px from viewport edge to trigger auto-scroll
const AUTO_SCROLL_SPEED = 8;       // px per frame at max proximity
const GHOST_OPACITY = 0.88;
const GHOST_SCALE = 1.04;

export default function EisenhowerMatrix({ tasks, onEditTask, onDeleteTask, onUpdateTask, onToggleComplete }) {
  // ── Desktop drag state ──────────────────────────────────
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [activeMoveMenuId, setActiveMoveMenuId] = useState(null);

  // ── Touch drag state (refs to avoid re-renders during drag) ──
  const touchStateRef = useRef({
    isDragging: false,
    taskId: null,
    sourceQuadrant: null,
    holdTimer: null,
    ghostEl: null,
    startX: 0,
    startY: 0,
    currentTarget: null,     // quadrant id currently hovered
    scrollRAF: null,
  });

  // Refs to each quadrant DOM element for bounding-box collision
  const quadrantRefs = useRef({});
  // Ref to the container for scroll context
  const containerRef = useRef(null);
  // State to drive highlight re-renders
  const [touchHighlight, setTouchHighlight] = useState(null);
  // State to visually hide the original card while dragging
  const [touchDragTaskId, setTouchDragTaskId] = useState(null);

  // ── Classify tasks into quadrants ────────────────────────
  const pendingTasks = tasks.filter(t => !t.completed);

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

  // Map quadrant id → task list for lookup
  const quadrantTasksMap = { q1, q2, q3, q4 };

  // ── Shared move logic ────────────────────────────────────
  const handleQuickMove = useCallback((taskId, targetQuadrant) => {
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
  }, [tasks, onUpdateTask]);

  // ── Desktop HTML5 Drag handlers (unchanged) ──────────────
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

  // ── Touch helpers ────────────────────────────────────────

  /** Find which quadrant the task currently belongs to */
  const getSourceQuadrant = useCallback((taskId) => {
    for (const [qId, list] of Object.entries(quadrantTasksMap)) {
      if (list.some(t => t.id === taskId)) return qId;
    }
    return null;
  }, [q1, q2, q3, q4]);

  /** Create the ghost clone element */
  const createGhost = useCallback((originalEl, touchX, touchY) => {
    const rect = originalEl.getBoundingClientRect();
    const ghost = originalEl.cloneNode(true);

    ghost.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      opacity: ${GHOST_OPACITY};
      transform: scale(${GHOST_SCALE});
      pointer-events: none;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(0,0,0,0.28);
      border-radius: 8px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      will-change: transform, left, top;
    `;

    // Store the offset from touch point to element origin
    touchStateRef.current.offsetX = touchX - rect.left;
    touchStateRef.current.offsetY = touchY - rect.top;

    document.body.appendChild(ghost);
    return ghost;
  }, []);

  /** Determine which quadrant the ghost overlaps using bounding-box intersection */
  const detectTargetQuadrant = useCallback((ghostRect) => {
    let bestMatch = null;
    let bestArea = 0;

    for (const [qId, el] of Object.entries(quadrantRefs.current)) {
      if (!el) continue;
      const qRect = el.getBoundingClientRect();

      // Calculate intersection area
      const overlapX = Math.max(0, Math.min(ghostRect.right, qRect.right) - Math.max(ghostRect.left, qRect.left));
      const overlapY = Math.max(0, Math.min(ghostRect.bottom, qRect.bottom) - Math.max(ghostRect.top, qRect.top));
      const area = overlapX * overlapY;

      if (area > bestArea) {
        bestArea = area;
        bestMatch = qId;
      }
    }

    return bestMatch;
  }, []);

  /** Auto-scroll when near viewport edges */
  const runAutoScroll = useCallback((touchY) => {
    const state = touchStateRef.current;

    const scrollStep = () => {
      if (!state.isDragging) return;

      // Find the scrollable parent (the page itself)
      const scrollEl = document.scrollingElement || document.documentElement;
      const viewportH = window.innerHeight;

      let speed = 0;
      if (touchY < AUTO_SCROLL_ZONE) {
        // Near top — scroll up
        const proximity = 1 - (touchY / AUTO_SCROLL_ZONE);
        speed = -(AUTO_SCROLL_SPEED * proximity);
      } else if (touchY > viewportH - AUTO_SCROLL_ZONE) {
        // Near bottom — scroll down
        const proximity = 1 - ((viewportH - touchY) / AUTO_SCROLL_ZONE);
        speed = AUTO_SCROLL_SPEED * proximity;
      }

      if (speed !== 0) {
        scrollEl.scrollTop += speed;
        state.scrollRAF = requestAnimationFrame(scrollStep);
      } else {
        state.scrollRAF = null;
      }
    };

    // Cancel any existing scroll loop
    if (state.scrollRAF) {
      cancelAnimationFrame(state.scrollRAF);
    }
    state.scrollRAF = requestAnimationFrame(scrollStep);
  }, []);

  // ── Touch event handlers ─────────────────────────────────

  const handleTouchStart = useCallback((e, taskId) => {
    const state = touchStateRef.current;
    const touch = e.touches[0];

    state.startX = touch.clientX;
    state.startY = touch.clientY;
    state.taskId = taskId;
    state.sourceQuadrant = getSourceQuadrant(taskId);

    // Start hold timer
    state.holdTimer = setTimeout(() => {
      // Prevent default to stop scroll and context menu
      state.isDragging = true;
      setTouchDragTaskId(taskId);

      // Create ghost
      const cardEl = e.target.closest('.eisenhower-task-card');
      if (cardEl) {
        state.ghostEl = createGhost(cardEl, touch.clientX, touch.clientY);
      }

      // Vibrate for haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }, HOLD_TO_DRAG_MS);
  }, [getSourceQuadrant, createGhost]);

  const handleTouchMove = useCallback((e) => {
    const state = touchStateRef.current;
    const touch = e.touches[0];

    // If not yet dragging but moved significantly, cancel hold (user is scrolling)
    if (!state.isDragging) {
      const dx = Math.abs(touch.clientX - state.startX);
      const dy = Math.abs(touch.clientY - state.startY);
      if (dx > 10 || dy > 10) {
        clearTimeout(state.holdTimer);
        state.holdTimer = null;
      }
      return;
    }

    // We're dragging — prevent page scroll
    e.preventDefault();

    // Move ghost
    if (state.ghostEl) {
      const newLeft = touch.clientX - state.offsetX;
      const newTop = touch.clientY - state.offsetY;
      state.ghostEl.style.left = `${newLeft}px`;
      state.ghostEl.style.top = `${newTop}px`;

      // Detect target quadrant via bounding-box intersection
      const ghostRect = state.ghostEl.getBoundingClientRect();
      const target = detectTargetQuadrant(ghostRect);

      if (target !== state.currentTarget) {
        state.currentTarget = target;
        setTouchHighlight(target);
      }
    }

    // Auto-scroll
    runAutoScroll(touch.clientY);
  }, [detectTargetQuadrant, runAutoScroll]);

  const handleTouchEnd = useCallback(() => {
    const state = touchStateRef.current;

    // Clear hold timer if still pending
    if (state.holdTimer) {
      clearTimeout(state.holdTimer);
      state.holdTimer = null;
    }

    // Cancel auto-scroll
    if (state.scrollRAF) {
      cancelAnimationFrame(state.scrollRAF);
      state.scrollRAF = null;
    }

    if (state.isDragging) {
      // Execute drop if target differs from source
      if (state.currentTarget && state.currentTarget !== state.sourceQuadrant && state.taskId) {
        handleQuickMove(state.taskId, state.currentTarget);
      }

      // Remove ghost
      if (state.ghostEl && state.ghostEl.parentNode) {
        state.ghostEl.parentNode.removeChild(state.ghostEl);
      }

      // Reset state
      state.isDragging = false;
      state.ghostEl = null;
      state.currentTarget = null;
      state.taskId = null;
      state.sourceQuadrant = null;
      setTouchHighlight(null);
      setTouchDragTaskId(null);
    }
  }, [handleQuickMove]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      const state = touchStateRef.current;
      if (state.holdTimer) clearTimeout(state.holdTimer);
      if (state.scrollRAF) cancelAnimationFrame(state.scrollRAF);
      if (state.ghostEl && state.ghostEl.parentNode) {
        state.ghostEl.parentNode.removeChild(state.ghostEl);
      }
    };
  }, []);

  // ── Render ──────────────────────────────────────────────

  const renderQuadrant = (id, title, desc, icon, color, list) => {
    const isHighlighted = touchHighlight === id;

    return (
      <div
        ref={el => quadrantRefs.current[id] = el}
        className={`eisenhower-quadrant eisenhower-quadrant--${id}`}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, id)}
        style={{
          background: isHighlighted
            ? `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`
            : 'var(--bg-card)',
          border: isHighlighted
            ? `2px solid ${color}`
            : `1px solid var(--border-medium)`,
          borderRadius: 'var(--radius-md)',
          padding: isHighlighted ? '15px' : '16px', // compensate for thicker border
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minHeight: '220px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
          position: 'relative',
          transform: isHighlighted ? 'scale(1.01)' : 'none',
          boxShadow: isHighlighted ? `0 0 20px ${color}30` : 'none',
        }}
      >
        {/* Accent border with HSL tint */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: isHighlighted ? '4px' : '3px',
          backgroundColor: color,
          borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
          transition: 'height 0.2s ease',
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
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isHighlighted ? `2px dashed ${color}` : '1px dashed var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
              color: isHighlighted ? color : 'var(--text-light)',
              fontSize: '12px',
              fontStyle: 'italic',
              textAlign: 'center',
              backgroundColor: isHighlighted ? `${color}08` : 'transparent',
              transition: 'all 0.2s ease',
            }}>
              {isHighlighted ? 'Solte aqui!' : 'Arraste tarefas para cá'}
            </div>
          ) : (
            list.map(task => {
              const cleanDesc = formatDescriptionWithoutMetadata(task.description);
              const isBeingDragged = touchDragTaskId === task.id;
              return (
                <div
                  key={task.id}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onTouchStart={(e) => handleTouchStart(e, task.id)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    cursor: 'grab',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.15s',
                    opacity: isBeingDragged ? 0.3 : 1,
                    transform: isBeingDragged ? 'scale(0.95)' : 'none',
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
    <div ref={containerRef} className="eisenhower-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
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
