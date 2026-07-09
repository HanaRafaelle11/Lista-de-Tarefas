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

// Interceptador para limpar cache via URL (bypass de PWA para desenvolvimento/testes rápidos)
if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('clear') || urlParams.has('reload')) {
    (async () => {
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(name => caches.delete(name)));
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (let reg of registrations) {
            await reg.unregister();
          }
        }
        // Limpa localStorage do flowday (preserva tokens Supabase)
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !key.startsWith('sb-') && !key.includes('supabase')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('[PWA] Cache limpo via URL parameter.');
      } catch (e) {
        console.warn('Erro ao limpar cache:', e);
      } finally {
        // Redireciona para URL limpa para evitar loops
        window.location.href = window.location.pathname;
      }
    })();
  }
}

// Aplica o tema salvo ANTES do React renderizar (evita flash do tema errado)
;(function() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark) || (saved === 'system' && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();

// Register custom PWA service worker with scope /
if ('serviceWorker' in navigator && !import.meta.env.SSR) {
  window.addEventListener('load', () => {
    const swUrl = '/sw.js';
    navigator.serviceWorker.register(swUrl, { type: import.meta.env.DEV ? 'module' : 'classic' })
      .then((reg) => {
        console.log('[PWA] Service Worker registered with scope:', reg.scope);
        
        // Força verificação imediata de atualizações no carregamento da página
        reg.update();

        // Monitora atualizações e recarrega a página ao concluir o update
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[PWA] Novo conteúdo disponível. Atualizando aplicação...');
                  window.location.reload();
                }
              }
            };
          }
        };
      })
      .catch((err) => {
        console.error('[PWA] Service Worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <App />
)
