import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Toast individual
function Toast({ achievement, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);
  const DURATION = 5000;

  useEffect(() => {
    // Slide-in após montagem
    const showTimer = setTimeout(() => setVisible(true), 30);

    // Auto-fechar após DURATION
    timerRef.current = setTimeout(() => handleDismiss(), DURATION);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(timerRef.current);
    };
  }, []);

  const handleDismiss = () => {
    setClosing(true);
    setTimeout(() => onDismiss(), 350);
  };

  return (
    <div
      className={`achievement-toast ${visible ? 'achievement-toast--visible' : ''} ${closing ? 'achievement-toast--closing' : ''}`}
      role="alert"
      aria-live="polite"
    >
      {/* Barra de progresso de auto-close */}
      <div
        className="achievement-toast-progress"
        style={{ animationDuration: `${DURATION}ms` }}
      />

      {/* Conteúdo */}
      <div className="achievement-toast-inner">
        <div className="achievement-toast-header">
          <span className="achievement-toast-label">✨ Nova conquista desbloqueada</span>
          <button
            onClick={handleDismiss}
            className="achievement-toast-close"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>

        <div className="achievement-toast-body">
          <div className="achievement-toast-emoji-wrap">
            <span className="achievement-toast-emoji" role="img" aria-label={achievement.title}>
              {achievement.emoji}
            </span>
          </div>
          <div className="achievement-toast-text">
            <p className="achievement-toast-title">{achievement.title}</p>
            <p className="achievement-toast-desc">{achievement.desc}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Gerenciador de fila de toasts
export default function AchievementToastManager({ queue, onDismiss }) {
  if (queue.length === 0) return null;

  return (
    <div className="achievement-toast-container" aria-label="Notificações de conquistas">
      {queue.map((item) => (
        <Toast
          key={item.id}
          achievement={item.achievement}
          onDismiss={() => onDismiss(item.id)}
        />
      ))}
    </div>
  );
}
