import React from 'react';

/**
 * EvolutionStageImage component
 * Renders a transparent background evolution stage asset with neon glow underneath.
 *
 * @param {Object} props
 * @param {string} props.asset - Vite-resolved image URL (from ES import)
 * @param {string} props.alt - Accessibility description for screen readers
 * @param {string} props.color - Theme color of the current stage for glow accents
 * @param {string} props.animationKey - Unique key to trigger fade-in transitions
 */
export default function EvolutionStageImage({ asset, alt, color, animationKey }) {
  return (
    <div
      key={animationKey}
      className="evolution-floating-companion animate-fade-in"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 2,
        flexShrink: 0,
      }}
    >
      {/* Dynamic neon glow backdrop (underneath the plant) */}
      <div 
        style={{
          position: 'absolute',
          width: '75%',
          height: '75%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}25 0%, ${color}05 50%, transparent 70%)`,
          filter: 'blur(20px)',
          zIndex: 1,
          pointerEvents: 'none',
        }} 
      />
      
      {/* Floating Plant Illustration */}
      <img
        src={asset}
        alt={alt}
        loading="lazy"
        draggable={false}
        className="evolution-stage-img"
        style={{
          width: '95%',
          height: '95%',
          objectFit: 'contain',
          objectPosition: 'center',
          zIndex: 2,
          display: 'block',
          // High-end neon drop shadow filter that highlights the illustration lines
          filter: `drop-shadow(0 12px 32px ${color}45)`,
          mixBlendMode: 'normal',
        }}
      />
    </div>
  );
}
