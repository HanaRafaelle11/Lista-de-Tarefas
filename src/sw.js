import { precacheAndRoute } from 'workbox-precaching';

// Precaching files injected by workbox
precacheAndRoute(self.__WB_MANIFEST || []);

// Armazenamento em memória do SW para agendamentos em segundo plano
let scheduledTasks = [];
const notifiedTaskIds = new Set();

// Escutar sincronização de tarefas enviadas do app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_TASKS_FOR_NOTIFICATIONS') {
    scheduledTasks = event.data.payload?.tasks || [];
    console.log('[SW] Tarefas sincronizadas para notificações em segundo plano:', scheduledTasks.length);
  }
});

// Verificação periódica no Service Worker (roda em segundo plano mesmo com app fechado)
setInterval(() => {
  if (!scheduledTasks.length) return;
  const now = new Date();

  scheduledTasks.forEach(task => {
    if (!task.dueDate) return;
    const dueTime = new Date(task.dueDate);
    const timeDiffMs = dueTime.getTime() - now.getTime();
    const timeDiffMinutes = timeDiffMs / (1000 * 60);

    // Se vence em 15 min ou menos e ainda não notificado
    if (timeDiffMinutes > 0 && timeDiffMinutes <= 15) {
      const notifId = `sw_task_due_${task.id}`;
      if (!notifiedTaskIds.has(notifId)) {
        notifiedTaskIds.add(notifId);
        self.registration.showNotification('Tarefa Próxima do Vencimento ⏰', {
          body: `"${task.title}" vence em breve no MyFlowDay.`,
          icon: '/branding/icon-192.png',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          data: { url: '/tasks' }
        });
      }
    }
  });
}, 60000);

// Escutar Web Push notification (Servidor VAPID → SO do usuário)
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : { title: 'MyFlowDay ⚡', body: 'Você tem uma nova atualização!' };
    
    const options = {
      body: data.body,
      icon: '/branding/icon-192.png',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      requireInteraction: true,
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

// Click notification handler (abre ou foca o app)
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
