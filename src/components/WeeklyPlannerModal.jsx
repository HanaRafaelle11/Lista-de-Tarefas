import React, { useState, useEffect } from 'react';
import { Calendar, ChevronRight, Check, X, Target, Star, ListCollapse } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';

export default function WeeklyPlannerModal({ isOpen, onClose, tasks, onUpdateTask }) {
  if (!isOpen) return null;

  const { goals, currentUser, setCurrentUser, logEvent } = useAppContext();
  
  // Tab ativa
  const [plannerTab, setPlannerTab] = useState('focus'); // focus, schedule

  // Estados dos inputs do plano semanal
  const [weeklyFocus, setWeeklyFocus] = useState('');
  const [priority1, setPriority1] = useState('');
  const [priority2, setPriority2] = useState('');
  const [priority3, setPriority3] = useState('');
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [saving, setSaving] = useState(false);

  // Carrega planejamento semanal existente se houver e reseta tabs
  useEffect(() => {
    if (isOpen) {
      if (currentUser?.user_metadata?.weekly_plan) {
        const plan = currentUser.user_metadata.weekly_plan;
        setWeeklyFocus(plan.focus || '');
        if (plan.criticalPriorities && plan.criticalPriorities.length >= 3) {
          setPriority1(plan.criticalPriorities[0] || '');
          setPriority2(plan.criticalPriorities[1] || '');
          setPriority3(plan.criticalPriorities[2] || '');
        } else {
          setPriority1(''); setPriority2(''); setPriority3('');
        }
        setSelectedGoals(plan.linkedGoals || []);
      } else {
        setWeeklyFocus('');
        setPriority1(''); setPriority2(''); setPriority3('');
        setSelectedGoals([]);
      }
      // Sempre inicia na primeira aba ao abrir
      setPlannerTab('focus');
      logEvent('weekly_plan_viewed');
    }
  }, [currentUser, isOpen, logEvent]);

  const [selectedTask, setSelectedTask] = useState(null);

  const pendingTasks = tasks.filter(t => !t.completed);
  const unscheduledTasks = pendingTasks.filter(t => !t.dueDate);
  const activeGoals = goals.filter(g => g.status === 'active');
  
  // Próximos 7 dias
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      dateStr: d.toISOString().split('T')[0],
      dayName: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()],
      label: d.getDate().toString().padStart(2, '0'),
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
        criticalPriorities: [priority1, priority2, priority3],
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
          <button onClick={onClose} className="todo-modal-close-btn">
            <X size={18} />
          </button>
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
              borderRadius: 0
            }}
          >
            🎯 1. Foco & Objetivos
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
              borderRadius: 0
            }}
          >
            📅 2. Distribuir Tarefas ({unscheduledTasks.length})
          </button>
        </div>

        {/* Conteúdo da Aba 1: Foco & Objetivos */}
        {plannerTab === 'focus' && (
          <form onSubmit={handleSaveWeeklyPlan} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div>
              <label className="todo-form-label" style={{ fontWeight: '700' }}>Foco Principal da Semana</label>
              <input 
                type="text" 
                placeholder="Ex: Entregar versão beta do aplicativo SaaS" 
                value={weeklyFocus}
                onChange={e => setWeeklyFocus(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="todo-form-label" style={{ fontWeight: '700' }}>3 Prioridades Críticas (Ações concretas)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Prioridade 1 (Mais crítica)" 
                  value={priority1}
                  onChange={e => setPriority1(e.target.value)}
                  className="form-input"
                  required
                />
                <input 
                  type="text" 
                  placeholder="Prioridade 2" 
                  value={priority2}
                  onChange={e => setPriority2(e.target.value)}
                  className="form-input"
                  required
                />
                <input 
                  type="text" 
                  placeholder="Prioridade 3" 
                  value={priority3}
                  onChange={e => setPriority3(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="todo-form-label" style={{ fontWeight: '700' }}>Objetivos que receberão atenção especial</label>
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
                      <span style={{ fontSize: '13px' }}>{goal.icon}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="btn-primary-glow" 
              disabled={saving}
              style={{ width: '100%', padding: '12px', marginTop: '12px', fontSize: '14px' }}
            >
              {saving ? 'Salvando...' : 'Salvar Planejamento & Avançar ➔'}
            </button>
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
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: selectedTask ? 'pointer' : 'default',
                        opacity: selectedTask ? 1 : 0.85
                      }}
                    >
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
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
