import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationEngine() {
  const { tasks, goals, currentUser, isPro, hiddenTasksCount, hiddenGoalsCount, userState, addNotification } = useAppContext();
  const { isSupported, isEnabled, permission, sendNotification } = useNotifications();
  const notifiedSet = useRef(new Set());

  // Listen for Service Worker background notifications to sync with internal bell icon
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleSWMessage = (event) => {
      if (event.data && event.data.type === 'INJECT_NOTIFICATION_TO_APP') {
        const { notifType, title, description, metadata } = event.data.payload || {};
        if (title && addNotification) {
          addNotification(notifType || 'system', title, description || '', metadata || {});
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
  }, [addNotification]);

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
            const title = 'Tarefa Próxima do Vencimento ⏰';
            const body = `"${task.title}" vence em breve.`;
            sendNotification(title, {
              body,
              icon: '/branding/icon-192.png',
              badge: '/branding/notification-badge.png',
              tag: notifId
            });
            if (addNotification) {
              addNotification('task', title, body, { actionTab: 'tasks' });
            }
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

      // 4. Growth Engine: Notificação de limite de histórico (3 em 3 dias)
      if (!isPro && (hiddenTasksCount > 0 || hiddenGoalsCount > 0)) {
        const lastSentKey = 'flowday_notif_last_history_limit';
        const lastSent = localStorage.getItem(lastSentKey);
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        if (!lastSent || (now.getTime() - parseInt(lastSent, 10)) >= threeDaysMs) {
          sendNotification('Histórico Oculto (Plano Free)', {
            body: `Você possui itens antigos que estão ocultados. Desbloqueie o histórico completo com o Flowday Pro!`,
            icon: '/icon-192x192.png',
            tag: 'history_limit_warning'
          });
          localStorage.setItem(lastSentKey, now.getTime().toString());
        }
      }

      // 5. Growth Engine: Notificação de reengajamento para at_risk / churned (3 em 3 dias)
      if (userState && (userState.stage === 'at_risk' || userState.stage === 'churned')) {
        const lastSentKey = 'flowday_notif_last_reengagement';
        const lastSent = localStorage.getItem(lastSentKey);
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        if (!lastSent || (now.getTime() - parseInt(lastSent, 10)) >= threeDaysMs) {
          sendNotification('Dê um Flow no seu dia! ⚡', {
            body: 'Que tal planejar um passo simples para hoje? Dê um Flow no seu dia! ⚡',
            icon: '/icon-192x192.png',
            tag: 'reengagement_warning'
          });
          localStorage.setItem(lastSentKey, now.getTime().toString());
        }
      }

      // 6. Growth Engine: Trial Upsell Lembrete Semanal
      if (!isPro) {
        const lastSentKey = 'flowday_notif_last_trial_upsell';
        const lastSent = localStorage.getItem(lastSentKey);
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (!lastSent || (now.getTime() - parseInt(lastSent, 10)) >= sevenDaysMs) {
          sendNotification('Experimente o Flowday Pro Grátis', {
            body: 'Inicie seu teste gratuito de 7 dias do plano Pro e desbloqueie análises e o Coach!',
            icon: '/icon-192x192.png',
            tag: 'trial_upsell'
          });
          localStorage.setItem(lastSentKey, now.getTime().toString());
        }
      }
    };

    // Run immediately, then every minute
    checkNotifications();
    const intervalId = setInterval(checkNotifications, 60000);

    return () => clearInterval(intervalId);
  }, [tasks, goals, isSupported, isEnabled, permission, currentUser, sendNotification, isPro, hiddenTasksCount, hiddenGoalsCount, userState]);

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
