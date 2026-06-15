import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Users, Star, BarChart3, TrendingUp, HelpCircle, ShieldAlert, CheckCircle2, ChevronRight, Download, Filter, Calendar, Award, CheckSquare, Target, Flame
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';

export default function AdminDashboard() {
  const { isAdmin, currentUser } = useAppContext();
  const [profiles, setProfiles] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [userEvents, setUserEvents] = useState([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState(null);
  
  // Filters for individual user timeline
  const [timeFilter, setTimeFilter] = useState('all'); // '7d' | '30d' | 'all'

  // 1. Fetch Global Summary Metrics (Single Source of Truth: SQL RPC Only)
  const fetchGlobalMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_admin_dashboard_metrics');
      
      if (!rpcErr && rpcData) {
        setMetrics(rpcData);
      } else {
        console.error('[AdminDashboard] get_admin_dashboard_metrics failed:', rpcErr);
        setError('Falha ao carregar métricas administrativas do banco de dados.');
        setMetrics(null);
      }

      // Fetch profiles list
      const { data: profilesData, error: profErr } = await supabase
        .from('profiles')
        .select('id, name, nickname, created_at')
        .order('created_at', { ascending: false });

      if (!profErr && profilesData) {
        setProfiles(profilesData);
      }
    } catch (err) {
      console.error('[AdminDashboard] Error fetching admin metrics:', err);
      setError('Erro de conexão ao carregar dados do painel.');
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchGlobalMetrics();
    }
  }, [isAdmin]);

  // 2. Fetch Individual User Details (Single Source of Truth: SQL RPC Only)
  const handleUserClick = async (userId) => {
    setSelectedUser(userId);
    setLoadingUser(true);
    setError(null);
    try {
      const { data: rpcDetail, error: rpcErr } = await supabase.rpc('get_user_detail_metrics', { p_user_id: userId });
      
      if (!rpcErr && rpcDetail) {
        setUserDetails(rpcDetail);
      } else {
        console.error('[AdminDashboard] get_user_detail_metrics failed:', rpcErr);
        setError('Falha ao carregar detalhes do usuário do banco de dados.');
        setUserDetails(null);
      }

      // Fetch user event timeline
      let query = supabase
        .from('events')
        .select('id, event_type, created_at, metadata')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (timeFilter === '7d') {
        query = query.gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      } else if (timeFilter === '30d') {
        query = query.gt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      }

      const { data: evts, error: evtsErr } = await query;
      if (!evtsErr && evts) {
        setUserEvents(evts);
      }
    } catch (e) {
      console.error('[AdminDashboard] Error loading user details:', e);
      setError('Erro de conexão ao carregar a timeline.');
      setUserDetails(null);
    } finally {
      setLoadingUser(false);
    }
  };

  // Re-fetch timeline when filter changes
  useEffect(() => {
    if (selectedUser) {
      handleUserClick(selectedUser);
    }
  }, [timeFilter]);

  // Export to CSV Function
  const handleExportCSV = () => {
    if (!selectedUser || !userDetails) return;
    
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'ID,Tipo de Evento,Data,Metadados\n';
    
    userEvents.forEach(evt => {
      const metaStr = JSON.stringify(evt.metadata).replace(/"/g, '""');
      csvContent += `${evt.id},${evt.event_type},${evt.created_at},"${metaStr}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `user_events_${selectedUser}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAdmin) {
    return (
      <div className="safe-area-inset" style={{ padding: '60px var(--space-4)', textAlign: 'center', maxWidth: '440px', margin: '60px auto' }}>
        <ShieldAlert size={48} style={{ color: '#C06C6C', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>Acesso Negado</h2>
        <p style={{ fontSize: '13.5px', color: 'var(--text-light)', marginTop: '8px', lineHeight: '1.6' }}>
          Esta área é restrita a administradores autorizados do Flowday. Seu usuário atual não possui permissões administrativas.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container animate-fade-in safe-area-inset" style={{ padding: '24px 16px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <BarChart3 size={24} style={{ color: 'var(--primary)' }} /> Flowday Admin V2
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-light)', marginTop: '4px' }}>Métricas analíticas consolidadas do Supabase (SaaS Analytics)</p>
        </div>
        {!selectedUser && (
          <button onClick={fetchGlobalMetrics} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            🔄 Recarregar Dados
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#FDE8E8', color: '#9B1C1C', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #F8B4B4' }}>
          <ShieldAlert size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div className="app-loading-spinner" style={{ margin: '0 auto 16px' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Calculando métricas SaaS no Supabase...</span>
        </div>
      ) : selectedUser && userDetails ? (
        // --- 6. INDIVIDUAL USER VIEW ---
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <button onClick={() => { setSelectedUser(null); setUserDetails(null); }} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              ⬅️ Voltar ao Dashboard Geral
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleExportCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', backgroundColor: 'var(--bg-card)' }}>
                <Download size={15} /> Exportar CSV
              </button>
            </div>
          </div>
          
          {/* User Profile Info Card */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>Detalhes do Beta Tester</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '10.5px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Identificação</span>
                <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '15px', marginTop: '4px' }}>{userDetails.email}</strong>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{selectedUser}</span>
              </div>
              <div>
                <span style={{ fontSize: '10.5px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Cadastro</span>
                <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '15px', marginTop: '4px' }}>{new Date(userDetails.created_at).toLocaleString('pt-BR')}</strong>
              </div>
              <div>
                <span style={{ fontSize: '10.5px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Último Acesso</span>
                <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '15px', marginTop: '4px' }}>{userDetails.last_access ? new Date(userDetails.last_access).toLocaleString('pt-BR') : 'Nunca'}</strong>
              </div>
              <div>
                <span style={{ fontSize: '10.5px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Engajamento Geral</span>
                <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '15px', marginTop: '4px' }}>{userDetails.active_days} dias ativos ({userDetails.sessions} eventos)</strong>
              </div>
            </div>
          </div>

          {/* User Specific SaaS Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Objetivos Criados', val: userDetails.goals_created, color: 'var(--text-main)', icon: <Target size={16} /> },
              { label: 'Objetivos Concluídos', val: userDetails.goals_completed, color: 'var(--primary)', icon: <CheckCircle2 size={16} /> },
              { label: 'Tarefas Criadas', val: userDetails.tasks_created, color: 'var(--text-main)', icon: <CheckSquare size={16} /> },
              { label: 'Tarefas Concluídas', val: userDetails.tasks_completed, color: 'var(--primary)', icon: <Award size={16} /> },
              { label: 'Taxa Conclusão', val: `${userDetails.completion_rate}%`, color: '#C89658', icon: <Flame size={16} /> },
              { label: 'Sessões Foco (Pomodoros)', val: userDetails.pomodoros, color: '#C06C6C', icon: <Flame size={16} /> },
              { label: 'Planos Semanais', val: userDetails.weekly_plans, color: '#5A6B7A', icon: <Calendar size={16} /> }
            ].map(card => (
              <div key={card.label} style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-light)', fontSize: '11px', fontWeight: '600' }}>
                  {card.icon} {card.label}
                </div>
                <strong style={{ fontSize: '20px', color: card.color }}>{card.val}</strong>
              </div>
            ))}
          </div>

          {/* Event Timeline & Filter */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>Timeline Completa de Ações</h3>
              
              {/* Period Filter */}
              <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-app)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
                {[
                  { key: '7d', label: '7 dias' },
                  { key: '30d', label: '30 dias' },
                  { key: 'all', label: 'Tudo' }
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setTimeFilter(opt.key)}
                    style={{
                      border: 0, padding: '6px 12px', fontSize: '11.5px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      backgroundColor: timeFilter === opt.key ? 'var(--bg-card)' : 'transparent',
                      color: timeFilter === opt.key ? 'var(--text-main)' : 'var(--text-light)',
                      fontWeight: timeFilter === opt.key ? '700' : '500'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingUser ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}><div className="app-loading-spinner" style={{ margin: '0 auto' }} /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '480px', overflowY: 'auto', paddingRight: '8px' }}>
                {userEvents.map(evt => (
                  <div key={evt.id} style={{ display: 'flex', gap: '16px', padding: '12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', width: '130px', flexShrink: 0 }}>
                      {new Date(evt.created_at).toLocaleString('pt-BR')}
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <span className="badge-category" style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
                        {evt.event_type}
                      </span>
                      {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                        <pre style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', backgroundColor: 'var(--bg-card)', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                          {JSON.stringify(evt.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
                {userEvents.length === 0 && (
                  <p style={{ color: 'var(--text-light)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>Nenhum evento neste período.</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        // --- 5. GLOBAL DASHBOARD VIEW ---
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Section 1: Growth / Users Cards */}
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)', marginBottom: '12px' }}>Usuários & Crescimento</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>Total de Usuários</span>
                <strong style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary)', display: 'block', margin: '6px 0' }}>{metrics.total_users}</strong>
                <div style={{ display: 'flex', gap: '10px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  <span>Ativos hoje: <strong>{metrics.active_today}</strong></span>
                  <span>•</span>
                  <span>7 dias: <strong>{metrics.active_7d}</strong></span>
                  <span>•</span>
                  <span>30 dias: <strong>{metrics.active_30d}</strong></span>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>Frequência & Aderência (Stickiness)</span>
                <strong style={{ fontSize: '28px', fontWeight: '800', color: '#5A6B7A', display: 'block', margin: '6px 0' }}>{metrics.stickiness_dau_mau}% <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)' }}>DAU/MAU</span></strong>
                <div style={{ display: 'flex', gap: '10px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  <span>DAU/WAU: <strong>{metrics.stickiness_dau_wau}%</strong></span>
                  <span>•</span>
                  <span>WAU: {metrics.active_7d}</span>
                  <span>•</span>
                  <span>MAU: {metrics.active_30d}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Activation & Retention Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>
            
            {/* Activation metrics */}
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--primary)' }} /> Ativação do Produto
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '10px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-light)', textTransform: 'uppercase', display: 'block' }}>Objetivos</span>
                  <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>{metrics.goal_created} <span style={{ fontSize: '11px', color: 'var(--primary)' }}>({metrics.goal_completed} ✓)</span></strong>
                </div>
                <div style={{ padding: '10px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-light)', textTransform: 'uppercase', display: 'block' }}>Tarefas</span>
                  <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>{metrics.task_created} <span style={{ fontSize: '11px', color: 'var(--primary)' }}>({metrics.task_completed} ✓)</span></strong>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-main)' }}>Taxa de Ativação Geral (Aha! Moment)</span>
                  <span style={{ color: 'var(--primary)' }}>{metrics.activation_rate}%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${metrics.activation_rate}%`, backgroundColor: 'var(--primary)' }} />
                </div>
              </div>
            </div>

            {/* Retention cohort simulation */}
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={16} style={{ color: 'var(--primary)' }} /> Retenção Cohort de Usuários
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Retenção D1 (24h)', val: metrics.retention_d1, color: 'var(--primary)' },
                  { label: 'Retenção D7 (1 semana)', val: metrics.retention_d7, color: '#C89658' },
                  { label: 'Retenção D30 (1 mês)', val: metrics.retention_d30, color: '#C06C6C' }
                ].map(cohort => (
                  <div key={cohort.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: '600', marginBottom: '2px' }}>
                      <span style={{ color: 'var(--text-main)' }}>{cohort.label}</span>
                      <span style={{ color: cohort.color }}>{cohort.val}%</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${cohort.val}%`, backgroundColor: cohort.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Section 3: Feature Engagement */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '16px' }}>Engajamento de Recursos (Feature Usage)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {[
                { title: 'Pomodoros Concluídos', value: metrics.focus_completed, color: '#C06C6C', emoji: '⏱️' },
                { title: 'Planejamentos Semanais', value: metrics.weekly_plans, color: '#5A6B7A', emoji: '🗓️' },
                { title: 'Tarefas no Calendário', value: metrics.calendar_tasks, color: '#B09E86', emoji: '📆' },
                { title: 'Hábitos Concluídos', value: metrics.habits_completed, color: '#7A8B7B', emoji: '✓' }
              ].map(feat => (
                <div key={feat.title} style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>{feat.emoji}</span>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-light)', display: 'block' }}>{feat.title}</span>
                    <strong style={{ fontSize: '18px', color: feat.color }}>{feat.value}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Monetization SaaS */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Star size={16} style={{ color: '#C89658' }} /> Monetização & Funil SaaS
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-light)', display: 'block' }}>MRR (Mensal Recorrente)</span>
                <strong style={{ fontSize: '22px', color: '#C89658' }}>R$ {metrics.mrr.toFixed(2)}</strong>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>ARR Anual: R$ {metrics.arr.toFixed(2)}</span>
              </div>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-light)', display: 'block' }}>Conversão de Paywall</span>
                <strong style={{ fontSize: '22px', color: 'var(--primary)' }}>{metrics.monetization_conversion}%</strong>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Views: {metrics.paywall_views} · Upgrade Clicks: {metrics.upgrade_clicks}</span>
              </div>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-light)', display: 'block' }}>Taxa de Evasão (Churn)</span>
                <strong style={{ fontSize: '22px', color: '#C06C6C' }}>{metrics.churn}%</strong>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Perda mensal estimada</span>
              </div>
            </div>
          </div>

          {/* Section 5: Users Directory */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '16px' }}>Diretório de Beta Testers</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '500px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-light)' }}>
                    <th style={{ padding: '12px' }}>Usuário / E-mail</th>
                    <th style={{ padding: '12px' }}>Data de Cadastro</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(profile => (
                    <tr key={profile.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px', color: 'var(--text-main)' }}>
                        <div style={{ fontWeight: '600' }}>{profile.name || 'Sem e-mail'}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{profile.id}</div>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-main)' }}>
                        {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button onClick={() => handleUserClick(profile.id)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12.5px', borderRadius: '4px' }}>
                          Ver Histórico
                        </button>
                      </td>
                    </tr>
                  ))}
                  {profiles.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-light)' }}>Nenhum beta tester localizado no Supabase.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
