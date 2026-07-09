import React from 'react';

export default function CohortHeatmap({ cohortsData }) {
  if (!cohortsData || cohortsData.length === 0) {
    return (
      <div style={{
        backgroundColor: 'rgba(30, 30, 38, 0.95)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '24px',
        color: 'rgba(255, 255, 255, 0.4)',
        textAlign: 'center',
        height: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }}>
        Nenhum dado de cohort disponível para exibição.
      </div>
    );
  }

  // 1. Organizar os dados em um mapa agrupado por cohort
  // Estrutura: { '2026-06': { size: 100, periods: { 0: 100, 1: 85, ... } } }
  const cohortGroups = {};
  let maxPeriod = 0;

  cohortsData.forEach(row => {
    // Formatar a data da cohort (ex: '2026-06-01' -> 'Jun 2026')
    const rawDate = row.cohort_month;
    const dateObj = new Date(rawDate);
    const formattedCohort = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    
    if (!cohortGroups[formattedCohort]) {
      cohortGroups[formattedCohort] = {
        rawDate: dateObj,
        formatted: formattedCohort,
        totalUsers: Number(row.total_users),
        periods: {}
      };
    }
    
    const period = Number(row.period_month);
    const active = Number(row.active_users);
    cohortGroups[formattedCohort].periods[period] = active;
    
    if (period > maxPeriod) {
      maxPeriod = period;
    }
  });

  // Ordenar as cohorts em ordem cronológica decrescente (mais recente primeiro)
  const sortedCohorts = Object.values(cohortGroups).sort((a, b) => b.rawDate - a.rawDate);
  const displayMaxPeriod = Math.min(maxPeriod, 12); // Exibir no máximo 12 meses de retenção

  const tableHeaderStyle = {
    padding: '10px 14px',
    fontSize: '11px',
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    borderBottom: '2px solid rgba(255, 255, 255, 0.08)',
    textAlign: 'center',
    letterSpacing: '0.05em'
  };

  const mainContainerStyle = {
    backgroundColor: 'rgba(30, 30, 38, 0.95)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '24px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
  };

  const getCellColor = (rate) => {
    if (rate === undefined || rate === null) return 'transparent';
    // HSL Verde do Flowday com opacidade baseada na taxa de retenção
    const opacity = (rate / 100).toFixed(2);
    return `rgba(16, 185, 129, ${opacity})`;
  };

  return (
    <div style={mainContainerStyle}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: '8px',
        fontFamily: 'var(--font-display, sans-serif)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
        Heatmap de Retenção de Cohort (Stripe-Style)
      </h3>
      <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.4)', marginBottom: '20px', lineHeight: '1.4' }}>
        Acompanhe a integridade do seu produto monitorando a retenção de usuários pagantes ao longo dos meses desde o cadastro inicial.
      </p>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '850px' }}>
          <thead>
            <tr>
              <th style={{ ...tableHeaderStyle, textAlign: 'left', width: '120px' }}>Mês da Cohort</th>
              <th style={{ ...tableHeaderStyle, width: '100px' }}>Clientes</th>
              {Array.from({ length: displayMaxPeriod + 1 }).map((_, index) => (
                <th key={index} style={tableHeaderStyle}>Mês {index}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedCohorts.map((cohort, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                {/* Nome do Mês da Cohort */}
                <td style={{
                  padding: '12px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  textTransform: 'capitalize'
                }}>
                  {cohort.formatted}
                </td>
                
                {/* Tamanho da Cohort */}
                <td style={{
                  padding: '12px 14px',
                  fontSize: '13px',
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.7)',
                  backgroundColor: 'rgba(255, 255, 255, 0.01)'
                }}>
                  {cohort.totalUsers}
                </td>
                
                {/* Células de Retenção */}
                {Array.from({ length: displayMaxPeriod + 1 }).map((_, periodIndex) => {
                  const rate = cohort.periods[periodIndex];
                  const hasData = rate !== undefined && rate !== null;
                  
                  return (
                    <td
                      key={periodIndex}
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: hasData && rate > 50 ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                        backgroundColor: getCellColor(rate),
                        transition: 'background-color 0.2s ease',
                        border: '1px solid rgba(25, 25, 30, 0.5)'
                      }}
                    >
                      {hasData ? `${rate.toFixed(0)}%` : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
