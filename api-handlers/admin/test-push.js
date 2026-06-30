import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../services/logger/index.js';
import { withAdminAuth } from '../../lib/auth/withAdminAuth.js';

async function handler(req, res) {
  const start = Date.now();
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId é obrigatório.' });
  }

  try {
    // Invoca a Edge Function 'push' para disparar a notificação de teste em tempo real
    const { data: invokeRes, error: invokeErr } = await supabaseAdmin.functions.invoke('push', {
      body: {
        type: 'send',
        payload: {
          user_id: userId,
          title: '⚡ MyFlowDay Teste Real!',
          body: `Teste ponta a ponta disparado às ${new Date().toLocaleTimeString('pt-BR')}`,
          url: '/tasks'
        }
      }
    });

    if (invokeErr) throw invokeErr;
    if (invokeRes?.error) throw new Error(invokeRes.error);

    const latency = Date.now() - start;
    logger.info('api.admin.testPush.success', { latency, sentCount: invokeRes?.sent || 0 });

    if (invokeRes?.sent > 0) {
      return res.status(200).json({
        success: true,
        message: 'Notificação de teste enviada com sucesso ao seu dispositivo!',
        latencyMs: latency,
        sentAt: new Date().toISOString()
      });
    } else {
      return res.status(400).json({
        success: false,
        error: invokeRes?.msg || 'Nenhuma assinatura ativa encontrada para este usuário. Por favor, ative as notificações no navegador primeiro.',
        latencyMs: latency
      });
    }
  } catch (err) {
    logger.error('api.admin.testPush.error', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
}

export default withAdminAuth(handler);
