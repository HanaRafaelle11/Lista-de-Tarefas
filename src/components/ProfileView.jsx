import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Shield, Briefcase, FileText, Camera, Trash2, CheckCircle2, Sun, Moon, Palette } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import DefaultAvatar from './DefaultAvatar';

// ── Custom SVG Avatars matching the MyFlowDay visual identity ──
const dogSvg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <path d="M22 28 C14 36, 12 56, 20 62 C24 65, 27 60, 26 50 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="2.5" />
  <path d="M78 28 C86 36, 88 56, 80 62 C76 65, 73 60, 74 50 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="2.5" />
  <ellipse cx="50" cy="48" rx="26" ry="24" fill="#F8FAFC" stroke="#1E293B" stroke-width="2.5" />
  <ellipse cx="50" cy="56" rx="14" ry="12" fill="#FFFFFF" stroke="#1E293B" stroke-width="2" />
  <circle cx="39" cy="44" r="8" fill="#38BDF8" opacity="0.8" />
  <circle cx="39" cy="44" r="3.5" fill="#1E293B" />
  <circle cx="61" cy="44" r="3.5" fill="#1E293B" />
  <circle cx="40.5" cy="42.5" r="1" fill="#FFFFFF" />
  <circle cx="62.5" cy="42.5" r="1" fill="#FFFFFF" />
  <path d="M46 52 Q50 49 54 52 Q56 55 50 58 Q44 55 46 52 Z" fill="#1E293B" />
  <path d="M45 61 Q50 63 55 61" stroke="#1E293B" stroke-width="2" fill="none" />
  <path d="M47 62 C47 68, 53 68, 53 62 Z" fill="#F43F5E" stroke="#1E293B" stroke-width="2" />
  <path d="M35 70 C35 70, 50 75, 65 70" fill="none" stroke="#0EA5E9" stroke-width="5" stroke-linecap="round" />
  <circle cx="50" cy="74" r="4.5" fill="#F59E0B" stroke="#1E293B" stroke-width="1.5" />
</svg>
`;

const catSvg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <path d="M26 40 L20 18 C20 18, 38 24, 40 32 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="2.5" />
  <path d="M74 40 L80 18 C80 18, 62 24, 60 32 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="2.5" />
  <path d="M28 37 L24 23 C24 23, 35 27, 36 32 Z" fill="#FCE7F3" />
  <path d="M72 37 L76 23 C76 23, 65 27, 64 32 Z" fill="#FCE7F3" />
  <ellipse cx="50" cy="50" rx="26" ry="22" fill="#F8FAFC" stroke="#1E293B" stroke-width="2.5" />
  <ellipse cx="38" cy="46" rx="4.5" ry="3.5" fill="#1E293B" />
  <ellipse cx="62" cy="46" rx="4.5" ry="3.5" fill="#1E293B" />
  <circle cx="39.5" cy="44.5" r="1" fill="#FFFFFF" />
  <circle cx="63.5" cy="44.5" r="1" fill="#FFFFFF" />
  <polygon points="47,53 53,53 50,56" fill="#F43F5E" stroke="#1E293B" stroke-width="1" />
  <path d="M45 59 Q50 61 50 56 Q50 61 55 59" stroke="#1E293B" stroke-width="2" fill="none" />
  <path d="M20 50 L34 52 M18 57 L32 56 M20 64 L34 60" stroke="#1E293B" stroke-width="2" stroke-linecap="round" />
  <path d="M80 50 L66 52 M82 57 L68 56 M80 64 L66 60" stroke="#1E293B" stroke-width="2" stroke-linecap="round" />
  <path d="M36 68 C36 68, 50 72, 64 68" fill="none" stroke="#0EA5E9" stroke-width="4" stroke-linecap="round" />
</svg>
`;

