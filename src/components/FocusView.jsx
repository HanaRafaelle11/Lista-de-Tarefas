import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, Moon, Sun, Volume2, Settings } from 'lucide-react';
import { useAppContext, parseTaskMetadata } from '../contexts/AppContext';

export default function FocusView() {
  const { tasks, handleToggleComplete, logEvent, isPro, handleSimulateUpgrade } = useAppContext();
  const pendingTasks = tasks.filter(t => !t.completed);

  // Estados do Timer
  const [focusTime, setFocusTime] = useState(25); // em minutos
  const [breakTime, setBreakTime] = useState(5);  // em minutos
  const [timeLeft, setTimeLeft] = useState(25 * 60); // em segundos
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('focus'); // 'focus' | 'break'
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const timerRef = useRef(null);

  // Sincroniza timeLeft ao alterar focusTime/breakTime se inativo
  useEffect(() => {
    if (!isActive) {
      setTimeLeft((mode === 'focus' ? focusTime : breakTime) * 60);
    }
  }, [focusTime, breakTime, mode, isActive]);

  // Efeito principal do Timer
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive]);

  const handleTimerComplete = () => {
    setIsActive(false);
    playNotificationSound();
    
    if (mode === 'focus') {
      logEvent('focus_timer_completed', { duration_minutes: focusTime, task_id: selectedTaskId });
      // Envia notificação nativa se disponível
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Flowday ⏱️', {
          body: 'Ciclo de foco concluído! Hora de uma pausa de ' + breakTime + ' minutos.',
          icon: '/favicon.svg'
        });
      }
      setMode('break');
      setTimeLeft(breakTime * 60);
    } else {
      logEvent('break_timer_completed', { duration_minutes: breakTime });
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Flowday ⏱️', {
          body: 'A pausa acabou! Hora de voltar ao foco.',
          icon: '/favicon.svg'
        });
      }
      setMode('focus');
      setTimeLeft(focusTime * 60);
    }
  };

  const toggleTimer = () => {
    if (!isActive) {
      logEvent('focus_timer_started', { mode, task_id: selectedTaskId });
    } else {
      logEvent('focus_timer_paused', { mode, timeLeft });
    }
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setMode('focus');
    setTimeLeft(focusTime * 60);
    logEvent('focus_timer_reset');
  };

  const handleTaskComplete = (taskId) => {
    handleToggleComplete(taskId);
    logEvent('task_completed_in_focus', { task_id: taskId });
    if (selectedTaskId === taskId) {
      setSelectedTaskId('');
    }
  };

  // Toca um beep amigável usando Web Audio API (100% offline-ready e sem carregar arquivos)
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // Ré5
      oscillator.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.15); // Lá5
      
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn('Falha ao tocar som de notificação:', e);
    }
  };

  // Formata MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const percentage = timeLeft / ((mode === 'focus' ? focusTime : breakTime) * 60);
  const strokeDashoffset = 283 - (283 * percentage);

  const activeTask = pendingTasks.find(t => t.id === selectedTaskId);

  return (
    <div className="focus-view-container animate-fade-in">
      <div className="tasks-page-header" style={{ marginBottom: '24px' }}>
        <h1 className="tasks-page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⏱️ Modo Foco
        </h1>
        <p className="tasks-page-subtitle">Pomodoro para concentração máxima</p>
      </div>

      <div className="focus-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        
        {/* Lado Esquerdo: O Timer Pomodoro */}
        <div className="focus-card-panel" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          
          <button 
            onClick={() => setShowConfig(!showConfig)}
            style={{ position: 'absolute', top: '20px', right: '20px', padding: '8px', color: 'var(--text-light)', background: 'transparent', cursor: 'pointer' }}
            title="Ajustar Tempos"
          >
            <Settings size={20} />
          </button>

          {/* Configurações customizáveis (Premium Flags check) */}
          {showConfig && (
            <div style={{ position: 'absolute', top: '60px', right: '20px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '16px', zIndex: 10, width: '220px', boxShadow: 'var(--shadow-md)' }} className="animate-fade-in">
              <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-main)' }}>Configurar Ciclos</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-light)', marginBottom: '2px' }}>Tempo Foco (min)</label>
                  <input 
                    type="number" 
                    value={focusTime} 
                    onChange={(e) => {
                      const v = Math.max(1, Number(e.target.value));
                      if (v > 25 && !isPro) {
                        alert('Tempos superiores a 25 minutos estão disponíveis apenas no plano Pro!');
                        return;
                      }
                      setFocusTime(v);
                    }}
                    style={{ width: '100%', padding: '6px', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-light)', marginBottom: '2px' }}>Pausa Curta (min)</label>
                  <input 
                    type="number" 
                    value={breakTime} 
                    onChange={(e) => setBreakTime(Math.max(1, Number(e.target.value)))}
                    style={{ width: '100%', padding: '6px', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>
              <button 
                onClick={() => setShowConfig(false)} 
                style={{ marginTop: '12px', width: '100%', padding: '6px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '600', fontSize: '11px' }}
              >
                Salvar Tempos
              </button>
            </div>
          )}

          {/* Modo Label */}
          <div style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: '700', letterSpacing: '0.1em', color: mode === 'focus' ? 'var(--primary)' : 'var(--prio-alta-text)', marginBottom: '16px' }}>
            {mode === 'focus' ? '🎯 Foco' : '☕ Pausa'}
          </div>

          {/* Gráfico circular de progresso */}
          <div style={{ position: 'relative', width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="220" height="220" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
              <circle 
                cx="50" cy="50" r="45" 
                stroke="var(--border-medium)" 
                strokeWidth="4" 
                fill="transparent" 
              />
              <circle 
                cx="50" cy="50" r="45" 
                stroke={mode === 'focus' ? 'var(--primary)' : 'var(--prio-alta-text)'} 
                strokeWidth="4.5" 
                fill="transparent" 
                strokeDasharray="283" 
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '44px', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          {/* Controles do Timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '32px' }}>
            <button 
              onClick={resetTimer}
              style={{ width: '48px', height: '48px', borderRadius: '50%', border: '1px solid var(--border-medium)', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', transition: 'all 0.2s' }}
              title="Reiniciar"
            >
              <RotateCcw size={18} />
            </button>
            
            <button 
              onClick={toggleTimer}
              style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: mode === 'focus' ? 'var(--primary)' : 'var(--prio-alta-text)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', transition: 'all 0.2s', scale: isActive ? '1' : '1.05' }}
            >
              {isActive ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" style={{ marginLeft: '4px' }} />}
            </button>
            
            <button 
              onClick={playNotificationSound}
              style={{ width: '48px', height: '48px', borderRadius: '50%', border: '1px solid var(--border-medium)', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', transition: 'all 0.2s' }}
              title="Testar Som"
            >
              <Volume2 size={18} />
            </button>
          </div>

          {/* Detalhe da Tarefa Selecionada */}
          <div style={{ marginTop: '32px', textAlign: 'center', maxWidth: '380px' }}>
            {activeTask ? (
              <div style={{ padding: '12px 20px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-glow)', border: '1px solid var(--primary-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={() => handleTaskComplete(activeTask.id)}
                  style={{ color: 'var(--primary)', background: 'transparent', cursor: 'pointer' }}
                  title="Concluir Tarefa"
                >
                  <CheckCircle2 size={20} />
                </button>
                <div style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', fontWeight: '700' }}>Focando em</span>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>{activeTask.title}</h4>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-light)', fontStyle: 'italic' }}>
                Selecione uma tarefa na barra lateral para iniciar seu ciclo de foco.
              </p>
            )}
          </div>

        </div>

        {/* Lado Direito: Seletor de Tarefas Pendentes */}
        <div className="focus-card-panel" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '16px' }}>Selecione a Tarefa</h3>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px' }}>
            {pendingTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-light)' }}>
                <p style={{ fontSize: '13px' }}>Nenhuma tarefa pendente para focar.</p>
              </div>
            ) : (
              pendingTasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  style={{ 
                    textAlign: 'left',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${selectedTaskId === t.id ? 'var(--primary)' : 'var(--border-light)'}`,
                    backgroundColor: selectedTaskId === t.id ? 'var(--primary-glow)' : 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontWeight: selectedTaskId === t.id ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <span>{t.title}</span>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--text-light)' }}>
                    <span>{t.category || 'Sem Categoria'}</span>
                    <span>•</span>
                    <span style={{ color: t.priority === 'Alta' ? 'var(--prio-alta-text)' : 'inherit' }}>{t.priority}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {!isPro && (
            <div style={{ marginTop: '20px', padding: '12px', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', textAlign: 'center', backgroundColor: 'var(--bg-app)' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)' }}>Versão Pro Desbloqueia</span>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 8px' }}>Pomodoro personalizável superior a 25 minutos e gráficos de produtividade.</p>
              <button 
                onClick={handleSimulateUpgrade}
                style={{ padding: '6px 12px', fontSize: '10px', fontWeight: '600', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '6px', width: '100%', cursor: 'pointer' }}
              >
                Testar Pro Grátis ⚡
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
