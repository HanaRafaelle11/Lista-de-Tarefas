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

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '90%',
      maxWidth: '400px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ backgroundColor: 'var(--primary-light)', padding: '8px', borderRadius: '8px', color: 'var(--primary)' }}>
            <Download size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>Instalar MyFlowDay</h4>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Tenha acesso rápido e notificações.
            </p>
          </div>
        </div>
        <button onClick={handleDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '4px' }}>
          <X size={16} />
        </button>
      </div>

      {isIOS ? (
        <div style={{ fontSize: '13px', color: 'var(--text-main)', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px' }}>
          No iPhone/iPad:<br />
          1. Toque no ícone Compartilhar <br />
          2. Selecione <strong>Adicionar à Tela de Início</strong>
        </div>
      ) : (
        deferredPrompt && (
          <button 
            onClick={handleInstallClick}
            className="btn-primary-glow"
            style={{ width: '100%', padding: '10px', fontWeight: '600' }}
          >
            Instalar App
          </button>
        )
      )}
    </div>
  );
}
