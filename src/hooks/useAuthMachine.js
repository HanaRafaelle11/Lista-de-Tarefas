/**
 * useAuthMachine — Auth State Machine determinística para Flowday
 *
 * Arquitetura baseada em reducer pattern (Clerk/Auth0 internals style).
 * Elimina race conditions, estados intermediários e loading infinito por design.
 *
 * ┌─────────────┐   INIT    ┌──────────────────┐
 * │   BOOTING   │ ────────► │ CHECKING_SESSION  │
 * └─────────────┘           └──────────────────┘
 *                                    │
 *              ┌─────────────────────┼──────────────────────┐
 *              ▼                     ▼                      ▼
 *     ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐
 *     │  AUTHENTICATED  │  │ UNAUTHENTICATED  │  │     ERROR       │
 *     └─────────────────┘  └──────────────────┘  └─────────────────┘
 *              │  ▲                  │  ▲
 *    SIGNED_OUT│  │SIGNED_IN         │  │SIGNED_IN
 *              ▼  │                  ▼  │
 *     ┌──────────────────┐  ┌─────────────────┐
 *     │ UNAUTHENTICATED  │  │  AUTHENTICATED  │
 *     └──────────────────┘  └─────────────────┘
 *
 * Estados:
 *   BOOTING           — app montado, ainda não iniciou verificação
 *   CHECKING_SESSION  — getSession() em voo
 *   AUTHENTICATED     — usuário logado (user + session populados)
 *   UNAUTHENTICATED   — sem sessão, pronto para mostrar login
 *   ERROR             — falha na verificação (tratada como UNAUTHENTICATED para UI)
 *
 * Eventos:
 *   INIT              — inicia verificação (BOOTING → CHECKING_SESSION)
 *   SESSION_RESOLVED  — getSession() retornou (com ou sem user)
 *   SIGNED_IN         — onAuthStateChange: SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED
 *   SIGNED_OUT        — onAuthStateChange: SIGNED_OUT
 *   USER_UPDATED      — onAuthStateChange: USER_UPDATED (metadados, sem transição de estado)
 *   ERROR             — getSession() lançou erro
 *   TIMEOUT           — fallback de 3s disparou sem resposta do Supabase
 *
 * Garantias por design:
 *   [OK] executa exatamente 1 vez por lifecycle da app (ref de guarda)
 *   [OK] timer de fallback sobrevive a cleanup de useEffect (StrictMode-safe)
 *   [OK] reducer é pure function — sem side effects, 100% previsível
 *   [OK] onAuthStateChange é o único subscriber de eventos externos
 *   [OK] loading infinito é impossível: qualquer caminho converge em ≤3s
 */

