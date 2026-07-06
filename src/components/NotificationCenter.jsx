import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Bell, Check, Trash2, Search, Filter } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import MFIcon from './MFIcon';

export default function NotificationCenter({ placement }) {
  const {
    notifications,
    markNotificationsAsRead,
    clearNotifications,
    setActiveTab
  } = useAppContext();

  const [isOpen, setIsOpen] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event) {
      const dropdownEl = document.getElementById('notification-portal-dropdown');
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        (!dropdownEl || !dropdownEl.contains(event.target))
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      if (placement === 'bottom-left') {
        const dropdownHeight = 360; 
        const top = Math.max(10, rect.top - dropdownHeight - 8);
        const left = Math.max(10, Math.min(window.innerWidth - 330, rect.left));
        setCoords({ top, left });
      } else {
        const top = rect.bottom + 8;
        const left = Math.max(10, Math.min(window.innerWidth - 330, rect.right - 320));
        setCoords({ top, left });
      }
    }
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      markNotificationsAsRead();
    }
  };

  const handleNotificationClick = (n) => {
    let targetTab = n.metadata?.tab || n.metadata?.actionTab;
    
    if (!targetTab || targetTab === 'evolution') {
      if (n.type === 'achievement') {
        targetTab = 'analytics';
      } else if (n.type === 'goal') {
        targetTab = 'goals';
      } else if (n.type === 'task') {
        targetTab = 'tasks';
      } else if (n.type === 'focus' || n.type === 'pomodoro') {
        targetTab = 'focus';
      } else if (n.type === 'system') {
        targetTab = 'home';
      }
    }
    
    if (targetTab) {
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
      case 'achievement': return <MFIcon name="trophy" size={14} color="#eab308" />;
      case 'goal': return <MFIcon name="target" size={14} color="var(--primary)" />;
      case 'habit': return <MFIcon name="sprout" size={14} color="#10b981" />;
      case 'task': return <MFIcon name="check" size={14} color="var(--primary)" />;
      case 'focus': case 'pomodoro': return <MFIcon name="bolt" size={14} color="var(--primary)" />;
      case 'system': case 'billing': return <MFIcon name="bell" size={14} color="var(--primary)" />;
      default: return <MFIcon name="bell" size={14} color="var(--text-light)" />;
    }
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesFilter = filterType === 'all' || n.type === filterType;
    const matchesSearch = !searchQuery.trim() || 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (n.description && n.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="notification-container" ref={containerRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px' }}>
      <button
        ref={buttonRef}
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

      {isOpen && ReactDOM.createPortal(
        <div 
          className="notification-dropdown animate-scale-up" 
          id="notification-portal-dropdown"
          style={{ 
            width: '320px', 
            padding: '16px',
            position: 'fixed',
            zIndex: 11000,
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div className="notification-header" style={{ marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>Centro de Notificações</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {unreadCount > 0 && (
                <button 
                  onClick={markNotificationsAsRead}
                  className="notification-clear-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                >
                  <Check size={12} /> Marcar lidas
                </button>
              )}
              {notifications.length > 0 && (
                <button 
                  onClick={clearNotifications}
                  className="notification-clear-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-light)', fontSize: '11px' }}
                >
                  <Trash2 size={12} /> Limpar
                </button>
              )}
            </div>
          </div>

          {/* Busca e Filtros */}
          <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar notificações..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px 6px 30px', fontSize: '12px',
                  borderRadius: '6px', border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-app)', color: 'var(--text-main)'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
              {[
                { key: 'all', label: 'Todas' },
                { key: 'task', label: 'Tarefas' },
                { key: 'goal', label: 'Metas' },
                { key: 'habit', label: 'Hábitos' },
                { key: 'focus', label: 'Foco' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  style={{
                    padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: 'none',
                    backgroundColor: filterType === f.key ? 'var(--primary)' : 'var(--bg-app)',
                    color: filterType === f.key ? 'white' : 'var(--text-muted)',
                    cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="notification-list" style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {filteredNotifications.length === 0 ? (
              <div className="notification-empty" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Nenhuma notificação localizada.
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`notification-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                  style={{ cursor: 'pointer', padding: '10px', borderBottom: '1px solid var(--border-light)' }}
                >
                  <div className="notification-item-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', fontWeight: '600' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{getNotificationIcon(n.type)}</span>
                      <span style={{ color: 'var(--text-main)' }}>{n.title}</span>
                    </span>
                    <span className="notification-item-time" style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      {formatTime(n.timestamp)}
                    </span>
                  </div>
                  {n.description && (
                    <div className="notification-item-desc" style={{ marginTop: '4px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      {(() => {
                        const raw = n.description;
                        let cleaned = raw.split('--flowday-meta--')[0].trim();
                        cleaned = cleaned.replace(/\{[\s\S]*?"due_time"[\s\S]*?\}/g, '').trim();
                        cleaned = cleaned.replace(/[\n\r]+$/g, '').trim();
                        return cleaned || ' Compromisso agendado';
                      })()}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
