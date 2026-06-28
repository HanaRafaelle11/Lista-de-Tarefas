import React, { useState } from 'react';
import { Shield, Lock, Mail, User, CheckCircle2, ArrowLeft } from 'lucide-react';
import { supabase, REDIRECT_URL } from '../supabaseClient';
import { eventsService } from '../services/eventsService';

import { useAppContext } from '../contexts/AppContext';

export default function Auth({ onLoginSuccess, initialMode = 'login' }) {
  const { theme, handleStartDemoMode } = useAppContext();
  const [mode, setMode] = useState(initialMode); // 'login', 'signup', 'recovery', 'updatePassword'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isWaitingConfirmation, setIsWaitingConfirmation] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaUserObj, setMfaUserObj] = useState(null);

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
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
        setError(error.message);
      }
      // Supabase irá lidar com o redirecionamento, então nenhuma ação adicional aqui em caso de sucesso
    } catch (err) {
      setError('Erro ao autenticar com Google: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setShowResendButton(false);

    if (mode === 'recovery') {
      if (!email) {
        setError('Por favor, informe seu e-mail.');
        return;
      }
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: REDIRECT_URL + '/#type=recovery',
        });
        if (error) {
          setError(error.message);
        } else {
          setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
        }
      } catch (err) {
        setError('Erro ao processar: ' + err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'updatePassword') {
      if (!password || password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      setLoading(true);
      try {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          setError(error.message);
        } else {
          setSuccess('Senha atualizada com sucesso! Você já pode acessar sua conta.');
          setTimeout(() => setMode('login'), 2000);
        }
      } catch (err) {
        setError('Erro ao atualizar: ' + err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password || (mode === 'signup' && !name)) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        // Processo de Login no Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          if (error.message.includes('Email not confirmed') || error.message.includes('confirmar') || error.message.includes('confirmed')) {
            setError('Seu e-mail ainda não foi confirmado. Por favor, ative sua conta pelo link enviado para sua caixa de entrada.');
            setShowResendButton(true);
          } else {
            setError(error.message || 'E-mail ou senha incorretos.');
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
          // Growth event: session_started no login explícito
          eventsService.logEvent(data.user.id, 'session_started', {
            method: 'login',
            ts: new Date().toISOString(),
          });
          setTimeout(() => {
            onLoginSuccess(userObj);
          }, 1000);
        }
      } else if (mode === 'signup') {
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

        console.log("SIGNUP RESPONSE", data);
        console.log("SIGNUP ERROR", error);

        if (error) {
          setError(error.message || 'Erro ao criar conta.');
        } else if (data?.user) {
          // Growth event: signup_completed com metadados enriquecidos
          eventsService.logEvent(data.user.id, 'signup_completed', {
            method: 'email',
            name: name,
            ts: new Date().toISOString(),
            platform: navigator.userAgent?.includes('Mobile') ? 'mobile' : 'desktop',
          });
          // Evento de onboarding iniciado automaticamente
          eventsService.logEvent(data.user.id, 'onboarding_started', {
            ts: new Date().toISOString()
          });

          // Se o Supabase já retornar a sessão confirmada
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
            // Se precisar confirmar e-mail
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
      } else {
        setSuccess('E-mail de confirmação reenviado com sucesso! Verifique sua caixa de entrada.');
      }
    } catch (e) {
      setError('Erro ao reenviar: ' + e.message);
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
                {loading ? 'Verificando...' : 'Confirmar'}
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

  // Tela de espera de confirmação de e-mail (Bloco 3 - Seção 6)
  if (isWaitingConfirmation) {
    return (
      <div style={styles.authContainer} className="animate-fade-in">
        <div style={styles.authCard}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px', color: 'var(--primary)' }}>✉️</div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>Confirme seu E-mail</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
              Enviamos um link de confirmação para <strong>{email}</strong>. Acesse seu e-mail e clique no link para ativar sua conta do <strong>Flowday</strong>.
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
                  setMode('login');
                  setError('');
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

  return (
    <div style={styles.authContainer} className="animate-fade-in">
      <div style={styles.authCard}>
        {/* Top Header com Gradiente */}
        <div style={{ position: 'relative', ...styles.cardHeader, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginTop: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }} className="auth-brand-container">
            <img 
              src={theme === 'dark' ? '/branding/logo-dark.svg' : '/branding/logo.svg'} 
              alt="MyFlowDay Logo" 
              style={{ height: '64px', width: 'auto', objectFit: 'contain', marginBottom: '8px', background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }} 
            />
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', margin: '0 0 24px 0', letterSpacing: '0.5px', fontWeight: '500', textAlign: 'center' }}>
              {mode === 'updatePassword' ? 'Crie sua nova senha de acesso.' : 'Planeje. Execute. Evolua.'}
            </p>
          </div>
        </div>

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
                  type="email"
                  placeholder="usuario@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                  className="form-input"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {mode !== 'recovery' && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>{mode === 'updatePassword' ? 'Nova Senha' : 'Senha'}</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}><Lock size={18} /></span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                  className="form-input"
                  disabled={loading}
                />
              </div>
              {mode === 'login' && (
                <button 
                  type="button" 
                  onClick={() => {
                    setMode('recovery');
                    setError('');
                    setSuccess('');
                  }}
                  style={{ ...styles.toggleBtn, alignSelf: 'flex-end', marginTop: '4px', fontSize: '12px' }}
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
          )}

          <button type="submit" className="btn-primary-glow" style={styles.submitBtn} disabled={loading}>
            {loading ? 'Processando...' : 
             mode === 'recovery' ? 'Enviar Link de Recuperação' : 
             mode === 'updatePassword' ? 'Redefinir Senha' :
             mode === 'login' ? 'Acessar Conta' : 'Criar Conta'}
          </button>

          {(mode === 'login' || mode === 'signup') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                style={{
                  ...styles.submitBtn,
                  backgroundColor: '#4285F4', // Google blue
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  marginTop: 0
                }}
              >
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
                🎮 Experimentar sem criar conta
              </button>
            </div>
          )}

          {(mode === 'recovery' || mode === 'updatePassword') && (
            <button 
              type="button" 
              onClick={() => {
                setMode('login');
                setError('');
                setSuccess('');
              }} 
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
              {mode === 'login' ? 'Não tem uma conta?' : 'Já possui uma conta?'}
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setError('');
                  setSuccess('');
                  setShowResendButton(false);
                }}
                style={styles.toggleBtn}
                disabled={loading}
              >
                {mode === 'login' ? 'Cadastre-se' : 'Faça Login'}
              </button>
            </p>
          </div>
        )}
      </div>
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
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-light)',
    width: '100%',
    maxWidth: '480px',
    overflow: 'hidden',
    padding: '40px 32px',
  },
  cardHeader: {
    textAlign: 'center',
    marginBottom: '32px',
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
  }
};
