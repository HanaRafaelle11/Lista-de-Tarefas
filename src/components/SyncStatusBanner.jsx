import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';

/**
 * SyncStatusBanner — Banner discreto de status de sincronização.
 *
 * Visível apenas quando syncStatus !== 'healthy'.
 * Nunca bloqueia a UX. Pode ser dispensado pelo usuário.
 */
export default function SyncStatusBanner() {
  const { syncStatus, syncWarnings } = useAppContext();
  const [dismissed, setDismissed] = useState(false);

  if (syncStatus === 'healthy' || dismissed) return null;

  const isOffline = syncStatus === 'offline';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '8px 16px',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: 1.4,
        backgroundColor: isOffline ? 'rgba(30,30,40,0.95)' : 'rgba(60,50,10,0.95)',
        borderBottom: `1px solid ${isOffline ? 'rgba(255,255,255,0.1)' : 'rgba(255,200,50,0.3)'}`,
        color: isOffline ? '#a0a0b0' : '#f5c842',
        backdropFilter: 'blur(8px)',
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <span style={{ fontSize: '14px' }}>{isOffline ? '⚫' : '🟡'}</span>
        <span>
          {isOffline
            ? 'Sem conexão. Seus dados estão sendo salvos localmente e sincronizados quando reconectar.'
            : 'Sincronização em andamento. Alguns dados podem ser exibidos com atraso.'}
        </span>
        {syncWarnings.length > 0 && (
          <span style={{ opacity: 0.6, fontSize: '11px' }}>
            ({syncWarnings[syncWarnings.length - 1]})
          </span>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dispensar aviso de sincronização"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          opacity: 0.6,
          fontSize: '16px',
          padding: '0 4px',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
