import React, { useState } from 'react';
import { Shield, Lock, Mail, User, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password || (!isLogin && !name)) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (isLogin) {
      // Processo de Login no Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setError(error.message || 'E-mail ou senha incorretos.');
      } else if (data?.user) {
        setSuccess('Login realizado com sucesso! Redirecionando...');
        const userObj = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.email.split('@')[0]
        };
        setTimeout(() => {
          onLoginSuccess(userObj);
        }, 1000);
      }
    } else {
      // Processo de Cadastro no Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name
          }
        }
      });

      if (error) {
        setError(error.message || 'Erro ao criar conta.');
      } else if (data?.user) {
        setSuccess('Conta criada com sucesso! Verifique seu e-mail para confirmação (caso ativado) ou faça login.');
        setTimeout(() => {
          setIsLogin(true);
          setPassword('');
          setSuccess('');
        }, 2000);
      }
    }
  };

  return (
    <div style={styles.authContainer} className="animate-fade-in">
      <div style={styles.authCard}>
        {/* Top Header com Gradiente */}
        <div style={styles.cardHeader}>
          <div style={styles.logoContainer}>
            <CheckCircle2 size={32} color="var(--primary)" />
            <h1 style={styles.logoText}>FocusList</h1>
          </div>
          <p style={styles.subtitle}>
            {isLogin ? 'Gerencie seu tempo e suas metas diariamente' : 'Crie sua conta para começar a organizar'}
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
              />
            </div>
          </div>

          <button type="submit" className="btn-primary-glow" style={styles.submitBtn}>
            {isLogin ? 'Acessar Conta' : 'Criar Conta'}
          </button>
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
              }}
              style={styles.toggleBtn}
            >
              {isLogin ? 'Cadastre-se' : 'Faça Login'}
            </button>
          </p>
          <div style={styles.demoBanner}>
            <Shield size={12} style={{ marginRight: 4 }} />
            <span>Demonstração local. Seus dados estão seguros.</span>
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
    borderSelf: 'none',
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
    marginLeft: '6px',
    fontSize: '14px',
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
