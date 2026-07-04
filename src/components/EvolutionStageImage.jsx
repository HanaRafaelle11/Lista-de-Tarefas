import React from 'react';

/**
 * EvolutionStageImage component
 * Renders a single evolution stage asset using a standard <img> tag.
 * The asset prop is now a Vite-resolved import (hashed URL), not a public path.
 *
 * @param {Object} props
 * @param {string} props.asset - Vite-resolved image URL (from ES import)
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
        width: '85%',
        height: '85%',
        objectFit: 'contain',
        objectPosition: 'center',
        zIndex: 2,
        mixBlendMode: 'screen',
        display: 'block',
        flexShrink: 0,
      }}
    />
  );
}
