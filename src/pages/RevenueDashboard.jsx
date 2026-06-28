import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import RevenueKPI from '../components/metrics/RevenueKPI';
import RevenueChart from '../components/metrics/RevenueChart';
import ChurnChart from '../components/metrics/ChurnChart';
import SubscriptionBreakdown from '../components/metrics/SubscriptionBreakdown';
import CustomerHealthTable from '../components/metrics/CustomerHealthTable';
import CohortHeatmap from '../components/metrics/CohortHeatmap';
import Skeleton from '../components/Skeleton';

export default function RevenueDashboard() {
  const { currentUser } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Estados do Modal de Timeline
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState(null);

  // Carregar dados analíticos
  useEffect(() => {
    async function loadData() {
      if (!currentUser?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        setIsUnauthorized(false);
        
        const host = window.location.host;
        const protocol = window.location.protocol;
        const apiPrefix = host.includes('localhost') ? `${protocol}//${host}` : '';
        
        const res = await fetch(`${apiPrefix}/api/analytics/revenue?userId=${currentUser.id}`);
        if (res.status === 403) {
          setIsUnauthorized(true);
          return;
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Falha ao carregar dados do painel financeiro.');
        }
        
        const json = await res.json();
        setData(json || {});
      } catch (err) {
        console.error('[RevenueDashboard] Erro ao carregar métricas:', err);
        setError(err.message || 'Erro inesperado ao carregar dados.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser?.id]);

  // Carregar timeline do usuário selecionado
  const handleUserClick = async (targetUserId) => {
    setSelectedUserId(targetUserId);
    setTimelineLoading(true);
    setTimelineError(null);
    setTimelineData(null);
    
    try {
      const host = window.location.host;
      const protocol = window.location.protocol;
      const apiPrefix = host.includes('localhost') ? `${protocol}//${host}` : '';
      
      const res = await fetch(`${apiPrefix}/api/analytics/user-timeline?userId=${currentUser.id}&targetUserId=${targetUserId}`);
      if (res.status === 403) {
        setTimelineError('Você não tem permissão para acessar a timeline deste usuário.');
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao carregar a timeline do usuário.');
      }
      
      const json = await res.json();
      setTimelineData(json);
    } catch (err) {
      console.error('[RevenueDashboard] Erro ao carregar timeline:', err);
      setTimelineError(err.message);
    } finally {
      setTimelineLoading(false);
    }
  };

  const closeTimeline = () => {
    setSelectedUserId(null);
    setTimelineData(null);
  };

  if (loading) {
    return (
      <div style={{ color: '#ffffff', minHeight: '100vh', padding: '20px 0' }}>
        <div style={{ marginBottom: '32px' }}>
          <Skeleton height="32px" width="300px" />
          <Skeleton height="18px" width="450px" style={{ marginTop: '8px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <Skeleton height="120px" width="100%" borderRadius="12px" />
          <Skeleton height="120px" width="100%" borderRadius="12px" />
          <Skeleton height="120px" width="100%" borderRadius="12px" />
          <Skeleton height="120px" width="100%" borderRadius="12px" />
        </div>
        <Skeleton height="280px" width="100%" borderRadius="12px" style={{ marginBottom: '20px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <Skeleton height="220px" width="100%" borderRadius="12px" />
          <Skeleton height="220px" width="100%" borderRadius="12px" />
        </div>
      </div>
    );
  }

  if (isUnauthorized) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', maxWidth: '520px', margin: '40px auto', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px', color: '#ffffff' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444', marginBottom: '8px' }}>Acesso Restrito ao Administrador</h3>
        <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6, margin: 0 }}>
          Você não possui permissão para acessar o painel financeiro. Se acredita que isto é um erro, verifique se está logado com a conta master autorizada.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', maxWidth: '500px', margin: '40px auto', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#ef4444' }}>
        <span style={{ fontSize: '32px' }}>⚠️</span>
        <h3 style={{ fontSize: '18px', margin: '16px 0 8px', fontWeight: '700' }}>Erro ao Carregar Dashboard</h3>
        <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: 1.6 }}>{error}</p>
      </div>
    );
  }

  const alertsList = Array.isArray(data?.alerts) ? data.alerts : [];
  const kpisData = data?.kpis ?? { mrr: 0, arr: 0, churnRate: 0, nrr: 100, activeSubscribers: 0, reactivatedCount: 0, arpu: 0 };
  const timelineList = Array.isArray(data?.timeline) ? data.timeline : [];
  const churnData = data?.churn ?? { overallRate: 0, cohorts: [], riskCounts: { low: 0, medium: 0, high: 0 } };
  const breakdownData = Array.isArray(data?.subscriptionBreakdown) ? data.subscriptionBreakdown : [];
  const cohortsHeatmapData = Array.isArray(data?.cohortsHeatmap) ? data.cohortsHeatmap : [];
  const customerHealthData = Array.isArray(data?.customerHealth) ? data.customerHealth : [];

  return (
    <div style={{ color: '#ffffff', minHeight: '100vh', padding: '20px 0' }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 6px', fontFamily: 'var(--font-display, sans-serif)', letterSpacing: '-0.5px' }}>
          Painel Financeiro & Retenção 📈
        </h2>
        <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.4)', margin: 0 }}>
          Métricas de MRR, Churn Rate e saúde dos usuários do MyFlowDay em tempo real.
        </p>
      </div>

      {/* Stripe-style Insights / Alertas */}
      {alertsList.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
          {alertsList.map((alert) => (
            <div
              key={alert.id || Math.random()}
              style={{
                backgroundColor: alert.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : alert.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                border: alert.type === 'danger' ? '1px solid rgba(239, 68, 68, 0.25)' : alert.type === 'success' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                fontSize: '14px'
              }}
            >
              <span style={{ fontSize: '18px' }}>
                {alert.type === 'danger' ? '🚨' : alert.type === 'success' ? '🏆' : '⚠️'}
              </span>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px', color: alert.type === 'danger' ? '#ef4444' : alert.type === 'success' ? '#10b981' : '#f59e0b' }}>
                  {alert.title ?? 'Notificação'}
                </strong>
                <span style={{ opacity: 0.8 }}>{alert.message ?? ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top Cards KPIs */}
      <RevenueKPI kpis={kpisData} />

      {/* Gráficos e Tabelas Responsivos */}
      <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', minWidth: '360px' }}>
          {/* Gráfico Principal de MRR */}
          <RevenueChart timeline={timelineList} />

          {/* Churn e Breakdowns em duas colunas com scroll responsivo em mobile */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', width: '100%' }}>
            <div style={{ width: '100%', minWidth: '340px' }}>
              <ChurnChart churn={churnData} />
            </div>
            <div style={{ width: '100%', minWidth: '340px' }}>
              <SubscriptionBreakdown breakdown={breakdownData} />
            </div>
          </div>

          {/* Heatmap de Cohort */}
          <CohortHeatmap cohortsData={cohortsHeatmapData} />

          {/* Tabela de Saúde de Clientes */}
          <CustomerHealthTable customers={customerHealthData} onUserClick={handleUserClick} />
        </div>
      </div>

      {/* Gaveta / Modal Lateral para Timeline do Usuário */}
      {selectedUserId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease'
        }}
        onClick={closeTimeline}
        >
          <div style={{
            width: '100%',
            maxWidth: '500px',
            height: '100%',
            backgroundColor: 'rgba(25, 25, 30, 0.98)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px', fontFamily: 'var(--font-display, sans-serif)' }}>
                  Histórico do Cliente
                </h3>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)' }}>
                  ID: {selectedUserId}
                </span>
              </div>
              <button 
                onClick={closeTimeline}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {timelineLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <div className="app-loading-spinner" />
                  <span style={{ marginTop: '12px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.4)' }}>Buscando timeline detalhada...</span>
                </div>
              )}

              {timelineError && (
                <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '13px' }}>
                  {timelineError}
                </div>
              )}

              {timelineData && (
                <div>
                  {/* Informações Resumidas do Perfil */}
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600' }}>{timelineData.name}</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px' }}>
                      <div>
                        <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Plano: </span>
                        <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>{timelineData.plano}</span>
                      </div>
                      <div>
                        <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Status: </span>
                        <span style={{ fontWeight: '600' }}>{timelineData.status || 'FREE'}</span>
                      </div>
                      {timelineData.expiresAt && (
                        <div style={{ width: '100%' }}>
                          <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Expira em: </span>
                          <span style={{ fontWeight: '600' }}>
                            {new Date(timelineData.expiresAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lista de Timeline */}
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)' }}>Timeline de Atividades</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderLeft: '2px solid rgba(255, 255, 255, 0.05)', marginLeft: '12px', paddingLeft: '20px', position: 'relative' }}>
                    {timelineData.timeline && timelineData.timeline.length > 0 ? (
                      timelineData.timeline.map((item, idx) => (
                        <div key={item.id} style={{ position: 'relative' }}>
                          {/* Dot indicador na linha temporal */}
                          <span style={{
                            position: 'absolute',
                            left: '-26px',
                            top: '2px',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: item.type === 'user_upgraded' || item.type === 'user_reactivated' ? '#10b981' : item.type === 'user_downgraded' ? '#ef4444' : 'rgba(255, 255, 255, 0.25)',
                            border: '2px solid rgba(25, 25, 30, 0.98)'
                          }}></span>

                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff' }}>
                            {item.title}
                          </div>
                          
                          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
                            {item.description}
                          </div>

                          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.3)', marginTop: '4px' }}>
                            {new Date(item.timestamp).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.4)' }}>
                        Nenhuma atividade registrada para este usuário.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
