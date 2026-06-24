import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useAppContext } from '../contexts/AppContext';
import { profilesService } from '../services/profilesService';

const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY;

if (MP_PUBLIC_KEY) {
  initMercadoPago(MP_PUBLIC_KEY);
}

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
  if (trimmed === '' || trimmed === 'usuario' || trimmed === 'flowday' || trimmed === 'usuario flowday' || trimmed === 'usuarioflowday' || trimmed === 'null' || trimmed === 'undefined') {
    return false;
  }
  return name.trim().length >= 2;
}

function validateEmail(email) {
  if (!email) return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed === '' || trimmed === 'test_user@test.com' || trimmed === 'null' || trimmed === 'undefined') {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

const MemoizedPayment = React.memo(({ initialization, customization, onSubmit, onError, onReady }) => {
  return (
    <Payment
      initialization={initialization}
      customization={customization}
      onSubmit={onSubmit}
      onError={onError}
      onReady={onReady}
    />
  );
});
MemoizedPayment.displayName = 'MemoizedPayment';

export default function Checkout() {
  const { currentUser, isPro, userProfile } = useAppContext();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [pixData, setPixData] = useState(null);
  const [activeTab, setActiveTab] = useState('card');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [userCpf, setUserCpf] = useState('');

  const firstNameRef = useRef(firstName);
  const lastNameRef = useRef(lastName);
  const emailRef = useRef(email);
  const userCpfRef = useRef(userCpf);

  useEffect(() => { firstNameRef.current = firstName; }, [firstName]);
  useEffect(() => { lastNameRef.current = lastName; }, [lastName]);
  useEffect(() => { emailRef.current = email; }, [email]);
  useEffect(() => { userCpfRef.current = userCpf; }, [userCpf]);

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

  const handleSubmit = useCallback(async (param) => {
    try {
      setError(null);
      setStatus('processando');
      const paymentData = param.formData || param;
      const cleanCpf = userCpfRef.current.replace(/\D/g, '');

      if (!isValidName(firstNameRef.current) || !isValidName(lastNameRef.current) || !validateEmail(emailRef.current)) {
        throw new Error('Por favor, preencha todos os dados de identificação corretamente antes de prosseguir.');
      }
      if (!cleanCpf || cleanCpf.length !== 11 || !validateCpf(cleanCpf)) {
        throw new Error('Por favor, informe um CPF válido.');
      }
      if (!currentUser?.id) {
        throw new Error('Usuário não autenticado.');
      }

      const fullName = `${firstNameRef.current.trim()} ${lastNameRef.current.trim()}`;
      try {
        await profilesService.updateProfile(currentUser?.id, {
          name: fullName,
          nickname: firstNameRef.current.toLowerCase().trim()
        });
      } catch (profileErr) {
        console.warn('Profile sync error ignored for payment checkout:', profileErr.message);
      }

      let installments = paymentData.installments || 1;
      const payload = {
        token: paymentData.token,
        payment_method_id: paymentData.payment_method_id,
        amount: 14.90,
        installments,
        userId: currentUser?.id,
        cpf: cleanCpf,
        // 🛡️ ADICIONADO PARA ANTIFRAUDE: Envia o ID do dispositivo capturado pelo script global
        deviceId: window.MP_DEVICE_SESSION_ID || ""
      };

      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao processar pagamento.');
      }

      const resData = await response.json();
      if (resData.status === 'in_process') {
        setStatus('in_process');
      } else {
        setStatus('success');
      }
    } catch (err) {
      console.error('Card Checkout error:', err);
      setError(err.message);
      setStatus('error');
    }
  }, [currentUser?.id]);

  const handlePixSubmit = async (e) => {
    if (e) e.preventDefault();

    const cleanCpf = userCpf.replace(/\D/g, '');
    if (!firstName.trim() || !lastName.trim() || !validateEmail(email) || cleanCpf.length !== 11) {
      setError('Por favor, preencha e valide todos os dados do pagador.');
      return;
    }

    try {
      setError(null);
      setStatus('processando');

      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      try {
        await profilesService.updateProfile(currentUser?.id, {
          name: fullName,
          nickname: firstName.toLowerCase().trim()
        });
      } catch (profileErr) {
        console.warn('Profile sync error ignored for payment checkout:', profileErr.message);
      }

      const payload = {
        payment_method_id: 'pix',
        amount: 14.90,
        userId: currentUser?.id,
        email: email.trim(),
        cpf: cleanCpf,
        // 🛡️ ADICIONADO PARA ANTIFRAUDE: Envia o ID do dispositivo capturado pelo script global
        deviceId: window.MP_DEVICE_SESSION_ID || ""
      };

      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      console.log("RESPOSTA REAL DA API NO PIX:", resData);

      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao processar pagamento via Pix.');
      }

      if (resData.status === 'pending' || resData.status === 'created') {
        setPixData({
          qr_code: resData.qr_code,
          qr_code_base64: resData.qr_code_base64
        });
        setStatus('pix_pending');
      } else if (resData.status === 'in_process') {
        setStatus('in_process');
      } else if (resData.status === 'rejected' || resData.status === 'cancelled') {
        setError(resData.error || 'O Mercado Pago recusou a geração deste Pix. Use outro CPF ativo para testar.');
        setStatus('error');
      } else {
        setStatus('success');
      }
    } catch (err) {
      console.error('Pix Checkout error:', err);
      setError(err.message);
      setStatus('error');
    }
  };

  const handleError = useCallback((err) => {
    console.error('Mercado Pago Brick Error:', err);
    setError("Não foi possível carregar o formulário de pagamento. Verifique as credenciais.");
    setStatus('error');
  }, []);

  const initialization = useMemo(() => ({
    amount: 14.90,
    payer: { email: currentUser?.email || '' }
  }), [currentUser?.email]);

  const customization = useMemo(() => ({
    paymentMethods: { creditCard: "all", debitCard: "all", bankTransfer: [] },
    visual: {
      style: {
        theme: 'dark',
        customVariables: { baseColor: '#10b981', buttonTextColor: '#ffffff' }
      }
    }
  }), []);

  const handleReady = useCallback(() => { }, []);

  if (!MP_PUBLIC_KEY) {
    return (
      <div style={{ maxWidth: '440px', margin: '60px auto', padding: '30px', backgroundColor: 'rgba(30, 30, 38, 0.95)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)', color: '#ffffff', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <span style={{ fontSize: '48px' }}>⚠️</span>
        <h3 style={{ color: '#ef4444', margin: '16px 0 8px' }}>Erro de Configuração</h3>
        <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5' }}>A chave pública não está configurada no ambiente.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '440px', margin: '60px auto', padding: '30px', backgroundColor: 'rgba(30, 30, 38, 0.95)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)', color: '#ffffff', fontFamily: 'sans-serif' }}>
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

      <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', textAlign: 'center' }}>MyFlowDay Premium ⚡</h2>
      <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', marginBottom: '24px' }}>Acesso completo a todas as ferramentas financeiras, som ambiente e muito mais.</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', marginBottom: '24px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <span style={{ fontSize: '15px', fontWeight: '600' }}>Plano Pro</span>
        <span style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>R$ 14,90 / mês</span>
      </div>

      {(isPro || userProfile?.plano === 'premium') ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ fontSize: '48px' }}>⚡</span>
          <h3 style={{ color: '#10b981', margin: '16px 0 8px' }}>Assinatura Premium Ativa</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5' }}>Você já possui uma assinatura Premium ativa. Aproveite todos os recursos Pro!</p>
          <button onClick={() => window.location.href = '/?app=1'} style={{ marginTop: '20px', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>Ir para o App</button>
        </div>
      ) : status === 'success' ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ fontSize: '48px' }}>🎉</span>
          <h3 style={{ color: '#10b981', margin: '16px 0 8px' }}>Assinatura Ativada!</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5' }}>Seu pagamento foi processado com sucesso. O acesso premium foi liberado na sua conta.</p>
          <button onClick={() => window.location.href = '/?app=1'} style={{ marginTop: '20px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>Ir para o App</button>
        </div>
      ) : status === 'in_process' ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ fontSize: '48px' }}>⏳</span>
          <h3 style={{ color: '#f59e0b', margin: '16px 0 8px' }}>Pagamento em Análise</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5' }}>Seu pagamento está sendo analisado. O acesso será liberado automaticamente.</p>
          <button onClick={() => window.location.href = '/?app=1'} style={{ marginTop: '20px', backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>Ir para o App</button>
        </div>
      ) : pixData ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ fontSize: '48px' }}>⚡</span>
          <h3 style={{ color: '#10b981', margin: '16px 0 8px' }}>Pagamento via Pix Gerado</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5', marginBottom: '20px' }}>Escaneie o QR abaixo para pagar. O acesso Pro é liberado na hora.</p>

          {pixData.qr_code_base64 && (
            <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
              <img src={`data:image/jpeg;base64,${pixData.qr_code_base64}`} alt="QR Code Pix" style={{ width: '200px', height: '200px', display: 'block' }} />
            </div>
          )}

          {pixData.qr_code && (
            <div style={{ marginBottom: '24px' }}>
              <button onClick={() => { navigator.clipboard.writeText(pixData.qr_code); alert('Código Pix copiado!'); }} style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>📋 Copiar Código Pix</button>
            </div>
          )}
          <button onClick={() => window.location.href = '/?app=1'} style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>Ir para o App</button>
        </div>
      ) : (
        <>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginTop: 0, marginBottom: '16px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>👤 Identificação do Pagador</h3>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>Nome</label>
                <div style={{ position: 'relative' }}>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ex: João" style={{ width: '100%', padding: '10px 32px 10px 12px', backgroundColor: '#13131a', border: `1px solid ${firstName ? (isValidName(firstName) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)') : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  {firstName && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: isValidName(firstName) ? '#10b981' : '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>{isValidName(firstName) ? '✓' : '✗'}</span>}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>Sobrenome</label>
                <div style={{ position: 'relative' }}>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ex: Silva" style={{ width: '100%', padding: '10px 32px 10px 12px', backgroundColor: '#13131a', border: `1px solid ${lastName ? (isValidName(lastName) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)') : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  {lastName && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: isValidName(lastName) ? '#10b981' : '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>{isValidName(lastName) ? '✓' : '✗'}</span>}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>E-mail</label>
              <div style={{ position: 'relative' }}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" style={{ width: '100%', padding: '10px 32px 10px 12px', backgroundColor: '#13131a', border: `1px solid ${email ? (validateEmail(email) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)') : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                {email && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: validateEmail(email) ? '#10b981' : '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>{validateEmail(email) ? '✓' : '✗'}</span>}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>CPF (Somente numbers)</label>
              <div style={{ position: 'relative' }}>
                <input type="text" value={userCpf} onChange={(e) => { const val = e.target.value.replace(/\D/g, '').slice(0, 11); setUserCpf(val); }} placeholder="00000000000" style={{ width: '100%', padding: '10px 32px 10px 12px', backgroundColor: '#13131a', border: `1px solid ${userCpf ? (validateCpf(userCpf) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)') : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                {userCpf && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: validateCpf(userCpf) ? '#10b981' : '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>{validateCpf(userCpf) ? '✓' : '✗'}</span>}
              </div>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ opacity: isFormValid ? 1 : 0.15, filter: isFormValid ? 'none' : 'blur(4px)', transition: 'all 0.3s ease' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <button onClick={() => isFormValid && setActiveTab('card')} style={{ flex: 1, padding: '12px 10px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'card' ? '#10b981' : 'transparent', color: '#ffffff', fontSize: '14px', fontWeight: '600', cursor: isFormValid ? 'pointer' : 'not-allowed', transition: 'all 0.2s', boxShadow: activeTab === 'card' ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none' }}>💳 Cartão de Crédito</button>
                <button onClick={() => isFormValid && setActiveTab('pix')} style={{ flex: 1, padding: '12px 10px', borderRadius: '8px', border: 'none', backgroundColor: activeTab === 'pix' ? '#10b981' : 'transparent', color: '#ffffff', fontSize: '14px', fontWeight: '600', cursor: isFormValid ? 'pointer' : 'not-allowed', transition: 'all 0.2s', boxShadow: activeTab === 'pix' ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none' }}>⚡ Pix Instantâneo</button>
              </div>

              {activeTab === 'card' ? (
                <div style={{ minHeight: '150px' }}>
                  {isFormValid ? (
                    <div id="payment-brick-container">
                      <MemoizedPayment initialization={initialization} customization={customization} onSubmit={handleSubmit} onError={handleError} onReady={handleReady} />
                    </div>
                  ) : (
                    <div style={{ backgroundColor: 'rgba(20, 20, 28, 0.75)', border: '1px dashed rgba(255, 255, 255, 0.12)', borderRadius: '12px', padding: '30px 20px', textAlign: 'center' }}>
                      <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>🔒</span>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>Dados do Pagador Necessários</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.5' }}>Preencha os dados de identificação para liberar o cartão.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                  <span style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}>⚡</span>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#ffffff' }}>Pagamento via Pix</h4>
                  <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', lineHeight: '1.5' }}>O Pix é processado instantaneamente e sua assinatura é liberada na hora.</p>
                  <button onClick={handlePixSubmit} disabled={!isFormValid || status === 'processando'} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: isFormValid ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255, 255, 255, 0.08)', color: isFormValid ? '#ffffff' : 'rgba(255, 255, 255, 0.3)', fontWeight: '700', fontSize: '15px', cursor: isFormValid ? 'pointer' : 'not-allowed', transition: 'all 0.2s', boxShadow: isFormValid ? '0 4px 14px rgba(16, 185, 129, 0.3)' : 'none' }}>
                    {status === 'processando' ? 'Gerando Código Pix...' : 'Pagar via Pix ⚡'}
                  </button>
                </div>
              )}
            </div>

            {!isFormValid && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20, 20, 28, 0.82)', backdropFilter: 'blur(6px)', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '24px', zIndex: 10, border: '1px dashed rgba(255, 255, 255, 0.12)' }}>
                <span style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</span>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>Opções de Pagamento Bloqueadas</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.5' }}>Preencha os dados de identificação acima para liberar as formas de pagamento.</p>
              </div>
            )}
          </div>

          {status === 'processando' && (
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>Processando faturamento...</div>
          )}

          {status === 'error' && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>{error}</div>
          )}
        </>
      )}
    </div>
  );
}