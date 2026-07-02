import React from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ size = 18, style = {}, ...props }) {
  return (
    <Loader2
      size={size}
      style={{
        animation: 'spin 1s linear infinite',
        ...style
      }}
      {...props}
    />
  );
}
