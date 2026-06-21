import React, { useState, useEffect } from 'react';
import { 
  Award, Zap, CheckCircle2, AlertTriangle, X, Loader2, 
  CreditCard, QrCode, Sparkles, Copy, Check 
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

export default function PaywallModal() {
  const { 
    isPaywallOpen, 
    closePaywall, 
    handleUpgradeSuccess, 
    currentUser, 
    theme 
  } = useAppContext();

  const [activeTab, setActiveTab] = useState('pix'); // 'pix' | 'card' | 'trial'
  const [checkoutStatus, setCheckoutStatus] = useState('checkout'); // 'checkout' | 'processing' | 'success' | 'error'
  const [loadingStep, setLoadingStep] = useState(0);
  const [copiedPix, setCopiedPix] = useState(false);

  // Form Fields for Credit Card
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Reset state on open/close
  useEffect(() => {
    if (isPaywallOpen) {
      setCheckoutStatus('checkout');
      setActiveTab('pix');
      setLoadingStep(0);
      setCopiedPix(false);
      setCardNumber('');
      setCardName('');
      setCardExpiry('');
      setCardCvv('');
    }
  }, [isPaywallOpen]);

  if (!isPaywallOpen) return null;

  const pixKey = "00020101021226870014br.gov.bcb.pix25650021test-checkout-mercado-pago-flowday-pro-1490";

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixKey);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  const runCheckoutSimulation = async (type, forceSuccess = true) => {
    setCheckoutStatus('processing');
    setLoadingStep(0);

    const steps = type === 'pix' 
      ? [
          "Conectando ao Sandbox Mercado Pago (Chave: TEST-335ed727...)...",
          "Aguardando sinalização de webhook `subscription.created`...",
          "Consultando status da assinatura via Billing Engine...",
          "Validando e ativando conta Pro..."
        ]
      : [
          "Criptografando dados do cartão no gateway seguro...",
          "Processando pagamento com Access Token sandbox...",
          "Aguardando resposta do banco emissor...",
          forceSuccess ? "Transação autorizada! Ativando plano Pro..." : "Erro de transação: Pagamento Recusado."
        ];

    for (let i = 0; i < steps.length; i++) {
      setLoadingStep(i);
      // Simula lag de processamento realista do webhook
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    if (forceSuccess) {
      try {
        await handleUpgradeSuccess(type);
        setCheckoutStatus('success');
      } catch (err) {
        console.error(err);
        setCheckoutStatus('error');
      }
    } else {
      setCheckoutStatus('error');
    }
  };

  const handleStartTrial = async () => {
    setCheckoutStatus('processing');
    setLoadingStep(0);
    
    const steps = [
      "Inicializando período de teste de 7 dias...",
      "Registrando trial no Supabase...",
      "Liberando recursos premium..."
    ];

    for (let i = 0; i < steps.length; i++) {
      setLoadingStep(i);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    try {
      await handleUpgradeSuccess('trial');
      setCheckoutStatus('success');
    } catch (err) {
      console.error(err);
      setCheckoutStatus('error');
    }
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
    }
    return v;
  };

  const isCardFormValid = () => {
    return cardNumber.replace(/\s/g, '').length === 16 && 
           cardName.trim().length > 3 && 
           cardExpiry.length === 5 && 
           cardCvv.length === 3;
  };

  // Render sub-components
  const renderCheckoutForm = () => {
    const features = [
      { t: "Coach MyFlowDay 🧠", d: "Insights profundos de IA, melhores ações recomendadas e análise de riscos de estagnação." },
      { t: "Análises Avançadas 📊", d: "Gráficos detalhados por categoria e por nível de prioridade no painel de Evolução." },
      { t: "Google Calendar 📅", d: "Sincronização reativa de tarefas diretamente com sua agenda externa." },
      { t: "Exportação de Dados 📁", d: "Baixe seus registros estruturados em PDF (Relatório), CSV (Dados) ou PNG (Imagem Compartilhável)." },
      { t: "Histórico Ilimitado ♾️", d: "Acesso total à linha de tempo, eliminando o bloqueio de 30 dias do plano gratuito." },
      { t: "Foco Sem Limites ⏳", d: "Pomodoro customizável superior a 25 minutos para longas sessões de concentração." }
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'inline-flex', padding: '10px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', marginBottom: '12px' }}>
            <Award size={36} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>
            Eleve sua evolução com o Pro ⚡
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0, maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
            Tenha acesso ilimitado a ferramentas inteligentes de autoconhecimento e gerencie sua produtividade de forma consciente.
          </p>
        </div>

        {/* Pro features grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--primary)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--text-main)', display: 'block' }}>{f.t}</strong>
                <span style={{ fontSize: '11.5px', color: 'var(--text-light)', display: 'block', lineHeight: '1.4' }}>{f.d}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing & Selector */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-app)', padding: '12px 20px', borderRadius: '8px', border: '1px solid var(--primary-light)', marginBottom: '20px' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Plano MyFlowDay Pro ⚡</span>
              <strong style={{ display: 'block', fontSize: '15px', color: 'var(--text-main)' }}>Assinatura Mensal recorrente</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>R$ 14,90</span>
              <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>/mês</span>
            </div>
          </div>

          {/* Payment Tabs Selection */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', marginBottom: '16px', gap: '8px' }}>
            <button 
              type="button" 
              onClick={() => setActiveTab('pix')} 
              style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: '700', borderBottom: activeTab === 'pix' ? '3px solid var(--primary)' : '3px solid transparent', color: activeTab === 'pix' ? 'var(--primary)' : 'var(--text-muted)', backgroundColor: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}
            >
              <QrCode size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              PIX
            </button>
            <button 
              type="button" 
              onClick={() => setActiveTab('card')} 
              style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: '700', borderBottom: activeTab === 'card' ? '3px solid var(--primary)' : '3px solid transparent', color: activeTab === 'card' ? 'var(--primary)' : 'var(--text-muted)', backgroundColor: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}
            >
              <CreditCard size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              Cartão de Crédito
            </button>
            <button 
              type="button" 
              onClick={() => setActiveTab('trial')} 
              style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: '700', borderBottom: activeTab === 'trial' ? '3px solid var(--primary)' : '3px solid transparent', color: activeTab === 'trial' ? 'var(--primary)' : 'var(--text-muted)', backgroundColor: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}
            >
              <Sparkles size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              7 Dias Grátis
            </button>
          </div>

          {/* Tab Contents */}
          {activeTab === 'pix' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '10px 0' }}>
              <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--border-medium)', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                {/* Mock QR Code in SVG */}
                <svg width="140" height="140" viewBox="0 0 100 100">
                  <path d="M5,5 h35 v35 h-35 z M15,15 h15 v15 h-15 z M5,60 h35 v35 h-35 z M15,70 h15 v15 h-15 z M60,5 h35 v35 h-35 z M70,15 h15 v15 h-15 z" fill="#0f172a" />
                  <path d="M50,10 h5 v5 h-5 z M55,20 h5 v10 h-5 z M45,30 h10 v5 h-10 z M80,50 h10 v5 h-10 z M65,60 h5 v15 h-5 z M75,75 h15 v5 h-15 z M50,85 h15 v5 h-15 z" fill="#0f172a" />
                  <rect x="42" y="42" width="16" height="16" fill="var(--primary)" rx="4" />
                  <circle cx="50" cy="50" r="4" fill="#fff" />
                </svg>
              </div>

              <div style={{ width: '100%' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-light)', display: 'block', marginBottom: '6px', fontWeight: '600' }}>Copia e Cola Pix</span>
                <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
                  <input 
                    type="text" 
                    readOnly 
                    value={pixKey}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  />
                  <button 
                    type="button"
                    onClick={handleCopyPix}
                    style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: copiedPix ? '#10b981' : 'var(--primary-light)', color: copiedPix ? '#fff' : 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', fontWeight: '700' }}
                  >
                    {copiedPix ? <Check size={14} /> : <Copy size={14} />}
                    {copiedPix ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => runCheckoutSimulation('pix')}
                style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', marginTop: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}
              >
                Simular Pagamento no Sandbox (Pix)
              </button>
              <span style={{ fontSize: '11px', color: 'var(--text-light)', fontStyle: 'italic' }}>Simulador integrado com o Sandbox do Mercado Pago</span>
            </div>
          )}

          {activeTab === 'card' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Número do Cartão</label>
                <input 
                  type="text" 
                  placeholder="0000 0000 0000 0000" 
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  maxLength="19"
                  style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Titular do Cartão</label>
                <input 
                  type="text" 
                  placeholder="Nome impresso no cartão" 
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Validade</label>
                  <input 
                    type="text" 
                    placeholder="MM/AA" 
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    maxLength="5"
                    style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>CVV</label>
                  <input 
                    type="password" 
                    placeholder="000" 
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/[^0-9]/g, ''))}
                    maxLength="3"
                    style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  disabled={!isCardFormValid()}
                  onClick={() => runCheckoutSimulation('card', true)}
                  style={{ padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: isCardFormValid() ? '#10b981' : 'var(--border-medium)', color: 'white', fontWeight: '700', fontSize: '13px', cursor: isCardFormValid() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
                >
                  Simular Aprovado
                </button>
                <button
                  type="button"
                  disabled={!isCardFormValid()}
                  onClick={() => runCheckoutSimulation('card', false)}
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', fontWeight: '700', fontSize: '13px', cursor: isCardFormValid() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
                >
                  Simular Recusado
                </button>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-light)', fontStyle: 'italic', textAlign: 'center' }}>Chaves Sandbox de testes ativas no Billing Engine</span>
            </div>
          )}

          {activeTab === 'trial' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                Experimente o MyFlowDay Pro livre por 7 dias. Nenhuma cobrança será realizada agora. Você pode cancelar a qualquer momento nas configurações do seu perfil.
              </p>
              
              <button
                type="button"
                onClick={handleStartTrial}
                style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', marginTop: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}
              >
                Iniciar Teste Grátis de 7 Dias
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProcessing = () => {
    const steps = activeTab === 'pix' 
      ? [
          "Conectando ao Sandbox Mercado Pago...",
          "Aguardando webhook `subscription.created`...",
          "Consultando status da assinatura...",
          "Validando e ativando conta Pro..."
        ]
      : activeTab === 'trial'
      ? [
          "Inicializando período de teste de 7 dias...",
          "Registrando trial no Supabase...",
          "Liberando recursos premium..."
        ]
      : [
          "Criptografando dados do cartão no gateway seguro...",
          "Processando pagamento com Access Token...",
          "Aguardando resposta do banco emissor...",
          "Confirmando assinatura..."
        ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '20px' }}>
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary)' }} />
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 8px' }}>
            Processando Pagamento
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-light)', margin: 0, height: '20px' }}>
            {steps[loadingStep] || "Finalizando..."}
          </p>
        </div>

        {/* Loading progress dots */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {steps.map((_, i) => (
            <div 
              key={i} 
              style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: i <= loadingStep ? 'var(--primary)' : 'var(--border-medium)',
                transition: 'background-color 0.3s' 
              }} 
            />
          ))}
        </div>
      </div>
    );
  };

  const renderSuccess = () => {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '30px 10px', gap: '16px' }}>
        <div style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', marginBottom: '8px', boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)' }}>
          <Sparkles size={48} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', margin: 0, fontFamily: 'var(--font-display)' }}>
          🎉 Bem-vinda ao MyFlowDay Pro ⚡
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '460px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: '600', lineHeight: '1.6', margin: 0 }}>
            Seu espaço de produtividade acaba de ganhar uma nova camada de inteligência.
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
            Agora você pode entender seus padrões de produtividade e acompanhar sua evolução com análises avançadas.
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--border-light)', width: '100%', marginTop: '12px', paddingTop: '20px' }}>
          <button
            type="button"
            onClick={closePaywall}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}
          >
            Explorar Minhas Ferramentas Pro 🚀
          </button>
        </div>
      </div>
    );
  };

  const renderError = () => {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '30px 10px', gap: '16px' }}>
        <div style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', marginBottom: '8px' }}>
          <AlertTriangle size={48} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', margin: 0, fontFamily: 'var(--font-display)' }}>
          Falha no Pagamento
        </h2>
        
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.6', maxWidth: '420px', margin: 0 }}>
          Não foi possível confirmar seu pagamento. Verifique os dados informados ou tente novamente.
        </p>

        <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '12px', paddingTop: '20px', borderTop: '1px solid var(--border-light)' }}>
          <button
            type="button"
            onClick={() => setCheckoutStatus('checkout')}
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
          >
            Tentar Novamente
          </button>
          <button
            type="button"
            onClick={closePaywall}
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: 'transparent', color: 'var(--text-muted)', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={closePaywall} 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        backgroundColor: 'rgba(0,0,0,0.65)', 
        backdropFilter: 'blur(8px)', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        zIndex: 999999,
        padding: '20px'
      }}
    >
      <div 
        className="modal-content premium-glass animate-fade-in"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          padding: '28px',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        {checkoutStatus !== 'processing' && (
          <button 
            type="button" 
            onClick={closePaywall}
            style={{ 
              position: 'absolute', 
              top: '20px', 
              right: '20px', 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-light)', 
              cursor: 'pointer', 
              padding: '6px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            <X size={18} />
          </button>
        )}

        {checkoutStatus === 'checkout' && renderCheckoutForm()}
        {checkoutStatus === 'processing' && renderProcessing()}
        {checkoutStatus === 'success' && renderSuccess()}
        {checkoutStatus === 'error' && renderError()}
      </div>
    </div>
  );
}
