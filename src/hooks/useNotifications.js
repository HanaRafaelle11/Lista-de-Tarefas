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
  if (typeof window !== 'undefined' && window.location.search.includes('mock_push=true')) {
    try {
      Object.defineProperty(window.Notification, 'permission', { get: () => 'granted', configurable: true });
      window.Notification.requestPermission = async () => 'granted';
    } catch (_) {}
  }

  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  const [permission, setPermission] = useState(
    isSupported ? Notification.permission : 'denied'
  );

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

  /**
   * Subscribes the current user to Web Push notifications.
   */
  const subscribeToPush = useCallback(async (userId) => {
    if (!userId) return null;

    if (!isSupported) {
      await logDiagnostic(userId, 'check_support', 'failed', 'Notification API not supported in window');
      return null;
    }
    if (!('serviceWorker' in navigator)) {
      await logDiagnostic(userId, 'check_sw_in_navigator', 'failed', 'serviceWorker not in navigator');
      return null;
    }
    if (!('PushManager' in window)) {
      await logDiagnostic(userId, 'check_pushmanager_in_window', 'failed', 'PushManager not in window');
      return null;
    }

    try {
      await logDiagnostic(userId, 'start_subscription', 'success', 'Starting subscription flow');
      
      const publicVapidKey = import.meta.env.VITE_PUBLIC_VAPID_KEY;
      if (!publicVapidKey) {
        await logDiagnostic(userId, 'check_vapid_key', 'failed', 'VITE_PUBLIC_VAPID_KEY is empty or undefined');
        return null;
      }

      let registration;
      try {
        registration = await navigator.serviceWorker.ready;
        await logDiagnostic(userId, 'sw_ready', 'success', `SW registered: ${registration ? 'yes' : 'no'}`);
      } catch (e) {
        await logDiagnostic(userId, 'sw_ready', 'failed', `Error waiting for SW ready: ${e.message}`);
        return null;
      }

      let subscription;
      try {
        subscription = await registration.pushManager.getSubscription();
        await logDiagnostic(userId, 'get_subscription', 'success', `Existing subscription: ${subscription ? 'yes' : 'no'}`);
      } catch (e) {
        await logDiagnostic(userId, 'get_subscription', 'failed', `Error getting subscription: ${e.message}`);
      }

      if (!subscription) {
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
          });
          await logDiagnostic(userId, 'subscribe_new', 'success', 'New subscription created successfully');
        } catch (e) {
          await logDiagnostic(userId, 'subscribe_new', 'failed', `Error subscribing: ${e.message}`);
          return null;
        }
      }

      const subJson = subscription.toJSON();
      const p256dh = subJson.keys?.p256dh;
      const auth = subJson.keys?.auth;
      const endpoint = subJson.endpoint;

      if (!endpoint || !p256dh || !auth) {
        await logDiagnostic(userId, 'parse_subscription', 'failed', `Missing sub elements: endpoint=${!!endpoint}, p256dh=${!!p256dh}, auth=${!!auth}`);
        return null;
      }

      console.log('[Push SDK Debug] Subscription found/created:', subscription);
      console.log('[Push SDK Debug] Keys:', { p256dh, auth });
      console.log('[Push SDK Debug] Endpoint:', endpoint);

      try {
        console.log('[Push SDK Debug] Invoking push Edge Function registration...');
        const { data, error } = await supabase.functions.invoke('push', {
          body: {
            user_id: userId,
            endpoint,
            keys: { p256dh, auth }
          }
        });
        if (error) {
          console.error('[Push SDK Debug] Edge Function error:', error);
          await logDiagnostic(userId, 'invoke_edge_function', 'failed', `Edge Function error: ${error.message || JSON.stringify(error)}`);
        } else {
          console.log('[Push SDK Debug] Edge Function success response:', data);
          await logDiagnostic(userId, 'invoke_edge_function', 'success', `Response: ${JSON.stringify(data)}`);
        }
      } catch (e) {
        console.error('[Push SDK Debug] Exception invoking Edge Function:', e);
        await logDiagnostic(userId, 'invoke_edge_function', 'failed', `Error invoking Edge Function: ${e.message}`);
      }

      return subscription;
    } catch (err) {
      console.error('[Push] Falha ao registrar assinatura push:', err.message);
      await logDiagnostic(userId, 'subscription_exception', 'failed', err.message);
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
