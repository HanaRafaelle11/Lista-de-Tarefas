// Intercepta e ignora cache se a requisição tiver clear=true ou reload=true
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.searchParams.has('clear') || url.searchParams.has('reload')) {
    event.respondWith(fetch(event.request));
  }
});

import { precacheAndRoute } from 'workbox-precaching';

// Precaching files injected by workbox
precacheAndRoute(self.__WB_MANIFEST || []);

console.log('[SW] Service Worker Event-Driven Production Grade registrado e ativo.');

// Força ativação imediata do novo Service Worker sem esperar sessões antigas fecharem
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── 1. Evento Push Nativo (Servidor VAPID / FCM / APNs → Celular Fechado) ──
self.addEventListener('push', (event) => {
  console.log('[SW Debug] Push event received!', event);
  try {
    let data = {
      title: 'MyFlowDay',
      body: 'Você possui um novo compromisso agendado!',
      url: '/tasks',
      tag: `flowday_push_${Date.now()}`
    };

    if (event.data) {
      console.log('[SW Debug] Event data payload exists. Text:', event.data.text());
      try {
        data = event.data.json();
        console.log('[SW Debug] Parsed JSON payload:', data);
      } catch (e) {
        console.warn('[SW Debug] Failed to parse payload as JSON. Using text.', e.message);
        data.body = event.data.text();
      }
    } else {
      console.warn('[SW Debug] Push event received but NO data payload exists!');
    }

    const title = data.title || 'MyFlowDay';
    const options = {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/notification-badge.png',
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      renotify: true,
      silent: false,
      tag: data.tag || `notif_${Date.now()}`,
      actions: [
        { action: 'open', title: 'Abrir' },
        { action: 'complete', title: 'Concluir' },
        { action: 'snooze_10', title: 'Adiar 10 min' }
      ],
      data: {
        url: data.url || '/',
        entity_id: data.entity_id,
        entity_type: data.entity_type,
        event_type: data.event_type,
        notification_id: data.notification_id,
        user_id: data.user_id || null,
        timestamp: new Date().toISOString()
      }
    };

    // EXECUÇÃO ISOLADA: Mostra a notificação primeiro (Garante a exibição visual)
    console.log('[SW Debug] Calling showNotification with:', { title, options });
    event.waitUntil(
      self.registration.showNotification(title, options)
        .then(() => {
          console.log('[SW Debug] showNotification completed successfully!');
          // Tenta rodar as telemetrias secundárias sem travar a renderização do push
          return self.registration.pushManager.getSubscription().then(sub => {
            if (sub) {
              const payloadData = JSON.stringify({
                event_type: 'received',
                endpoint: sub.endpoint,
                user_id: data.user_id || null
              });

              return fetch('https://mftsklhrzhhvtsuamqaw.supabase.co/functions/v1/push-telemetry', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payloadData
              })
              .then(res => {
                if (!res.ok) throw new Error('Supabase returned ' + res.status);
                return res;
              })
              .catch(() => {
                // Fallback para API Vercel
                return fetch('/api/push-telemetry', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: payloadData
                });
              })
              .catch(err => console.warn('[SW] Telemetry ignore:', err));
            }
          });
        })
        .then(() => {
          console.log('[SW Debug] Injecting notification to active clients...');
          return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'INJECT_NOTIFICATION_TO_APP',
                payload: {
                  notifType: data.entity_type || 'system',
                  title: title,
                  description: data.body || '',
                  metadata: { actionTab: data.entity_type === 'goal' ? 'goals' : data.entity_type === 'focus' ? 'focus' : 'tasks', url: data.url }
                }
              });
            });
          });
        })
        .catch(err => console.error('[SW Debug] showNotification or telemetry failed:', err))
    );
  } catch (err) {
    console.error('[SW Debug] Critical push processing error:', err);
  }
});

// ── 2. Clique na Notificação Nativa (Actions / Snooze / Deep Linking) ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';
  console.log('[SW Debug] Notification clicked! Action:', action, 'Data:', notificationData, 'TargetUrl:', targetUrl);

  // Registrar telemetria de clique (clicked)
  event.waitUntil(
    self.registration.pushManager.getSubscription().then(sub => {
      if (sub) {
        const payloadData = JSON.stringify({
          event_type: 'clicked',
          endpoint: sub.endpoint,
          user_id: notificationData.user_id || null
        });

        return fetch('https://mftsklhrzhhvtsuamqaw.supabase.co/functions/v1/push-telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadData
        })
        .then(res => {
          if (!res.ok) throw new Error('Supabase returned ' + res.status);
          return res;
        })
        .catch(() => {
          // Fallback para API Vercel
          return fetch('/api/push-telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payloadData
          });
        })
        .catch(err => console.warn('[SW] Telemetry clicked log error:', err));
      }
    })
  );

  // Trata Ação de Snooze (Adiar por 10 minutos)
  if (action === 'snooze_10') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        windowClients.forEach(client => {
          client.postMessage({
            type: 'SNOOZE_NOTIFICATION',
            payload: {
              notification_id: notificationData.notification_id,
              entity_id: notificationData.entity_id,
              entity_type: notificationData.entity_type,
              snoozeMinutes: 10
            }
          });
        });
        
        return self.registration.showNotification('⏰ Notificação Adiada', {
          body: 'Lembraremos você novamente em 10 minutos.',
          icon: '/icon.svg',
          badge: '/favicon.svg',
          tag: `snooze_confirm_${Date.now()}`
        });
      })
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          client.postMessage({
            type: 'NAVIGATE_TO_ROUTE',
            payload: { url: targetUrl, action: action, entity_id: notificationData.entity_id }
          });
          return client.focus();
        }
      }
      
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});