import React from 'react';

/**
 * EvolutionStageImage component
 * Renders a single evolution stage asset using standard img with accessibility,
 * correct aspect ratio preservation, and a custom animation key to trigger
 * entering transitions when category or stage changes.
 * 
 * @param {Object} props
 * @param {string} props.asset - Path to the png asset
 * @param {string} props.alt - Accessibility description for screen readers
 * @param {string} props.color - Theme color of the current stage for drop-shadow
 * @param {string} props.animationKey - Unique key to trigger fade-in transitions
 */
export default function EvolutionStageImage({ asset, alt, color, animationKey }) {
  return (
    <img
      key={animationKey}
      src={asset}
      alt={alt}
      loading="lazy"
      draggable={false}
      className="evolution-stage-img animate-fade-in"
      style={{
        width: '100%',
        maxWidth: '180px',
        aspectRatio: '1 / 1',
        objectFit: 'contain',
        borderRadius: '16px',
        zIndex: 2,
        filter: `drop-shadow(0 4px 20px ${color}40)`,
        display: 'block'
      }}
    />
  );
}
