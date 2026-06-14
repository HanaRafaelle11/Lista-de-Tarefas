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

import { supabase } from '../supabaseClient';
import { localDB } from '../db/localDB';
import { enqueue, generateId } from './syncQueue';

const BATCH_LIMIT = 15;
const FLUSH_INTERVAL_MS = 15_000;

let memoryBuffer = [];
let flushTimer = null;

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

/**
 * Adiciona um evento ao buffer.
 */
export async function trackEvent(userId, eventType, metadata = {}) {
  if (!userId) return;

  const event = {
    id: generateId(),
    user_id: userId,
    event_type: eventType,
    metadata: metadata || {},
    created_at: new Date().toISOString()
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
  if (memoryBuffer.length === 0) return;

  const batchToSend = [...memoryBuffer];
  memoryBuffer = []; // Limpa o buffer ativo imediatamente para evitar concorrência

  // Limpa o IndexedDB correspondente ao lote atual
  for (const item of batchToSend) {
    localDB.delete('events', item.id).catch(() => {});
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    // Se offline, enfileira todos na syncQueue para envio eventual individual
    console.log('[eventBatcher] Offline: jogando', batchToSend.length, 'eventos na syncQueue');
    enqueueBatchToSync(batchToSend);
    return;
  }

  try {
    // Insere lote completo no Supabase de uma só vez
    const payload = batchToSend.map(e => ({
      id: e.id,
      user_id: e.user_id,
      event_type: e.event_type,
      metadata: e.metadata,
      created_at: e.created_at
    }));

    const { error } = await supabase
      .from('events')
      .insert(payload);

    if (error) {
      throw error;
    }
    
    console.log('[eventBatcher] Batch enviado com sucesso:', batchToSend.length, 'eventos');
  } catch (err) {
    console.warn('[eventBatcher] Erro ao enviar batch pro Supabase. Delegando para syncQueue:', err.message);
    enqueueBatchToSync(batchToSend);
  }
}

// Fallback: joga o lote de eventos na syncQueue
function enqueueBatchToSync(batch) {
  for (const item of batch) {
    enqueue('event', {
      userId: item.user_id,
      eventType: item.event_type,
      metadata: item.metadata
    }, item.id);
  }
}
