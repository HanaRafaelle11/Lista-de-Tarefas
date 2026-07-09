import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, Moon, Sun, Volume2, Settings, VolumeX, Music, Clock, Target, Coffee } from 'lucide-react';
import { useAppContext, parseTaskMetadata } from '../contexts/AppContext';
import { MFIcon } from './MFIcon';

export default function FocusView() {
  const {
    tasks,
    goals = [],
    goalTasks = [],
    handleToggleComplete,
    logEvent,
    isPro,
    openPaywall,
    ambientSoundFile,
    setAmbientSoundFile,
    ambientSoundVolume,
    setAmbientSoundVolume,
    isAmbientPlaying,
    setIsAmbientPlaying,
    audioBlocked,
    setAudioBlocked,
    openCustomAlert,
    setActiveTab
  } = useAppContext();

  const pendingTasks = tasks.filter(t => !t.completed);

  // Estados do Timer
  const [focusTime, setFocusTime] = useState(() => Number(localStorage.getItem('flowday_pomodoro_focus')) || 25);
  const [breakTime, setBreakTime] = useState(() => Number(localStorage.getItem('flowday_pomodoro_break')) || 5);
  
  const [isActive, setIsActive] = useState(() => localStorage.getItem('flowday_pomodoro_is_active') === 'true');
  const [mode, setMode] = useState(() => localStorage.getItem('flowday_pomodoro_mode') || 'focus');
  const [selectedTaskId, setSelectedTaskId] = useState(() => localStorage.getItem('flowday_pomodoro_selected_task_id') || '');
  
  const [timeLeft, setTimeLeft] = useState(() => {
    const savedTime = localStorage.getItem('flowday_pomodoro_time_left');
    if (savedTime !== null) {
      const parsed = Number(savedTime);
      const activeState = localStorage.getItem('flowday_pomodoro_is_active') === 'true';
      if (parsed <= 0 && !activeState) {
        const savedFocus = Number(localStorage.getItem('flowday_pomodoro_focus')) || 25;
        const savedBreak = Number(localStorage.getItem('flowday_pomodoro_break')) || 5;
        const savedMode = localStorage.getItem('flowday_pomodoro_mode') || 'focus';
        return (savedMode === 'focus' ? savedFocus : savedBreak) * 60;
      }
      const lastTick = localStorage.getItem('flowday_pomodoro_last_tick');
      if (activeState && lastTick) {
        const elapsed = Math.floor((Date.now() - new Date(lastTick).getTime()) / 1000);
        const adjusted = parsed - Math.max(0, elapsed);
        return adjusted > 0 ? adjusted : 0;
      }
      return parsed;
    }
    const savedFocus = Number(localStorage.getItem('flowday_pomodoro_focus')) || 25;
    return savedFocus * 60;
  });

  const [showConfig, setShowConfig] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const isFirstMount = useRef(true);

  // Estados temporários do painel de configuração
  const [tempFocus, setTempFocus] = useState(focusTime);
  const [tempBreak, setTempBreak] = useState(breakTime);

  const timerRef = useRef(null);

  // Sincroniza timeLeft ao alterar focusTime/breakTime se inativo (apenas após o mount inicial)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (!isActive) {
      setTimeLeft((mode === 'focus' ? focusTime : breakTime) * 60);
    }
  }, [focusTime, breakTime, mode]);

  // Efeito on-mount para completar timer se terminou enquanto fora
  useEffect(() => {
    const activeState = localStorage.getItem('flowday_pomodoro_is_active') === 'true';
    const lastTick = localStorage.getItem('flowday_pomodoro_last_tick');
    const savedTime = localStorage.getItem('flowday_pomodoro_time_left');
    if (activeState && lastTick && savedTime !== null) {
      const parsed = Number(savedTime);
      const elapsed = Math.floor((Date.now() - new Date(lastTick).getTime()) / 1000);
      const adjusted = parsed - Math.max(0, elapsed);
      if (adjusted <= 0) {
        setTimeLeft(0);
        setIsActive(false);
        handleTimerComplete();
      }
    }
  }, []);

  // Migração para garantir que o tempo padrão de foco seja resetado para 25 minutos no primeiro acesso
  useEffect(() => {
    if (!localStorage.getItem('flowday_pomodoro_default_fixed_25')) {
      localStorage.setItem('flowday_pomodoro_focus', '25');
      localStorage.setItem('flowday_pomodoro_break', '5');
      localStorage.setItem('flowday_pomodoro_default_fixed_25', 'true');
      setFocusTime(25);
      setBreakTime(5);
      setTimeLeft(25 * 60);
    }
  }, []);

  // Persiste estado do timer a cada tick/mudança
  useEffect(() => {
    localStorage.setItem('flowday_pomodoro_time_left', String(timeLeft));
    localStorage.setItem('flowday_pomodoro_is_active', String(isActive));
    localStorage.setItem('flowday_pomodoro_mode', mode);
    localStorage.setItem('flowday_pomodoro_selected_task_id', selectedTaskId);
    if (isActive) {
      localStorage.setItem('flowday_pomodoro_last_tick', new Date().toISOString());
    } else {
      localStorage.removeItem('flowday_pomodoro_last_tick');
    }
  }, [timeLeft, isActive, mode, selectedTaskId]);

  // Efeito principal do Timer
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
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

  // Efeito para disparar a finalização de forma segura fora da fase de render/update do state
  useEffect(() => {
    if (isActive && timeLeft === 0) {
      handleTimerComplete();
    }
  }, [timeLeft, isActive]);

  const handleTimerComplete = () => {
    setIsActive(false);
    playNotificationSound();
    setIsAmbientPlaying(false);
    
    if (mode === 'focus') {
      setShowSuccessAnimation(true);
      logEvent('focus_timer_completed', { duration_minutes: focusTime, task_id: selectedTaskId });
      logEvent('focus_completed', { duration_minutes: focusTime, task_id: selectedTaskId });
      logEvent('pomodoro_completed', { duration_minutes: focusTime, task_id: selectedTaskId });
      logEvent('focus_session_completed', { duration_minutes: focusTime, task_id: selectedTaskId });
      
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Flowday - Timer', {
            body: 'Ciclo de foco concluído! Hora de uma pausa de ' + breakTime + ' minutos.',
            icon: '/icon.svg'
          });
        } catch (e) {
          console.warn('[FocusView] Erro ao disparar notificação de foco:', e);
        }
      }
      setMode('break');
      setTimeLeft(breakTime * 60);
    } else {
      logEvent('break_timer_completed', { duration_minutes: breakTime });
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Flowday - Timer', {
            body: 'A pausa acabou! Hora de voltar ao foco.',
            icon: '/icon.svg'
          });
        } catch (e) {
          console.warn('[FocusView] Erro ao disparar notificação de pausa:', e);
        }
      }
      setMode('focus');
      setTimeLeft(focusTime * 60);
    }
  };

  const toggleTimer = () => {
    if (!isActive) {
      const isResume = timeLeft < (mode === 'focus' ? focusTime : breakTime) * 60;
      if (isResume) {
        logEvent('focus_session_resumed', { mode, task_id: selectedTaskId, timeLeft });
      } else {
        logEvent('focus_session_started', { mode, task_id: selectedTaskId });
        logEvent('focus_started', { mode, task_id: selectedTaskId });
      }
    } else {
      logEvent('focus_session_paused', { mode, timeLeft });
    }
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setMode('focus');
    setTimeLeft(focusTime * 60);
    logEvent('focus_session_cancelled', { mode, timeLeft });
  };

  const handleSaveConfig = () => {
    const focusVal = parseInt(tempFocus, 10);
    const breakVal = parseInt(tempBreak, 10);

    if (isNaN(focusVal) || focusVal < 1 || focusVal > 120) {
      openCustomAlert('O tempo de foco deve ser entre 1 e 120 minutos.');
      return;
    }
    if (isNaN(breakVal) || breakVal < 1 || breakVal > 60) {
      openCustomAlert('O tempo de pausa deve ser entre 1 e 60 minutos.');
      return;
    }

    if ((focusVal !== 25 || breakVal !== 5) && !isPro) {
      openPaywall('focus_timer_limit');
      return;
    }

    setFocusTime(focusVal);
    setBreakTime(breakVal);
    localStorage.setItem('flowday_pomodoro_focus', String(focusVal));
    localStorage.setItem('flowday_pomodoro_break', String(breakVal));
    
    if (!isActive) {
      setTimeLeft((mode === 'focus' ? focusVal : breakVal) * 60);
    }
    
    setShowConfig(false);
    logEvent('pomodoro_config_saved', { focus_minutes: focusVal, break_minutes: breakVal });
  };

  const handleTaskComplete = (taskId) => {
    handleToggleComplete(taskId);
    logEvent('task_completed_in_focus', { task_id: taskId });
    if (selectedTaskId === taskId) {
      setSelectedTaskId('');
    }
  };

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn('Falha ao tocar som de notificação:', e);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const percentage = timeLeft / ((mode === 'focus' ? focusTime : breakTime) * 60);
  const strokeDashoffset = 283 - (283 * percentage);

  const activeTask = pendingTasks.find(t => t.id === selectedTaskId);

  const ambientSounds = [
    { value: 'none',            label: 'Nenhum', emoji: '🔇' },
    { value: 'rain.wav',        label: 'Chuva', emoji: '🌧️' },
    { value: 'forest.wav',      label: 'Floresta', emoji: '🌲' },
    { value: 'cafe.wav',        label: 'Cafeteria', emoji: '☕' },
    { value: 'ocean.wav',       label: 'Ondas do Mar', emoji: '🌊' },
    { value: 'fireplace.wav',   label: 'Lareira', emoji: '🔥' },
    { value: 'white-noise.wav', label: 'Ruído Branco', emoji: '💤' },
  ];

  return (
    <div className="focus-view-container animate-fade-in" style={{ paddingBottom: '90px' }}>
      
      {/* Botão de retorno e Cabeçalho */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('myday')} 
          className="btn-secondary" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            alignSelf: 'flex-start',
            padding: '8px 16px', 
            fontSize: '13px', 
            fontWeight: '600',
            cursor: 'pointer',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-main)',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          ← Voltar ao Meu Dia
        </button>
        
        <h1 className="tasks-page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 0 0' }}>
          <Clock size={22} style={{ color: 'var(--primary)' }} /> Modo Foco
        </h1>
        <p className="tasks-page-subtitle">Pomodoro para concentração máxima</p>
      </div>

      {/* Timer Centralizado de Coluna Única */}
      <div style={{ maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div className="focus-card-panel" style={{ 
          backgroundColor: 'var(--bg-card)', 
          borderRadius: 'var(--radius-lg)', 
          border: '1px solid var(--border-light)', 
          padding: '32px 24px',
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          position: 'relative',
          boxShadow: 'var(--shadow-md)'
        }}>
          
          <button 
            onClick={() => {
              if (!showConfig) {
                setTempFocus(focusTime);
                setTempBreak(breakTime);
              }
              setShowConfig(!showConfig);
            }}
            style={{ position: 'absolute', top: '20px', right: '20px', padding: '8px', color: 'var(--text-light)', background: 'transparent', cursor: 'pointer', border: 'none' }}
            title="Ajustar Tempos"
          >
            <Settings size={20} />
          </button>

          {/* Configurações dos Ciclos */}
          {showConfig && (
            <div style={{ position: 'absolute', top: '60px', right: '20px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '16px', zIndex: 10, width: '220px', boxShadow: 'var(--shadow-md)' }} className="animate-fade-in">
              <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-main)' }}>Configurar Ciclos</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div>
                  <label htmlFor="pomodoro-focus-input" style={{ display: 'block', color: 'var(--text-light)', marginBottom: '2px' }}>Tempo Foco (1-120 min)</label>
                  <input 
                    id="pomodoro-focus-input"
                    type="number" 
                    value={tempFocus} 
                    onChange={(e) => setTempFocus(e.target.value)}
                    min="1"
                    max="120"
                    style={{ width: '100%', padding: '6px', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label htmlFor="pomodoro-break-input" style={{ display: 'block', color: 'var(--text-light)', marginBottom: '2px' }}>Pausa Curta (1-60 min)</label>
                  <input 
                    id="pomodoro-break-input"
                    type="number" 
                    value={tempBreak} 
                    onChange={(e) => setTempBreak(e.target.value)}
                    min="1"
                    max="60"
                    style={{ width: '100%', padding: '6px', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>
              <button 
                onClick={handleSaveConfig} 
                style={{ marginTop: '12px', width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '700', fontSize: '12px', border: 'none', cursor: 'pointer' }}
              >
                Salvar Tempos
              </button>
            </div>
          )}

          {/* Modo Foco / Pausa */}
          <div style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: '700', letterSpacing: '0.1em', color: mode === 'focus' ? 'var(--primary)' : 'var(--prio-alta-text)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {mode === 'focus' ? (
              <>
                <Target size={14} /> Foco ativo
              </>
            ) : (
              <>
                <Coffee size={14} /> Pausa de descanso
              </>
            )}
          </div>

          {/* Círculo Progress */}
          <div style={{ position: 'relative', width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
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
              <span style={{ fontSize: '46px', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          {/* Controles Principais */}
          <div className="focus-timer-controls" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
            <button 
              onClick={resetTimer}
              style={{ width: '48px', height: '48px', borderRadius: '50%', border: '1px solid var(--border-medium)', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', transition: 'all 0.2s', cursor: 'pointer' }}
              title="Reiniciar"
              aria-label="Reiniciar cronômetro"
            >
              <RotateCcw size={18} />
            </button>
            
            <button 
              onClick={toggleTimer}
              style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: mode === 'focus' ? 'var(--primary)' : 'var(--prio-alta-text)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', transition: 'all 0.2s', cursor: 'pointer', transform: isActive ? 'scale(1)' : 'scale(1.05)' }}
              aria-label={isActive ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
            >
              {isActive ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" style={{ marginLeft: '4px' }} />}
            </button>
            
            <button 
              onClick={playNotificationSound}
              style={{ width: '48px', height: '48px', borderRadius: '50%', border: '1px solid var(--border-medium)', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', transition: 'all 0.2s', cursor: 'pointer' }}
              title="Testar Som"
            >
              <Volume2 size={18} />
            </button>
          </div>

          {/* Detalhe da Tarefa Ativa */}
          <div className="focus-task-detail" style={{ width: '100%', textAlign: 'center' }}>
            {activeTask ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', textAlign: 'left' }}>
                {/* Cabeçalho da Tarefa Ativa */}
                <div style={{ padding: '12px 20px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-glow)', border: '1px solid var(--primary-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    onClick={() => handleTaskComplete(activeTask.id)}
                    style={{ color: 'var(--primary)', background: 'transparent', cursor: 'pointer', border: 'none', padding: 0, display: 'flex', alignItems: 'center' }}
                    title="Concluir Tarefa"
                  >
                    <CheckCircle2 size={22} />
                  </button>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', fontWeight: '700' }}>Tarefa Ativa</span>
                    <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>{activeTask.title}</h4>
                  </div>
                </div>

                {/* Painel do Briefing da Missão (Visível quando o cronômetro está parado) */}
                {!isActive && (
                  <div className="animate-fade-in" style={{
                    backgroundColor: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', display: 'block' }}>
                      📋 Briefing da Missão
                    </span>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-light)' }}>🎯 Objetivo Relacionado:</span>
                        <strong style={{ color: 'var(--text-main)' }}>
                          {(() => {
                            const relation = goalTasks.find(gt => gt.task_id === activeTask.id);
                            const goalObj = relation ? goals.find(g => g.id === relation.goal_id) : null;
                            return goalObj ? goalObj.title : 'Geral (Nenhum)';
                          })()}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-light)' }}>⏱️ Tempo Estimado:</span>
                        <strong style={{ color: 'var(--text-main)' }}>{focusTime} minutos</strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-light)' }}>⚡ XP Estimado:</span>
                        <strong style={{ color: 'var(--primary)' }}>+{focusTime} XP</strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-light)' }}>📈 Impacto na Evolução:</span>
                        <strong style={{ color: '#10b981' }}>Sequência & Pets</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-light)', fontStyle: 'italic', margin: 0 }}>
                Inicie o cronômetro do Pomodoro. Você pode ativar o foco a partir de uma tarefa na aba "Meu Dia".
              </p>
            )}
          </div>

          {/* Sons Ambientes colapsados em um details */}
          <details style={{ width: '100%', marginTop: '24px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', padding: '12px 16px', overflow: 'hidden' }}>
            <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}>
              <Music size={15} style={{ color: 'var(--primary)' }} />
              <span>Sons Ambientes</span>
            </summary>
            
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-light)', fontSize: '11px', marginBottom: '8px' }}>Escolha o som:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
                  {ambientSounds.map(sound => {
                    const isSelected = ambientSoundFile === sound.value;
                    return (
                      <button
                        key={sound.value}
                        type="button"
                        onClick={() => {
                          setAmbientSoundFile(sound.value);
                          setIsAmbientPlaying(false);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '10px 8px',
                          borderRadius: '8px',
                          border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-medium)',
                          backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-card)',
                          color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        <MFIcon name={sound.emoji} size={18} color={isSelected ? 'var(--primary)' : 'var(--text-light)'} />
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                          {sound.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  onClick={() => setIsAmbientPlaying(!isAmbientPlaying)}
                  disabled={ambientSoundFile === 'none'}
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    backgroundColor: isAmbientPlaying ? 'var(--prio-alta-text)' : 'var(--primary)', 
                    color: 'white', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    border: 'none', 
                    cursor: 'pointer',
                    opacity: ambientSoundFile === 'none' ? 0.5 : 1
                  }}
                  title={isAmbientPlaying ? 'Pausar' : 'Tocar'}
                >
                  {isAmbientPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" style={{ marginLeft: '2px' }} />}
                </button>
                
                <Volume2 size={16} color="var(--text-light)" />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={ambientSoundVolume} 
                  onChange={(e) => setAmbientSoundVolume(Number(e.target.value))}
                  aria-label="Volume do som"
                  disabled={ambientSoundFile === 'none'}
                  style={{ flex: 1, height: '4px', backgroundColor: 'var(--border-medium)', borderRadius: '2px', outline: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                />
              </div>

              {audioBlocked && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px', borderRadius: '8px',
                  backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                  fontSize: '11px', color: '#92400e',
                }}>
                  <VolumeX size={14} style={{ flexShrink: 0 }} />
                  <span>
                    Clique no botão de reprodução acima para ativar o som.
                  </span>
                </div>
              )}
            </div>
          </details>

        </div>

      </div>

      {/* Modal de Celebração de Sucesso Pomodoro */}
      {showSuccessAnimation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} className="animate-fade-in">
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 24px',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px'
          }} className="animate-scale-up">
            
            {/* Ícone Celebrativo Animado */}
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-glow)',
              border: '2px solid var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(94, 96, 206, 0.3)',
              animation: 'pulse 2s infinite'
            }}>
              <Award size={40} style={{ color: 'var(--primary)' }} />
            </div>

            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 8px 0' }}>
                Missão Cumprida! 🎉
              </h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
                Você concluiu seu ciclo de foco de {focusTime} minutos com maestria.
              </p>
            </div>

            {/* Checklist de Progresso / Recompensas */}
            <div style={{
              width: '100%',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              border: '1px solid var(--border-light)',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--primary)', fontSize: '16px' }}>⚡</span>
                <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                  <strong>+{focusTime} XP</strong> de Foco Coletado!
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--accent-orange, #f97316)', fontSize: '16px' }}>🔥</span>
                <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                  Sua sequência de consistência está <strong>protegida!</strong>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#10b981', fontSize: '16px' }}>🌱</span>
                <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                  Seu Companheiro recebeu experiência para <strong>evoluir!</strong>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--accent-yellow, #eab308)', fontSize: '16px' }}>🏆</span>
                <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                  O Coach registrou seu progresso na aba <strong>Evolução!</strong>
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowSuccessAnimation(false);
              }}
              className="btn-primary-glow"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '14px',
                fontWeight: '700',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer'
              }}
            >
              Iniciar Pausa Coletiva
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
