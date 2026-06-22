import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useAppContext } from '../contexts/AppContext';

initMercadoPago('APP_USR-0e956167-6396-46c8-be7e-adb93cc9ae11');

// Memoized payment component to prevent re-rendering when parent state changes
const MemoizedPayment = React.memo(({ initialization, customization, onSubmit, onError }) => {
  return (
    <Payment
      initialization={initialization}
      customization={customization}
      onSubmit={onSubmit}
      onError={onError}
    />
  );
});
MemoizedPayment.displayName = 'MemoizedPayment';

export default function Checkout() {
  const { currentUser, isPro, userProfile } = useAppContext();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [pixData, setPixData] = useState(null);
  const [userCpf, setUserCpf] = useState('');
  const [showCpfField, setShowCpfField] = useState(false);
  const [pixEmailContainer, setPixEmailContainer] = useState(null);

  // Sync ref to avoid onSubmit dependency invalidation
  const userCpfRef = useRef(userCpf);
  useEffect(() => {
    userCpfRef.current = userCpf;
  }, [userCpf]);

  const handleSubmit = useCallback(async (param) => {
    try {
      setError(null);
      setStatus('processando');
      const paymentData = param.formData || param;
      const cleanCpf = userCpfRef.current.replace(/\D/g, '');
      if (paymentData.payment_method_id === 'pix') {
        if (!cleanCpf) {
          throw new Error('O CPF é obrigatório para prosseguir com o pagamento via Pix.');
        }
        if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
          throw new Error('Por favor, informe um CPF válido.');
        }
      }

      const payload = {
        token: paymentData.token,
        payment_method_id: paymentData.payment_method_id,
        amount: 14.90,
        userId: currentUser?.id,
        payer: {
          ...paymentData.payer,
          ...(paymentData.payment_method_id === 'pix' ? {
            identification: {
              type: 'CPF',
              number: cleanCpf
            }
          } : {})
        }
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
  }, [currentUser?.id]);

  const handleError = useCallback((err) => {
    console.error('Mercado Pago Brick Error:', err);
    setError(
      "Não foi possível carregar o formulário de pagamento. Por favor, verifique se as credenciais de produção do Mercado Pago estão ativadas e homologadas na sua conta."
    );
    setStatus('error');
  }, []);

  const initialization = useMemo(() => ({
    amount: 14.90,
    payer: {
      email: currentUser?.email || '',
    }
  }), [currentUser?.email]);

  const customization = useMemo(() => ({
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
  }), []);

  // MutationObserver to detect payment method changes dynamically
  useEffect(() => {
    const container = document.getElementById('payment-brick-container');
    if (!container) return;

    const handler = () => {
      let isPix = false;

      // Check for checked radio buttons
      const radioSelected = container.querySelector('input[type="radio"]:checked');
      if (radioSelected) {
        const labelText = radioSelected.closest('label')?.innerText || '';
        const value = radioSelected.value || '';
        const id = radioSelected.id || '';
        if (
          labelText.toLowerCase().includes('pix') || 
          value.toLowerCase().includes('pix') || 
          id.toLowerCase().includes('pix')
        ) {
          isPix = true;
        }
      }

      // Check for custom aria-checked radios
      const divSelected = container.querySelector('[role="radio"][aria-checked="true"]');
      if (divSelected) {
        const text = divSelected.innerText || '';
        if (text.toLowerCase().includes('pix')) {
          isPix = true;
        }
      }

      // Check active method selectors
      const activeMethod = container.querySelector('[class*="-selected"], [class*="-active"]');
      if (activeMethod && activeMethod.innerText.toLowerCase().includes('pix')) {
        isPix = true;
      }

      // Fallback: check general checked input elements
      const inputs = container.querySelectorAll('input');
      for (const input of inputs) {
        if (input.checked || input.getAttribute('aria-checked') === 'true') {
          const text = input.closest('label')?.innerText || input.id || input.name || '';
          if (text.toLowerCase().includes('pix')) {
            isPix = true;
            break;
          }
        }
      }

      setShowCpfField(isPix);

      if (isPix) {
        const emailInput = container.querySelector('input[type="email"], input[id*="email"], input[class*="email"]');
        if (emailInput) {
          const target = emailInput.closest('.svelte-form-group') || emailInput.closest('[class*="form-group"]') || emailInput.parentElement;
          if (target) {
            let cpfTarget = container.querySelector('#custom-cpf-portal-container');
            if (!cpfTarget) {
              cpfTarget = document.createElement('div');
              cpfTarget.id = 'custom-cpf-portal-container';
              cpfTarget.style.marginTop = '16px';
              cpfTarget.style.marginBottom = '16px';
              target.parentNode.insertBefore(cpfTarget, target.nextSibling);
            }
            setPixEmailContainer(cpfTarget);
            return;
          }
        }
      }

      // Clean up portal container if not Pix
      const existing = container.querySelector('#custom-cpf-portal-container');
      if (existing) {
        existing.remove();
      }
      setPixEmailContainer(null);
    };

    handler();

    const observer = new MutationObserver(handler);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'checked', 'aria-checked']
    });

    return () => {
      observer.disconnect();
      const existing = container.querySelector('#custom-cpf-portal-container');
      if (existing) {
        existing.remove();
      }
    };
  }, []);

  const renderCpfInput = () => {
    return (
      <div style={{ marginTop: '10px', marginBottom: '10px' }}>
        <label style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: '600',
          color: 'rgba(255, 255, 255, 0.6)',
          marginBottom: '8px',
          fontFamily: 'sans-serif'
        }}>
          CPF do Pagador (Obrigatório para Pix)
        </label>
        <input
          type="text"
          value={userCpf}
          onChange={(e) => setUserCpf(e.target.value)}
          placeholder="000.000.000-00"
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: '#13131a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            fontFamily: 'sans-serif'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#10b981';
            e.target.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.2)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            e.target.style.boxShadow = 'none';
          }}
        />
      </div>
    );
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
          <div id="payment-brick-container">
            <MemoizedPayment
              initialization={initialization}
              customization={customization}
              onSubmit={handleSubmit}
              onError={handleError}
            />
          </div>

          {/* Portal rendering if email field container is found */}
          {pixEmailContainer && createPortal(renderCpfInput(), pixEmailContainer)}

          {/* Fallback rendering inline below brick container if Portal target not ready/found */}
          {showCpfField && !pixEmailContainer && renderCpfInput()}
          
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