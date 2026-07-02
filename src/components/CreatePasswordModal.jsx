import React, { useState } from 'react';
import { Lock, X, KeyRound, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Modal } from '../design-system/ui/Modal';
import { Button } from '../design-system/ui/Button';
import { Input } from '../design-system/ui/Input';
import { Spinner } from '../design-system/ui/Spinner';
import { useAppContext } from '../contexts/AppContext';

/**
 * Modal para criação de senha — exibido para usuários que entraram via
 * Google OAuth ou Link Mágico e ainda não possuem senha definida.
 */
export default function CreatePasswordModal({ onClose, onSuccess }) {
  const { handleUpdateProfileFields, logAuthEvent } = useAppContext();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordStrong = password.length >= 6;
  const canSubmit = passwordsMatch && passwordStrong && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!passwordStrong) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (!passwordsMatch) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ 
        password,
        data: { password_created: true }
      });
      if (error) {
        setError(error.message);
        logAuthEvent('password_creation_failed', '', { error: error.message });
      } else {
        await handleUpdateProfileFields({ has_password: true, dismissed_password_prompt: true });
        logAuthEvent('password_created_successfully', '');
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError('Erro ao criar senha: ' + err.message);
      logAuthEvent('password_creation_failed', '', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    localStorage.setItem('dismissed_password_prompt', 'true');
    await handleUpdateProfileFields({ dismissed_password_prompt: true });
    logAuthEvent('password_creation_dismissed', '');
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      {/* Botão de Fechar */}
      <button 
        onClick={handleSkip} 
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'none',
          border: 'none',
          color: 'var(--text-light)',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Fechar"
      >
        <X size={18} />
      </button>

      {success ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <CheckCircle2 size={32} style={{ color: 'white' }} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
            Senha criada com sucesso!
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Agora você pode entrar com e-mail e senha sempre que quiser.
          </p>
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ 
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <KeyRound size={26} style={{ color: 'white' }} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
              Facilite seus próximos acessos
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Crie uma senha para entrar sem precisar abrir seu e-mail ou usar o Google.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{
                backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5',
                borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', textAlign: 'center'
              }}>{error}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '550', color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>Nova senha</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '14px', color: 'var(--text-light)', display: 'flex', alignItems: 'center' }}><Lock size={18} /></span>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '42px' }}
                  disabled={loading}
                  autoFocus
                  autoComplete="new-password"
                />
              </div>
              {password && (
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
                  <span style={{ fontSize: '11px', fontWeight: 600, color: password.length < 6 ? '#ef4444' : password.length < 10 ? '#f59e0b' : '#22c55e' }}>
                    {password.length < 6 ? 'Fraca' : password.length < 10 ? 'Média' : 'Forte'}
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '550', color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>Confirmar senha</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '14px', color: 'var(--text-light)', display: 'flex', alignItems: 'center' }}><Lock size={18} /></span>
                <Input
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ paddingLeft: '42px', borderColor: confirmPassword && !passwordsMatch ? '#ef4444' : undefined }}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
              {confirmPassword && !passwordsMatch && (
                <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '2px' }}>
                  As senhas não coincidem.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkip}
                style={{ flex: 1, height: '48px' }}
                disabled={loading}
              >
                Pular
              </Button>
              <Button
                type="submit"
                variant="primary"
                style={{ flex: 2, height: '48px' }}
                disabled={!canSubmit}
              >
                {loading ? (
                  <><Spinner /> Salvando...</>
                ) : (
                  'Salvar Senha'
                )}
              </Button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
