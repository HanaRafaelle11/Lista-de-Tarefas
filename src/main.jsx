import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
