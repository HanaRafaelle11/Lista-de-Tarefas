import React from 'react';

export function Container({ children, style = {}, ...props }) {
  return (
    <div
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '0 16px',
        width: '100%',
        boxSizing: 'border-box',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
}
