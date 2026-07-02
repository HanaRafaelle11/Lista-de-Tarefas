import React from 'react';

export function Card({ children, style = {}, ...props }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        padding: '24px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
}
