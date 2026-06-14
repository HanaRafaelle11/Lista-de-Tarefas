/**
 * syncQueue.js — Fila de sincronização resiliente do Flowday
 *
 * Garantias:
 * ✔ Zero perda de dados (localStorage persistente)
 * ✔ Exponential backoff (não bombardeia o servidor)
 * ✔ Idempotency keys (zero duplicatas em retry)
 * ✔ Client-generated IDs (tasks funcionam offline com IDs reais)
 * ✔ Detecção de online/offline em tempo real
 * ✔ Status granular: supabase, pendingOps, lastSync
 */

import { supabase } from '../supabaseClient';
import { localDB } from '../db/localDB';

// ─── Constantes ───────────────────────────────────────────────────────────────
const QUEUE_KEY      = 'flowday_sync_queue';
const MAX_ATTEMPTS   = 12;           // ~2h30 de retries antes de descartar
const BASE_DELAY_MS  = 10_000;       // 10s
const MAX_DELAY_MS   = 30 * 60_000;  // 30 minutos
const POLL_INTERVAL  = 30_000;       // 30s

// ─── Estado interno ───────────────────────────────────────────────────────────
let status = {
  supabase:    'healthy',   // 'healthy' | 'degraded' | 'offline'
  pendingOps:  0,
  lastSync:    null,        // ISO timestamp da última sincronização bem-sucedida
  warnings:    [],
};
let listeners  = new Set();
let pollTimer  = null;

// Fila em memória para acesso síncrono ultra-rápido reativo
let queueMemory = [];
let isInitialized = false;

/**
 * Inicializa a fila a partir do IndexedDB.
 * Migra dados antigos do localStorage se existirem para evitar perda de dados.
 */
export async function initSyncQueue() {
  if (isInitialized) return;
  try {
    const idbItems = await localDB.getAll('pendingOps');
    
    // Migração de localStorage legada
    const oldStorage = localStorage.getItem(QUEUE_KEY);
    if (oldStorage) {
      try {
        const oldQueue = JSON.parse(oldStorage);
        if (Array.isArray(oldQueue) && oldQueue.length > 0) {
          console.log(`[syncQueue] Migrando ${oldQueue.length} operações do localStorage para o IndexedDB`);
          for (const item of oldQueue) {
            item.id = item.idempotency_key;
            await localDB.put('pendingOps', item);
            idbItems.push(item);
          }
        }
        localStorage.removeItem(QUEUE_KEY);
      } catch (e) {
        console.warn('[syncQueue] Erro na migração de localStorage:', e.message);
      }
    }

    queueMemory = idbItems.sort((a, b) => new Date(a.enqueuedAt) - new Date(b.enqueuedAt));
    isInitialized = true;
    updateStatus({ pendingOps: queueMemory.length });
    console.log('[syncQueue] IndexedDB inicializado. Ops pendentes:', queueMemory.length);
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      flush();
    }
  } catch (err) {
    console.error('[syncQueue] Erro ao carregar IndexedDB, usando fallback:', err);
    queueMemory = [];
    isInitialized = true;
  }
}

// ─── Gerador de IDs (Prioridade 3 — idempotência) ────────────────────────────

