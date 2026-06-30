import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../services/logger/index.js';

/**
 * Handler para receber logs de telemetria de push do Service Worker do cliente.
 * Endpoint: POST /api/push-telemetry
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { event_type, endpoint, user_id, error } = req.body || {};

  if (!event_type || !endpoint) {
    return res.status(400).json({ error: 'event_type e endpoint são obrigatórios.' });
  }

  try {
    const { error: insertError } = await supabaseAdmin
      .from('push_telemetry')
      .insert([{
        user_id: user_id || null,
        endpoint,
        event_type,
        status: event_type === 'failed' ? 'error' : 'success',
        error: error || null
      }]);

    if (insertError) throw insertError;

    logger.info('api.pushTelemetry.success', { event_type, endpoint: endpoint.substring(0, 30) });
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error('api.pushTelemetry.error', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
