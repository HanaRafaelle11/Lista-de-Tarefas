import React, { useState, useEffect } from 'react';
import { Activity, Bell, CreditCard, Layers, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export default function SystemStatusDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/system-status');
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
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Auto refresh a cada 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        <RefreshCw style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} size={32} />
        <p>Carregando telemetria do sistema...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '12px', color: '#f87171' }}>
        <AlertTriangle size={24} style={{ marginBottom: '0.5rem' }} />
        <h3>Erro ao conectar à API de Status</h3>
        <p>{error}</p>
        <button onClick={fetchStatus} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Tentar Novamente</button>
      </div>
    );
  }

  const { statusOverall, health, notifications, billing, events, latencyMs } = data || {};

  const statusColors = {
    healthy: { bg: '#10b98122', text: '#34d399', border: '#10b981', label: '🟢 Sistema Saudável (Healthy)', icon: CheckCircle2 },
    degraded: { bg: '#f59e0b22', text: '#fbbf24', border: '#f59e0b', label: '🟡 Desempenho Degradado (Degraded)', icon: AlertTriangle },
    critical: { bg: '#ef444422', text: '#f87171', border: '#ef4444', label: '🔴 Falha Crítica (Critical)', icon: XCircle }
  };

  const currentStatus = statusColors[statusOverall || 'healthy'];
  const StatusIcon = currentStatus.icon;

  return (
    <div style={{ fontFamily: 'sans-serif', color: '#f8fafc', padding: '1rem 0' }}>
      {/* HEADER DE STATUS GERAL */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.5rem', borderRadius: '16px', background: currentStatus.bg,
        border: `1px solid ${currentStatus.border}`, marginBottom: '2rem', backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <StatusIcon size={36} color={currentStatus.text} />
          <div>
            <h2 style={{ margin: 0, color: currentStatus.text, fontSize: '1.4rem' }}>{currentStatus.label}</h2>
            <p style={{ margin: '0.2rem 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              Latência de consulta: {latencyMs}ms • Atualização automática a cada 30s
            </p>
          </div>
        </div>

      </div>

      {/* GRID DE METRICAS PRINCIPAIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* 🟢 SYSTEM HEALTH */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
            <Activity color="#38bdf8" size={24} />
            <h3 style={{ margin: 0, color: '#f1f5f9' }}>System Health</h3>
          </div>
          <div style={{ fontSize: '0.95rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div>Status Worker Loop: <strong style={{ color: health?.workerStatus === 'OK' ? '#34d399' : '#f87171' }}>{health?.workerStatus}</strong></div>
            <div>Última Execução: <strong>{new Date(health?.lastWorkerRun).toLocaleTimeString('pt-BR')}</strong></div>
            {health?.lastErrorEvent && (
              <div style={{ color: '#f87171', fontSize: '0.85rem', background: '#451a1a', padding: '0.5rem', borderRadius: '6px', marginTop: '0.4rem' }}>
                Último Erro: {health.lastErrorEvent.error_message || health.lastErrorEvent.last_error || 'Erro desconhecido'}
              </div>
            )}
          </div>
        </div>

        {/* 📬 NOTIFICATIONS */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
            <Bell color="#a855f7" size={24} />
            <h3 style={{ margin: 0, color: '#f1f5f9' }}>Notifications</h3>
          </div>
          <div style={{ fontSize: '0.95rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div>Fila Pendente: <strong>{notifications?.pendingCount} itens</strong></div>
            <div>Enviados (24h): <strong style={{ color: '#34d399' }}>{notifications?.sentLast24h}</strong></div>
            <div>Taxa de Sucesso: <strong style={{ color: notifications?.successRate >= 90 ? '#34d399' : '#fbbf24' }}>{notifications?.successRate}%</strong></div>
          </div>
        </div>

        {/* 💳 BILLING */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
            <CreditCard color="#f43f5e" size={24} />
            <h3 style={{ margin: 0, color: '#f1f5f9' }}>Billing</h3>
          </div>
          <div style={{ fontSize: '0.95rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div>Assinaturas Ativas: <strong style={{ color: '#38bdf8' }}>{billing?.activeSubscriptions}</strong></div>
            <div>Pagamentos (24h): <strong>{billing?.paymentsLast24h}</strong></div>
            <div>Falhas de Cobrança: <strong style={{ color: billing?.failedPayments === 0 ? '#34d399' : '#f87171' }}>{billing?.failedPayments}</strong></div>
          </div>
        </div>
      </div>

      {/* 📊 EVENT STREAM & LOGS */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
          <Layers color="#fbbf24" size={24} />
          <h3 style={{ margin: 0, color: '#f1f5f9' }}>Event Stream (Últimos Eventos & Erros)</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div>
            <h4 style={{ color: '#94a3b8', marginTop: 0 }}>Top Tipos de Eventos</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {events?.topEventTypes?.map((t, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                  <span style={{ color: '#38bdf8' }}>{t.type}</span>
                  <strong>{t.count}x</strong>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ color: '#94a3b8', marginTop: 0 }}>Últimos Eventos Registrados</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
              {events?.lastEvents?.slice(0, 5).map((e, idx) => (
                <div key={idx} style={{ background: '#0f172a', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{e.type}</span>
                  <span style={{ color: '#64748b' }}>{new Date(e.created_at).toLocaleTimeString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