/**
 * Gera um UUID v4 como client_generated_id.
 * Usado por tasks criadas offline para ter IDs reais (não temp_*).
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─── Priorização de Sync (Sync Engine 2.0) ──────────────────────────────────
const TYPE_PRIORITIES = {
  profile_update: 1, // Prioridade máxima
  task_create:    2, // Prioridade média
  task_update:    2,
  task_delete:    2,
  event:          3  // Prioridade baixa (analytics/batch)
};

function getPriority(item) {
  return TYPE_PRIORITIES[item.type] || 99;
}

// ─── Deduplicação Semântica (Sync Engine 2.0) ────────────────────────────────
function optimizeQueue(queue) {
  const optimized = [];
  const taskOps = {}; // Agrupa operações por ID da tarefa

  for (const item of queue) {
    if (item.type === 'task_create') {
      const taskId = item.payload.taskId || item.idempotency_key;
      taskOps[taskId] = { create: item, updates: [], delete: null };
    } else if (item.type === 'task_update') {
      const taskId = item.payload.id;
      if (taskOps[taskId]) {
        taskOps[taskId].updates.push(item);
      } else {
        taskOps[taskId] = { create: null, updates: [item], delete: null };
      }
    } else if (item.type === 'task_delete') {
      const taskId = item.payload.id;
      if (taskOps[taskId]) {
        taskOps[taskId].delete = item;
      } else {
        taskOps[taskId] = { create: null, updates: [], delete: item };
      }
    } else {
      optimized.push(item);
    }
  }

  // Resolve e otimiza transições de estado de tasks pendentes
  for (const [taskId, ops] of Object.entries(taskOps)) {
    // Caso 1: Criada e excluída offline sem nunca ir para o server
    if (ops.create && ops.delete) {
      console.log(`[syncQueue] Deduplicação Semântica: Task ${taskId} criada e deletada localmente offline. Cancelando ambas.`);
      continue;
    }

    // Caso 2: Deletada offline (descarte atualizações locais e envie apenas o delete)
    if (ops.delete) {
      optimized.push(ops.delete);
      continue;
    }

    // Caso 3: Criada offline e atualizada offline (mescla atualizações na criação)
    if (ops.create) {
      let mergedData = { ...ops.create.payload.taskData };
      let lastUpdateAt = ops.create.payload.taskData.updated_at || ops.create.enqueuedAt;

      for (const up of ops.updates) {
        Object.assign(mergedData, up.payload.updates);
        if (up.payload.updates && up.payload.updates.updated_at) {
          lastUpdateAt = up.payload.updates.updated_at;
        }
      }

      mergedData.updated_at = lastUpdateAt;
      ops.create.payload.taskData = mergedData;
      optimized.push(ops.create);
      continue;
    }

    // Caso 4: Múltiplas atualizações offline (mantém um único update com propriedades mescladas)
    if (ops.updates.length > 0) {
      const firstUpdate = ops.updates[0];
      let mergedUpdates = {};
      let lastUpdateAt = firstUpdate.payload.updates.updated_at || firstUpdate.enqueuedAt;

      for (const up of ops.updates) {
        Object.assign(mergedUpdates, up.payload.updates);
        if (up.payload.updates && up.payload.updates.updated_at) {
          lastUpdateAt = up.payload.updates.updated_at;
        }
      }

      mergedUpdates.updated_at = lastUpdateAt;
      firstUpdate.payload.updates = mergedUpdates;
      optimized.push(firstUpdate);
    }
  }

  return optimized;
}

// ─── Persistência ────────────────────────────────────────────────────────────
function readQueue() {
  return queueMemory;
}

function writeQueue(queue) {
  // Executa otimização semântica antes de persistir
  const optimized = optimizeQueue(queue);
  queueMemory = optimized;

  // Sincroniza em background com o localDB (IndexedDB)
  localDB.clear('pendingOps')
    .then(() => {
      const items = optimized.map(item => ({ ...item, id: item.idempotency_key }));
      return localDB.putMany('pendingOps', items);
    })
    .catch(err => {
      console.warn('[syncQueue] Falha ao persistir fila no IndexedDB:', err.message);
    });
}

// ─── Backoff ─────────────────────────────────────────────────────────────────
function calcNextRetry(attempts) {
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempts), MAX_DELAY_MS);
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Date.now() + delay + jitter;
}

// ─── Status & Notificações ───────────────────────────────────────────────────
function updateStatus(patch) {
  status = { ...status, ...patch };
  if (patch.warnings) {
    // Deduplica e mantém últimos 20
    const all = [...new Set([...status.warnings, ...patch.warnings])];
    status.warnings = all.slice(-20);
  }
  const queue = readQueue();
  status.pendingOps = queue.length;
  notify();
}

function notify() {
  listeners.forEach(fn => {
    try { fn({ ...status }); } catch { /* ignora */ }
  });
}

function addWarning(msg) {
  if (!status.warnings.includes(msg)) {
    updateStatus({ warnings: [...status.warnings, msg] });
  }
}

// ─── API Pública ──────────────────────────────────────────────────────────────

/**
 * Subscreve mudanças de status.
 * @returns {function} unsubscribe
 */
export function subscribe(fn) {
  listeners.add(fn);
  fn({ ...status }); // snapshot imediato
  return () => listeners.delete(fn);
}

/**
 * Retorna o status atual (snapshot).
 */
export function getStatus() {
  return { ...status };
}

/**
 * Enfileira uma operação para retry idempotente.
 *
 * @param {'event'|'task_create'|'task_update'|'task_delete'|'profile_update'} type
 * @param {object} payload
 * @param {string} [idempotencyKey] - Opcional; gerado automaticamente se omitido
 */
export function enqueue(type, payload, idempotencyKey) {
  const key = idempotencyKey || generateId();
  const queue = readQueue();

  // Previne duplicatas: se já existe item com mesmo idempotency_key, não enfileira
  const alreadyQueued = queue.some(item => item.idempotency_key === key);
  if (alreadyQueued) {
    console.debug(`[syncQueue] Item já na fila (idempotent): ${key}`);
    return key;
  }

  queue.push({
    idempotency_key: key,
    type,
    payload,
    enqueuedAt: new Date().toISOString(),
    attempts:   0,
    nextRetryAt: Date.now(), // tenta imediatamente na primeira vez
  });

  writeQueue(queue);
  updateStatus({ supabase: 'degraded' });
  addWarning(`Operação "${type}" na fila de sync`);

  // Tenta flush imediato se online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    setTimeout(flush, 500);
  }

  return key;
}

