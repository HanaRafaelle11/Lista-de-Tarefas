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
  BarChart2, 
  Calendar, 
  UserCheck, 
  Shield, 
  BookOpen, 
  HelpCircle,
  TrendingDown
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

// ─── Landing Page Pública ─────────────────────────────────────────────────────
export default function LandingPage({ onEnterApp }) {
  const { handleStartDemoMode } = useAppContext();
  const [scrolled, setScrolled] = useState(false);

  const handleLinkClick = (e, path) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div 
      className="landing-root" 
      style={{ 
        minHeight: '100vh', 
        background: 'var(--bg-app)', 
        color: 'var(--text-main)', 
        fontFamily: 'var(--font-body)',
        overflowX: 'hidden'
      }}
    >

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          background: scrolled ? 'rgba(var(--bg-app-rgb, 15, 23, 42), 0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--border-light)' : 'none',
          transition: 'all 0.3s ease',
          padding: '0 24px',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/branding/logo.svg"
              alt="MyFlowDay Logo"
              style={{ height: '36px', width: 'auto' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.75px', color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>
              MyFlowDay
            </span>
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <a
              href="#por-que-myflowday"
              style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = 'var(--primary)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
            >
              Filosofia
            </a>
            <a
              href="#beneficios"
              style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = 'var(--primary)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
            >
              Recursos
            </a>
            <a
              href="#insights"
              style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = 'var(--primary)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
            >
              Insights
            </a>
            <button
              id="landing-enter-btn"
              onClick={onEnterApp}
              style={{
                padding: '10px 24px',
                borderRadius: '24px',
                background: 'var(--primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              }}
              onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.45)'; }}
              onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.35)'; }}
            >
              Entrar no App
            </button>
          </nav>
        </div>
      </header>

      {/* ── SECTION 1: Hero Section ────────────────────────────────────────── */}
      <section
        style={{
          minHeight: '95vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '140px 24px 80px',
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(37, 99, 235, 0.15) 0%, transparent 70%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', top: '10%', left: '5%', width: '300px', height: '300px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(37, 99, 235, 0.1), transparent)',
          filter: 'blur(50px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', right: '5%', width: '250px', height: '250px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(34, 211, 238, 0.08), transparent)',
          filter: 'blur(50px)', pointerEvents: 'none',
        }} />

        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 20px', borderRadius: '99px',
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            fontSize: '13px', fontWeight: 700, color: 'var(--primary)',
            marginBottom: '28px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            animation: 'fadeSlideIn 0.6s ease both',
          }}
        >
          ✨ Produtividade Sustentável e Foco Saudável
        </div>

        <h1
          style={{
            fontSize: 'clamp(36px, 6.5vw, 72px)',
            fontWeight: 900,
            letterSpacing: '-2.5px',
            lineHeight: 1.05,
            color: 'var(--text-main)',
            fontFamily: 'var(--font-display)',
            maxWidth: '900px',
            marginBottom: '24px',
            animation: 'fadeSlideIn 0.7s 0.1s ease both',
          }}
        >
          Sua mente não é um depósito de tarefas.{' '}
          <span style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            É um processador.
          </span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(16px, 2.2vw, 21px)',
            color: 'var(--text-muted)',
            maxWidth: '680px',
            lineHeight: 1.6,
            marginBottom: '40px',
            animation: 'fadeSlideIn 0.7s 0.2s ease both',
          }}
        >
          Esqueça as listas infinitas que só geram culpa. O MyFlowDay monitora seu ritmo de foco, fortalece sua consistência diária e oferece insights biológicos para você construir uma rotina sustentável.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeSlideIn 0.7s 0.3s ease both' }}>
          <button
            id="landing-hero-cta"
            onClick={onEnterApp}
            style={{
              padding: '16px 38px',
              borderRadius: '30px',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              color: 'white',
              fontWeight: 800,
              fontSize: '16px',
              cursor: 'pointer',
              border: 'none',
              boxShadow: '0 8px 28px rgba(37, 99, 235, 0.4)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 36px rgba(37, 99, 235, 0.5)'; }}
            onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 8px 28px rgba(37, 99, 235, 0.4)'; }}
          >
            Começar Gratuitamente ⚡
          </button>
          <button
            onClick={handleStartDemoMode}
            style={{
              padding: '16px 38px',
              borderRadius: '30px',
              background: 'transparent',
              color: 'var(--text-main)',
              fontWeight: 700,
              fontSize: '16px',
              cursor: 'pointer',
              border: '2px solid var(--border-medium)',
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.color = 'var(--primary)'; }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.color = 'var(--text-main)'; }}
          >
            🎮 Testar sem Conta
          </button>
          <a
            href="#por-que-myflowday"
            style={{
              padding: '16px 38px',
              borderRadius: '30px',
              background: 'transparent',
              color: 'var(--text-main)',
              fontWeight: 700,
              fontSize: '16px',
              cursor: 'pointer',
              border: '2px solid var(--border-medium)',
              transition: 'all 0.2s',
              textDecoration: 'none',
              display: 'inline-flex', 
              alignItems: 'center',
            }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.color = 'var(--primary)'; }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.color = 'var(--text-main)'; }}
          >
            Conhecer Filosofia →
          </a>
        </div>

        {/* Stats bar */}
        <div
          style={{
            marginTop: '72px',
            display: 'flex', gap: '56px', flexWrap: 'wrap', justifyContent: 'center',
            padding: '28px 40px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-md)',
            animation: 'fadeSlideIn 0.7s 0.4s ease both',
            maxWidth: '850px',
            width: '100%',
          }}
        >
          {[
            { value: '100% Grátis', label: 'Sem cartão de crédito' },
            { value: 'Offline First', label: 'PWA pronto para rodar' },
            { value: 'Streaks Diárias', label: 'Evolução consistente' },
            { value: 'Sons Ambientes', label: 'Foco profundo integrado' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center', flex: '1 1 150px' }}>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 2: Quick Benefits Block ────────────────────────────────── */}
      <section
        style={{
          padding: '80px 24px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-light)',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
            
            <div style={{
              padding: '32px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(34, 211, 238, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary)' }}>
                <Zap size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Consistência Sem Pressão</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Substitua a autocobrança desenfreada por ofensivas (streaks) saudáveis, focando na frequência diária e na construção de hábitos consistentes, sem ansiedade.
              </p>
            </div>

            <div style={{
              padding: '32px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <Activity size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Dados de Produtividade</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Monitore de forma inteligente sua energia e seu foco pessoal. Acompanhe seus blocos de concentração, dias de maior rendimento e padrões de produtividade ao longo do tempo.
              </p>
            </div>

            <div style={{
              padding: '32px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                <Clock size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Foco Livre de Culpa</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Combine cronômetro adaptativo com sons ambientes relaxantes de alta fidelidade (chuva, café, lareira) para entrar no estado de flow e preservar sua saúde mental.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 3: Why MyFlowDay Section ───────────────────────────────── */}
      <section
        id="por-que-myflowday"
        style={{
          padding: '100px 24px',
          background: 'var(--bg-app)',
          position: 'relative'
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '56px 48px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '4px',
              background: 'linear-gradient(90deg, var(--primary), var(--secondary))'
            }} />
            
            <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>
              A Nossa Filosofia
            </span>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', maxWidth: '800px', margin: '0 auto' }}>
              A produtividade tradicional está quebrada. Pare de agir como uma máquina.
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--text-muted)', lineHeight: '1.8', maxWidth: '780px', margin: '8px auto 0' }}>
              A maioria dos gerenciadores de tarefas foi criada por e para corporações frias. Eles tratam você como um robô: basta empilhar cartões de tarefas, cobrar prazos cruéis e gerar ansiedade quando algo atrasa. 
              <br /><br />
              No <strong>MyFlowDay</strong>, nós mudamos as regras. Acreditamos que a produtividade duradoura nasce do autoconhecimento, não da culpa. Somos o parceiro ideal para a sua jornada profissional e pessoal. Em vez de apenas registrar pendências, nós ajudamos você a mapear sua energia diária. Entenda seus limites, proteja seu foco profundo e evolua 1% a cada dia no seu ritmo.
            </p>

            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700 }}>
                <Check size={18} /> Mapeamento de Energia
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700 }}>
                <Check size={18} /> Ofensiva de Consistência
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700 }}>
                <Check size={18} /> Flexibilidade Sem Prazos Frios
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: Feature Sections ────────────────────────────────────── */}
      <section
        id="beneficios"
        style={{
          padding: '100px 24px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-light)',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '72px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>
              RECURSOS DO APP
            </span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', marginTop: '8px' }}>
              Tudo o que você precisa para <span style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>evoluir sem pressão</span>
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '32px'
          }}>

            {/* Feature 1 */}
            <div style={{
              padding: '36px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-app)', border: '1px solid var(--border-light)',
              display: 'flex', flexDirection: 'column', gap: '16px', transition: 'all 0.25s'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <Target size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Tarefas com Propósito</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Classifique o que realmente importa usando prioridades Alta, Média ou Baixa, ou estruture-as na Matriz de Eisenhower (Fazer, Agendar, Delegar ou Eliminar). Foque no progresso real, mantendo o ruído longe da sua atenção.
              </p>
            </div>

            {/* Feature 2 */}
            <div style={{
              padding: '36px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-app)', border: '1px solid var(--border-light)',
              display: 'flex', flexDirection: 'column', gap: '16px', transition: 'all 0.25s'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(34, 211, 238, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary)' }}>
                <Award size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Objetivos Flexíveis</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Defina metas de curto e médio prazo que acompanham sua jornada diária. No MyFlowDay, os objetivos não são camisas de força rígidas, mas sim bússolas maleáveis que guiam e se moldam às suas necessidades.
              </p>
            </div>

            {/* Feature 3 */}
            <div style={{
              padding: '36px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-app)', border: '1px solid var(--border-light)',
              display: 'flex', flexDirection: 'column', gap: '16px', transition: 'all 0.25s'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                <Clock size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Modo Foco Inteligente</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Combine blocos Pomodoro ajustáveis com sons de ambiente gravados em alta fidelidade (chuva suave, lareira crepitante, cafeteria aconchegante, ruído branco). Entre no estado de flow rapidamente e evite a fadiga cerebral.
              </p>
            </div>

            {/* Feature 4 */}
            <div style={{
              padding: '36px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-app)', border: '1px solid var(--border-light)',
              display: 'flex', flexDirection: 'column', gap: '16px', transition: 'all 0.25s'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                <Calendar size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Planejamento Completo</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Visualize sua semana com clareza. Alterne instantaneamente entre visualizações dinâmicas de Agenda tradicional, Quadro Kanban, Matriz de Eisenhower ou Lista Simples, adaptando-se a qualquer método de trabalho.
              </p>
            </div>

            {/* Feature 5 */}
            <div style={{
              padding: '36px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-app)', border: '1px solid var(--border-light)',
              display: 'flex', flexDirection: 'column', gap: '16px', transition: 'all 0.25s'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                <TrendingUp size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Evolução Visível</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Receba medalhas e suba de nível à medida que cuida de sua consistência diária. A gamificação do MyFlowDay é amigável, criada para festejar seu engajamento sustentável ao invés de cobrar metas impossíveis.
              </p>
            </div>

            {/* Feature 6 */}
            <div style={{
              padding: '36px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-app)', border: '1px solid var(--border-light)',
              display: 'flex', flexDirection: 'column', gap: '16px', transition: 'all 0.25s'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A855F7' }}>
                <Sparkles size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Insights Pessoais (Aura)</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                A Aura analisa seu padrão de trabalho silenciosamente e envia alertas amigáveis como: "Atenção: você está com muitas tarefas de alta prioridade abertas esta semana" ou "Seu foco rende 35% mais nas terças de manhã".
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── SECTION 5: Example Insights Block ──────────────────────────────── */}
      <section
        id="insights"
        style={{
          padding: '100px 24px',
          background: 'var(--bg-app)',
          position: 'relative'
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>
              CENTRAL DE INSIGHTS
            </span>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', marginTop: '8px' }}>
              O que você vai descobrir sobre sua mente
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '12px' }}>
              Aqui estão alguns exemplos reais de relatórios comportamentais gerados pelo aplicativo:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Insight Card 1 */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '24px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#EF4444' }} />
              <div style={{ fontSize: '32px' }}>⚡</div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>Foco de Alta Performance</h4>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  "Você costuma completar suas tarefas de <strong>Alta prioridade 42% mais rápido</strong> nas terças-feiras de manhã. Que tal agendar suas tarefas estratégicas para este bloco?"
                </p>
              </div>
            </div>

            {/* Insight Card 2 */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '24px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#F59E0B' }} />
              <div style={{ fontSize: '32px' }}>🛋️</div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>Alerta de Cansaço e Energia</h4>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  "Suas conclusões caem <strong>60% às sextas-feiras após as 15h</strong>. Que tal adiar novas tarefas complexas e reservar esse horário para revisões simples ou organização da próxima semana?"
                </p>
              </div>
            </div>

            {/* Insight Card 3 */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '24px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#10B981' }} />
              <div style={{ fontSize: '32px' }}>🔥</div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>Sequência e Estabilidade</h4>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  "Você manteve a consistência de foco e hábitos por <strong>4 dias seguidos</strong> sem apresentar picos de procrastinação. Seu ritmo biológico está ideal."
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 6: What You'll Discover About Yourself ─────────────────── */}
      <section
        style={{
          padding: '100px 24px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-light)',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>
              AUTODESCOBERTA E MÉTRICAS
            </span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', marginTop: '8px' }}>
              Seu raio-x comportamental completo
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '12px' }}>
              Dados que você não encontra em listas comuns de afazeres, focados na sua biologia de trabalho:
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
            
            <div style={{ padding: '24px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏱️</div>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>Período de Pico Biológico</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Identifica qual o horário exato e em qual dia da semana o seu cérebro alcança o pico absoluto de concentração e velocidade de entrega.
              </p>
            </div>

            <div style={{ padding: '24px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>📉</div>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>Alerta de Estagnação</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Avisos amigáveis e acolhedores antes de você perder o ritmo ou abandonar seus objetivos, ajudando você a recalcular rotas de forma inteligente.
              </p>
            </div>

            <div style={{ padding: '24px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔥</div>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>Índice de Consistência Real</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Uma nota calculada com base no seu respeito ao próprio ritmo semanal e cumprimento de hábitos básicos, e não no acúmulo de horas de trabalho.
              </p>
            </div>

            <div style={{ padding: '24px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>🏷️</div>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>Distribuição de Prioridades</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Gráficos claros que mostram quanto do seu tempo está focado no que é verdadeiramente transformador e quanto está sendo gasto com tarefas operacionais.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── SECTION 7: Who Is MyFlowDay For ────────────────────────────────── */}
      <section
        style={{
          padding: '100px 24px',
          background: 'var(--bg-app)'
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>
              PÚBLICO-ALVO
            </span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', marginTop: '8px' }}>
              Para quem criamos o MyFlowDay?
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
            
            {/* Audience Card 1 */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '40px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ fontSize: '32px' }}>💻</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Profissionais de Criação e Tech</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Desenvolvedores, designers, escritores e gerentes de produto que dependem do foco profundo diário. O MyFlowDay ajuda a gerenciar energia intelectual, evitando o temido burnout produtivo.
              </p>
            </div>

            {/* Audience Card 2 */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '40px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ fontSize: '32px' }}>🎓</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Estudantes e Acadêmicos</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Estudantes de graduação, pós-graduação ou candidatos a concursos públicos que precisam manter rotinas de estudo longas. A nossa gamificação acolhedora torna a jornada menos solitária.
              </p>
            </div>

            {/* Audience Card 3 */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '40px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ fontSize: '32px' }}>🧘</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Buscadores de Equilíbrio</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Pessoas cansadas das planilhas empresariais rígidas e listas pesadas, que querem organizar sua vida pessoal, hábitos de saúde e metas profissionais de forma integrada e humanizada.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── SECTION 8: Final CTA Section ───────────────────────────────────── */}
      <section
        style={{
          padding: '100px 24px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, var(--primary) 0%, #1d4ed8 50%, var(--secondary) 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.05), transparent 60%)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: '20px', fontFamily: 'var(--font-display)' }}>
            Evolua 1% todos os dias de forma saudável.
          </h2>
          <p style={{ fontSize: '18px', opacity: 0.9, marginBottom: '40px', maxWidth: '580px', margin: '0 auto 40px', lineHeight: '1.6' }}>
            Substitua de vez a ansiedade gerada pelas listas de afazeres tradicionais por uma rotina sustentável baseada em autoconhecimento. Experimente o MyFlowDay hoje.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              id="landing-final-cta"
              onClick={onEnterApp}
              style={{
                padding: '18px 48px',
                borderRadius: '30px',
                background: 'white',
                color: 'var(--primary)',
                fontWeight: 800,
                fontSize: '16px',
                cursor: 'pointer',
                border: 'none',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 40px rgba(0,0,0,0.25)'; }}
              onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 8px 32px rgba(0,0,0,0.15)'; }}
            >
              Criar Conta Grátis ⚡
            </button>
            <button
              onClick={handleStartDemoMode}
              style={{
                padding: '18px 48px',
                borderRadius: '30px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontWeight: 800,
                fontSize: '16px',
                cursor: 'pointer',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.2)'; e.target.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.transform = 'none'; }}
            >
              Testar Versão Demo 🎮
            </button>
          </div>
        </div>
      </section>

      {/* ── SECTION 9: Footer ──────────────────────────────────────────────── */}
      <footer
        style={{
          padding: '48px 24px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-light)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
            <img src="/branding/logo.svg" alt="MyFlowDay Logo" style={{ height: '28px' }} onError={e => e.target.style.display = 'none'} />
            <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '16px' }}>MyFlowDay</span>
          </div>
          
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px', lineHeight: '1.6' }}>
            Autoconhecimento na prática. Produtividade que dura.
            <br />
            Descubra seu ritmo e evolua todos os dias.
          </p>

          <div style={{ display: 'flex', gap: '28px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
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
              style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}
            >
              suporte@myflowday.com.br
            </a>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>
            © 2026 MyFlowDay. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* Smooth scrolling */
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
