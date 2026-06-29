import { precacheAndRoute } from 'workbox-precaching';

// Precaching files injected by workbox
precacheAndRoute(self.__WB_MANIFEST || []);

console.log('[SW] Service Worker Event-Driven Production Grade registrado e ativo.');

// ── 1. Evento Push Nativo (Servidor VAPID / FCM / APNs → Celular Fechado) ──
self.addEventListener('push', (event) => {
  try {
    let data = {
      title: 'MyFlowDay ⚡',
      body: 'Você possui um novo compromisso agendado!',
      url: '/tasks',
      tag: `flowday_push_${Date.now()}`
    };

    if (event.data) {
      try {
        data = event.data.json();
      } catch (e) {
        data.body = event.data.text();
      }
    }

    const title = data.title || 'MyFlowDay ⚡';
    const options = {
      body: data.body || '',
      icon: '/branding/icon-192.png',
      badge: '/branding/notification-badge.png',
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      renotify: true,
      tag: data.tag || `notif_${Date.now()}`,
      actions: [
        { action: 'open', title: '👁️ Abrir' },
        { action: 'complete', title: '✅ Concluir' },
        { action: 'snooze_10', title: '⏰ Adiara 10 min' }
      ],
      data: {
        url: data.url || '/',
        entity_id: data.entity_id,
        entity_type: data.entity_type,
        event_type: data.event_type,
        notification_id: data.notification_id,
        timestamp: new Date().toISOString()
      }
    };

    event.waitUntil(
      Promise.all([
        self.registration.showNotification(title, options),
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
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
        })
      ])
    );
  } catch (err) {
    console.error('[SW] Erro ao processar evento Push nativo:', err);
  }
});

// ── 2. Clique na Notificação Nativa (Actions / Snooze / Deep Linking) ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

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
          body: 'Lombraremos você novamente em 10 minutos.',
          icon: '/branding/icon-192.png',
          badge: '/branding/notification-badge.png',
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
