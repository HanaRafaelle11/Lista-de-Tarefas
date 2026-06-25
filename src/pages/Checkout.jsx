import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';
import { useAppContext } from '../contexts/AppContext';
import { profilesService } from '../services/profilesService';

const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY;

if (MP_PUBLIC_KEY) {
  initMercadoPago(MP_PUBLIC_KEY);
}

// ─────────────────────────────────────────────
// Funções de validação (mantidas sem alteração)
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

// ─────────────────────────────────────────────
// CardPayment Brick memoizado (PCI Compliance)
// ─────────────────────────────────────────────

const MemoizedCardPayment = React.memo(({ initialization, customization, onSubmit, onError, onReady }) => {
  return (
    <CardPayment
      initialization={initialization}
      customization={customization}
      onSubmit={onSubmit}
      onError={onError}
      onReady={onReady}
    />
  );
});
MemoizedCardPayment.displayName = 'MemoizedCardPayment';

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export default function Checkout() {
  const { currentUser, isPro, userProfile } = useAppContext();

  // Status do fluxo de assinatura
  // null | 'processando' | 'success' | 'pending' | 'error'
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  // Dados da assinatura criada — exibidos na tela de sucesso
  const [subscriptionData, setSubscriptionData] = useState(null);

  // Campos de identificação do pagador
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [userCpf, setUserCpf] = useState('');

  // Refs para captura dentro de callbacks assíncronos
  const firstNameRef = useRef(firstName);
  const lastNameRef = useRef(lastName);
  const emailRef = useRef(email);
  const userCpfRef = useRef(userCpf);

  useEffect(() => { firstNameRef.current = firstName; }, [firstName]);
  useEffect(() => { lastNameRef.current = lastName; }, [lastName]);
  useEffect(() => { emailRef.current = email; }, [email]);
  useEffect(() => { userCpfRef.current = userCpf; }, [userCpf]);

  // Pré-preenchimento de email via usuário logado
  useEffect(() => {
    if (currentUser?.email && !email) {
      setEmail(currentUser.email);
    }
  }, [currentUser?.email, email]);

  // Pré-preenchimento de nome via perfil Supabase
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

  // Validação consolidada do formulário de identificação
  const isFormValid = useMemo(() => {
    const cleanCpf = userCpf.replace(/\D/g, '');
    return (
      isValidName(firstName) &&
      isValidName(lastName) &&
      validateEmail(email) &&
      cleanCpf.length === 11 &&
      validateCpf(cleanCpf)
    );
  }, [firstName, lastName, email, userCpf]);

  // ─────────────────────────────────────────────
  // Handler principal: recebe token do Brick e
  // envia para /api/subscription/create
  // ─────────────────────────────────────────────
  const handleSubmit = useCallback(async (param) => {
    try {
      setError(null);
      setStatus('processando');

      const paymentData = param.formData || param;

      const cleanCpf = userCpfRef.current.replace(/\D/g, '');
      const currentFirstName = firstNameRef.current;
      const currentLastName = lastNameRef.current;
      const currentEmail = emailRef.current;

      // Validações de segurança antes de enviar
      if (!isValidName(currentFirstName) || !isValidName(currentLastName)) {
        throw new Error('Por favor, preencha nome e sobrenome válidos antes de prosseguir.');
      }
      if (!validateEmail(currentEmail)) {
        throw new Error('Por favor, informe um e-mail válido.');
      }
      if (!cleanCpf || cleanCpf.length !== 11 || !validateCpf(cleanCpf)) {
        throw new Error('Por favor, informe um CPF válido.');
      }
      if (!currentUser?.id) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }
      if (!paymentData.token) {
        throw new Error('Token do cartão não gerado. Verifique os dados do cartão.');
      }

      // Sincroniza nome no perfil Supabase
      const fullName = `${currentFirstName.trim()} ${currentLastName.trim()}`;
      try {
        await profilesService.updateProfile(currentUser.id, {
          name: fullName,
          nickname: currentFirstName.toLowerCase().trim()
        });
      } catch (profileErr) {
        console.warn('[Checkout] Profile sync ignorado:', profileErr.message);
      }

      // Payload para o backend de assinatura
      const payload = {
        card_token_id: paymentData.token,
        userId: currentUser.id,
        email: currentEmail.trim(),
        cpf: cleanCpf,
        firstName: currentFirstName.trim(),
        lastName: currentLastName.trim()
      };

      console.log('[Checkout] Enviando para /api/subscription/create:', {
        ...payload,
        card_token_id: payload.card_token_id?.slice(0, 8) + '...',
        cpf: '***.' + cleanCpf.substring(3, 6) + '.' + cleanCpf.substring(6, 9) + '-**'
      });

      const response = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (!response.ok) {
        const errorMsg = resData.error || resData.message || 'Erro ao criar assinatura.';
        throw new Error(errorMsg);
      }

      if (resData.status === 'authorized') {
        setSubscriptionData(resData);
        setStatus('success');
      } else if (resData.status === 'pending') {
        setSubscriptionData(resData);
        setStatus('pending');
      } else {
        throw new Error(resData.error || `Status inesperado: ${resData.status}`);
      }
    } catch (err) {
      console.error('[Checkout] Erro ao criar assinatura:', err);
      setError(err.message);
      setStatus('error');
    }
  }, [currentUser?.id]);

  const handleError = useCallback((err) => {
    console.error('[Checkout] Mercado Pago Brick Error:', err);
    setError('Não foi possível carregar o formulário de pagamento. Verifique as credenciais.');
    setStatus('error');
  }, []);

  // Inicialização do Brick — amount necessário pelo CardPayment
  const initialization = useMemo(() => ({
    amount: 14.90,
    payer: {
      email: currentUser?.email || '',
      entity_type: 'individual'
    }
  }), [currentUser?.email]);

  // Customização do Brick — maxInstallments: 1 pois assinatura não tem parcelamento
  const customization = useMemo(() => ({
    visual: {
      style: {
        theme: 'dark',
        customVariables: { baseColor: '#10b981', buttonTextColor: '#ffffff' }
      }
    },
    paymentMethods: {
      minInstallments: 1,
      maxInstallments: 1
    }
  }), []);

  const handleReady = useCallback(() => { }, []);

  // ─────────────────────────────────────────────
  // Renderização
  // ─────────────────────────────────────────────

  // Guard: chave pública ausente
  if (!MP_PUBLIC_KEY) {
    return (
      <div style={{ maxWidth: '440px', margin: '60px auto', padding: '30px', backgroundColor: 'rgba(30, 30, 38, 0.95)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)', color: '#ffffff', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <span style={{ fontSize: '48px' }}>⚠️</span>
        <h3 style={{ color: '#ef4444', margin: '16px 0 8px' }}>Erro de Configuração</h3>
        <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5' }}>A chave pública do Mercado Pago não está configurada no ambiente.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '440px', margin: '60px auto', padding: '30px', backgroundColor: 'rgba(30, 30, 38, 0.95)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)', color: '#ffffff', fontFamily: 'sans-serif' }}>

      {/* Botão voltar */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => {
            window.history.pushState(null, '', '/?app=1');
            window.dispatchEvent(new Event('popstate'));
          }}
          style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.2s', fontFamily: 'sans-serif' }}
          onMouseEnter={(e) => e.target.style.color = '#ffffff'}
          onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.6)'}
        >
          ← Voltar para o aplicativo
        </button>
      </div>

      {/* Cabeçalho */}
      <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', textAlign: 'center' }}>MyFlowDay Premium ⚡</h2>
      <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', marginBottom: '24px' }}>Acesso completo a todas as ferramentas financeiras, som ambiente e muito mais.</p>

      {/* Resumo do plano */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', marginBottom: '24px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div>
          <span style={{ fontSize: '15px', fontWeight: '600', display: 'block' }}>Plano Pro</span>
          <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)' }}>Assinatura mensal automática</span>
        </div>
        <span style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>R$ 14,90 / mês</span>
      </div>

      {/* ── ESTADO: Já é premium ── */}
      {(isPro || userProfile?.plano === 'premium') ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ fontSize: '48px' }}>⚡</span>
          <h3 style={{ color: '#10b981', margin: '16px 0 8px' }}>Assinatura Premium Ativa</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5' }}>Você já possui uma assinatura Premium ativa. Aproveite todos os recursos Pro!</p>
          <button onClick={() => window.location.href = '/?app=1'} style={{ marginTop: '20px', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>Ir para o App</button>
        </div>

      /* ── ESTADO: Assinatura criada com sucesso ── */
      ) : status === 'success' ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ fontSize: '48px' }}>🎉</span>
          <h3 style={{ color: '#10b981', margin: '16px 0 8px' }}>Assinatura Ativada!</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5', marginBottom: '20px' }}>
            Sua assinatura foi criada com sucesso e o acesso Premium já está liberado.
          </p>

          {/* Detalhes da assinatura */}
          {subscriptionData && (
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>ID da Assinatura</span>
                <span style={{ fontSize: '12px', color: '#10b981', fontFamily: 'monospace' }}>
                  {subscriptionData.mp_subscription_id
                    ? subscriptionData.mp_subscription_id.slice(0, 12) + '...'
                    : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Status</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#10b981' }}>✓ Autorizada</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Próxima cobrança</span>
                <span style={{ fontSize: '12px', color: '#ffffff', fontWeight: '600' }}>
                  {formatDate(subscriptionData.next_payment_date)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Valor mensal</span>
                <span style={{ fontSize: '12px', color: '#ffffff', fontWeight: '600' }}>R$ 14,90</span>
              </div>
            </div>
          )}

          <button onClick={() => window.location.href = '/?app=1'} style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
            Acessar MyFlowDay Premium ⚡
          </button>
        </div>

      /* ── ESTADO: Assinatura pendente ── */
      ) : status === 'pending' ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ fontSize: '48px' }}>⏳</span>
          <h3 style={{ color: '#f59e0b', margin: '16px 0 8px' }}>Assinatura em Análise</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5', marginBottom: '20px' }}>
            Sua assinatura está sendo analisada pelo Mercado Pago. O acesso Premium será liberado automaticamente assim que aprovada.
          </p>
          {subscriptionData?.mp_subscription_id && (
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px', fontFamily: 'monospace' }}>
              Ref: {subscriptionData.mp_subscription_id}
            </p>
          )}
          <button onClick={() => window.location.href = '/?app=1'} style={{ backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
            Voltar ao App
          </button>
        </div>

      /* ── ESTADO: Formulário de assinatura ── */
      ) : (
        <>
          {/* Bloco de identificação do pagador */}
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginTop: 0, marginBottom: '16px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>👤 Identificação do Pagador</h3>

            {/* Nome + Sobrenome */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>Nome</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Ex: João"
                    style={{ width: '100%', padding: '10px 32px 10px 12px', backgroundColor: '#13131a', border: `1px solid ${firstName ? (isValidName(firstName) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)') : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  {firstName && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: isValidName(firstName) ? '#10b981' : '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>{isValidName(firstName) ? '✓' : '✗'}</span>}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>Sobrenome</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Ex: Silva"
                    style={{ width: '100%', padding: '10px 32px 10px 12px', backgroundColor: '#13131a', border: `1px solid ${lastName ? (isValidName(lastName) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)') : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  {lastName && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: isValidName(lastName) ? '#10b981' : '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>{isValidName(lastName) ? '✓' : '✗'}</span>}
                </div>
              </div>
            </div>

            {/* E-mail */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>E-mail</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  style={{ width: '100%', padding: '10px 32px 10px 12px', backgroundColor: '#13131a', border: `1px solid ${email ? (validateEmail(email) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)') : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
                {email && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: validateEmail(email) ? '#10b981' : '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>{validateEmail(email) ? '✓' : '✗'}</span>}
              </div>
            </div>

            {/* CPF */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>CPF (somente números)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={userCpf}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                    setUserCpf(val);
                  }}
                  autoComplete="new-password"
                  placeholder="00000000000"
                  style={{ width: '100%', padding: '10px 32px 10px 12px', backgroundColor: '#13131a', border: `1px solid ${userCpf ? (validateCpf(userCpf) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)') : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
                {userCpf && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: validateCpf(userCpf) ? '#10b981' : '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>{validateCpf(userCpf) ? '✓' : '✗'}</span>}
              </div>
            </div>
          </div>

          {/* Bloco do Brick de cartão com blur-lock */}
          <div style={{ position: 'relative' }}>
            <div style={{ opacity: isFormValid ? 1 : 0.15, filter: isFormValid ? 'none' : 'blur(4px)', transition: 'all 0.3s ease' }}>
              {/* Indicador de assinatura recorrente */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px 14px', backgroundColor: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px' }}>
                <span style={{ fontSize: '16px' }}>🔄</span>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#10b981', display: 'block' }}>Assinatura Recorrente</span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>R$ 14,90 cobrado automaticamente todo mês. Cancele quando quiser.</span>
                </div>
              </div>

              <div id="card-payment-brick-container" style={{ minHeight: '150px' }}>
                {isFormValid ? (
                  <MemoizedCardPayment
                    initialization={initialization}
                    customization={customization}
                    onSubmit={handleSubmit}
                    onError={handleError}
                    onReady={handleReady}
                  />
                ) : (
                  <div style={{ backgroundColor: 'rgba(20, 20, 28, 0.75)', border: '1px dashed rgba(255, 255, 255, 0.12)', borderRadius: '12px', padding: '30px 20px', textAlign: 'center' }}>
                    <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>🔒</span>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>Dados do Pagador Necessários</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.5' }}>Preencha os dados de identificação para liberar o cartão.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Overlay de bloqueio */}
            {!isFormValid && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20, 20, 28, 0.82)', backdropFilter: 'blur(6px)', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '24px', zIndex: 10, border: '1px dashed rgba(255, 255, 255, 0.12)' }}>
                <span style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</span>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>Cartão Bloqueado</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.5' }}>Preencha os dados de identificação acima para liberar o formulário de cartão.</p>
              </div>
            )}
          </div>

          {/* Indicador de processamento */}
          {status === 'processando' && (
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
              ⏳ Criando assinatura...
            </div>
          )}

          {/* Mensagem de erro */}
          {status === 'error' && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {/* Rodapé de segurança */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.3)', margin: 0 }}>
              🔒 Pagamento seguro via Mercado Pago · Seus dados são criptografados
            </p>
          </div>
        </>
      )}
    </div>
  );
}