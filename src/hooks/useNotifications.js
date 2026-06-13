import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'notifications_enabled';

/**
 * useNotifications — Hook para gerenciar browser notifications (foreground) opt-in
 * 
 * Usa a Notification API nativa do browser.
 * Persiste a preferência do usuário no localStorage.
 * 
 * Retorna:
 *   isSupported   — boolean: browser suporta Notification API
 *   permission    — 'default' | 'granted' | 'denied'
 *   isEnabled     — boolean: usuário ativou notificações
 *   requestPermission — async fn: solicita permissão e ativa
 *   disableNotifications — fn: desativa (sem revogar permissão do browser)
 *   sendNotification — fn(title, options): envia uma notificação
 *   type          - 'foreground'
 */
export function useNotifications() {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  const [permission, setPermission] = useState(
    isSupported ? Notification.permission : 'denied'
  );

  const [isEnabled, setIsEnabled] = useState(() => {
    if (!isSupported) return false;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'true' && Notification.permission === 'granted';
  });

  // Sincroniza o estado se a permissão mudar externamente
  useEffect(() => {
    if (!isSupported) return;
    setPermission(Notification.permission);
    if (Notification.permission !== 'granted') {
      setIsEnabled(false);
      localStorage.setItem(STORAGE_KEY, 'false');
    }

    // M2 — Detecta revogação de permissão em tempo real (browsers modernos)
    let permissionStatus = null;
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'notifications' }).then((status) => {
        permissionStatus = status;
        status.onchange = () => {
          setPermission(status.state === 'granted' ? 'granted' : status.state === 'denied' ? 'denied' : 'default');
          if (status.state !== 'granted') {
            setIsEnabled(false);
            localStorage.setItem(STORAGE_KEY, 'false');
          }
        };
      }).catch(() => {
        // Permissions API não suportada — fallback silencioso
      });
    }

    return () => {
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [isSupported]);


  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setIsEnabled(true);
        localStorage.setItem(STORAGE_KEY, 'true');
        return true;
      }
      setIsEnabled(false);
      localStorage.setItem(STORAGE_KEY, 'false');
      return false;
    } catch (e) {
      console.error('[useNotifications] Erro ao solicitar permissão:', e);
      return false;
    }
  }, [isSupported]);

  const disableNotifications = useCallback(() => {
    setIsEnabled(false);
    localStorage.setItem(STORAGE_KEY, 'false');
  }, []);

  const sendNotification = useCallback((title, options = {}) => {
    if (!isSupported || !isEnabled || Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        icon: '/favicon.svg',
        badge: '/icon.svg',
        ...options,
      });
    } catch (e) {
      console.error('[useNotifications] Erro ao enviar notificação:', e);
    }
  }, [isSupported, isEnabled]);

  return {
    isSupported,
    permission,
    isEnabled,
    requestPermission,
    disableNotifications,
    sendNotification,
    type: 'foreground',
  };
}

