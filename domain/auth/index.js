import { supabaseAdmin } from '../../services/supabase/index.js';
import { logger } from '../../services/logger/index.js';

export async function checkAccess(userId, feature = 'default') {
  logger.info('domain.auth.checkAccess', { userId, feature });
  if (!userId) return { allowed: false, reason: 'unauthenticated' };

  if (!supabaseAdmin) return { allowed: true, role: 'admin' };

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  return { allowed: true, role: data?.role || 'user' };
}

export async function validateSession(token) {
  logger.info('domain.auth.validateSession', { tokenPresent: !!token });
  if (!token) return { valid: false };
  return { valid: true, userId: 'user_mock' };
}
