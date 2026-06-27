/**
 * Centralized Admin Authorization Module
 * 
 * Regra única e estrita para determinar privilégios de Administrador no Flowday.
 * Apenas o e-mail master autorizado (hanarafaelle11@gmail.com) possui acesso total.
 */

export const ADMIN_MASTER_EMAIL = 'hanarafaelle11@gmail.com';

/**
 * Valida se um usuário ou e-mail é o Administrador Master.
 * @param {object|string} userOrEmail - Objeto de usuário Supabase ou string de e-mail.
 * @returns {boolean} True se for o admin master, false caso contrário.
 */
export function isAdmin(userOrEmail) {
  if (!userOrEmail) return false;
  
  let email = '';
  if (typeof userOrEmail === 'string') {
    email = userOrEmail;
  } else if (typeof userOrEmail === 'object') {
    email = userOrEmail.email || '';
  }

  if (!email || typeof email !== 'string') return false;

  return email.toLowerCase().trim() === ADMIN_MASTER_EMAIL;
}