const raccoonSvg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <path d="M25 35 L18 15 C18 15, 34 20, 38 27 Z" fill="#64748B" stroke="#1E293B" stroke-width="2.5" />
  <path d="M75 35 L82 15 C82 15, 66 20, 62 27 Z" fill="#64748B" stroke="#1E293B" stroke-width="2.5" />
  <path d="M26 31 L21 19 C21 19, 31 23, 33 27 Z" fill="#F8FAFC" />
  <path d="M74 31 L79 19 C79 19, 69 23, 67 27 Z" fill="#F8FAFC" />
  <ellipse cx="50" cy="52" rx="27" ry="22" fill="#94A3B8" stroke="#1E293B" stroke-width="2.5" />
  <polygon points="23,52 35,52 32,60 21,57" fill="#F8FAFC" />
  <polygon points="77,52 65,52 68,60 79,57" fill="#F8FAFC" />
  <path d="M25 48 C28 42, 45 44, 45 54 C45 58, 28 58, 25 48 Z" fill="#1E293B" />
  <path d="M75 48 C72 42, 55 44, 55 54 C55 58, 72 58, 75 48 Z" fill="#1E293B" />
  <circle cx="35" cy="50" r="3.5" fill="#FFFFFF" />
  <circle cx="65" cy="50" r="3.5" fill="#FFFFFF" />
  <circle cx="35" cy="50" r="1.5" fill="#1E293B" />
  <circle cx="65" cy="50" r="1.5" fill="#1E293B" />
  <ellipse cx="50" cy="62" rx="9" ry="7" fill="#F8FAFC" stroke="#1E293B" stroke-width="2" />
  <ellipse cx="50" cy="60" rx="4" ry="2.5" fill="#1E293B" />
  <path d="M48 64 Q50 66 52 64" stroke="#1E293B" stroke-width="1.5" fill="none" />
</svg>
`;

const capybaraSvg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Círculo de fundo -->
  <circle cx="50" cy="50" r="48" fill="#E0F2FE" stroke="#1E293B" stroke-width="3" />
  
  <!-- Corpo/Pescoço -->
  <path d="M35 75 Q42 62 50 62 Q58 62 65 75 Z" fill="#D2A078" stroke="#1E293B" stroke-width="2.5" />
  
  <!-- Cachecol/Detalhe Azul -->
  <path d="M33 72 C33 66, 67 66, 67 72 C67 78, 33 78, 33 72 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="2.5" />
  <path d="M38 74 L32 90 H44 Z" fill="#0284C7" stroke="#1E293B" stroke-width="2.5" />
  
  <!-- Cabeça da Capivara -->
  <!-- Orelha -->
  <path d="M60 28 C56 22, 68 22, 65 32 Z" fill="#D2A078" stroke="#1E293B" stroke-width="2.5" />
  <path d="M61 29 C59 25, 65 25, 63 31 Z" fill="#9A6A48" />
  
  <!-- Cabeça principal -->
  <path d="M28 50 C26 42, 34 32, 50 32 C58 32, 66 38, 66 48 C66 56, 58 62, 50 62 C38 62, 30 58, 28 50 Z" fill="#D2A078" stroke="#1E293B" stroke-width="2.5" />
  
  <!-- Focinho (Snout) -->
  <path d="M28 44 C26 38, 36 34, 38 48 C40 54, 34 58, 28 54 Z" fill="#9A6A48" stroke="#1E293B" stroke-width="2" />
  <path d="M26 44 Q28 47 30 46" fill="none" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round" />
  
  <!-- Olho -->
  <circle cx="50" cy="42" r="3.5" fill="#1E293B" />
  <circle cx="49" cy="41" r="1" fill="#FFFFFF" />
  
  <!-- Detalhe da bochecha/nariz -->
  <path d="M38 52 Q42 54 44 52" fill="none" stroke="#1E293B" stroke-width="2" stroke-linecap="round" />
</svg>
`;

const persona1Svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <path d="M32 40 C28 46, 28 62, 32 68 C34 70, 66 70, 68 68 C72 62, 72 46, 68 40 Z" fill="#1E293B" />
  <rect x="46" y="54" width="8" height="12" fill="#FEE2E2" stroke="#1E293B" stroke-width="2" />
  <circle cx="50" cy="42" r="18" fill="#FEE2E2" stroke="#1E293B" stroke-width="2.5" />
  <circle cx="42" cy="42" r="6" fill="none" stroke="#1E293B" stroke-width="2.5" />
  <circle cx="58" cy="42" r="6" fill="none" stroke="#1E293B" stroke-width="2.5" />
  <line x1="48" y1="42" x2="52" y2="42" stroke="#1E293B" stroke-width="2.5" />
  <line x1="32" y1="40" x2="36" y2="40" stroke="#1E293B" stroke-width="2.5" />
  <line x1="64" y1="40" x2="68" y2="40" stroke="#1E293B" stroke-width="2.5" />
  <path d="M32 40 C32 26, 68 26, 68 40 C68 40, 60 30, 50 34 C40 30, 32 40, 32 40 Z" fill="#1E293B" stroke="#1E293B" stroke-width="1" />
  <circle cx="42" cy="42" r="1.5" fill="#1E293B" />
  <circle cx="58" cy="42" r="1.5" fill="#1E293B" />
  <path d="M47 51 Q50 53 53 51" stroke="#1E293B" stroke-width="2" fill="none" stroke-linecap="round" />
  <path d="M22 82 C22 66, 30 60, 50 60 C70 60, 78 66, 78 82 Z" fill="#0D9488" stroke="#1E293B" stroke-width="2.5" />
  <path d="M42 60 L50 74 L58 60 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="2" />
  <path d="M48 70 L50 74 L52 70 Z" fill="#0D9488" />
