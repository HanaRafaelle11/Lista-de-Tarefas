import React, { useState } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useAppContext } from '../contexts/AppContext';

initMercadoPago('TEST-335ed727-9096-42ae-948f-fbff929c3571');

export default function Checkout() {
  const { currentUser } = useAppContext();
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

      // Rota que processa o token do Brick
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

  const handleSimulate = async () => {
    try {
      setError(null);
      setStatus('processando');

      const response = await fetch('/api/dev/simulate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: currentUser?.id })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao simular pagamento.');
      }

      setStatus('success');
    } catch (err) {
      console.error('Simulation error:', err);
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

      {status === 'success' ? (
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
          
          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '10px' }}>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }} />
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.3)', textTransform: 'uppercase' }}>ou para testar</span>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }} />
          </div>

          <button
            onClick={handleSimulate}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              color: '#10b981',
              border: '1px dashed rgba(16, 185, 129, 0.4)',
              borderRadius: '8px',
              padding: '12px 24px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'}
          >
            Simular Pagamento Aprovado ⚡
          </button>
          
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