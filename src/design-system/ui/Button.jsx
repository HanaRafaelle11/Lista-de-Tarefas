import React from 'react';

export function Button({ variant = 'primary', style = {}, ...props }) {
  const base = {
    padding: '10px 14px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14.5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    fontFamily: 'var(--font-display)'
  };

  const variants = {
    primary: {
      background: 'var(--primary)',
      color: '#FFFFFF',
      boxShadow: 'var(--shadow-sm)'
    },
    danger: {
      background: 'var(--prio-alta-bg)',
      color: 'var(--prio-alta-text)'
    },
    ghost: {
      background: 'transparent',
      border: '1.5px solid var(--border-medium)',
      color: 'var(--text-main)'
    }
  };

  return (
    <button
      style={{ ...base, ...variants[variant], ...style }}
      {...props}
    />
  );
}
