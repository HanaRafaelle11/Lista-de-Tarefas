import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'notifications_enabled';

// Helper to convert base64 VAPID public key to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * useNotifications — Hook para gerenciar browser notifications (foreground) e Web Push (background)
 */
export function useNotifications() {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  const [permission, setPermission] = useState(() => {
    if (!isSupported) return 'denied';
    if (typeof window !== 'undefined' && window.location.search.includes('mock_push=true')) return 'granted';
    return Notification.permission;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('mock_push=true')) {
      try {
        Object.defineProperty(window.Notification, 'permission', { get: () => 'granted', configurable: true });
        window.Notification.requestPermission = async () => 'granted';
      } catch (_) {}
    }
  }, []);

  const [isEnabled, setIsEnabled] = useState(() => {
    if (!isSupported) return false;
    if (typeof window !== 'undefined' && window.location.search.includes('mock_push=true')) return true;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      return Notification.permission === 'granted';
    }
    return saved === 'true' && Notification.permission === 'granted';
  });

  // Sincroniza o estado se a permissão mudar externamente
  useEffect(() => {
    if (!isSupported) return;
    if (permission !== Notification.permission) {
      setTimeout(() => {
        setPermission(Notification.permission);
      }, 0);
    }
    if (Notification.permission !== 'granted') {
      setTimeout(() => {
        setIsEnabled(false);
      }, 0);
      localStorage.setItem(STORAGE_KEY, 'false');
    }

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
  }, [isSupported, permission]);

  // Helper to log diagnostics directly to the database
  const logDiagnostic = async (userId, step, status, errorMsg = null) => {
    try {
      await supabase.from('push_telemetry').insert({
        user_id: userId,
        event_type: 'diagnostic',
        status: status,
        endpoint: step,
        error: errorMsg || ''
      });
    } catch (e) {
      console.warn('[Push Diagnostic] Failed to write telemetry:', e.message);
    }
  };

  // Log initial load once per mount
  useEffect(() => {
    if (isSupported) {
      console.log('[Push Telemetry] App iniciado / Hook carregado:', new Date().toISOString());
    }
  }, [isSupported]);

  /**
   * Subscribes the current user to Web Push notifications.
   */
  const subscribeToPush = useCallback(async (userId) => {
    if (!userId) return null;

    const runRegistration = async () => {
      const startPerf = performance.now();
      const getElapsedStr = () => `[tempo_gasto: ${Math.round(performance.now() - startPerf)}ms]`;

      if (!isSupported) {
        await logDiagnostic(userId, 'check_support', 'failed', `${getElapsedStr()} Notification API not supported in window`);
        return null;
      }
      if (!('serviceWorker' in navigator)) {
        await logDiagnostic(userId, 'check_sw_in_navigator', 'failed', `${getElapsedStr()} serviceWorker not in navigator`);
        return null;
      }
      if (!('PushManager' in window)) {
        await logDiagnostic(userId, 'check_pushmanager_in_window', 'failed', `${getElapsedStr()} PushManager not in window`);
        return null;
      }

      try {
        await logDiagnostic(userId, 'subscribeToPush iniciado', 'success', `${getElapsedStr()} Starting subscription flow`);
        
        const publicVapidKey = import.meta.env.VITE_PUBLIC_VAPID_KEY;
        if (!publicVapidKey) {
          await logDiagnostic(userId, 'check_vapid_key', 'failed', `${getElapsedStr()} VITE_PUBLIC_VAPID_KEY is empty or undefined`);
          return null;
        }

        let registration;
        try {
          registration = await navigator.serviceWorker.ready;
          await logDiagnostic(userId, 'serviceWorker.ready', 'success', `${getElapsedStr()} Service worker ready`);
        } catch (e) {
          await logDiagnostic(userId, 'serviceWorker.ready', 'failed', `${getElapsedStr()} Error waiting for SW ready: ${e.message}`);
          return null;
        }

        let subscription;
        try {
          subscription = await registration.pushManager.getSubscription();
          await logDiagnostic(userId, 'getSubscription', 'success', `${getElapsedStr()} Checked subscription`);
        } catch (e) {
          await logDiagnostic(userId, 'getSubscription', 'failed', `${getElapsedStr()} Error getting subscription: ${e.message}`);
        }

        if (subscription) {
          await logDiagnostic(userId, 'subscription existente', 'success', `${getElapsedStr()} Existing subscription found`);
        } else {
          try {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });
            await logDiagnostic(userId, 'subscription criada', 'success', `${getElapsedStr()} New subscription created successfully`);
          } catch (e) {
            await logDiagnostic(userId, 'subscription criada', 'failed', `${getElapsedStr()} Error subscribing: ${e.message}`);
            return null;
          }
        }

        const subJson = subscription.toJSON();
        const p256dh = subJson.keys?.p256dh;
        const auth = subJson.keys?.auth;
        const endpoint = subJson.endpoint;

        if (!endpoint || !p256dh || !auth) {
          await logDiagnostic(userId, 'parse_subscription', 'failed', `${getElapsedStr()} Missing sub elements: endpoint=${!!endpoint}, p256dh=${!!p256dh}, auth=${!!auth}`);
          return null;
        }

        const sessionKey = `push_verified_${userId}`;
        try {
          if (sessionStorage.getItem(sessionKey) === endpoint) {
            console.log('[Push SDK Debug] Subscription already verified in this session.');
            return subscription;
          }
        } catch (_) {}

        console.log('[Push SDK Debug] Subscription found/created:', subscription);
        console.log('[Push SDK Debug] Keys:', { p256dh, auth });
        console.log('[Push SDK Debug] Endpoint:', endpoint);

        try {
          await logDiagnostic(userId, 'Edge Function chamada', 'success', `${getElapsedStr()} Invoking push Edge Function registration`);
          const { data, error } = await supabase.functions.invoke('push', {
            body: {
              user_id: userId,
              endpoint,
              keys: { p256dh, auth }
            }
          });
          
          if (error) {
            console.error('[Push SDK Debug] Edge Function error:', error);
            await logDiagnostic(userId, 'erro', 'failed', `${getElapsedStr()} Edge Function error: ${error.message || JSON.stringify(error)}`);
          } else {
            try {
              sessionStorage.setItem(sessionKey, endpoint);
            } catch (_) {}
            
            const logLabel = data?.action === 'registro criado' ? 'registro criado' : 'registro atualizado';
            console.log('[Push SDK Debug] Edge Function success response:', data);
            await logDiagnostic(userId, logLabel, 'success', `${getElapsedStr()} Registration complete: ${JSON.stringify(data)}`);
          }
        } catch (e) {
          console.error('[Push SDK Debug] Exception invoking Edge Function:', e);
          await logDiagnostic(userId, 'erro', 'failed', `${getElapsedStr()} Error invoking Edge Function: ${e.message}`);
        }

        await logDiagnostic(userId, 'tempo gasto', 'success', `Total subscription flow time: ${Math.round(performance.now() - startPerf)}ms`);
        return subscription;
      } catch (err) {
        console.error('[Push] Falha ao registrar assinatura push:', err.message);
        await logDiagnostic(userId, 'erro', 'failed', `${getElapsedStr()} General exception: ${err.message}`);
        return null;
      }
    };

    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      try {
        return await navigator.locks.request('push-registration', { mode: 'exclusive' }, async () => {
          return await runRegistration();
        });
      } catch (lockErr) {
        console.warn('[Push Lock] Failed to acquire Web Lock, running fallback:', lockErr);
        return await runRegistration();
      }
    } else {
      return await runRegistration();
    }
  }, [isSupported]);

  /**
   * Requests permission and subscribes to push notifications if granted.
   */
  const requestPermission = useCallback(async (userId) => {
    if (!isSupported) return false;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setIsEnabled(true);
        localStorage.setItem(STORAGE_KEY, 'true');
        if (userId) {
          await subscribeToPush(userId);
        }
        return true;
      }
      setIsEnabled(false);
      localStorage.setItem(STORAGE_KEY, 'false');
      return false;
    } catch (e) {
      console.error('[useNotifications] Erro ao solicitar permissão:', e);
      return false;
    }
  }, [isSupported, subscribeToPush]);

  /**
   * Disables notifications and cleans up subscriptions on the device and server.
   */
  const disableNotifications = useCallback(async (userId) => {
    setIsEnabled(false);
    localStorage.setItem(STORAGE_KEY, 'false');

    if (userId && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          console.log('[Push] Unsubscribed successfully in browser.');
        }
      } catch (err) {
        console.warn('[Push] Error during unsubscription cleanup:', err);
      }
    }
  }, []);

  const sendNotification = useCallback(async (title, options = {}) => {
    if (!isSupported || !isEnabled || Notification.permission !== 'granted') return;
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          reg.showNotification(title, {
            icon: '/icon.svg',
            badge: '/notification-badge.png',
            ...options,
          });
          return;
        }
      }
      new Notification(title, {
        icon: '/icon.svg',
        badge: '/notification-badge.png',
        ...options,
      });
    } catch (e) {
      console.error('[useNotifications] Erro ao enviar notificação:', e);
    }
  }, [isSupported, isEnabled]);

  return useMemo(() => ({
    isSupported,
    permission,
    isEnabled,
    requestPermission,
    disableNotifications,
    subscribeToPush,
    sendNotification,
    type: 'push'
  }), [isSupported, permission, isEnabled, requestPermission, disableNotifications, subscribeToPush, sendNotification]);
}
