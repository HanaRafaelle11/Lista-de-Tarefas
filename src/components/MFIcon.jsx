/**
 * MFIcon — MyFlow Icons React Component
 *
 * Biblioteca proprietária MyFlow Icons v1.0
 * Outline monoline · 24×24px · stroke 2px · currentColor
 *
 * Usage:
 *   <MFIcon name="objectives" size={24} />
 *   <MFIcon name="streak" size={20} color="var(--primary)" />
 */

const ICONS = {
  objectives: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),

  tasks: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <polyline points="7.5,12.5 10.5,15.5 16.5,8.5" />
    </>
  ),

  focus: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),

  evolution: (
    <>
      <polyline points="4,20 12,11 20,3" />
      <polyline points="14,3 20,3 20,9" />
    </>
  ),

  consistency: (
    <path d="M12 2 L15.5 9 L22 12 L15.5 15 L12 22 L8.5 15 L2 12 L8.5 9 Z" />
  ),

  achievements: (
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  ),

  insights: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="9" x2="12" y2="2" />
    </>
  ),

  'goal-health': (
    <>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      <polyline points="7.5,13 9.5,11 11.5,15 13.5,11.5 15.5,13" />
    </>
  ),

  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="3" ry="3" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <circle cx="8.5" cy="15" r="1" fill="currentColor" />
      <circle cx="12" cy="15" r="1" fill="currentColor" />
      <circle cx="15.5" cy="15" r="1" fill="currentColor" />
      <circle cx="8.5" cy="19" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </>
  ),

  performance: (
    <>
      <line x1="3" y1="21" x2="21" y2="21" />
      <rect x="5" y="14" width="3.5" height="7" />
      <rect x="10.25" y="9" width="3.5" height="12" />
      <rect x="15.5" y="4" width="3.5" height="17" />
    </>
  ),

  profile: (
    <>
      <path d="M15 5 C15 5 17 7 17 10 C17 13 15 15 12 15 L12 19 C15 19 18 20 18 22 L7 22" />
      <path d="M7 22 L7 5 C7 3.3 8.8 2 11 2 C13.2 2 15 3.3 15 5" />
    </>
  ),

  admin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <rect x="6" y="13" width="3" height="5" rx="0.5" />
      <rect x="11" y="11" width="3" height="7" rx="0.5" />
      <rect x="16" y="14" width="3" height="4" rx="0.5" />
    </>
  ),

  'flow-score': (
    <path d="M2 12 C4.5 7 7 17 10 12 C13 7 15.5 17 18 12 C19.5 9 21 10.5 22 12" />
  ),

  streak: (
    <>
      <circle cx="5" cy="18" r="2" />
      <circle cx="12" cy="11" r="2" />
      <circle cx="19" cy="4" r="2" />
      <path d="M7 17 C9 14 10 13 10 11" />
      <path d="M14 10 C16 7 17 6 17 4" />
    </>
  ),

  'flow-mode': (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8.5 12 C8.5 10 9.8 9 11 9 C12.5 9 13 10.5 12 12 C11 13.5 11.5 15 13 15 C14.2 15 15.5 14 15.5 12 C15.5 10 14.2 9 13 9 C11.5 9 11 10.5 12 12 C13 13.5 12.5 15 11 15 C9.8 15 8.5 14 8.5 12 Z" />
    </>
  ),

  journey: (
    <>
      <circle cx="4" cy="20" r="2" />
      <circle cx="20" cy="4" r="2" />
      <path d="M5.4 18.6 C7 14 11 10 18.6 5.4" />
    </>
  ),

  health: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),

  studies: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),

  family: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),

  pets: (
    <>
      <path d="M12 14c-1.66 0-3 1.34-3 3 0 2 1.5 3 3 3s3-1 3-3c0-1.66-1.34-3-3-3z" />
      <circle cx="7" cy="8" r="2.5" />
      <circle cx="17" cy="8" r="2.5" />
      <circle cx="12" cy="5.5" r="2.5" />
    </>
  ),

  finance: (
    <>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),

  career: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),

  reading: (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),

  home: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </>
  ),

  travel: (
    <>
      <path d="M22 2L11 13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),

  fitness: (
    <>
      <path d="M18 8h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 8H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2M6 12h12M6 6v12M18 6v12" />
    </>
  ),

  nutrition: (
    <>
      <path d="M18 8V2M22 8V2M14 8V2M14 8a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4M12 2v20M12 2h-2a4 4 0 0 0-4 4v4a2 2 0 0 0 2 2h4" />
    </>
  ),

  sleep: (
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  ),

  habits: (
    <>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
};

/**
 * @param {object} props
 * @param {keyof ICONS} props.name - Icon name
 * @param {number} [props.size=24] - Icon size in px
 * @param {string} [props.color] - CSS color (defaults to currentColor)
 * @param {string} [props.className] - Additional CSS class
 * @param {string} [props.style] - Additional inline styles
 * @param {string} [props.title] - Accessible title
 */
export function MFIcon({ name, size = 24, color, className = '', style = {}, title }) {
  const paths = ICONS[name];

  if (!paths) {
    if (import.meta.env.DEV) {
      console.warn(`[MFIcon] Ícone não encontrado: "${name}". Ícones disponíveis: ${Object.keys(ICONS).join(', ')}`);
    }
    return null;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`mf-icon mf-icon-${name} ${className}`}
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
      aria-hidden={!title}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {paths}
    </svg>
  );
}

export default MFIcon;
