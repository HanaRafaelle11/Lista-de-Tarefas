import React, { useState, useRef, useEffect } from 'react';
import { Shield, Lock, Mail, User, CheckCircle2, ArrowLeft, Send, KeyRound, Loader2, Sparkles } from 'lucide-react';
import { supabase, REDIRECT_URL } from '../supabaseClient';
import { eventsService } from '../services/eventsService';

import { useAppContext } from '../contexts/AppContext';
import { useTheme } from '../design-system/theme/useTheme';
import { getLogo } from '../design-system/branding/logo';

// ── Helpers ──────────────────────────────────────────────────────────
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Traduz mensagens de erro do Supabase para português amigável */
const friendlyError = (msg) => {
  if (!msg) return 'Ocorreu um erro inesperado. Tente novamente.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials'))
    return 'E-mail ou senha incorretos. Verifique e tente novamente.';
  if (m.includes('email not confirmed') || m.includes('confirmed'))
    return 'Seu e-mail ainda não foi confirmado. Ative sua conta pelo link enviado para sua caixa de entrada.';
  if (m.includes('user not found') || m.includes('no user'))
    return 'Não encontramos uma conta com este e-mail.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.';
  if (m.includes('password') && m.includes('least'))
    return 'A senha deve ter pelo menos 6 caracteres.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Este e-mail já está cadastrado. Tente fazer login.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Erro de conexão. Verifique sua internet e tente novamente.';
  return msg;
};

// ── Spinner inline para botões ───────────────────────────────────────
const BtnSpinner = () => (
  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
);

