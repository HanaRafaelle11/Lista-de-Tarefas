import React from 'react';
import { Info, AlertTriangle, CheckCircle, HelpCircle, X } from 'lucide-react';

export default function CustomDialogModal({ isOpen, type = 'alert', title, message, onConfirm, onCancel, confirmText = 'OK', cancelText = 'Cancelar' }) {
  if (!isOpen) return null;

  const getIcon = () => {
    if (type === 'confirm' || type === 'warning') {
      return <AlertTriangle size={28} style={{ color: 'var(--accent-yellow, #eab308)' }} />;
    }
    if (type === 'success') {
      return <CheckCircle size={28} style={{ color: '#10b981' }} />;
    }
    if (type === 'error') {
      return <AlertTriangle size={28} style={{ color: 'var(--danger)' }} />;
    }
    return <Info size={28} style={{ color: 'var(--primary)' }} />;
  };

  const getHeaderBg = () => {
    if (type === 'confirm' || type === 'warning') return 'rgba(234, 179, 8, 0.12)';
    if (type === 'success') return 'rgba(16, 185, 129, 0.12)';
    if (type === 'error') return 'rgba(239, 68, 68, 0.12)';
    return 'rgba(99, 102, 241, 0.12)';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg, 16px)',
        padding: '24px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: 'var(--shadow-lg, 0 20px 25px -5px rgba(0, 0, 0, 0.3))',
        position: 'relative',
        animation: 'modalSlideIn 0.2s ease-out'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-sm, 12px)',
            backgroundColor: getHeaderBg(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {getIcon()}
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{
              margin: '0 0 6px',
              fontSize: '17px',
              fontWeight: '700',
              color: 'var(--text-main)'
            }}>
              {title || 'MyFlowDay'}
            </h4>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--text-muted)',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {message}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          {type === 'confirm' && (
            <button
              onClick={onCancel}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--radius-sm, 8px)',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'transparent',
                color: 'var(--text-main)',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-sm, 8px)',
              border: 'none',
              backgroundColor: type === 'error' || type === 'confirm' ? 'var(--danger)' : 'var(--primary)',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
