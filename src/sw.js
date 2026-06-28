import { precacheAndRoute } from 'workbox-precaching';

// Precaching files injected by workbox
precacheAndRoute(self.__WB_MANIFEST || []);

console.log('[SW] Service Worker Production Grade registrado e ativo.');

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
      vibrate: [200, 100, 200],
      requireInteraction: true,
      renotify: true,
      tag: data.tag || `notif_${Date.now()}`,
      data: {
        url: data.url || '/',
        entity_id: data.entity_id,
        entity_type: data.entity_type,
        timestamp: data.timestamp || new Date().toISOString()
      }
    };

    event.waitUntil(
      Promise.all([
        // Exibe a notificação na tela de bloqueio do sistema operacional
        self.registration.showNotification(title, options),
        
        // Transmite para janelas abertas para atualizar o sininho interno em tempo real
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'INJECT_NOTIFICATION_TO_APP',
              payload: {
                notifType: data.entity_type || 'system',
                title: title,
                description: data.body || '',
                metadata: { actionTab: data.entity_type === 'goal' ? 'goals' : 'tasks', url: data.url }
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

// ── 2. Clique na Notificação Nativa (Deep Linking Exato) ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já houver uma aba aberta com o app, foca nela e navega
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          client.postMessage({
            type: 'NAVIGATE_TO_ROUTE',
            payload: { url: targetUrl }
          });
          return client.focus();
        }
      }
      
      // Se o app estiver completamente fechado, abre uma nova janela na rota exata
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
