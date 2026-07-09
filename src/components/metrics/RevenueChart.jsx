import React, { useState } from 'react';

export default function RevenueChart({ timeline }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!timeline || timeline.length === 0) {
    return (
      <div style={{
        height: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(30, 30, 38, 0.95)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: 'rgba(255, 255, 255, 0.4)'
      }}>
        Nenhum dado disponível para a linha do tempo.
      </div>
    );
  }

  // Configurações do gráfico
  const width = 800;
  const height = 300;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Extrair valores máximos e mínimos para escalas
  const mrrValues = timeline.map(d => d.mrr);
  const maxMrr = Math.max(...mrrValues, 100); // Garante escala decente mesmo se MRR for baixo
  const minMrr = 0;

  // Gerar coordenadas dos pontos
  const points = timeline.map((d, index) => {
    const x = paddingLeft + (index / (timeline.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.mrr - minMrr) / (maxMrr - minMrr)) * chartHeight;
    return { x, y, index, ...d };
  });

  // String do Path da linha principal
  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  }

  // String do Path da área preenchida abaixo da linha
  let areaD = '';
  if (points.length > 0) {
    areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
  }

  // Formatar datas para exibição no eixo X (exibe 5 marcas)
  const xTicks = [];
  const tickStep = Math.floor(timeline.length / 4);
  for (let i = 0; i < timeline.length; i += tickStep) {
    if (points[i]) xTicks.push(points[i]);
  }
  // Garante a última data
  if (points[timeline.length - 1] && !xTicks.includes(points[timeline.length - 1])) {
    xTicks.push(points[timeline.length - 1]);
  }

  // Marcas do eixo Y (exibe 4 marcas)
  const yTicks = [];
  for (let i = 0; i <= 3; i++) {
    const value = minMrr + (maxMrr - minMrr) * (i / 3);
    const y = paddingTop + chartHeight - (i / 3) * chartHeight;
    yTicks.push({ value, y });
  }

  return (
    <div style={{
      backgroundColor: 'rgba(30, 30, 38, 0.95)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '24px',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      position: 'relative',
      marginBottom: '30px'
    }}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: '20px',
        fontFamily: 'var(--font-display, sans-serif)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary, #10b981)' }}></span>
        Evolução do MRR diário (Últimos 30 dias)
      </h3>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ minWidth: '800px' }}>
          {/* Definições de Gradientes */}
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary, #10b981)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--primary, #10b981)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas de Grade de Fundo (Horizontais) */}
          {yTicks.map((tick, i) => (
            <line
              key={i}
              x1={paddingLeft}
              y1={tick.y}
              x2={width - paddingRight}
              y2={tick.y}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="1"
            />
          ))}

          {/* Eixo Y - Rótulos */}
          {yTicks.map((tick, i) => (
            <text
              key={i}
              x={paddingLeft - 10}
              y={tick.y + 4}
              textAnchor="end"
              fill="rgba(255, 255, 255, 0.4)"
              fontSize="11"
              fontFamily="sans-serif"
            >
              R$ {Math.round(tick.value)}
            </text>
          ))}

          {/* Eixo X - Rótulos */}
          {xTicks.map((tick, i) => {
            const [year, month, day] = tick.date.split('-');
            const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const monthName = monthsShort[parseInt(month, 10) - 1] || '';
            return (
              <text
                key={i}
                x={tick.x}
                y={height - paddingBottom + 20}
                textAnchor="middle"
                fill="rgba(255, 255, 255, 0.4)"
                fontSize="11"
                fontFamily="sans-serif"
              >
                {`${day} ${monthName}`}
              </text>
            );
          })}

          {/* Área Gradiente sob a linha */}
          {areaD && (
            <path
              d={areaD}
              fill="url(#chartGradient)"
            />
          )}

          {/* Linha principal */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="var(--primary, #10b981)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Linha vertical de foco do mouse */}
          {hoveredPoint !== null && (
            <line
              x1={points[hoveredPoint].x}
              y1={paddingTop}
              x2={points[hoveredPoint].x}
              y2={paddingTop + chartHeight}
              stroke="rgba(255, 255, 255, 0.2)"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          )}

          {/* Pontos interativos para hover */}
          {points.map((p, index) => (
            <circle
              key={index}
              cx={p.x}
              cy={p.y}
              r={hoveredPoint === index ? 6 : 4}
              fill={hoveredPoint === index ? 'var(--primary, #10b981)' : 'rgba(16, 185, 129, 0.3)'}
              stroke="#1e1e26"
              strokeWidth={hoveredPoint === index ? 2 : 1}
              style={{ cursor: 'pointer', transition: 'r 0.1s ease, fill 0.1s ease' }}
              onMouseEnter={() => setHoveredPoint(index)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>
      </div>

      {/* Gaveta de Tooltip do Tooltip customizado */}
      {hoveredPoint !== null && (
        <div style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          backgroundColor: 'rgba(20, 20, 25, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '12px',
          minWidth: '180px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
          zIndex: 10,
          color: '#ffffff',
          pointerEvents: 'none'
        }}>
          <div style={{ fontWeight: '700', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '6px', marginBottom: '6px' }}>
            Dia {points[hoveredPoint].date.split('-').reverse().join('/')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>MRR:</span>
            <span style={{ fontWeight: '600', color: '#10b981' }}>R$ {points[hoveredPoint].mrr.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Novos Upgrades:</span>
            <span style={{ fontWeight: '600', color: '#3b82f6' }}>+{points[hoveredPoint].upgrades}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Reativações:</span>
            <span style={{ fontWeight: '600', color: '#10b981' }}>+{points[hoveredPoint].reactivations}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Churns/Cancelamentos:</span>
            <span style={{ fontWeight: '600', color: '#ef4444' }}>-{points[hoveredPoint].churns}</span>
          </div>
        </div>
      )}
    </div>
  );
}
