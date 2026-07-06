import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Drag and drop polyfill for mobile
import { polyfill } from "mobile-drag-drop";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";
import "mobile-drag-drop/default.css";

polyfill({
    dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
    holdToDrag: 250 // Permite scroll se o usuário apenas arrastar rápido; inicia o drag se ele segurar por 250ms
});

// Safari issue fix for drag and drop polyfill
window.addEventListener('touchmove', function() {}, {passive: false});

// Habilita o modo de segurança Beta globalmente
window.BETA_SAFE_MODE = true;

// Aplica o tema salvo ANTES do React renderizar (evita flash do tema errado)
;(function() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark) || (saved === 'system' && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();

// Register custom PWA service worker with scope /
if (import.meta.env.DEV) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister().then((unreg) => {
          if (unreg) {
            console.log('[PWA] Unregistered stale service worker in development');
            window.location.reload();
          }
        });
      }
    });
  }
} else {
  if ('serviceWorker' in navigator && !import.meta.env.SSR) {
    window.addEventListener('load', () => {
      const swUrl = '/sw.js';
      navigator.serviceWorker.register(swUrl)
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.error('[PWA] Service Worker registration failed:', err);
        });
    });
  }
}

createRoot(document.getElementById('root')).render(
  <App />
)
