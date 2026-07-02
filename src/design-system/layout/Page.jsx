import React from 'react';
import { useTheme } from '../theme/useTheme';

export function Page({ children, style = {}, ...props }) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        minHeight: '100vh',
        width: '100%',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
}
