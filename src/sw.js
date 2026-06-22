import { precacheAndRoute } from 'workbox-precaching';

// Precaching files injected by workbox
precacheAndRoute(self.__WB_MANIFEST || []);

// Listen for Web Push notification
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : { title: 'MyFlowDay', body: 'Você tem uma nova atualização!' };
    
    const options = {
      body: data.body,
      icon: '/branding/icon-192.png',
      badge: '/favicon.ico',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (err) {
    console.error('[SW] Error showing push notification:', err);
  }
});

// Click notification handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const targetUrl = event.notification.data?.url || '/';
      
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
