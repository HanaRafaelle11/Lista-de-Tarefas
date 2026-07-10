import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import MFIcon from './MFIcon';

export default function AchievementModal({ isOpen, onClose, title, message, icon }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
    } else {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset'; // Restore scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className={`modal-overlay achievement-modal-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div 
        ref={modalRef}
        className="modal-content achievement-modal-content" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="achievement-modal-title" 
        onClick={e => e.stopPropagation()}
      >
        <div className="achievement-modal-header">
          <div className="achievement-modal-icon-wrapper">
            <MFIcon name={icon || 'trophy'} size={40} color="#eab308" />
          </div>
          <h2 id="achievement-modal-title" className="achievement-modal-title">{title}</h2>
          <button onClick={onClose} className="modal-close-btn" aria-label="Fechar modal">
            <X size={20} />
          </button>
        </div>
        <p className="achievement-modal-message">{message}</p>
      </div>

      <style jsx>{`
        .achievement-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          opacity: 0;
          transition: opacity 0.3s ease-out;
        }
        .achievement-modal-overlay.open {
          opacity: 1;
        }

        .achievement-modal-content {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          padding: 30px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          text-align: center;
          transform: translateY(20px);
          opacity: 0;
          transition: transform 0.3s ease-out, opacity 0.3s ease-out;
          border: 1px solid var(--border-medium);
        }
        
        .achievement-modal-overlay.open .achievement-modal-content {
          transform: translateY(0);
          opacity: 1;
        }

        @media (prefers-reduced-motion: reduce) {
          .achievement-modal-overlay,
          .achievement-modal-content {
            transition: none !important;
            transform: none !important;
            opacity: 1 !important; /* Ensure visibility if transitions are off */
          }
        }

        .achievement-modal-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 20px;
          position: relative;
        }

        .achievement-modal-icon-wrapper {
          background: var(--primary-glow);
          border-radius: 50%;
          width: 80px;
          height: 80px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 15px;
          box-shadow: 0 5px 15px rgba(var(--primary-rgb), 0.3);
        }

        .achievement-modal-icon {
          font-size: 48px;
        }

        .achievement-modal-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 10px;
        }

        .achievement-modal-message {
          font-size: 16px;
          color: var(--text-light);
          line-height: 1.6;
        }

        .modal-close-btn {
          position: absolute;
          top: -10px;
          right: -10px;
          background: var(--bg-app);
          border: 1px solid var(--border-medium);
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          color: var(--text-light);
          transition: all 0.2s ease;
        }

        .modal-close-btn:hover {
          background: var(--bg-hover);
          color: var(--text-main);
        }
      `}</style>
    </div>,
    document.body
  );
}
