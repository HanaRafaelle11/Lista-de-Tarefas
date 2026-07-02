import React, { useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationEngine() {
  const { currentUser, addNotification, setActiveTab } = useAppContext();
  const { isSupported, isEnabled, permission, subscribeToPush } = useNotifications();

  // 1. Escutar mensagens vindas do Service Worker (Notificações em tempo real + Deep Linking)
  useEffect(() => {
    console.log('[Push Telemetry] NotificationEngine iniciado:', new Date().toISOString());
    if (!('serviceWorker' in navigator)) return;

    const handleSWMessage = (event) => {
      if (!event.data) return;

      if (event.data.type === 'INJECT_NOTIFICATION_TO_APP') {
        const { notifType, title, description, metadata } = event.data.payload || {};
        if (title && addNotification) {
          addNotification(notifType || 'system', title, description || '', metadata || {});
        }
      }

      if (event.data.type === 'NAVIGATE_TO_ROUTE') {
        const { url } = event.data.payload || {};
        if (url && setActiveTab) {
          if (url.includes('/goals')) setActiveTab('goals');
          else if (url.includes('/tasks')) setActiveTab('tasks');
          else if (url.includes('/focus')) setActiveTab('focus');
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
  }, [addNotification, setActiveTab]);

  // 2. Garantir inscrição do dispositivo no servidor Push ao carregar
  useEffect(() => {
    if (currentUser?.id && isSupported && isEnabled && permission === 'granted') {
      console.log('[Push Telemetry] NotificationEngine triggering subscribeToPush for user:', currentUser.id);
      subscribeToPush(currentUser.id);
    }
  }, [currentUser?.id, isSupported, isEnabled, permission, subscribeToPush]);

  return null; // Componente de infraestrutura limpo sem qualquer dependência de agendamento React
}
