import React, { useState, useEffect } from 'react';
import { 
  Award, Zap, CheckCircle2, AlertTriangle, X, Loader2, 
  Sparkles, ExternalLink 
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

export default function PaywallModal() {
  const { 
    isPaywallOpen, 
    closePaywall, 
    currentUser, 
    userProfile,
    isPro,
    subscriptionStatus,
    churnRisk
  } = useAppContext();

  const [checkoutStatus, setCheckoutStatus] = useState('checkout'); // 'checkout' | 'processing' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  const statusUpper = (subscriptionStatus || '').toUpperCase();
  const isReactivation = statusUpper === 'CANCELED' || churnRisk === 'high';

  // Se o usuário se tornar Pro (via Realtime Supabase), transiciona imediatamente para a tela de Sucesso
  useEffect(() => {
    if (isPaywallOpen && isPro) {
      setCheckoutStatus('success');
    }
  }, [isPro, isPaywallOpen]);

  // Reseta estado ao abrir/fechar
  useEffect(() => {
    if (isPaywallOpen) {
      setCheckoutStatus(isPro ? 'success' : 'checkout');
      setErrorMessage('');
    }
  }, [isPaywallOpen, isPro]);

  if (!isPaywallOpen) return null;

  const handleStartCheckout = async () => {
    if (isPro || userProfile?.plano === 'premium') {
      setCheckoutStatus('success');
      return;
    }

    if (!currentUser?.id || !currentUser?.email) {
      setErrorMessage('Você precisa estar logado para iniciar o checkout.');
      setCheckoutStatus('error');
      return;
    }

    setCheckoutStatus('processing');
    setErrorMessage('');

    try {
      const endpoint = isReactivation ? '/api/billing/reactivate' : '/api/checkout.js';
      console.log(`[Paywall] Chamando API de checkout (${endpoint}) para:`, currentUser.email);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.id,
          email: currentUser.email
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao iniciar checkout.');
      }

      const data = await response.json();
      
      if (data.init_point) {
        console.log('[Paywall] Redirecionando para Mercado Pago:', data.init_point);
        // Redireciona o usuário para a página oficial do Mercado Pago Sandbox/Produção
        window.location.href = data.init_point;
      } else {
        throw new Error('Retorno inválido do servidor de checkout.');
      }
    } catch (err) {
      console.error('[Paywall] Erro no fluxo de checkout:', err);
      setErrorMessage(err.message || 'Não foi possível conectar ao Mercado Pago. Tente novamente mais tarde.');
      setCheckoutStatus('error');
    }
  };

  const renderCheckoutForm = () => {
    const features = [
      { t: "Coach MyFlowDay 🧠", d: "Insights profundos de IA baseados em dados reais, melhores ações recomendadas e análises comportamentais." },
      { t: "Análises Avançadas 📊", d: "Gráficos interativos por categoria, prioridade e consistência no painel de Evolução." },
      { t: "Google Calendar 📅", d: "Sincronização reativa de suas tarefas diretamente com a sua agenda externa do Google." },
      { t: "Exportação de Dados 📁", d: "Exporte seus relatórios estruturados a qualquer momento em PDF, CSV ou imagem PNG." },
      { t: "Histórico Ilimitado ♾️", d: "Elimine a barreira de 30 dias do plano gratuito. Visualize todos os seus dados desde o início." },
      { t: "Foco Sem Limites ⏳", d: "Pomodoro customizável superior a 25 minutos para longas sessões de hiperfoco." }
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'inline-flex', padding: '10px', borderRadius: '50%', backgroundColor: 'rgba(0, 115, 230, 0.15)', color: '#3b82f6', marginBottom: '12px' }}>
            <Award size={36} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#ffffff', margin: '0 0 6px', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>
            MyFlowDay Pro ⚡
          </h2>
          <p style={{ fontSize: '14px', color: '#e5e7eb', margin: 0, maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
            Tenha acesso completo a ferramentas premium de autoconhecimento e acompanhe a sua evolução consciente.
          </p>
        </div>

        {/* Pro features list */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <Zap size={15} style={{ color: '#3b82f6', marginTop: '3px', flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '13.5px', color: '#ffffff', display: 'block', marginBottom: '2px' }}>{f.t}</strong>
                <span style={{ fontSize: '12px', color: '#d1d5db', display: 'block', lineHeight: '1.4' }}>{f.d}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing details and Checkout Action */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isReactivation && (
            <div style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
              border: '1px dashed #10b981', 
              borderRadius: '8px', 
              padding: '12px 16px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              color: '#10b981'
            }}>
              <Sparkles size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '600', lineHeight: '1.4' }}>
                Retome seu progresso Pro com 20% de desconto no primeiro mês (de R$ 14,90 por R$ 11,90)!
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.01)', padding: '16px 20px', borderRadius: '8px', border: '1px solid rgba(0, 115, 230, 0.3)' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {isReactivation ? 'Oferta de Reativação Pro' : 'Plano Mensal Recorrente'}
              </span>
              <strong style={{ display: 'block', fontSize: '15px', color: '#ffffff', marginTop: '2px' }}>Acesso Total Pro ⚡</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              {isReactivation ? (
                <>
                  <span style={{ fontSize: '14px', color: '#9ca3af', textDecoration: 'line-through', marginRight: '6px' }}>R$ 14,90</span>
                  <span style={{ fontSize: '24px', fontWeight: '800', color: '#10b981' }}>R$ 11,90</span>
                  <span style={{ fontSize: '13px', color: '#9ca3af', marginLeft: '2px' }}>/mês</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '24px', fontWeight: '800', color: '#ffffff' }}>R$ 14,90</span>
                  <span style={{ fontSize: '13px', color: '#9ca3af', marginLeft: '2px' }}>/mês</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartCheckout}
            disabled={isPro || userProfile?.plano === 'premium'}
            style={{ 
              width: '100%', 
              padding: '16px', 
              borderRadius: '8px', 
              border: 'none', 
              backgroundColor: (isPro || userProfile?.plano === 'premium')
                ? 'var(--border-medium)'
                : (isReactivation ? '#10b981' : '#3b82f6'), 
              color: (isPro || userProfile?.plano === 'premium') ? 'var(--text-light)' : 'white', 
              fontWeight: '700', 
              fontSize: '15px', 
              cursor: (isPro || userProfile?.plano === 'premium') ? 'not-allowed' : 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '10px', 
              transition: 'all 0.2s', 
              boxShadow: (isPro || userProfile?.plano === 'premium')
                ? 'none'
                : (isReactivation 
                  ? '0 4px 20px rgba(16, 185, 129, 0.25)' 
                  : '0 4px 20px rgba(0, 115, 230, 0.25)')
            }}
          >
            {(isPro || userProfile?.plano === 'premium') 
              ? 'Você já possui uma assinatura Premium ativa' 
              : (isReactivation ? 'Retomar MyFlowDay Pro com Desconto ⚡' : 'Assinar MyFlowDay Pro ⚡')}
            <ExternalLink size={16} />
          </button>

          <span style={{ fontSize: '11.5px', color: '#9ca3af', textAlign: 'center', display: 'block', fontStyle: 'italic' }}>
            Pagamento seguro processado via Mercado Pago. Cancele a qualquer momento.
          </span>
        </div>
      </div>
    );
  };

  const renderProcessing = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 20px', gap: '20px' }}>
        <Loader2 className="animate-spin" size={44} style={{ color: '#3b82f6' }} />
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#ffffff', margin: '0 0 8px' }}>
            Conectando ao Mercado Pago
          </h3>
          <p style={{ fontSize: '13.5px', color: '#d1d5db', margin: 0, maxWidth: '320px', lineHeight: '1.5' }}>
            Criando sua preferência segura de checkout. Você será redirecionado em instantes...
          </p>
        </div>
      </div>
    );
  };

  const renderSuccess = () => {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '30px 10px', gap: '20px' }}>
        <div style={{ 
          display: 'inline-flex', 
          padding: '16px', 
          borderRadius: '50%', 
          backgroundColor: 'rgba(16, 185, 129, 0.1)', 
          color: '#10b981', 
          marginBottom: '8px', 
          boxShadow: '0 0 25px rgba(16, 185, 129, 0.25)',
          animation: 'pulse 2s infinite'
        }}>
          <Sparkles size={52} />
        </div>
        <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#ffffff', margin: 0, fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>
          🎉 Bem-vinda ao MyFlowDay Pro ⚡
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '460px' }}>
          <p style={{ fontSize: '15px', color: '#ffffff', fontWeight: '600', lineHeight: '1.6', margin: 0 }}>
            Seu espaço de produtividade acaba de ganhar uma nova camada de inteligência.
          </p>
          <p style={{ fontSize: '13.5px', color: '#d1d5db', lineHeight: '1.6', margin: 0 }}>
            Agora você pode entender seus padrões de produtividade e acompanhar sua evolução com análises avançadas.
          </p>
        </div>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', width: '100%', marginTop: '12px', paddingTop: '20px' }}>
          <button
            type="button"
            onClick={closePaywall}
            style={{ 
              width: '100%', 
              padding: '14px', 
              borderRadius: '8px', 
              border: 'none', 
              backgroundColor: '#3b82f6', 
              color: 'white', 
              fontWeight: '700', 
              fontSize: '14px', 
              cursor: 'pointer', 
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)' 
            }}
          >
            Explorar Recursos Pro 🚀
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
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', margin: 0, fontFamily: 'var(--font-display)' }}>
          Erro ao Processar Checkout
        </h2>
        
        <p style={{ fontSize: '13.5px', color: '#f3f4f6', lineHeight: '1.6', maxWidth: '420px', margin: 0 }}>
          {errorMessage || 'Não foi possível confirmar seu pagamento. Verifique os dados informados ou tente novamente.'}
        </p>

        <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '12px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <button
            type="button"
            onClick={() => {
              setCheckoutStatus('checkout');
              setErrorMessage('');
            }}
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: '#ffffff', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
          >
            Tentar Novamente
          </button>
          <button
            type="button"
            onClick={closePaywall}
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.25)', backgroundColor: 'transparent', color: '#f3f4f6', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
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
          backgroundColor: '#1e1e26',
          color: '#ffffff',
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
              color: '#f3f4f6', 
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