</svg>
`;

const persona2Svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <path d="M32 38 C32 22, 68 22, 68 38 Z" fill="#1E293B" stroke="#1E293B" stroke-width="2" />
  <rect x="46" y="54" width="8" height="12" fill="#FEF3C7" stroke="#1E293B" stroke-width="2" />
  <circle cx="50" cy="42" r="18" fill="#FEF3C7" stroke="#1E293B" stroke-width="2.5" />
  <rect x="36" y="38" width="10" height="8" rx="1.5" fill="none" stroke="#1E293B" stroke-width="2.5" />
  <rect x="54" y="38" width="10" height="8" rx="1.5" fill="none" stroke="#1E293B" stroke-width="2.5" />
  <line x1="46" y1="42" x2="54" y2="42" stroke="#1E293B" stroke-width="2.5" />
  <circle cx="41" cy="42" r="1.5" fill="#1E293B" />
  <circle cx="59" cy="42" r="1.5" fill="#1E293B" />
  <path d="M47 51 Q50 53 53 51" stroke="#1E293B" stroke-width="2" fill="none" stroke-linecap="round" />
  <path d="M22 82 C22 66, 30 60, 50 60 C70 60, 78 66, 78 82 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="2.5" />
  <path d="M44 60 L50 72 L56 60 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="2" />
  <path d="M49 66 L51 66 L52 82 L48 82 Z" fill="#0F172A" />
</svg>
`;

const persona3Svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <rect x="46" y="54" width="8" height="12" fill="#F1F5F9" stroke="#1E293B" stroke-width="2" />
  <circle cx="50" cy="42" r="18" fill="#F1F5F9" stroke="#1E293B" stroke-width="2.5" />
  <path d="M30 40 A20 20 0 0 1 70 40" fill="none" stroke="#1E293B" stroke-width="3.5" stroke-linecap="round" />
  <rect x="28" y="36" width="5" height="10" rx="2" fill="#0EA5E9" stroke="#1E293B" stroke-width="2" />
  <rect x="67" y="36" width="5" height="10" rx="2" fill="#0EA5E9" stroke="#1E293B" stroke-width="2" />
  <path d="M33 44 C33 50, 43 54, 46 54" fill="none" stroke="#1E293B" stroke-width="2" />
  <circle cx="47" cy="54" r="2.5" fill="#1E293B" />
  <circle cx="42" cy="42" r="2" fill="#1E293B" />
  <circle cx="58" cy="42" r="2" fill="#1E293B" />
  <path d="M47 51 Q50 53 53 51" stroke="#1E293B" stroke-width="2" fill="none" stroke-linecap="round" />
  <path d="M22 82 C22 66, 30 60, 50 60 C70 60, 78 66, 78 82 Z" fill="#0D9488" stroke="#1E293B" stroke-width="2.5" />
  <path d="M44 60 L50 72 L56 60 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="2" />
  <path d="M49 66 L51 66 L52 82 L48 82 Z" fill="#0F172A" />
</svg>
`;

const persona4Svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <path d="M32 36 C32 20, 68 20, 68 36 Z" fill="#1E293B" stroke="#1E293B" stroke-width="2" />
  <rect x="46" y="54" width="8" height="12" fill="#FEF3C7" stroke="#1E293B" stroke-width="2" />
  <circle cx="50" cy="42" r="18" fill="#FEF3C7" stroke="#1E293B" stroke-width="2.5" />
  <circle cx="42" cy="42" r="2.5" fill="#1E293B" />
  <circle cx="58" cy="42" r="2.5" fill="#1E293B" />
  <path d="M46 51 Q50 54 54 51" stroke="#1E293B" stroke-width="2" fill="none" stroke-linecap="round" />
  <path d="M22 82 C22 66, 30 60, 50 60 C70 60, 78 66, 78 82 Z" fill="#0F172A" stroke="#1E293B" stroke-width="2.5" />
  <path d="M44 60 L50 72 L56 60 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="2" />
  <path d="M49 66 L51 66 L52 82 L48 82 Z" fill="#0EA5E9" />
</svg>
`;

