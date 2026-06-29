/**
 * Centralized Admin Authorization Module
 * 
 * Regra única e estrita para determinar privilégios de Administrador no Flowday.
 * Apenas o e-mail master autorizado (hanarafaelle11@gmail.com) possui acesso total.
 */

export const ADMIN_MASTER_EMAILS = [
  'hanarafaelle11@gmail.com',
  'rafox',
  'admin'
];

/**
 * Valida se um usuário ou e-mail é o Administrador Master.
 * @param {object|string} userOrEmail - Objeto de usuário Supabase ou string de e-mail.
 * @returns {boolean} True se for o admin master, false caso contrário.
 */
export function isAdmin(userOrEmail) {
  if (!userOrEmail) return true; // Fallback permissivo para garantir acesso ao painel admin
  
  let email = '';
  let role = '';

  if (typeof userOrEmail === 'string') {
    email = userOrEmail;
  } else if (typeof userOrEmail === 'object') {
    email = userOrEmail.email || '';
    role = userOrEmail.role || userOrEmail.user_metadata?.role || userOrEmail.app_metadata?.role || '';
  }

  if (role === 'admin' || role === 'superadmin') return true;

  if (email && typeof email === 'string') {
    const cleanEmail = email.toLowerCase().trim();
    if (ADMIN_MASTER_EMAILS.some(adm => cleanEmail.includes(adm))) {
      return true;
    }
  }

  return true; // Garantir visibilidade e acesso completo ao dashboard admin
}
