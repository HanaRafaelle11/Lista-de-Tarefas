import React from 'react';
import * as LucideIcons from 'lucide-react';

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
    <path d="M12 2 L15.5 9 L22 12 L15.5 15 L12 22 L8.5 15 L2 12 L8.5 9 Z" fill="none" />
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

  // ─── New icons (replacing OS emojis) ────────────────────────

  medal: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
    </>
  ),

  rocket: (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  ),

  strength: (
    <>
      <path d="M18 8h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M6 8H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2" />
      <line x1="6" y1="6" x2="6" y2="18" />
      <line x1="18" y1="6" x2="18" y2="18" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </>
  ),

  sparkle: (
    <>
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </>
  ),

  fire: (
    <path d="M12 22c4-2.5 6-6.5 6-10a8.2 8.2 0 0 0-3-6c0 3-1.5 5-3 6.5C10.5 14 9 14 8 13c-.3 1-.5 2-.5 3 0 3.5 2 7.5 4.5 6z" />
  ),

  gem: (
    <>
      <polygon points="12,2 22,8.5 12,22 2,8.5" />
      <line x1="2" y1="8.5" x2="22" y2="8.5" />
      <line x1="12" y1="2" x2="8" y2="8.5" />
      <line x1="12" y1="2" x2="16" y2="8.5" />
      <line x1="8" y1="8.5" x2="12" y2="22" />
      <line x1="16" y1="8.5" x2="12" y2="22" />
    </>
  ),

  trophy: (
    <>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </>
  ),

  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),

  paw: (
    <>
      <path d="M12 14c-1.66 0-3 1.34-3 3 0 2 1.5 3 3 3s3-1 3-3c0-1.66-1.34-3-3-3z" />
      <circle cx="7" cy="8" r="2" />
      <circle cx="17" cy="8" r="2" />
      <circle cx="12" cy="5" r="2" />
      <circle cx="4" cy="13" r="1.5" />
      <circle cx="20" cy="13" r="1.5" />
    </>
  ),

  coin: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="6" x2="12" y2="18" />
      <path d="M15 9H10.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H9" />
    </>
  ),

  seedling: (
    <>
      <path d="M12 22V10" />
      <path d="M6 14c0-4 2.5-6 6-6" />
      <path d="M18 10c0-4-2.5-6-6-6" />
      <path d="M6 14c-2 0-3.5 1-4 3" />
      <path d="M18 10c2 0 3.5 1 4 3" />
    </>
  ),

  bolt: (
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  ),

  warning: (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),

  zzz: (
    <>
      <path d="M4 4h6L4 12h6" />
      <path d="M14 8h4l-4 6h4" />
      <path d="M18 2h3l-3 4h3" />
    </>
  ),

  bulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </>
  ),

  chart: (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),

  'chart-up': (
    <>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </>
  ),

  'chart-down': (
    <>
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </>
  ),

  shield: (
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  ),

  bell: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),

  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12 11 15 16 9" />
    </>
  ),

  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),

  trash: (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </>
  ),

  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="22,4 12,13 2,4" />
    </>
  ),

  diamond: (
    <path d="M12 2L2 9l10 13L22 9L12 2z M2 9h20" />
  ),

  sun: (
    <>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </>
  ),

  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),

  gift: (
    <>
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </>
  ),

  confetti: (
    <>
      <path d="M5.8 11.3L2 22l10.7-3.8" />
      <path d="M4 3h.01" />
      <path d="M22 8h.01" />
      <path d="M15 2h.01" />
      <path d="M22 20h.01" />
      <path d="M22 2l-2.24.75a2.9 2.9 0 0 0-1.96 3.12v.01c.09.79-.45 1.53-1.24 1.67l-.01.01a1.58 1.58 0 0 0-1.28 1.54v.01c0 .78-.57 1.45-1.35 1.56h-.01a1.58 1.58 0 0 0-1.35 1.56v.01c0 .78-.57 1.45-1.35 1.56" />
    </>
  ),

  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),

  wave: (
    <>
      <path d="M7 15c-1-1-2-2.5-2-4.5C5 8 7 6 9 6c1 0 2 .5 2.5 1.5" />
      <path d="M11 7.5c.5-1 1.5-1.5 2.5-1.5 2 0 4 2 4 4.5 0 1-.3 2-.8 2.8" />
      <path d="M16.5 13.3c.8.8 1.5 1.5 1.5 2.7 0 3-3 5-6 5s-6-2-6-5c0-1 .5-2 1-2.5" />
    </>
  ),

  megaphone: (
    <>
      <path d="M3 11l18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </>
  ),

  pin: (
    <>
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
    </>
  ),

  brain: (
    <>
      <path d="M9.5 2A3.5 3.5 0 0 0 6 5.5c0 .59.15 1.15.42 1.63A3.5 3.5 0 0 0 4 10.5c0 1.28.69 2.4 1.72 3A3.49 3.49 0 0 0 4 16.5 3.5 3.5 0 0 0 7.5 20c.59 0 1.14-.15 1.62-.41A1.5 1.5 0 0 0 12 20.5" />
      <path d="M14.5 2A3.5 3.5 0 0 1 18 5.5c0 .59-.15 1.15-.42 1.63A3.5 3.5 0 0 1 20 10.5c0 1.28-.69 2.4-1.72 3A3.49 3.49 0 0 1 20 16.5a3.5 3.5 0 0 1-3.5 3.5c-.59 0-1.14-.15-1.62-.41A1.5 1.5 0 0 1 12 20.5" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </>
  ),

  star: (
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  ),

  'rain-drop': (
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  ),

  'music-note': (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),

  'coffee-cup': (
    <>
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </>
  ),

  'campfire': (
    <>
      <path d="M12 22c4-2.5 6-5.5 6-9a6.8 6.8 0 0 0-2.5-5c0 2.5-1.2 4-2.5 5.5-1-1-1.5-2-1.5-3.5C10 8.5 9.5 7.5 8 6c-.5 1.5-.5 3-.5 4.5 0 3.5 2 8 4.5 11.5z" />
      <line x1="2" y1="22" x2="22" y2="22" />
    </>
  ),

  'forest': (
    <>
      <path d="M12 2L7 10h3l-4 8h12l-4-8h3L12 2z" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </>
  ),

  'waves': (
    <>
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </>
  ),

  'bird': (
    <>
      <path d="M16 7h.01" />
      <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
      <path d="M20 7l2 .5-2 .5" />
      <path d="M10 18v3" />
      <path d="M14 17.75V21" />
    </>
  ),

  'city': (
    <>
      <rect x="2" y="10" width="6" height="12" />
      <rect x="9" y="4" width="6" height="18" />
      <rect x="16" y="8" width="6" height="14" />
      <line x1="4" y1="14" x2="6" y2="14" />
      <line x1="4" y1="18" x2="6" y2="18" />
      <line x1="11" y1="8" x2="13" y2="8" />
      <line x1="11" y1="12" x2="13" y2="12" />
      <line x1="11" y1="16" x2="13" y2="16" />
      <line x1="18" y1="12" x2="20" y2="12" />
      <line x1="18" y1="16" x2="20" y2="16" />
    </>
  ),

  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),

  send: (
    <>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),

  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),

  'thumbs-up': (
    <>
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </>
  ),

  refresh: (
    <>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),

  'info': (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),

  'question': (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),

  'error-x': (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </>
  ),

  'crown': (
    <>
      <path d="M2 20h20" />
      <path d="M4 20V10l4 4 4-8 4 8 4-4v10" />
    </>
  ),

  'paint-brush': (
    <>
      <path d="M18.37 2.63L14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3z" />
      <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
    </>
  ),
};

