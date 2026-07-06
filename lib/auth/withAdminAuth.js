import { supabaseAdmin } from '../supabase.js';
import { isAdmin } from './adminAuth.js';

/**
 * Higher-Order Middleware para proteção obrigatória de rotas de Administrador no Backend.
 * 
 * Intercepta a requisição, valida o usuário autenticado contra a única fonte de verdade (adminAuth.js),
 * e bloqueia automaticamente com HTTP 403 se o usuário não for o Administrador Master.
 * 
 * @param {Function} handler - Função assíncrona da rota (req, res).
 * @returns {Function} Handler protegido por middleware.
 */
export function withAdminAuth(handler) {
  return async function wrappedHandler(req, res) {
    try {
      let user = null;

      // 1. Tentar resolver usuário via Authorization Header (Bearer JWT)
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token) {
          const { data: { user: jwtUser }, error: jwtErr } = await supabaseAdmin.auth.getUser(token);
          if (!jwtErr && jwtUser) {
            user = jwtUser;
          }
        }
      }

      // 2. Fallback: resolver usuário via userId na query ou body (para requisições legadas ou internas)
      if (!user) {
        const userId = req.query?.userId || req.body?.userId;
        if (userId) {
          try {
            const { data: { user: dbUser }, error: dbErr } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (!dbErr && dbUser) {
              user = dbUser;
            }
          } catch (e) {
            console.error('[withAdminAuth] Erro ao buscar usuário via getUserById:', e);
          }
        }
      }

      // 3. Validar privilégios com a única fonte de verdade (isAdmin)
      if (!user || !isAdmin(user)) {
        console.warn('[SECURITY] Tentativa de acesso bloqueada em rota de administrador.', {
          path: req.url || req.query?.routes,
          method: req.method,
          email: user?.email || 'unauthenticated',
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
          timestamp: new Date().toISOString()
        });

        // Gravar no ledger de observabilidade/segurança
        try {
          await supabaseAdmin.from('events').insert([{
            user_id: user?.id || null,
            event_type: 'unauthorized_admin_access',
            metadata: {
              path: req.url || req.query?.routes || 'unknown',
              method: req.method || 'unknown',
              email: user?.email || 'unauthenticated',
              ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
              timestamp: new Date().toISOString()
            },
            created_at: new Date().toISOString()
          }]);
        } catch (dbErr) {
          console.error('[SECURITY ERROR] Falha ao registrar alerta no Supabase:', dbErr.message);
        }

        return res.status(403).json({
          error: 'Acesso negado.',
          message: 'Apenas o administrador master tem permissão para acessar este recurso.'
        });
      }

      // Anexar objeto do usuário validado na requisição para conveniência
      req.adminUser = user;

      // 4. Executar o handler da rota
      return await handler(req, res);
    } catch (error) {
      console.error('[SECURITY ERROR] Erro no middleware withAdminAuth:', error);
      return res.status(500).json({ error: 'Erro interno de verificação de segurança.', message: error.message });
    }
  };
}
