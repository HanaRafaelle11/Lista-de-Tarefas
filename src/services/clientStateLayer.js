/**
 * clientStateLayer.js — Camada de resolução de estado do cliente
 *
 * Estado final = merge entre server_state, pending_state e optimistic state.
 * Garante que UI sempre reflete estado mais recente com indicadores de pending sync.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Lê os itens pendentes da syncQueue.
 * Usa a API interna (não exportada formalmente) via localStorage.
 */
function getPendingItems() {
  try {
    return JSON.parse(localStorage.getItem('flowday_sync_queue') || '[]');
  } catch {
    return [];
  }
}

/**
 * Retorna todos os IDs de tasks com operações pendentes.
 * @returns {Set<string>}
 */
export function getPendingTaskIds() {
  const items = getPendingItems();
  const ids = new Set();
  for (const item of items) {
    if (['task_create', 'task_update', 'task_delete'].includes(item.type)) {
      const id = item.payload?.id || item.payload?.taskId;
      if (id) ids.add(id);
    }
  }
  return ids;
}

/**
 * Retorna o total de operações pendentes.
 * @returns {number}
 */
export function getPendingCount() {
  return getPendingItems().length;
}

/**
 * Verifica se um item específico tem sync pendente.
 * @param {string} id
 * @returns {boolean}
 */
export function hasPendingFor(id) {
  return getPendingTaskIds().has(id);
}

/**
 * Mescla tasks do servidor com estado otimista local.
 *
 * Regras de merge:
 * - Tasks com ID real no server: usa server state, aplica overrides locais se pendente
 * - Tasks com ID local (sem server): inclui com flag _pending=true
 *
 * @param {Task[]} serverTasks - Tasks confirmadas pelo Supabase
 * @param {Task[]} optimisticTasks - Tasks do estado React (inclui criações locais)
 * @returns {Task[]} - Lista final para exibição
 */
export function mergeTasks(serverTasks, optimisticTasks) {
  const pendingIds = getPendingTaskIds();
  const serverMap  = new Map(serverTasks.map(t => [t.id, t]));

  // 1. Todas as tasks do server, com flag de pending se aplicável
  const result = serverTasks.map(t => ({
    ...t,
    _pending: pendingIds.has(t.id),
  }));

  // 2. Tasks locais (id temporário ou não confirmadas) que não estão no server
  for (const t of optimisticTasks) {
    if (!serverMap.has(t.id)) {
      result.unshift({ ...t, _pending: true });
    }
  }

  return result;
}

/**
 * Retorna um resumo do estado de sincronização atual.
 * @returns {{ pendingCount: number, pendingTaskIds: string[], hasPending: boolean }}
 */
export function getSyncSummary() {
  const pendingTaskIds = [...getPendingTaskIds()];
  const pendingCount   = getPendingCount();
  return {
    pendingCount,
    pendingTaskIds,
    hasPending: pendingCount > 0,
  };
}

/**
 * Mescla profiles: prefere server, usa local se offline.
 * @param {object|null} serverProfile
 * @param {object|null} localProfile
 * @returns {object}
 */
export function mergeProfile(serverProfile, localProfile) {
  if (serverProfile) {
    // Se há versão local mais recente (updated_at maior), prefere local
    if (localProfile?._local && localProfile.updated_at > (serverProfile.updated_at || '')) {
      return { ...serverProfile, ...localProfile };
    }
    return serverProfile;
  }
  return localProfile || null;
}
