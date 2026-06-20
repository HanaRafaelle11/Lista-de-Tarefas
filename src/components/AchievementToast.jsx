import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Toast individual
function Toast({ achievement, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);
  const DURATION = 4000; // Ajustado para 4 segundos no Sprint 2

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
    if (closing) return;
    setClosing(true);
    // Tempo para rodar a animação de saída/closing
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
          <span className="achievement-toast-label">✨ Conquista Desbloqueada!</span>
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

        <div className="achievement-toast-footer">
          <button
            onClick={handleDismiss}
            className="achievement-toast-btn"
          >
            ✓ Entendi
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
