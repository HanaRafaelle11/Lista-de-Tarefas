import { processNotificationQueue } from './push-worker-engine.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[DaemonWorker] Chaves do Supabase não encontradas no ambiente.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🚀 [DaemonWorker] Iniciando Runner Autônomo de Push Notifications (Ciclo de 60s)...');

async function runLoop() {
  try {
    const res = await processNotificationQueue(supabase, 100);
    if (res.processed > 0) {
      console.log(`[DaemonWorker] ${new Date().toISOString()} - Processados: ${res.processed} | Sucesso: ${res.success} | Falhas: ${res.failed}`);
    }
  } catch (err) {
    console.error('[DaemonWorker] Erro no ciclo de execução:', err.message);
  }
}

// Executa imediatamente e depois a cada 60 segundos (simulando Cron de servidor)
runLoop();
setInterval(runLoop, 60000);
