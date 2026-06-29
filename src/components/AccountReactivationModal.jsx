import React from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

export default function AccountReactivationModal({ isOpen, deletedAt, onReactivate, onConfirmDeletion }) {
  if (!isOpen) return null;

  const deletedDateObj = deletedAt ? new Date(deletedAt) : new Date();
  const formattedDeletedDate = deletedDateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const expireDateObj = new Date(deletedDateObj.getTime() + 30 * 24 * 60 * 60 * 1000);
  const formattedExpireDate = expireDateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border-light, #334155)',
        borderRadius: '16px',
        padding: '28px',
        maxWidth: '460px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <AlertTriangle size={32} />
        </div>

        <h3 style={{
          margin: '0 0 10px',
          fontSize: '20px',
          fontWeight: '700',
          color: 'var(--text-main, #f8fafc)'
        }}>
          Conta em Período de Exclusão ⏳
        </h3>

        <p style={{
          fontSize: '14px',
          color: 'var(--text-muted, #94a3b8)',
          lineHeight: '1.6',
          margin: '0 0 20px'
        }}>
          Sua conta foi solicitada para exclusão em <strong>{formattedDeletedDate}</strong>. 
          De acordo com nossa política, seus dados serão mantidos e apagados permanentemente em <strong>{formattedExpireDate}</strong>.
        </p>

        <p style={{
          fontSize: '13.5px',
          color: 'var(--text-main, #cbd5e1)',
          fontWeight: '500',
          margin: '0 0 24px'
        }}>
          Deseja reativar sua conta agora para continuar usando o MyFlowDay ou confirmar a saída?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={onReactivate}
            style={{
              width: '100%',
              padding: '12px 20px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              fontSize: '14.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s'
            }}
          >
            <RefreshCw size={18} />
            Reativar Minha Conta 🚀
          </button>

          <button
            onClick={onConfirmDeletion}
            style={{
              width: '100%',
              padding: '12px 20px',
              backgroundColor: 'transparent',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s'
            }}
          >
            <LogOut size={17} />
            Confirmar Exclusão e Sair 🚪
          </button>
        </div>
      </div>
    </div>
  );
}
