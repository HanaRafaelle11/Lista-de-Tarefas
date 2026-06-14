/**
 * analyticsService.js — Métricas de produto computadas automaticamente
 *
 * Computa métricas SaaS a partir dos eventos do Supabase ou localStorage.
 * Nunca bloqueia: se Supabase offline, usa apenas eventos locais.
 *
 * Métricas:
 * - activationRate      → % users que completaram task após signup
 * - timeToValue         → ms entre signup_completed → first_success_action
 * - retentionD1         → voltou no dia seguinte ao signup
 * - retentionD7         → voltou 7 dias após signup
 * - engagementScore     → eventos nos últimos 7d / média global
 * - taskCompletionRate  → tasks_completed / tasks_created (7d)
 */

import { supabase } from '../supabaseClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysDiff(dateA, dateB) {
  return Math.abs(new Date(dateA) - new Date(dateB)) / (1000 * 60 * 60 * 24);
}

/**
 * Lê eventos do localStorage para um usuário (fallback offline).
 */
function getLocalEvents(userId) {
  try {
    return JSON.parse(localStorage.getItem(`flowday_events_${userId}`) || '[]');
  } catch {
    return [];
  }
}

// ─── Computação de Métricas Individuais ──────────────────────────────────────

/**
 * Time to Value: ms entre signup_completed → first_success_action
 * Retorna null se não houver ambos os eventos.
 */
export function computeTimeToValue(events) {
  const signup = events.find(e =>
    e.event_type === 'signup_completed' || e.event_type === 'signup'
  );
  const firstSuccess = events.find(e =>
    e.event_type === 'first_success_action' || e.event_type === 'task_completed'
  );
  if (!signup || !firstSuccess) return null;
  const diff = new Date(firstSuccess.created_at) - new Date(signup.created_at);
  return diff > 0 ? diff : null;
}

/**
 * Task Completion Rate nos últimos N dias.
 */
export function computeTaskCompletionRate(events, days = 7) {
  const cutoff = daysAgo(days);
  const recent = events.filter(e => new Date(e.created_at || e.enqueuedAt) >= cutoff);
  const created   = recent.filter(e => e.event_type === 'task_created').length;
  const completed = recent.filter(e =>
    e.event_type === 'task_completed' || e.event_type === 'first_success_action'
  ).length;
  if (created === 0) return null;
  return Math.round((completed / created) * 100);
}

/**
 * Engagement Score: eventos nos últimos 7d normalizado por dias ativos.
 */
export function computeEngagementScore(events) {
  const cutoff = daysAgo(7);
  const recent = events.filter(e => new Date(e.created_at || e.enqueuedAt) >= cutoff);
  // Dias distintos com pelo menos 1 evento
  const days = new Set(
    recent.map(e => (e.created_at || e.enqueuedAt || '').split('T')[0])
  ).size;
  // Score: (eventos / 7d) * peso de atividade diária
  const eventScore  = Math.min(recent.length / 3, 100); // 3 eventos/dia = 100%
  const daysScore   = Math.min(days / 7, 1) * 100;
  return Math.round((eventScore * 0.6 + daysScore * 0.4));
}

/**
 * Retention D1: teve sessão no dia seguinte ao signup.
 */
export function computeRetentionD1(events) {
  const signup = events.find(e =>
    e.event_type === 'signup_completed' || e.event_type === 'signup'
  );
  if (!signup) return false;
  const signupDate = new Date(signup.created_at);
  return events.some(e => {
    const diff = daysDiff(e.created_at, signupDate);
    return diff >= 1 && diff < 2 && e.event_type !== 'signup_completed';
  });
}

/**
 * Retention D7: teve sessão 7 dias após signup.
 */
export function computeRetentionD7(events) {
  const signup = events.find(e =>
    e.event_type === 'signup_completed' || e.event_type === 'signup'
  );
  if (!signup) return false;
  const signupDate = new Date(signup.created_at);
  return events.some(e => {
    const diff = daysDiff(e.created_at, signupDate);
    return diff >= 7 && diff < 8;
  });
}

// ─── API Principal ────────────────────────────────────────────────────────────

/**
 * Computa todas as métricas para um usuário.
 * Usa Supabase quando disponível; fallback para localStorage.
 *
 * @param {string} userId
 * @returns {Promise<AnalyticsMetrics>}
 */
export async function computeUserMetrics(userId) {
  if (!userId) return null;

  let events = [];

  try {
    const { data, error } = await supabase
      .from('events')
      .select('event_type, created_at, metadata')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!error && data?.length > 0) {
      events = data;
    } else {
      // Fallback: eventos locais
      events = getLocalEvents(userId);
    }
  } catch {
    events = getLocalEvents(userId);
  }

  if (events.length === 0) {
    return {
      timeToValue:         null,
      taskCompletionRate:  null,
      engagementScore:     0,
      retentionD1:         false,
      retentionD7:         false,
      totalEvents:         0,
      dataSource:          'empty',
    };
  }

  return {
    timeToValue:         computeTimeToValue(events),
    taskCompletionRate:  computeTaskCompletionRate(events),
    engagementScore:     computeEngagementScore(events),
    retentionD1:         computeRetentionD1(events),
    retentionD7:         computeRetentionD7(events),
    totalEvents:         events.length,
    dataSource:          'supabase',
  };
}

/**
 * Computa métricas globais (para o AdminDashboard).
 * Apenas admins têm acesso.
 *
 * @returns {Promise<GlobalMetrics>}
 */
export async function computeGlobalMetrics() {
  try {
    // Total de usuários com pelo menos 1 task_completed
    const { data: activatedUsers } = await supabase
      .from('events')
      .select('user_id')
      .eq('event_type', 'task_completed');

    const { data: allSignups } = await supabase
      .from('events')
      .select('user_id')
      .in('event_type', ['signup', 'signup_completed']);

    const activated = new Set((activatedUsers || []).map(e => e.user_id)).size;
    const total     = new Set((allSignups    || []).map(e => e.user_id)).size;

    const activationRate = total > 0 ? Math.round((activated / total) * 100) : 0;

    return {
      activationRate,
      activatedUsers: activated,
      totalSignups:   total,
    };
  } catch (err) {
    console.warn('[analyticsService] Erro ao computar métricas globais:', err.message);
    return { activationRate: null, activatedUsers: null, totalSignups: null };
  }
}
