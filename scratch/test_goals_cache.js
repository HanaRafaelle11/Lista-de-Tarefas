import { goalsService } from '../src/services/goalsService.js';
import { supabase } from '../src/supabaseClient.js';
import fs from 'fs';
import path from 'path';

// Mock IndexedDB in-memory self-contained
const memoryStore = {
  tasks: {},
  goals: {},
  pendingOps: {},
  notifications: {},
  profile: {},
  events: {},
  habits: {}
};

const mockIndexedDB = {
  open: () => {
    const request = {
      onsuccess: null,
      onerror: null
    };
    
    const db = {
      transaction: (storeName, mode) => {
        const store = {
          get: (id) => {
            const req = { onsuccess: null, onerror: null };
            setTimeout(() => {
              req.result = memoryStore[storeName]?.[id] || null;
              if (req.onsuccess) req.onsuccess();
            }, 10);
            return req;
          },
          getAll: () => {
            const req = { onsuccess: null, onerror: null };
            setTimeout(() => {
              req.result = Object.values(memoryStore[storeName] || {});
              if (req.onsuccess) req.onsuccess();
            }, 10);
            return req;
          },
          put: (value) => {
            const req = { onsuccess: null, onerror: null };
            const id = value.id;
            if (!memoryStore[storeName]) memoryStore[storeName] = {};
            memoryStore[storeName][id] = value;
            setTimeout(() => {
              req.result = value;
              if (req.onsuccess) req.onsuccess();
            }, 10);
            return req;
          },
          delete: (id) => {
            const req = { onsuccess: null, onerror: null };
            if (memoryStore[storeName]) {
              delete memoryStore[storeName][id];
            }
            setTimeout(() => {
              req.result = true;
              if (req.onsuccess) req.onsuccess();
            }, 10);
            return req;
          },
          clear: () => {
            const req = { onsuccess: null, onerror: null };
            memoryStore[storeName] = {};
            setTimeout(() => {
              req.result = true;
              if (req.onsuccess) req.onsuccess();
            }, 10);
            return req;
          }
        };
        
        const tx = {
          objectStore: () => store,
          oncomplete: null,
          onerror: null
        };
        
        setTimeout(() => {
          if (tx.oncomplete) tx.oncomplete();
        }, 15);
        
        return tx;
      }
    };
    
    setTimeout(() => {
      if (request.onsuccess) {
        request.onsuccess({ target: { result: db } });
      }
    }, 5);
    
    return request;
  }
};

globalThis.indexedDB = mockIndexedDB;

async function runTest() {
  console.log('🧪 Running Goals Service Cache & Soft-Delete Test...');

  const testEmail = 'teste@flowday.app';
  const testPassword = 'Password123!';
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (authError) {
    console.error('Auth failed:', authError.message);
    return;
  }

  const userId = authData.user.id;
  console.log('✅ Authenticated, User ID:', userId);

  // 1. Criar Objetivo
  console.log('1. Creating goal...');
  const createRes = await goalsService.create(userId, {
    title: 'Goals Cache Sanity Test',
    description: 'Testing IndexedDB and Soft Delete fallbacks',
    color: '#FF0000',
    icon: '🚀',
    target_date: '2026-12-31'
  });

  if (createRes.error) {
    console.error('❌ Goal creation failed:', createRes.error);
    return;
  }

  const goal = createRes.data;
  console.log('✅ Goal created:', goal);

  // 2. Testar Soft Delete
  console.log('2. Deleting goal (soft delete)...');
  const deleteRes = await goalsService.delete(userId, goal.id);
  if (deleteRes.error) {
    console.error('❌ Goal deletion failed:', deleteRes.error);
  } else {
    console.log('✅ Goal soft-deleted successfully!');
  }

  // 3. Testar se o objetivo está na Lixeira (carregado via getAll)
  console.log('3. Fetching goals via getAll...');
  const getRes = await goalsService.getAll(userId);
  if (getRes.error) {
    console.error('❌ Fetching goals failed:', getRes.error);
    return;
  }

  const foundInDeleted = getRes.data.goals.find(g => g.id === goal.id);
  if (foundInDeleted && foundInDeleted.deletedAt) {
    console.log('✅ SUCCESS: Soft-deleted goal was found in list with deletedAt set!', foundInDeleted.deletedAt);
  } else {
    console.error('❌ FAILED: Soft-deleted goal was not found in the list or deletedAt is missing:', foundInDeleted);
  }

  // 4. Testar Restaurar
  console.log('4. Restoring goal...');
  const restoreRes = await goalsService.restore(userId, goal.id);
  if (restoreRes.error) {
    console.error('❌ Restoring goal failed:', restoreRes.error);
    return;
  }
  console.log('✅ Goal restored successfully!');

  // 5. Testar se o objetivo voltou a ser ativo
  console.log('5. Fetching goals after restore...');
  const getRes2 = await goalsService.getAll(userId);
  const restoredGoal = getRes2.data.goals.find(g => g.id === goal.id);
  if (restoredGoal && !restoredGoal.deletedAt) {
    console.log('✅ SUCCESS: Goal is active again and deletedAt is cleared!');
  } else {
    console.error('❌ FAILED: Goal is still deleted or missing after restore:', restoredGoal);
  }

  // 6. Limpeza (Deletar permanentemente)
  console.log('6. Cleaning up (permanent delete)...');
  const finalDel = await goalsService.deletePermanent(userId, goal.id);
  if (finalDel.error) {
    console.error('❌ Permanent deletion failed:', finalDel.error);
  } else {
    console.log('✅ Cleanup complete!');
  }
}

runTest().catch(err => console.error('Unexpected error in test:', err));