// ── Component ────────────────────────────────────────────────────────
export default function Auth({ onLoginSuccess, initialMode = 'login', onBackToLanding }) {
  const { theme, handleStartDemoMode, logAuthEvent, openCustomAlert } = useAppContext();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (import.meta.env.PROD && REDIRECT_URL.includes('localhost')) {
      console.error('[CRITICAL] REDIRECT_URL points to localhost in production!');
      openCustomAlert('[CRITICAL ERROR] A URL de redirecionamento está configurada como localhost em ambiente de produção. Por favor, ajuste as variáveis de ambiente.');
    }
  }, [openCustomAlert]);

  useEffect(() => {
    const checkCooldown = () => {
      const stored = localStorage.getItem('otp_cooldown_timestamp');
      if (stored) {
        const remaining = Math.ceil((parseInt(stored, 10) - Date.now()) / 1000);
        if (remaining > 0) {
          setCooldown(remaining);
          return remaining;
        } else {
          localStorage.removeItem('otp_cooldown_timestamp');
        }
      }
      return 0;
    };

    const initialRemaining = checkCooldown();
    if (initialRemaining > 0) {
      const timer = setInterval(() => {
        const remaining = checkCooldown();
        if (remaining <= 0) {
          clearInterval(timer);
          setCooldown(0);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, []);

  const triggerCooldown = () => {
    const future = Date.now() + 60 * 1000;
    localStorage.setItem('otp_cooldown_timestamp', String(future));
    setCooldown(60);
    const timer = setInterval(() => {
      const stored = localStorage.getItem('otp_cooldown_timestamp');
      if (stored) {
        const remaining = Math.ceil((parseInt(stored, 10) - Date.now()) / 1000);
        if (remaining > 0) {
          setCooldown(remaining);
        } else {
          localStorage.removeItem('otp_cooldown_timestamp');
          setCooldown(0);
          clearInterval(timer);
        }
      } else {
        setCooldown(0);
        clearInterval(timer);
      }
    }, 1000);
  };
  const [mode, setMode] = useState(initialMode); // 'login', 'signup', 'recovery', 'updatePassword'
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'magicLink'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isWaitingConfirmation, setIsWaitingConfirmation] = useState(false);
  const [isMagicLinkSent, setIsMagicLinkSent] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaUserObj, setMfaUserObj] = useState(null);
  
  const { mode: themeMode } = useTheme();
  const logo = getLogo(themeMode);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Auto-focus no campo de email ao entrar na tela
  useEffect(() => {
    if (mode === 'login' || mode === 'signup') {
      setTimeout(() => emailRef.current?.focus(), 150);
    }
  }, [mode]);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      logAuthEvent('google_login_started', '');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: REDIRECT_URL,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });
      if (error) {
        setError(friendlyError(error.message));
        logAuthEvent('google_login_failed', '', { error: error.message });
      }
    } catch (err) {
      setError('Erro ao autenticar com Google: ' + err.message);
      logAuthEvent('google_login_failed', '', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    setError('');
    setSuccess('');
    if (cooldown > 0) {
      setError(`Aguarde ${cooldown} segundos para reenviar o e-mail.`);
      return;
    }
    if (!email) {
      setError('Por favor, informe seu e-mail.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Por favor, informe um e-mail válido.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: REDIRECT_URL,
        },
      });
      if (error) {
        setError(friendlyError(error.message));
        logAuthEvent('magic_link_failed', email, { error: error.message });
      } else {
        setIsMagicLinkSent(true);
        setSuccess(`Enviamos um link de acesso para ${email}. Verifique sua caixa de entrada.`);
        logAuthEvent('magic_link_requested', email);
        triggerCooldown();
      }
    } catch (err) {
      setError('Erro ao enviar link mágico: ' + err.message);
      logAuthEvent('magic_link_failed', email, { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setShowResendButton(false);

    // ── Recovery ───────────────────────────────────────────────────
    if (mode === 'recovery') {
      if (cooldown > 0) {
        setError(`Aguarde ${cooldown} segundos para solicitar novamente.`);
        return;
      }
      if (!email) {
        setError('Por favor, informe seu e-mail.');
        return;
      }
      if (!isValidEmail(email)) {
        setError('Por favor, informe um e-mail válido.');
        return;
      }
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: REDIRECT_URL + '/#type=recovery',
        });
        if (error) {
          setError(friendlyError(error.message));
          logAuthEvent('password_reset_failed', email, { error: error.message });
        } else {
          setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
          logAuthEvent('password_reset_requested', email);
          triggerCooldown();
        }
      } catch (err) {
        setError('Erro ao processar: ' + err.message);
        logAuthEvent('password_reset_failed', email, { error: err.message });
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Update Password ───────────────────────────────────────────
    if (mode === 'updatePassword') {
      if (!password || password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      setLoading(true);
      try {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          setError(friendlyError(error.message));
          logAuthEvent('password_update_failed', '', { error: error.message });
        } else {
          setSuccess('Senha atualizada com sucesso! Você já pode acessar sua conta.');
          logAuthEvent('password_update_success', '');
          setTimeout(() => setMode('login'), 2000);
        }
      } catch (err) {
        setError('Erro ao atualizar: ' + err.message);
        logAuthEvent('password_update_failed', '', { error: err.message });
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Magic Link (via form submit) ──────────────────────────────
    if (mode === 'login' && loginMethod === 'magicLink') {
      handleMagicLink();
      return;
    }

    // ── Login / Signup validation ─────────────────────────────────
    if (!email || (mode !== 'recovery' && loginMethod === 'password' && !password) || (mode === 'signup' && !name)) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Por favor, informe um e-mail válido.');
      return;
    }
    if (mode !== 'recovery' && loginMethod === 'password' && password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        // ── Login com senha ─────────────────────────────────────
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          logAuthEvent('login_failed', email, { error: error.message, method: 'password' });
          if (error.message.includes('Email not confirmed') || error.message.includes('confirmar') || error.message.includes('confirmed')) {
            setError('Seu e-mail ainda não foi confirmado. Por favor, ative sua conta pelo link enviado para sua caixa de entrada.');
            setShowResendButton(true);
          } else {
            setError(friendlyError(error.message));
          }
        } else if (data?.user) {
          // Check if MFA is required
          const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (!aalError && aalData && aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
            const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
            if (!factorsError && factorsData && factorsData.totp && factorsData.totp.length > 0) {
              const activeFactor = factorsData.totp[0];
              setMfaFactorId(activeFactor.id);
              setMfaUserObj({
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.name || data.user.email.split('@')[0],
                user_metadata: data.user.user_metadata || {},
              });
              setMode('mfaChallenge');
              setMfaCode('');
              setLoading(false);
              return;
            }
          }

          if (!data.user.email_confirmed_at && !data.user.user_metadata?.email_verified) {
            await supabase.auth.signOut();
            setError('Seu e-mail ainda não foi confirmado. Por favor, ative sua conta pelo link enviado para sua caixa de entrada.');
            setShowResendButton(true);
            setLoading(false);
            return;
          }
          setSuccess('Login realizado com sucesso! Redirecionando...');
          const userObj = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name || data.user.email.split('@')[0],
            user_metadata: data.user.user_metadata || {},
          };
          logAuthEvent('login_success', email, { method: 'password', user_id: data.user.id });
          eventsService.logEvent(data.user.id, 'session_started', {
            method: 'login',
            ts: new Date().toISOString(),
          });
          setTimeout(() => {
            onLoginSuccess(userObj);
          }, 1000);
        }
      } else if (mode === 'signup') {
        // ── Cadastro ─────────────────────────────────────────────
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: REDIRECT_URL,
            data: {
              name: name
            }
          }
        });

        if (error) {
          setError(friendlyError(error.message));
          logAuthEvent('signup_failed', email, { error: error.message });
        } else if (data?.user) {
          logAuthEvent('signup_success', email, { user_id: data.user.id });
          eventsService.logEvent(data.user.id, 'signup_completed', {
            method: 'email',
            name: name,
            ts: new Date().toISOString(),
            platform: navigator.userAgent?.includes('Mobile') ? 'mobile' : 'desktop',
          });
          eventsService.logEvent(data.user.id, 'onboarding_started', {
            ts: new Date().toISOString()
          });

          if (data.session && (data.user.email_confirmed_at || data.user.user_metadata?.email_verified)) {
            setSuccess('Conta criada e confirmada automaticamente! Entrando...');
            const userObj = {
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata?.name || name,
              user_metadata: data.user.user_metadata || {},
            };
            setTimeout(() => {
              onLoginSuccess(userObj);
            }, 1500);
          } else {
            if (data.session) await supabase.auth.signOut();
            setIsWaitingConfirmation(true);
            setSuccess('Conta criada! Enviamos um e-mail de confirmação.');
          }
        }
      }
    } catch (err) {
      setError('Erro na requisição: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setError('');
    setSuccess('');
    if (cooldown > 0) {
      setError(`Aguarde ${cooldown} segundos para reenviar.`);
      return;
    }
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: REDIRECT_URL
        }
      });
      if (error) {
        setError('Erro ao reenviar e-mail: ' + error.message);
        logAuthEvent('resend_confirmation_failed', email, { error: error.message });
      } else {
        setSuccess('E-mail de confirmação reenviado com sucesso! Verifique sua caixa de entrada.');
        logAuthEvent('resend_confirmation_success', email);
        triggerCooldown();
      }
    } catch (e) {
      setError('Erro ao reenviar: ' + e.message);
      logAuthEvent('resend_confirmation_failed', email, { error: e.message });
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!mfaCode || mfaCode.length !== 6) {
      setError('Por favor, informe o código de 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;

      setSuccess('MFA verificado! Entrando...');
      eventsService.logEvent(mfaUserObj.id, 'session_started', {
        method: 'login_mfa',
        ts: new Date().toISOString(),
      });
      setTimeout(() => {
        onLoginSuccess(mfaUserObj);
      }, 1000);
    } catch (err) {
      setError('Erro ao verificar MFA: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMfa = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setMode('login');
      setMfaFactorId(null);
      setMfaUserObj(null);
    } catch (err) {
      console.error('Erro ao cancelar MFA:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setShowResendButton(false);
    setIsMagicLinkSent(false);
  };

  // Determina se o botão de submit deve estar habilitado
  const isSubmitDisabled = () => {
    if (loading) return true;
    if (mode === 'login' && loginMethod === 'magicLink') return !email || !isValidEmail(email) || cooldown > 0;
    if (mode === 'login' && loginMethod === 'password') return !email || !password;
    if (mode === 'signup') return !email || !password || !name;
    if (mode === 'recovery') return !email || cooldown > 0;
    if (mode === 'updatePassword') return !password || password.length < 6;
    return false;
  };

  // ── Render: MFA Challenge ──────────────────────────────────────
  if (mode === 'mfaChallenge') {
    return (
      <div style={styles.authContainer} className="animate-fade-in">
        <div style={styles.authCard}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--primary)' }}>
              <Shield size={48} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>Duas Etapas (MFA)</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
              Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.
            </p>
            
            <form onSubmit={handleMfaVerify} style={styles.form}>
              {error && <div style={styles.errorMessage}>{error}</div>}
              {success && <div style={styles.successMessage}>{success}</div>}

              <div style={styles.inputGroup}>
                <label style={styles.label}>Código de Verificação</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputIcon}><Lock size={18} /></span>
                  <input
                    type="text"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    style={{ ...styles.input, textAlign: 'center', fontSize: '20px', letterSpacing: '8px' }}
                    className="form-input"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary-glow" style={styles.submitBtn} disabled={loading}>
                {loading ? <><BtnSpinner /> Verificando...</> : 'Confirmar'}
              </button>

              <button 
                type="button" 
                onClick={handleCancelMfa} 
                className="toggle-btn"
                style={{ ...styles.toggleBtn, padding: '12px', fontSize: '14px', alignSelf: 'center', display: 'block', margin: '12px auto 0' }}
                disabled={loading}
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Waiting Email Confirmation ─────────────────────────
  if (isWaitingConfirmation) {
    return (
      <div style={styles.authContainer} className="animate-fade-in">
        <div style={styles.authCard}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--primary)' }}>
              <Mail size={56} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>Confirme seu E-mail</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
              Enviamos um link de confirmação para <strong>{email}</strong>. Acesse seu e-mail e clique no link para ativar sua conta do <strong>MyFlowDay</strong>.
            </p>
            
            {success && <div style={{ ...styles.successMessage, marginBottom: '20px' }}>{success}</div>}
            {error && <div style={{ ...styles.errorMessage, marginBottom: '20px' }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={handleResendConfirmation} 
                className="btn-primary-glow"
                style={{ ...styles.submitBtn, marginTop: 0 }}
              >
                Reenviar E-mail de Confirmação
              </button>
              <button 
                onClick={() => {
                  setIsWaitingConfirmation(false);
                  switchMode('login');
                }} 
                style={{ ...styles.toggleBtn, padding: '12px', fontSize: '14px', alignSelf: 'center' }}
              >
                Voltar para o Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Magic Link Sent ────────────────────────────────────
  if (isMagicLinkSent) {
    return (
      <div style={styles.authContainer} className="animate-fade-in">
        <div style={styles.authCard}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ 
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Send size={28} style={{ color: 'white' }} />
              </div>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>
              Link enviado!
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '8px' }}>
              Enviamos um link de acesso para:
            </p>
            <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)', marginBottom: '24px' }}>
              {email}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', lineHeight: '1.6', marginBottom: '28px' }}>
              Verifique sua caixa de entrada e clique no link para entrar no MyFlowDay. O link expira em 1 hora.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => {
                  setIsMagicLinkSent(false);
                  handleMagicLink();
                }} 
                className="btn-primary-glow"
                style={{ ...styles.submitBtn, marginTop: 0 }}
                disabled={loading}
              >
                {loading ? <><BtnSpinner /> Reenviando...</> : 'Reenviar Link'}
              </button>
              <button 
                onClick={() => {
                  setIsMagicLinkSent(false);
                  setSuccess('');
                }} 
                style={{ ...styles.toggleBtn, padding: '12px', fontSize: '14px', alignSelf: 'center' }}
              >
                Voltar para o Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Main Auth Form ─────────────────────────────────────
  return (
    <div style={styles.authContainer} className="animate-fade-in">
      <div style={styles.authCard}>
        {onBackToLanding && (
          <button 
            type="button"
            onClick={onBackToLanding}
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-muted)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '20px',
              transition: 'all 0.2s',
              zIndex: 10
            }}
            className="auth-back-btn"
          >
            <ArrowLeft size={14} />
            <span>Voltar ao início</span>
          </button>
        )}

        {/* Top Header — Logo */}
        <div style={{ position: 'relative', ...styles.cardHeader, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginTop: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }} className="auth-brand-container">
            <img 
              src={logo.src} 
              alt={logo.alt} 
              onClick={onBackToLanding}
              style={{ height: '80px', width: 'auto', objectFit: 'contain', marginBottom: '8px', background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, cursor: 'pointer' }} 
            />
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', margin: '0 0 24px 0', letterSpacing: '0.5px', fontWeight: '500', textAlign: 'center' }}>
              {mode === 'updatePassword' ? 'Crie sua nova senha de acesso.' :
               mode === 'recovery' ? 'Recupere o acesso à sua conta.' :
               mode === 'signup' ? 'Crie sua conta e comece a evoluir.' :
               'Planeje. Execute. Evolua.'}
            </p>
          </div>
        </div>

        {/* ── Login Method Tabs ─────────────────────────────────── */}
        {mode === 'login' && (
          <div style={styles.tabContainer}>
            <button
              type="button"
              onClick={() => { setLoginMethod('password'); setError(''); setSuccess(''); }}
              style={{
                ...styles.tab,
                ...(loginMethod === 'password' ? styles.tabActive : {}),
              }}
            >
              <KeyRound size={15} />
              Senha
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod('magicLink'); setError(''); setSuccess(''); }}
              style={{
                ...styles.tab,
                ...(loginMethod === 'magicLink' ? styles.tabActive : {}),
              }}
            >
              <Send size={15} />
              Link Mágico
            </button>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.errorMessage}>{error}</div>}
          {success && <div style={styles.successMessage}>{success}</div>}

          {mode === 'signup' && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Nome Completo</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}><User size={18} /></span>
                <input
                  type="text"
                  placeholder="Ex: João Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                  className="form-input"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {mode !== 'updatePassword' && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>E-mail</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}><Mail size={18} /></span>
                <input
                  ref={emailRef}
                  type="email"
                  placeholder="usuario@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                  className="form-input"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>
          )}

          {/* Campos de senha — visíveis quando NÃO é recovery e NÃO é magic link no modo login */}
          {mode !== 'recovery' && !(mode === 'login' && loginMethod === 'magicLink') && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>{mode === 'updatePassword' ? 'Nova Senha' : 'Senha'}</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}><Lock size={18} /></span>
                <input
                  ref={passwordRef}
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                  className="form-input"
                  disabled={loading}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </div>
              {/* Indicador de força da senha para signup */}
              {(mode === 'signup' || mode === 'updatePassword') && password && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <div style={{ flex: 1, height: '3px', borderRadius: '2px', backgroundColor: 'var(--border-light)', overflow: 'hidden' }}>
                    <div style={{ 
                      width: password.length < 6 ? '33%' : password.length < 10 ? '66%' : '100%',
                      height: '100%',
                      borderRadius: '2px',
                      backgroundColor: password.length < 6 ? '#ef4444' : password.length < 10 ? '#f59e0b' : '#22c55e',
                      transition: 'all 0.3s',
                    }} />
                  </div>
                  <span style={{ fontSize: '11px', color: password.length < 6 ? '#ef4444' : password.length < 10 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                    {password.length < 6 ? 'Fraca' : password.length < 10 ? 'Média' : 'Forte'}
                  </span>
                </div>
              )}
              {mode === 'login' && loginMethod === 'password' && (
                <button 
                  type="button" 
                  onClick={() => switchMode('recovery')}
                  style={{ ...styles.toggleBtn, alignSelf: 'flex-end', marginTop: '4px', fontSize: '12px', marginLeft: 0 }}
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
          )}

          {/* Dica de magic link */}
          {mode === 'login' && loginMethod === 'magicLink' && (
            <div style={{ 
              padding: '14px 16px', borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(37, 99, 235, 0.06)', border: '1px solid rgba(37, 99, 235, 0.15)',
              fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5'
            }}>
              <strong style={{ color: 'var(--text-main)' }}>Como funciona?</strong><br/>
              Enviaremos um link para seu e-mail. Basta clicar nele para entrar automaticamente, sem precisar de senha.
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary-glow" 
            style={{ 
              ...styles.submitBtn, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              opacity: isSubmitDisabled() ? 0.6 : 1,
              cursor: isSubmitDisabled() ? 'not-allowed' : 'pointer',
            }} 
            disabled={isSubmitDisabled()}
          >
            {loading ? (
              <><BtnSpinner /> Processando...</>
            ) : mode === 'recovery' ? (
              cooldown > 0 ? `Aguarde ${cooldown}s` : 'Enviar Link de Recuperação'
            ) : mode === 'updatePassword' ? (
              'Redefinir Senha'
            ) : mode === 'login' && loginMethod === 'magicLink' ? (
              cooldown > 0 ? `Aguarde ${cooldown}s` : <><Send size={16} /> Enviar Link Mágico</>
            ) : mode === 'login' ? (
              'Acessar Conta'
            ) : (
              'Criar Conta'
            )}
          </button>

          {/* Divisor + Google + Demo */}
          {(mode === 'login' || mode === 'signup') && (
            <>
              <div style={styles.divider}>
                <div style={styles.dividerLine} />
                <span style={styles.dividerText}>ou</span>
                <div style={styles.dividerLine} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  style={{
                    ...styles.submitBtn,
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    border: '1.5px solid var(--border-medium)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    marginTop: 0,
                    transition: 'all 0.2s',
                  }}
                  className="auth-google-btn"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                  </svg>
                  Entrar com o Google
                </button>
                <button
                  type="button"
                  onClick={handleStartDemoMode}
                  disabled={loading}
                  style={{
                    ...styles.submitBtn,
                    backgroundColor: 'transparent',
                    border: '1.5px solid var(--border-medium)',
                    color: 'var(--text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    marginTop: 0
                  }}
                >
                  <Sparkles size={17} /> Experimentar sem criar conta
                </button>
              </div>
            </>
          )}

          {(mode === 'recovery' || mode === 'updatePassword') && (
            <button 
              type="button" 
              onClick={() => switchMode('login')} 
              style={{ ...styles.toggleBtn, margin: '8px auto 0', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <ArrowLeft size={14} /> Voltar para o Login
            </button>
          )}

          {mode === 'login' && showResendButton && (
            <button 
              type="button" 
              onClick={handleResendConfirmation} 
              style={{ ...styles.toggleBtn, margin: '8px auto 0', display: 'block' }}
            >
              Reenviar e-mail de confirmação
            </button>
          )}
        </form>

        {/* Rodapé Alternador */}
        {mode !== 'updatePassword' && (
          <div style={styles.cardFooter}>
            <p style={styles.footerText}>
              {mode === 'login' ? 'Não tem uma conta?' :
               mode === 'recovery' ? '' :
               'Já possui uma conta?'}
              {mode !== 'recovery' && (
                <button
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  style={styles.toggleBtn}
                  disabled={loading}
                >
                  {mode === 'login' ? 'Cadastre-se' : 'Faça Login'}
                </button>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Inline styles for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .auth-google-btn:hover {
          background-color: var(--bg-app) !important;
          border-color: var(--primary) !important;
        }
        .auth-back-btn:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
        }
      `}</style>
    </div>
  );
}

const styles = {
  authContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
    backgroundColor: 'var(--bg-app)',
    padding: '24px',
  },
  authCard: {
    position: 'relative',
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-light)',
    width: '100%',
    maxWidth: '480px',
    overflow: 'hidden',
    padding: '60px 32px 40px 32px',
  },
  cardHeader: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  tabContainer: {
    display: 'flex',
    gap: '4px',
    padding: '4px',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border-light)',
    marginBottom: '24px',
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    borderRadius: '9px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '13.5px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'var(--font-display)',
  },
  tabActive: {
    backgroundColor: 'var(--bg-card)',
    color: 'var(--primary)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '550',
    color: 'var(--text-main)',
    fontFamily: 'var(--font-display)',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    color: 'var(--text-light)',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  input: {
    paddingLeft: '42px',
  },
  submitBtn: {
    width: '100%',
    height: '52px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    marginTop: '10px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '4px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: 'var(--border-light)',
  },
  dividerText: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-light)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  errorMessage: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fca5a5',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: '13px',
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
  },
  successMessage: {
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    border: '1px solid #a7f3d0',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: '13px',
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
  },
  cardFooter: {
    marginTop: '32px',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '14px',
    color: 'var(--text-muted)',
  },
  toggleBtn: {
    color: 'var(--primary)',
    fontWeight: '600',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    marginLeft: '6px',
    fontSize: '14px',
  },
  demoBanner: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '20px',
    fontSize: '11px',
    color: 'var(--text-light)',
    backgroundColor: 'var(--bg-app)',
    padding: '6px 12px',
    borderRadius: '99px',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  logoText: {
    fontSize: '28px',
    fontFamily: 'var(--font-display)',
    fontWeight: '800',
    background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '14px',
    fontFamily: 'var(--font-body)',
  },
};
