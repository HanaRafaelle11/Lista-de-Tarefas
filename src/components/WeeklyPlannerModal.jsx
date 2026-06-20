import React, { useState, useEffect } from 'react';
import { Calendar, ChevronRight, Check, X, Target, Star, ListCollapse, Trash2, Flame } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';
import { exportAllTasksToCalendar } from '../services/googleCalendarService';

export default function WeeklyPlannerModal({ isOpen, onClose, tasks, onUpdateTask }) {
  if (!isOpen) return null;

  const { goals, currentUser, setCurrentUser, logEvent } = useAppContext();
  
  // Tab ativa
  const [plannerTab, setPlannerTab] = useState('focus'); // focus, schedule

  // Estados dos inputs do plano semanal
  const [weeklyFocus, setWeeklyFocus] = useState('');
  const [criticalPriorities, setCriticalPriorities] = useState(['']);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState('focus'); // 'focus' | 'priorities' | 'goals'
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Carrega planejamento semanal existente se houver e reseta tabs
  useEffect(() => {
    if (isOpen) {
      if (currentUser?.user_metadata?.weekly_plan) {
        const plan = currentUser.user_metadata.weekly_plan;
        setWeeklyFocus(plan.focus || '');
        
        let loadedPriorities = [''];
        if (plan.criticalPriorities && Array.isArray(plan.criticalPriorities)) {
          loadedPriorities = plan.criticalPriorities;
        } else if (plan.priority1 || plan.priority2 || plan.priority3) {
          loadedPriorities = [plan.priority1 || '', plan.priority2 || '', plan.priority3 || ''].filter(p => p !== '');
        }
        if (loadedPriorities.length === 0) loadedPriorities = [''];
        
        setCriticalPriorities(loadedPriorities);
        setSelectedGoals(plan.linkedGoals || []);
      } else {
        setWeeklyFocus('');
        setCriticalPriorities(['']);
        setSelectedGoals([]);
      }
      // Sempre inicia na primeira aba ao abrir
      setPlannerTab('focus');
      setActiveAccordion('focus');
      logEvent('weekly_plan_viewed');
    }
  }, [currentUser, isOpen, logEvent]);

  const handlePriorityChange = (index, val) => {
    const updated = [...criticalPriorities];
    updated[index] = val;
    setCriticalPriorities(updated);
  };

  const handleAddPriority = () => {
    setCriticalPriorities([...criticalPriorities, '']);
  };

  const handleRemovePriority = (index) => {
    const val = criticalPriorities[index];
    if (window.confirm(`Excluir a prioridade "${val || 'sem nome'}"?`)) {
      const next = criticalPriorities.filter((_, i) => i !== index);
      setCriticalPriorities(next.length === 0 ? [''] : next);
    }
  };

  const [selectedTask, setSelectedTask] = useState(null);

  const pendingTasks = tasks.filter(t => !t.completed);
  const unscheduledTasks = pendingTasks.filter(t => {
    return !t.dueDate || t.dueDate === '' || t.dueDate === 'null' || t.dueDate === 'undefined';
  });
  const activeGoals = goals.filter(g => g.status === 'active');
  
  // Próximos 7 dias (computados no fuso local para evitar timezone shifts)
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayVal = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayVal}`;

    days.push({
      dateStr,
      dayName: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()],
      label: dayVal,
      isToday: i === 0,
      isTomorrow: i === 1
    });
  }

  const handleAssignDate = (task, dateStr) => {
    onUpdateTask(task.id, { dueDate: dateStr });
    setSelectedTask(null);
  };

  const handleGoalToggle = (goalId) => {
    setSelectedGoals(prev => 
      prev.includes(goalId) 
        ? prev.filter(id => id !== goalId) 
        : [...prev, goalId]
    );
  };

  const handleSaveWeeklyPlan = async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return;

    setSaving(true);
    try {
      const planData = {
        focus: weeklyFocus,
        criticalPriorities: criticalPriorities.filter(p => p.trim() !== ''),
        linkedGoals: selectedGoals
      };

      const { data, error } = await supabase.auth.updateUser({
        data: {
          weekly_plan: planData
        }
      });

      if (error) throw error;
      
      setCurrentUser(prev => ({
        ...prev,
        user_metadata: {
          ...prev.user_metadata,
          weekly_plan: planData
        }
      }));
      
      logEvent('weekly_plan_saved', { goals_selected: selectedGoals.length });
      logEvent('weekly_plan_completed', { goals_selected: selectedGoals.length });
      alert('Seu planejamento semanal foi salvo com sucesso! ⚡');
      setPlannerTab('schedule'); // Avança para o agendamento de tarefas
    } catch (err) {
      console.error('[WeeklyPlannerModal] Erro ao salvar plano semanal:', err);
      alert('Erro ao salvar planejamento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearWeeklyPlan = async () => {
    if (!currentUser?.id) return;
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { weekly_plan: null }
      });
      if (error) throw error;
      
      setCurrentUser(prev => ({
        ...prev,
        user_metadata: { ...prev.user_metadata, weekly_plan: null }
      }));
      setWeeklyFocus('');
      setCriticalPriorities(['']);
      setSelectedGoals([]);
      setConfirmClear(false);
      onClose();
    } catch (err) {
      console.error('[WeeklyPlannerModal] Erro ao limpar plano:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleExportGoogleCalendar = () => {
    exportAllTasksToCalendar(tasks);
    window.open('https://calendar.google.com/calendar/r/settings/export', '_blank');
    setIsSyncModalOpen(false);
    logEvent('weekly_planner_calendar_google_sync_clicked');
  };

  const handleExportIcsOnly = () => {
    exportAllTasksToCalendar(tasks);
    setIsSyncModalOpen(false);
    logEvent('weekly_planner_calendar_ics_sync_clicked');
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content animate-scale-up weekly-planner-modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ display: 'flex', flexDirection: 'column', padding: 0 }}
      >
        {/* Header do modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} className="text-primary" />
            Planejamento Semanal Flowday
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => {
                setIsSyncModalOpen(true);
                logEvent('weekly_planner_calendar_sync');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                border: '1px solid var(--primary)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Exportar tarefas agendadas para o calendário (.ics)"
            >
              <Calendar size={14} /> Sincronizar Calendário
            </button>
            <button onClick={onClose} className="todo-modal-close-btn">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)' }}>
          <button 
            onClick={() => setPlannerTab('focus')}
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              fontSize: '14px', 
              fontWeight: '600', 
              color: plannerTab === 'focus' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: plannerTab === 'focus' ? '3px solid var(--primary)' : 'none',
              backgroundColor: plannerTab === 'focus' ? 'var(--bg-card)' : 'transparent',
              borderRadius: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Target size={14} /> 1. Foco & Objetivos
          </button>
          <button 
            onClick={() => setPlannerTab('schedule')}
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              fontSize: '14px', 
              fontWeight: '600', 
              color: plannerTab === 'schedule' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: plannerTab === 'schedule' ? '3px solid var(--primary)' : 'none',
              backgroundColor: plannerTab === 'schedule' ? 'var(--bg-card)' : 'transparent',
              borderRadius: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Calendar size={14} /> 2. Distribuir Tarefas ({unscheduledTasks.length})
          </button>
        </div>

        {/* Conteúdo da Aba 1: Foco & Objetivos */}
        {plannerTab === 'focus' && (
          <form onSubmit={handleSaveWeeklyPlan} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '65vh', overflowY: 'auto' }}>
            
            {/* Passo 1: Foco Principal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Target size={14} style={{ color: 'var(--primary)' }} /> Passo 1: Foco Principal da Semana
              </label>
              <input 
                type="text" 
                placeholder="Ex: Entregar versão beta do aplicativo SaaS" 
                value={weeklyFocus}
                onChange={e => setWeeklyFocus(e.target.value)}
                className="form-input"
                required
                style={{ width: '100%' }}
              />
            </div>

            {/* Passo 2: Prioridades Críticas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              <label style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flame size={14} style={{ color: 'var(--danger)' }} /> Passo 2: Prioridades Críticas ({criticalPriorities.filter(p => p.trim()).length})
              </label>
              {criticalPriorities.map((priority, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    placeholder={`Prioridade ${index + 1}`} 
                    value={priority}
                    onChange={e => handlePriorityChange(index, e.target.value)}
                    className="form-input"
                    required
                    style={{ flex: 1 }}
                  />
                  {criticalPriorities.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemovePriority(index)}
                      style={{ padding: '8px', color: 'var(--text-light)', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      title="Remover Prioridade"
                    >
                      <Trash2 size={16} style={{ color: '#E53E3E' }} />
                    </button>
                  )}
                </div>
              ))}
              <button 
                type="button" 
                onClick={handleAddPriority}
                className="btn-secondary"
                style={{ padding: '8px', fontSize: '12px', width: 'fit-content', alignSelf: 'flex-start', marginTop: '4px' }}
              >
                + Adicionar Prioridade
              </button>
            </div>

            {/* Passo 3: Objetivos Vinculados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              <label style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Star size={14} style={{ color: '#eab308' }} /> Passo 3: Objetivos Vinculados ({selectedGoals.length})
              </label>
              <div style={{ padding: '8px 0' }}>
                  {activeGoals.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum objetivo ativo cadastrado. Crie objetivos para vinculá-los aqui.</p>
                  ) : (
                    <div className="weekly-planner-goals-grid">
                      {activeGoals.map(goal => (
                        <div 
                          key={goal.id}
                          onClick={() => handleGoalToggle(goal.id)}
                          style={{
                            padding: '10px 12px',
                            border: '1px solid var(--border-medium)',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: selectedGoals.includes(goal.id) ? 'var(--primary-glow)' : 'var(--bg-card)',
                            borderColor: selectedGoals.includes(goal.id) ? 'var(--primary)' : 'var(--border-medium)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={selectedGoals.includes(goal.id)}
                            onChange={() => {}} // Tratado pelo click do container
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexDirection: 'column' }}>
              <button 
                type="submit" 
                className="btn-primary-glow" 
                style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 'bold' }}
                disabled={saving || !weeklyFocus.trim() || criticalPriorities.filter(p => p.trim()).length === 0}
              >
                {saving ? 'Salvando...' : 'Salvar Planejamento e Avançar ➔'}
              </button>
              <button 
                type="button" 
                onClick={handleClearWeeklyPlan}
                className="btn-secondary" 
                style={{ width: '100%', padding: '12px', fontSize: '15px', color: '#E53E3E', borderColor: '#E53E3E', backgroundColor: confirmClear ? '#FFF5F5' : 'transparent' }}
                disabled={saving}
              >
                {confirmClear ? 'Tem certeza? Clique para confirmar' : 'Limpar Planejamento'}
              </button>
            </div>
          </form>
        )}

        {/* Conteúdo da Aba 2: Distribuir Tarefas */}
        {plannerTab === 'schedule' && (
          <div className="weekly-planner-body">
            {/* Painel Esquerdo: Tarefas sem data */}
            <div className="weekly-planner-left-panel">
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>
                  Selecione uma tarefa abaixo e depois clique no dia correspondente para agendá-la:
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {unscheduledTasks.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '24px' }}>✨</span>
                    <p style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: '600', marginTop: '8px' }}>Tudo planejado!</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>Todas as suas tarefas pendentes possuem data.</p>
                  </div>
                ) : (
                  unscheduledTasks.map(task => (
                    <div 
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      style={{ 
                        padding: '12px', 
                        border: `1px solid ${selectedTask?.id === task.id ? 'var(--primary)' : 'var(--border-light)'}`,
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: selectedTask?.id === task.id ? 'var(--primary-glow)' : 'var(--bg-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-main)' }}>{task.title}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{task.priority} • {task.category}</span>
                      </div>
                      <ChevronRight size={16} color="var(--text-light)" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Painel Direito: Dias da Semana */}
            <div className="weekly-planner-right-panel">
              <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>
                {selectedTask ? `Onde agendar "${selectedTask.title}"?` : 'Sua Carga Semanal'}
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {days.map(day => {
                  const dayTasks = pendingTasks.filter(t => t.dueDate === day.dateStr);
                  
                  return (
                    <div 
                      key={day.dateStr}
                      onClick={() => selectedTask && handleAssignDate(selectedTask, day.dateStr)}
                      style={{
                        padding: '12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        cursor: selectedTask ? 'pointer' : 'default',
                        opacity: selectedTask ? 1 : 0.85
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: day.isToday ? 'var(--primary)' : 'var(--text-light)', fontWeight: day.isToday ? '700' : '500' }}>
                              {day.isToday ? 'Hoje' : day.isTomorrow ? 'Amanhã' : day.dayName}
                            </span>
                            <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>{day.label}</span>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-main)' }}>
                              {dayTasks.length} tarefa{dayTasks.length !== 1 ? 's' : ''} planejada{dayTasks.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        {selectedTask && (
                          <div style={{ padding: '4px 8px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                            Agendar Aqui
                          </div>
                        )}
                      </div>

                      {/* Lista de tarefas agendadas para o dia com opção de remover data */}
                      {dayTasks.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', borderTop: '1px solid var(--border-light)', paddingTop: '8px', marginTop: '4px' }}>
                          {dayTasks.map(t => (
                            <div 
                              key={t.id} 
                              onClick={(e) => e.stopPropagation()} // impede agendamento acidental ao clicar na tarefa
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                gap: '8px', 
                                fontSize: '12px', 
                                color: 'var(--text-main)', 
                                backgroundColor: 'var(--bg-app)', 
                                padding: '6px 10px', 
                                borderRadius: '4px',
                                border: '1px solid var(--border-light)'
                              }}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                                {t.title}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateTask(t.id, { dueDate: null });
                                }}
                                style={{ 
                                  background: 'transparent', 
                                  border: 'none', 
                                  cursor: 'pointer', 
                                  color: '#E53E3E', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  padding: '2px',
                                  borderRadius: '50%'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(229, 62, 62, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                title="Remover tarefa deste dia"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modal de Escolha de Sincronização do Calendário */}
      {isSyncModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSyncModalOpen(false)} style={{ zIndex: 12000 }}>
          <div 
            className="modal-content" 
            role="dialog" 
            aria-modal="true" 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '420px', width: '90%', padding: '24px', textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--primary)' }} /> Sincronizar Calendário
              </h3>
              <button 
                onClick={() => setIsSyncModalOpen(false)} 
                className="todo-modal-close-btn"
                style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5', textAlign: 'left' }}>
              Escolha o formato que preferir para integrar suas tarefas agendadas ao seu calendário pessoal:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleExportGoogleCalendar}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-app)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.2s',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: '24px' }}>📅</span>
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-main)' }}>Google Calendar (Recomendado)</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Exporta o arquivo .ics e abre a página de importação do Google.</span>
                </div>
              </button>

              <button
                onClick={handleExportIcsOnly}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-app)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.2s',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: '24px' }}>📥</span>
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-main)' }}>Baixar arquivo .ics</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Apenas exporta e baixa o arquivo de calendário para programas locais.</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
