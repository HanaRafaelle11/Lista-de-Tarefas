/**
 * eventBatcher.js — Batching e bufferização de eventos analíticos
 *
 * Em vez de disparar um insert no Supabase para cada clique ou página vista,
 * o eventBatcher acumula os eventos em IndexedDB e no buffer em memória.
 * Dispara o flush para o Supabase:
 * - A cada 15 segundos, ou
 * - Quando o buffer atinge 15 eventos
 *
 * Se o envio do lote falhar (offline), o eventBatcher joga os eventos na fila
 * de syncQueue para que sejam sincronizados no retry exponencial.
 */

import { supabase, getApiUrl } from '../supabaseClient';
import { localDB } from '../db/localDB';
import { enqueue, generateId } from './syncQueue';

const BATCH_LIMIT = 15;
const FLUSH_INTERVAL_MS = 15_000;

let memoryBuffer = [];
let flushTimer = null;
let isFlushing = false;
let currentSessionToken = null;

// Keep track of auth session token for pagehide/visibilitychange fetch keepalive
if (supabase && supabase.auth) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) currentSessionToken = session.access_token;
  }).catch(() => {});

  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      currentSessionToken = session.access_token;
    } else {
      currentSessionToken = null;
    }
  });
}

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0.1';

// Inicializa o batcher restaurando eventos pendentes do IndexedDB
export async function initEventBatcher() {
  try {
    const savedEvents = await localDB.getAll('events');
    memoryBuffer = savedEvents || [];
    console.log('[eventBatcher] Inicializado com', memoryBuffer.length, 'eventos restaurados');
    
    // Inicia o timer recorrente de flush
    setupTimer();
  } catch (err) {
    console.warn('[eventBatcher] Erro ao carregar eventos locais:', err.message);
    setupTimer();
  }
}

function setupTimer() {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = setInterval(flushBatch, FLUSH_INTERVAL_MS);
}

export async function trackEvent(userId, eventType, metadata = {}) {
  if (!userId) return;

  // Evita registrar eventos analíticos para usuários demo ou ids inválidos (não-UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (userId === 'demo-user' || !uuidRegex.test(userId)) {
    return;
  }

  // Map legacy event types to new snake_case format (Objeto + Ação no passado)
  let normalizedType = eventType;
  const eventMappings = {
    'signup': 'user_signed_up',
    'signup_completed': 'user_signed_up',
    'login': 'user_logged_in',
    'logout': 'user_logged_out',
    'weekly_plan_saved': 'weekly_plan_created',
    'weekly_plan_viewed': 'weekly_plan_opened',
    'calendar_viewed': 'calendar_opened',
    'focus_started': 'focus_session_started',
    'focus_completed': 'focus_session_completed',
    'pomodoro_completed': 'focus_session_completed',
    'focus_session_completed': 'focus_session_completed',
    'focus_timer_paused': 'focus_session_paused',
    'focus_timer_reset': 'focus_session_cancelled'
  };

  if (eventMappings[eventType]) {
    normalizedType = eventMappings[eventType];
  }

  // Auto-enrich metadata with platform, device, screen, and app version
  const getDeviceType = () => {
    if (typeof window === 'undefined') return 'server';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  };

  const getScreenName = () => {
    if (typeof window === 'undefined') return '';
    return window.location.pathname + (window.location.hash || '');
  };

  const enrichedMetadata = {
    ...metadata,
    platform: 'web',
    device_type: getDeviceType(),
    screen: getScreenName(),
    app_version: APP_VERSION,
    timestamp: new Date().toISOString()
  };

  const event = {
    id: generateId(),
    user_id: userId,
    event_type: normalizedType,
    metadata: enrichedMetadata,
    created_at: enrichedMetadata.timestamp
  };

  memoryBuffer.push(event);

  // Salva no IndexedDB imediatamente para garantia no-data-loss se o browser fechar
  try {
    await localDB.put('events', event);
  } catch (err) {
    console.warn('[eventBatcher] Erro ao salvar evento no cache local:', err.message);
  }

  // Se atingiu o limite de batch, executa o flush imediatamente
  if (memoryBuffer.length >= BATCH_LIMIT) {
    flushBatch();
  }
}

/**
 * Envia o lote de eventos para o Supabase.
 */
