import React, { useState, useEffect } from 'react';
import { Settings, User, Moon, Sun, Bell, Shield, Heart, BellOff, BellRing, CheckCircle, Award, MessageSquare, Calendar } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNotifications } from '../hooks/useNotifications';
import { useAppContext } from '../contexts/AppContext';
import { exportAllTasksToCalendar } from '../services/googleCalendarService';

export default function SettingsView() {
  const { theme, setTheme, currentUser, handleLogout, isPro, handleSimulateUpgrade, tasks } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('idle'); // idle, sending, sent, error
  const notifications = useNotifications();

  // MFA States
  const [mfaStatus, setMfaStatus] = useState('loading'); // 'loading', 'unconfigured', 'enrolling', 'verified'
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [mfaSecret, setMfaSecret] = useState(null);
  const [mfaQrCode, setMfaQrCode] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState(null);
  const [mfaSuccess, setMfaSuccess] = useState(null);

  const loadMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      const verifiedTotp = data.totp || [];
      if (verifiedTotp.length > 0) {
        const verifiedFactor = verifiedTotp.find(f => f.status === 'verified');
        if (verifiedFactor) {
          setMfaFactorId(verifiedFactor.id);
          setMfaStatus('verified');
          return;
        }
      }
      setMfaStatus('unconfigured');
    } catch (err) {
      console.error('[MFA] Erro ao listar fatores:', err.message);
      setMfaStatus('unconfigured');
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadMfaStatus();
    }
  }, [currentUser]);

  const handleMfaEnroll = async () => {
    setLoading(true);
    setMfaError(null);
    setMfaSuccess(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `MyFlowDay (${currentUser?.email})`
      });
      if (error) throw error;

      setMfaFactorId(data.id);
      setMfaSecret(data.totp.secret);
      setMfaQrCode(data.totp.qr_code);
      setMfaStatus('enrolling');
    } catch (err) {
      setMfaError('Erro ao iniciar ativação de MFA: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      setMfaError('Por favor, digite o código de 6 dígitos.');
      return;
    }
    setLoading(true);
    setMfaError(null);
    setMfaSuccess(null);
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

      setMfaSuccess('Autenticação em Duas Etapas (MFA) ativada com sucesso!');
      setMfaCode('');
      setMfaSecret(null);
      setMfaQrCode(null);
      setMfaStatus('verified');
      loadMfaStatus();
    } catch (err) {
      setMfaError('Código inválido ou expirado. Tente novamente: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaCancel = async () => {
    setLoading(true);
    setMfaError(null);
    setMfaSuccess(null);
    try {
      if (mfaFactorId) {
        await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      }
      setMfaFactorId(null);
      setMfaSecret(null);
      setMfaQrCode(null);
      setMfaCode('');
      setMfaStatus('unconfigured');
    } catch (err) {
      console.error('[MFA] Erro ao cancelar enrollment:', err.message);
      setMfaStatus('unconfigured');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaDisable = async () => {
    if (!window.confirm('Tem certeza que deseja desativar a Autenticação em Duas Etapas (MFA)? Sua conta ficará menos protegida.')) return;
    setLoading(true);
    setMfaError(null);
    setMfaSuccess(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      if (error) throw error;
      
      setMfaSuccess('MFA desativado com sucesso.');
      setMfaFactorId(null);
      setMfaStatus('unconfigured');
    } catch (err) {
      setMfaError('Erro ao desativar MFA: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(currentUser.email);
      if (error) throw error;
      alert('Email de redefinição de senha enviado!');
    } catch (e) {
      alert('Erro ao enviar email: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Tem certeza que deseja excluir sua conta? Seus dados serão mantidos por 30 dias para recuperação (Soft Delete).')) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          account_status: 'deleted',
          deleted_at: new Date().toISOString()
        }
      });
      if (error) throw error;
      alert('Conta desativada com sucesso. Você será desconectado.');
      handleLogout();
    } catch (e) {
      alert('Erro ao excluir conta: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) {
      alert('Por favor, escreva seu feedback antes de enviar.');
      return;
    }
    setFeedbackStatus('sending');
    try {
      // 1. Tenta inserir no Supabase na tabela 'feedback'
      const { error: dbError } = await supabase
        .from('feedback')
        .insert({
          message: feedbackText.trim(),
          user_id: currentUser?.id || null,
          user_email: currentUser?.email || null,
          created_at: new Date().toISOString(),
        });

      if (dbError) {
        // Tabela pode ainda não existir — fallback para log local
        console.warn('[Feedback] Tabela não encontrada, usando fallback:', dbError.message);
      }

      // 2. Dispara a requisição para a Supabase Edge Function 'send-feedback-email'
      if (supabase.functions && typeof supabase.functions.invoke === 'function') {
        const { error: funcError } = await supabase.functions.invoke('send-feedback-email', {
          body: {
            message: feedbackText.trim(),
            userId: currentUser?.id || null,
            userEmail: currentUser?.email || null,
          }
        });

        if (funcError) {
          console.error('[Feedback] Falha ao despachar email pela Edge Function:', funcError.message);
          throw funcError;
        }
      }

      setFeedbackText('');
      setFeedbackStatus('sent');
      setTimeout(() => setFeedbackStatus('idle'), 4000);
    } catch (err) {
      console.error('[Feedback] Erro ao enviar feedback:', err);
      setFeedbackStatus('error');
      setTimeout(() => setFeedbackStatus('idle'), 4000);
    }
  };

  return (
    <div className="settings-view animate-fade-in" style={{ padding: '24px 0' }}>
      <div className="tasks-page-header" style={{ marginBottom: '32px' }}>
        <h1 className="tasks-page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={24} /> Configurações
        </h1>
        <p className="tasks-page-subtitle">Ajuste suas preferências</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Perfil */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <User size={18} /> Sua Conta
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Nome</span>
              <p style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: '500' }}>{currentUser.name}</p>
            </div>
            <div style={{ marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Email</span>
              <p style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: '500' }}>{currentUser.email}</p>
            </div>
            <button 
              onClick={handlePasswordReset} 
              disabled={loading}
              style={{ alignSelf: 'flex-start', marginTop: '16px', color: 'var(--primary)', fontWeight: '600', fontSize: '14px', padding: '8px 16px', backgroundColor: 'var(--primary-light)', borderRadius: '6px' }}
            >
              Redefinir Senha
            </button>
          </div>
        </div>

        {/* Segurança e Autenticação MFA */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Shield size={18} /> Segurança da Conta
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mfaError && (
              <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', textAlign: 'center' }}>
                {mfaError}
              </div>
            )}
            {mfaSuccess && (
              <div style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', textAlign: 'center' }}>
                {mfaSuccess}
              </div>
            )}

            {mfaStatus === 'loading' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', fontSize: '14px' }}>
                <div className="app-loading-spinner" style={{ width: '16px', height: '16px' }} />
                Carregando status de segurança...
              </div>
            )}

            {mfaStatus === 'unconfigured' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Status de Duas Etapas (MFA)</span>
                  <span style={{ fontSize: '11px', fontWeight: '750', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--prio-alta-bg)', color: 'var(--prio-alta-text)' }}>Desativado</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-light)', lineHeight: '1.5', margin: 0 }}>
                  A autenticação em duas etapas adiciona uma camada extra de segurança para a sua conta do MyFlowDay. Para entrar, além da senha, você precisará fornecer um código temporário de 6 dígitos gerado no celular.
                </p>
                <button
                  onClick={handleMfaEnroll}
                  disabled={loading}
                  style={{ alignSelf: 'flex-start', color: 'white', fontWeight: '600', fontSize: '13px', padding: '8px 16px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Configurar Autenticação em Duas Etapas
                </button>
              </div>
            )}

            {mfaStatus === 'enrolling' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>Scan do Código de Segurança</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-light)', lineHeight: '1.5', margin: 0 }}>
                  Abra seu aplicativo de autenticação (como Google Authenticator ou Authy), escaneie o código QR abaixo e insira o código de 6 dígitos gerado para concluir a ativação.
                </p>
                
                {/* QR Code Container */}
                {mfaQrCode && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '16px', backgroundColor: 'white', borderRadius: '8px', alignSelf: 'center' }}>
                    {mfaQrCode.trim().startsWith('<svg') ? (
                      <div dangerouslySetInnerHTML={{ __html: mfaQrCode }} style={{ width: '180px', height: '180px' }} />
                    ) : (
                      <img src={mfaQrCode} alt="TOTP QR Code" style={{ width: '180px', height: '180px' }} />
                    )}
                  </div>
                )}

                {mfaSecret && (
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Chave Secreta (Configuração Manual)</span>
                    <code style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: '700', letterSpacing: '1px', wordBreak: 'break-all', fontFamily: 'monospace' }}>{mfaSecret}</code>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>Código de 6 dígitos</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', width: '140px', fontSize: '16px', letterSpacing: '2px', textAlign: 'center' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleMfaVerify}
                    disabled={loading || mfaCode.length !== 6}
                    style={{ color: 'white', fontWeight: '600', fontSize: '13px', padding: '8px 16px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: mfaCode.length === 6 ? 1 : 0.6 }}
                  >
                    Confirmar e Ativar
                  </button>
                  <button
                    onClick={handleMfaCancel}
                    disabled={loading}
                    style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '13px', padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-medium)', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {mfaStatus === 'verified' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Status de Duas Etapas (MFA)</span>
                  <span style={{ fontSize: '11px', fontWeight: '750', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>MFA Ativado</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-light)', lineHeight: '1.5', margin: 0 }}>
                  Sua conta está altamente protegida com autenticação em duas etapas TOTP baseada em app autenticador.
                </p>
                <button
                  onClick={handleMfaDisable}
                  disabled={loading}
                  style={{ alignSelf: 'flex-start', color: '#c06c6c', fontWeight: '600', fontSize: '13px', padding: '8px 16px', backgroundColor: '#faf0f0', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Desativar Autenticação em Duas Etapas
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Assinatura SaaS (Simulador Pro) - Bloco 6 */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Award size={18} /> Assinatura Flowday
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '50%', backgroundColor: isPro ? 'var(--primary-light)' : 'var(--border-medium)', color: isPro ? 'var(--primary)' : 'var(--text-light)' }}>
                <Award size={24} />
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>
                  Plano Atual: {isPro ? 'Flowday Pro ⚡' : 'Flowday Grátis'}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                  {isPro 
                    ? 'Você possui acesso ilimitado a todos os recursos de evolução pessoal.'
                    : 'Acesse ferramentas avançadas de produtividade e foco.'}
                </p>
              </div>
            </div>

            <button
              onClick={handleSimulateUpgrade}
              style={{
                alignSelf: 'flex-start',
                marginTop: '8px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isPro ? 'var(--prio-alta-bg)' : 'var(--primary)',
                color: isPro ? 'var(--prio-alta-text)' : 'white',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: isPro ? '1px solid var(--prio-alta-border)' : 'none'
              }}
            >
              {isPro ? 'Voltar para o Plano Grátis (Simulado)' : 'Ativar Flowday Pro ⚡ (Simulado)'}
            </button>
          </div>
        </div>

        {/* Configurações de Produtividade */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Calendar size={18} /> Configurações de Produtividade
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: '500', margin: 0 }}>
              Sincronização do Calendário de Tarefas
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-light)', lineHeight: '1.5', margin: 0 }}>
              Exporte e integre todas as suas tarefas ativas e com data definida em qualquer calendário externo (Google Calendar, Apple Calendar, Outlook) via arquivo iCalendar.
            </p>
            <button
              onClick={() => {
                exportAllTasksToCalendar(tasks);
              }}
              style={{
                alignSelf: 'flex-start',
                marginTop: '8px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary)',
                color: 'white',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Calendar size={14} /> Sincronizar Calendário (.ics)
            </button>
          </div>
        </div>

        {/* Aparência */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Moon size={18} /> Aparência
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { id: 'light', label: 'Claro', icon: <Sun size={16} /> },
              { id: 'dark', label: 'Escuro', icon: <Moon size={16} /> },
              { id: 'system', label: 'Sistema', icon: <Settings size={16} /> }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px',
                  border: `1px solid ${theme === t.id ? 'var(--primary)' : 'var(--border-medium)'}`,
                  backgroundColor: theme === t.id ? 'var(--primary-glow)' : 'var(--bg-app)',
                  color: theme === t.id ? 'var(--primary)' : 'var(--text-main)',
                  fontWeight: theme === t.id ? '600' : '500',
                  transition: 'all 0.2s'
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '12px' }}>
            O Flowday se adapta à sua preferência. O modo escuro reduz o cansaço visual.
          </p>
        </div>

        {/* Notificações */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Bell size={18} /> Notificações do Navegador
          </h2>

          {!notifications.isSupported ? (
            <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>
              Seu navegador não suporta notificações.
            </p>
          ) : notifications.permission === 'denied' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--prio-alta-text)' }}>
                <BellOff size={16} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Notificações bloqueadas</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                Você bloqueou as notificações no navegador. Para reativar, acesse as configurações do seu navegador e permita notificações para este site.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Toggle principal */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>
                    {notifications.isEnabled ? 'Notificações ativas' : 'Notificações desativadas'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                    {notifications.isEnabled
                      ? 'Você receberá lembretes e alertas do Flowday. Funciona com o app aberto (foreground).'
                      : 'Ative para receber lembretes de tarefas e conquistas.'}
                  </p>
                </div>
                {/* Botão toggle */}
                <button
                  id="notifications-toggle-btn"
                  onClick={notifications.isEnabled ? notifications.disableNotifications : notifications.requestPermission}
                  style={{
                    position: 'relative',
                    width: '44px',
                    height: '24px',
                    borderRadius: '99px',
                    backgroundColor: notifications.isEnabled ? 'var(--primary)' : 'var(--border-medium)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.25s',
                    flexShrink: 0,
                  }}
                  aria-label={notifications.isEnabled ? 'Desativar notificações' : 'Ativar notificações'}
                >
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: notifications.isEnabled ? '23px' : '3px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    transition: 'left 0.25s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>

              {/* Status e ações */}
              {notifications.isEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '12px', fontWeight: '600' }}>
                    <CheckCircle size={14} />
                    Permissão concedida pelo navegador
                  </div>
                  <button
                    id="notifications-test-btn"
                    onClick={() => notifications.sendNotification('Flowday 🔔', {
                      body: 'Notificações estão funcionando! Você será avisado sobre suas tarefas.',
                      tag: 'flowday-test',
                    })}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: '600',
                      borderRadius: '6px',
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <BellRing size={13} /> Enviar notificação de teste
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Seção de Feedback */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <MessageSquare size={18} /> Fale com a Gente
          </h2>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Compartilhe suas ideias, problemas ou sugestões para o Flowday..."
            rows="5"
            style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', resize: 'vertical', fontSize: '14px' }}
          />
          <button
            onClick={handleSendFeedback}
            disabled={feedbackStatus === 'sending'}
            style={{
              marginTop: '12px',
              padding: '10px 20px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: feedbackStatus === 'sent' ? '#22c55e' : (feedbackStatus === 'error' ? '#ef4444' : 'var(--primary)'),
              color: 'white',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyContent: 'center'
            }}
          >
            {feedbackStatus === 'sending' && <><span>Enviando...</span></>}
            {feedbackStatus === 'sent' && <><span>✅ Enviado!</span></>}
            {feedbackStatus === 'error' && <><span>❌ Erro!</span></>}
            {feedbackStatus === 'idle' && <><span>Enviar Feedback</span></>}
          </button>
          {feedbackStatus === 'sent' && <p style={{ fontSize: '12px', color: '#22c55e', marginTop: '8px' }}>Obrigado pelo seu feedback!</p>}
          {feedbackStatus === 'error' && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>Não foi possível enviar o feedback. Tente novamente.</p>}
        </div>

        {/* PWA & Sistema */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Shield size={18} /> Flowday v1.0
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-light)' }}>
            <p>Plataforma de Progresso Pessoal</p>
            <p>Construído para clareza, evolução e consistência.</p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
              Desenvolvido por Hana Oliveira.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
            <button 
              onClick={handleLogout} 
              style={{ padding: '12px 24px', backgroundColor: '#FAF0F0', color: '#C06C6C', borderRadius: '8px', fontWeight: '600' }}
            >
              Sair da minha conta
            </button>
            <button 
              onClick={handleDeleteAccount} 
              disabled={loading}
              style={{ padding: '12px 24px', backgroundColor: 'transparent', border: '1px solid #C06C6C', color: '#C06C6C', borderRadius: '8px', fontWeight: '600' }}
            >
              Excluir minha conta
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
