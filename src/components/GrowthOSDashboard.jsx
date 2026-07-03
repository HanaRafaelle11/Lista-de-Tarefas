import React, { useState, useEffect } from 'react';
import { Brain, AlertTriangle, DollarSign, Zap, RotateCcw, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function GrowthOSDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchIntelligence = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/growth/intelligence');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, []);

  if (loading && !data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        <RefreshCw style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} size={32} />
        <p>Carregando Inteligência Growth OS...</p>
      </div>
    );
  }

  const { riskSummary, revenueLeaks, actions, closedLoop } = data || {};

  return (
    <div style={{ fontFamily: 'sans-serif', color: '#f8fafc', padding: '1rem 0' }}>
      {/* HEADER OS */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.5rem', borderRadius: '16px', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        border: '1px solid #4338ca', marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Brain size={36} color="#818cf8" />
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem' }}>Growth Operating System (Growth OS)</h2>
            <p style={{ margin: '0.2rem 0 0', color: '#c7d2fe', fontSize: '0.9rem' }}>
              Motor autônomo de retenção, recuperação de receita e feedback loop em tempo real.
            </p>
          </div>
        </div>

      </div>

      {/* QUADROS PRINCIPAIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* 1. RISK CENTER */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
            <AlertTriangle color="#ef4444" size={24} />
            <h3 style={{ margin: 0, color: '#f1f5f9' }}>Risk Center (Usuários em Risco)</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', textAlign: 'center', marginBottom: '1.2rem' }}>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Baixo</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399' }}>{riskSummary?.totalPerLevel?.low || 0}</div>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Médio</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24' }}>{riskSummary?.totalPerLevel?.medium || 0}</div>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Alto</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f87171' }}>{riskSummary?.totalPerLevel?.high || 0}</div>
            </div>
          </div>
          <h4 style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>Principais Motivos de Risco:</h4>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.85rem' }}>
            {riskSummary?.topReasons?.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>

        {/* 2. REVENUE LEAKS */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
            <DollarSign color="#f59e0b" size={24} />
            <h3 style={{ margin: 0, color: '#f1f5f9' }}>Revenue Leaks (Perda Estimada)</h3>
          </div>
          <div style={{ background: '#451a1a', border: '1px solid #7f1d1d', padding: '1rem', borderRadius: '10px', marginBottom: '1.2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#fca5a5' }}>Perda de Receita Estimada</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f87171' }}>R$ {revenueLeaks?.totalEstimatedLoss?.toFixed(2)}</div>
          </div>
          <h4 style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>Detalhamento por Tipo:</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {revenueLeaks?.breakdownByType?.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px' }}>
                <span>{b.type} ({b.count}x)</span>
                <strong style={{ color: '#f87171' }}>R$ {b.loss.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* 3. ACTION CENTER & CLOSED-LOOP */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
            <Zap color="#a855f7" size={24} />
            <h3 style={{ margin: 0, color: '#f1f5f9' }}>Action Center & Closed-Loop</h3>
          </div>
          <div style={{ fontSize: '0.9rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
              <span>Ações Automáticas (24h):</span>
              <strong style={{ color: '#a855f7' }}>{actions?.triggeredLast24h}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
              <span>Usuários Reativados (Closed-Loop):</span>
              <strong style={{ color: '#34d399' }}>{closedLoop?.usersReturnedCount} usuários</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
              <span>Taxa de Retorno / ROI:</span>
              <strong style={{ color: '#34d399' }}>{closedLoop?.retentionROIPercent}%</strong>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
