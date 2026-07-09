import React from 'react';

export default function CustomerHealthTable({ customers, onUserClick }) {
  const tableStyle = {
    width: '100%',
    minWidth: '650px',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '14px',
    color: 'var(--text-main)'
  };

  const thStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-light)',
    color: 'var(--text-muted)',
    fontWeight: '600',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  const tdStyle = {
    padding: '16px',
    borderBottom: '1px solid var(--border-light)',
    verticalAlign: 'middle',
    color: 'var(--text-main)'
  };

  const getStatusBadge = (status) => {
    let bg = 'var(--bg-card-hover)';
    let color = 'var(--text-muted)';

    switch (status) {
      case 'ACTIVE':
      case 'TRIALING':
        bg = 'rgba(16, 185, 129, 0.15)';
        color = '#10b981';
        break;
      case 'CANCELED':
        bg = 'rgba(245, 158, 11, 0.15)';
        color = '#f59e0b';
        break;
      case 'PAST_DUE':
        bg = 'rgba(239, 68, 68, 0.15)';
        color = '#ef4444';
        break;
      case 'EXPIRED':
      case 'FREE':
        bg = 'var(--bg-card-hover)';
        color = 'var(--text-light)';
        break;
    }

    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: '700',
        backgroundColor: bg,
        color: color,
        display: 'inline-block'
      }}>
        {status}
      </span>
    );
  };

  const getScoreColor = (score) => {
    if (score >= 70) return '#ef4444';
    if (score >= 31) return '#f59e0b';
    return '#10b981';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Nunca';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      borderRadius: '12px',
      border: '1px solid var(--border-light)',
      padding: '24px',
      boxShadow: 'var(--shadow-md)',
      color: 'var(--text-main)',
      marginBottom: '30px'
    }}>
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
        Saúde do Cliente & Score de Churn
      </h3>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Usuário</th>
              <th style={thStyle}>Plano</th>
              <th style={thStyle}>Status Assinatura</th>
              <th style={thStyle}>Score de Churn</th>
              <th style={thStyle}>Última Atividade</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {customers && customers.length > 0 ? (
              customers.map((c) => (
                <tr 
                  key={c.id} 
                  style={{ transition: 'background-color 0.2s ease', cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => onUserClick(c.id)}
                >
                  <td style={{ ...tdStyle, fontWeight: '500' }}>{c.name}</td>
                  <td style={{ ...tdStyle, textTransform: 'capitalize' }}>{c.plano}</td>
                  <td style={tdStyle}>{getStatusBadge(c.status)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: getScoreColor(c.churnScore)
                      }}></span>
                      <span style={{ fontWeight: '600', color: getScoreColor(c.churnScore) }}>
                        {c.churnScore}
                      </span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{formatDate(c.lastActiveAt)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      color: '#3b82f6',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUserClick(c.id);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
                      e.currentTarget.style.color = '#3b82f6';
                    }}
                    >
                      Ver Histórico
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ ...tdStyle, textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)' }}>
                  Nenhum usuário carregado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
