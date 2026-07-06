import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import MFIcon from './MFIcon';

// Toast individual
function Toast({ achievement, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);
  const DURATION = 5000;

  useEffect(() => {
    // Toca som sintetizado em tempo real (Arpejo maior de C de videogame)
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + index * 0.08);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + index * 0.08 + 0.35);
        osc.start(audioCtx.currentTime + index * 0.08);
        osc.stop(audioCtx.currentTime + index * 0.08 + 0.35);
      });
    } catch (e) {
      console.warn('[AchievementToast] Som bloqueado ou falhou:', e);
    }

    const showTimer = setTimeout(() => setVisible(true), 30);
    timerRef.current = setTimeout(() => handleDismiss(), DURATION);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(timerRef.current);
    };
  }, []);

  const handleDismiss = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onDismiss(), 350);
  };

  const rarityColors = {
    'Comum': { border: '1px solid var(--border-medium)', badgeBg: 'var(--bg-card-hover)', badgeColor: 'var(--text-light)', label: 'Comum' },
    'Rara': { border: '2px solid #3b82f6', badgeBg: 'rgba(59, 130, 246, 0.15)', badgeColor: '#3b82f6', label: 'Rara 🔵' },
    'Épica': { border: '2px solid #8b5cf6', badgeBg: 'rgba(139, 92, 246, 0.15)', badgeColor: '#8b5cf6', label: 'Épica 🟣' },
    'Lendária': { border: '2px solid #eab308', badgeBg: 'rgba(234, 179, 8, 0.2)', badgeColor: '#eab308', label: 'Lendária 🟡', shadow: '0 0 15px rgba(234, 179, 8, 0.4)' }
  };
  
  const rarity = achievement.rarity || 'Comum';
  const style = rarityColors[rarity] || rarityColors['Comum'];

  return (
    <div
      className={`achievement-toast ${visible ? 'achievement-toast--visible' : ''} ${closing ? 'achievement-toast--closing' : ''}`}
      role="alert"
      aria-live="polite"
      style={{
        border: style.border,
        boxShadow: style.shadow || 'var(--shadow-lg)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden'
      }}
    >
      {/* Barra de progresso de auto-close */}
      <div
        className="achievement-toast-progress"
        style={{ animationDuration: `${DURATION}ms` }}
      />

      {/* Conteúdo */}
      <div className="achievement-toast-inner">
        <div className="achievement-toast-header" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <span className="achievement-toast-label" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <MFIcon name="sparkle" size={14} style={{ marginRight: '4px' }} /> Conquista Desbloqueada!
          </span>
          <span style={{ 
            fontSize: '9.5px', 
            fontWeight: '800', 
            textTransform: 'uppercase', 
            backgroundColor: style.badgeBg, 
            color: style.badgeColor, 
            padding: '2px 8px', 
            borderRadius: '4px', 
            marginLeft: 'auto',
            marginRight: '8px'
          }}>
            {style.label}
          </span>
          <button
            onClick={handleDismiss}
            className="achievement-toast-close"
            aria-label="Fechar"
            style={{ marginLeft: 0 }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="achievement-toast-body">
          <div className="achievement-toast-emoji-wrap">
            <MFIcon name={achievement.icon} size={28} title={achievement.title} />
          </div>
          <div className="achievement-toast-text">
            <p className="achievement-toast-title">{achievement.title}</p>
            <p className="achievement-toast-desc">{achievement.desc}</p>
          </div>
        </div>

        <div className="achievement-toast-footer">
          <button
            onClick={handleDismiss}
            className="achievement-toast-btn"
          >
            <MFIcon name="check" size={14} style={{ marginRight: '4px' }} /> Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

// Gerenciador de fila de toasts (FIFO sequencial)
export default function AchievementToastManager({ queue, onDismiss }) {
  if (queue.length === 0) return null;

  // Renderiza apenas o primeiro item da fila. 
  // O próximo item só será renderizado quando o atual for descartado e removido do estado do AppContext.
  const current = queue[0];

  return (
    <div className="achievement-toast-container" aria-label="Notificações de conquistas">
      <Toast
        key={current.id}
        achievement={current.achievement}
        onDismiss={() => onDismiss(current.id, current.achievement.key)}
      />
    </div>
  );
}
