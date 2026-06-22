import React, { useState } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useAppContext } from '../contexts/AppContext';

initMercadoPago('APP_USR-0e956167-6396-46c8-be7e-adb93cc9ae11');

export default function Checkout() {
  const { currentUser, isPro, userProfile } = useAppContext();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [pixData, setPixData] = useState(null);

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

      const resData = await response.json();
      if (resData.status === 'pending' && resData.paymentMethod === 'pix') {
        setPixData({
          qr_code: resData.qr_code,
          qr_code_base64: resData.qr_code_base64
        });
        setStatus('pix_pending');
      } else {
        setStatus('success');
      }
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
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => {
            window.history.pushState(null, '', '/?app=1');
            window.dispatchEvent(new Event('popstate'));
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '4px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'color 0.2s',
            fontFamily: 'sans-serif'
          }}
          onMouseEnter={(e) => e.target.style.color = '#ffffff'}
          onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.6)'}
        >
          ← Voltar para o aplicativo
        </button>
      </div>

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
      ) : pixData ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ fontSize: '48px' }}>⚡</span>
          <h3 style={{ color: '#10b981', margin: '16px 0 8px' }}>Pagamento via Pix Gerado</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5', marginBottom: '20px' }}>
            Escaneie o código QR abaixo com o app do seu banco ou copie o código Copia e Cola para pagar. O acesso Pro é liberado imediatamente após o pagamento.
          </p>
          
          {pixData.qr_code_base64 && (
            <div style={{
              backgroundColor: '#ffffff',
              padding: '16px',
              borderRadius: '12px',
              display: 'inline-block',
              marginBottom: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              <img 
                src={`data:image/jpeg;base64,${pixData.qr_code_base64}`} 
                alt="QR Code Pix" 
                style={{ width: '200px', height: '200px', display: 'block' }}
              />
            </div>
          )}

          {pixData.qr_code && (
            <div style={{ marginBottom: '24px' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pixData.qr_code);
                  alert('Código Pix Copia e Cola copiado!');
                }}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'background-color 0.2s'
                }}
              >
                📋 Copiar Código Pix Copia e Cola
              </button>
            </div>
          )}

          <button
            onClick={() => window.location.href = '/?app=1'}
            style={{
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
            Ir para o App (Consultar liberação)
          </button>
        </div>
      ) : (
        <>
          <Payment
            initialization={{
              amount: 14.90,
              payer: {
                email: currentUser?.email || ''
              }
            }}
            customization={{
              paymentMethods: {
                creditCard: "all",
                debitCard: "all",
                bankTransfer: ["pix"]
              },
              visual: {
                style: {
                  theme: 'dark',
                  customVariables: {
                    baseColor: '#10b981',
                    buttonTextColor: '#ffffff'
                  }
                }
              }
            }}
            onSubmit={onSubmit}
            onError={(err) => {
              console.error('Mercado Pago Brick Error:', err);
              setError(
                "Não foi possível carregar o formulário de pagamento. Por favor, verifique se as credenciais de produção do Mercado Pago estão ativadas e homologadas na sua conta."
              );
              setStatus('error');
            }}
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