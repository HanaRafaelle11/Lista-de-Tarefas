import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Award, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  Smartphone, 
  ArrowRight, 
  Zap, 
  Check, 
  Activity, 
  Calendar, 
  Shield, 
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Flame,
  Columns,
  Grid,
  BarChart3,
  Brain,
  AlertTriangle,
  Info,
  CheckCircle2,
  Lock,
  Plus,
  Play,
  MinusCircle,
  XCircle,
  HelpCircle as QuestionIcon
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

export default function LandingPage({ onEnterApp }) {
  const { handleStartDemoMode } = useAppContext();
  const [scrolled, setScrolled] = useState(false);
  
  const heroImages = [
    { src: '/assets/dashboard.png', alt: 'Dashboard do MyFlowDay', fallback: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80', label: 'dashboard' },
    { src: '/assets/agenda.png', alt: 'Agenda Semanal Integrada', fallback: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=1200&q=80', label: 'agenda' },
    { src: '/assets/kanban.png', alt: 'Quadro Kanban de Tarefas', fallback: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=1200&q=80', label: 'kanban' },
    { src: '/assets/pomodoro.png', alt: 'Modo Foco Pomodoro com Som Ambiente', fallback: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80', label: 'foco-pomodoro' },
    { src: '/assets/insights.png', alt: 'Central de Insights Comportamentais', fallback: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80', label: 'insights' },
  ];

  const [heroImageIdx, setHeroImageIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroImageIdx(prev => (prev + 1) % heroImages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);
  
  // Estados para elementos interativos
  const [lostMinutes, setLostMinutes] = useState(30);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const calculatedHoursLost = Math.round((lostMinutes * 365) / 60);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleLinkClick = (e, path) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  const journeySteps = [
    { 
      id: 'dashboard', 
      step: 'Passo 1', 
      title: 'Planeje seu dia', 
      benefit: 'Centralize suas tarefas e compromissos do dia em uma linha do tempo cronológica limpa, integrando tarefas avulsas e eventos da agenda.' 
    },
    { 
      id: 'eisenhower', 
      step: 'Passo 2', 
      title: 'Organize por prioridade', 
      benefit: 'Distribua suas atividades na Matriz de Eisenhower com um clique para entender rapidamente o que gera impacto e o que é distração.' 
    },
    { 
      id: 'pomodoro', 
      step: 'Passo 3', 
      title: 'Entre em foco profundo', 
      benefit: 'Dispare cronômetros Pomodoro com mixagens de sons ambientes de alta fidelidade para se desconectar de ruídos externos.' 
    },
    { 
      id: 'insights', 
      step: 'Passo 4', 
      title: 'Receba Insights de rotina', 
      benefit: 'À medida que você usa o MyFlowDay, o sistema encontra padrões na sua rotina e destaca oportunidades para melhorar sua concentração.' 
    },
    { 
      id: 'gamification', 
      step: 'Passo 5', 
      title: 'Evolua sua rotina', 
      benefit: 'Acompanhe sua consistência diária e evolua seu ritmo sem a pressão ou punições de listas de tarefas tradicionais.' 
    },
  ];

  return (
    <div 
      className="landing-root" 
      style={{ 
        minHeight: '100vh', 
        background: '#0F172A',
        color: '#F8FAFC', 
        fontFamily: 'var(--font-body)',
        overflowX: 'hidden',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* ── HEADER / NAVBAR ────────────────────────────────────────────── */}
      <header
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          background: scrolled ? 'rgba(15, 23, 42, 0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
          transition: 'all 0.3s ease',
          padding: scrolled ? '12px 24px' : '24px 24px',
        }}
      >
        <div 
          className="landing-header-container"
          style={{ 
            maxWidth: '1100px', 
            margin: '0 auto', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/branding/logo.svg"
              alt="MyFlowDay Logo"
              style={{ height: '32px', width: 'auto' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <span 
              className="brand-text-hide-mobile"
              style={{ 
                fontSize: '20px', 
                fontWeight: 800, 
                letterSpacing: '-0.75px', 
                color: '#F8FAFC', 
                fontFamily: 'var(--font-display)' 
              }}
            >
              MyFlowDay
            </span>
          </div>
          
          <div className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <a href="#solucao" className="nav-link" style={{ fontSize: '13.5px', fontWeight: 600, color: '#94A3B8', textDecoration: 'none', transition: 'color 0.2s' }}>Diferencial</a>
            <a href="#como-funciona" className="nav-link" style={{ fontSize: '13.5px', fontWeight: 600, color: '#94A3B8', textDecoration: 'none', transition: 'color 0.2s' }}>Como funciona</a>
            <a href="#comparativo" className="nav-link" style={{ fontSize: '13.5px', fontWeight: 600, color: '#94A3B8', textDecoration: 'none', transition: 'color 0.2s' }}>Comparação</a>
            <a href="#precos" className="nav-link" style={{ fontSize: '13.5px', fontWeight: 600, color: '#94A3B8', textDecoration: 'none', transition: 'color 0.2s' }}>Preços</a>
          </div>

          <div className="landing-nav-buttons" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={onEnterApp} className="nav-btn-secondary" style={{ padding: '8px 16px', borderRadius: '20px', background: 'transparent', color: '#F8FAFC', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', border: '1px solid rgba(255, 255, 255, 0.15)', transition: 'all 0.2s' }}>Faça login</button>
            <button onClick={onEnterApp} className="nav-btn-primary" style={{ padding: '8px 20px', borderRadius: '20px', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', border: 'none', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>Criar Conta</button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════
          1. HERO — Vender a promessa de descobrir como trabalha melhor
          ══════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          minHeight: '95vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '160px 24px 80px',
          background: 'radial-gradient(ellipse 90% 70% at 50% 0%, rgba(37, 99, 235, 0.18) 0%, transparent 60%)',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '980px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 18px', borderRadius: '99px',
              background: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              fontSize: '12px', fontWeight: 750, color: 'var(--secondary)',
              marginBottom: '28px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            <Sparkles size={14} style={{ color: 'var(--secondary)' }} /> Sistema de Evolução e Rotina
          </div>

          <h1
            style={{
              fontSize: 'clamp(36px, 5.8vw, 68px)',
              fontWeight: 900,
              letterSpacing: '-1.8px',
              lineHeight: 1.1,
              color: '#FFFFFF',
              fontFamily: 'var(--font-display)',
              marginBottom: '24px',
            }}
          >
            Organize sua rotina e{' '}
            <span style={{ 
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              descubra como você trabalha melhor.
            </span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(16px, 1.8vw, 20px)',
              color: '#94A3B8',
              maxWidth: '820px',
              lineHeight: 1.55,
              marginBottom: '28px',
              fontWeight: 500
            }}
          >
            O MyFlowDay reúne tarefas, agenda, foco e insights em um único lugar para ajudar você a entender como trabalha melhor.
          </p>

          <div className="landing-hero-benefits">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--secondary)' }} /> Organize todas as suas tarefas
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--secondary)' }} /> Descubra seus melhores horários de foco
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--secondary)' }} /> Evolua sua rotina com dados reais
            </span>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '32px' }}>
            <button
              onClick={onEnterApp}
              style={{
                padding: '16px 36px',
                borderRadius: '30px',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                color: 'white',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
                border: 'none',
                boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 32px rgba(37, 99, 235, 0.5)'; }}
              onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 8px 24px rgba(37, 99, 235, 0.4)'; }}
            >
              Comece Gratuitamente
            </button>
            <button
              onClick={handleStartDemoMode}
              style={{
                padding: '16px 36px',
                borderRadius: '30px',
                background: 'rgba(255,255,255,0.03)',
                color: '#F8FAFC',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
                border: '1.5px solid rgba(255, 255, 255, 0.15)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'; e.target.style.background = 'rgba(255,255,255,0.03)'; e.target.style.transform = 'none'; }}
            >
              Ver Demonstração
            </button>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
            <span>✓ Plano gratuito disponível</span>
            <span>✓ Sem cartão de crédito</span>
            <span>✓ Funciona offline</span>
          </div>


          {/* MOCK DE TELA DO APP NA PRIMEIRA DOBRA - FLUTUANTE 3D */}
          <div 
            className="floating-screenshot"
            style={{
              marginTop: '64px',
              width: '100%',
              maxWidth: '1000px',
              background: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '12px',
              position: 'relative',
            }}
          >
            <div style={{
              background: '#0F172A',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              overflow: 'hidden'
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                padding: '12px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }}></span>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }}></span>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }}></span>
                </div>
                <div style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  padding: '4px 24px', 
                  borderRadius: '6px', 
                  fontSize: '11px', 
                  color: '#94A3B8', 
                  letterSpacing: '0.05em',
                  fontWeight: 600
                }}>
                  myflowday.com.br/app/{heroImages[heroImageIdx].label}
                </div>
                <div style={{ width: '40px' }}></div>
              </div>
              <div style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#0F172A' }}>
                {heroImages.map((img, idx) => (
                  <img
                    key={img.src}
                    src={img.src}
                    alt={img.alt}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      position: idx === 0 ? 'relative' : 'absolute',
                      top: 0,
                      left: 0,
                      opacity: heroImageIdx === idx ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                      zIndex: heroImageIdx === idx ? 2 : 1,
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      e.target.src = img.fallback;
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          2. O PROBLEMA — Por que gerenciadores falham? (SEÇÃO CLARA)
          ══════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: '110px 24px',
          background: '#FFFFFF',
          color: '#0F172A',
          borderTop: '1px solid #E2E8F0',
          borderBottom: '1px solid #E2E8F0',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <span style={{ 
            fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', 
            letterSpacing: '0.12em', color: 'var(--danger)',
            background: 'rgba(239, 68, 68, 0.08)', padding: '6px 14px', borderRadius: '12px'
          }}>
            O problema das listas comuns
          </span>
          <h2 style={{ fontSize: 'clamp(26px, 3.8vw, 38px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-1.2px', marginTop: '16px', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>
            Por que as ferramentas de produtividade comuns falham?
          </h2>
          <p style={{ fontSize: '16px', color: '#475569', lineHeight: '1.6', marginBottom: '48px', maxWidth: '720px', margin: '0 auto 48px' }}>
            Gerenciadores de tarefas tradicionais funcionam apenas como depósitos de cobrança. Eles acumulam pendências sem fim e não ajudam você a entender seu ritmo.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', textAlign: 'left' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '32px' }}>
              <div style={{ color: 'var(--danger)', marginBottom: '16px' }}><AlertTriangle size={24} /></div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '10px' }}>Cobrança Infinita</h3>
              <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                Eles apenas empilham tarefas. Se você não cumpre tudo no prazo, a resposta é frustração, sem levar em conta suas prioridades ou seu cansaço.
              </p>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '32px' }}>
              <div style={{ color: 'var(--danger)', marginBottom: '16px' }}><Clock size={24} /></div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '10px' }}>Sem contexto da sua rotina</h3>
              <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                Ignoram que seu foco varia ao longo do dia. Exigem a mesma atenção e produtividade de forma mecânica e sem aprendizado.
              </p>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '32px' }}>
              <div style={{ color: 'var(--danger)', marginBottom: '16px' }}><Brain size={24} /></div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '10px' }}>Sem aprender com seu comportamento</h3>
              <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                Não mostram o que está funcionando. Você repete hábitos improdutivos porque a ferramenta não rastreia seus horários de maior rendimento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          3. ⭐ A SOLUÇÃO: CENTRAL DE INSIGHTS PREMIUM (SEÇÃO ESCURA)
          ══════════════════════════════════════════════════════════════════ */}
      <section
        id="solucao"
        style={{
          padding: '110px 24px',
          background: 'linear-gradient(180deg, #0F172A 0%, rgba(37, 99, 235, 0.04) 50%, #0F172A 100%)',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{ 
              fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', 
              letterSpacing: '0.15em', color: 'var(--secondary)',
              background: 'rgba(34, 211, 238, 0.08)', padding: '6px 18px', borderRadius: '99px',
              border: '1px solid rgba(34, 211, 238, 0.2)'
            }}>
              <Activity size={12} style={{ display: 'inline', marginRight: '6px' }} /> Central de Insights
            </span>
            <h2 style={{ 
              fontSize: 'clamp(28px, 4.2vw, 46px)', fontWeight: 900, 
              color: '#FFFFFF', letterSpacing: '-1.5px', 
              marginTop: '20px', marginBottom: '16px',
              fontFamily: 'var(--font-display)',
              lineHeight: 1.15
            }}>
              Seu aplicativo observa sua rotina e mostra padrões que você dificilmente perceberia sozinho.
            </h2>
            <p style={{ fontSize: '16.5px', color: '#94A3B8', maxWidth: '820px', margin: '0 auto', lineHeight: '1.6' }}>
              Ao invés de apenas organizar tarefas, o MyFlowDay aprende seus padrões ao longo do tempo e transforma seu histórico em recomendações práticas. A nossa inteligência analisa automaticamente seus horários mais produtivos, riscos de sobrecarga e comportamento durante os ciclos de foco para gerar um relatório inteligente de evolução semanal:
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '24px', fontSize: '13.5px', color: '#CBD5E1', fontWeight: 500 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Clock size={14} style={{ color: 'var(--secondary)' }} /> Melhores horários para foco profundo
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <AlertTriangle size={14} style={{ color: '#FB7185' }} /> Alertas preditivos de sobrecarga
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <TrendingUp size={14} style={{ color: '#34D399' }} /> Evolução real da consistência
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Sparkles size={14} style={{ color: '#FCD34D' }} /> Recomendações semanais personalizadas
              </span>
            </div>
          </div>

          <div className="insights-grid">
            
            {/* Esquerda: Screenshot Real Flutuante */}
            <div 
              className="floating-screenshot"
              style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '10px'
              }}
            >
              <div style={{
                background: '#0F172A',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}>
                <img
                  src="/assets/insights.png"
                  alt="MyFlowDay Central de Insights Screenshot"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                  onError={(e) => {
                    e.target.src = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80";
                  }}
                />
              </div>
            </div>

            {/* Direita: Mockup 100% fiel ao Coach real do App */}
            <div style={{
              background: '#1E293B', 
              border: '1px solid rgba(255, 255, 255, 0.08)', 
              borderRadius: '16px', 
              padding: '32px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)'
            }}>
              {/* Decorative top gradient line */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, var(--primary), #3b82f6)' }} />
              
              {/* Greeting & Subtitle with Coach Pro Active badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(37, 99, 235, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)'
                  }}>
                    <Brain size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Coach MyFlowDay
                    </h3>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                      Seu companheiro rumo à consistência sustentável
                    </span>
                  </div>
                </div>
                
                <div style={{
                  padding: '4px 10px',
                  borderRadius: '99px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#4ADE80',
                  fontSize: '11px',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>⚡</span> Coach Pro Ativo
                </div>
              </div>

              {/* Simulated Coach text box exactly like the app */}
              <div 
                style={{ 
                  fontSize: '14px', 
                  color: '#E2E8F0', 
                  lineHeight: '1.8', 
                  padding: '20px',
                  backgroundColor: '#0F172A',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  marginBottom: '24px',
                  fontFamily: 'inherit',
                }}
              >
                <p style={{ margin: '0 0 16px 0', color: '#94A3B8' }}>
                  Olá! Analisando seu comportamento nos últimos 7 dias, identifiquei padrões muito claros na sua rotina:
                </p>
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '0 0 16px 0' }}>
                  <CheckCircle2 size={16} style={{ color: '#38BDF8', marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#FFFFFF' }}>Consistência Analisada:</strong>
                    <span style={{ color: '#E2E8F0', marginLeft: '6px' }}>
                      Durante esta semana você manteve um excelente nível de consistência. Sua taxa de conclusão permaneceu acima de 85%, especialmente nas manhãs de terça e quarta-feira.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '0 0 16px 0' }}>
                  <Activity size={16} style={{ color: '#22D3EE', marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#FFFFFF' }}>Pico de Foco:</strong>
                    <span style={{ color: '#E2E8F0', marginLeft: '6px' }}>
                      Identifiquei que seu maior período de engajamento mental ocorre entre 9h e 11h da manhã, onde as tarefas são concluídas 30% mais rápido.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '0 0 16px 0' }}>
                  <AlertTriangle size={16} style={{ color: '#FB7185', marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#FFFFFF' }}>Alerta de Sobrecarga:</strong>
                    <span style={{ color: '#E2E8F0', marginLeft: '6px' }}>
                      Observei que sessões de foco contínuo acima de 60 minutos reduziram drasticamente seu rendimento posterior. Na próxima semana vale experimentar ciclos menores para manter a energia.
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '0 0 8px 0' }}>
                  <Sparkles size={16} style={{ color: '#FCD34D', marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#FFFFFF' }}>Sugestão Prática:</strong>
                    <span style={{ color: '#E2E8F0', marginLeft: '6px' }}>
                      Reserve tarefas profundas para terças e quartas pela manhã, e utilize sessões Pomodoro limitadas a 50 minutos para evitar fadiga cognitiva.
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={onEnterApp}
                  style={{
                    width: '100%',
                    padding: '14px 28px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: 'pointer',
                    border: 'none',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 20px rgba(37,99,235,0.35)'; }}
                  onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 4px 12px rgba(37,99,235,0.25)'; }}
                >
                  Desbloquear Analista Pro ⚡
                </button>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          4. JORNADA VISUAL EM 5 PASSOS (SEÇÃO CLARA)
          ══════════════════════════════════════════════════════════════════ */}
      <section
        id="como-funciona"
        style={{
          padding: '110px 24px',
          background: '#F8FAFC',
          color: '#0F172A',
          borderTop: '1px solid #E2E8F0',
          borderBottom: '1px solid #E2E8F0',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>
            Timeline do usuário
          </span>
          <h2 style={{ fontSize: 'clamp(26px, 3.8vw, 38px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-1.5px', marginTop: '8px', marginBottom: '16px' }}>
            Como funciona a evolução da sua rotina
          </h2>
          <p style={{ fontSize: '15px', color: '#475569', marginBottom: '48px', maxWidth: '600px', margin: '0 auto 48px' }}>
            Acompanhe o fluxo contínuo de uso e veja como o sistema entende e apoia seu comportamento:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', marginTop: '48px' }}>
            {journeySteps.map((step, idx) => (
              <div 
                key={step.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '20px',
                  padding: '40px',
                  boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                  textAlign: 'left',
                  transition: 'all 0.3s ease',
                  maxWidth: '850px',
                  margin: '0 auto',
                  width: '100%'
                }}
                className="floating-screenshot-light"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '11px', fontWeight: 900, background: 'var(--primary)', 
                    color: 'white', padding: '6px 14px', borderRadius: '20px',
                    textTransform: 'uppercase', display: 'inline-block'
                  }}>
                    {step.step}
                  </span>
                </div>
                
                <div 
                  style={{
                    background: '#F8FAFC',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid #E2E8F0',
                    padding: '8px',
                  }}
                >
                  <img
                    src={`/assets/${step.id}.png`}
                    alt={step.title}
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: '480px',
                      objectFit: 'contain',
                      display: 'block',
                      borderRadius: '8px'
                    }}
                    onError={(e) => {
                      e.target.src = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80";
                    }}
                  />
                </div>

                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', marginBottom: '8px', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                    {step.benefit}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          5. COMPARATIVO DE BENEFÍCIOS (CARDS COMPARTATIVOS LADO A LADO)
          ══════════════════════════════════════════════════════════════════ */}
      <section
        id="comparativo"
        style={{
          padding: '110px 24px',
          background: '#0F172A',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--secondary)' }}>
            Tabela de benefícios
          </span>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-1.5px', marginTop: '12px', marginBottom: '16px' }}>
            Por que escolher o MyFlowDay?
          </h2>
          <p style={{ fontSize: '15px', color: '#94A3B8', marginBottom: '48px', lineHeight: '1.6' }}>
            Compare o gerenciamento de tarefas tradicional com a nossa abordagem inteligente:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
            
            {/* Card Ferramentas Tradicionais */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px', padding: '40px 32px', display: 'flex', flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#94A3B8', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <XCircle size={20} style={{ color: '#EF4444' }} /> Aplicativos Tradicionais
                </h3>
                <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>Focados em depósitos de tarefas.</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <li style={{ fontSize: '13.5px', color: '#94A3B8', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <MinusCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} /> Organização manual exaustiva de listas
                  </li>
                  <li style={{ fontSize: '13.5px', color: '#94A3B8', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <MinusCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} /> Não identificam picos de foco na sua rotina
                  </li>
                  <li style={{ fontSize: '13.5px', color: '#94A3B8', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <MinusCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} /> Sem insights ou relatórios comportamentais
                  </li>
                  <li style={{ fontSize: '13.5px', color: '#94A3B8', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <MinusCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} /> Exigem múltiplas ferramentas separadas
                  </li>
                </ul>
              </div>
            </div>

            {/* Card MyFlowDay */}
            <div style={{
              background: '#1E293B', border: '2px solid var(--primary)',
              borderRadius: '16px', padding: '40px 32px', display: 'flex', flexDirection: 'column',
              justifyContent: 'space-between', boxShadow: '0 15px 35px rgba(37,99,235,0.15)',
              position: 'relative'
            }}>
              <span style={{ 
                position: 'absolute', top: '-12px', right: '24px', 
                background: 'var(--primary)', color: 'white', 
                fontSize: '11px', fontWeight: 800, padding: '4px 12px', 
                borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                Melhor escolha
              </span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={20} style={{ color: 'var(--secondary)' }} /> MyFlowDay
                </h3>
                <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '24px' }}>Focado em evolução e ritmo saudável.</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <li style={{ fontSize: '13.5px', color: '#E2E8F0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <Check size={16} style={{ color: 'var(--secondary)', flexShrink: 0, marginTop: '2px' }} /> Rotina integrada inteligente e flexível
                  </li>
                  <li style={{ fontSize: '13.5px', color: '#E2E8F0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <Check size={16} style={{ color: 'var(--secondary)', flexShrink: 0, marginTop: '2px' }} /> Identifica seus melhores horários de concentração
                  </li>
                  <li style={{ fontSize: '13.5px', color: '#E2E8F0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <Check size={16} style={{ color: 'var(--secondary)', flexShrink: 0, marginTop: '2px' }} /> Central de Insights de rotina e Assistência de IA
                  </li>
                  <li style={{ fontSize: '13.5px', color: '#E2E8F0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <Check size={16} style={{ color: 'var(--secondary)', flexShrink: 0, marginTop: '2px' }} /> Tudo em um único lugar unificado
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          6. SIMULADOR DE TEMPO RECUPERADO (SEÇÃO CLARA)
          ══════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: '110px 24px',
          background: '#FFFFFF',
          color: '#0F172A',
          borderTop: '1px solid #E2E8F0',
          borderBottom: '1px solid #E2E8F0',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)' }}>
            Simulação
          </span>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-1.5px', marginTop: '12px', marginBottom: '16px' }}>
            Quanto tempo você gostaria de recuperar todos os dias?
          </h2>
          <p style={{ fontSize: '15px', color: '#475569', marginBottom: '32px', lineHeight: '1.6' }}>
            Selecione uma meta diária de recuperação de foco e veja o impacto acumulado anualmente:
          </p>

          <div style={{
            background: '#F8FAFC', border: '1px solid #E2E8F0',
            borderRadius: '16px', padding: '36px', boxShadow: '0 8px 24px rgba(15,23,42,0.02)', marginBottom: '32px'
          }}>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '28px' }}>
              {[15, 30, 45, 60].map(minutes => (
                <button
                  key={minutes}
                  onClick={() => setLostMinutes(minutes)}
                  style={{
                    padding: '12px 28px',
                    borderRadius: '24px',
                    background: lostMinutes === minutes ? 'var(--primary)' : '#FFFFFF',
                    color: lostMinutes === minutes ? 'white' : '#64748B',
                    border: '1px solid #E2E8F0',
                    fontWeight: 750,
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(15,23,42,0.02)',
                    transition: 'all 0.2s'
                  }}
                >
                  {minutes === 60 ? '1 hora' : `${minutes} minutos`}
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '24px' }}>
              <div style={{ fontSize: 'clamp(30px, 4.5vw, 44px)', fontWeight: 900, color: 'var(--primary)', marginBottom: '8px' }}>
                Você pode recuperar {calculatedHoursLost} horas por ano
              </div>
              <p style={{ fontSize: '14.5px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                Isso equivale a cerca de <strong>{Math.round(calculatedHoursLost / 8)} dias úteis</strong> inteiros. O MyFlowDay ajuda você a usar esse tempo livre de forma mais inteligente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          7. PREÇOS — Transparente e destacado (SEÇÃO ESCURA)
          ══════════════════════════════════════════════════════════════════ */}
      <section
        id="precos"
        style={{
          padding: '110px 24px',
          background: '#0F172A',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--secondary)' }}>
            Nossos planos
          </span>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-1.5px', marginTop: '8px', marginBottom: '16px' }}>
            Comece gratuitamente. Upgrade quando quiser.
          </h2>
          <p style={{ fontSize: '15px', color: '#94A3B8', marginBottom: '48px', maxWidth: '600px', margin: '0 auto 48px' }}>
            Escolha a opção ideal para a sua rotina:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', maxWidth: '800px', margin: '0 auto' }}>
            
            {/* Plano Gratuito */}
            <div style={{
              background: '#1E293B', border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px', padding: '40px 32px', textAlign: 'left',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>Plano Gratuito</h3>
                <p style={{ fontSize: '13.5px', color: '#94A3B8', marginBottom: '24px' }}>Ideal para organizar sua rotina.</p>
                
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#FFFFFF', marginBottom: '24px' }}>
                  R$ 0 <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748B' }}>/grátis sempre</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <li style={{ fontSize: '13.5px', color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} style={{ color: '#10B981', flexShrink: 0 }} /> Tarefas e Hábitos ilimitados
                  </li>
                  <li style={{ fontSize: '13.5px', color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} style={{ color: '#10B981', flexShrink: 0 }} /> Quadro Kanban e Matriz Eisenhower
                  </li>
                  <li style={{ fontSize: '13.5px', color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} style={{ color: '#10B981', flexShrink: 0 }} /> Pomodoro com sons ambientes
                  </li>
                  <li style={{ fontSize: '13.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={14} style={{ color: '#64748B', flexShrink: 0 }} /> Central de Insights de rotina
                  </li>
                </ul>
              </div>

              <button onClick={onEnterApp} style={{ width: '100%', padding: '12px 24px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', color: '#FFFFFF', border: '1px solid rgba(255, 255, 255, 0.15)', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', transition: 'all 0.2s' }}>
                Começar Grátis
              </button>
            </div>

            {/* Plano Pro */}
            <div style={{
              background: '#1E293B', border: '2.5px solid var(--primary)',
              borderRadius: '16px', padding: '40px 32px', textAlign: 'left',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              position: 'relative', boxShadow: '0 12px 30px rgba(37,99,235,0.2)'
            }}>
              <span style={{ 
                position: 'absolute', top: '-12px', right: '24px', 
                background: 'var(--primary)', color: 'white', 
                fontSize: '11px', fontWeight: 800, padding: '4px 12px', 
                borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                Recomendado
              </span>

              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>MyFlowDay Pro</h3>
                <p style={{ fontSize: '13.5px', color: '#94A3B8', marginBottom: '16px' }}>Ideal para entender sua produtividade.</p>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px' }}>
                  O gratuito organiza. O Pro ensina você a trabalhar melhor.
                </div>
                
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#FFFFFF', marginBottom: '24px' }}>
                  R$ 14,90 <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748B' }}>/mês</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <li style={{ fontSize: '13.5px', color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} style={{ color: '#10B981', flexShrink: 0 }} /> <strong>Tudo</strong> do plano gratuito
                  </li>
                  <li style={{ fontSize: '13.5px', color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} style={{ color: '#10B981', flexShrink: 0 }} /> <strong>Central de Insights completa</strong>
                  </li>
                  <li style={{ fontSize: '13.5px', color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} style={{ color: '#10B981', flexShrink: 0 }} /> Relatório semanal consolidado
                  </li>
                  <li style={{ fontSize: '13.5px', color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} style={{ color: '#10B981', flexShrink: 0 }} /> Sem fidelidade, cancele quando quiser
                  </li>
                </ul>
              </div>

              <button onClick={onEnterApp} style={{ width: '100%', padding: '12px 24px', borderRadius: '20px', background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 800, fontSize: '13.5px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
                Assinar Pro
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ── FAQ (SEÇÃO CLARA) ────────────────────────────────────────────────────────── */}
      <section
        id="faq"
        style={{
          padding: '110px 24px',
          background: '#F8FAFC',
          color: '#0F172A',
          borderTop: '1px solid #E2E8F0',
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>
              Dúvidas
            </span>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-1.5px', marginTop: '8px' }}>
              Perguntas Frequentes
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              {
                q: 'O MyFlowDay é gratuito?',
                a: 'O MyFlowDay possui um plano gratuito definitivo com recursos essenciais (tarefas, Pomodoro, Kanban, Matriz Eisenhower). Para desbloquear a Central de Insights e análises de rotina, oferecemos o plano Pro por R$ 14,90/mês. Não exigimos cartão de crédito para começar.'
              },
              {
                q: 'Como os Insights funcionam?',
                a: 'À medida que você conclui suas tarefas e roda sessões de foco no app, o sistema analisa os padrões e gera estatísticas. O MyFlowDay identifica os horários em que você esteve mais concentrado e indica quais hábitos impulsionam ou prejudicam seu foco.'
              },
              {
                q: 'Preciso usar todos os dias?',
                a: 'Não. Os insights são consolidados de acordo com o seu histórico real. Quanto mais consistência você mantiver, mais precisos serão os dados semanais, mas você pode usar o app no seu próprio ritmo, sem qualquer punição.'
              },
              {
                q: 'Os dados ficam armazenados com segurança?',
                a: 'Sim. Suas informações de rotina, tarefas e e-mail são protegidas com criptografia de ponta e armazenadas com total conformidade no banco de dados. Nós não vendemos nem compartilhamos seus dados.'
              },
              {
                q: 'Posso exportar minhas tarefas?',
                a: 'Sim, você pode exportar seu histórico de tarefas, relatórios e eventos em formatos comuns de planilhas diretamente através do painel de configurações do usuário.'
              },
              {
                q: 'O plano gratuito possui algum limite?',
                a: 'Não. Você pode criar tarefas, hábitos, quadros Kanban e eventos da agenda de forma ilimitada. A única restrição é a Central de Insights e os resumos semanais de produtividade.'
              },
              {
                q: 'Como cancelar o Pro?',
                a: 'Você pode cancelar sua assinatura do plano Pro a qualquer momento, sem qualquer multa ou período de carência. O cancelamento pode ser feito com um clique no painel de faturamento do seu perfil.'
              }
            ].map((faq, idx) => (
              <div key={idx} style={{
                background: '#FFFFFF', border: '1px solid #E2E8F0',
                borderRadius: '12px', overflow: 'hidden', transition: 'all 0.3s ease'
              }}>
                <button
                  onClick={() => toggleFaq(idx)}
                  style={{
                    width: '100%', padding: '24px', background: 'transparent', border: 'none',
                    textAlign: 'left', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', cursor: 'pointer', color: '#0F172A',
                    fontWeight: 750, fontSize: '15px'
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ transition: 'transform 0.2s', transform: openFaq === idx ? 'rotate(180deg)' : 'none', flexShrink: 0, marginLeft: '12px', color: 'var(--primary)' }}>
                    <ChevronDown size={18} />
                  </span>
                </button>

                {openFaq === idx && (
                  <div style={{
                    padding: '0 24px 24px 24px', fontSize: '14.5px', color: '#475569',
                    lineHeight: '1.6', borderTop: '1px solid #E2E8F0', paddingTop: '16px'
                  }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          8. CTA FINAL — Reforço do autoconhecimento (SEÇÃO ESCURA)
          ══════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: '110px 24px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, var(--primary) 0%, #1D4ED8 50%, var(--secondary) 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.06), transparent 60%)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 44px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: '20px', fontFamily: 'var(--font-display)', lineHeight: 1.15 }}>
            Você já organiza tarefas. <br />
            Agora descubra como realmente trabalha melhor.
          </h2>
          
          <p style={{ fontSize: '17px', opacity: 0.95, marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px', lineHeight: '1.6' }}>
            Substitua a ansiedade gerada pelas listas de afazeres tradicionais por uma rotina sustentável baseada em autoconhecimento.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={onEnterApp}
              style={{
                padding: '18px 42px',
                borderRadius: '30px',
                background: 'white',
                color: 'var(--primary)',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
                border: 'none',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 40px rgba(0,0,0,0.25)'; }}
              onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 8px 32px rgba(0,0,0,0.15)'; }}
            >
              Comece Gratuitamente
            </button>
            <button
              onClick={handleStartDemoMode}
              style={{
                padding: '18px 42px',
                borderRadius: '30px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.2)'; e.target.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.transform = 'none'; }}
            >
              Testar Versão Demo
            </button>
          </div>

          <p style={{ fontSize: '13px', opacity: 0.7, marginTop: '24px' }}>
            Plano gratuito disponível · Sem cartão de crédito · Cancele o Pro quando quiser
          </p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: '60px 24px 48px',
          background: '#0B0F19',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '24px' }}>
            <img src="/branding/logo.svg" alt="MyFlowDay Logo" style={{ height: '28px' }} onError={e => e.target.style.display = 'none'} />
            <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '16.5px' }}>MyFlowDay</span>
          </div>
          
          <p style={{ fontSize: '13.5px', color: '#64748B', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px', lineHeight: '1.6' }}>
            O único aplicativo que organiza sua rotina e revela como você realmente trabalha melhor.
          </p>

          <div style={{ display: 'flex', gap: '28px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '32px' }}>
            <a
              href="/privacidade"
              onClick={(e) => handleLinkClick(e, '/privacidade')}
              style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
            >
              Política de Privacidade
            </a>
            <a
              href="/termos"
              onClick={(e) => handleLinkClick(e, '/termos')}
              style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
            >
              Termos de Serviço
            </a>
            <a
              href="/faq"
              onClick={(e) => handleLinkClick(e, '/faq')}
              style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
            >
              FAQ
            </a>
            <a
              href="mailto:suporte@myflowday.com.br"
              style={{ fontSize: '13px', color: '#64748B', textDecoration: 'none', fontWeight: 500 }}
            >
              suporte@myflowday.com.br
            </a>
          </div>

          <p style={{ fontSize: '12px', color: '#475569' }}>
            © 2026 MyFlowDay. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      <style>{`
        .nav-link:hover {
          color: var(--secondary) !important;
        }
        
        html {
          scroll-behavior: smooth;
        }

        .insight-card-hover:hover {
          background: rgba(30, 41, 59, 0.9) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
          transform: translateY(-2px);
        }

        /* ── SAAS FLOATING SCREENSHOTS ── */
        .floating-screenshot {
          transform: perspective(1000px) rotateX(1.5deg) rotateY(-0.5deg);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease;
          box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08);
        }
        .floating-screenshot:hover {
          transform: perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(-6px);
          box-shadow: 0 25px 50px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.12);
        }

        .floating-screenshot-light {
          transform: perspective(1000px) rotateX(1.5deg) rotateY(-0.5deg);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease;
          box-shadow: 0 15px 35px -5px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04);
        }
        .floating-screenshot-light:hover {
          transform: perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(-6px);
          box-shadow: 0 25px 50px -10px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.08);
        }

        .landing-hero-benefits {
          display: flex;
          gap: 24px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 36px;
          font-size: 14.5px;
          font-weight: 600;
          color: #CBD5E1;
        }

        @media (max-width: 768px) {
          .landing-hero-benefits {
            flex-direction: column;
            align-items: flex-start;
            width: max-content;
            margin: 0 auto 36px !important;
            gap: 12px !important;
          }
        }

        /* ── RESPONSIVIDADE ADICIONAL LAYOUT ── */
        .insights-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 48px;
          align-items: center;
        }

        @media (max-width: 991px) {
          .insights-grid {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .step-details-container {
            grid-template-columns: 1fr !important;
            text-align: center !important;
          }
        }

        @media (max-width: 768px) {
          .landing-header-container {
            height: auto !important;
            padding: 0 !important;
          }
          .landing-nav-links {
            display: none !important;
          }
          .nav-btn-secondary {
            display: inline-block !important;
            padding: 6px 10px !important;
            font-size: 11.5px !important;
            margin-right: 4px !important;
          }
          .nav-btn-primary {
            padding: 6px 12px !important;
            font-size: 11.5px !important;
          }
          .timeline-steps {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .timeline-line {
            display: none !important;
          }
          .timeline-steps button {
            flex-direction: row !important;
            align-items: center !important;
            gap: 16px !important;
            width: 100% !important;
            background: #FFFFFF !important;
            padding: 12px 20px !important;
            border-radius: 12px !important;
            border: 1px solid #E2E8F0 !important;
          }
          .timeline-steps button div {
            margin-bottom: 0 !important;
          }
        }

        @media (max-width: 480px) {
          .brand-text-hide-mobile {
            display: none !important;
          }
        }
      `}
      </style>
    </div>
  );
}