const growth1Svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <line x1="26" y1="72" x2="74" y2="72" stroke="#1E293B" stroke-width="3.5" stroke-linecap="round" />
  <rect x="30" y="54" width="8" height="18" rx="1.5" fill="#94A3B8" stroke="#1E293B" stroke-width="2.5" />
  <rect x="44" y="42" width="8" height="30" rx="1.5" fill="#38BDF8" stroke="#1E293B" stroke-width="2.5" />
  <rect x="58" y="28" width="8" height="44" rx="1.5" fill="#0EA5E9" stroke="#1E293B" stroke-width="2.5" />
  <polygon points="62,14 65,20 72,21 67,26 68,33 62,29 56,33 57,26 52,21 59,20" fill="#F59E0B" stroke="#1E293B" stroke-width="2" stroke-linejoin="round" />
  <path d="M28 50 Q46 36 60 22" fill="none" stroke="#0EA5E9" stroke-width="3" stroke-linecap="round" />
  <polygon points="56,22 62,20 60,26" fill="#0EA5E9" />
</svg>
`;

const growth2Svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <line x1="50" y1="14" x2="50" y2="20" stroke="#0EA5E9" stroke-width="3" stroke-linecap="round" />
  <line x1="28" y1="28" x2="33" y2="33" stroke="#0EA5E9" stroke-width="3" stroke-linecap="round" />
  <line x1="72" y1="28" x2="67" y2="33" stroke="#0EA5E9" stroke-width="3" stroke-linecap="round" />
  <line x1="20" y1="50" x2="26" y2="50" stroke="#0EA5E9" stroke-width="3" stroke-linecap="round" />
  <line x1="80" y1="50" x2="74" y2="50" stroke="#0EA5E9" stroke-width="3" stroke-linecap="round" />
  <path d="M35 48 C35 34, 65 34, 65 48 C65 56, 58 60, 58 66 L42 66 C42 60, 35 56, 35 48 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" stroke-linejoin="round" />
  <path d="M46 54 L46 45 Q50 41 54 45 L54 54" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" />
  <rect x="44" y="68" width="12" height="4" rx="1" fill="#94A3B8" stroke="#1E293B" stroke-width="2.5" />
  <rect x="45" y="74" width="10" height="4" rx="1" fill="#94A3B8" stroke="#1E293B" stroke-width="2.5" />
  <circle cx="50" cy="80" r="1.5" fill="#1E293B" />
</svg>
`;

const growth3Svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <polygon points="56,44 76,74 36,74" fill="#94A3B8" stroke="#1E293B" stroke-width="2" />
  <polygon points="56,44 64,56 60,60 56,58 52,60 50,56" fill="#F8FAFC" />
  <polygon points="46,32 70,74 22,74" fill="#0EA5E9" stroke="#1E293B" stroke-width="3" />
  <polygon points="46,32 54,46 50,50 46,48 42,50 38,46" fill="#F8FAFC" />
  <line x1="46" y1="32" x2="46" y2="16" stroke="#1E293B" stroke-width="2" />
  <polygon points="46,16 60,21 46,26" fill="#F59E0B" stroke="#1E293B" stroke-width="2" stroke-linejoin="round" />
</svg>
`;

const growth4Svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <line x1="50" y1="50" x2="50" y2="24" stroke="#94A3B8" stroke-width="2" />
  <line x1="50" y1="50" x2="50" y2="76" stroke="#94A3B8" stroke-width="2" />
  <line x1="50" y1="50" x2="24" y2="50" stroke="#94A3B8" stroke-width="2" />
  <line x1="50" y1="50" x2="76" y2="50" stroke="#94A3B8" stroke-width="2" />
  <line x1="50" y1="50" x2="31" y2="31" stroke="#94A3B8" stroke-width="2" />
  <line x1="50" y1="50" x2="69" y2="31" stroke="#94A3B8" stroke-width="2" />
  <line x1="50" y1="50" x2="31" y2="69" stroke="#94A3B8" stroke-width="2" />
  <line x1="50" y1="50" x2="69" y2="69" stroke="#94A3B8" stroke-width="2" />
  <circle cx="50" cy="24" r="5" fill="#0EA5E9" stroke="#1E293B" stroke-width="2" />
  <circle cx="50" cy="76" r="5" fill="#0EA5E9" stroke="#1E293B" stroke-width="2" />
  <circle cx="24" cy="50" r="5" fill="#0EA5E9" stroke="#1E293B" stroke-width="2" />
  <circle cx="76" cy="50" r="5" fill="#0EA5E9" stroke="#1E293B" stroke-width="2" />
  <circle cx="31" cy="31" r="5" fill="#0D9488" stroke="#1E293B" stroke-width="2" />
  <circle cx="69" cy="31" r="5" fill="#0D9488" stroke="#1E293B" stroke-width="2" />
  <circle cx="31" cy="69" r="5" fill="#0D9488" stroke="#1E293B" stroke-width="2" />
  <circle cx="69" cy="69" r="5" fill="#0D9488" stroke="#1E293B" stroke-width="2" />
  <circle cx="50" cy="50" r="12" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <circle cx="50" cy="50" r="6" fill="#F59E0B" />
</svg>
`;

