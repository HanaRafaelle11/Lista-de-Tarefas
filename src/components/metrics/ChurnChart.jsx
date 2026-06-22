import React from 'react';

export default function ChurnChart({ churn }) {
  const { overallRate, cohorts, riskCounts } = churn || {};
  const { low, medium, high } = riskCounts || { low: 0, medium: 0, high: 0 };
  const totalUsers = low + medium + high;

  const getPercent = (count) => {
    if (!totalUsers) return 0;
    return Math.round((count / totalUsers) * 100);
  };

  const cardStyle = {
    backgroundColor: 'rgba(30, 30, 38, 0.95)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '24px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    color: '#ffffff'
  };

  const cohortCardStyle = {
    backgroundColor: 'rgba(20, 20, 25, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
    flex: '1',
    minWidth: '100px'
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
      {/* Risk Tier Breakdown Card */}
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
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
          Distribuição de Risco de Churn (Engajamento)
        </h3>

        {/* Progress Bars for low, medium, high */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* High Risk */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: '#ef4444', fontWeight: '600' }}>Alto Risco (Score 71–100)</span>
              <span>{high} usuários ({getPercent(high)}%)</span>
            </div>
            <div style={{ height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${getPercent(high)}%`, height: '100%', backgroundColor: '#ef4444', borderRadius: '4px' }}></div>
            </div>
          </div>

          {/* Medium Risk */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: '#f59e0b', fontWeight: '600' }}>Médio Risco (Score 31–70)</span>
              <span>{medium} usuários ({getPercent(medium)}%)</span>
            </div>
            <div style={{ height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${getPercent(medium)}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '4px' }}></div>
            </div>
          </div>

          {/* Low Risk */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: '#10b981', fontWeight: '600' }}>Saudável (Score 0–30)</span>
              <span>{low} usuários ({getPercent(low)}%)</span>
            </div>
            <div style={{ height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${getPercent(low)}%`, height: '100%', backgroundColor: '#10b981', borderRadius: '4px' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Cohort Analysis Card */}
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
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span>
          Churn por Coorte de Clientes
        </h3>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.4)', marginBottom: '20px', lineHeight: '1.4' }}>
          Mede a porcentagem de usuários premium que cancelaram o serviço com base no tempo decorrido desde o upgrade.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
          {/* 7d Cohort */}
          <div style={cohortCardStyle}>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '8px' }}>7 Dias</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: (cohorts?.['7d'] > 15 ? '#ef4444' : '#ffffff'), marginBottom: '4px' }}>
              {cohorts?.['7d']?.toFixed(1)}%
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.3)' }}>de Churn</div>
          </div>

          {/* 30d Cohort */}
          <div style={cohortCardStyle}>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '8px' }}>30 Dias</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: (cohorts?.['30d'] > 20 ? '#ef4444' : '#ffffff'), marginBottom: '4px' }}>
              {cohorts?.['30d']?.toFixed(1)}%
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.3)' }}>de Churn</div>
          </div>

          {/* 90d Cohort */}
          <div style={cohortCardStyle}>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '8px' }}>90 Dias</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: (cohorts?.['90d'] > 25 ? '#ef4444' : '#ffffff'), marginBottom: '4px' }}>
              {cohorts?.['90d']?.toFixed(1)}%
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.3)' }}>de Churn</div>
          </div>
        </div>
      </div>
    </div>
  );
}
