import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Users, Star, BarChart3, TrendingUp, HelpCircle, ShieldAlert, CheckCircle2, ChevronRight 
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';

export default function AdminDashboard() {
  const { isAdmin, currentUser } = useAppContext();
  const [events, setEvents] = useState([]);
  const [profilesCount, setProfilesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchAdminData = async () => {
      setLoading(true);
      try {
        // 1. Conta total de registros de perfis
        const { count, error: countErr } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (!countErr && count !== null) {
          setProfilesCount(count);
        }

        // 2. Busca logs de eventos para processar métricas
        const { data: eventsData, error: eventsErr } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3000);

        if (!eventsErr && eventsData) {
          setEvents(eventsData);
        }
      } catch (err) {
        console.error('[AdminDashboard] Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [isAdmin]);

  // Se não for admin, bloqueio estrito (Bloqueio Funcional real)
  if (!isAdmin) {
    return (
      <div style={{ padding: '60px var(--space-4)', textAlign: 'center', maxWidth: '440px', margin: '60px auto' }}>
        <ShieldAlert size={48} style={{ color: '#C06C6C', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>Acesso Negado</h2>
        <p style={{ fontSize: '13.5px', color: 'var(--text-light)', marginTop: '8px', lineHeight: '1.6' }}>
          Esta área é restrita a administradores autorizados do Flowday. Seu usuário atual não possui permissões administrativas.
        </p>
      </div>
    );
  }

  // Cálculos dinâmicos baseados nos eventos (com fallback mockado se o banco for novo)
  const metrics = useMemo(() => {
    // Processar logs do banco dinamicamente (removido fallback isDbEmpty)
    const totalUsers = Math.max(profilesCount, new Set(events.map(e => e.user_id)).size);
    
    // Contar novos usuários (baseado em evento 'signup' ou primeira aparição)
    const signups = events.filter(e => e.event_type === 'signup');
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const today = now.getTime();

    const newToday = signups.filter(e => (today - new Date(e.created_at).getTime()) <= oneDay).length;
    const newWeek = signups.filter(e => (today - new Date(e.created_at).getTime()) <= oneDay * 7).length;
    const newMonth = signups.filter(e => (today - new Date(e.created_at).getTime()) <= oneDay * 30).length;

    // Métricas de engajamento
    const createdTasks = events.filter(e => e.event_type === 'task_created').length;
    const completedTasks = events.filter(e => e.event_type === 'task_completed').length;
    const createdHabits = events.filter(e => e.event_type === 'habit_created').length;
    const completedHabits = events.filter(e => e.event_type === 'habit_completed').length;
    const createdGoals = events.filter(e => e.event_type === 'goal_created').length;

    // Visualizações
    const viewCalendar = events.filter(e => e.event_type === 'calendar_viewed').length;
    const viewKanban = events.filter(e => e.event_type === 'kanban_viewed').length;
    const viewFocus = events.filter(e => e.event_type === 'focus_started').length;
    const viewAnalytics = events.filter(e => e.event_type === 'analytics_viewed').length;

    // Funil de Conversão (Usuários Únicos por Etapa) - Dados reais
    const getUniqueCount = (evtType) => new Set(events.filter(e => e.event_type === evtType).map(e => e.user_id)).size;

    const funnel = {
      signup: totalUsers || 0,
      onboardingStarted: getUniqueCount('onboarding_started'),
      onboardingCompleted: getUniqueCount('onboarding_completed'),
      firstTask: getUniqueCount('task_created'),
      firstHabit: getUniqueCount('habit_created'),
      firstGoal: getUniqueCount('goal_created'),
      firstAnalytics: getUniqueCount('analytics_viewed'),
      paywallView: getUniqueCount('paywall_viewed'),
      upgradeClick: getUniqueCount('upgrade_clicked')
    };

    // Monetização (Apenas dados reais baseados em cliques de upgrade simulados pelo usuário)
    const proCount = funnel.upgradeClick;
    const freeCount = Math.max(0, totalUsers - proCount);
    const conversionRate = totalUsers > 0 ? parseFloat(((proCount / totalUsers) * 100).toFixed(1)) : 0;

    return {
      totalUsers,
      newToday: newToday || 0,
      newWeek: newWeek || 0,
      newMonth: newMonth || 0,
      retD1: 0, // Removendo hardcode: sem dados de login suficientes para calcular cohort agora
      retD7: 0,
      retD30: 0,
      createdTasks,
      completedTasks,
      createdHabits,
      completedHabits,
      createdGoals,
      viewCalendar,
      viewKanban,
      viewFocus,
      viewAnalytics,
      funnel,
      monetization: {
        proCount,
        freeCount,
        conversionRate
      }
    };
  }, [events, profilesCount]);

  return (
    <div className="admin-dashboard-container animate-fade-in" style={{ padding: '24px 0' }}>
      
      {/* Header */}
      <div className="tasks-page-header" style={{ marginBottom: '32px' }}>
        <h1 className="tasks-page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={24} /> Dashboard Administrativo
        </h1>
        <p className="tasks-page-subtitle">Indicadores de engajamento, funil e retenção de usuários</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div className="app-loading-spinner" style={{ margin: '0 auto 16px' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Buscando dados administrativos...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Métricas Principais Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>Usuários Cadastrados</span>
              <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary)', display: 'block', margin: '4px 0' }}>{metrics.totalUsers}</span>
              <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Hoje: +{metrics.newToday}</span>
                <span>•</span>
                <span>Semana: +{metrics.newWeek}</span>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>Assinaturas Pro (Simuladas)</span>
              <span style={{ fontSize: '28px', fontWeight: '800', color: '#C89658', display: 'block', margin: '4px 0' }}>{metrics.monetization.proCount}</span>
              <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Free: {metrics.monetization.freeCount}</span>
                <span>•</span>
                <span>Conversão: {metrics.monetization.conversionRate}%</span>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', display: 'block' }}>Uso de Telas (Views)</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px', fontSize: '11.5px', color: 'var(--text-main)' }}>
                <div>📅 Agenda: {metrics.viewCalendar}</div>
                <div>⚡ Kanban: {metrics.viewKanban}</div>
                <div>⏱️ Foco: {metrics.viewFocus}</div>
                <div>📈 Analytics: {metrics.viewAnalytics}</div>
              </div>
            </div>
          </div>

          {/* Seção 2: Retenção e Engajamento */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap' }}>
            
            {/* Retenção */}
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <TrendingUp size={18} /> Retenção de Usuários Cohort
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { label: 'Retenção D1 (24h)', val: metrics.retD1, color: 'var(--primary)' },
                  { label: 'Retenção D7 (1 semana)', val: metrics.retD7, color: '#C89658' },
                  { label: 'Retenção D30 (1 mês)', val: metrics.retD30, color: '#C06C6C' }
                ].map(r => (
                  <div key={r.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-main)' }}>{r.label}</span>
                      <span style={{ color: r.color }}>{r.val}%</span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${r.val}%`, backgroundColor: r.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Engajamento Geral */}
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', justifyContext: 'space-between' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <CheckCircle2 size={18} /> Ações de Engajamento
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Tarefas Criadas</span>
                  <strong style={{ fontSize: '18px', display: 'block', color: 'var(--text-main)' }}>{metrics.createdTasks}</strong>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Tarefas Concluídas</span>
                  <strong style={{ fontSize: '18px', display: 'block', color: 'var(--primary)' }}>{metrics.completedTasks}</strong>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Hábitos Criados</span>
                  <strong style={{ fontSize: '18px', display: 'block', color: 'var(--text-main)' }}>{metrics.createdHabits}</strong>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Objetivos Criados</span>
                  <strong style={{ fontSize: '18px', display: 'block', color: 'var(--text-main)' }}>{metrics.createdGoals}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Funil de Conversão */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Users size={18} /> Funil de Conversão de Produto (Product Funnel)
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: '1. Cadastro (Signup)', count: metrics.funnel.signup },
                { label: '2. Onboarding Iniciado', count: metrics.funnel.onboardingStarted },
                { label: '3. Onboarding Concluído', count: metrics.funnel.onboardingCompleted },
                { label: '4. Primeira Tarefa Criada', count: metrics.funnel.firstTask },
                { label: '5. Primeiro Hábito Criado', count: metrics.funnel.firstHabit },
                { label: '6. Primeiro Objetivo Criado', count: metrics.funnel.firstGoal },
                { label: '7. Primeira Visita ao Analytics', count: metrics.funnel.firstAnalytics },
                { label: '8. Visualização do Paywall', count: metrics.funnel.paywallView },
                { label: '9. Clique em Upgrade Pro (Simulação)', count: metrics.funnel.upgradeClick }
              ].map((step, idx, arr) => {
                const total = arr[0].count;
                const pct = Math.round((step.count / total) * 100);
                return (
                  <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '260px', fontSize: '12.5px', color: 'var(--text-main)', fontWeight: '600' }}>
                      {step.label}
                    </div>
                    <div style={{ flex: 1, height: '24px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: 'var(--primary-light)' }} />
                      <span style={{ position: 'absolute', left: '10px', top: '2px', fontSize: '11px', fontWeight: '700', color: 'var(--primary)' }}>
                        {step.count} usuários
                      </span>
                    </div>
                    <div style={{ width: '50px', textAlign: 'right', fontSize: '12.5px', fontWeight: '800', color: 'var(--text-muted)' }}>
                      {pct}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
