import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Users, Star, BarChart3, TrendingUp, ShieldAlert, CheckCircle2, 
  ChevronRight, Download, Filter, Calendar, Award, CheckSquare, Target, Flame, 
  Activity, ArrowLeft, ArrowRight, UserCheck, DollarSign, Clock, HelpCircle
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';

export default function AdminDashboard() {
  const { isAdmin, currentUser } = useAppContext();
  
  // States
  const [adminUsers, setAdminUsers] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [userEvents, setUserEvents] = useState([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState(null);
  
  // Navigation tabs for the admin dashboard
  const [activeAdminTab, setActiveAdminTab] = useState('metrics'); // 'metrics' | 'users' | 'funnels'
  
  // Filters for individual user timeline
  const [timeFilter, setTimeFilter] = useState('all'); // '7d' | '30d' | 'all'
  const [eventCategoryFilter, setEventCategoryFilter] = useState('all'); // 'all' | 'onboarding' | 'goals' | 'tasks' | 'focus' | 'monetization' | 'sessions'

  // Users Directory search, sort, filter and pagination states
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all'); // 'all' | 'pro' | 'free'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'canceled' | 'inactive'
  const [userSortKey, setUserSortKey] = useState('created_at'); // 'email' | 'created_at' | 'last_login' | 'total_events'
  const [userSortOrder, setUserSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Process and memoize users list with filters and sorting
  const processedUsers = useMemo(() => {
    let result = [...adminUsers];

    // Search by email, id, plan or registration date
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase().trim();
      result = result.filter(u => 
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.id && u.id.toLowerCase().includes(q)) ||
        (u.plan && u.plan.toLowerCase().includes(q)) ||
        (u.created_at && new Date(u.created_at).toLocaleDateString('pt-BR').includes(q))
      );
    }

    // Filter by plan
    if (planFilter !== 'all') {
      result = result.filter(u => u.plan === planFilter);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(u => u.status === statusFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let valA = a[userSortKey];
      let valB = b[userSortKey];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return userSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return userSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [adminUsers, userSearchQuery, planFilter, statusFilter, userSortKey, userSortOrder]);

  // Paginated users
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [processedUsers, currentPage]);

  const totalPages = Math.max(Math.ceil(processedUsers.length / itemsPerPage), 1);

  // Reset page when filters/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [userSearchQuery, planFilter, statusFilter]);

  // Fetch Global Summary Metrics & Users List (Single Source of Truth: SQL RPCs)
  const fetchGlobalData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch metrics from get_admin_dashboard_metrics
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_admin_dashboard_metrics');
      
      if (!rpcErr && rpcData) {
        setMetrics(rpcData);
      } else {
        console.error('[AdminDashboard] get_admin_dashboard_metrics failed:', rpcErr);
        setError('Falha ao carregar as métricas analíticas consolidada do banco de dados.');
        setMetrics(null);
      }

      // 2. Fetch users list from get_admin_users_list
      const { data: usersData, error: usersErr } = await supabase.rpc('get_admin_users_list');
      if (!usersErr && usersData) {
        setAdminUsers(usersData);
      } else {
        console.error('[AdminDashboard] get_admin_users_list failed:', usersErr);
        if (!error) {
          setError('Falha ao obter o diretório de usuários do banco.');
        }
      }
    } catch (err) {
      console.error('[AdminDashboard] Error fetching admin data:', err);
      setError('Erro de conexão ao carregar dados do painel administrativo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchGlobalData();
    }
  }, [isAdmin]);

  // Fetch Individual User Details (Single Source of Truth: SQL RPC Only)
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
      setError('Erro de conexão ao carregar a timeline do usuário.');
      setUserDetails(null);
    } finally {
      setLoadingUser(false);
    }
  };

  // Re-fetch user timeline when filter changes
  useEffect(() => {
    if (selectedUser) {
      handleUserClick(selectedUser);
    }
  }, [timeFilter]);

  // Filter user events locally based on eventCategoryFilter
  const filteredUserEvents = useMemo(() => {
    if (eventCategoryFilter === 'all') return userEvents;
    
    return userEvents.filter(evt => {
      const type = evt.event_type;
      switch (eventCategoryFilter) {
        case 'onboarding':
          return type.includes('onboarding');
        case 'goals':
          return type.includes('goal') || type.includes('habit');
        case 'tasks':
          return type.includes('task');
        case 'focus':
          return type.includes('focus') || type.includes('pomodoro') || type.includes('break');
        case 'monetization':
          return type.includes('upgrade') || type.includes('downgrade') || type.includes('paywall') || type.includes('subscription') || type.includes('trial') || type.includes('payment');
        case 'sessions':
          return type.includes('session') || type.includes('login') || type.includes('logout') || type.includes('signed_up');
        default:
          return true;
      }
    });
  }, [userEvents, eventCategoryFilter]);

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

  // Helper to color-code user timeline events
  const getEventBadgeStyles = (type) => {
    if (type.includes('completed') || type.includes('success') || type.includes('succeeded') || type.includes('done')) {
      return { backgroundColor: '#DEF7EC', color: '#03543F' };
    }
    if (type.includes('started') || type.includes('created') || type.includes('scheduled')) {
      return { backgroundColor: '#E1EFFE', color: '#1E429F' };
    }
    if (type.includes('paused') || type.includes('resumed') || type.includes('moved') || type.includes('updated')) {
      return { backgroundColor: '#FEF08A', color: '#713F12' };
    }
    if (type.includes('failed') || type.includes('cancelled') || type.includes('deleted') || type.includes('abandoned') || type.includes('error')) {
      return { backgroundColor: '#FDE8E8', color: '#9B1C1C' };
    }
    return { backgroundColor: '#F3F4F6', color: '#374151' };
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
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', margin: 0 }}>
            <BarChart3 size={24} style={{ color: 'var(--primary)' }} /> Flowday Admin Dashboard V3
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-light)', marginTop: '4px', margin: 0 }}>Métricas analíticas consolidadas e auditoria de usuários em tempo real.</p>
        </div>
        {!selectedUser && (
          <button onClick={fetchGlobalData} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius-md)' }}>
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
        // --- INDIVIDUAL USER VIEW ---
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <button onClick={() => { setSelectedUser(null); setUserDetails(null); }} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              ⬅️ Voltar ao Dashboard Geral
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleExportCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', backgroundColor: 'var(--bg-card)' }}>
                <Download size={15} /> Exportar Histórico (CSV)
              </button>
            </div>
          </div>
          
          {/* User Profile Info Card */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Perfil do Beta Tester</h2>
              {adminUsers.find(u => u.id === selectedUser)?.plan === 'pro' ? (
                <span className="badge-category" style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '99px', backgroundColor: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D' }}>PRO</span>
              ) : (
                <span className="badge-category" style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '99px', backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #E5E7EB' }}>GRÁTIS</span>
              )}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '10.5px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Identificação</span>
                <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '15px', marginTop: '4px', wordBreak: 'break-all' }}>{userDetails.email}</strong>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{selectedUser}</span>
              </div>
              <div>
                <span style={{ fontSize: '10.5px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Cadastro</span>
                <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '15px', marginTop: '4px' }}>{userDetails?.created_at ? new Date(userDetails.created_at).toLocaleString('pt-BR') : '-'}</strong>
              </div>
              <div>
                <span style={{ fontSize: '10.5px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Último Acesso</span>
                <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '15px', marginTop: '4px' }}>{userDetails?.last_access ? new Date(userDetails.last_access).toLocaleString('pt-BR') : 'Nunca'}</strong>
              </div>
              <div>
                <span style={{ fontSize: '10.5px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Engajamento Geral</span>
                <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '15px', marginTop: '4px' }}>{userDetails?.active_days ?? 0} dias ativos ({userDetails?.sessions ?? 0} sessões)</strong>
              </div>
            </div>
          </div>

          {/* User Specific SaaS Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Objetivos Criados', val: userDetails?.goals_created ?? 0, color: 'var(--text-main)', icon: <Target size={16} /> },
              { label: 'Objetivos Concluídos', val: userDetails?.goals_completed ?? 0, color: 'var(--primary)', icon: <CheckCircle2 size={16} /> },
              { label: 'Tarefas Criadas', val: userDetails?.tasks_created ?? 0, color: 'var(--text-main)', icon: <CheckSquare size={16} /> },
              { label: 'Tarefas Concluídas', val: userDetails?.tasks_completed ?? 0, color: 'var(--primary)', icon: <Award size={16} /> },
              { label: 'Taxa Conclusão', val: `${userDetails?.completion_rate ?? 0}%`, color: '#C89658', icon: <Activity size={16} /> },
              { label: 'Sessões Foco', val: userDetails?.pomodoros ?? 0, color: '#C06C6C', icon: <Flame size={16} /> },
              { label: 'Planos Semanais', val: userDetails?.weekly_plans ?? 0, color: '#5A6B7A', icon: <Calendar size={16} /> }
            ].map(card => (
              <div key={card.label} style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-light)', fontSize: '11px', fontWeight: '600' }}>
                  {card.icon} {card.label}
                </div>
                <strong style={{ fontSize: '20px', color: card.color }}>{card.val}</strong>
              </div>
            ))}
          </div>

          {/* Event Timeline & Filter */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>Timeline Cronológica de Eventos</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-light)', margin: '4px 0 0 0' }}>Mostrando {filteredUserEvents.length} eventos filtrados</p>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {/* Period Filter */}
                <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-app)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}>
                  {[
                    { key: '7d', label: '7d' },
                    { key: '30d', label: '30d' },
                    { key: 'all', label: 'Tudo' }
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setTimeFilter(opt.key)}
                      style={{
                        border: 0, padding: '4px 10px', fontSize: '11px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
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
            </div>

            {/* Event Category Selector (V3) */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px dashed var(--border-light)' }}>
              {[
                { key: 'all', label: 'Todos' },
                { key: 'onboarding', label: 'Onboarding' },
                { key: 'goals', label: 'Objetivos/Hábitos' },
                { key: 'tasks', label: 'Tarefas/Calendário' },
                { key: 'focus', label: 'Foco/Pomodoro' },
                { key: 'monetization', label: 'Assinatura/Paywall' },
                { key: 'sessions', label: 'Login/Sessões' }
              ].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setEventCategoryFilter(cat.key)}
                  style={{
                    padding: '6px 12px', fontSize: '11.5px', borderRadius: '20px', cursor: 'pointer',
                    border: '1px solid',
                    backgroundColor: eventCategoryFilter === cat.key ? 'var(--primary)' : 'var(--bg-card)',
                    borderColor: eventCategoryFilter === cat.key ? 'var(--primary)' : 'var(--border-medium)',
                    color: eventCategoryFilter === cat.key ? '#FFF' : 'var(--text-main)',
                    fontWeight: eventCategoryFilter === cat.key ? '700' : '500',
                    transition: 'all 0.15s'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {loadingUser ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}><div className="app-loading-spinner" style={{ margin: '0 auto' }} /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '480px', overflowY: 'auto', paddingRight: '8px' }}>
                {filteredUserEvents.map(evt => {
                  const badgeStyle = getEventBadgeStyles(evt.event_type);
                  return (
                    <div key={evt.id} style={{ display: 'flex', gap: '16px', padding: '12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', width: '130px', flexShrink: 0, fontWeight: '600' }}>
                        {new Date(evt.created_at).toLocaleString('pt-BR')}
                      </div>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <span className="badge-category" style={{ fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '4px', letterSpacing: '0.03em', ...badgeStyle }}>
                          {evt.event_type}
                        </span>
                        {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                          <pre style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', backgroundColor: 'var(--bg-card)', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', overflowX: 'auto' }}>
                            {JSON.stringify(evt.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredUserEvents.length === 0 && (
                  <p style={{ color: 'var(--text-light)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>Nenhum evento localizado para o filtro selecionado.</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        // --- GLOBAL DASHBOARD VIEW ---
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Main Navigation Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-medium)', gap: '16px', marginBottom: '8px' }}>
            {[
              { id: 'metrics', label: '📊 Métricas SaaS', icon: <BarChart size={16} /> },
              { id: 'users', label: '👥 Diretório de Usuários', icon: <Users size={16} /> },
              { id: 'funnels', label: '🎯 Funis de Conversão', icon: <Target size={16} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveAdminTab(tab.id)}
                style={{
                  padding: '12px 16px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  color: activeAdminTab === tab.id ? 'var(--primary)' : 'var(--text-light)',
                  borderBottom: activeAdminTab === tab.id ? '3px solid var(--primary)' : '3px solid transparent',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: 0,
                  transition: 'all 0.15s'
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {activeAdminTab === 'metrics' && (
            <>
              {/* SaaS Revenue Metrics */}
              <div>
                <h2 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={14} style={{ color: '#D97706' }} /> Receita & Finanças SaaS
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>MRR (Recorrência Mensal)</span>
                    <strong style={{ fontSize: '26px', fontWeight: '800', color: '#D97706', display: 'block', margin: '6px 0' }}>R$ {(metrics?.mrr || 0).toFixed(2)}</strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>ARR Estimado: <strong>R$ {(metrics?.arr || 0).toFixed(2)}</strong></span>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>ARPU (Receita Média por Usuário)</span>
                    <strong style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', display: 'block', margin: '6px 0' }}>R$ {(metrics?.arpu || 0).toFixed(2)}</strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Média ponderada por assinante ativo</span>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>LTV Estimado (Valor de Vida Util)</span>
                    <strong style={{ fontSize: '26px', fontWeight: '800', color: 'var(--primary)', display: 'block', margin: '6px 0' }}>{metrics?.ltv_estimado ? `R$ ${metrics.ltv_estimado.toFixed(2)}` : 'N/A'}</strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>LTV = ARPU / Churn Rate</span>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>Taxa de Evasão (Churn)</span>
                    <strong style={{ fontSize: '26px', fontWeight: '800', color: '#DC2626', display: 'block', margin: '6px 0' }}>{metrics?.churn !== null ? `${metrics.churn}%` : '0%'}</strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Cancelamento total acumulado</span>
                  </div>
                </div>
              </div>

              {/* Ratios & Retention */}
              <div>
                <h2 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={14} style={{ color: 'var(--primary)' }} /> Relações de Engajamento & Retenção
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>Frequência (Stickiness) DAU / MAU</span>
                    <strong style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', display: 'block', margin: '6px 0' }}>{metrics?.stickiness_dau_mau || 0}%</strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>DAU / WAU: <strong>{metrics?.stickiness_dau_wau || 0}%</strong></span>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>Taxa de Ativação (Aha! Moment)</span>
                    <strong style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)', display: 'block', margin: '6px 0' }}>{metrics?.activation_rate || 0}%</strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Fração de usuários que completaram 1 tarefa</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>Retenção de Cohorts (Cadastrados)</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', marginTop: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>D1 (Próximas 24h):</span> <strong>{metrics?.retention_d1 || 0}%</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>D7 (1 Semana):</span> <strong>{metrics?.retention_d7 || 0}%</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>D30 (1 Mês):</span> <strong>{metrics?.retention_d30 || 0}%</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>Sessões & Foco Médio</span>
                    <strong style={{ fontSize: '24px', fontWeight: '800', color: '#C06C6C', display: 'block', margin: '6px 0' }}>{metrics?.sessions_per_user || 0} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>sessões/user</span></strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Foco Médio: <strong>{metrics?.avg_focus_time || 0} min</strong></span>
                  </div>
                </div>
              </div>

              {/* Active Users Summary */}
              <div>
                <h2 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={14} style={{ color: 'var(--primary)' }} /> Volume de Usuários
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  {[
                    { label: 'Total Registrado', val: metrics?.total_users, color: 'var(--text-main)', sub: 'Profiles no Supabase' },
                    { label: 'DAU (Ativos Hoje)', val: metrics?.active_today, color: 'var(--primary)', sub: 'Eventos nas últimas 24h' },
                    { label: 'WAU (Ativos 7 Dias)', val: metrics?.active_7d, color: '#D97706', sub: 'Eventos nos últimos 7 dias' },
                    { label: 'MAU (Ativos 30 Dias)', val: metrics?.active_30d, color: '#C06C6C', sub: 'Eventos nos últimos 30 dias' }
                  ].map(usr => (
                    <div key={usr.label} style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: 'var(--shadow-sm)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '600' }}>{usr.label}</span>
                      <strong style={{ fontSize: '24px', color: usr.color }}>{usr.val}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{usr.sub}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature Usage Overview */}
              <div>
                <h2 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Award size={14} style={{ color: 'var(--primary)' }} /> Uso de Recursos (Engajamento)
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  {[
                    { title: 'Tarefas Criadas', value: metrics?.task_created, sub: `${metrics?.task_completed} concluídas`, emoji: '💼' },
                    { title: 'Metas Criadas', value: metrics?.goal_created, sub: `${metrics?.goal_completed} concluídas`, emoji: '🎯' },
                    { title: 'Pomodoros Concluídos', value: metrics?.focus_completed, sub: 'Ciclos de foco', emoji: '⏱️' },
                    { title: 'Planejamentos', value: metrics?.weekly_plans, sub: 'Planos Semanais salvos', emoji: '🗓️' },
                    { title: 'Agenda Calendário', value: metrics?.calendar_tasks, sub: 'Tarefas no calendário', emoji: '📆' },
                    { title: 'Hábitos Concluídos', value: metrics?.habits_completed, sub: 'Dias com hábitos confirmados', emoji: '🌱' }
                  ].map(feat => (
                    <div key={feat.title} style={{ padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'var(--shadow-sm)' }}>
                      <span style={{ fontSize: '24px' }}>{feat.emoji}</span>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-light)', display: 'block', fontWeight: '600' }}>{feat.title}</span>
                        <strong style={{ fontSize: '18px', color: 'var(--text-main)' }}>{feat.value || 0}</strong>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>{feat.sub}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeAdminTab === 'users' && (
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Diretório Completo de Beta Testers</h3>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-light)' }}>Mostrando {processedUsers.length} de {adminUsers.length} usuários</span>
                </div>
              </div>

              {/* Search and Filters Controls */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}>
                {/* Search Bar */}
                <div style={{ flex: '1 1 240px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase' }}>Buscar Usuários</label>
                  <input
                    type="text"
                    placeholder="Buscar por email, id, plano, data..."
                    value={userSearchQuery}
                    onChange={e => setUserSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>

                {/* Plan Filter */}
                <div style={{ width: '120px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase' }}>Plano</label>
                  <select
                    value={planFilter}
                    onChange={e => setPlanFilter(e.target.value)}
                    style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="all">Todos</option>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div style={{ width: '130px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase' }}>Status</label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="all">Todos</option>
                    <option value="active">Ativo</option>
                    <option value="canceled">Cancelado</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>

                {/* Sort Key */}
                <div style={{ width: '160px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase' }}>Ordenar Por</label>
                  <select
                    value={userSortKey}
                    onChange={e => setUserSortKey(e.target.value)}
                    style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="created_at">Data de Cadastro</option>
                    <option value="email">E-mail</option>
                    <option value="last_login">Último Acesso</option>
                    <option value="total_events">Total Eventos</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div style={{ width: '100px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase' }}>Ordem</label>
                  <select
                    value={userSortOrder}
                    onChange={e => setUserSortOrder(e.target.value)}
                    style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="desc">Decrescente</option>
                    <option value="asc">Crescente</option>
                  </select>
                </div>
              </div>
              
              {/* Users Table */}
              <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '800px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-light)' }}>
                      <th style={{ padding: '12px' }}>Usuário / E-mail</th>
                      <th style={{ padding: '12px' }}>Cadastro</th>
                      <th style={{ padding: '12px' }}>Último Acesso</th>
                      <th style={{ padding: '12px' }}>Plano</th>
                      <th style={{ padding: '12px' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Eventos Totais</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map(usr => (
                      <tr key={usr.id} style={{ borderBottom: '1px solid var(--border-light)', hover: { backgroundColor: 'var(--bg-app)' } }}>
                        <td style={{ padding: '12px' }}>
                           <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{usr.email}</div>
                           <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {usr.id}</div>
                           {usr.nickname && <div style={{ fontSize: '11px', color: 'var(--text-light)', fontStyle: 'italic' }}>Nome: {usr.nickname}</div>}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-main)' }}>
                          {usr.created_at ? new Date(usr.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-main)' }}>
                          {usr.last_login ? new Date(usr.last_login).toLocaleString('pt-BR') : 'Nunca'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {usr.plan === 'pro' ? (
                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D' }}>PRO</span>
                          ) : (
                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#E5E7EB', color: '#4B5563' }}>FREE</span>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {usr.status === 'active' ? (
                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#DEF7EC', color: '#03543F' }}>ATIVO</span>
                          ) : usr.status === 'canceled' ? (
                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FDE8E8', color: '#9B1C1C' }}>CANCELADO</span>
                          ) : (
                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#F3F4F6', color: '#9CA3AF' }}>INATIVO</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: 'var(--text-main)' }}>
                          {usr.total_events}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button onClick={() => handleUserClick(usr.id)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-sm)' }}>
                            Ver Usuário
                          </button>
                        </td>
                      </tr>
                    ))}
                    {paginatedUsers.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-light)' }}>Nenhum usuário localizado para os filtros selecionados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="btn-secondary"
                    style={{ fontSize: '12px', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ◀️ Anterior
                  </button>
                  <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                    Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="btn-secondary"
                    style={{ fontSize: '12px', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Próxima ▶️
                  </button>
                </div>
              )}
            </div>
          )}

          {activeAdminTab === 'funnels' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              
              {/* Onboarding Funnel Visualizer */}
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={16} style={{ color: 'var(--primary)' }} /> Funil de Onboarding
                </h3>
                
                {metrics && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { step: 'Início (onboarding_started)', val: metrics.onboarding_started, pct: 100 },
                      { step: 'Passo 1 (Criação de Meta)', val: metrics.onboarding_step1, pct: metrics.onboarding_started > 0 ? Math.round((metrics.onboarding_step1 / metrics.onboarding_started) * 100) : 0 },
                      { step: 'Passo 2 (Criação de Tarefa)', val: metrics.onboarding_step2, pct: metrics.onboarding_started > 0 ? Math.round((metrics.onboarding_step2 / metrics.onboarding_started) * 100) : 0 },
                      { step: 'Passo 3 (Criação de Hábito)', val: metrics.onboarding_step3, pct: metrics.onboarding_started > 0 ? Math.round((metrics.onboarding_step3 / metrics.onboarding_started) * 100) : 0 },
                      { step: 'Passo 4 (Evolução Visualizada)', val: metrics.onboarding_step4, pct: metrics.onboarding_started > 0 ? Math.round((metrics.onboarding_step4 / metrics.onboarding_started) * 100) : 0 },
                      { step: 'Conclusão (onboarding_completed)', val: metrics.onboarding_completed, pct: metrics.onboarding_started > 0 ? Math.round((metrics.onboarding_completed / metrics.onboarding_started) * 100) : 0 }
                    ].map((stepObj, index) => (
                      <div key={index}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>
                          <span>{stepObj.step}</span>
                          <span>{stepObj.val} users ({stepObj.pct}%)</span>
                        </div>
                        <div style={{ height: '18px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ height: '100%', width: `${stepObj.pct}%`, backgroundColor: 'var(--primary)', opacity: 0.85, transition: 'width 0.5s ease-out' }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '12.5px', color: 'var(--text-light)' }}>
                      Taxa de Conclusão Final do Onboarding: <strong>{metrics.onboarding_started > 0 ? Math.round((metrics.onboarding_completed / metrics.onboarding_started) * 100) : 0}%</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Conversion Funnel Visualizer */}
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Star size={16} style={{ color: '#D97706' }} /> Funil de Conversão Free → Pro
                </h3>
                
                {metrics && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { step: '1. Visualizações da Paywall', val: metrics.paywall_views, pct: 100 },
                      { step: '2. Cliques em Upgrade', val: metrics.upgrade_clicks, pct: metrics.paywall_views > 0 ? Math.round((metrics.upgrade_clicks / metrics.paywall_views) * 100) : 0 },
                      { step: '3. Assinantes Ativos (PRO)', val: adminUsers.filter(u => u.plan === 'pro').length, pct: metrics.paywall_views > 0 ? Math.round((adminUsers.filter(u => u.plan === 'pro').length / metrics.paywall_views) * 100) : 0 }
                    ].map((stepObj, index) => (
                      <div key={index}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>
                          <span>{stepObj.step}</span>
                          <span>{stepObj.val} ({stepObj.pct}%)</span>
                        </div>
                        <div style={{ height: '18px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${stepObj.pct}%`, backgroundColor: '#D97706', opacity: 0.85, transition: 'width 0.5s ease-out' }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '12.5px', color: 'var(--text-light)' }}>
                      Taxa de Conversão do Funil (Assinatura/Paywall): <strong>{metrics.monetization_conversion}%</strong>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  );
}
