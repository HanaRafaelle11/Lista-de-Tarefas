import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationEngine() {
  const { tasks, goals, currentUser } = useAppContext();
  const { isSupported, isEnabled, permission, sendNotification } = useNotifications();
  const notifiedSet = useRef(new Set());

  useEffect(() => {
    // Only run if notifications are enabled and permission is granted
    if (!isSupported || !isEnabled || permission !== 'granted' || !currentUser) {
      return;
    }

    const checkNotifications = () => {
      const now = new Date();
      
      // 1. Task Due Notifications
      const pendingTasks = tasks.filter(t => !t.completed && t.dueDate);
      pendingTasks.forEach(task => {
        const dueTime = new Date(task.dueDate);
        const timeDiffMs = dueTime.getTime() - now.getTime();
        const timeDiffMinutes = timeDiffMs / (1000 * 60);

        // Se a tarefa vence em 10 minutos ou menos, e ainda não foi notificada
        if (timeDiffMinutes > 0 && timeDiffMinutes <= 15) {
          const notifId = `task_due_${task.id}`;
          if (!notifiedSet.current.has(notifId)) {
            sendNotification('Tarefa Próxima do Vencimento', {
              body: `"${task.title}" vence em breve.`,
              icon: '/icon-192x192.png',
              tag: notifId
            });
            notifiedSet.current.add(notifId);
          }
        }
      });

      // 2. Goal Stagnation Notifications
      const activeGoals = goals.filter(g => g.status === 'active');
      activeGoals.forEach(goal => {
        const lastUpdated = goal.updated_at ? new Date(goal.updated_at) : new Date(goal.created_at);
        const daysSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
        
        // Se o objetivo não foi atualizado há mais de 3 dias
        if (daysSinceUpdate >= 3) {
          const notifId = `goal_stagnant_${goal.id}_${now.toDateString()}`;
          if (!notifiedSet.current.has(notifId)) {
             sendNotification('Objetivo sem progresso recente', {
               body: `Seu objetivo "${goal.title}" precisa de atenção.`,
               icon: '/icon-192x192.png',
               tag: notifId
             });
             notifiedSet.current.add(notifId);
          }
        }
      });

      // 3. Weekly Review Reminder (Sunday at 18:00)
      if (now.getDay() === 0 && now.getHours() === 18 && now.getMinutes() < 15) {
        const notifId = `weekly_review_${now.toDateString()}`;
        if (!notifiedSet.current.has(notifId)) {
           sendNotification('Revisão Semanal', {
             body: 'É hora de planejar sua próxima semana e revisar seu progresso!',
             icon: '/icon-192x192.png',
             tag: notifId
           });
           notifiedSet.current.add(notifId);
        }
      }
    };

    // Run immediately, then every minute
    checkNotifications();
    const intervalId = setInterval(checkNotifications, 60000);

    return () => clearInterval(intervalId);
  }, [tasks, goals, isSupported, isEnabled, permission, currentUser, sendNotification]);

  // Se houver suporte a Service Worker, podemos tentar delegar agendamentos aqui também.
  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Opcional: enviar a lista de tarefas para o SW, 
      // caso o usuário feche o app, o SW possa usar push api se houvesse backend.
      navigator.serviceWorker.controller.postMessage({
        type: 'SYNC_TASKS_FOR_NOTIFICATIONS',
        payload: {
           tasks: tasks.filter(t => !t.completed && t.dueDate)
        }
      });
    }
  }, [tasks]);

  return null; // Invisible component
}