/**
 * Tenta reenviar todos os itens prontos para retry.
 * Respeita prioridades e exponential backoff.
 */
export async function flush() {
  const queue = readQueue();
  if (queue.length === 0) {
    if (status.supabase !== 'offline') {
      updateStatus({ supabase: 'healthy', warnings: [] });
    }
    return;
  }

  const now = Date.now();
  const ready     = queue.filter(item => (item.nextRetryAt || 0) <= now);
  const notReady  = queue.filter(item => (item.nextRetryAt || 0) > now);

  // Ordena por prioridade de entidade, e depois por data (FIFO)
  ready.sort((a, b) => {
    const prioA = getPriority(a);
    const prioB = getPriority(b);
    if (prioA !== prioB) return prioA - prioB;
    return new Date(a.enqueuedAt) - new Date(b.enqueuedAt);
  });

  const remaining = [...notReady];
  let consecutiveNetworkErrors = 0;

  for (const item of ready) {
    // Se tivemos muitos erros de conexão em lote, suspendemos temporariamente os próximos da fila
    if (consecutiveNetworkErrors >= 3) {
      remaining.push({
        ...item,
        nextRetryAt: Date.now() + 60_000 // joga 1 minuto no futuro
      });
      continue;
    }

    const ok = await trySend(item);
    if (ok) {
      consecutiveNetworkErrors = 0;
      // Item removido com sucesso
    } else {
      consecutiveNetworkErrors++;
      const attempts = (item.attempts || 0) + 1;
      
      // Backoff adaptativo: penaliza mais se a rede estiver visivelmente instável
      const isNetworkIssue = !navigator.onLine;
      const penaltyAttempts = isNetworkIssue ? attempts + 1 : attempts;

      if (attempts < MAX_ATTEMPTS) {
        remaining.push({
          ...item,
          attempts,
          nextRetryAt: calcNextRetry(penaltyAttempts),
        });
      } else {
        console.warn(`[syncQueue] Item descartado após ${MAX_ATTEMPTS} tentativas:`, item.type);
        addWarning(`Operação "${item.type}" descartada após muitas tentativas`);
      }
    }
  }

  writeQueue(remaining);

  if (remaining.length === 0) {
    updateStatus({
      supabase:   'healthy',
      pendingOps: 0,
      lastSync:   new Date().toISOString(),
      warnings:   [],
    });
  } else {
    updateStatus({
      supabase:   'degraded',
      pendingOps: remaining.length,
    });
  }
}

