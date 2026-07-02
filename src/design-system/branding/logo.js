/**
 * Centralized utility to resolve official branding logo URLs.
 * Eliminates hardcoded references and CSS filter workarounds.
 * 
 * @param {string} theme - Active theme mode ('light' | 'dark')
 * @param {string} context - Execution context ('default' | 'legal' | etc.)
 * @returns {object} { src, alt }
 */
export function getLogo(theme, context = 'default') {
  const isDarkBackground = theme === 'dark' || context === 'legal';
  return {
    src: isDarkBackground ? '/branding/logo-light.svg' : '/branding/logo-dark.svg',
    alt: 'MyFlowDay Logo'
  };
}
