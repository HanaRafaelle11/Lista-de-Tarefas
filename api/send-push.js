// Vercel Serverless Function: /api/send-push.js
import { sendPushNotification } from '../services/push-notification-service.js';

export default async function handler(req, res) {
  // CORS config
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    return;
  }

  const { userId, title, body, url } = req.body || {};

  if (!userId || !title || !body) {
    res.status(400).json({ error: 'Os campos userId, title e body são obrigatórios.' });
    return;
  }

  try {
    await sendPushNotification(userId, title, body, url || '/');
    res.status(200).json({ success: true, message: 'Notificação enviada com sucesso!' });
  } catch (error) {
    console.error('[API Send Push] Erro:', error);
    res.status(500).json({ error: 'Erro ao enviar notificação.', message: error.message });
  }
}