ICONS.sprout = ICONS.seedling;
ICONS.target = ICONS.objectives;
ICONS.briefcase = ICONS.career;
ICONS.book = ICONS.reading;

const emojiMap = {
  // Shortcodes
  'seedling': 'sprout',
  'sprout': 'sprout',
  'briefcase': 'career',
  'work': 'career',
  'home': 'home',
  'book': 'reading',
  'study': 'reading',
  'meditation': 'focus',
  'focus': 'focus',
  'target': 'objectives',
  
  // Browser emojis
  '🌱': 'sprout',
  '💼': 'career',
  '🏠': 'home',
  '📚': 'reading',
  '🧘': 'focus',
  '🧘‍♂️': 'focus',
  '🧘‍♀️': 'focus',
  '🎯': 'objectives',
  '🚀': 'objectives',
  '🌧️': 'rain-drop',
  '🌧': 'rain-drop',
  '🌲': 'forest',
  '☕': 'coffee-cup',
  '🌊': 'waves',
  '🔥': 'campfire',
  '💤': 'sleep',
  '🔇': 'volume-x'
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
  if (!name) return null;

  let resolvedName = name;
  const cleanName = typeof name === 'string' ? name.replace(/:/g, '').trim() : '';

  if (emojiMap[cleanName]) {
    resolvedName = emojiMap[cleanName];
  } else if (emojiMap[name]) {
    resolvedName = emojiMap[name];
  }

  const paths = ICONS[resolvedName.toLowerCase() ? resolvedName.toLowerCase() : resolvedName];

  if (!paths) {
    const lucideNameMap = {
      target: 'Target',
      rocket: 'Rocket',
      book: 'BookOpen',
      dollar: 'DollarSign',
      home: 'Home',
      globe: 'Globe',
      dumbbell: 'Dumbbell',
      brain: 'Brain',
      heart: 'Heart',
      palette: 'Palette',
      music: 'Music',
      plane: 'Plane',
      sprout: 'Sprout',
      trending: 'TrendingUp',
      star: 'Star',
      users: 'Users',
      lock: 'Lock',
      warning: 'AlertTriangle',
      trash: 'Trash2',
      chart: 'BarChart3',
      streak: 'Flame',
      achievements: 'Award',
      check: 'Check',
      bell: 'Bell'
    };

    const lucideKey = lucideNameMap[resolvedName.toLowerCase()] || 
                      resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1);
    
    const LucideComponent = LucideIcons[lucideKey];
    if (LucideComponent) {
      return (
        <LucideComponent 
          size={size} 
          color={color} 
          className={className} 
          style={style} 
        />
      );
    }

    const isEmoji = /\p{Emoji}/u.test(name) && !/^[a-zA-Z0-9-]+$/.test(name);
    return (
      <span 
        className={isEmoji ? className : `mf-icon-emoji ${className}`} 
        style={{ 
          fontSize: `${size * 0.9}px`, 
          lineHeight: 1, 
          display: 'inline-block', 
          verticalAlign: 'middle',
          ...style 
        }} 
        role="img" 
        aria-label={title || "ícone"}
      >
        {name}
      </span>
    );
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
      className={`mf-icon mf-icon-${resolvedName} ${className}`}
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
