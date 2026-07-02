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
      background: 'var(--gradient-primary)',
      color: '#FBFAFC',
      boxShadow: '0 4px 14px rgba(94, 96, 206, 0.3)',
      border: 'none'
    },
    secondary: {
      background: 'transparent',
      border: '1.5px solid var(--secondary)',
      color: 'var(--secondary)'
    },
    danger: {
      background: 'var(--danger)',
      color: '#FBFAFC',
      border: 'none'
    },
    ghost: {
      background: 'transparent',
      border: 'none',
      color: 'var(--text-light)'
    }
  };

  return (
    <button
      style={{ ...base, ...variants[variant], ...style }}
      {...props}
    />
  );
}
