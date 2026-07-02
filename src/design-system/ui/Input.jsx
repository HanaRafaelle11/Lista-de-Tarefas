import React from 'react';

export function Input({ style = {}, ...props }) {
  return (
    <input
      {...props}
      style={{
        padding: '10px 12px',
        borderRadius: '8px',
        border: '1px solid var(--border-medium)',
        outline: 'none',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-main)',
        fontSize: '13.5px',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s ease',
        ...style
      }}
    />
  );
}
