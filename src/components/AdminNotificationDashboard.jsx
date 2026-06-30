import React, { useState, useEffect } from 'react';
import { Bell, RefreshCw, AlertTriangle, CheckCircle, Clock, Send, Zap, Shield, Smartphone, Terminal } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAppContext } from '../contexts/AppContext';

export default function AdminNotificationDashboard() {
  const { currentUser } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    success: 0,
    failed: 0,
    total: 0,
    totalSubscriptions: 0,
    ctr: '0%',
    avgLatency: '38ms'
  });

  const [recentQueue, setRecentQueue] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [swStatus, setSwStatus] = useState('checking');
  const [browserPermission, setBrowserPermission] = useState('default');

  const checkBrowserCapabilities = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const active = registrations.some(r => r.active || r.installing || r.waiting);
        setSwStatus(active ? 'active' : 'inactive');
      } catch (err) {
        setSwStatus('error');
      }
    } else {
      setSwStatus('unsupported');
    }

    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    } else {
      setBrowserPermission('unsupported');
    }
  };

  const fetchNotificationMetrics = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      const res = await fetch('/api/admin/notifications', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      if (data && data.stats) {
        setStats({
          pending: data.stats.pending,
          processing: data.stats.processing,
          success: data.stats.success,
          failed: data.stats.failed,
          total: data.stats.total,
          totalSubscriptions: data.stats.totalSubscriptions,
          ctr: '0%',
          avgLatency: '38ms'
        });
        setRecentQueue(data.queue || []);
      }
    } catch (err) {
      console.error('Error fetching notification metrics:', err);
    } finally {
      setLoading(false);
      checkBrowserCapabilities();
    }
  };

  const handleSendTestPush = async () => {
    if (!currentUser?.id) {
      alert('Administrador não identificado.');
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/admin/notifications/test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userId: currentUser.id })
      });

      const resData = await res.json();

      if (res.ok && resData.success) {
        setTestResult({
          type: 'success',
          message: resData.message || 'Push disparado e recebido!',
          latency: resData.latencyMs
        });
        // Atualiza a fila
        await fetchNotificationMetrics();
      } else {
        setTestResult({
          type: 'error',
          message: resData.error || 'Erro ao enviar notificação de teste.'
        });
      }
    } catch (err) {
      setTestResult({
        type: 'error',
        message: err.message || 'Falha na conexão com o servidor.'
      });
    } finally {
      setTestLoading(false);
    }
  };

  useEffect(() => {
    fetchNotificationMetrics();
  }, []);

  const filteredQueue = filterStatus === 'all' 
    ? recentQueue 
    : recentQueue.filter(i => i.status === filterStatus);

  return (
    <div className="admin-notification-dashboard animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Bell size={24} style={{ color: 'var(--primary)' }} /> Telemetria de Web Push Notifications (EDA)
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Auditoria em tempo real do barramento de eventos de entrega Push, Service Workers e Telemetria VAPID.
          </p>
        </div>
        <button 
          onClick={fetchNotificationMetrics}
          className="btn-primary-glow"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px', borderRadius: '8px', border: 0, cursor: 'pointer' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar Painel
        </button>
      </div>

      {/* Grid de Estado de Infraestrutura Local */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        
        {/* Service Worker Status */}
        <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ padding: '10px', backgroundColor: swStatus === 'active' ? '#22c55e20' : '#ef444420', borderRadius: '8px', color: swStatus === 'active' ? '#22c55e' : '#ef4444' }}>
            <Terminal size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '600', textTransform: 'uppercase' }}>Service Worker</span>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
              {swStatus === 'active' ? 'Ativo & Registrado' : swStatus === 'inactive' ? 'Inativo (Apenas Prod)' : swStatus === 'checking' ? 'Verificando...' : 'Não suportado'}
            </div>
          </div>
        </div>

        {/* Browser Permission */}
        <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ padding: '10px', backgroundColor: browserPermission === 'granted' ? '#22c55e20' : '#ef444420', borderRadius: '8px', color: browserPermission === 'granted' ? '#22c55e' : '#ef4444' }}>
            <Shield size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '600', textTransform: 'uppercase' }}>Permissão do Navegador</span>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
              {browserPermission === 'granted' ? 'Permitido (Granted)' : browserPermission === 'denied' ? 'Bloqueado (Denied)' : 'Padrão (Default)'}
            </div>
          </div>
        </div>

        {/* Subscriptions Cadastradas */}
        <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ padding: '10px', backgroundColor: 'var(--primary-glow)', borderRadius: '8px', color: 'var(--primary)' }}>
            <Smartphone size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '600', textTransform: 'uppercase' }}>Dispositivos Cadastrados</span>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
              {stats.totalSubscriptions} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>endpoints ativos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Test Engine Console */}
      <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Zap size={16} style={{ color: '#eab308' }} /> Console de Validação Ponta a Ponta (Zero Mocks)
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
          Este console envia um payload de teste real utilizando o seu navegador atual. Ele registrará a transação no banco, executará a fila via worker real e retornará o status de entrega do servidor VAPID.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleSendTestPush}
              disabled={testLoading || browserPermission !== 'granted'}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: '700',
                borderRadius: '8px',
                border: 0,
                cursor: (testLoading || browserPermission !== 'granted') ? 'not-allowed' : 'pointer',
                opacity: (testLoading || browserPermission !== 'granted') ? 0.6 : 1
              }}
            >
              <Send size={14} className={testLoading ? 'spin' : ''} />
              {testLoading ? 'Processando envio...' : 'Enviar Push de Teste Real'}
            </button>
            
            {browserPermission !== 'granted' && (
              <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: '600' }}>
                ⚠️ Por favor, conceda permissões de notificação a este site para testar.
              </span>
            )}
          </div>

          {testResult && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              backgroundColor: testResult.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${testResult.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              color: testResult.type === 'success' ? '#22c55e' : '#ef4444',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {testResult.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                {testResult.type === 'success' ? 'Sucesso E2E!' : 'Erro E2E:'}
              </strong>
              <span>{testResult.message}</span>
              {testResult.latency && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Latência do Pipeline: {testResult.latency}ms
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cartões de Métricas da Fila */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div style={{ padding: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '600' }}>Pendentes na Fila</span>
          <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#eab308', margin: '4px 0 0' }}>{stats.pending}</h3>
        </div>
        <div style={{ padding: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '600' }}>Em Processamento</span>
          <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#3b82f6', margin: '4px 0 0' }}>{stats.processing}</h3>
        </div>
        <div style={{ padding: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '600' }}>Enviadas com Sucesso</span>
          <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#22c55e', margin: '4px 0 0' }}>{stats.success}</h3>
        </div>
        <div style={{ padding: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '600' }}>Falhas</span>
          <h3 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--danger)', margin: '4px 0 0' }}>{stats.failed}</h3>
        </div>
        <div style={{ padding: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '600' }}>Total Processado</span>
          <h3 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)', margin: '4px 0 0' }}>{stats.total}</h3>
        </div>
      </div>

      {/* Tabela de Fila Recente */}
      <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>Fila de Notificações Recentes</h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'pending', 'sent', 'failed'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                style={{
                  padding: '6px 12px', fontSize: '11px', borderRadius: '4px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: filterStatus === st ? 'var(--primary)' : 'transparent',
                  color: filterStatus === st ? 'white' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {st.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-light)' }}>
                <th style={{ padding: '12px 8px' }}>Evento</th>
                <th style={{ padding: '12px 8px' }}>Destinatário</th>
                <th style={{ padding: '12px 8px' }}>Agendado Para</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px' }}>Tentativas</th>
                <th style={{ padding: '12px 8px' }}>Erro</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum item encontrado na fila.</td></tr>
              ) : (
                filteredQueue.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)', hover: { backgroundColor: 'var(--bg-app)' } }}>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{item.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.body}</div>
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-light)', fontSize: '11px', fontFamily: 'monospace' }}>{item.user_id}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{new Date(item.scheduled_for).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700',
                        backgroundColor: (item.status === 'sent' || item.status === 'success') ? '#22c55e20' : item.status === 'failed' ? '#ef444420' : '#eab30820',
                        color: (item.status === 'sent' || item.status === 'success') ? '#22c55e' : item.status === 'failed' ? '#ef4444' : '#eab308'
                      }}>
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{item.attempts}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--danger)', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.last_error}>
                      {item.last_error || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
