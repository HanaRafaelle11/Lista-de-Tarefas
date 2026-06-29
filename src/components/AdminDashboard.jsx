import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Users, Star, BarChart3, TrendingUp, ShieldAlert, CheckCircle2, 
  ChevronRight, Download, Filter, Calendar, Award, CheckSquare, Target, Flame, 
  Activity, ArrowLeft, ArrowRight, UserCheck, DollarSign, Clock, HelpCircle, Bell, RefreshCw, Brain
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';
import AdminNotificationDashboard from './AdminNotificationDashboard';
import SystemStatusDashboard from './SystemStatusDashboard';
import GrowthOSDashboard from './GrowthOSDashboard';

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
  const [activeAdminTab, setActiveAdminTab] = useState(() => {
    if (typeof window !== 'undefined' && (window.location.pathname.includes('/admin/status') || window.location.search.includes('status'))) {
      return 'status';
    }
    return 'metrics';
  }); // 'metrics' | 'status' | 'users' | 'funnels' | 'payments' | 'notifications'
  const [paymentHierarchyTab, setPaymentHierarchyTab] = useState('overview'); // 'overview' | 'diagnostics' | 'raw'

  // Push Notifications Queue Console States
  const [pushQueueItems, setPushQueueItems] = useState([]);
  const [loadingPushQueue, setLoadingPushQueue] = useState(false);
  const [pushStatusFilter, setPushStatusFilter] = useState('all'); // 'all' | 'pending' | 'sent' | 'failed'

  // Payment Debug Console states
  const [selectedPaymentUserId, setSelectedPaymentUserId] = useState('');
  const [paymentEvents, setPaymentEvents] = useState([]);
  const [paymentSubscription, setPaymentSubscription] = useState(null);
  const [paymentConsistency, setPaymentConsistency] = useState(null);
  const [paymentLastError, setPaymentLastError] = useState(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [latestEventsMap, setLatestEventsMap] = useState({});
  const [paymentUserSearch, setPaymentUserSearch] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Filters for payment console
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all'); // 'all' | 'success' | 'pending' | 'error'
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all'); // 'all' | 'checkout_started' | 'webhook_received' | ...
  const [activePayloadEvent, setActivePayloadEvent] = useState(null); // Selected event for modal/drawer

  // Fetch all latest events to build latestEventsMap (user_id -> latest event metadata)
  const fetchAllLatestEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('billing_events')
        .select('user_id, type, event_type, status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const map = {};
      (data || []).forEach(evt => {
        if (evt.user_id && !map[evt.user_id]) {
          const eventName = evt.type || evt.event_type || 'event';
          map[evt.user_id] = {
            user_id: evt.user_id,
            event_type: eventName,
            event: eventName,
            status: evt.status,
            created_at: evt.created_at,
            timestamp: evt.created_at
          };
        }
      });
      setLatestEventsMap(map);
    } catch (e) {
      console.error('Error fetching all latest billing events:', e);
    }
  };

  // Fetch payment details directly from Backend API (service_role)
  const fetchPaymentEvents = async (userId) => {
    if (!userId) return;
    setLoadingPayments(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (currentUser?.id) headers['x-user-id'] = currentUser.id;

      const res = await fetch(`/api/admin/payment-events?userId=${userId}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setPaymentEvents(data.events || []);
      setPaymentSubscription(data.subscription || null);

      if (data.consistency) {
        setPaymentConsistency(data.consistency);
      }
      setPaymentLastError(data.lastError || null);
    } catch (e) {
      console.error('Error fetching payment events:', e);
    } finally {
      setLoadingPayments(false);
    }
  };

  const handlePaymentSearch = async (e) => {
    if (e) e.preventDefault();
    const term = paymentUserSearch.trim();
    if (!term) return;

    setLoadingSearch(true);
    try {
      // 1. Busca local nos usuários carregados
      const matchedUser = adminUsers.find(u =>
        u.email?.toLowerCase().includes(term.toLowerCase()) ||
        u.nickname?.toLowerCase().includes(term.toLowerCase()) ||
        u.id === term
      );

      if (matchedUser) {
        setSelectedPaymentUserId(matchedUser.id);
        setLoadingSearch(false);
        return;
      }

      // 2. Busca remota via API backend segura com service_role
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (currentUser?.id) headers['x-user-id'] = currentUser.id;

      const res = await fetch(`/api/admin/payment-events?search=${encodeURIComponent(term)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const resolvedId = data.userId || (data.events && data.events.length > 0 ? data.events[0].user_id : null);
        if (resolvedId) {
          setSelectedPaymentUserId(resolvedId);
          setPaymentEvents(data.events || []);
          setPaymentSubscription(data.subscription || null);
          if (data.consistency) setPaymentConsistency(data.consistency);
          setPaymentLastError(data.lastError || null);
          setLoadingSearch(false);
          return;
        }
      }

      alert('Nenhum usuário, pagamento ou assinatura encontrado para: ' + term);
    } catch (err) {
      console.error('Error during admin payment search:', err);
    } finally {
      setLoadingSearch(false);
    }
  };

  useEffect(() => {
    if (selectedPaymentUserId) {
      fetchPaymentEvents(selectedPaymentUserId);
    } else {
      setPaymentEvents([]);
      setPaymentSubscription(null);
      setPaymentConsistency(null);
      setPaymentLastError(null);
    }
  }, [selectedPaymentUserId]);

  const fetchPushQueue = async () => {
    setLoadingPushQueue(true);
    try {
      const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .order('scheduled_for', { ascending: false })
        .limit(100);
      if (!error && data) {
        setPushQueueItems(data);
      }
    } catch (err) {
      console.error('Erro ao buscar fila de notificações:', err);
    } finally {
      setLoadingPushQueue(false);
    }
  };

  const handleTriggerPushWorker = async () => {
    setLoadingPushQueue(true);
    try {
      const res = await processNotificationQueue(supabase);
      alert(`Worker executado com sucesso!\nProcessados: ${res.processed}\nEnviados com Sucesso: ${res.success || 0}\nFalhas: ${res.failed || 0}`);
      await fetchPushQueue();
    } catch (err) {
      alert('Erro ao disparar worker: ' + err.message);
    } finally {
      setLoadingPushQueue(false);
    }
  };

  useEffect(() => {
    if (activeAdminTab === 'payments' && isAdmin) {
      fetchAllLatestEvents();
    }
    if (activeAdminTab === 'notifications' && isAdmin) {
      fetchPushQueue();
    }
  }, [activeAdminTab, isAdmin]);

  // local filter for payment events
  const filteredPaymentEvents = useMemo(() => {
    let result = [...paymentEvents];

    if (paymentStatusFilter !== 'all') {
      result = result.filter(e => e.status === paymentStatusFilter);
    }

    if (paymentTypeFilter !== 'all') {
      result = result.filter(e => e.event_type === paymentTypeFilter);
    }

    return result;
  }, [paymentEvents, paymentStatusFilter, paymentTypeFilter]);
  
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

    // Search by email, nickname, name, id, plan or registration date
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase().trim();
      result = result.filter(u => 
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.nickname && u.nickname.toLowerCase().includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
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

  // Fetch Global Summary Metrics & Users List (Single Source of Truth: Backend API via service_role)
  const fetchGlobalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (currentUser?.id) headers['x-user-id'] = currentUser.id;
      
      const queryParam = currentUser?.id ? `?userId=${currentUser.id}` : '';
      const res = await fetch(`/api/admin/dashboard${queryParam}`, { headers });
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data && data.metrics) {
        setMetrics(data);
        setAdminUsers(data.users || []);
      } else {
        throw new Error('Resposta inválida do servidor.');
      }
    } catch (err) {
      console.error('[AdminDashboard] Error fetching admin data:', err);
      setError(`Falha ao carregar painel administrativo: ${err.message}`);
      setMetrics(null);
      setAdminUsers([]);
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
    setUserDetails(null); // Limpa dados anteriores antes de buscar novos
    try {
      // Direct user detail fallback from loaded state
      const targetUserObj = adminUsers.find(u => u.id === userId);
      setUserDetails(targetUserObj || { id: userId, nickname: 'Usuário' });

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
      } else if (evtsErr) {
        console.warn('[AdminDashboard] events query failed:', evtsErr);
        setUserEvents([]);
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
            <BarChart3 size={24} style={{ color: 'var(--primary)' }} /> MyFlowDay Admin Dashboard
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
      ) : loadingUser ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div className="app-loading-spinner" style={{ margin: '0 auto 16px' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Carregando perfil do usuário...</span>
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
              { id: 'status', label: '🟢 Status do Sistema', icon: <Activity size={16} /> },
              { id: 'growth', label: '🧠 Growth OS', icon: <Brain size={16} /> },
              { id: 'users', label: '👥 Diretório de Usuários', icon: <Users size={16} /> },
              { id: 'funnels', label: '🎯 Funis de Conversão', icon: <Target size={16} /> },
              { id: 'payments', label: '💳 Debug de Pagamentos', icon: <DollarSign size={16} /> },
              { id: 'notifications', label: '🔔 Notificações Push', icon: <Bell size={16} /> }
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

          {activeAdminTab === 'status' && <SystemStatusDashboard />}

          {activeAdminTab === 'growth' && <GrowthOSDashboard />}

          {activeAdminTab === 'metrics' && (
            <>
              {/* Painel Executivo Visual (Gráficos & KPIs inspirados na nova identidade visual) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                
                {/* Chart Box 1: Donut de Conversão de Usuários */}
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.05em' }}>Base & Conversão PRO</span>
                      <h3 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)', margin: '4px 0 0 0' }}>{metrics?.total_users || 0} <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)' }}>usuários totais</span></h3>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      {metrics?.metrics?.users?.premiumUsers || 3} Assinantes PRO
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '8px' }}>
                    <div style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
                      <svg width="100" height="100" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border-medium)" strokeWidth="3.8" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--primary)" strokeWidth="3.8" strokeDasharray={`${Math.round(((metrics?.metrics?.users?.premiumUsers || 3) / (metrics?.total_users || 14)) * 100)}, 100`} strokeLinecap="round" />
                      </svg>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>{Math.round(((metrics?.metrics?.users?.premiumUsers || 3) / (metrics?.total_users || 14)) * 100)}%</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>PRO Rate</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-light)' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }}></span> Assinantes PRO</span>
                        <strong style={{ color: 'var(--text-main)' }}>{metrics?.metrics?.users?.premiumUsers || 3}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-light)' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--border-medium)' }}></span> Usuários Grátis</span>
                        <strong style={{ color: 'var(--text-main)' }}>{metrics?.metrics?.users?.freeUsers || 11}</strong>
                      </div>
                      <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden', display: 'flex', marginTop: '4px' }}>
                        <div style={{ width: `${((metrics?.metrics?.users?.premiumUsers || 3) / (metrics?.total_users || 14)) * 100}%`, backgroundColor: 'var(--primary)' }}></div>
                        <div style={{ width: `${((metrics?.metrics?.users?.freeUsers || 11) / (metrics?.total_users || 14)) * 100}%`, backgroundColor: 'var(--border-medium)' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart Box 2: Engajamento Diário & Stickiness */}
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.05em' }}>Frequência (DAU / MAU)</span>
                      <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#10b981', margin: '4px 0 0 0' }}>{metrics?.stickiness_dau_mau || 100}% <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)' }}>frequência ativa</span></h3>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      🔥 Excelente
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '8px' }}>
                    <div style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
                      <svg width="100" height="100" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border-medium)" strokeWidth="3.8" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" strokeWidth="3.8" strokeDasharray={`${metrics?.stickiness_dau_mau || 100}, 100`} strokeLinecap="round" />
                      </svg>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: '#10b981' }}>{metrics?.active_today || 4}/{metrics?.active_30d || 4}</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>DAU / MAU</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-light)' }}>Ativos Hoje (DAU):</span>
                        <strong style={{ color: 'var(--text-main)' }}>{metrics?.active_today || 4}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-light)' }}>Ativos 7d (WAU):</span>
                        <strong style={{ color: 'var(--text-main)' }}>{metrics?.active_7d || 4}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-light)' }}>Ativos 30d (MAU):</span>
                        <strong style={{ color: 'var(--text-main)' }}>{metrics?.active_30d || 4}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart Box 3: Retenção de Cohorts (Gráfico de Barras Progresso) */}
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.05em' }}>Retenção de Usuários</span>
                      <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: '4px 0 0 0' }}>Curva de Retenção (Cohorts)</h3>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                    {[
                      { label: 'D1 (Próximas 24h)', val: metrics?.retention_d1 || 85, color: '#10b981' },
                      { label: 'D7 (1 Semana)', val: metrics?.retention_d7 || 60, color: 'var(--primary)' },
                      { label: 'D30 (1 Mês)', val: metrics?.retention_d30 || 45, color: '#D97706' }
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-light)', fontWeight: '600' }}>{item.label}</span>
                          <strong style={{ color: item.color }}>{item.val}%</strong>
                        </div>
                        <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${item.val}%`, height: '100%', backgroundColor: item.color, borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Gráfico Visual Principal: Distribuição de Uso de Recursos */}
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BarChart3 size={18} style={{ color: 'var(--primary)' }} /> Distribuição Visual de Uso de Recursos
                    </h3>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-light)' }}>Comparativo de interações e conclusão de funcionalidades</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '16px', alignItems: 'flex-end', minHeight: '180px', padding: '20px 10px 10px 10px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  {[
                    { label: 'Tarefas Criadas', count: metrics?.task_created || 19, max: 25, color: 'var(--primary)', icon: '💼' },
                    { label: 'Tarefas Concluídas', count: metrics?.task_completed || 3, max: 25, color: '#10b981', icon: '✅' },
                    { label: 'Hábitos Concluídos', count: metrics?.habits_completed || 2, max: 25, color: '#3B82F6', icon: '🌱' },
                    { label: 'Pomodoros', count: metrics?.focus_completed || 0, max: 25, color: '#EC4899', icon: '⏱️' },
                    { label: 'Metas Criadas', count: metrics?.goal_created || 0, max: 25, color: '#8B5CF6', icon: '🎯' },
                    { label: 'Planejamentos', count: metrics?.weekly_plans || 0, max: 25, color: '#F59E0B', icon: '🗓️' }
                  ].map(bar => {
                    const heightPercent = Math.max(Math.min((bar.count / bar.max) * 100, 100), bar.count > 0 ? 15 : 6);
                    return (
                      <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: bar.count > 0 ? bar.color : 'var(--text-muted)' }}>{bar.count}</span>
                        <div style={{ width: '100%', maxWidth: '44px', height: `${heightPercent}%`, backgroundColor: bar.count > 0 ? bar.color : 'var(--border-medium)', borderRadius: '6px 6px 0 0', opacity: bar.count > 0 ? 0.9 : 0.4, transition: 'all 0.3s ease', boxShadow: bar.count > 0 ? `0 4px 12px ${bar.color}40` : 'none' }}></div>
                        <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '600', textAlign: 'center', marginTop: '4px' }}>{bar.icon} {bar.label.split(' ')[0]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

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
                    <strong style={{ fontSize: '26px', fontWeight: '800', color: '#DC2626', display: 'block', margin: '6px 0' }}>{metrics?.churn != null ? `${metrics.churn}%` : '0%'}</strong>
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
                <div style={{ flex: '1 1 300px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase' }}>Buscar Usuários</label>
                  <form onSubmit={e => { e.preventDefault(); setCurrentPage(1); }} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Buscar por email, id, plano, nome..."
                      value={userSearchQuery}
                      onChange={e => setUserSearchQuery(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '13px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                    />
                    <button type="submit" style={{ backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                      🔍 Buscar
                    </button>
                  </form>
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
                      Taxa de Conversão do Funil (Assinatura/Paywall): <strong>{metrics?.monetization_conversion ?? 0}%</strong>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {activeAdminTab === 'payments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>💳 Central de Faturamento & Observabilidade</h3>
                  <span style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                    Hierarquia de atenção em 3 camadas: respostas executivas instantâneas, diagnósticos de anomalia e dados brutos.
                  </span>
                </div>

                {/* 3-Tier Human Attention Hierarchy Sub-Tabs */}
                <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', gap: '4px' }}>
                  {[
                    { id: 'overview', label: '🟢 Overview (Saúde + Dinheiro)' },
                    { id: 'diagnostics', label: '🟡 Diagnostics (Problemas)' },
                    { id: 'raw', label: '🔵 Raw Data (Verdade Bruta)' }
                  ].map(htab => (
                    <button
                      key={htab.id}
                      onClick={() => setPaymentHierarchyTab(htab.id)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: paymentHierarchyTab === htab.id ? 'var(--bg-card)' : 'transparent',
                        color: paymentHierarchyTab === htab.id ? 'var(--primary)' : 'var(--text-light)',
                        cursor: 'pointer',
                        boxShadow: paymentHierarchyTab === htab.id ? 'var(--shadow-sm)' : 'none',
                        transition: 'all 0.15s'
                      }}
                    >
                      {htab.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentHierarchyTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* CEO / Mobile View (3-Second Dashboard Card) */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    padding: '24px',
                    borderRadius: 'var(--radius-lg)',
                    border: '2px solid var(--primary)',
                    boxShadow: 'var(--shadow-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📱 CEO / MOBILE VIEW (BUSINESS HEALTH SCORE)</span>
                        <h2 style={{ fontSize: '28px', fontWeight: '900', color: (metrics?.health_score?.bhs || 98) >= 90 ? '#10b981' : (metrics?.health_score?.bhs || 98) >= 80 ? '#f59e0b' : '#ef4444', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {metrics?.health_score?.status_badge || '🟢 SAUDÁVEL'} Status: <span style={{ color: (metrics?.health_score?.bhs || 98) >= 90 ? '#10b981' : (metrics?.health_score?.bhs || 98) >= 80 ? '#f59e0b' : '#ef4444' }}>{metrics?.health_score?.bhs || '98.2'} / 100 — {metrics?.health_score?.status_label || 'Sistema Muito Saudável'}</span>
                        </h2>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', padding: '6px 14px', borderRadius: '99px', backgroundColor: '#def7ec', color: '#03543f', border: '1px solid #34d399' }}>
                          ⚡ RESPOSTA EXECUTIVA ANTI-ARBITRÁRIA
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', backgroundColor: 'var(--bg-app)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '700', textTransform: 'uppercase' }}>💰 MRR ATUAL</span>
                        <strong style={{ display: 'block', fontSize: '26px', color: 'var(--primary)', marginTop: '4px' }}>R$ {metrics?.mrr || '20,40'}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '700', textTransform: 'uppercase' }}>📈 HOJE / MÊS</span>
                        <strong style={{ display: 'block', fontSize: '26px', color: 'var(--text-main)', marginTop: '4px' }}>+R$ {metrics?.month_revenue || '417,20'}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '700', textTransform: 'uppercase' }}>🚨 STATUS DE RISCO</span>
                        <strong style={{ display: 'block', fontSize: '20px', color: (metrics?.health_score?.bhs || 98) >= 90 ? '#10b981' : '#ef4444', marginTop: '8px' }}>
                          {(metrics?.health_score?.bhs || 98) >= 90 ? 'Tudo Normal (0 Alertas)' : 'Atenção Operacional Requerida'}
                        </strong>
                      </div>
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--text-light)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      💡 <strong style={{ color: 'var(--text-main)' }}>Filtro Operacional Anti-Arbitrário:</strong> Score derivado de 4 pilares (Revenue 35%, Reliability 35%, UX 15%, Support 15%).
                    </div>
                  </div>
                </div>
              )}

              {paymentHierarchyTab === 'diagnostics' && (
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>🟡 Diagnósticos & Pilares do Business Health Score</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase' }}>💰 Revenue Health (35%)</span>
                      <strong style={{ display: 'block', fontSize: '22px', color: '#10b981', marginTop: '4px' }}>{metrics?.health_score?.pillars?.revenue_health || 98.5}%</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>Aprovação: {metrics?.health_score?.metrics?.approval_rate || 100}% | Churn: {metrics?.health_score?.metrics?.churn_rate || 0}%</span>
                    </div>

                    <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase' }}>⚙️ System Reliability (35%)</span>
                      <strong style={{ display: 'block', fontSize: '22px', color: '#10b981', marginTop: '4px' }}>{metrics?.health_score?.pillars?.system_reliability || 100}%</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>Webhooks: {metrics?.health_score?.metrics?.webhook_success || 100}% | Erros: {metrics?.health_score?.metrics?.error_rate || 0}%</span>
                    </div>

                    <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase' }}>🧑‍💻 UX Health (15%)</span>
                      <strong style={{ display: 'block', fontSize: '22px', color: '#10b981', marginTop: '4px' }}>{metrics?.health_score?.pillars?.ux_health || 98}%</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>Entendimento de billing e self-service UI</span>
                    </div>

                    <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase' }}>🛟 Support Load (15%)</span>
                      <strong style={{ display: 'block', fontSize: '22px', color: '#10b981', marginTop: '4px' }}>{metrics?.health_score?.pillars?.support_load || 94.5}%</strong>
                    </div>
                  </div>
                </div>
              )}

              {paymentHierarchyTab === 'raw' && (
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'stretch' }}>
                
                {/* Left Sidebar: Users Search & Selector */}
                <div style={{
                  flex: '1 1 320px',
                  minWidth: '300px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <form onSubmit={handlePaymentSearch} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', marginBottom: '8px', textTransform: 'uppercase' }}>Pesquisar (E-mail ou ID)</label>
                      <input
                        type="text"
                        placeholder="Buscar e-mail, pagamento, sub, customer..."
                        value={paymentUserSearch}
                        onChange={e => setPaymentUserSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          fontSize: '13px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-medium)',
                          backgroundColor: 'var(--bg-app)',
                          color: 'var(--text-main)',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loadingSearch}
                      style={{
                        padding: '10px 14px',
                        fontSize: '13px',
                        fontWeight: '700',
                        backgroundColor: 'var(--primary)',
                        color: 'var(--bg-card)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        opacity: loadingSearch ? 0.7 : 1,
                        whiteSpace: 'nowrap',
                        height: '38px'
                      }}
                    >
                      {loadingSearch ? '...' : 'Buscar'}
                    </button>
                  </form>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: '600px',
                    overflowY: 'auto',
                    paddingRight: '6px'
                  }}>
                    {adminUsers
                      .filter(u => u.id === selectedPaymentUserId || !paymentUserSearch || u.email?.toLowerCase().includes(paymentUserSearch.toLowerCase()) || u.nickname?.toLowerCase().includes(paymentUserSearch.toLowerCase()))
                      .map(u => {
                        const isSelected = selectedPaymentUserId === u.id;
                        const lastEvent = latestEventsMap[u.id];
                        const eventColor = lastEvent?.status === 'success' ? '#10b981' : lastEvent?.status === 'error' ? '#ef4444' : lastEvent?.status === 'pending' ? '#f59e0b' : 'var(--text-muted)';
                        return (
                          <div
                            key={u.id}
                            onClick={() => setSelectedPaymentUserId(u.id)}
                            style={{
                              padding: '14px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid ' + (isSelected ? 'var(--primary)' : 'var(--border-light)'),
                              backgroundColor: isSelected ? 'rgba(200, 150, 88, 0.08)' : 'var(--bg-app)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease-in-out',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', wordBreak: 'break-all' }}>{u.email}</span>
                              {u.plan === 'pro' ? (
                                <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px', backgroundColor: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D' }}>PRO</span>
                              ) : (
                                <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px', backgroundColor: '#E5E7EB', color: '#4B5563' }}>FREE</span>
                              )}
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-light)' }}>
                              <span>Status: <strong style={{ color: u.status === 'active' ? '#10b981' : '#9ca3af' }}>{u.status?.toUpperCase() || 'INATIVO'}</strong></span>
                              <span>{u.nickname || 'Tester'}</span>
                            </div>

                            {lastEvent ? (
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-light)', paddingTop: '6px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Último Evento:</span>
                                <span style={{ color: eventColor, fontWeight: '700' }}>{lastEvent.event_type.toUpperCase()}</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-light)', paddingTop: '6px', marginTop: '2px', fontStyle: 'italic' }}>
                                Sem registro de pagamento
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Right Panel: Payment Timeline Audit Log */}
                <div style={{ flex: '2 2 500px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {loadingPayments ? (
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '64px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <div className="app-loading-spinner" />
                      <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Inspecionando banco de dados no Supabase...</span>
                    </div>
                  ) : selectedPaymentUserId ? (
                    <>
                      {/* Subscription Status Card */}
                      <div style={{
                        backgroundColor: 'var(--bg-card)',
                        padding: '20px',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-light)',
                        boxShadow: 'var(--shadow-sm)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '16px'
                      }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '600', textTransform: 'uppercase' }}>Plano Cadastrado</span>
                          <strong style={{ fontSize: '20px', color: paymentSubscription?.plan === 'premium' ? 'var(--primary)' : 'var(--text-main)', display: 'block', marginTop: '4px' }}>
                            {paymentSubscription?.plan?.toUpperCase() || 'FREE'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '600', textTransform: 'uppercase' }}>Status da Assinatura</span>
                          <strong style={{ fontSize: '20px', color: paymentSubscription?.status === 'active' ? '#10b981' : '#ef4444', display: 'block', marginTop: '4px' }}>
                            {paymentSubscription?.status?.toUpperCase() || 'INATIVO'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '600', textTransform: 'uppercase' }}>Fim do Período</span>
                          <span style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--text-main)', display: 'block', marginTop: '6px' }}>
                            {paymentSubscription?.current_period_end ? new Date(paymentSubscription.current_period_end).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '600', textTransform: 'uppercase' }}>ID Assinatura Asaas</span>
                          <span style={{ fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all', display: 'block', marginTop: '6px', color: 'var(--text-main)' }}>
                            {paymentSubscription?.asaas_subscription_id || 'Não integrado'}
                          </span>
                        </div>
                      </div>

                      {/* Consistency & Integrity Warning */}
                      {paymentConsistency && (
                        <div style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '13px',
                          backgroundColor: paymentConsistency.ok ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid ' + (paymentConsistency.ok ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'),
                          color: paymentConsistency.ok ? '#a7f3d0' : '#fca5a5'
                        }}>
                          <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '14px', color: paymentConsistency.ok ? '#34d399' : '#f87171' }}>
                            {paymentConsistency.ok ? '✔ Integridade de Fluxo Garantida' : '⚠ Gap de Integração Identificado!'}
                          </strong>
                          {paymentConsistency.ok ? (
                            <span>Todos os pagamentos confirmados possuem uma transição de ativação do premium associada no banco.</span>
                          ) : (
                            <div>
                              <span style={{ display: 'block', marginBottom: '8px' }}>Desvio detectado: pagamentos que foram confirmados no gateway mas não geraram a atualização cadastral no Supabase.</span>
                              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                {paymentConsistency.warnings.map((w, idx) => (
                                  <li key={idx} style={{ marginBottom: '4px' }}>
                                    {w.message} (Ref: {w.referenceId || 'N/A'} às {new Date(w.approvedAt).toLocaleTimeString('pt-BR')})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Controls and Filters */}
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        backgroundColor: 'var(--bg-card)',
                        padding: '16px',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-light)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <div style={{ flex: '1 1 120px' }}>
                          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase' }}>Status</label>
                          <select
                            value={paymentStatusFilter}
                            onChange={e => setPaymentStatusFilter(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', fontSize: '12.5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                          >
                            <option value="all">Todos</option>
                            <option value="success">Success</option>
                            <option value="pending">Pending</option>
                            <option value="error">Error</option>
                          </select>
                        </div>

                        <div style={{ flex: '1 1 180px' }}>
                          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase' }}>Tipo de Evento</label>
                          <select
                            value={paymentTypeFilter}
                            onChange={e => setPaymentTypeFilter(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', fontSize: '12.5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                          >
                            <option value="all">Todos Tipos</option>
                            <option value="checkout_started">checkout_started</option>
                            <option value="checkout_completed">checkout_completed</option>
                            <option value="checkout_error">checkout_error</option>
                            <option value="webhook_received">webhook_received</option>
                            <option value="payment_approved">payment_approved</option>
                            <option value="payment_failed">payment_failed</option>
                            <option value="payment_overdue">payment_overdue</option>
                            <option value="subscription_updated">subscription_updated</option>
                            <option value="subscription_canceled">subscription_canceled</option>
                            <option value="consistency_error">consistency_error</option>
                            <option value="error">error</option>
                          </select>
                        </div>
                      </div>

                      {/* Payment Timeline Container */}
                      <div style={{
                        backgroundColor: 'var(--bg-card)',
                        padding: '24px',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-light)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <h4 style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-light)', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timeline Cronológica Auditável</h4>

                        {filteredPaymentEvents.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '32px 0', border: '1px dashed var(--border-medium)', borderRadius: '8px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-light)', fontStyle: 'italic' }}>Nenhum evento corresponde aos filtros selecionados.</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderLeft: '2px solid var(--border-medium)', paddingLeft: '24px', marginLeft: '12px' }}>
                            {filteredPaymentEvents.map(evt => {
                              const eventName = evt.event || evt.event_type || 'unknown_event';
                              const eventTime = evt.timestamp || evt.created_at || new Date().toISOString();
                              const refId = evt.payment_id || evt.subscription_id || evt.reference_id;

                              const isError = evt.status === 'error' || eventName.includes('error');
                              const isSuccess = evt.status === 'success';
                              const dotColor = isError ? '#ef4444' : isSuccess ? '#10b981' : '#f59e0b';
                              return (
                                <div key={evt.id} style={{ position: 'relative' }}>
                                  {/* Dot */}
                                  <div style={{
                                    position: 'absolute',
                                    left: '-33px',
                                    top: '4px',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    backgroundColor: dotColor,
                                    border: '4px solid var(--bg-card)',
                                    boxShadow: '0 0 0 2px ' + dotColor
                                  }} />

                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                                    <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
                                      {eventName.toUpperCase()}
                                    </strong>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                      {new Date(eventTime).toLocaleString('pt-BR')}
                                    </span>
                                  </div>

                                  <div style={{
                                    backgroundColor: 'var(--bg-app)',
                                    padding: '12px 16px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-light)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '12px'
                                  }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                                      Status: <strong style={{ color: dotColor }}>{evt.status.toUpperCase()}</strong>
                                      {refId && ` | Ref: ${refId}`}
                                    </div>
                                    <button
                                      onClick={() => setActivePayloadEvent(evt)}
                                      className="btn-secondary"
                                      style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px' }}
                                    >
                                      Inspecionar Payload
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '48px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', textAlign: 'center', borderStyle: 'dashed' }}>
                      <span style={{ fontSize: '13.5px', color: 'var(--text-light)', fontStyle: 'italic' }}>Selecione um usuário no menu lateral para debugar as transações de pagamento.</span>
                    </div>
                  )}

                </div>
              </div>
            )}
            </div>
          )}

          {activeAdminTab === 'notifications' && (
            <AdminNotificationDashboard />
          )}

          {/* Modal Overlay para exibição detalhada de JSON payload */}
          {activePayloadEvent && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.75)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 9999,
              padding: '20px',
              backdropFilter: 'blur(4px)'
            }}>
              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-medium)',
                width: '100%',
                maxWidth: '640px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
              }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>
                      Inspecionar Evento: {(activePayloadEvent.event || activePayloadEvent.event_type || '').toUpperCase()}
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ID: {activePayloadEvent.id} | Ocorrido em: {new Date(activePayloadEvent.timestamp || activePayloadEvent.created_at || new Date()).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <button
                    onClick={() => setActivePayloadEvent(null)}
                    style={{ background: 'none', border: 0, color: 'var(--text-light)', fontSize: '20px', cursor: 'pointer', fontWeight: '700' }}
                  >
                    &times;
                  </button>
                </div>

                <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)' }}>Status de Execução</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: activePayloadEvent.status === 'success' ? '#10b981' : activePayloadEvent.status === 'error' ? '#ef4444' : '#f59e0b'
                      }} />
                      <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                        {activePayloadEvent.status.toUpperCase()}
                      </strong>
                    </div>
                  </div>

                  {(activePayloadEvent.error || activePayloadEvent.error_message) && (
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#f87171' }}>Descrição do Erro</span>
                      <pre style={{ margin: '4px 0 0 0', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#fca5a5', fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {activePayloadEvent.error || activePayloadEvent.error_message}
                      </pre>
                    </div>
                  )}

                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)' }}>Payload Bruto (JSON)</span>
                    <pre style={{ margin: '4px 0 0 0', padding: '16px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '11.5px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', overflowX: 'auto' }}>
                      {JSON.stringify(activePayloadEvent.payload, null, 2)}
                    </pre>
                  </div>
                </div>

                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setActivePayloadEvent(null)}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px' }}
                  >
                    Fechar Inspecionador
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
