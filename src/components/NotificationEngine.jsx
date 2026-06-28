import React, { useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useNotifications } from '../hooks/useNotifications';
import { supabase } from '../supabaseClient';

export default function NotificationEngine() {
  const { tasks, goals, currentUser, addNotification, setActiveTab } = useAppContext();
  const { isSupported, isEnabled, permission, subscribeToPush } = useNotifications();

  // 1. Escutar mensagens vindas do Service Worker (Notificações em tempo real + Deep Linking)
  useEffect(() => {
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
      subscribeToPush(currentUser.id);
    }
  }, [currentUser?.id, isSupported, isEnabled, permission, subscribeToPush]);

  // 3. Sincronização automática das tarefas pendentes na fila do banco (notification_queue)
  useEffect(() => {
    if (!currentUser?.id) return;

    const syncTaskDispatches = async () => {
      const pendingTasks = tasks.filter(t => !t.completed && t.dueDate);
      
      for (const task of pendingTasks) {
        try {
          const dueTime = new Date(task.dueDate);
          // Calcular agendamento para 15 minutos antes do prazo
          const dispatchTime = new Date(dueTime.getTime() - 15 * 60 * 1000).toISOString();
          const idempotencyKey = `task_due_${task.id}_${task.dueDate}`;

          await supabase
            .from('notification_queue')
            .upsert({
              user_id: currentUser.id,
              entity_type: 'task',
              entity_id: task.id.toString(),
              title: 'Tarefa Próxima do Vencimento ⏰',
              body: `"${task.title}" vence em breve no MyFlowDay.`,
              url: '/tasks',
              scheduled_for: dispatchTime,
              status: 'pending',
              idempotency_key: idempotencyKey
            }, {
              onConflict: 'idempotency_key'
            });
        } catch (err) {
          // Ignora erros de rede temporários para não travar a UI
        }
      }
    };

    syncTaskDispatches();
  }, [tasks, currentUser?.id]);

  return null; // Componente invisível de infraestrutura
}
