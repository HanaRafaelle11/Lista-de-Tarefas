import React, { useState, useEffect } from 'react';
import { Settings, User, Moon, Sun, Bell, Shield, Heart } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function SettingsView({ currentUser, onLogout }) {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

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
            O FocusList se adapta à sua preferência. O modo escuro reduz o cansaço visual.
          </p>
        </div>

        {/* Notificações (Desativadas no Beta) */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', opacity: 0.7 }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Bell size={18} /> Notificações
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-main)' }}>Notificações push estão desativadas no momento.</p>
          <p style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>Estamos preparando essa funcionalidade para uma próxima atualização.</p>
        </div>

        {/* PWA & Sistema */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Shield size={18} /> FocusList v1.0
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-light)' }}>
            <p>Plataforma de Progresso Pessoal</p>
            <p>Construído para clareza, evolução e consistência.</p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
              Feito com <Heart size={12} color="#E47070" /> pela comunidade.
            </p>
          </div>

          <button 
            onClick={onLogout} 
            style={{ marginTop: '24px', padding: '12px 24px', backgroundColor: '#FAF0F0', color: '#C06C6C', borderRadius: '8px', fontWeight: '600', display: 'inline-block' }}
          >
            Sair da minha conta
          </button>
        </div>

      </div>
    </div>
  );
}