const flow1Svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <path d="M28 66 L28 42 C28 32, 40 24, 50 36 C60 24, 72 32, 72 42 L72 66" fill="none" stroke="#1E293B" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M38 66 L38 46 C38 38, 45 34, 50 41 C55 34, 62 38, 62 46 L62 66" fill="none" stroke="#0EA5E9" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="50" cy="50" r="4" fill="#F59E0B" />
</svg>
`;

const flow2Svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <circle cx="50" cy="50" r="32" fill="none" stroke="#94A3B8" stroke-width="2" stroke-dasharray="3 3" />
  <polygon points="50,18 53,47 50,50 47,47" fill="#0EA5E9" stroke="#1E293B" stroke-width="1.5" />
  <polygon points="50,82 53,53 50,50 47,53" fill="#64748B" stroke="#1E293B" stroke-width="1.5" />
  <polygon points="82,50 53,53 50,50 53,47" fill="#0EA5E9" stroke="#1E293B" stroke-width="1.5" />
  <polygon points="18,50 47,53 50,50 47,47" fill="#64748B" stroke="#1E293B" stroke-width="1.5" />
  <polygon points="72,28 52,48 50,50 48,48" fill="#0D9488" />
  <polygon points="28,72 48,52 50,50 52,52" fill="#64748B" />
  <polygon points="72,72 52,52 50,50 48,52" fill="#0D9488" />
  <polygon points="28,28 48,48 50,50 52,48" fill="#64748B" />
  <circle cx="50" cy="50" r="5" fill="#FFFFFF" stroke="#1E293B" stroke-width="2" />
  <circle cx="50" cy="50" r="2.5" fill="#F59E0B" />
</svg>
`;

const flow3Svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <path d="M50 20 C42 34, 38 42, 38 48 C38 55, 43 60, 50 60 C57 60, 62 55, 62 48 C62 42, 58 34, 50 20 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="2.5" stroke-linejoin="round" />
  <path d="M47 38 C44 44, 44 48, 47 52" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
  <ellipse cx="50" cy="68" rx="28" ry="8" fill="none" stroke="#94A3B8" stroke-width="2" stroke-dasharray="4 2" />
  <ellipse cx="50" cy="74" rx="20" ry="6" fill="none" stroke="#0EA5E9" stroke-width="2" />
  <ellipse cx="50" cy="78" rx="12" ry="4" fill="none" stroke="#0D9488" stroke-width="1.5" />
</svg>
`;

const flow4Svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#1E293B" stroke-width="3" />
  <circle cx="50" cy="50" r="32" fill="none" stroke="#94A3B8" stroke-width="2" stroke-dasharray="2 4" />
  <g transform="translate(50,50)">
    <circle cx="0" cy="-24" r="3.5" fill="#0EA5E9" stroke="#1E293B" stroke-width="1.5" />
    <circle cx="17" cy="-17" r="3.5" fill="#0D9488" stroke="#1E293B" stroke-width="1.5" />
    <circle cx="24" cy="0" r="3.5" fill="#0EA5E9" stroke="#1E293B" stroke-width="1.5" />
    <circle cx="17" cy="17" r="3.5" fill="#0D9488" stroke="#1E293B" stroke-width="1.5" />
    <circle cx="0" cy="24" r="3.5" fill="#0EA5E9" stroke="#1E293B" stroke-width="1.5" />
    <circle cx="-17" cy="17" r="3.5" fill="#0D9488" stroke="#1E293B" stroke-width="1.5" />
    <circle cx="-24" cy="0" r="3.5" fill="#0EA5E9" stroke="#1E293B" stroke-width="1.5" />
    <circle cx="-17" cy="-17" r="3.5" fill="#0D9488" stroke="#1E293B" stroke-width="1.5" />
  </g>
  <circle cx="50" cy="50" r="16" fill="none" stroke="#1E293B" stroke-width="2.5" />
  <circle cx="50" cy="50" r="10" fill="#F59E0B" />
</svg>
`;

