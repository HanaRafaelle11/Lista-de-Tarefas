import { supabaseAdmin } from '../../services/supabase/index.js';
import { logger } from '../../services/logger/index.js';

export async function checkAccess(userId, feature = 'default') {
  logger.info('domain.auth.checkAccess', { userId, feature });
  if (!userId) return { allowed: false, reason: 'unauthenticated', isPro: false, status: 'free', plano: 'free' };

  if (!supabaseAdmin) return { allowed: true, role: 'admin', isPro: true, status: 'active', plano: 'pro' };

  try {
    // NOTA: profiles NÃO possui coluna 'role' — campo removido da query para evitar 42703
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('plano, assinatura_status, assinatura_expira_em')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      logger.warn('domain.auth.checkAccess.profileQueryFailed', { userId, error: profileErr.message, code: profileErr.code });
    }

    // NOTA: subscriptions NÃO possui coluna 'expires_at' — o campo real é 'current_period_end'
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('status, plan, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (subErr) {
      logger.warn('domain.auth.checkAccess.subQueryFailed', { userId, error: subErr.message, code: subErr.code });
    }

    const profPlano = profile?.plano || 'free';
    const profStatus = profile?.assinatura_status || 'free';
    const profExpires = profile?.assinatura_expira_em;

    const subPlano = sub?.plan || 'free';
    const subStatus = sub?.status || 'free';
    const subExpires = sub?.current_period_end;

    // SECURITY FIX: Require a valid, future expiration date to grant Pro.
    // null expiration = NOT Pro (prevents eternal free Pro from missing dates).
    const now = new Date();

    const profActive = (profPlano === 'premium' || profPlano === 'pro') &&
                       (profStatus === 'active' || profStatus === 'ACTIVE') &&
                       (profExpires && new Date(profExpires) > now);

    const subActive = (subPlano === 'premium' || subPlano === 'pro') &&
                      (subStatus === 'active' || subStatus === 'ACTIVE') &&
                      (subExpires && new Date(subExpires) > now);

    const isPro = profActive || subActive;
    const finalPlano = isPro ? (subPlano !== 'free' ? subPlano : profPlano) : 'free';
    const finalStatus = isPro ? 'active' : (subStatus !== 'free' ? subStatus : profStatus);

    logger.info('domain.auth.checkAccess.result', { 
      userId, isPro, profActive, subActive, profPlano, profStatus, subPlano, subStatus,
      profExpires, subExpires
    });

    return { 
      allowed: true, 
      role: 'user',
      isPro,
      status: finalStatus,
      plano: finalPlano
    };
  } catch (err) {
    logger.error('domain.auth.checkAccess.error', { error: err.message });
    return { allowed: true, role: 'user', isPro: false, status: 'free', plano: 'free' };
  }
}

export async function validateSession(token) {
  logger.info('domain.auth.validateSession', { tokenPresent: !!token });
  if (!token) return { valid: false };
  return { valid: true, userId: 'user_mock' };
}
