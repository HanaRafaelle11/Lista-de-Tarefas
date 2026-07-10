import React, { useState, useMemo } from 'react';
import { Plus, Check, Trash2 } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import MFIcon from './MFIcon';

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

function HabitRow({ habit, goal, consistency, last7Days, habitLogs, toggleHabitLog, deleteHabit, openCustomConfirm }) {
  return (
    <div className="habit-row-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', gap: '16px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '160px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--primary)' }}><MFIcon name="habits" size={16} /></span>
          <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-main)' }}>{habit.title}</span>
        </div>
        {goal && (
          <span style={{ fontSize: '11px', color: goal.color }}>↳ Contribui para: {goal.title}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div className="habit-tracker-days" style={{ display: 'flex', gap: '6px' }}>
          {last7Days.map(day => {
            const habitStartDate = habit.created_at ? habit.created_at.split('T')[0] : '';
            const isBeforeCreation = habitStartDate && day.dateStr < habitStartDate;
            const isCompleted = habitLogs.some(l => l.habit_id === habit.id && l.completed_date === day.dateStr);
            return (
              <div key={day.dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '9px', color: day.isToday ? 'var(--primary)' : 'var(--text-light)', fontWeight: day.isToday ? '600' : '400' }}>{day.label}</span>
                <button
                  onClick={() => !isBeforeCreation && toggleHabitLog(habit.id, day.dateStr)}
                  disabled={isBeforeCreation}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    backgroundColor: isCompleted ? 'var(--primary)' : 'var(--bg-app)',
                    border: `1px solid ${isCompleted ? 'var(--primary)' : (isBeforeCreation ? 'transparent' : 'var(--border-medium)')}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isBeforeCreation ? 'var(--text-light)' : 'white',
                    transition: 'all 0.2s',
                    boxShadow: isCompleted ? '0 0 8px var(--primary-glow)' : 'none',
                    opacity: isBeforeCreation ? 0.3 : 1,
                    cursor: isBeforeCreation ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isCompleted ? <Check size={14} strokeWidth={3} /> : (isBeforeCreation ? '-' : null)}
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '52px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase' }}>7 Dias</span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: consistency >= 70 ? 'var(--primary)' : 'var(--text-main)' }}>{consistency}%</span>
        </div>
        <button
          onClick={() => openCustomConfirm('Excluir este hábito?', 'Excluir Hábito', () => deleteHabit(habit.id))}
          style={{ color: 'var(--text-light)', padding: '4px', borderRadius: '4px' }}
          className="delete-btn"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function HabitsWidget({ habitsManager, goals }) {
  const { openCustomConfirm } = useAppContext();
  const { habits, habitLogs, toggleHabitLog, addHabit, deleteHabit, loading } = habitsManager;
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGoalId, setNewGoalId] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCompletedHabits, setShowCompletedHabits] = useState(false);

  const last7Days = useMemo(() => getLast7Days(), []);

  const activeGoals = goals.filter(g => g.status === 'active' && !g.deletedAt && !g.deleted_at);

  const handleSaveHabit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await addHabit({
      title: newTitle.trim(),
      goal_id: newGoalId || null,
      frequency: 'daily', // Simplificado para versão 1.0
      icon: 'sparkles'
    });

    setNewTitle('');
    setNewGoalId('');
    setIsAdding(false);
  };

  const calculateConsistency = (habit) => {
    const habitStartDate = habit.created_at ? habit.created_at.split('T')[0] : '';
    const logs = habitLogs.filter(l => l.habit_id === habit.id);
    let completedCount = 0;
    let applicableDaysCount = 0;
    
    last7Days.forEach(day => {
      if (!habitStartDate || day.dateStr >= habitStartDate) {
        applicableDaysCount++;
        if (logs.some(l => l.completed_date === day.dateStr)) {
          completedCount++;
        }
      }
    });
    
    if (applicableDaysCount === 0) return 0;
    return Math.round((completedCount / applicableDaysCount) * 100);
  };

  if (loading) return null;

  const today = new Date().toISOString().split('T')[0];
  const pendingHabits = habits.filter(h => !habitLogs.some(l => l.habit_id === h.id && l.completed_date === today));
  const completedTodayHabits = habits.filter(h => habitLogs.some(l => l.habit_id === h.id && l.completed_date === today));

  const visiblePending = isExpanded ? pendingHabits : pendingHabits.slice(0, 3);

  return (
    <div className="habits-widget-container animate-fade-in">
      <div className="goals-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="goals-section-eyebrow" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MFIcon name="habits" size={14} style={{ color: 'var(--primary)' }} /> Seus Hábitos Diários
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
            {activeGoals.map(g => {
              const iconEmoji = (() => {
                if (!g.icon) return '🎯';
                const isEmoji = /\p{Emoji}/u.test(g.icon) && !/^[a-zA-Z0-9-]+$/.test(g.icon);
                if (isEmoji) return g.icon;
                const map = {
                  target: '🎯', rocket: '🚀', book: '📖', dollar: '💰',
                  home: '🏠', globe: '🌍', dumbbell: '💪', brain: '🧠',
                  heart: '❤️', palette: '🎨', music: '🎵', plane: '✈️',
                  sprout: '🌱', trending: '📈', star: '⭐', users: '👥'
                };
                return map[g.icon.toLowerCase()] || '🎯';
              })();
              return (
                <option key={g.id} value={g.id}>{iconEmoji} {g.title}</option>
              );
            })}
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
        <>
          {/* ── Hábitos pendentes ── */}
          <div className="habits-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {visiblePending.map(habit => {
              const goal = goals.find(g => g.id === habit.goal_id);
              const consistency = calculateConsistency(habit);
              return (
                <HabitRow key={habit.id} habit={habit} goal={goal} consistency={consistency} last7Days={last7Days} habitLogs={habitLogs} toggleHabitLog={toggleHabitLog} deleteHabit={deleteHabit} openCustomConfirm={openCustomConfirm} />
              );
            })}
          </div>

          {pendingHabits.length > 3 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--primary-glow)', transition: 'all 0.2s' }}
              >
                {isExpanded ? 'Recolher' : `Mostrar mais (+${pendingHabits.length - 3})`}
              </button>
            </div>
          )}

          {/* ── Hábitos concluídos hoje ── */}
          {completedTodayHabits.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <button
                onClick={() => setShowCompletedHabits(!showCompletedHabits)}
                style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', width: '100%' }}
              >
                <span style={{ flex: 1, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ✅ Concluídos hoje ({completedTodayHabits.length})
                </span>
                <span style={{ fontSize: '10px' }}>{showCompletedHabits ? '▲' : '▼'}</span>
              </button>
              {showCompletedHabits && (
                <div className="habits-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', opacity: 0.7 }}>
                  {completedTodayHabits.map(habit => {
                    const goal = goals.find(g => g.id === habit.goal_id);
                    const consistency = calculateConsistency(habit);
                    return (
                      <HabitRow key={habit.id} habit={habit} goal={goal} consistency={consistency} last7Days={last7Days} habitLogs={habitLogs} toggleHabitLog={toggleHabitLog} deleteHabit={deleteHabit} openCustomConfirm={openCustomConfirm} />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
