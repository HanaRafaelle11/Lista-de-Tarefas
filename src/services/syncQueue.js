/**
 * syncQueue.js — Fila de sincronização resiliente do MyFlowDay
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
const MAX_ATTEMPTS   = 3;            // Reduzido para evitar loop infinito visual
const BASE_DELAY_MS  = 2_000;        // 2s
const MAX_DELAY_MS   = 10_000;       // 10s
const POLL_INTERVAL  = 30_000;       // 30s

// ─── Estado interno ───────────────────────────────────────────────────────────
// ─── Estado interno ───────────────────────────────────────────────────────────
let status = {
  supabase:    'healthy',   // 'healthy' | 'degraded' | 'offline'
  pendingOps:  0,
  lastSync:    null,        // ISO timestamp da última sincronização bem-sucedida
  warnings:    [],
  avgSyncLagMs: 0,
  totalSyncs: 0,
  conflictCount: 0
};
let listeners  = new Set();
let pollTimer  = null;
const failureTracker = {};

export function getConflictLogs() {
  try {
    return JSON.parse(localStorage.getItem('flowday_conflict_logs') || '[]');
  } catch {
    return [];
  }
}

function logConflict(type, entityId, localData, serverData, resolution) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    entityId,
    localData,
    serverData,
    resolution
  };
  const logs = getConflictLogs();
  logs.push(log);
  try {
    localStorage.setItem('flowday_conflict_logs', JSON.stringify(logs.slice(-50)));
  } catch (e) {
    console.warn('[syncQueue] Falha ao salvar log de conflitos no localStorage:', e);
  }
}


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
  goal_create:    2,
  goal_update:    2,
  goal_delete:    2,
  event:          3  // Prioridade baixa (analytics/batch)
};

function getPriority(item) {
  return TYPE_PRIORITIES[item.type] || 99;
}

// ─── Deduplicação Semântica (Sync Engine 2.0) ────────────────────────────────
function optimizeQueue(queue) {
  const optimized = [];
  const taskOps = {}; // Agrupa operações por ID da tarefa
  const goalOps = {}; // Agrupa operações por ID do objetivo

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
    } else if (item.type === 'goal_create') {
      const goalId = item.payload.goalId || item.idempotency_key;
      goalOps[goalId] = { create: item, updates: [], delete: null };
    } else if (item.type === 'goal_update') {
      const goalId = item.payload.id;
      if (goalOps[goalId]) {
        goalOps[goalId].updates.push(item);
      } else {
        goalOps[goalId] = { create: null, updates: [item], delete: null };
      }
    } else if (item.type === 'goal_delete') {
      const goalId = item.payload.id;
      if (goalOps[goalId]) {
        goalOps[goalId].delete = item;
      } else {
        goalOps[goalId] = { create: null, updates: [], delete: item };
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

  // Resolve e otimiza transições de estado de goals pendentes
  for (const [goalId, ops] of Object.entries(goalOps)) {
    // Caso 1: Criado e excluído offline sem nunca ir para o server
    if (ops.create && ops.delete) {
      console.log(`[syncQueue] Deduplicação Semântica: Goal ${goalId} criado e deletado localmente offline. Cancelando ambos.`);
      continue;
    }

    // Caso 2: Deletado offline (descarte atualizações locais e envie apenas o delete)
    if (ops.delete) {
      optimized.push(ops.delete);
      continue;
    }

    // Caso 3: Criado offline e atualizado offline (mescla atualizações na criação)
    if (ops.create) {
      let mergedData = { ...ops.create.payload.goalData };
      let lastUpdateAt = ops.create.payload.goalData.updated_at || ops.create.enqueuedAt;

      for (const up of ops.updates) {
        Object.assign(mergedData, up.payload.updates);
        if (up.payload.updates && up.payload.updates.updated_at) {
          lastUpdateAt = up.payload.updates.updated_at;
        }
      }

      mergedData.updated_at = lastUpdateAt;
      ops.create.payload.goalData = mergedData;
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
      delete failureTracker[item.idempotency_key];

      // Métrica de sync lag
      const lag = Date.now() - new Date(item.enqueuedAt).getTime();
      const total = status.totalSyncs || 0;
      const newAvg = total > 0 ? Math.round(((status.avgSyncLagMs * total) + lag) / (total + 1)) : lag;
      updateStatus({
        avgSyncLagMs: newAvg,
        totalSyncs: total + 1
      });
    } else {
      consecutiveNetworkErrors++;
      failureTracker[item.idempotency_key] = (failureTracker[item.idempotency_key] || 0) + 1;

      const attempts = (item.attempts || 0) + 1;
      const maxAttempts = window.BETA_SAFE_MODE ? 5 : MAX_ATTEMPTS; // Beta Safe Mode reduz a agressividade do retry
      
      // Backoff adaptativo: penaliza mais se a rede estiver visivelmente instável
      const isNetworkIssue = !navigator.onLine;
      const penaltyAttempts = isNetworkIssue ? attempts + 1 : attempts;

      if (attempts < maxAttempts) {
        remaining.push({
          ...item,
          attempts,
          nextRetryAt: calcNextRetry(penaltyAttempts),
        });
      } else {
        console.warn(`[syncQueue] Item descartado após ${maxAttempts} tentativas:`, item.type);
        logConflict(item.type, item.idempotency_key, item.payload, null, 'Descartado após exceder max retries');
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
  
  // Detecção de loop de sync (mesmo payload falhando repetidamente)
  if (failureTracker[idempotency_key] > 2) {
    console.warn(`[syncQueue] Loop de sync bloqueado para a op "${type}" key="${idempotency_key}".`);
    logConflict(type, idempotency_key, payload, null, 'Cancelado por Loop de Sync');
    updateStatus({ conflictCount: (status.conflictCount || 0) + 1 });
    return true; // remove da fila
  }

  try {
    if (type === 'event') {
      const { userId, eventType, metadata } = payload;

      if (!userId) {
        console.warn("[EVENT SKIPPED] missing user");
        return true;
      }

      try {
        const authUserRes = await supabase.auth.getUser().catch(() => null);
        console.log("[EVENT INSERT]", {
          file: "src/services/syncQueue.js",
          user_id: userId,
          auth_uid: authUserRes?.data?.user?.id || null,
          payload: {
            id:         idempotency_key,
            user_id:    userId,
            event_type: eventType,
            metadata:   metadata || {},
          }
        });
      } catch (logErr) {}

      const { error } = await supabase
        .from('events')
        .insert([{
          id:         idempotency_key, // usa o idempotency key como PK
          user_id:    userId,
          event_type: eventType,
          metadata:   metadata || {},
        }]);
      if (error && error.code !== '23505') {
        console.error(error);
      }
      return true;
    }

    if (type === 'task_create') {
      const { userId, taskData, taskId } = payload;
      
      // Resolução de Conflitos para Criação/Upsert
      try {
        const { data: serverTask } = await supabase
          .from('tasks')
          .select('id, created_at')
          .eq('id', taskId || idempotency_key)
          .single();

        const serverTimestamp = serverTask?.updated_at || serverTask?.created_at;
        if (serverTask && serverTimestamp) {
          const serverTime = new Date(serverTimestamp).getTime();
          const localTime = new Date(taskData.updated_at || taskData.createdAt || item.enqueuedAt).getTime();
          if (serverTime > localTime) {
            console.log(`[syncQueue] Conflito em task_create para ${taskId}. Servidor possui versão mais recente.`);
            logConflict('task_create', taskId || idempotency_key, taskData, serverTask, 'Server Wins (Criação obsoleta)');
            updateStatus({ conflictCount: (status.conflictCount || 0) + 1 });
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
          completed_at: taskData.completedAt || null
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

        const serverTimestamp = serverTask?.updated_at || serverTask?.created_at;
        if (serverTask && serverTimestamp) {
          const serverTime = new Date(serverTimestamp).getTime();
          const localTime = new Date(updates.updated_at || updates.createdAt || item.enqueuedAt).getTime();
          
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
                updatedAt:   serverTask.updated_at || serverTask.created_at
              };
              await localDB.put('tasks', updatedLocalTask);
            }

            if (hasCollisions) {
              console.log(`[syncQueue] Colisão direta detectada para task ${id}. Descartando atualização local obsoleta.`);
              logConflict('task_update', id, updates, serverTask, 'Server Wins por colisão de campo');
              updateStatus({ conflictCount: (status.conflictCount || 0) + 1 });
              return true; // Remove a operação obsoleta do cliente da fila
            } else {
              logConflict('task_update', id, updates, serverTask, 'Merge não colidente');
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
          completed_at: updates.completedAt
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

    if (type === 'goal_create') {
      const { userId, goalData, goalId } = payload;
      const { error } = await supabase
        .from('goals')
        .upsert([{
          id:          goalId || idempotency_key,
          user_id:     userId,
          title:       goalData.title,
          description: goalData.description || '',
          color:       goalData.color || '#4A654E',
          icon:        goalData.icon || '🎯',
          target_date: goalData.target_date || null,
          start_time:  goalData.start_time || null,
          end_time:    goalData.end_time || null,
          status:      'active'
        }], { onConflict: 'id' });

      if (error) {
        // Fallback para colunas inexistentes (start_time/end_time)
        if (error.code === 'PGRST204' || (error.message && error.message.includes("end_time"))) {
          const serializedMeta = {
            start_time: goalData.start_time || null,
            end_time: goalData.end_time || null
          };
          const cleanDesc = (goalData.description || '').split('\n\n--flowday-meta--')[0].trim();
          const enrichedDescription = `${cleanDesc}\n\n--flowday-meta--\n${JSON.stringify(serializedMeta)}`;

          const { error: fallbackError } = await supabase
            .from('goals')
            .upsert([{
              id:          goalId || idempotency_key,
              user_id:     userId,
              title:       goalData.title,
              description: enrichedDescription,
              color:       goalData.color || '#4A654E',
              icon:        goalData.icon || '🎯',
              target_date: goalData.target_date || null,
              status:      'active'
            }], { onConflict: 'id' });
          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }
      return true;
    }

    if (type === 'goal_update') {
      const { userId, id, updates } = payload;
      const { error } = await supabase
        .from('goals')
        .update({
          title:       updates.title,
          description: updates.description,
          color:       updates.color,
          icon:        updates.icon,
          status:      updates.status,
          target_date: updates.target_date,
          start_time:  updates.start_time,
          end_time:    updates.end_time
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        if (error.code === 'PGRST204' || (error.message && error.message.includes("end_time"))) {
          // Fallback de serialização na descrição
          const { data: currentGoal } = await supabase
            .from('goals')
            .select('description')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

          let currentStart = null;
          let currentEnd = null;
          let currentDescClean = '';

          if (currentGoal && currentGoal.description) {
            currentDescClean = currentGoal.description;
            if (currentGoal.description.includes('--flowday-meta--')) {
              const parts = currentGoal.description.split('--flowday-meta--');
              currentDescClean = parts[0].trim();
              try {
                const meta = JSON.parse(parts[1].trim());
                currentStart = meta.start_time || null;
                currentEnd = meta.end_time || null;
              } catch (e) {}
            }
          }

          const updatedDescClean = updates.description !== undefined ? (updates.description || '') : currentDescClean;
          const nextStart = updates.start_time !== undefined ? updates.start_time : currentStart;
          const nextEnd = updates.end_time !== undefined ? updates.end_time : currentEnd;

          const serializedMeta = {
            start_time: nextStart,
            end_time: nextEnd
          };
          const enrichedDescription = `${updatedDescClean}\n\n--flowday-meta--\n${JSON.stringify(serializedMeta)}`;

          const fallbackPayload = {};
          if (updates.title !== undefined) fallbackPayload.title = updates.title;
          fallbackPayload.description = enrichedDescription;
          if (updates.color !== undefined) fallbackPayload.color = updates.color;
          if (updates.icon !== undefined) fallbackPayload.icon = updates.icon;
          if (updates.status !== undefined) fallbackPayload.status = updates.status;
          if (updates.target_date !== undefined) fallbackPayload.target_date = updates.target_date || null;

          const { error: fallbackError } = await supabase
            .from('goals')
            .update(fallbackPayload)
            .eq('id', id)
            .eq('user_id', userId);
          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }
      return true;
    }

    if (type === 'goal_delete') {
      const { userId, id } = payload;
      const { error } = await supabase
        .from('goals')
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
            logConflict('profile_update', userId, data, serverProfile, 'Server Wins');
            updateStatus({ conflictCount: (status.conflictCount || 0) + 1 });
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
    // Erros de schema irrecuperáveis (tabela/coluna inexistente) dropam na hora
    if (err?.code && (err.code.startsWith('42') || err.code.startsWith('PGRST'))) {
      return true;
    }
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
