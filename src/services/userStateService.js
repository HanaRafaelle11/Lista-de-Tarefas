/**
 * userStateService.js — Inteligência de estado do usuário
 *
 * Deriva automaticamente o estágio comportamental do usuário
 * com base em eventos e atividade — sem nenhum input manual.
 *
 * Estágios:
 *   new       → sem onboarding OU sem task concluída
 *   activated → onboarding + 1ª task concluída, ativo ≤3d
 *   engaged   → ≥5 tasks concluídas, ativo ≤7d
 *   at_risk   → sem atividade 7d–30d
 *   churned   → sem atividade >30d
 *
 * Activation Score (0–100):
 *   +20 onboarding_completed
 *   +20 primeira task_created
 *   +30 primeira task_completed (= first_success_action)
 *   +15 hábito criado
 *   +15 objetivo criado
 */

import { supabase } from '../supabaseClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} UserState
 * @property {'new'|'activated'|'engaged'|'at_risk'|'churned'} stage
 * @property {number} activation_score        — 0–100
 * @property {string|null} last_success_action — ISO timestamp
 * @property {number|null} time_to_value_ms   — ms até 1ª vitória
 * @property {number} days_since_active        — dias desde última ação
 * @property {boolean} has_first_success       — completou pelo menos 1 task
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysSince(isoString) {
  if (!isoString) return Infinity;
  return (Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60 * 24);
}

function getLocalEvents(userId) {
  try {
    return JSON.parse(localStorage.getItem(`flowday_events_${userId}`) || '[]');
  } catch {
    return [];
  }
}

// ─── Computação de Activation Score ──────────────────────────────────────────
function computeActivationScore(events) {
  let score = 0;
  const types = new Set(events.map(e => e.event_type));

  if (types.has('onboarding_completed'))                               score += 20;
  if (types.has('task_created'))                                       score += 20;
  if (types.has('task_completed') || types.has('first_success_action')) score += 30;
  if (types.has('habit_created'))                                      score += 15;
  if (types.has('goal_created'))                                       score += 15;

  return Math.min(score, 100);
}

// ─── Derivação de Stage ───────────────────────────────────────────────────────
function deriveStage(events, daysSinceActive) {
  const types = new Set(events.map(e => e.event_type));

  const hasOnboarding   = types.has('onboarding_completed');
  const hasFirstSuccess = types.has('first_success_action') || types.has('task_completed');
  const completedCount  = events.filter(e =>
    e.event_type === 'task_completed' || e.event_type === 'first_success_action'
  ).length;

  if (daysSinceActive > 30) return 'churned';
  if (daysSinceActive > 7)  return 'at_risk';
  if (!hasOnboarding || !hasFirstSuccess) return 'new';
  if (completedCount >= 5)  return 'engaged';
  return 'activated';
}

// ─── API Principal ────────────────────────────────────────────────────────────

/**
 * Computa o estado do usuário.
 * Usa Supabase quando disponível; fallback para localStorage.
 *
 * @param {string} userId
 * @returns {Promise<UserState>}
 */
export async function computeUserState(userId) {
  if (!userId) return defaultUserState();

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
      events = getLocalEvents(userId);
    }
  } catch {
    events = getLocalEvents(userId);
  }

  return deriveUserState(events);
}

/**
 * Deriva o estado do usuário a partir de uma lista de eventos.
 * Pode ser chamada sincronamente com eventos já carregados.
 *
 * @param {Array} events
 * @returns {UserState}
 */
export function deriveUserState(events) {
  if (!events || events.length === 0) return defaultUserState();

  // Último evento (atividade mais recente)
  const sorted = [...events].sort((a, b) =>
    new Date(b.created_at || b.enqueuedAt || 0) - new Date(a.created_at || a.enqueuedAt || 0)
  );
  const lastEvent       = sorted[0];
  const daysSinceActive = daysSince(lastEvent?.created_at || lastEvent?.enqueuedAt);

  // First success action
  const firstSuccess = events.find(e =>
    e.event_type === 'first_success_action' || e.event_type === 'task_completed'
  );

  // Signup event
  const signup = events.find(e =>
    e.event_type === 'signup_completed' || e.event_type === 'signup'
  );

  // Time to Value
  let timeToValueMs = null;
  if (signup && firstSuccess) {
    const diff = new Date(firstSuccess.created_at) - new Date(signup.created_at);
    if (diff > 0) timeToValueMs = diff;
  }

  const activationScore = computeActivationScore(events);
  const stage           = deriveStage(events, daysSinceActive);

  return {
    stage,
    activation_score:      activationScore,
    last_success_action:   firstSuccess?.created_at || null,
    time_to_value_ms:      timeToValueMs,
    days_since_active:     Math.floor(daysSinceActive),
    has_first_success:     !!firstSuccess,
  };
}

function defaultUserState() {
  return {
    stage:               'new',
    activation_score:    0,
    last_success_action: null,
    time_to_value_ms:    null,
    days_since_active:   0,
    has_first_success:   false,
  };
}

// ─── Labels para UI ───────────────────────────────────────────────────────────

export const STAGE_LABELS = {
  new:       { label: 'Novo',       color: '#6366f1', iconName: 'seedling' },
  activated: { label: 'Ativado',    color: '#10b981', iconName: 'bolt' },
  engaged:   { label: 'Engajado',   color: '#f59e0b', iconName: 'fire' },
  at_risk:   { label: 'Em Risco',   color: '#ef4444', iconName: 'warning' },
  churned:   { label: 'Inativo',    color: '#6b7280', iconName: 'zzz' },
};

export function getUserStageLabel(stage) {
  return STAGE_LABELS[stage] || STAGE_LABELS.new;
}
