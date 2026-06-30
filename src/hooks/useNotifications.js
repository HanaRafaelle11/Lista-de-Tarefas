import { useState, useEffect, useCallback } from 'react';
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

  const [permission, setPermission] = useState(
    isSupported ? Notification.permission : 'denied'
  );

  const [isEnabled, setIsEnabled] = useState(() => {
    if (!isSupported) return false;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      return Notification.permission === 'granted';
    }
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

  /**
   * Subscribes the current user to Web Push notifications.
   */
  const subscribeToPush = useCallback(async (userId) => {
    if (!isSupported || !('serviceWorker' in navigator) || !('PushManager' in window) || !userId) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const publicVapidKey = import.meta.env.VITE_PUBLIC_VAPID_KEY;
      if (!publicVapidKey) return null;

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });
      }

      const subJson = subscription.toJSON();
      const p256dh = subJson.keys?.p256dh;
      const auth = subJson.keys?.auth;
      const endpoint = subJson.endpoint;

      if (endpoint && p256dh && auth) {
        await supabase.functions.invoke('push', {
          body: {
            user_id: userId,
            endpoint,
            keys: {
              p256dh,
              auth
            }
          }
        });
      }

      return subscription;
    } catch (err) {
      console.error('[Push] Falha ao registrar assinatura push:', err.message);
      return null;
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
            icon: '/branding/icon-192.png',
            badge: '/branding/notification-badge.png',
            ...options,
          });
          return;
        }
      }
      new Notification(title, {
        icon: '/branding/icon-192.png',
        badge: '/branding/notification-badge.png',
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
    subscribeToPush,
    sendNotification,
    type: 'push'
  };
}
