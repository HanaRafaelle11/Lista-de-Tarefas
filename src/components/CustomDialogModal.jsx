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
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 13000,
    }}>
      <style>{`
        @keyframes customBottomSheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderTop: '1px solid var(--border-light)',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        padding: '24px 24px 36px 24px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        animation: 'customBottomSheetSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        maxHeight: '80vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
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
            {title && (
              <h4 style={{
                margin: '0 0 6px',
                fontSize: '17px',
                fontWeight: '700',
                color: 'var(--text-main)'
              }}>
                {title}
              </h4>
            )}
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

        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          {type === 'confirm' && (
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '12px 18px',
                borderRadius: '12px',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'transparent',
                color: 'var(--text-main)',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center'
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            ref={el => { if (el) el.focus({ preventScroll: true }); }}
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: type === 'error' || type === 'confirm' ? 'var(--danger)' : 'var(--primary)',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
