import React, { useState } from 'react';
import { Calendar, ChevronRight, Check } from 'lucide-react';

export default function WeeklyPlannerModal({ isOpen, onClose, tasks, onUpdateTask }) {
  if (!isOpen) return null;

  const [selectedTask, setSelectedTask] = useState(null);

  const pendingTasks = tasks.filter(t => !t.completed);
  const unscheduledTasks = pendingTasks.filter(t => !t.dueDate);
  
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', display: 'flex', flexDirection: 'row', padding: 0 }}>
        
        {/* Painel Esquerdo: Tarefas sem data */}
        <div style={{ flex: 1, borderRight: '1px solid var(--border-medium)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} className="text-primary" />
              Planejar Semana
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>
              Você tem {unscheduledTasks.length} tarefas sem prazo. Onde vamos encaixá-las?
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
        <div style={{ flex: 1, padding: '24px', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto' }}>
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
                    opacity: selectedTask ? 1 : 0.8
                  }}
                  className={selectedTask ? 'hover-day-slot' : ''}
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
    </div>
  );
}