const LIBRARY_AVATARS = {
  'Animais & Mascotes': [
    { id: 'am1', label: 'Cachorro', url: `data:image/svg+xml;utf8,${encodeURIComponent(dogSvg)}` },
    { id: 'am2', label: 'Gato', url: `data:image/svg+xml;utf8,${encodeURIComponent(catSvg)}` },
    { id: 'am3', label: 'Guaxinim', url: `data:image/svg+xml;utf8,${encodeURIComponent(raccoonSvg)}` },
    { id: 'am4', label: 'Capivara', url: `data:image/svg+xml;utf8,${encodeURIComponent(capybaraSvg)}` }
  ],
  'Personas': [
    { id: 'pe1', label: 'Mulher com Óculos', url: `data:image/svg+xml;utf8,${encodeURIComponent(persona1Svg)}` },
    { id: 'pe2', label: 'Homem com Óculos', url: `data:image/svg+xml;utf8,${encodeURIComponent(persona2Svg)}` },
    { id: 'pe3', label: 'Suporte', url: `data:image/svg+xml;utf8,${encodeURIComponent(persona3Svg)}` },
    { id: 'pe4', label: 'Executivo', url: `data:image/svg+xml;utf8,${encodeURIComponent(persona4Svg)}` }
  ],
  'Growth & Focus': [
    { id: 'gf1', label: 'Gráfico & Estrela', url: `data:image/svg+xml;utf8,${encodeURIComponent(growth1Svg)}` },
    { id: 'gf2', label: 'Lâmpada de Ideias', url: `data:image/svg+xml;utf8,${encodeURIComponent(growth2Svg)}` },
    { id: 'gf3', label: 'Montanha & Bandeira', url: `data:image/svg+xml;utf8,${encodeURIComponent(growth3Svg)}` },
    { id: 'gf4', label: 'Foco Conectado', url: `data:image/svg+xml;utf8,${encodeURIComponent(growth4Svg)}` }
  ],
  'Flow & Mindfulness': [
    { id: 'fm1', label: 'Flow M', url: `data:image/svg+xml;utf8,${encodeURIComponent(flow1Svg)}` },
    { id: 'fm2', label: 'Bússola', url: `data:image/svg+xml;utf8,${encodeURIComponent(flow2Svg)}` },
    { id: 'fm3', label: 'Gota d\'Água', url: `data:image/svg+xml;utf8,${encodeURIComponent(flow3Svg)}` },
    { id: 'fm4', label: 'Energia Central', url: `data:image/svg+xml;utf8,${encodeURIComponent(flow4Svg)}` }
  ]
};

