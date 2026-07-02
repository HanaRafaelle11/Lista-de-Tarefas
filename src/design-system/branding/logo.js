/**
 * Centralized utility to resolve official branding logo URLs.
 * Eliminates hardcoded references and CSS filter workarounds.
 * 
 * @param {string} theme - Active theme mode ('light' | 'dark')
 * @param {string} context - Execution context ('default' | 'legal' | etc.)
 * @returns {object} { src, alt }
 */
export function getLogo(theme, context = 'default') {
  return {
    src: '/icon.svg',
    alt: 'MyFlowDay Logo'
  };
}