import { useReducer, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { eventsService } from '../services/eventsService';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Constrói o objeto de usuário normalizado a partir do raw Supabase user.
 * Sempre retorna um objeto limpo — nunca undefined.
 */
function buildUser(rawUser) {
  const rawName = rawUser.user_metadata?.name || '';
  const genericNames = ['user', 'usuario', 'null', 'undefined', ''];
  const isGeneric = genericNames.includes(rawName.toLowerCase().trim());
  const emailName = rawUser.email?.split('@')[0] || '';
  const safeName = isGeneric ? (emailName || 'Usuário') : rawName;
  return {
    id: rawUser.id,
    email: rawUser.email,
    name: safeName,
    user_metadata: rawUser.user_metadata || {},
    isDemo: rawUser.isDemo || false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado inicial
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  status: 'BOOTING',
  user: null,
  session: null,
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Reducer — pure function, zero side effects
// Mapeia (estado atual, evento) → próximo estado
// Se o evento não é válido para o estado atual, retorna estado inalterado.
// ─────────────────────────────────────────────────────────────────────────────

function authReducer(state, event) {
  switch (state.status) {

    // ── BOOTING ───────────────────────────────────────────────────────────────
    case 'BOOTING': {
      if (event.type === 'INIT') {
        return { ...state, status: 'CHECKING_SESSION' };
      }
      return state;
    }

    // ── CHECKING_SESSION ──────────────────────────────────────────────────────
    case 'CHECKING_SESSION': {
      if (event.type === 'SESSION_RESOLVED') {
        if (event.session?.user) {
          return {
            status: 'AUTHENTICATED',
            user: buildUser(event.session.user),
            session: event.session,
            error: null,
          };
        }
        return { status: 'UNAUTHENTICATED', user: null, session: null, error: null };
      }

      // PKCE: INITIAL_SESSION chega via onAuthStateChange antes de getSession() resolver
      if (event.type === 'SIGNED_IN') {
        return {
          status: 'AUTHENTICATED',
          user: buildUser(event.rawUser),
          session: event.session,
          error: null,
        };
      }

      if (event.type === 'SIGNED_OUT') {
        return { status: 'UNAUTHENTICATED', user: null, session: null, error: null };
      }

      if (event.type === 'ERROR' || event.type === 'TIMEOUT') {
        // Tratamos como UNAUTHENTICATED para a UI — não fica preso em loading
        return {
          status: 'UNAUTHENTICATED',
          user: null,
          session: null,
          error: event.error || 'Auth timeout',
        };
      }

      return state;
    }

    // ── AUTHENTICATED ─────────────────────────────────────────────────────────
    case 'AUTHENTICATED': {
      if (event.type === 'SIGNED_OUT') {
        return { status: 'UNAUTHENTICATED', user: null, session: null, error: null };
      }

      if (event.type === 'SIGNED_IN') {
        // Token refresh ou re-autenticação — atualiza user/session sem transição de estado
        return {
          ...state,
          user: buildUser(event.rawUser),
          session: event.session,
        };
      }

      if (event.type === 'USER_UPDATED') {
        // Apenas metadados mudam — preserva weekly_plan local para evitar perda de dado
        const updatedUser = buildUser(event.rawUser);
        const localWeeklyPlan = state.user?.user_metadata?.weekly_plan;
        return {
          ...state,
          user: {
            ...updatedUser,
            user_metadata: {
              ...updatedUser.user_metadata,
              weekly_plan: localWeeklyPlan === null ? null : updatedUser.user_metadata?.weekly_plan,
            },
          },
        };
      }

      return state;
    }

    // ── UNAUTHENTICATED ───────────────────────────────────────────────────────
    case 'UNAUTHENTICATED': {
      if (event.type === 'SIGNED_IN') {
        return {
          status: 'AUTHENTICATED',
          user: buildUser(event.rawUser),
          session: event.session,
          error: null,
        };
      }
      return state;
    }

    // ── ERROR (alias de UNAUTHENTICATED para UI) ──────────────────────────────
    case 'ERROR': {
      if (event.type === 'SIGNED_IN') {
        return {
          status: 'AUTHENTICATED',
          user: buildUser(event.rawUser),
          session: event.session,
          error: null,
        };
      }
      return state;
    }

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useAuthMachine()
 *
 * Retorna:
 *   status    — AuthState atual ('BOOTING' | 'CHECKING_SESSION' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'ERROR')
 *   user      — objeto de usuário normalizado ou null
 *   session   — objeto de sessão Supabase ou null
 *   isLoading — true enquanto status é BOOTING ou CHECKING_SESSION
 *   error     — mensagem de erro ou null
 *   dispatch  — envia eventos para a machine (para compat com código legado)
 */
export function useAuthMachine() {
  const [authState, dispatch] = useReducer(authReducer, INITIAL_STATE);

  // Guarda de inicialização: previne double-init em StrictMode ou remounts.
  // Sobrevive ao cleanup do useEffect porque é uma ref de componente.
  const startedRef = useRef(false);

  // Timer de fallback em ref: NÃO é cancelado pelo cleanup do useEffect.
  // Só é cancelado quando a machine transita para fora de CHECKING_SESSION.
  const timeoutRef = useRef(null);

  // Cancela o timer de fallback quando a machine resolve (qualquer caminho)
  const clearFallback = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Guarda: se já iniciou (StrictMode remount), não reinicia
    if (startedRef.current) return;
    startedRef.current = true;

    let effectActive = true;

    // ── Limpeza de URL OAuth ─────────────────────────────────────────────────
    // Sanitiza erros OAuth da URL antes de qualquer verificação de sessão.
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      if (
        searchParams.has('error') ||
        searchParams.get('error_code') === 'bad_oauth_state' ||
        hashParams.has('error')
      ) {
        console.warn('[AuthMachine] Sanitizando erro OAuth da URL.');
        window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      }
    }

    // ── 1. INIT: BOOTING → CHECKING_SESSION ──────────────────────────────────
    dispatch({ type: 'INIT' });

    // ── 2. Fallback de Timeout (ref — sobrevive ao cleanup) ───────────────────
    // Se Supabase não responder em 3s (rede offline, SW stale, PKCE travado),
    // dispara TIMEOUT → machine transita para UNAUTHENTICATED → loading finaliza.
    // O cleanup do useEffect NÃO cancela este timer intencionalmente.
    if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        console.warn('[AuthMachine] TIMEOUT após 3s — forçando UNAUTHENTICATED.');
        clearFallback();
        dispatch({ type: 'TIMEOUT', error: 'Supabase não respondeu em 3s' });
      }, 3000);
    }

    // ── 3. onAuthStateChange — registrado ANTES de getSession() ──────────────
    // Crítico para PKCE: INITIAL_SESSION chega pelo listener antes de
    // getSession() resolver. O listener também mantém sessão atualizada
    // durante toda a vida do componente (token refresh, logout, etc.).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!effectActive) return;

      console.debug('[AuthMachine] onAuthStateChange:', event, !!session?.user);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          clearFallback();
          dispatch({ type: 'SIGNED_IN', rawUser: session.user, session });
          eventsService
            .logEvent(session.user.id, 'login', { method: 'auth_state_change', event })
            .catch(() => {});
        } else {
          // Evento de SIGNED_IN sem user (edge case) — trata como sem sessão
          dispatch({ type: 'SIGNED_OUT' });
        }
      } else if (event === 'USER_UPDATED') {
        if (session?.user) {
          dispatch({ type: 'USER_UPDATED', rawUser: session.user, session });
        }
      } else if (event === 'SIGNED_OUT') {
        dispatch({ type: 'SIGNED_OUT' });
      }
      // PASSWORD_RECOVERY e outros eventos não afetam auth state da machine
    });

    // ── 4. getSession() — verificação primária de sessão existente ────────────
    // Lê sessão do localStorage/cookie (não faz request de rede se disponível).
    // Em PKCE, pode já ter sido resolvido via INITIAL_SESSION acima — o reducer
    // ignora SESSION_RESOLVED idempotentemente (estado já AUTHENTICATED).
    const isDemoActive = typeof window !== 'undefined' && localStorage.getItem('flowday_demo_active') === 'true';
    if (isDemoActive) {
      clearFallback();
      const demoUser = {
        id: 'demo-user',
        email: 'demo@flowday.app',
        name: 'Explorador Demo',
        isDemo: true,
        user_metadata: { name: 'Explorador Demo', onboarding_completed: true }
      };
      dispatch({ type: 'SIGNED_IN', rawUser: demoUser, session: null });
    } else {
      supabase.auth.getSession()
        .then(({ data: { session }, error }) => {
          if (!effectActive) return;
          clearFallback();

          if (error) {
            console.error('[AuthMachine] getSession error:', error);
            dispatch({ type: 'ERROR', error: error.message });
            return;
          }

          if (session?.user) {
            eventsService
              .logEvent(session.user.id, 'login', { method: 'session_restore' })
              .catch(() => {});
          }

          dispatch({ type: 'SESSION_RESOLVED', session: session || null });
        })
        .catch((err) => {
          if (!effectActive) return;
          clearFallback();
          console.error('[AuthMachine] getSession threw:', err);
          dispatch({ type: 'ERROR', error: err.message });
        });
    }

    return () => {
      effectActive = false;
      subscription?.unsubscribe?.();
      // INTENCIONALMENTE não cancela timeoutRef aqui.
      // O timer continua vivo para garantir que TIMEOUT dispare mesmo
      // se o effect for re-montado pelo StrictMode antes de Supabase responder.
    };
  }, [clearFallback]); // clearFallback é stable (useCallback + [])

  return {
    status: authState.status,
    user: authState.user,
    session: authState.session,
    error: authState.error,
    isLoading: authState.status === 'BOOTING' || authState.status === 'CHECKING_SESSION',
    dispatch,
  };
}
