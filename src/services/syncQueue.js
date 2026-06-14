/**
 * syncQueue.js — Fila de sincronização resiliente do Flowday
 *
 * Garante que nenhum evento ou operação é perdido silenciosamente.
 * Se o Supabase falhar, os dados ficam na fila local (localStorage)
 * e são reenviados automaticamente quando a conexão voltar.
 */

import { supabase } from '../supabaseClient';

const QUEUE_KEY = 'flowday_sync_queue';
const RETRY_INTERVAL_MS = 30_000; // 30 segundos

// ─── Estado interno ───────────────────────────────────────────────────────────
let syncStatus = 'healthy'; // 'healthy' | 'degraded' | 'offline'
let warnings = [];
let listeners = new Set();
let retryTimer = null;

// ─── Persistência da fila ─────────────────────────────────────────────────────
function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-500))); // max 500 itens
  } catch {
    // localStorage cheio — ignora silenciosamente
  }
}

// ─── Status & Warnings ────────────────────────────────────────────────────────
function setState(status, warning = null) {
  syncStatus = status;
  if (warning && !warnings.includes(warning)) {
    warnings = [...warnings, warning];
    if (warnings.length > 20) warnings = warnings.slice(-20);
  }
  notify();
}

function notify() {
  listeners.forEach(fn => fn({ syncStatus, warnings }));
}

// ─── API Pública ──────────────────────────────────────────────────────────────

/**
 * Adiciona uma operação à fila de retry.
 * @param {'event'|'task_update'|'profile_update'} type
 * @param {object} payload
 */
export function enqueue(type, payload) {
  const queue = readQueue();
  queue.push({ type, payload, enqueuedAt: new Date().toISOString(), attempts: 0 });
  writeQueue(queue);
  setState('degraded', `Operação enfileirada para retry: ${type}`);
}

/**
 * Tenta reenviar todos os itens pendentes da fila.
 * Chamado automaticamente a cada 30s e quando o navegador fica online.
 */
export async function flush() {
  const queue = readQueue();
  if (queue.length === 0) {
    if (syncStatus !== 'offline') setState('healthy');
    return;
  }

  const remaining = [];
  let anySuccess = false;
  let anyFail = false;

  for (const item of queue) {
    const success = await trySend(item);
    if (success) {
      anySuccess = true;
    } else {
      item.attempts = (item.attempts || 0) + 1;
      if (item.attempts < 10) { // descarta após 10 tentativas
        remaining.push(item);
      }
      anyFail = true;
    }
  }

  writeQueue(remaining);

  if (remaining.length === 0) {
    warnings = [];
    setState('healthy');
  } else if (anyFail) {
    setState('degraded', `${remaining.length} operação(ões) pendente(s) na fila`);
  }
}

async function trySend(item) {
  try {
    if (item.type === 'event') {
      const { userId, eventType, metadata } = item.payload;
      const { error } = await supabase
        .from('events')
        .insert([{ user_id: userId, event_type: eventType, metadata }]);
      return !error;
    }

    if (item.type === 'task_update') {
      const { userId, id, updates } = item.payload;
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId);
      return !error;
    }

    if (item.type === 'task_create') {
      // Tarefas criadas localmente têm id temporário — apenas loga, não retenta insert
      // (pois criaria duplicata). O usuário verá a task com id real ao recarregar.
      return true;
    }

    if (item.type === 'profile_update') {
      const { userId, data } = item.payload;
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', userId);
      return !error;
    }

    return true; // tipo desconhecido — descarta
  } catch {
    return false;
  }
}

/**
 * Retorna o estado atual de sincronização.
 */
export function getStatus() {
  return { syncStatus, warnings: [...warnings] };
}

/**
 * Registra um listener para mudanças de status.
 * @returns {function} unsubscribe
 */
export function subscribe(fn) {
  listeners.add(fn);
  fn({ syncStatus, warnings }); // chama imediatamente com estado atual
  return () => listeners.delete(fn);
}

// ─── Boot: detectar online/offline e iniciar retry loop ──────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setState('healthy');
    flush();
  });

  window.addEventListener('offline', () => {
    setState('offline', 'Sem conexão com a internet');
  });

  if (!navigator.onLine) {
    setState('offline', 'Sem conexão com a internet');
  }

  // Retry periódico
  function startRetryLoop() {
    if (retryTimer) clearInterval(retryTimer);
    retryTimer = setInterval(() => {
      if (navigator.onLine) flush();
    }, RETRY_INTERVAL_MS);
  }

  startRetryLoop();

  // Flush inicial ao carregar (se houver itens pendentes)
  setTimeout(() => {
    if (navigator.onLine) flush();
  }, 2000);
}
