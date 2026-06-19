import React, { useState, useEffect, useMemo } from 'react';
import { 
  Terminal, ShieldAlert, Cpu, RefreshCw, Layers, CheckCircle, Database, HelpCircle, ArrowRight, Download, Clock
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { eventStore } from '../services/eventStore';
import { eventEmitter } from '../services/eventEmitter';
import { localDB } from '../db/localDB';
import { flush as flushSync, getStatus as getSyncStatus, getConflictLogs } from '../services/syncQueue';

export default function DevToolsWidget() {
  const { 
    currentUser, 
    userState, 
    insights, 
    suggestions, 
    rehydrateUserState, 
    syncStatus, 
    syncWarnings 
  } = useAppContext();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('events');
  const [localEvents, setLocalEvents] = useState([]);
  const [pendingOps, setPendingOps] = useState([]);
  const [isReplaying, setIsReplaying] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [timelineMinutes, setTimelineMinutes] = useState(10);

  // Carrega e assina dados locais
  useEffect(() => {
    if (!currentUser?.id) return;

    const loadLocalData = async () => {
      const evs = await eventStore.getEventsForUser(currentUser.id);
      setLocalEvents([...evs].reverse()); // Log com os mais novos primeiro

      const ops = await localDB.getAll('pendingOps');
      setPendingOps(ops);
    };

    loadLocalData();

    // Atualiza com eventos locais via pub/sub central
    const unsubEvents = eventEmitter.on('*', () => {
      loadLocalData();
    });

    const timer = setInterval(async () => {
      const ops = await localDB.getAll('pendingOps');
      setPendingOps(ops);
    }, 3000);

    return () => {
      unsubEvents();
      clearInterval(timer);
    };
  }, [currentUser?.id, isOpen]);

  if (!currentUser) return null;

  // Replay manual de Event Sourcing
  const handleManualReplay = async () => {
    setIsReplaying(true);
    try {
      await rehydrateUserState(currentUser.id);
      const evs = await eventStore.getEventsForUser(currentUser.id);
      setLocalEvents([...evs].reverse());
      alert('Replay concluído! Estado derivado recalculado e reidratado com sucesso.');
    } catch (err) {
      alert('Falha ao rodar replay: ' + err.message);
    } finally {
      setIsReplaying(false);
    }
  };

  // Forçar sincronização imediata
  const handleManualFlush = async () => {
    setIsFlushing(true);
    try {
      await flushSync();
      const ops = await localDB.getAll('pendingOps');
      setPendingOps(ops);
    } catch (err) {
      console.warn('[DevTools] Erro ao sincronizar fila:', err);
    } finally {
      setIsFlushing(false);
    }
  };

  // Exportar logs completos da sessão (JSON Download)
  const handleDownloadSession = async () => {
    try {
      const evs = await eventStore.getEventsForUser(currentUser.id);
      const conflicts = getConflictLogs();
      const sessionData = {
        session_id: currentUser.id,
        downloaded_at: new Date().toISOString(),
        beta_safe_mode: !!window.BETA_SAFE_MODE,
        user_state: userState,
        local_events_count: evs.length,
        events_timeline: evs,
        conflict_logs: conflicts,
        sync_telemetry: getSyncStatus()
      };
      
      const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `myflowday_diagnostico_${currentUser.id}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao exportar diagnóstico: ' + err.message);
    }
  };

  // Métricas em Tempo Real
  const syncLagAvg = useMemo(() => {
    const status = getSyncStatus();
    const lagMs = status.avgSyncLagMs || 0;
    if (lagMs === 0) return '0ms';
    if (lagMs < 1000) return `${lagMs}ms`;
    return `${(lagMs / 1000).toFixed(1)}s`;
  }, [pendingOps]);

  const conflictRate = useMemo(() => {
    const status = getSyncStatus();
    const total = status.totalSyncs || 0;
    const conflicts = status.conflictCount || 0;
    return total > 0 ? `${Math.round((conflicts / total) * 100)}%` : '0%';
  }, [pendingOps]);

  const eventsPerMinute = useMemo(() => {
    const oneMinAgo = Date.now() - 60 * 1000;
    return localEvents.filter(e => new Date(e.created_at).getTime() >= oneMinAgo).length;
  }, [localEvents]);

  const timelineEvents = useMemo(() => {
    const limitTime = Date.now() - timelineMinutes * 60 * 1000;
    return localEvents.filter(e => new Date(e.created_at).getTime() >= limitTime);
  }, [localEvents, timelineMinutes]);

  // Breakdown de Score
  const getActivationBreakdown = () => {
    const breakdown = [];
    const stats = userState?.stats || {};
    
    breakdown.push({
      rule: 'Onboarding Concluído (+20)',
      met: !!userState?.onboardingCompleted,
      val: userState?.onboardingCompleted ? 20 : 0
    });
    breakdown.push({
      rule: 'Primeira Tarefa Criada (+20)',
      met: (stats.tasksCreated || 0) > 0,
      val: (stats.tasksCreated || 0) > 0 ? 20 : 0
    });
    breakdown.push({
      rule: 'Primeira Vitória/Conclusão (+30)',
      met: (stats.tasksCompleted || 0) > 0,
      val: (stats.tasksCompleted || 0) > 0 ? 30 : 0
    });
    breakdown.push({
      rule: 'Primeiro Hábito Criado (+15)',
      met: (stats.habitsCreated || 0) > 0,
      val: (stats.habitsCreated || 0) > 0 ? 15 : 0
    });
    breakdown.push({
      rule: 'Primeiro Objetivo Criado (+15)',
      met: (stats.goalsCreated || 0) > 0,
      val: (stats.goalsCreated || 0) > 0 ? 15 : 0
    });

    return breakdown;
  };

  const getStageReason = () => {
    if (userState?.days_since_active > 30) return 'Inatividade superior a 30 dias (Churned)';
    if (userState?.days_since_active > 7) return 'Inatividade superior a 7 dias (At Risk)';
    if (!userState?.onboardingCompleted || (userState?.stats?.tasksCreated || 0) === 0) {
      return 'Onboarding pendente ou nenhuma tarefa criada (New)';
    }
    if ((userState?.stats?.tasksCompleted || 0) >= 5) {
      return 'Possui 5 ou mais tarefas concluídas (Engaged)';
    }
    return 'Usuário ativo que realizou tarefas básicas de sucesso (Activated)';
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          zIndex: 9999,
          backgroundColor: '#1E293B',
          border: '1px solid #334155',
          borderRadius: '50px',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#E2E8F0',
          cursor: 'pointer',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 0 15px rgba(99, 102, 241, 0.3)',
          transition: 'all 0.2s ease',
          fontSize: '12.5px',
          fontWeight: '700'
        }}
        className="btn-devtools"
      >
        <Terminal size={15} style={{ color: '#818CF8' }} />
        <span>DevTools {window.BETA_SAFE_MODE && '🛡️'}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '440px',
            height: '100%',
            backgroundColor: '#0F172A',
            borderLeft: '1px solid #1E293B',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'monospace',
            color: '#94A3B8'
          }}
          className="animate-slide-in"
        >
          {/* Header */}
          <div style={{ padding: '16px', borderBottom: '1px solid #1E293B', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E293B' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} style={{ color: '#818CF8' }} />
              <strong style={{ color: '#F8FAFC', fontSize: '14px' }}>MyFlowDay 3.0 Safe Observability</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                onClick={handleDownloadSession}
                title="Exportar Sessão JSON"
                style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <Download size={16} />
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Indicadores Beta Safe Mode */}
          <div style={{ padding: '10px 16px', backgroundColor: '#1E293B', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', borderBottom: '1px solid #334155', fontSize: '11px', textAlign: 'center' }}>
            <div style={{ padding: '4px', backgroundColor: '#0F172A', borderRadius: '4px' }}>
              <span style={{ color: '#64748B', display: 'block' }}>Sync Lag Médio</span>
              <strong style={{ color: '#F8FAFC' }}>{syncLagAvg}</strong>
            </div>
            <div style={{ padding: '4px', backgroundColor: '#0F172A', borderRadius: '4px' }}>
              <span style={{ color: '#64748B', display: 'block' }}>Tx Conflito</span>
              <strong style={{ color: '#EF4444' }}>{conflictRate}</strong>
            </div>
            <div style={{ padding: '4px', backgroundColor: '#0F172A', borderRadius: '4px' }}>
              <span style={{ color: '#64748B', display: 'block' }}>Evs / Min</span>
              <strong style={{ color: '#818CF8' }}>{eventsPerMinute}</strong>
            </div>
          </div>

          {/* Abas */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1E293B', backgroundColor: '#0B0F19', fontSize: '11px' }}>
            {[
              { id: 'events', label: '📜 Timeline' },
              { id: 'state', label: '🧠 Estado' },
              { id: 'sync', label: '🔄 Fila Sync' },
              { id: 'intelligence', label: '💡 Insights' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '10px 6px',
                  background: activeTab === tab.id ? '#0F172A' : 'none',
                  border: 'none',
                  color: activeTab === tab.id ? '#818CF8' : '#64748B',
                  fontWeight: activeTab === tab.id ? '800' : '500',
                  cursor: 'pointer',
                  borderBottom: activeTab === tab.id ? '2px solid #818CF8' : 'none'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Conteúdo */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', fontSize: '12px' }}>
            
            {/* Timeline de Eventos */}
            {activeTab === 'events' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    <span>Janela: </span>
                    <select 
                      value={timelineMinutes} 
                      onChange={(e) => setTimelineMinutes(Number(e.target.value))}
                      style={{ backgroundColor: '#1E293B', color: '#F8FAFC', border: '1px solid #334155', borderRadius: '2px', padding: '1px' }}
                    >
                      <option value={5}>Últimos 5 min</option>
                      <option value={10}>Últimos 10 min</option>
                      <option value={30}>Últimos 30 min</option>
                      <option value={1440}>Últimas 24h</option>
                    </select>
                  </div>
                  <button 
                    onClick={handleManualReplay} 
                    disabled={isReplaying}
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      padding: '4px 8px', 
                      backgroundColor: '#1E293B', 
                      border: '1px solid #334155', 
                      color: '#E2E8F0', 
                      borderRadius: '4px', 
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={12} className={isReplaying ? 'animate-spin' : ''} /> Replay
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {timelineEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#475569' }}>
                      Nenhum evento registrado nesta janela temporal.
                    </div>
                  ) : (
                    timelineEvents.map(e => (
                      <div 
                        key={e.id} 
                        style={{ 
                          padding: '8px 10px', 
                          backgroundColor: '#1E293B', 
                          borderLeft: '3px solid #818CF8', 
                          borderRadius: '0 4px 4px 0'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ color: '#F8FAFC' }}>{e.event_type}</strong>
                            <span style={{ fontSize: '9px', marginLeft: '6px', padding: '1px 3px', backgroundColor: '#0F172A', borderRadius: '3px', color: '#10B981' }}>
                              Local Event (Source)
                            </span>
                          </div>
                          <span style={{ fontSize: '10px', color: '#64748B' }}>
                            {new Date(e.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        {e.metadata && Object.keys(e.metadata).length > 0 && (
                          <pre style={{ margin: '4px 0 0 0', fontSize: '9.5px', color: '#94A3B8', overflowX: 'auto', backgroundColor: '#0B0F19', padding: '4px', borderRadius: '2px' }}>
                            {JSON.stringify(e.metadata)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Diagnóstico de Estado */}
            {activeTab === 'state' && (
              <div>
                <h4 style={{ color: '#F8FAFC', margin: '0 0 12px 0', fontSize: '13px' }}>🧠 Diagnóstico do State Engine</h4>
                
                {/* State Origin */}
                <div style={{ backgroundColor: '#1E293B', padding: '12px', borderRadius: '6px', marginBottom: '14px', borderLeft: '3px solid #10B981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span>Origem do Estado:</span>
                    <strong style={{ color: '#10B981' }}>RECOMPUTADO (Replay)</strong>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                    Reconstruído em tempo real de eventos locais. Snapshots automáticos ativos.
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '12px', borderRadius: '6px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Estágio de Retenção:</span>
                    <strong style={{ color: '#818CF8' }}>{userState?.stage?.toUpperCase()}</strong>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                    Motivo: {getStageReason()}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '12px', borderRadius: '6px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Activation Score:</span>
                    <strong style={{ color: '#10B981' }}>{userState?.activationScore || 0} / 100</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span>Engagement Score:</span>
                    <strong style={{ color: '#F59E0B' }}>{userState?.engagementScore || 0} / 100</strong>
                  </div>

                  <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Ativação Breakdown:</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                    {getActivationBreakdown().map(b => (
                      <div key={b.rule} style={{ display: 'flex', justifyContent: 'space-between', color: b.met ? '#10B981' : '#475569' }}>
                        <span>{b.met ? '✔' : '✖'} {b.rule}</span>
                        <span>+{b.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Time to Value:</span>
                    <span>{userState?.timeToValue ? `${(userState.timeToValue / 1000).toFixed(1)}s` : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Tarefas Criadas:</span>
                    <span>{userState?.stats?.tasksCreated || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Tarefas Concluídas:</span>
                    <span>{userState?.stats?.tasksCompleted || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Sessões:</span>
                    <span>{userState?.stats?.sessions || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Fila Sync */}
            {activeTab === 'sync' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Status: 
                    <strong style={{ color: syncStatus === 'healthy' ? '#10B981' : syncStatus === 'degraded' ? '#F59E0B' : '#EF4444' }}>
                      {syncStatus?.toUpperCase()}
                    </strong>
                  </span>
                  
                  <button 
                    onClick={handleManualFlush} 
                    disabled={isFlushing || pendingOps.length === 0}
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      padding: '4px 8px', 
                      backgroundColor: pendingOps.length > 0 ? '#818CF8' : '#1E293B', 
                      border: '1px solid #334155', 
                      color: pendingOps.length > 0 ? '#FFFFFF' : '#64748B', 
                      borderRadius: '4px', 
                      cursor: pendingOps.length > 0 ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <RefreshCw size={12} className={isFlushing ? 'animate-spin' : ''} /> Sync
                  </button>
                </div>

                {syncWarnings.length > 0 && (
                  <div style={{ padding: '8px 10px', backgroundColor: '#C06C6C', color: '#FFF', borderRadius: '4px', marginBottom: '14px', fontSize: '11px' }}>
                    <strong>Alertas de Conexão:</strong>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                      {syncWarnings.slice(-2).map((w, idx) => <li key={idx}>{w}</li>)}
                    </ul>
                  </div>
                )}

                {/* Conflict Log Viewer */}
                <div style={{ backgroundColor: '#1E293B', padding: '12px', borderRadius: '6px', marginBottom: '14px' }}>
                  <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px', color: '#EF4444' }}>Auditoria de Conflitos (Histórico):</span>
                  {getConflictLogs().length === 0 ? (
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Nenhum conflito registrado nesta sessão.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto', fontSize: '10.5px' }}>
                      {getConflictLogs().map((log, idx) => (
                        <div key={idx} style={{ borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
                          <span>[{new Date(log.timestamp).toLocaleTimeString()}] {log.type} &rarr; <span style={{ color: '#F59E0B' }}>{log.resolution}</span></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Fila Local: {pendingOps.length} itens</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pendingOps.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#475569' }}>
                      Fila local vazia.
                    </div>
                  ) : (
                    pendingOps.map(op => (
                      <div 
                        key={op.idempotency_key} 
                        style={{ 
                          padding: '8px 10px', 
                          backgroundColor: '#1E293B', 
                          borderLeft: '3px solid #F59E0B', 
                          borderRadius: '0 4px 4px 0'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                          <strong style={{ color: '#F8FAFC' }}>{op.type}</strong>
                          <span style={{ color: '#64748B' }}>Tentativas: {op.attempts || 0}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                          Key: {op.idempotency_key.substring(0, 8)}...
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Insights */}
            {activeTab === 'intelligence' && (
              <div>
                <h4 style={{ color: '#F8FAFC', margin: '0 0 12px 0', fontSize: '13px' }}>💡 Inteligência de Produto Preditiva</h4>
                
                <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Insights Comportamentais:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {insights.length === 0 ? (
                    <div style={{ color: '#475569' }}>Nenhum insight comportamental ativo.</div>
                  ) : (
                    insights.map((ins, idx) => (
                      <div key={idx} style={{ padding: '8px 10px', backgroundColor: '#1E293B', borderRadius: '4px', borderLeft: '3px solid #10B981' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: '#F8FAFC', fontWeight: 'bold' }}>{ins.emoji} {ins.type.toUpperCase()}</span>
                          <span style={{ color: '#64748B' }}>Confiança: {Math.round(ins.confidence * 100)}%</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '11.5px', color: '#94A3B8', lineHeight: '1.4' }}>{ins.message}</p>
                      </div>
                    ))
                  )}
                </div>

                <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Sugestões do Retention Engine:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {suggestions.length === 0 ? (
                    <div style={{ color: '#475569' }}>Nenhuma sugestão ativa de loop comportamental.</div>
                  ) : (
                    suggestions.map(sug => (
                      <div key={sug.id} style={{ padding: '8px 10px', backgroundColor: '#1E293B', borderRadius: '4px', borderLeft: '3px solid #818CF8' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: '#F8FAFC', fontWeight: 'bold' }}>{sug.title}</span>
                          <span style={{ color: '#64748B' }}>Aba: {sug.actionTab}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '11.5px', color: '#94A3B8', lineHeight: '1.4' }}>{sug.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
