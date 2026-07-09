/**
 * Centralized Admin Authorization Module
 * 
 * Regra única e estrita para determinar privilégios de Administrador no Flowday.
 * Apenas o e-mail master autorizado (hanarafaelle11@gmail.com) possui acesso total.
 */

export const ADMIN_MASTER_EMAILS = [
  'hanarafaelle11@gmail.com'
];

export function isAdmin(userOrEmail) {
  if (!userOrEmail) return false;
  
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
    if (ADMIN_MASTER_EMAILS.some(adm => cleanEmail === adm.toLowerCase().trim())) {
      return true;
    }
  }

  return false;
}
