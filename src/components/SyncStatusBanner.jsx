import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { getStatus } from '../services/syncQueue';

/**
 * SyncStatusBanner — Banner de status granular de sincronização.
 *
 * 🟢 healthy  → invisível
 * 🟡 degraded → amarelo com contador de ops pendentes
 * 🔴 offline  → escuro com mensagem de modo offline
 *
 * Nunca bloqueia a UX. Dispensável pelo usuário.
 * Auto-desaparece quando volta para 'healthy'.
 */
export default function SyncStatusBanner() {
  const { syncStatus } = useAppContext();
  const [dismissed, setDismissed]     = useState(false);
  const [detail, setDetail]           = useState({ pendingOps: 0, lastSync: null, warnings: [] });
  const [visible, setVisible]         = useState(false);

  // Sincroniza com o estado granular da syncQueue
  useEffect(() => {
    const snap = getStatus();
    setDetail({
      pendingOps: snap.pendingOps || 0,
      lastSync:   snap.lastSync   || null,
      warnings:   snap.warnings   || [],
    });
  }, [syncStatus]);

  // Gerencia visibilidade: mostra quando degraded/offline/pending, oculta ao recuperar
  useEffect(() => {
    if (syncStatus === 'healthy' && detail.pendingOps === 0) {
      // Pequeno delay para não piscar se for temporário
      const t = setTimeout(() => {
        setVisible(false);
        setDismissed(false); // reseta dismissed quando volta a healthy
      }, 1500);
      return () => clearTimeout(t);
    } else {
      setVisible(true);
    }
  }, [syncStatus, detail.pendingOps]);

  if (!visible || dismissed) return null;

  const isOffline   = syncStatus === 'offline';
  const isDegraded  = syncStatus === 'degraded';
  const pendingOps  = detail.pendingOps;

  const isHealthy   = syncStatus === 'healthy';
  const bgColor     = isOffline  ? 'rgba(20,20,30,0.97)'  : isHealthy ? 'rgba(16,185,129,0.95)' : 'rgba(50,40,5,0.97)';
  const borderColor = isOffline  ? 'rgba(255,255,255,0.08)' : isHealthy ? 'rgba(16,185,129,0.35)' : 'rgba(234,179,8,0.35)';
  const textColor   = isOffline  ? '#94a3b8'              : isHealthy ? '#ffffff' : '#fbbf24';
  const icon        = isOffline  ? '📡'                   : isHealthy ? '✅' : '🔄';

  const message = isOffline
    ? 'Modo offline — dados salvos localmente. Sincronizará quando reconectar.'
    : pendingOps > 0
      ? `Sincronizando ${pendingOps} operaç${pendingOps === 1 ? 'ão' : 'ões'}...`
      : syncStatus === 'healthy' 
        ? 'Sincronizado com sucesso' 
        : 'Conexão instável — reconectando...';

  const lastSyncText = detail.lastSync
    ? `Última sync: ${new Date(detail.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:       'fixed',
        top:            0,
        left:           0,
        right:          0,
        zIndex:         9999,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            '8px',
        padding:        '7px 16px',
        fontSize:       '12px',
        fontWeight:     500,
        lineHeight:     1.4,
        backgroundColor: bgColor,
        borderBottom:   `1px solid ${borderColor}`,
        color:          textColor,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow:      '0 1px 8px rgba(0,0,0,0.3)',
        transition:     'all 0.3s ease',
      }}
    >
      {/* Ícone animado */}
      <span style={{
        fontSize:  '14px',
        animation: isDegraded ? 'spin 1.5s linear infinite' : 'none',
      }}>
        {icon}
      </span>

      {/* Mensagem principal */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>{message}</span>

        {/* Badge de pendentes */}
        {pendingOps > 0 && (
          <span style={{
            display:         'inline-flex',
            alignItems:      'center',
            justifyContent:  'center',
            minWidth:        '20px',
            height:          '18px',
            padding:         '0 6px',
            borderRadius:    '9px',
            backgroundColor: isOffline ? 'rgba(255,255,255,0.1)' : 'rgba(234,179,8,0.2)',
            border:          `1px solid ${isOffline ? 'rgba(255,255,255,0.15)' : 'rgba(234,179,8,0.4)'}`,
            fontSize:        '11px',
            fontWeight:      600,
          }}>
            {pendingOps}
          </span>
        )}

        {/* Última sync */}
        {lastSyncText && (
          <span style={{ opacity: 0.5, fontSize: '11px' }}>
            {lastSyncText}
          </span>
        )}
      </div>

      {/* Botão dismiss */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dispensar aviso de sincronização"
        title="Dispensar"
        style={{
          background:  'none',
          border:      'none',
          cursor:      'pointer',
          color:       textColor,
          opacity:     0.5,
          fontSize:    '14px',
          padding:     '2px 4px',
          lineHeight:  1,
          flexShrink:  0,
          borderRadius: '4px',
          transition:  'opacity 0.2s',
        }}
        onMouseEnter={e => e.target.style.opacity = 1}
        onMouseLeave={e => e.target.style.opacity = 0.5}
      >
        ✕
      </button>

      {/* CSS para animação de spin */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
