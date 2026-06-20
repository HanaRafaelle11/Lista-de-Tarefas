import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

export default function NotificationCenter() {
  const {
    notifications,
    markNotificationsAsRead,
    clearNotifications,
    setActiveTab
  } = useAppContext();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      markNotificationsAsRead();
    }
  };

  const handleNotificationClick = (n) => {
    let targetTab = n.metadata?.tab || n.metadata?.actionTab;
    
    // Auto-map based on notification type if not specified or if it's invalid
    if (!targetTab || targetTab === 'evolution') {
      if (n.type === 'achievement') {
        targetTab = 'analytics';
      } else if (n.type === 'goal') {
        targetTab = 'goals';
      } else if (n.type === 'task') {
        targetTab = 'tasks';
      } else if (n.type === 'system') {
        targetTab = 'home';
      }
    }
    
    if (targetTab) {
      // Normalize 'evolution' to 'analytics'
      if (targetTab === 'evolution') targetTab = 'analytics';
      
      setActiveTab(targetTab);
      setIsOpen(false);
    }
  };

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      
      if (diffMins < 1) return 'Agora mesmo';
      if (diffMins < 60) return `Há ${diffMins} min`;
      if (diffHours < 24) return `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
      
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Ontem';
      return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'achievement': return '🏆';
      case 'goal': return '🎯';
      case 'task': return '📋';
      case 'system': return '🔔';
      default: return '🔔';
    }
  };

  return (
    <div className="notification-container" ref={containerRef}>
      <button
        onClick={handleToggle}
        className="header-btn"
        title="Notificações"
        aria-label="Ver notificações"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notificações</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              {unreadCount > 0 && (
                <button 
                  onClick={markNotificationsAsRead}
                  className="notification-clear-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Check size={12} /> Marcar lidas
                </button>
              )}
              {notifications.length > 0 && (
                <button 
                  onClick={clearNotifications}
                  className="notification-clear-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-light)' }}
                >
                  <Trash2 size={12} /> Limpar
                </button>
              )}
            </div>
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                Nenhuma notificação por enquanto.
              </div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`notification-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="notification-item-title">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{getNotificationIcon(n.type)}</span>
                      <span>{n.title}</span>
                    </span>
                    <span className="notification-item-time">
                      {formatTime(n.timestamp)}
                    </span>
                  </div>
                  {n.description && (
                    <div className="notification-item-desc" style={{ marginTop: '2px' }}>
                      {n.description}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
