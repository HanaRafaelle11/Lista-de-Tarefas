import React from 'react';
import { Lock } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

/**
 * PremiumOverlay component to block features for free users with style.
 *
 * @param {Object} props
 * @param {string} props.title - The title of the overlay card
 * @param {string} props.description - The description of the overlay card
 * @param {string} props.buttonText - The text inside the button
 * @param {string|Object} props.paywallSource - The source identifier or options object to pass to openPaywall
 * @param {boolean} [props.inline=false] - If true, render inline instead of absolute overlay
 * @param {Object} [props.cardStyle] - Extra styles for the inner card container
 * @param {Object} [props.containerStyle] - Extra styles for the outer overlay wrapper
 */
export default function PremiumOverlay({ 
  title, 
  description, 
  buttonText = 'Quero o MyFlowDay Pro', 
  paywallSource,
  inline = false,
  cardStyle = {},
  containerStyle = {}
}) {
  const { openPaywall } = useAppContext();

  const handleOpenPaywall = (e) => {
    e.stopPropagation();
    openPaywall(paywallSource);
  };

  if (inline) {
    return (
      <div 
        onClick={handleOpenPaywall}
        style={{
          marginTop: '4px',
          marginBottom: '16px',
          padding: '14px 16px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          border: '1.5px dashed var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          boxSizing: 'border-box',
          cursor: 'pointer',
          ...containerStyle
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Lock size={13} style={{ color: 'var(--primary)' }} /> {title}
        </span>
        <button 
          className="btn-primary-glow"
          onClick={handleOpenPaywall}
          style={{
            padding: '8px 16px',
            fontSize: '11.5px',
            fontWeight: 'bold',
            cursor: 'pointer',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--primary)',
            color: '#ffffff'
          }}
        >
          {buttonText}
        </button>
      </div>
    );
  }

  return (
    <div 
      onClick={handleOpenPaywall}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        zIndex: 5,
        padding: '16px',
        boxSizing: 'border-box',
        ...containerStyle
      }}
    >
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
        padding: '20px 24px',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        textAlign: 'center',
        maxWidth: '360px',
        width: '100%',
        boxSizing: 'border-box',
        ...cardStyle
      }}>
        <Lock size={18} style={{ color: 'var(--primary)' }} />
        <h5 style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
          {title}
        </h5>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
          {description}
        </p>
        <button 
          className="btn-primary-glow"
          onClick={handleOpenPaywall}
          style={{ 
            padding: '8px 16px', 
            fontSize: '11.5px', 
            fontWeight: 'bold',
            marginTop: '8px',
            cursor: 'pointer',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'var(--primary)',
            color: '#ffffff'
          }}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
