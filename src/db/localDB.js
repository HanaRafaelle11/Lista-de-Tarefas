/**
 * localDB.js — Camada de Banco de Dados Local usando IndexedDB
 *
 * Provê armazenamento persistente estruturado no browser para:
 * - tasks (cache offline)
 * - habits (cache offline)
 * - goals (cache offline)
 * - events (cache local para batching e analytics)
 * - pendingOps (fila de sincronização persistente)
 * - profile (cache do perfil do usuário)
 */

const DB_NAME = 'flowday_local_db';
const DB_VERSION = 3;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      
      // Cria stores de objetos se não existirem
      if (!db.objectStoreNames.contains('tasks')) {
        db.createObjectStore('tasks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('habits')) {
        db.createObjectStore('habits', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('goals')) {
        db.createObjectStore('goals', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('events')) {
        db.createObjectStore('events', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pendingOps')) {
        db.createObjectStore('pendingOps', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('notifications')) {
        db.createObjectStore('notifications', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('goal_tasks')) {
        db.createObjectStore('goal_tasks', { keyPath: 'id' });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export const localDB = {
  /**
   * Obtém um registro por ID em uma store específica.
   */
  async get(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Obtém todos os registros de uma store.
   */
  async getAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Insere ou atualiza um registro em uma store.
   */
  async put(storeName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Insere ou atualiza vários registros em lote (batch).
   */
  async putMany(storeName, values) {
    if (!values || values.length === 0) return [];
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      transaction.oncomplete = () => resolve(values);
      transaction.onerror = () => reject(transaction.error);

      for (const val of values) {
        store.put(val);
      }
    });
  },

  /**
   * Exclui um registro por ID de uma store.
   */
  async delete(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Limpa todos os dados de uma store.
   */
  async clear(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }
};