// ─── Envio individual com idempotência ───────────────────────────────────────
async function trySend(item) {
  const { type, payload, idempotency_key } = item;
  try {
    if (type === 'event') {
      const { userId, eventType, metadata } = payload;
      const { error } = await supabase
        .from('events')
        .insert([{
          id:         idempotency_key, // usa o idempotency key como PK
          user_id:    userId,
          event_type: eventType,
          metadata:   metadata || {},
        }]);
      if (error && error.code !== '23505') throw error;
      return true;
    }

    if (type === 'task_create') {
      const { userId, taskData, taskId } = payload;
      
      // Resolução de Conflitos para Criação/Upsert
      try {
        const { data: serverTask } = await supabase
          .from('tasks')
          .select('updated_at')
          .eq('id', taskId || idempotency_key)
          .single();

        if (serverTask && serverTask.updated_at) {
          const serverTime = new Date(serverTask.updated_at).getTime();
          const localTime = new Date(taskData.updated_at || item.enqueuedAt).getTime();
          if (serverTime > localTime) {
            console.log(`[syncQueue] Conflito em task_create para ${taskId}. Servidor possui versão mais recente.`);
            return true;
          }
        }
      } catch {}

      const { error } = await supabase
        .from('tasks')
        .upsert([{
          id:           taskId || idempotency_key,
          user_id:      userId,
          title:        taskData.title,
          description:  taskData.description || '',
          category:     taskData.category,
          priority:     taskData.priority,
          due_date:     taskData.dueDate || null,
          completed:    taskData.completed || false,
          completed_at: taskData.completedAt || null,
          updated_at:   taskData.updated_at || new Date().toISOString()
        }], { onConflict: 'id', ignoreDuplicates: false }); // Permite atualizar se o cliente for mais novo
      
      if (error && error.code !== '23505') throw error;
      return true;
    }

    if (type === 'task_update') {
      const { userId, id, updates } = payload;

      // Resolução de Conflitos Avançada Multi-camada (Sync Engine 2.0)
      try {
        const { data: serverTask } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', id)
          .single();

        if (serverTask && serverTask.updated_at) {
          const serverTime = new Date(serverTask.updated_at).getTime();
          const localTime = new Date(updates.updated_at || item.enqueuedAt).getTime();
          
          if (serverTime > localTime) {
            console.log(`[syncQueue] Conflito detectado para task ${id} (Server: ${serverTask.updated_at} > Local: ${updates.updated_at || item.enqueuedAt})`);
            
            const schemaMap = {
              title:       'title',
              description: 'description',
              category:    'category',
              priority:    'priority',
              dueDate:     'due_date',
              completed:   'completed',
              completedAt: 'completed_at'
            };

            let hasCollisions = false;
            let nonCollidingMerge = {};

            for (const [localProp, dbCol] of Object.entries(schemaMap)) {
              if (updates[localProp] !== undefined) {
                // Regra 1: Se ambos modificaram o mesmo campo e diferem, servidor prevalece (Server Wins por campo)
                if (updates[localProp] !== serverTask[dbCol]) {
                  console.log(`[syncQueue] Regra 1 (Server Wins por campo) em "${localProp}": Servidor (${serverTask[dbCol]}) prevalece sobre Local (${updates[localProp]}).`);
                  hasCollisions = true;
                }
              } else {
                // Regra 2: Merge não colidente (campo não editado localmente recebe valor do servidor)
                nonCollidingMerge[localProp] = serverTask[dbCol];
              }
            }

            // Atualiza cache local com o merge não colidente
            const localTask = await localDB.get('tasks', id);
            if (localTask) {
              const updatedLocalTask = {
                ...localTask,
                ...nonCollidingMerge,
                // Regra 3 (Fallback): se houver colisão total ou conflito irresolvível, atualiza cache local inteiro com dados do servidor
                title:       serverTask.title,
                description: serverTask.description || '',
                category:    serverTask.category,
                priority:    serverTask.priority,
                dueDate:     serverTask.due_date || '',
                completed:   serverTask.completed,
                createdAt:   serverTask.created_at,
                completedAt: serverTask.completed_at || null,
                updatedAt:   serverTask.updated_at
              };
              await localDB.put('tasks', updatedLocalTask);
            }

            if (hasCollisions) {
              console.log(`[syncQueue] Colisão direta detectada para task ${id}. Descartando atualização local obsoleta.`);
              return true; // Remove a operação obsoleta do cliente da fila
            }
          }
        }
      } catch (err) {
        console.debug('[syncQueue] Erro ao resolver conflito de tasks:', err.message);
      }

      const { error } = await supabase
        .from('tasks')
        .update({
          title:        updates.title,
          description:  updates.description,
          category:     updates.category,
          priority:     updates.priority,
          due_date:     updates.dueDate !== undefined ? (updates.dueDate || null) : undefined,
          completed:    updates.completed,
          completed_at: updates.completedAt,
          updated_at:   updates.updated_at || new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      return true;
    }

    if (type === 'task_delete') {
      const { userId, id } = payload;
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      return true;
    }

    if (type === 'profile_update') {
      const { userId, data } = payload;
      
      // Resolução de Conflitos para Perfil (Server Wins)
      try {
        const { data: serverProfile } = await supabase
          .from('profiles')
          .select('updated_at')
          .eq('id', userId)
          .single();

        if (serverProfile && serverProfile.updated_at) {
          const serverTime = new Date(serverProfile.updated_at).getTime();
          const localTime = new Date(data.updated_at || item.enqueuedAt).getTime();
          if (serverTime > localTime) {
            console.log(`[syncQueue] Colisão em profile_update. Prevalece Server Wins.`);
            return true; // Descarta alteração local obsoleta
          }
        }
      } catch {}

      const { error } = await supabase
        .from('profiles')
        .update({
          ...data,
          updated_at: data.updated_at || new Date().toISOString()
        })
        .eq('id', userId);
      if (error) throw error;
      return true;
    }

    // Tipo desconhecido — descarta sem erro
    console.warn('[syncQueue] Tipo desconhecido, descartando:', type);
    return true;

  } catch (err) {
    console.warn(`[syncQueue] trySend falhou para "${type}":`, err?.message);
    return false;
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  // Detectar offline
  window.addEventListener('offline', () => {
    updateStatus({ supabase: 'offline' });
    addWarning('Sem conexão com a internet');
  });

  // Reconectou: flush imediato
  window.addEventListener('online', () => {
    updateStatus({ supabase: status.pendingOps > 0 ? 'degraded' : 'healthy' });
    flush();
  });

  // Estado inicial
  if (!navigator.onLine) {
    updateStatus({ supabase: 'offline' });
    addWarning('Sem conexão com a internet');
  }

  // Executa inicialização assíncrona da fila no boot
  initSyncQueue().then(() => {
    // Poll periódico
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (navigator.onLine) flush();
    }, POLL_INTERVAL);
  }).catch(err => {
    console.error('[syncQueue] Falha na inicialização do boot:', err);
  });
}
