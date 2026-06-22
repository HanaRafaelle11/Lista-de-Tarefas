import React from 'react';

export default function RevenueKPI({ kpis }) {
  const { mrr, arr, churnRate, nrr, activeSubscribers, reactivatedCount, arpu } = kpis || {};

  const cardStyle = {
    backgroundColor: 'rgba(30, 30, 38, 0.95)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '24px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    transition: 'transform 0.2s ease, border-color 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '120px'
  };

  const labelStyle = {
    fontSize: '13px',
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px'
  };

  const valueStyle = {
    fontSize: '32px',
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: 'var(--font-display, sans-serif)',
    letterSpacing: '-1px'
  };

  const footerStyle = {
    fontSize: '12px',
    marginTop: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
      {/* Card 1: MRR */}
      <div 
        style={cardStyle} 
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = 'var(--primary, #10b981)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        }}
      >
        <div>
          <div style={labelStyle}>MRR</div>
          <div style={valueStyle}>R$ {mrr?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div style={{ ...footerStyle, color: '#10b981' }}>
          <span>●</span> Receita Recorrente Mensal
        </div>
      </div>

      {/* Card 2: ARR */}
      <div 
        style={cardStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = 'var(--primary, #10b981)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        }}
      >
        <div>
          <div style={labelStyle}>ARR</div>
          <div style={valueStyle}>R$ {arr?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div style={{ ...footerStyle, color: 'rgba(255, 255, 255, 0.4)' }}>
          <span>●</span> Taxa de Execução Anual
        </div>
      </div>

      {/* Card 3: Churn Rate */}
      <div 
        style={cardStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = churnRate > 10 ? '#ef4444' : '#f59e0b';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        }}
      >
        <div>
          <div style={labelStyle}>Churn Rate (30d)</div>
          <div style={{ ...valueStyle, color: churnRate > 10 ? '#ef4444' : '#ffffff' }}>
            {churnRate?.toFixed(1)}%
          </div>
        </div>
        <div style={{ ...footerStyle, color: churnRate > 10 ? '#ef4444' : '#10b981' }}>
          <span>●</span> {churnRate > 10 ? 'Atenção necessária' : 'Nível saudável'}
        </div>
      </div>

      {/* Card 4: NRR */}
      <div 
        style={cardStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = nrr >= 100 ? '#10b981' : '#f59e0b';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        }}
      >
        <div>
          <div style={labelStyle}>NRR (30d)</div>
          <div style={{ ...valueStyle, color: nrr >= 100 ? '#10b981' : '#ffffff' }}>
            {nrr?.toFixed(1)}%
          </div>
        </div>
        <div style={{ ...footerStyle, color: nrr >= 100 ? '#10b981' : '#f59e0b' }}>
          <span>●</span> {nrr >= 100 ? 'Expansão de receita' : 'Contração de receita'}
        </div>
      </div>

      {/* Card 5: Subscribers */}
      <div 
        style={cardStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = 'var(--primary, #10b981)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        }}
      >
        <div>
          <div style={labelStyle}>Assinantes Ativos</div>
          <div style={valueStyle}>{activeSubscribers}</div>
        </div>
        <div style={{ ...footerStyle, color: 'var(--primary, #10b981)' }}>
          <span>●</span> Pro Ativo (Zero Trust)
        </div>
      </div>

      {/* Card 6: ARPU */}
      <div 
        style={cardStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = 'var(--primary, #10b981)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        }}
      >
        <div>
          <div style={labelStyle}>ARPU</div>
          <div style={valueStyle}>R$ {arpu?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div style={{ ...footerStyle, color: 'var(--primary, #10b981)' }}>
          <span>●</span> Receita Média por Usuário
        </div>
      </div>
    </div>
  );
}
