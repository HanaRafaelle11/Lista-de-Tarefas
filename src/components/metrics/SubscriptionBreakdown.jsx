import React from 'react';

export default function SubscriptionBreakdown({ breakdown }) {
  const { free, active, canceled, pastDue } = breakdown || { free: 0, active: 0, canceled: 0, pastDue: 0 };
  const total = free + active + canceled + pastDue;

  const getPercent = (count) => {
    if (!total) return 0;
    return (count / total) * 100;
  };

  const activePct = getPercent(active);
  const canceledPct = getPercent(canceled);
  const pastDuePct = getPercent(pastDue);
  const freePct = getPercent(free);

  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    padding: '24px',
    boxShadow: 'var(--shadow-md)',
    color: 'var(--text-main)',
    marginBottom: '30px',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehaviorX: 'contain'
  };

  const legendItemStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid var(--border-light)',
    fontSize: '14px'
  };

  return (
    <div style={cardStyle}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: '600',
        marginBottom: '20px',
        fontFamily: 'var(--font-display, sans-serif)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary, #10b981)' }}></span>
        Distribuição de Planos & Assinaturas
      </h3>

      {/* Segmented Percentage Bar */}
      <div style={{
        height: '24px',
        display: 'flex',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '24px',
        backgroundColor: 'var(--bg-card-hover)',
        border: '1px solid var(--border-light)'
      }}>
        {active > 0 && (
          <div 
            style={{ width: `${activePct}%`, backgroundColor: '#10b981', transition: 'width 0.3s ease' }} 
            title={`Ativo: ${active} (${activePct.toFixed(1)}%)`}
          />
        )}
        {canceled > 0 && (
          <div 
            style={{ width: `${canceledPct}%`, backgroundColor: '#f59e0b', transition: 'width 0.3s ease' }} 
            title={`Cancelado: ${canceled} (${canceledPct.toFixed(1)}%)`}
          />
        )}
        {pastDue > 0 && (
          <div 
            style={{ width: `${pastDuePct}%`, backgroundColor: '#ef4444', transition: 'width 0.3s ease' }} 
            title={`Em Atraso: ${pastDue} (${pastDuePct.toFixed(1)}%)`}
          />
        )}
        {free > 0 && (
          <div 
            style={{ width: `${freePct}%`, backgroundColor: 'var(--text-light)', opacity: 0.5, transition: 'width 0.3s ease' }} 
            title={`Gratuito: ${free} (${freePct.toFixed(1)}%)`}
          />
        )}
      </div>

      {/* Legend list */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Active Premium */}
        <div style={legendItemStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#10b981' }}></span>
            <span style={{ fontWeight: '500' }}>Premium Ativo (ACTIVE / TRIALING)</span>
          </div>
          <span style={{ fontWeight: '600' }}>{active} ({activePct.toFixed(1)}%)</span>
        </div>

        {/* Canceled Premium */}
        <div style={legendItemStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#f59e0b' }}></span>
            <span style={{ fontWeight: '500' }}>Premium Cancelado (Grace Period)</span>
          </div>
          <span style={{ fontWeight: '600' }}>{canceled} ({canceledPct.toFixed(1)}%)</span>
        </div>

        {/* Past Due Premium */}
        <div style={legendItemStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ef4444' }}></span>
            <span style={{ fontWeight: '500' }}>Premium Atrasado (PAST_DUE)</span>
          </div>
          <span style={{ fontWeight: '600' }}>{pastDue} ({pastDuePct.toFixed(1)}%)</span>
        </div>

        {/* Free users */}
        <div style={{ ...legendItemStyle, borderBottom: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--text-light)', opacity: 0.5 }}></span>
            <span style={{ fontWeight: '500' }}>Usuários Gratuitos (FREE / EXPIRED)</span>
          </div>
          <span style={{ fontWeight: '600' }}>{free} ({freePct.toFixed(1)}%)</span>
        </div>
      </div>
    </div>
  );
}
