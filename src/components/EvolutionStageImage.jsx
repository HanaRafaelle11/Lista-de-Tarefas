import React from 'react';

/**
 * EvolutionStageImage component
 * Renders a single evolution stage asset wrapped in a card-blending container.
 *
 * @param {Object} props
 * @param {string} props.asset - Vite-resolved image URL (from ES import)
 * @param {string} props.alt - Accessibility description for screen readers
 * @param {string} props.color - Theme color of the current stage
 * @param {string} props.animationKey - Unique key to trigger fade-in transitions
 */
export default function EvolutionStageImage({ asset, alt, color, animationKey }) {
  return (
    <div
      key={animationKey}
      className="animate-fade-in"
      style={{
        width: '85%',
        height: '85%',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        flexShrink: 0,
        boxShadow: `0 8px 32px ${color}15`,
        border: '1px solid var(--border-light)',
      }}
    >
      <img
        src={asset}
        alt={alt}
        loading="lazy"
        draggable={false}
        className="evolution-stage-img"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block',
        }}
      />
    </div>
  );
}