export async function flushBatch() {
  if (isFlushing) return;
  if (memoryBuffer.length === 0) return;

  isFlushing = true;
  const batchToSend = [...memoryBuffer];
  memoryBuffer = []; // Limpa o buffer ativo imediatamente para evitar concorrência

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  // Separa eventos válidos dos inválidos (não-UUID ou demo-user)
  const validEvents = batchToSend.filter(e => e.user_id && e.user_id !== 'demo-user' && uuidRegex.test(e.user_id));
  const invalidEvents = batchToSend.filter(e => !e.user_id || e.user_id === 'demo-user' || !uuidRegex.test(e.user_id));

  // Purga imediatamente os eventos inválidos do IndexedDB para evitar loops infinitos
  if (invalidEvents.length > 0) {
    console.log('[eventBatcher] Purgando', invalidEvents.length, 'eventos demo ou inválidos do cache local');
    for (const item of invalidEvents) {
      localDB.delete('events', item.id).catch(() => {});
    }
  }

  if (validEvents.length === 0) {
    isFlushing = false;
    return;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('[eventBatcher] Offline: mantendo', validEvents.length, 'eventos no buffer/IndexedDB');
    memoryBuffer = [...validEvents, ...memoryBuffer];
    isFlushing = false;
    return;
  }

  try {
    let payload = validEvents.map(e => ({
      id: e.id,
      user_id: e.user_id,
      event_type: e.event_type,
      metadata: e.metadata,
      created_at: e.created_at
    }));

    payload = payload.filter(e => !!e.user_id);

    if (payload.length === 0) {
       console.log("[EVENTS] skipped empty payload");
       isFlushing = false;
       return;
    }

    try {
      const authUserRes = await supabase.auth.getUser().catch(() => null);
      console.log("[EVENT INSERT]", {
        file: "src/services/eventBatcher.js",
        user_id: payload[0]?.user_id,
        auth_uid: authUserRes?.data?.user?.id || null,
        payload: payload
      });
    } catch (logErr) {}

    const headers = {
      'Content-Type': 'application/json'
    };
    if (currentSessionToken) {
      headers['Authorization'] = `Bearer ${currentSessionToken}`;
    }

    const response = await fetch(getApiUrl('/api/events/log'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: payload })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }
    
    // Deleta do IndexedDB apenas após confirmação de sucesso
    for (const item of validEvents) {
      localDB.delete('events', item.id).catch(() => {});
    }
    console.log('[eventBatcher] Batch enviado com sucesso:', validEvents.length, 'eventos');
  } catch (err) {
    console.warn('[eventBatcher] Erro ao enviar batch pro Supabase. Retornando ao buffer:', err.message);
    // Retorna os eventos falhos para a fila
    memoryBuffer = [...validEvents, ...memoryBuffer];
  } finally {
    isFlushing = false;
  }
}

// Fallback to sendBeacon helper
const fallbackToBeacon = (payload, batchToSend) => {
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const beaconUrl = getApiUrl('/api/events/log');
    const blob = new Blob([JSON.stringify({ events: payload })], { type: 'application/json' });
    const sent = navigator.sendBeacon(beaconUrl, blob);
    if (sent) {
      for (const item of batchToSend) {
        localDB.delete('events', item.id).catch(() => {});
      }
    }
  }
};

// Escuta eventos de encerramento da página para forçar sincronização final via keepalive fetch
let handlePageUnload;
if (typeof window !== 'undefined') {
  handlePageUnload = () => {
    if (memoryBuffer.length === 0) return;

    const batchToSend = [...memoryBuffer];
    memoryBuffer = []; // Limpar buffer

    const payload = batchToSend.map(e => ({
      id: e.id,
      user_id: e.user_id,
      event_type: e.event_type,
      metadata: e.metadata,
      created_at: e.created_at
    })).filter(e => e.user_id);

    if (payload.length === 0) return;

    let fetchSuccess = false;
    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      if (currentSessionToken) {
        headers['Authorization'] = `Bearer ${currentSessionToken}`;
      }

      fetch(getApiUrl('/api/events/log'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ events: payload }),
        keepalive: true
      }).then(res => {
        if (res.ok) {
          for (const item of batchToSend) {
            localDB.delete('events', item.id).catch(() => {});
          }
        } else {
          fallbackToBeacon(payload, batchToSend);
        }
      }).catch(() => {
        fallbackToBeacon(payload, batchToSend);
      });
      fetchSuccess = true;
    } catch (e) {
      fetchSuccess = false;
    }

    if (!fetchSuccess) {
      fallbackToBeacon(payload, batchToSend);
    }
  };

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      handlePageUnload();
    }
  });
  window.addEventListener('pagehide', handlePageUnload);
}

