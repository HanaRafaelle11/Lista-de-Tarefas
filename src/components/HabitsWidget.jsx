import React, { useState, useMemo } from 'react';
import { Plus, Check, MoreVertical, Trash2, Sprout } from 'lucide-react';

// Formatar datas recentes (Últimos 7 dias)
const getLast7Days = () => {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({
      dateStr: d.toISOString().split('T')[0],
      dayName: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()],
      isToday: i === 0,
      label: d.getDate().toString().padStart(2, '0')
    });
  }
  return days;
};

export default function HabitsWidget({ habitsManager, goals }) {
  const { habits, habitLogs, toggleHabitLog, addHabit, deleteHabit, loading } = habitsManager;
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGoalId, setNewGoalId] = useState('');

  const last7Days = useMemo(() => getLast7Days(), []);

  const activeGoals = goals.filter(g => g.status === 'active');

  const handleSaveHabit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await addHabit({
      title: newTitle.trim(),
      goal_id: newGoalId || null,
      frequency: 'daily', // Simplificado para versão 1.0
      icon: '✨'
    });

    setNewTitle('');
    setNewGoalId('');
    setIsAdding(false);
  };

  const calculateConsistency = (habitId) => {
    // Quantas vezes nos últimos 7 dias?
    const logs = habitLogs.filter(l => l.habit_id === habitId);
    let count = 0;
    last7Days.forEach(day => {
      if (logs.some(l => l.completed_date === day.dateStr)) count++;
    });
    return Math.round((count / 7) * 100);
  };

  if (loading) return null;

  return (
    <div className="habits-widget-container animate-fade-in">
      <div className="goals-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="goals-section-eyebrow" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sprout size={14} style={{ color: 'var(--success)' }} /> Seus Hábitos Diários
        </h3>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)} 
            style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={14} /> Novo Hábito
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSaveHabit} className="habit-add-form" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Ex: Ler 15 minutos" 
            className="form-input" 
            style={{ flex: 1, minWidth: '200px' }}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            autoFocus
          />
          <select 
            className="form-input" 
            style={{ width: 'auto' }}
            value={newGoalId}
            onChange={e => setNewGoalId(e.target.value)}
          >
            <option value="">Sem objetivo vinculado</option>
            {activeGoals.map(g => (
              <option key={g.id} value={g.id}>{g.icon} {g.title}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn-primary-glow" style={{ padding: '8px 16px', borderRadius: '6px' }}>Adicionar</button>
            <button type="button" onClick={() => setIsAdding(false)} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--border-medium)' }}>Cancelar</button>
          </div>
        </form>
      )}

      {habits.length === 0 && !isAdding ? (
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>Nenhum hábito rastreado ainda. Crie pequenos hábitos para construir grandes objetivos.</p>
        </div>
      ) : (
        <div className="habits-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {habits.map(habit => {
            const goal = goals.find(g => g.id === habit.goal_id);
            const consistency = calculateConsistency(habit.id);
            
            return (
              <div key={habit.id} className="habit-row-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', gap: '16px', flexWrap: 'wrap' }}>
                
                {/* Info do Hábito */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{habit.icon}</span>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-main)' }}>{habit.title}</span>
                  </div>
                  {goal && (
                    <span style={{ fontSize: '11px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: goal.color }}>↳ Contribui para: {goal.title}</span>
                    </span>
                  )}
                </div>

                {/* Tracker dos 7 dias */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                  
                  <div className="habit-tracker-days" style={{ display: 'flex', gap: '6px' }}>
                    {last7Days.map(day => {
                      const isCompleted = habitLogs.some(l => l.habit_id === habit.id && l.completed_date === day.dateStr);
                      return (
                        <div key={day.dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '9px', color: day.isToday ? 'var(--primary)' : 'var(--text-light)', fontWeight: day.isToday ? '600' : '400' }}>
                            {day.label}
                          </span>
                          <button
                            onClick={() => toggleHabitLog(habit.id, day.dateStr)}
                            style={{
                              width: '24px', height: '24px', borderRadius: '6px',
                              backgroundColor: isCompleted ? 'var(--primary)' : 'var(--bg-app)',
                              border: `1px solid ${isCompleted ? 'var(--primary)' : 'var(--border-medium)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', transition: 'all 0.2s',
                              boxShadow: isCompleted ? '0 0 8px var(--primary-glow)' : 'none'
                            }}
                          >
                            {isCompleted && <Check size={14} strokeWidth={3} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Estatística de Consistência */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '60px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase' }}>7 Dias</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: consistency >= 70 ? 'var(--primary)' : 'var(--text-main)' }}>
                      {consistency}%
                    </span>
                  </div>

                  <button 
                    onClick={() => { if(window.confirm('Excluir este hábito?')) deleteHabit(habit.id); }}
                    style={{ color: 'var(--text-light)', padding: '4px', borderRadius: '4px' }}
                    className="delete-btn"
                  >
                    <Trash2 size={16} />
                  </button>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
