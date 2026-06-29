import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function validateSchema() {
  const result = {
    schemaValid: true,
    missingTables: [],
    missingColumns: [],
    criticalMismatch: false
  };

  if (!supabaseUrl || !supabaseServiceKey) {
    result.schemaValid = false;
    result.criticalMismatch = true;
    console.error('[Schema Validator] Variáveis de ambiente do Supabase não configuradas no .env.local.');
    return result;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Definição da verdade de schemas esperada pelo código de produção
  const schemaTruth = [
    {
      tableName: 'tasks',
      columns: ['id', 'user_id', 'title', 'completed', 'deleted_at', 'updated_at', 'completed_at']
    },
    {
      tableName: 'goals',
      columns: ['id', 'user_id', 'title', 'deleted_at', 'start_time', 'end_time', 'completed_at']
    },
    {
      tableName: 'notification_queue',
      columns: ['id', 'task_id', 'user_id', 'status', 'attempts', 'sent_at', 'last_error']
    },
    {
      tableName: 'notification_logs',
      columns: ['id', 'user_id', 'notification_queue_id', 'status', 'sent_at', 'error_message']
    },
    {
      tableName: 'push_subscriptions',
      columns: ['id', 'user_id', 'endpoint', 'p256dh', 'auth']
    },
    {
      tableName: 'user_risk_profile',
      columns: ['user_id', 'risk_level', 'reason_summary'],
      isOptional: true
    },
    {
      tableName: 'revenue_leaks',
      columns: ['id', 'user_id', 'leak_type', 'estimated_value_loss'],
      isOptional: true
    },
    {
      tableName: 'growth_actions',
      columns: ['id', 'user_id', 'action_type', 'status'],
      isOptional: true
    },
    {
      tableName: 'growth_action_results',
      columns: ['id', 'action_id', 'user_id', 'user_returned'],
      isOptional: true
    }
  ];

  console.log('[Schema Validator] Verificando integridade de schemas contra banco de produção Supabase...');

  for (const tableConfig of schemaTruth) {
    const { tableName, columns, isOptional } = tableConfig;
    try {
      // Executa select limit 0 para testar existência da tabela e buscar colunas
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);

      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('Could not find the table') || error.message?.includes('does not exist')) {
          result.missingTables.push(tableName);
          result.schemaValid = false;
          if (!isOptional) {
            result.criticalMismatch = true;
            console.error(`❌ [Schema Validator] Tabela core inexistente: "${tableName}"`);
          } else {
            console.warn(`⚠️ [Schema Validator] Tabela opcional inexistente (drift tolerado): "${tableName}"`);
          }
          continue;
        }
        throw error;
      }

      // Se a tabela existe, verificar se possui todas as colunas necessárias
      for (const col of columns) {
        const { error: colErr } = await supabase
          .from(tableName)
          .select(col)
          .limit(0);

        if (colErr && (colErr.code === '42703' || colErr.message?.includes('column') || colErr.message?.includes('does not exist'))) {
          result.missingColumns.push(`${tableName}.${col}`);
          result.schemaValid = false;
          if (!isOptional) {
            result.criticalMismatch = true;
            console.error(`❌ [Schema Validator] Coluna core inexistente: "${tableName}.${col}"`);
          } else {
            console.warn(`⚠️ [Schema Validator] Coluna opcional inexistente (drift tolerado): "${tableName}.${col}"`);
          }
        }
      }

    } catch (err) {
      result.schemaValid = false;
      if (!isOptional) {
        result.criticalMismatch = true;
        console.error(`❌ [Schema Validator] Falha inesperada ao auditar tabela core "${tableName}":`, err.message);
      } else {
        console.warn(`⚠️ [Schema Validator] Falha inesperada ao auditar tabela opcional "${tableName}" (drift tolerado):`, err.message);
      }
    }
  }

  if (!result.criticalMismatch) {
    console.log('✅ [Schema Validator] Todos os schemas de tabelas e colunas CORE estão alinhados com o código!');
  } else {
    console.warn(`⚠️ [Schema Validator] Drift crítico de schema detectado! Tabelas ausentes: ${result.missingTables.length} | Colunas ausentes: ${result.missingColumns.length}`);
  }

  return result;
}
