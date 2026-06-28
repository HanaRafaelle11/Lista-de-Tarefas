import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isAppStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsStandalone(isAppStandalone);

    if (isAppStandalone) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice && !localStorage.getItem('pwa_prompt_dismissed')) {
      // Small delay before showing iOS prompt
      setTimeout(() => setShowPrompt(true), 2000);
    }

    // Android/Chrome beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!localStorage.getItem('pwa_prompt_dismissed')) {
        setShowPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa_installed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="pwa-install-prompt animate-fade-in" style={{
      position: 'fixed',
      bottom: 'calc(96px + env(safe-area-inset-bottom))',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '92%',
      maxWidth: '420px',
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--primary-light)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: 'var(--primary-light)', padding: '10px', borderRadius: '10px', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Download size={22} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>Instalar MyFlowDay</h4>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Instale o MyFlowDay na sua tela inicial para acessar offline e receber notificações mais rápido.
            </p>
          </div>
        </div>
        <button onClick={handleDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '4px' }}>
          <X size={18} />
        </button>
      </div>

      {isIOS ? (
        <div style={{ fontSize: '13px', color: 'var(--text-main)', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', lineHeight: '1.5' }}>
          No iPhone/iPad:<br />
          1. Toque no ícone Compartilhar 📤<br />
          2. Selecione <strong>Adicionar à Tela de Início ➕</strong>
        </div>
      ) : (
        deferredPrompt && (
          <button 
            onClick={handleInstallClick}
            className="btn-primary-glow"
            style={{ width: '100%', padding: '10px', fontWeight: '600', cursor: 'pointer' }}
          >
            Instalar App Na Tela Inicial 🚀
          </button>
        )
      )}
    </div>
  );
}
