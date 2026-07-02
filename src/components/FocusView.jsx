import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, Moon, Sun, Volume2, Settings, VolumeX, Music, Clock, Target, Coffee } from 'lucide-react';
import { useAppContext, parseTaskMetadata } from '../contexts/AppContext';

export default function FocusView() {
  const {
    tasks,
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
    setAudioBlocked
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
  const isFirstMount = useRef(true);

  // Estados temporários do painel de configuração
  const [tempFocus, setTempFocus] = useState(focusTime);
  const [tempBreak, setTempBreak] = useState(breakTime);

  useEffect(() => {
    if (showConfig) {
      setTempFocus(focusTime);
      setTempBreak(breakTime);
    }
  }, [showConfig, focusTime, breakTime]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    
    if (mode === 'focus') {
      logEvent('focus_timer_completed', { duration_minutes: focusTime, task_id: selectedTaskId });
      logEvent('focus_completed', { duration_minutes: focusTime, task_id: selectedTaskId });
      logEvent('pomodoro_completed', { duration_minutes: focusTime, task_id: selectedTaskId });
      logEvent('focus_session_completed', { duration_minutes: focusTime, task_id: selectedTaskId });
      // Envia notificação nativa se disponível
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Flowday - Timer', {
          body: 'Ciclo de foco concluído! Hora de uma pausa de ' + breakTime + ' minutos.',
          icon: '/favicon.ico'
        });
      }
      setMode('break');
      setTimeLeft(breakTime * 60);
    } else {
      logEvent('break_timer_completed', { duration_minutes: breakTime });
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Flowday - Timer', {
          body: 'A pausa acabou! Hora de voltar ao foco.',
          icon: '/favicon.ico'
        });
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
      logEvent('focus_timer_paused', { mode, timeLeft });
    }
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setMode('focus');
    setTimeLeft(focusTime * 60);
    logEvent('focus_session_cancelled', { mode, timeLeft });
    logEvent('focus_timer_reset');
  };

  const handleSaveConfig = () => {
    const focusVal = parseInt(tempFocus, 10);
    const breakVal = parseInt(tempBreak, 10);

    if (isNaN(focusVal) || focusVal < 1 || focusVal > 120) {
      alert('O tempo de foco deve ser entre 1 e 120 minutos.');
      return;
    }
    if (isNaN(breakVal) || breakVal < 1 || breakVal > 60) {
      alert('O tempo de pausa deve ser entre 1 e 60 minutos.');
      return;
    }

    if (focusVal > 25 && !isPro) {
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

  const ambientSounds = [
    { value: 'none',            label: 'Nenhum',       emoji: '🔇' },
    { value: 'rain.wav',        label: 'Chuva',        emoji: '🌧️' },
    { value: 'forest.wav',      label: 'Floresta',     emoji: '🌲' },
    { value: 'cafe.wav',        label: 'Cafeteria',    emoji: '☕' },
    { value: 'ocean.wav',       label: 'Ondas do Mar', emoji: '🌊' },
    { value: 'fireplace.wav',   label: 'Lareira',      emoji: '🔥' },
    { value: 'white-noise.wav', label: 'Ruído Branco', emoji: '🤍' },
  ];


  return (
    <div className="focus-view-container animate-fade-in">
      {/* O áudio ambiente global é controlado de forma persistente através do AppContext */}


      <div className="tasks-page-header" style={{ marginBottom: '24px' }}>
        <h1 className="tasks-page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={22} style={{ color: 'var(--primary)' }} /> Modo Foco
        </h1>
        <p className="tasks-page-subtitle">Pomodoro para concentração máxima</p>
      </div>

      <div className="focus-main-grid">
        
        {/* Lado Esquerdo: O Timer Pomodoro */}
        <div className="focus-card-panel left-panel" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          
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
                  <label style={{ display: 'block', color: 'var(--text-light)', marginBottom: '2px' }}>Tempo Foco (1-120 min)</label>
                  <input 
                    type="number" 
                    value={tempFocus} 
                    onChange={(e) => setTempFocus(e.target.value)}
                    min="1"
                    max="120"
                    style={{ width: '100%', padding: '6px', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-light)', marginBottom: '2px' }}>Pausa Curta (1-60 min)</label>
                  <input 
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
                style={{ marginTop: '12px', width: '100%', padding: '6px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '600', fontSize: '11px', border: 'none', cursor: 'pointer' }}
              >
                Salvar Tempos
              </button>
            </div>
          )}

          {/* Modo Label */}
          <div style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: '700', letterSpacing: '0.1em', color: mode === 'focus' ? 'var(--primary)' : 'var(--prio-alta-text)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {mode === 'focus' ? (
              <>
                <Target size={14} /> Foco
              </>
            ) : (
              <>
                <Coffee size={14} /> Pausa
              </>
            )}
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
          <div className="focus-timer-controls">
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

          {/* Controles de Áudio Ambiente */}
          <div style={{ marginTop: '32px', width: '80%', display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
              <Music size={16} /> Sons Ambientes
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Seletor de som */}
              <div>
                <label htmlFor="ambient-sound-selector" style={{ display: 'block', color: 'var(--text-light)', fontSize: '12px', marginBottom: '5px' }}>Escolha o Som:</label>
                <select 
                  id="ambient-sound-selector"
                  value={ambientSoundFile} 
                  onChange={(e) => {
                    setAmbientSoundFile(e.target.value);
                    setIsAmbientPlaying(false); // Evita bloqueio de autoplay em dispositivos móveis
                  }}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-medium)', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '13px' }}
                >
                  {ambientSounds.map(sound => (
                    <option key={sound.value} value={sound.value}>{sound.emoji} {sound.label}</option>
                  ))}
                </select>
              </div>

              {/* Controles de Play/Pause e Volume */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  onClick={() => {
                    setIsAmbientPlaying(!isAmbientPlaying);
                  }}
                  disabled={ambientSoundFile === 'none'}
                  style={{ 
                    width: '36px', 
                    height: '36px', 
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
                  title={isAmbientPlaying ? 'Pausar som ambiente' : 'Tocar som ambiente'}
                  aria-label={isAmbientPlaying ? 'Pausar som ambiente' : 'Tocar som ambiente'}
                >
                  {isAmbientPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" style={{ marginLeft: '2px' }} />}
                </button>
                
                <Volume2 size={18} color="var(--text-light)" />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={ambientSoundVolume} 
                  onChange={(e) => setAmbientSoundVolume(Number(e.target.value))}
                  aria-label="Volume do som ambiente"
                  disabled={ambientSoundFile === 'none'}
                  style={{ flex: 1, height: '4px', backgroundColor: 'var(--border-medium)', borderRadius: '2px', outline: 'none', WebkitAppearance: 'none', appearance: 'none', cursor: ambientSoundFile === 'none' ? 'default' : 'pointer' }}
                />
                {ambientSoundVolume === 0 && <VolumeX size={18} color="var(--text-light)" />}
              </div>

              {/* Banner de aviso de autoplay bloqueado */}
              {audioBlocked && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px', borderRadius: '8px',
                  backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                  fontSize: '12px', color: '#92400e',
                }}>
                  <span>🔇</span>
                  <span>
                    <strong>Clique para ativar o som.</strong>{' '}
                    O navegador bloqueou a reprodução automática. Clique no botão ▶ acima para iniciar.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Detalhe da Tarefa Selecionada */}
          <div className="focus-task-detail">
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
              <>
                <p className="focus-helper-text-desktop" style={{ fontSize: '13px', color: 'var(--text-light)', fontStyle: 'italic' }}>
                  Selecione uma tarefa na barra lateral para iniciar seu ciclo de foco.
                </p>
                <p className="focus-helper-text-mobile" style={{ fontSize: '13px', color: 'var(--text-light)', fontStyle: 'italic', display: 'none' }}>
                  Suas tarefas estão abaixo
                </p>
              </>
            )}
          </div>

        </div>

        {/* Lado Direito: Seletor de Tarefas Pendentes */}
        <div className="focus-card-panel right-panel" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column' }}>
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
                onClick={() => openPaywall('focus_bottom_upsell')}
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
