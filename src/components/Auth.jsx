import React, { useState } from 'react';
import { Shield, Lock, Mail, User, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { eventsService } from '../services/eventsService';

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isWaitingConfirmation, setIsWaitingConfirmation] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setShowResendButton(false);

    if (!email || !password || (!isLogin && !name)) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
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
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: 'https://myflowday.vercel.app',
            data: {
              name: name
            }
          }
        });

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
          emailRedirectTo: 'https://myflowday.vercel.app'
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
                  setIsLogin(true);
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
        <div style={styles.cardHeader}>
          <div style={styles.logoContainer}>
            <CheckCircle2 size={32} color="var(--primary)" />
            <h1 style={styles.logoText}>Flowday</h1>
          </div>
          <p style={styles.subtitle}>
            {isLogin 
              ? 'Um sistema de evolução pessoal que conecta suas tarefas, hábitos e metas.' 
              : 'Comece hoje sua jornada de consistência e evolução contínua.'}
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.errorMessage}>{error}</div>}
          {success && <div style={styles.successMessage}>{success}</div>}

          {!isLogin && (
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

          <div style={styles.inputGroup}>
            <label style={styles.label}>Senha</label>
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
          </div>

          <button type="submit" className="btn-primary-glow" style={styles.submitBtn} disabled={loading}>
            {loading ? 'Processando...' : isLogin ? 'Acessar Conta' : 'Criar Conta'}
          </button>

          {showResendButton && (
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
        <div style={styles.cardFooter}>
          <p style={styles.footerText}>
            {isLogin ? 'Não tem uma conta?' : 'Já possui uma conta?'}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
                setShowResendButton(false);
              }}
              style={styles.toggleBtn}
              disabled={loading}
            >
              {isLogin ? 'Cadastre-se' : 'Faça Login'}
            </button>
          </p>
          <div style={styles.demoBanner}>
            <Shield size={12} style={{ marginRight: 4 }} />
            <span>Dados criptografados e integrados com segurança.</span>
          </div>
        </div>
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
    maxWidth: '440px',
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
    padding: '12px',
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
