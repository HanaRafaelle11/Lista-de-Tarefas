import React, { useState } from 'react';
import { Settings, User, Moon, Sun, Bell, Shield, Heart, BellOff, BellRing, CheckCircle, Award, MessageSquare } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNotifications } from '../hooks/useNotifications';
import { useAppContext } from '../contexts/AppContext';

export default function SettingsView() {
  const { theme, setTheme, currentUser, handleLogout, isPro, handleSimulateUpgrade } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('idle'); // idle, sending, sent, error
  const notifications = useNotifications();

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
      // Simula chamada de API
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log("Feedback enviado:", feedbackText, "Usuário:", currentUser.email);
      // Em uma aplicação real, enviaria o feedback para um serviço/backend
      setFeedbackText('');
      setFeedbackStatus('sent');
      setTimeout(() => setFeedbackStatus('idle'), 3000); // Reset status
    } catch (error) {
      console.error("Erro ao enviar feedback:", error);
      setFeedbackStatus('error');
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
            <MessageSquare size={18} /> Sugestões, Críticas e Dúvidas
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
