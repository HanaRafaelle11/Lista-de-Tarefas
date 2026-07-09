import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { EVOLUTION_CATEGORIES } from '../config/evolutionConfig';
import { Award, X } from 'lucide-react';

export default function EvolutionCelebrationModal() {
  const { celebrationState, closeCelebration } = useAppContext();
  const canvasRef = useRef(null);

  const { isOpen, companionType, level } = celebrationState;

  // Tocar som de vitória sintetizado ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      playVictorySound();
      setupConfetti();
    }
  }, [isOpen, companionType, level]);

  if (!isOpen) return null;

  const petData = EVOLUTION_CATEGORIES[companionType] || EVOLUTION_CATEGORIES.plant;
  const newStage = petData.stages.find(s => s.level === level) || petData.stages[0];

  function playVictorySound() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      const playNote = (freq, delay, duration, type = 'sine') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + delay);

        gain.gain.setValueAtTime(0.12, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + duration);
      };

      // Arpejo festivo e brilhante (Dó Maior com Sétima Maior)
      playNote(261.63, 0.0, 0.4, 'triangle'); // C4
      playNote(329.63, 0.1, 0.4, 'triangle'); // E4
      playNote(392.00, 0.2, 0.4, 'triangle'); // G4
      playNote(493.88, 0.3, 0.4, 'triangle'); // B4 (7ª Maior para um toque mágico)
      playNote(523.25, 0.4, 0.8, 'sine');     // C5
    } catch (e) {
      console.warn('[AudioCelebration] Falha ao sintetizar som:', e);
    }
  }

  function setupConfetti() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
    const confettiCount = 120;
    const confetti = [];

    for (let i = 0; i < confettiCount; i++) {
      confetti.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        r: Math.random() * 6 + 4,
        d: Math.random() * confettiCount,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngleIncremental: Math.random() * 0.07 + 0.02,
        tiltAngle: 0,
      });
    }

    let animationFrameId;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      confetti.forEach((c, index) => {
        c.tiltAngle += c.tiltAngleIncremental;
        c.y += (Math.cos(c.d) + 3 + c.r / 2) / 2;
        c.tilt = Math.sin(c.tiltAngle - index / 3) * 15;

        // Desenha confete
        ctx.beginPath();
        ctx.lineWidth = c.r;
        ctx.strokeStyle = c.color;
        ctx.moveTo(c.x + c.tilt + c.r / 2, c.y);
        ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r / 2);
        ctx.stroke();

        // Se sair da tela, reseta no topo
        if (c.y > height) {
          confetti[index] = {
            x: Math.random() * width,
            y: -20,
            r: c.r,
            d: c.d,
            color: c.color,
            tilt: Math.random() * 10 - 5,
            tiltAngleIncremental: c.tiltAngleIncremental,
            tiltAngle: 0,
          };
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(7, 9, 12, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '20px'
      }}
      onClick={closeCelebration}
    >
      <canvas 
        ref={canvasRef} 
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1
        }}
      />
      
      <div 
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'rgba(17, 22, 28, 0.9)',
          border: '1px solid color-mix(in srgb, var(--primary) 30%, rgba(255,255,255,0.08))',
          borderRadius: '24px',
          padding: '32px 24px 28px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          textAlign: 'center',
          zIndex: 2,
          animation: 'scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Estilo para animação scaleUp */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes scaleUp {
            from { transform: scale(0.9) translateY(10px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
          }
          @keyframes pulseBadge {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.4); }
            70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(236, 72, 153, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(236, 72, 153, 0); }
          }
        `}} />

        <button 
          onClick={closeCelebration}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'var(--text-light)',
            padding: '6px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title="Fechar"
        >
          <X size={16} />
        </button>

        <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', marginBottom: '16px', animation: 'pulseBadge 2s infinite' }}>
          <Award size={32} />
        </div>

        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: '6px', letterSpacing: '-0.02em' }}>
          Nova Evolução! 🎉
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Seu esforço e disciplina deram frutos.
        </p>

        {/* Companion Graphic Display */}
        <div style={{ position: 'relative', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: '220px', height: '220px', borderRadius: '50%', background: `radial-gradient(circle, ${newStage.color || '#ec4899'} 0%, transparent 65%)`, opacity: 0.15, filter: 'blur(20px)', pointerEvents: 'none' }} />
          {newStage.asset ? (
            <img 
              src={newStage.asset} 
              alt={newStage.alt || newStage.title} 
              style={{
                height: '140px',
                objectFit: 'contain',
                zIndex: 2,
                filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))'
              }}
            />
          ) : (
            <span style={{ fontSize: '64px', zIndex: 2 }}>{petData.emoji || '🌱'}</span>
          )}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <span 
            style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: 'color-mix(in srgb, ' + (newStage.color || '#ec4899') + ' 15%, transparent)',
              color: newStage.color || '#ec4899',
              border: '1px solid color-mix(in srgb, ' + (newStage.color || '#ec4899') + ' 30%, transparent)',
              marginBottom: '10px'
            }}
          >
            {newStage.badge || `Nível ${level}`}
          </span>
          <h3 style={{ fontSize: '18px', fontWeight: '750', color: '#fff', margin: '0 0 8px' }}>
            {newStage.title}
          </h3>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0, padding: '0 12px' }}>
            {newStage.desc}
          </p>
        </div>

        <button 
          onClick={closeCelebration}
          className="btn-primary-glow"
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '12px',
            fontSize: '14.5px',
            fontWeight: '600'
          }}
        >
          Continuar Focado!
        </button>
      </div>
    </div>
  );
}
