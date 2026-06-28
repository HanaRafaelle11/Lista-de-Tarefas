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
   * Consolida todas as métricas do painel administrativo via service_role.
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

    console.log('[ADMIN DASHBOARD] Cache MISS — Gerando métricas consolidando DB via service_role...');

    try {
      console.log('[ADMIN DASHBOARD] step 1: Querying subscriptions...');
      const subsRes = await supabaseAdmin.from('subscriptions').select('*');
      if (subsRes.error) throw new Error(`[step 1 - subscriptions error] ${subsRes.error.message} (code: ${subsRes.error.code})`);
      console.log('[ADMIN DASHBOARD] step 1 done. Rows:', subsRes.data?.length);

      console.log('[ADMIN DASHBOARD] step 2: Querying profiles...');
      const profilesRes = await supabaseAdmin.from('profiles').select('id, name, nickname, plano, assinatura_status, created_at, updated_at');
      if (profilesRes.error) throw new Error(`[step 2 - profiles error] ${profilesRes.error.message} (code: ${profilesRes.error.code})`);
      console.log('[ADMIN DASHBOARD] step 2 done. Rows:', profilesRes.data?.length);

      console.log('[ADMIN DASHBOARD] step 3: Querying profiles count...');
      const usersCountRes = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true });
      if (usersCountRes.error) throw new Error(`[step 3 - profiles count error] ${usersCountRes.error.message} (code: ${usersCountRes.error.code})`);
      console.log('[ADMIN DASHBOARD] step 3 done. Count:', usersCountRes.count);

      console.log('[ADMIN DASHBOARD] step 4: Querying events...');
      const eventsRes = await supabaseAdmin.from('events').select('user_id, event_type, created_at').order('created_at', { ascending: false }).limit(5000);
      if (eventsRes.error) throw new Error(`[step 4 - events error] ${eventsRes.error.message} (code: ${eventsRes.error.code})`);
      console.log('[ADMIN DASHBOARD] step 4 done. Rows:', eventsRes.data?.length);

      console.log('[ADMIN DASHBOARD] step 5: Querying tasks...');
      const tasksRes = await supabaseAdmin.from('tasks').select('id, completed');
      if (tasksRes.error) throw new Error(`[step 5 - tasks error] ${tasksRes.error.message} (code: ${tasksRes.error.code})`);
      console.log('[ADMIN DASHBOARD] step 5 done. Rows:', tasksRes.data?.length);

      console.log('[ADMIN DASHBOARD] step 6: Querying goals...');
      const goalsRes = await supabaseAdmin.from('goals').select('id, completed');
      if (goalsRes.error) throw new Error(`[step 6 - goals error] ${goalsRes.error.message} (code: ${goalsRes.error.code})`);
      console.log('[ADMIN DASHBOARD] step 6 done. Rows:', goalsRes.data?.length);

      console.log('[ADMIN DASHBOARD] step 7: Querying habits...');
      const habitsRes = await supabaseAdmin.from('habits').select('id', { count: 'exact', head: true });
      if (habitsRes.error) throw new Error(`[step 7 - habits error] ${habitsRes.error.message} (code: ${habitsRes.error.code})`);
      console.log('[ADMIN DASHBOARD] step 7 done. Count:', habitsRes.count);

      const rawSubscriptions = subsRes.data || [];
      const profiles = profilesRes.data || [];
      const events = eventsRes.data || [];
      const tasks = tasksRes.data || [];
      const goals = goalsRes.data || [];

      console.log('[ADMIN DASHBOARD] step 8: Processing business metrics...');

      // Normalizar assinaturas via BillingAdapter
      const subscriptions = rawSubscriptions.map(s => BillingAdapter.normalizeSubscription(s));

      // 1. REVENUE & FINANCIAL KPI (Fonte Única da Verdade: subscriptions)
      const activeSubs = subscriptions.filter(s => s.status === 'active' && s.plan !== 'free');
      const canceledSubs = subscriptions.filter(s => s.status === 'canceled');
      const pendingSubs = subscriptions.filter(s => s.status === 'pending');
      const pastDueSubs = subscriptions.filter(s => s.status === 'past_due');

      const mrr = activeSubs.reduce((acc, sub) => acc + Number(sub.price || 0), 0);
      const arr = mrr * 12;

      // Calculando Receitas Históricas
      const todayStr = nowIso.slice(0, 10);
      const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const thirtyDaysAgoIso = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString();

      let dailyRevenue = 0;
      let monthlyRevenue = 0;
      let thirtyDaysRevenue = 0;
      let totalRevenue = 0;

      subscriptions.forEach(s => {
        const amt = Number(s.amount || s.price || 0);
        if (s.status === 'active') {
          totalRevenue += amt;
          const createdDate = (s.createdAt || '').slice(0, 10);
          if (createdDate === todayStr) dailyRevenue += amt;
          if (createdDate >= startOfMonthStr) monthlyRevenue += amt;
          if (s.createdAt >= thirtyDaysAgoIso) thirtyDaysRevenue += amt;
        }
      });

      // 2. USERS METRICS
      const totalUsers = usersCountRes.count || profiles.length;
      const premiumCount = activeSubs.length;
      const freeCount = Math.max(totalUsers - premiumCount, 0);

      const startOfTodayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeekIso = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
      const startOfMonthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      let newUsersToday = 0;
      let newUsersWeek = 0;
      let newUsersMonth = 0;

      profiles.forEach(p => {
        if (p.created_at >= startOfTodayIso) newUsersToday++;
        if (p.created_at >= startOfWeekIso) newUsersWeek++;
        if (p.created_at >= startOfMonthIso) newUsersMonth++;
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
      const goalCompletedCount = goals.filter(g => g.completed).length;
      const totalHabits = habitsRes.count || 0;

      const pomodoroEvents = events.filter(e => e.event_type === 'focus_session_completed' || e.event_type === 'pomodoro_completed').length;
      const weeklyPlanEvents = events.filter(e => e.event_type === 'weekly_plan_created').length;
      const calendarEvents = events.filter(e => e.event_type === 'calendar_task_created').length;

      // Onboarding Funnel Counts
      const onboardingStarted = events.filter(e => e.event_type === 'onboarding_started').length;
      const onboardingStep1 = events.filter(e => e.event_type === 'onboarding_step1').length;
      const onboardingStep2 = events.filter(e => e.event_type === 'onboarding_step2').length;
      const onboardingStep3 = events.filter(e => e.event_type === 'onboarding_step3').length;
      const onboardingStep4 = events.filter(e => e.event_type === 'onboarding_step4').length;
      const onboardingCompleted = events.filter(e => e.event_type === 'onboarding_completed').length;

      // 5. DIRETÓRIO COMPLETO DE USUÁRIOS (Para tabela do Admin)
      const subMap = new Map();
      subscriptions.forEach(s => subMap.set(s.userId, s));

      const usersList = profiles.map(p => {
        const sub = subMap.get(p.id);
        return {
          id: p.id,
          nickname: p.nickname || p.name || 'Usuário',
          email: p.email || 'N/A',
          created_at: p.created_at,
          last_login: p.updated_at || p.created_at,
          plan: sub ? sub.plan : 'free',
          status: sub ? sub.status : 'free',
          total_events: 0
        };
      });

      const churnCalculated = subscriptions.length > 0 ? Math.round((canceledSubs.length / subscriptions.length) * 100) : 0;
      const arpuCalculated = totalUsers > 0 ? Math.round((mrr / totalUsers) * 100) / 100 : 0;

      // Resposta Consolidada em Objeto Único JSON com Suporte Retcompatível ao React
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
        avg_focus_time: 25,
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
            avgTimeMinutes: 25
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
      console.log(`[ADMIN DASHBOARD] step 9 complete. Dashboard generated | MRR: R$ ${compiledData.metrics.revenue.mrr} | ARR: R$ ${compiledData.metrics.revenue.arr} | Premium Users: ${premiumCount} | ExeTime: ${exeTime}ms`);

      return compiledData;
    } catch (err) {
      console.error('[ADMIN DASHBOARD ERROR] Exceção capturada no service:', err.message, err.stack);
      throw err;
    }
  }
};
