import React, { useState } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useAppContext } from '../contexts/AppContext';

initMercadoPago('APP_USR-0e956167-6396-46c8-be7e-adb93cc9ae11');

export default function Checkout() {
  const { currentUser, isPro, userProfile } = useAppContext();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const onSubmit = async (param) => {
    try {
      setError(null);
      setStatus('processando');
      const paymentData = param.formData || param;
      
      const payload = {
        token: paymentData.token,
        payment_method_id: paymentData.payment_method_id,
        amount: 14.90,
        userId: currentUser?.id,
        payer: paymentData.payer
      };

      // Rota API que processa a criação e o token do Brick do Mercado Pago
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao processar pagamento.');
      }

      setStatus('success');
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message);
      setStatus('error');
    }
  };


  return (
    <div style={{
      maxWidth: '440px',
      margin: '60px auto',
      padding: '30px',
      backgroundColor: 'rgba(30, 30, 38, 0.95)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      color: '#ffffff',
      fontFamily: 'sans-serif'
    }}>
      <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', textAlign: 'center' }}>
        MyFlowDay Premium ⚡
      </h2>
      <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', marginBottom: '24px' }}>
        Acesso completo a todas as ferramentas financeiras, som ambiente e muito mais.
      </p>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '8px',
        marginBottom: '24px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <span style={{ fontSize: '15px', fontWeight: '600' }}>Plano Pro</span>
        <span style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>R$ 14,90 / mês</span>
      </div>

      {(isPro || userProfile?.plano === 'premium') ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ fontSize: '48px' }}>⚡</span>
          <h3 style={{ color: '#10b981', margin: '16px 0 8px' }}>Assinatura Premium Ativa</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5' }}>
            Você já possui uma assinatura Premium ativa. Aproveite todos os recursos Pro!
          </p>
          <button
            onClick={() => window.location.href = '/?app=1'}
            style={{
              marginTop: '20px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Ir para o App
          </button>
        </div>
      ) : status === 'success' ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ fontSize: '48px' }}>🎉</span>
          <h3 style={{ color: '#10b981', margin: '16px 0 8px' }}>Assinatura Ativada!</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5' }}>
            Seu pagamento foi processado com sucesso. O acesso premium foi liberado na sua conta.
          </p>
          <button
            onClick={() => window.location.href = '/?app=1'}
            style={{
              marginTop: '20px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Ir para o App
          </button>
        </div>
      ) : (
        <>
          <Payment
            initialization={{
              amount: 14.90,
              paymentMethods: {
                types: ['card', 'ticket', 'bank_transfer'] // 👈 Define os tipos explicitamente pro Brick rodar
              }
            }}
            onSubmit={onSubmit}
          />

          
          {status === 'processando' && (
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
              Processando faturamento...
            </div>
          )}

          {status === 'error' && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '13px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}