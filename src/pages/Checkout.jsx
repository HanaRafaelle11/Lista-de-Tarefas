import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { profilesService } from '../services/profilesService';
import { PLAN_PREMIUM_MONTHLY_PRICE } from '../../lib/billing/config';

// ─────────────────────────────────────────────
// Funções de validação de formulário
// ─────────────────────────────────────────────

function validateCpf(cpf) {
  if (!cpf) return false;
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(10))) return false;

  return true;
}

function isValidName(name) {
  if (!name) return false;
  const trimmed = name.trim().toLowerCase();
  if (
    trimmed === '' ||
    trimmed === 'usuario' ||
    trimmed === 'flowday' ||
    trimmed === 'usuario flowday' ||
    trimmed === 'usuarioflowday' ||
    trimmed === 'null' ||
    trimmed === 'undefined'
  ) {
    return false;
  }
  return name.trim().length >= 2;
}

function validateEmail(email) {
  if (!email) return false;
  const trimmed = email.trim().toLowerCase();
  if (
    trimmed === '' ||
    trimmed === 'test_user@test.com' ||
    trimmed === 'null' ||
    trimmed === 'undefined'
  ) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export default function Checkout() {
  const { currentUser, isPro, userProfile, checkServerAccess } = useAppContext();

  // ID de sessão único gerado no mount para correlacionar eventos deste checkout
  const sessionIdRef = useRef(Math.random().toString(36).substring(2) + Date.now().toString(36));

  // Aba selecionada: 'pix' | 'card'
  const [paymentMethod, setPaymentMethod] = useState('pix');

  // Status do fluxo
  // null | 'processando' | 'pix_generated' | 'success' | 'error'
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Dados da assinatura/pix gerado
  const [checkoutData, setCheckoutData] = useState(null);

  // Campos de identificação
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [userCpf, setUserCpf] = useState('');

  // Campos de cartão de crédito
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCcv, setCardCcv] = useState('');

  // Logger de observabilidade no frontend
  const logCheckoutEvent = useCallback(async (eventType, statusVal, extra = {}) => {
    if (!currentUser?.id) return;
    try {
      await fetch('/api/payment-events/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          eventType,
          status: statusVal,
          sessionId: sessionIdRef.current,
          referenceId: extra.referenceId || null,
          payload: {
            paymentMethod,
            email: email || currentUser.email,
            ...extra.payload
          },
          errorMessage: extra.errorMessage || null,
          provider: 'asaas'
        })
      });
    } catch (e) {
      console.warn('[Checkout Log Error]', e);
    }
  }, [currentUser?.id, paymentMethod, email]);

  // Sincronização de usuário logado
  useEffect(() => {
    if (currentUser?.email && !email) {
      setEmail(currentUser.email);
    }
  }, [currentUser?.email, email]);

  useEffect(() => {
    if (userProfile && !firstName && !lastName) {
      const fullName = userProfile.name || userProfile.nickname || '';
      if (fullName) {
        const parts = fullName.trim().split(/\s+/);
        const first = parts[0] || '';
        const last = parts.slice(1).join(' ') || '';
        if (isValidName(first)) setFirstName(first);
        if (isValidName(last)) setLastName(last);
      }
    }
  }, [userProfile, firstName, lastName]);

  // Polling automático de confirmação de Pagamento (Pix ou Cartão)
  useEffect(() => {
    let timer = null;
    if ((status === 'pix_generated' || status === 'card_pending') && currentUser?.id) {
      timer = setInterval(async () => {
        try {
          const res = await fetch(`/api/access/check?userId=${currentUser.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.isPro) {
              setStatus('success');
              if (typeof checkServerAccess === 'function') {
                checkServerAccess(currentUser.id);
              }
              logCheckoutEvent('subscription_updated', 'success', {
                payload: { method: status === 'pix_generated' ? 'pix_polling_success' : 'card_polling_success', checkResult: data }
              });
              clearInterval(timer);
            }
          }
        } catch (e) {
          console.warn('[Checkout Polling Error]', e);
        }
      }, 3000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status, currentUser?.id, checkServerAccess, logCheckoutEvent]);

  const handleCopyPix = () => {
    const code = checkoutData?.qrCode || checkoutData?.qr_code;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setStatus('processando');

    try {
      const cleanCpf = userCpf.replace(/\D/g, '');
      if (!isValidName(firstName) || !isValidName(lastName)) {
        throw new Error('Por favor, informe seu nome e sobrenome completos.');
      }
      if (!validateEmail(email)) {
        throw new Error('Por favor, informe um e-mail válido.');
      }
      if (!cleanCpf || cleanCpf.length !== 11 || !validateCpf(cleanCpf)) {
        throw new Error('Por favor, informe um CPF válido.');
      }
      if (!currentUser?.id) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      // Fire-and-forget de sincronização de perfil e log de checkout (não-bloqueante)
      profilesService.updateProfile(currentUser.id, {
        name: `${firstName.trim()} ${lastName.trim()}`,
        nickname: firstName.toLowerCase().trim()
      }).catch(() => {});

      logCheckoutEvent('checkout_started', 'pending', {
        payload: {
          firstName,
          lastName,
          email,
          cpfMasked: `${cleanCpf.substring(0, 3)}.***.***-${cleanCpf.substring(9)}`
        }
      });

      if (paymentMethod === 'pix') {
        const payload = {
          billingType: 'PIX',
          userId: currentUser.id,
          email: email.trim(),
          cpf: cleanCpf,
          firstName: firstName.trim(),
          lastName: lastName.trim()
        };

        const res = await fetch('/api/subscription/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Falha ao gerar cobrança Pix.');
        }

        setCheckoutData(data);
        setStatus('pix_generated');

        // Log: Pix gerado com sucesso (não-bloqueante)
        logCheckoutEvent('checkout_completed', 'success', {
          referenceId: data.paymentId || data.subscriptionId || data.id,
          payload: { asaasResponse: data }
        });
      } else {
        // Cartão de Crédito
        const cleanCard = cardNumber.replace(/\D/g, '');
        const [expMonth, expYear] = cardExpiry.split('/').map(s => s.trim());

        if (cleanCard.length < 13 || !cardHolderName || !expMonth || !expYear || cardCcv.length < 3) {
          throw new Error('Por favor, preencha todos os dados do cartão corretamente.');
        }

        const payload = {
          billingType: 'CREDIT_CARD',
          userId: currentUser.id,
          email: email.trim(),
          cpf: cleanCpf,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          creditCard: {
            holderName: cardHolderName.toUpperCase().trim(),
            number: cleanCard,
            expiryMonth: expMonth.padStart(2, '0'),
            expiryYear: expYear.length === 2 ? `20${expYear}` : expYear,
            ccv: cardCcv.trim()
          },
          creditCardHolderInfo: {
            name: cardHolderName.toUpperCase().trim(),
            email: email.trim(),
            cpfCnpj: cleanCpf
          }
        };

        const res = await fetch('/api/subscription/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Falha ao processar assinatura no cartão.');
        }

        setCheckoutData(data);
        setStatus('card_pending');

        // Log: Assinatura de cartão concluída (não-bloqueante)
        logCheckoutEvent('checkout_completed', 'success', {
          referenceId: data.paymentId || data.subscriptionId || data.id,
          payload: { asaasResponse: data }
        });
      }
    } catch (err) {
      console.error('[Checkout Error]', err);
      setError(err.message);
      setStatus('error');

      // Log: Erro no checkout (não-bloqueante)
      logCheckoutEvent('checkout_error', 'error', {
        errorMessage: err.message
      });
    }
  };

  return (
    <div style={{ maxWidth: '460px', margin: '40px auto', padding: '28px', backgroundColor: 'rgba(24, 24, 32, 0.95)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Voltar */}
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={() => {
            window.history.pushState(null, '', '/?app=1');
            window.dispatchEvent(new Event('popstate'));
          }}
          style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          ← Voltar para o aplicativo
        </button>
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '6px', textAlign: 'center' }}>MyFlowDay Premium ⚡</h2>
      <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', marginBottom: '20px' }}>Libere todas as ferramentas de foco, gestão e áudio sem limites.</p>

      {/* Resumo do plano */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
        <div>
          <span style={{ fontSize: '15px', fontWeight: '700', display: 'block' }}>Assinatura Pro</span>
          <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>Cobrança recorrente mensal</span>
        </div>
        <span style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>R$ {PLAN_PREMIUM_MONTHLY_PRICE.toFixed(2).replace('.', ',')} / mês</span>
      </div>

      {/* ESTADO: Já é Pro */}
      {(isPro || userProfile?.plano === 'premium') ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <span style={{ fontSize: '48px' }}>⚡</span>
          <h3 style={{ color: '#10b981', margin: '16px 0 8px' }}>Sua Assinatura está Ativa!</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5', marginBottom: '20px' }}>Você já é um membro Premium. Todos os recursos Pro estão liberados na sua conta.</p>
          <button onClick={() => window.location.href = '/?app=1'} style={{ width: '100%', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '14px', fontWeight: '700', cursor: 'pointer' }}>Acessar MyFlowDay ⚡</button>
        </div>
      ) : status === 'success' ? (
        /* ESTADO: Sucesso */
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <span style={{ fontSize: '48px' }}>🎉</span>
          <h3 style={{ color: '#10b981', margin: '16px 0 8px' }}>Assinatura Ativada com Sucesso!</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5', marginBottom: '20px' }}>Seu pagamento foi confirmado pelo Asaas e o plano Premium já está pronto para uso.</p>
          <button onClick={() => window.location.href = '/?app=1'} style={{ width: '100%', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '14px', fontWeight: '700', cursor: 'pointer' }}>Entrar no App Pro ⚡</button>
        </div>
      ) : status === 'card_pending' ? (
        /* ESTADO: Cartão Enviado / Pendente webhook */
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <span style={{ fontSize: '48px', display: 'inline-block', animation: 'pulse 1.5s infinite' }}>💳</span>
          <h3 style={{ color: '#f59e0b', margin: '16px 0 8px' }}>Processando seu Pagamento...</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5', marginBottom: '20px' }}>
            Seus dados foram enviados de forma segura para o Asaas. Aguardando a liberação da operadora do cartão...
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '10px', borderRadius: '8px' }}>
            <span className="spinner" style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
            <span>Aguardando liberação em tempo real...</span>
          </div>
        </div>
      ) : status === 'pix_generated' ? (
        /* ESTADO: Pix Gerado */
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#10b981', fontSize: '18px', marginBottom: '12px' }}>Pague com Pix para Ativar ⚡</h3>
          <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '16px' }}>Abra o app do seu banco e escaneie o código abaixo ou use o Pix Copia e Cola.</p>

          {(checkoutData?.qrCodeBase64 || checkoutData?.qr_code_base64) && (
            <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '12px', display: 'inline-block', marginBottom: '16px' }}>
              <img src={checkoutData.qrCodeBase64 || checkoutData.qr_code_base64} alt="QR Code Pix" style={{ width: '180px', height: '180px', display: 'block' }} />
            </div>
          )}

          {(checkoutData?.qrCode || checkoutData?.qr_code) && (
            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                readOnly
                value={checkoutData.qrCode || checkoutData.qr_code}
                style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px', fontFamily: 'monospace', marginBottom: '10px', textAlign: 'center' }}
              />
              <button
                onClick={handleCopyPix}
                style={{ width: '100%', backgroundColor: copied ? '#059669' : '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '12px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}
              >
                {copied ? '✓ Código Copiado!' : '📋 Copiar Código Pix (Copia e Cola)'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '10px', borderRadius: '8px' }}>
            <span className="spinner" style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
            <span>Aguardando confirmação do pagamento em tempo real...</span>
          </div>
        </div>
      ) : (
        /* FORMULÁRIO DE CHECKOUT */
        <form onSubmit={handleSubmit}>
          {/* Seletor de Métodos */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => setPaymentMethod('pix')}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid', borderColor: paymentMethod === 'pix' ? '#10b981' : 'rgba(255, 255, 255, 0.1)', backgroundColor: paymentMethod === 'pix' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)', color: '#ffffff', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <span>❖</span> Pix (Instantâneo)
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid', borderColor: paymentMethod === 'card' ? '#10b981' : 'rgba(255, 255, 255, 0.1)', backgroundColor: paymentMethod === 'card' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)', color: '#ffffff', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <span>💳</span> Cartão de Crédito
            </button>
          </div>

          {error && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Dados do Titular */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>Seu Nome Completo</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" placeholder="Nome" value={firstName} onChange={e => setFirstName(e.target.value)} required style={{ flex: 1, padding: '10px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#ffffff', fontSize: '14px' }} />
              <input type="text" placeholder="Sobrenome" value={lastName} onChange={e => setLastName(e.target.value)} required style={{ flex: 1, padding: '10px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#ffffff', fontSize: '14px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>E-mail</label>
            <input type="email" placeholder="seuemail@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#ffffff', fontSize: '14px' }} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>CPF do Titular</label>
            <input type="text" placeholder="000.000.000-00" value={userCpf} onChange={e => setUserCpf(e.target.value)} required style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#ffffff', fontSize: '14px' }} />
          </div>

          {/* Campos de Cartão de Crédito */}
          {paymentMethod === 'card' && (
            <div style={{ padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', marginBottom: '20px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>Número do Cartão</label>
                <input type="text" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={e => setCardNumber(e.target.value)} required style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', color: '#ffffff', fontSize: '13px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>Nome impresso no cartão</label>
                <input type="text" placeholder="NOME COMO NO CARTAO" value={cardHolderName} onChange={e => setCardHolderName(e.target.value)} required style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', color: '#ffffff', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>Validade (MM/AA)</label>
                  <input type="text" placeholder="12/28" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} required style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', color: '#ffffff', fontSize: '13px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>CVV / CCV</label>
                  <input type="text" placeholder="123" value={cardCcv} onChange={e => setCardCcv(e.target.value)} required style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', color: '#ffffff', fontSize: '13px' }} />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'processando'}
            style={{ width: '100%', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', opacity: status === 'processando' ? 0.7 : 1 }}
          >
            {status === 'processando' ? 'Processando no Asaas...' : paymentMethod === 'pix' ? 'Gerar QR Code Pix ⚡' : 'Assinar com Cartão ⚡'}
          </button>
        </form>
      )}
    </div>
  );
}