export default function ProfileView() {
  const { 
    currentUser, 
    userProfile, 
    handleUpdateProfile, 
    handleUploadAvatar, 
    handleDeleteAvatar,
    handleSelectLibraryAvatar,
    theme,
    setTheme,
    openCustomConfirm
  } = useAppContext();

  // Estados locais do form
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [profession, setProfession] = useState('');
  const [bio, setBio] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showAvatarLibrary, setShowAvatarLibrary] = useState(false);
  const [activeAvatarTab, setActiveAvatarTab] = useState('Animais & Mascotes');

  // Sincroniza dados com o profile vindo do banco
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setNickname(userProfile.nickname || '');
      setProfession(userProfile.profession || '');
      setBio(userProfile.bio || '');
    }
  }, [userProfile]);

  useEffect(() => {
    const handleGlobalEsc = (e) => {
      if (e.key === 'Escape') {
        setShowPhotoOptions(false);
        setShowAvatarLibrary(false);
      }
    };
    window.addEventListener('keydown', handleGlobalEsc);
    return () => window.removeEventListener('keydown', handleGlobalEsc);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await handleUpdateProfile({
        name,
        nickname,
        profession,
        bio
      });
      setSuccessMsg('Perfil atualizado com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg('Erro ao atualizar perfil: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await handleUploadAvatar(file);
      setSuccessMsg('Avatar atualizado com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao carregar imagem de avatar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = () => {
    openCustomConfirm(
      'Deseja remover sua foto de perfil?',
      'Remover Foto',
      async () => {
        setErrorMsg('');
        setSuccessMsg('');
        setLoading(true);

        try {
          await handleDeleteAvatar();
          setSuccessMsg('Foto de perfil removida!');
          setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
          setErrorMsg('Erro ao remover foto.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const getInitials = () => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    return currentUser?.email?.substring(0, 2).toUpperCase() || 'US';
  };

  return (
    <div className="profile-view-container animate-fade-in" style={{ padding: '24px 0', width: '100%' }}>
      <div className="tasks-page-header" style={{ marginBottom: '32px' }}>
        <h1 className="tasks-page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={24} /> Meu Perfil
        </h1>
        <p className="tasks-page-subtitle">Configure suas informações pessoais no Flowday</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Bloco de Foto / Avatar */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          
          <div 
            style={{ position: 'relative', width: '140px', height: '140px', cursor: 'pointer' }}
            onClick={() => setShowPhotoOptions(true)}
            title="Mudar foto"
          >
            {userProfile?.avatar_url ? (
              <img 
                src={userProfile.avatar_url} 
                alt="Avatar" 
                style={{ width: '140px', height: '140px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', transition: 'opacity 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              />
            ) : (
              <DefaultAvatar size={140} />
            )}

            <div 
              style={{ position: 'absolute', bottom: '0', right: '0', backgroundColor: 'var(--primary)', color: 'white', padding: '6px', borderRadius: '50%', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Camera size={14} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>Foto de Perfil</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-light)', maxWidth: '320px' }}>
              Suporta JPG, PNG ou WEBP. Tamanho máximo de 2MB.
            </p>
            {userProfile?.avatar_url && (
              <button 
                onClick={handleDeletePhoto}
                disabled={loading}
                style={{ alignSelf: 'flex-start', marginTop: '4px', fontSize: '12px', color: '#C06C6C', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px', background: 'var(--prio-alta-bg)', border: '1px solid var(--prio-alta-border)' }}
              >
                <Trash2 size={12} /> Remover Foto
              </button>
            )}
          </div>
        </div>

        {/* Formulário de Dados */}
        <form onSubmit={handleSubmit} style={{ backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {successMsg && (
            <div style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}

          {/* Nome */}
          <div className="todo-form-group">
            <label className="todo-form-label" htmlFor="profile-name">Nome Completo</label>
            <div className="todo-date-input-wrapper">
              <User size={15} className="todo-date-icon" />
              <input
                id="profile-name"
                type="text"
                placeholder="Ex: Hana Rafaelle"
                value={name}
                onChange={e => setName(e.target.value)}
                className="todo-modal-date-input"
                style={{ paddingLeft: '38px' }}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Apelido */}
          <div className="todo-form-group">
            <label className="todo-form-label" htmlFor="profile-nickname">Como quer ser chamado (Apelido)</label>
            <div className="todo-date-input-wrapper">
              <Shield size={15} className="todo-date-icon" />
              <input
                id="profile-nickname"
                type="text"
                placeholder="Ex: Hana"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                className="todo-modal-date-input"
                style={{ paddingLeft: '38px' }}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Profissão */}
          <div className="todo-form-group">
            <label className="todo-form-label" htmlFor="profile-profession">Profissão</label>
            <div className="todo-date-input-wrapper">
              <Briefcase size={15} className="todo-date-icon" />
              <input
                id="profile-profession"
                type="text"
                placeholder="Ex: Engenheira de Software"
                value={profession}
                onChange={e => setProfession(e.target.value)}
                className="todo-modal-date-input"
                style={{ paddingLeft: '38px' }}
                disabled={loading}
              />
            </div>
          </div>

          {/* Bio */}
          <div className="todo-form-group">
            <label className="todo-form-label" htmlFor="profile-bio">Biografia (Fale um pouco sobre você)</label>
            <textarea
              id="profile-bio"
              placeholder="Ex: Buscando evoluir 1% a cada dia, focando em consistência e metas a longo prazo."
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="todo-modal-textarea"
              disabled={loading}
              style={{ minHeight: '100px' }}
            />
          </div>

          {/* Botão de Salvar */}
          <button 
            type="submit" 
            className="btn-primary-glow" 
            style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' }}
            disabled={loading}
          >
            {loading ? 'Processando...' : 'Salvar Alterações'}
          </button>
        </form>

        {/* Bloco de Aparência (Tema) */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Palette size={18} /> Aparência
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-light)', margin: 0 }}>
            Escolha o tema do aplicativo (salvo localmente).
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => setTheme('light')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm)',
                border: theme === 'light' ? '2px solid var(--primary)' : '1px solid var(--border-medium)',
                backgroundColor: theme === 'light' ? 'var(--primary-glow)' : 'var(--bg-card)',
                fontWeight: theme === 'light' ? '700' : '500',
                color: theme === 'light' ? 'var(--primary)' : 'var(--text-main)',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Sun size={14} /> Claro</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm)',
                border: theme === 'dark' ? '2px solid var(--primary)' : '1px solid var(--border-medium)',
                backgroundColor: theme === 'dark' ? 'var(--primary-glow)' : 'var(--bg-card)',
                fontWeight: theme === 'dark' ? '700' : '500',
                color: theme === 'dark' ? 'var(--primary)' : 'var(--text-main)',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Moon size={14} /> Escuro</span>
            </button>
          </div>
        </div>

      </div>

      {/* Modal de Opções de Foto */}
      {showPhotoOptions && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(9, 13, 18, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }} onClick={() => setShowPhotoOptions(false)}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '320px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            textAlign: 'center'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>Alterar Foto de Perfil</h3>
            
            <button 
              type="button"
              onClick={() => {
                setShowPhotoOptions(false);
                document.getElementById('camera-input').click();
              }}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card-hover)',
                color: 'var(--text-main)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              📷 Tirar Foto (Câmera)
            </button>
            <input 
              id="camera-input" 
              type="file" 
              accept="image/*"
              capture="user"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={loading}
            />

            <button 
              type="button"
              onClick={() => {
                setShowPhotoOptions(false);
                document.getElementById('gallery-input').click();
              }}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card-hover)',
                color: 'var(--text-main)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              🖼️ Escolher da Galeria
            </button>
            <input 
              id="gallery-input" 
              type="file" 
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={loading}
            />

            <button 
              type="button"
              onClick={() => {
                setShowPhotoOptions(false);
                setShowAvatarLibrary(true);
              }}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card-hover)',
                color: 'var(--text-main)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              👤 Escolher Avatar Pronto
            </button>

            <button 
              type="button"
              onClick={() => setShowPhotoOptions(false)}
              style={{
                marginTop: '8px',
                padding: '8px',
                border: 'none',
                background: 'none',
                color: 'var(--text-light)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal da Biblioteca de Avatares */}
      {showAvatarLibrary && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(9, 13, 18, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }} onClick={() => setShowAvatarLibrary(false)}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: '16px',
            padding: '10px 14px',
            maxWidth: '450px',
            width: '100%',
            height: 'auto',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            boxSizing: 'border-box'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Escolha um Avatar</h3>
              <button 
                type="button"
                onClick={() => setShowAvatarLibrary(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}
              >
                &times;
              </button>
            </div>

            {/* Abas */}
            <div style={{ 
              display: 'flex', 
              borderBottom: '1px solid var(--border-light)', 
              gap: '16px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'none',
              paddingBottom: '2px',
              marginTop: 0
            }}>
              {Object.keys(LIBRARY_AVATARS).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveAvatarTab(tab)}
                  style={{
                    padding: '6px 2px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeAvatarTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeAvatarTab === tab ? 'var(--primary)' : 'var(--text-light)',
                    fontWeight: activeAvatarTab === tab ? '700' : '500',
                    cursor: 'pointer',
                    fontSize: '13px',
                    flexShrink: 0
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: '12px',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '4px 0',
              marginTop: 0
            }}>
              {LIBRARY_AVATARS[activeAvatarTab].map(avatar => (
                <div 
                  key={avatar.id}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await handleSelectLibraryAvatar(avatar.url);
                      setSuccessMsg('Avatar selecionado com sucesso!');
                      setTimeout(() => setSuccessMsg(''), 3000);
                    } catch (err) {
                      setErrorMsg('Erro ao salvar avatar.');
                    } finally {
                      setLoading(false);
                      setShowAvatarLibrary(false);
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    padding: '16px 12px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-light)',
                    transition: 'all 0.2s',
                    backgroundColor: 'var(--bg-card-hover)',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <img 
                    src={avatar.url} 
                    alt={avatar.label} 
                    style={{ 
                      width: '64px', 
                      height: '64px', 
                      borderRadius: '50%', 
                      objectFit: 'contain',
                      padding: '4px',
                      backgroundColor: 'var(--bg-card)',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: '600', textAlign: 'center' }}>
                    {avatar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
