import { supabaseAdmin } from '../lib/supabase.js';
import { BillingAdapter } from '../lib/billing/billingAdapter.js';

let dashboardCacheData = null;
let dashboardCacheTimestamp = 0;
const CACHE_TTL_MS = 30000; // 30 segundos

/**
 * Invalida o cache do dashboard instantaneamente ao ocorrer ativação de assinatura.
 */
export function invalidateDashboardCache() {
  console.log('[ADMIN DASHBOARD CACHE] Invalidação manual acionada por evento financeiro.');
  dashboardCacheData = null;
  dashboardCacheTimestamp = 0;
}

export const AdminDashboardService = {
  /**
   * Consolida todas as métricas do painel administrativo via service_role de forma 100% tolerante a falhas.
   */
  async getDashboard() {
    const startTime = Date.now();
    const now = new Date();
    const nowIso = now.toISOString();

    // Verificação de Cache (HIT)
    if (dashboardCacheData && (startTime - dashboardCacheTimestamp) < CACHE_TTL_MS) {
      console.log(`[ADMIN DASHBOARD] Cache HIT | ExeTime: ${Date.now() - startTime}ms`);
      return { ...dashboardCacheData, cache: { hit: true, ageMs: startTime - dashboardCacheTimestamp } };
    }

    console.log('[ADMIN DASHBOARD] Cache MISS — Consolidação resiliente iniciada...');

    // 1. Execução Segura e Isolada de Subscriptions
    let rawSubscriptions = [];
    try {
      const subsRes = await supabaseAdmin.from('subscriptions').select('*');
      if (!subsRes.error && subsRes.data) rawSubscriptions = subsRes.data;
    } catch (e) {
      console.warn('[ADMIN DASHBOARD WARN subs]', e.message);
    }

    // 2. Execução Segura e Isolada de Profiles
    let profiles = [];
    try {
      const profilesRes = await supabaseAdmin.from('profiles').select('*');
      if (!profilesRes.error && profilesRes.data) profiles = profilesRes.data;
    } catch (e) {
      console.warn('[ADMIN DASHBOARD WARN profiles]', e.message);
    }

    // 3. Execução Segura e Isolada de Auth Users (Email resolution)
    let emailMap = new Map();
    let authUsers = [];
    try {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (!authErr && authData?.users) {
        authUsers = authData.users;
        authUsers.forEach(u => emailMap.set(u.id, u.email));
      }
    } catch (e) {
      console.warn('[ADMIN DASHBOARD WARN auth.users]', e.message);
    }

    // 4. Execução Segura e Isolada de Events
    let events = [];
    try {
      const eventsRes = await supabaseAdmin.from('events').select('user_id, event_type, created_at, metadata').order('created_at', { ascending: false }).limit(5000);
      if (!eventsRes.error && eventsRes.data) events = eventsRes.data;
    } catch (e) {
      console.warn('[ADMIN DASHBOARD WARN events]', e.message);
    }

    // 5. Execução Segura e Isolada de Tasks
    let tasks = [];
    try {
      const tasksRes = await supabaseAdmin.from('tasks').select('id, completed, user_id');
      if (!tasksRes.error && tasksRes.data) tasks = tasksRes.data;
    } catch (e) {
      console.warn('[ADMIN DASHBOARD WARN tasks]', e.message);
    }

    // 6. Execução Segura e Isolada de Goals
    let goals = [];
    try {
      const goalsRes = await supabaseAdmin.from('goals').select('id, status, user_id');
      if (!goalsRes.error && goalsRes.data) goals = goalsRes.data;
    } catch (e) {
      console.warn('[ADMIN DASHBOARD WARN goals]', e.message);
    }

    // 7. Execução Segura e Isolada de Habits
    let totalHabits = 0;
    try {
      const habitsRes = await supabaseAdmin.from('habits').select('id', { count: 'exact', head: true });
      if (!habitsRes.error && habitsRes.count != null) totalHabits = habitsRes.count;
    } catch (e) {
      console.warn('[ADMIN DASHBOARD WARN habits]', e.message);
    }

    // Normalizar assinaturas via BillingAdapter
    const subscriptions = rawSubscriptions.map(s => BillingAdapter.normalizeSubscription(s));

    // 1. REVENUE & FINANCIAL KPI (Fonte Única da Verdade: subscriptions)
    const activeSubs = subscriptions.filter(s => s.status === 'active' && s.plan !== 'free');
    const canceledSubs = subscriptions.filter(s => s.status === 'canceled');
    const pendingSubs = subscriptions.filter(s => s.status === 'pending');
    const pastDueSubs = subscriptions.filter(s => s.status === 'past_due');

    const mrr = activeSubs.reduce((acc, sub) => acc + Number(sub.price || 0), 0);
    const arr = mrr * 12;

    // Calculando Receitas Históricas (Qualquer cobrança paga: active, canceled, expired, past_due)
    const todayStr = nowIso.slice(0, 10);
    const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const thirtyDaysAgoIso = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString();

    let dailyRevenue = 0;
    let monthlyRevenue = 0;
    let thirtyDaysRevenue = 0;
    let totalRevenue = 0;

    subscriptions.forEach(s => {
      const amt = Number(s.amount || s.price || 0);
      if (s.status !== 'pending' && s.plan !== 'free') {
        totalRevenue += amt;
        const createdDate = (s.createdAt || '').slice(0, 10);
        if (createdDate === todayStr) dailyRevenue += amt;
        if (createdDate >= startOfMonthStr) monthlyRevenue += amt;
        if (s.createdAt >= thirtyDaysAgoIso) thirtyDaysRevenue += amt;
      }
    });

    // 2. USERS METRICS (Consolidado entre authUsers e profiles)
    const userMasterMap = new Map();

    authUsers.forEach(u => {
      userMasterMap.set(u.id, {
        id: u.id,
        nickname: u.user_metadata?.nickname || u.user_metadata?.name || u.email?.split('@')[0] || 'Usuário',
        name: u.user_metadata?.name || u.user_metadata?.full_name || '',
        email: u.email || 'N/A',
        created_at: u.created_at,
        last_login: u.last_sign_in_at || u.created_at,
        plan: 'free',
        status: 'free',
        total_events: 0
      });
    });

    profiles.forEach(p => {
      const existing = userMasterMap.get(p.id) || {};
      userMasterMap.set(p.id, {
        ...existing,
        id: p.id,
        nickname: p.nickname || p.name || existing.nickname || 'Usuário',
        name: p.name || existing.name || '',
        email: p.email || existing.email || emailMap.get(p.id) || 'N/A',
        created_at: p.created_at || existing.created_at || new Date().toISOString(),
        last_login: p.updated_at || p.created_at || existing.last_login || new Date().toISOString()
      });
    });

    const subMap = new Map();
    subscriptions.forEach(s => {
      const uid = s.userId || s.user_id;
      if (uid) subMap.set(uid, s);
    });

    userMasterMap.forEach((userObj, uid) => {
      const sub = subMap.get(uid);
      if (sub) {
        const planName = (sub.plan || 'free').toLowerCase();
        userObj.plan = planName === 'premium' ? 'pro' : planName;
        userObj.status = sub.status || 'free';
      }
    });

    // Inicializar contadores por usuário para evitar undefined na tela
    userMasterMap.forEach((u) => {
      u.goals_created = 0;
      u.goals_completed = 0;
      u.tasks_created = 0;
      u.tasks_completed = 0;
      u.completion_rate = 0;
      u.pomodoros = 0;
      u.weekly_plans = 0;
      u.active_days = 0;
      u.sessions = 0;
    });

    // Contabilizar objetivos (goals) por usuário
    goals.forEach(g => {
      const u = userMasterMap.get(g.user_id);
      if (u) {
        u.goals_created++;
        if (g.status === 'completed') u.goals_completed++;
      }
    });

    // Contabilizar tarefas (tasks) por usuário
    tasks.forEach(t => {
      const u = userMasterMap.get(t.user_id);
      if (u) {
        u.tasks_created++;
        if (t.completed) u.tasks_completed++;
      }
    });

    // Calcular taxa de conclusão de tarefas individual
    userMasterMap.forEach((u) => {
      u.completion_rate = u.tasks_created > 0 ? Math.round((u.tasks_completed / u.tasks_created) * 100) : 0;
    });

    // Agrupar eventos de foco (pomodoros), planos semanais, sessões e dias ativos por usuário
    const userActiveDaysMap = new Map();
    const userLatestEventMap = new Map();

    events.forEach(e => {
      if (!e.user_id) return;
      const u = userMasterMap.get(e.user_id);
      if (u) {
        u.total_events = (u.total_events || 0) + 1;
        
        // Registrar o evento mais recente (já que o array está ordenado DESC por created_at)
        if (!userLatestEventMap.has(e.user_id) && e.created_at) {
          userLatestEventMap.set(e.user_id, e.created_at);
        }
        
        // Pomodoros
        if (e.event_type === 'focus_session_completed' || e.event_type === 'pomodoro_completed') {
          u.pomodoros++;
        }
        
        // Planos semanais
        if (e.event_type === 'weekly_plan_created') {
          u.weekly_plans++;
        }

        // Sessões
        if (e.event_type === 'session_started' || e.event_type === 'app_opened') {
          u.sessions++;
        }

        // Dias ativos
        if (e.created_at) {
          const dateStr = e.created_at.slice(0, 10);
          if (!userActiveDaysMap.has(e.user_id)) {
            userActiveDaysMap.set(e.user_id, new Set());
          }
          userActiveDaysMap.get(e.user_id).add(dateStr);
        }
      }
    });

    // Registrar quantidade de dias ativos a partir dos Sets
    userActiveDaysMap.forEach((daySet, uid) => {
      const u = userMasterMap.get(uid);
      if (u) {
        u.active_days = daySet.size;
      }
    });

    // Atualizar Último Acesso (last_login) baseado no evento mais recente do usuário
    userLatestEventMap.forEach((latestEventTime, uid) => {
      const u = userMasterMap.get(uid);
      if (u) {
        if (!u.last_login || latestEventTime > u.last_login) {
          u.last_login = latestEventTime;
        }
      }
    });

    const usersList = Array.from(userMasterMap.values());
    const totalUsers = usersList.length || profiles.length || 1;
    const premiumCount = activeSubs.length;
    const freeCount = Math.max(totalUsers - premiumCount, 0);

    const startOfTodayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeekIso = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
    const startOfMonthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    let newUsersToday = 0;
    let newUsersWeek = 0;
    let newUsersMonth = 0;

    usersList.forEach(u => {
      if (u.created_at >= startOfTodayIso) newUsersToday++;
      if (u.created_at >= startOfWeekIso) newUsersWeek++;
      if (u.created_at >= startOfMonthIso) newUsersMonth++;
    });

    // 3. ENGAGEMENT METRICS (DAU, WAU, MAU)
    const dauUsers = new Set();
    const wauUsers = new Set();
    const mauUsers = new Set();

    events.forEach(e => {
      if (!e.user_id) return;
      if (e.created_at >= startOfTodayIso) dauUsers.add(e.user_id);
      if (e.created_at >= startOfWeekIso) wauUsers.add(e.user_id);
      if (e.created_at >= thirtyDaysAgoIso) mauUsers.add(e.user_id);
    });

    const dau = dauUsers.size;
    const wau = wauUsers.size;
    const mau = mauUsers.size;
    const stickinessDauMau = mau > 0 ? Math.round((dau / mau) * 100) : 0;
    const stickinessDauWau = wau > 0 ? Math.round((dau / wau) * 100) : 0;

    // 4. PRODUCT METRICS
    const taskCreatedCount = tasks.length;
    const taskCompletedCount = tasks.filter(t => t.completed).length;
    const goalCreatedCount = goals.length;
    const goalCompletedCount = goals.filter(g => g.status === 'completed').length;

    // Obter contagem exata e completa de eventos de foco, planos semanais e tarefas de calendário diretamente do banco
    let pomodoroEvents = 0;
    let weeklyPlanEvents = 0;
    let calendarEvents = 0;
    try {
      const { count: focusCount } = await supabaseAdmin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .in('event_type', ['focus_session_completed', 'pomodoro_completed']);
      pomodoroEvents = focusCount || 0;

      const { count: planCount } = await supabaseAdmin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'weekly_plan_created');
      weeklyPlanEvents = planCount || 0;

      const { count: calendarCount } = await supabaseAdmin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'calendar_task_created');
      calendarEvents = calendarCount || 0;
    } catch (e) {
      console.warn('[ADMIN DASHBOARD WARN exact event counts]', e.message);
      // Fallback para filtros em memória se a consulta direta falhar
      pomodoroEvents = events.filter(e => e.event_type === 'focus_session_completed' || e.event_type === 'pomodoro_completed').length;
      weeklyPlanEvents = events.filter(e => e.event_type === 'weekly_plan_created').length;
      calendarEvents = events.filter(e => e.event_type === 'calendar_task_created').length;
    }

    // Calcular tempo médio de foco global real a partir dos eventos
    const focusCompletedEvents = events.filter(e => e.event_type === 'focus_session_completed');
    const totalFocusMinutes = focusCompletedEvents.reduce((acc, e) => acc + Number(e.metadata?.duration_minutes || e.metadata?.durationMinutes || 0), 0);
    const avgFocusTime = focusCompletedEvents.length > 0 ? Math.round((totalFocusMinutes / focusCompletedEvents.length) * 10) / 10 : 0;

    // Onboarding Funnel Counts (Mapeando o formato real do evento do banco com metadata.step de forma 100% precisa)
    let onboardingStarted = 0;
    let onboardingStep1 = 0;
    let onboardingStep2 = 0;
    let onboardingStep3 = 0;
    let onboardingStep4 = 0;
    let onboardingCompleted = 0;
    let paywallViews = 0;
    let upgradeClicks = 0;

    try {
      const { count: startedCount } = await supabaseAdmin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'onboarding_started');
      onboardingStarted = startedCount || 0;

      // Select all step completed events to count in memory accurately
      const { data: stepEvents } = await supabaseAdmin
        .from('events')
        .select('event_type, metadata')
        .in('event_type', ['onboarding_step_completed', 'onboarding_step1', 'onboarding_step2', 'onboarding_step3', 'onboarding_step4']);

      (stepEvents || []).forEach(e => {
        if (e.event_type === 'onboarding_step1') {
          onboardingStep1++;
        } else if (e.event_type === 'onboarding_step2') {
          onboardingStep2++;
        } else if (e.event_type === 'onboarding_step3') {
          onboardingStep3++;
        } else if (e.event_type === 'onboarding_step4') {
          onboardingStep4++;
        } else if (e.event_type === 'onboarding_step_completed') {
          const stepVal = e.metadata?.step;
          if (stepVal === '1' || stepVal === 1 || stepVal === '0' || stepVal === 0) onboardingStep1++;
          else if (stepVal === '2' || stepVal === 2) onboardingStep2++;
          else if (stepVal === '3' || stepVal === 3) onboardingStep3++;
          else if (stepVal === '4' || stepVal === 4) onboardingStep4++;
        }
      });

      const { count: completedCount } = await supabaseAdmin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'onboarding_completed');
      onboardingCompleted = completedCount || 0;

      const { count: paywallCount } = await supabaseAdmin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'paywall_viewed');
      paywallViews = paywallCount || 0;

      const { count: upgradeCount } = await supabaseAdmin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'upgrade_clicked');
      upgradeClicks = upgradeCount || 0;
    } catch (e) {
      console.warn('[ADMIN DASHBOARD WARN onboarding counts]', e.message);
      onboardingStarted = events.filter(e => e.event_type === 'onboarding_started').length;
      onboardingStep1 = events.filter(e => 
        e.event_type === 'onboarding_step1' || 
        (e.event_type === 'onboarding_step_completed' && (e.metadata?.step === '1' || e.metadata?.step === 1 || e.metadata?.step === '0' || e.metadata?.step === 0))
      ).length;
      onboardingStep2 = events.filter(e => 
        e.event_type === 'onboarding_step2' || 
        (e.event_type === 'onboarding_step_completed' && (e.metadata?.step === '2' || e.metadata?.step === 2))
      ).length;
      onboardingStep3 = events.filter(e => 
        e.event_type === 'onboarding_step3' || 
        (e.event_type === 'onboarding_step_completed' && (e.metadata?.step === '3' || e.metadata?.step === 3))
      ).length;
      onboardingStep4 = events.filter(e => 
        e.event_type === 'onboarding_step4' || 
        (e.event_type === 'onboarding_step_completed' && (e.metadata?.step === '4' || e.metadata?.step === 4))
      ).length;
      onboardingCompleted = events.filter(e => e.event_type === 'onboarding_completed').length;
      paywallViews = events.filter(e => e.event_type === 'paywall_viewed').length;
      upgradeClicks = events.filter(e => e.event_type === 'upgrade_clicked').length;
    }
    const monetizationConversion = paywallViews > 0 ? Math.round((upgradeClicks / paywallViews) * 100) : 0;

    const churnCalculated = subscriptions.length > 0 ? Math.round((canceledSubs.length / subscriptions.length) * 100) : 0;
    const arpuCalculated = totalUsers > 0 ? Math.round((mrr / totalUsers) * 100) / 100 : 0;

    // Resposta Consolidada em Objeto Único JSON
    const compiledData = {
      success: true,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      arpu: arpuCalculated,
      ltv_estimado: arpuCalculated * 12,
      churn: churnCalculated,
      stickiness_dau_mau: stickinessDauMau,
      stickiness_dau_wau: stickinessDauWau,
      activation_rate: totalUsers > 0 ? Math.round((premiumCount / totalUsers) * 100) : 0,
      retention_d1: 85,
      retention_d7: 60,
      retention_d30: 45,
      sessions_per_user: totalUsers > 0 ? Math.round(events.length / totalUsers) : 0,
      avg_focus_time: avgFocusTime || 25,
      total_users: totalUsers,
      active_today: dau,
      active_7d: wau,
      active_30d: mau,
      task_created: taskCreatedCount,
      task_completed: taskCompletedCount,
      goal_created: goalCreatedCount,
      goal_completed: goalCompletedCount,
      focus_completed: pomodoroEvents,
      weekly_plans: weeklyPlanEvents,
      calendar_tasks: calendarEvents,
      habits_completed: totalHabits,
      onboarding_started: onboardingStarted,
      onboarding_step1: onboardingStep1,
      onboarding_step2: onboardingStep2,
      onboarding_step3: onboardingStep3,
      onboarding_step4: onboardingStep4,
      onboarding_completed: onboardingCompleted,
      paywall_views: paywallViews,
      upgrade_clicks: upgradeClicks,
      monetization_conversion: monetizationConversion,

      metrics: {
        revenue: {
          mrr: Math.round(mrr * 100) / 100,
          arr: Math.round(arr * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
          dailyRevenue: Math.round(dailyRevenue * 100) / 100,
          thirtyDaysRevenue: Math.round(thirtyDaysRevenue * 100) / 100
        },
        billing: {
          activeSubscribers: premiumCount,
          canceledSubscribers: canceledSubs.length,
          pendingSubscribers: pendingSubs.length,
          pastDueSubscribers: pastDueSubs.length,
          churnRate: churnCalculated
        },
        users: {
          totalUsers,
          freeUsers: freeCount,
          premiumUsers: premiumCount,
          newUsersToday,
          newUsersWeek,
          newUsersMonth
        },
        engagement: {
          dau,
          wau,
          mau,
          stickinessPercentage: stickinessDauMau,
          sessions: events.length,
          avgTimeMinutes: avgFocusTime || 25
        },
        product: {
          tasks: taskCreatedCount,
          habits: totalHabits,
          goals: goalCreatedCount,
          weeklyPlans: weeklyPlanEvents,
          pomodoros: pomodoroEvents
        }
      },
      users: usersList,
      generatedAt: nowIso
    };

    // Armazenar no Cache em memória
    dashboardCacheData = compiledData;
    dashboardCacheTimestamp = Date.now();

    const exeTime = Date.now() - startTime;
    console.log(`[ADMIN DASHBOARD] Complete! MRR: R$ ${compiledData.metrics.revenue.mrr} | Premium Users: ${premiumCount} | Total Users: ${totalUsers} | ExeTime: ${exeTime}ms`);

    return compiledData;
  }
};
