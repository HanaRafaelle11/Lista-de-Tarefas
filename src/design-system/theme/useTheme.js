import { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { tokens } from './tokens';

/**
 * Hook to consume the current theme state from the global AppContext,
 * dynamically resolved for dark/light modes.
 */
export function useTheme() {
  const context = useContext(AppContext);

  const theme = context?.theme || 'dark'; // Default to dark as primary brand mode
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const mode = isDark ? 'dark' : 'light';

  return {
    mode,
    colors: {
      bg: tokens.colors.bg[mode],
      text: tokens.colors.text[mode],
      border: tokens.colors.border[mode],
      primary: tokens.colors.primary,
      secondary: tokens.colors.secondary,
      danger: tokens.colors.danger,
      success: tokens.colors.success,
    },
    radius: tokens.radius,
    spacing: tokens.spacing
  };
}
