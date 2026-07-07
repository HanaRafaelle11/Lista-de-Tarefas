import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Award, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  ArrowRight, 
  Zap, 
  Check, 
  Activity, 
  Calendar, 
  Shield, 
  HelpCircle,
  ChevronDown,
  Flame,
  Brain,
  MessageSquare,
  Play,
  CheckCircle2,
  Users,
  Compass,
  ArrowDown
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { getLogo } from '../design-system/branding/logo';
import { Container } from '../design-system/layout/Container';

export default function LandingPage({ onEnterApp }) {
  const { handleStartDemoMode } = useAppContext();
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [activeShowcaseTab, setActiveShowcaseTab] = useState('home');
  const logo = getLogo('dark', 'legal');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div 
      className="landing-root" 
      style={{ 
        minHeight: '100vh', 
        background: '#07090C',
        color: '#F8FAFC', 
        fontFamily: 'var(--font-body, "Plus Jakarta Sans", sans-serif)',
        overflowX: 'hidden',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* ── HEADER / NAVBAR ────────────────────────────────────────────── */}
      <header
        className="landing-header"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          background: scrolled ? 'rgba(7, 9, 12, 0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          padding: scrolled ? '12px 24px' : '20px 24px',
        }}
      >
        <Container 
          className="landing-header-container"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}
        >
          <div className="landing-logo-container" style={{ display: 'flex', alignItems: 'center', height: '56px', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img
              src={logo.src}
              alt={logo.alt}
              style={{ height: '56px', width: 'auto', objectFit: 'contain', marginTop: '-4px' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          
          <div className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <a href="#como-funciona" className="nav-link">Como Funciona</a>
            <a href="#problema" className="nav-link">O Problema</a>
            <a href="#comparativo" className="nav-link">Comparação</a>
            <a href="#planos" className="nav-link">Planos</a>
          </div>

          <div className="landing-nav-buttons" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={onEnterApp} className="nav-btn-secondary">Entrar</button>
            <button onClick={onEnterApp} className="nav-btn-primary">Criar Conta</button>
          </div>
        </Container>
      </header>

      {/* ── 1. HERO (PRIMEIRA DOBRA) ───────────────────────────────────── */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '140px 24px 80px',
          background: 'radial-gradient(circle 900px at 50% -200px, rgba(99, 102, 241, 0.15) 0%, transparent 80%)',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', borderRadius: '99px',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              fontSize: '11.5px', fontWeight: 700, color: '#818CF8',
              marginBottom: '24px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <Sparkles size={12} /> SISTEMA OPERACIONAL DE EVOLUÇÃO
          </div>

          <h1
            style={{
              fontSize: 'clamp(36px, 5vw, 62px)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              marginBottom: '20px',
              color: '#FFFFFF',
              fontFamily: 'var(--font-display, sans-serif)',
            }}
          >
            O sistema operacional da sua <span style={{ background: 'linear-gradient(to right, #818CF8, #C084FC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>evolução pessoal</span>.
          </h1>

          <p
            style={{
              fontSize: 'clamp(15px, 2vw, 18px)',
              lineHeight: 1.6,
              color: '#94A3B8',
              maxWidth: '680px',
              marginBottom: '36px',
            }}
          >
            O MyFlowDay conecta objetivos, tarefas, hábitos, foco, inteligência artificial e um coach personalizado para transformar pequenos passos em progresso consistente.
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyCenter: 'center', marginBottom: '80px' }}>
            <button 
              onClick={onEnterApp} 
              className="btn-purple-glow"
              style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                color: 'white',
                fontWeight: 700,
                fontSize: '14.5px',
                padding: '14px 28px',
                borderRadius: '30px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 8px 30px rgba(99, 102, 241, 0.3)'
              }}
            >
              Começar Gratuitamente <ArrowRight size={16} />
            </button>
            <button 
              onClick={handleStartDemoMode}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                color: '#F8FAFC',
                fontWeight: 600,
                fontSize: '14.5px',
                padding: '14px 28px',
                borderRadius: '30px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.07)'}
              onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.03)'}
            >
              Ver demonstração
            </button>
          </div>
        </div>

        {/* Hero Visual Mockup: Fluxo de Inteligência Conectado com Linhas Pulsantes */}
        <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1 }} className="hero-visual-wrapper">
          
          {/* SVG Pulsing Flow lines */}
          <div className="flow-lines-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
            <svg width="100%" height="100%" viewBox="0 0 1000 450" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.75 }}>
              {/* Path 1: Tarefa -> Objetivo */}
              <path d="M 230 115 C 320 115, 340 75, 450 75" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="2" strokeDasharray="6 4" />
              <path className="glowing-pulse" d="M 230 115 C 320 115, 340 75, 450 75" stroke="url(#gradient-indigo)" strokeWidth="3" strokeLinecap="round" />
              
              {/* Path 2: Objetivo -> Coach */}
              <path d="M 590 120 C 650 120, 680 230, 770 230" stroke="rgba(192, 132, 252, 0.2)" strokeWidth="2" strokeDasharray="6 4" />
              <path className="glowing-pulse" d="M 590 120 C 650 120, 680 230, 770 230" stroke="url(#gradient-purple)" strokeWidth="3" strokeLinecap="round" />
              
              {/* Path 3: Coach -> Pet */}
              <path d="M 770 290 C 680 290, 630 380, 520 380" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="2" strokeDasharray="6 4" />
              <path className="glowing-pulse" d="M 770 290 C 680 290, 630 380, 520 380" stroke="url(#gradient-emerald)" strokeWidth="3" strokeLinecap="round" />

              {/* Path 4: Pet -> Conquista */}
              <path d="M 400 380 C 330 380, 310 290, 220 290" stroke="rgba(245, 158, 11, 0.2)" strokeWidth="2" strokeDasharray="6 4" />
              <path className="glowing-pulse" d="M 400 380 C 330 380, 310 290, 220 290" stroke="url(#gradient-orange)" strokeWidth="3" strokeLinecap="round" />

              {/* Path 5: Conquista -> Insights */}
              <path d="M 220 240 C 320 240, 350 200, 480 200" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="2" strokeDasharray="6 4" />
              <path className="glowing-pulse" d="M 220 240 C 320 240, 350 200, 480 200" stroke="url(#gradient-sky)" strokeWidth="3" strokeLinecap="round" />

              {/* Gradients */}
              <defs>
                <linearGradient id="gradient-indigo" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity="0" />
                  <stop offset="50%" stopColor="#6366F1" stopOpacity="1" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="gradient-purple" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#C084FC" stopOpacity="0" />
                  <stop offset="50%" stopColor="#C084FC" stopOpacity="1" />
                  <stop offset="100%" stopColor="#C084FC" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="gradient-emerald" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0" />
                  <stop offset="50%" stopColor="#10B981" stopOpacity="1" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="gradient-orange" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0" />
                  <stop offset="50%" stopColor="#F59E0B" stopOpacity="1" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="gradient-sky" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
                  <stop offset="50%" stopColor="#38BDF8" stopOpacity="1" />
                  <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Interactive Connected Cards */}
          <div className="hero-mockup-grid">
            
            {/* Card 1: Tarefa (Top Left) */}
            <div className="mockup-card glass-premium" style={{ gridArea: 'tarefa', borderLeft: '3px solid #6366F1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="dot-active" style={{ backgroundColor: '#6366F1' }}></span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#6366F1', textTransform: 'uppercase' }}>Tarefa Executada</span>
              </div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', margin: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#10B981" /> Ler 10 páginas de psicologia
              </p>
            </div>

            {/* Card 2: Objetivo (Top Right) */}
            <div className="mockup-card glass-premium" style={{ gridArea: 'objetivo', borderLeft: '3px solid #C084FC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#C084FC', textTransform: 'uppercase' }}>Objetivo Associado</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#C084FC' }}>75%</span>
              </div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px', textAlign: 'left' }}>
                📚 Ler 12 Livros no Ano
              </p>
              <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '75%', height: '100%', background: 'linear-gradient(to right, #6366F1, #C084FC)', borderRadius: '3px' }}></div>
              </div>
            </div>

            {/* Card 3: Coach (Right Center) */}
            <div className="mockup-card glass-premium" style={{ gridArea: 'coach', borderLeft: '3px solid #10B981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Brain size={14} color="#10B981" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase' }}>Coach IA</span>
              </div>
              <p style={{ fontSize: '12px', lineHeight: 1.4, color: '#E2E8F0', margin: 0, textAlign: 'left', fontStyle: 'italic' }}>
                "👉 Ótimo avanço! Você costuma ler melhor nos fins de tarde. Bloqueei 20min na sua agenda amanhã às 17h para manter a sequência."
              </p>
            </div>

            {/* Card 4: Pet (Bottom Center) */}
            <div className="mockup-card glass-premium" style={{ gridArea: 'pet', borderLeft: '3px solid #F59E0B' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase' }}>Companheiro</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#F59E0B' }}>Nível 3 (Jovem)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>🌱</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF', textAlign: 'left' }}>Sua Planta cresceu!</div>
                  <div style={{ fontSize: '11px', color: '#10B981', fontWeight: 700, textAlign: 'left' }}>+45 XP de Foco Coletado</div>
                </div>
              </div>
            </div>

            {/* Card 5: Conquista (Bottom Left) */}
            <div className="mockup-card glass-premium" style={{ gridArea: 'conquista', borderLeft: '3px solid #38BDF8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Award size={14} color="#38BDF8" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase' }}>Conquista Desbloqueada</span>
              </div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 2px', textAlign: 'left' }}>
                🏆 Devorador de Páginas
              </p>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, textAlign: 'left' }}>
                Concluiu 10 tarefas do objetivo de leitura.
              </p>
            </div>

            {/* Card 6: Insights (Center) */}
            <div className="mockup-card glass-premium" style={{ gridArea: 'insights', borderLeft: '3px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Tendência Semanal</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981' }}>+12% Foco</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '40px', gap: '6px', padding: '0 10px' }}>
                <div style={{ height: '30%', width: '100%', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px' }}></div>
                <div style={{ height: '45%', width: '100%', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px' }}></div>
                <div style={{ height: '60%', width: '100%', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }}></div>
                <div style={{ height: '50%', width: '100%', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }}></div>
                <div style={{ height: '75%', width: '100%', background: 'rgba(255, 255, 255, 0.3)', borderRadius: '2px' }}></div>
                <div style={{ height: '85%', width: '100%', background: 'linear-gradient(to top, #6366F1, #C084FC)', borderRadius: '2px' }}></div>
              </div>
            </div>

          </div>

        </div>

      </section>

      {/* ── 3. COMO FUNCIONA (4 PASSOS) ───────────────────────────────── */}
      <section
        id="como-funciona"
        style={{
          padding: '100px 24px',
          background: '#07090C',
          position: 'relative'
        }}
      >
        <Container>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Simplicidade Acionável</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#FFFFFF', marginTop: '10px', letterSpacing: '-0.02em' }}>
              Como o MyFlowDay conduz sua evolução
            </h2>
          </div>

          <div className="steps-flow-container">
            
            {/* Step 1 */}
            <div className="step-row">
              <div className="step-num-col">
                <div className="step-number" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>1</div>
              </div>
              <div className="step-content-card">
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>Defina um Objetivo</h3>
                <p style={{ color: '#94A3B8', fontSize: '15px', margin: 0 }}>
                  Insira o que você quer alcançar (ex: <i>"Quero aprender inglês"</i> ou <i>"Criar o hábito de ler"</i>). Esse será o núcleo de todas as suas próximas ações.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="step-row">
              <div className="step-num-col">
                <div className="step-number" style={{ background: 'linear-gradient(135deg, #C084FC, #E879F9)' }}>2</div>
              </div>
              <div className="step-content-card">
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>A IA cria o Plano</h3>
                <p style={{ color: '#94A3B8', fontSize: '15px', margin: 0 }}>
                  Nossa inteligência artificial quebra seu grande objetivo em tarefas diárias, hábitos recorrentes e sugere a prioridade correta para começar a agir.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="step-row">
              <div className="step-num-col">
                <div className="step-number" style={{ background: 'linear-gradient(135deg, #10B981, #34D399)' }}>3</div>
              </div>
              <div className="step-content-card">
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>Você Executa no Flow</h3>
                <p style={{ color: '#94A3B8', fontSize: '15px', margin: 0 }}>
                  Acesse sua lista limpa de tarefas, inicie cronômetros Pomodoro com sons ambientes relaxantes e execute com foco total, sem popups ou distrações.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="step-row">
              <div className="step-num-col">
                <div className="step-number" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}>4</div>
              </div>
              <div className="step-content-card">
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>O Sistema Aprende e Evolui</h3>
                <p style={{ color: '#94A3B8', fontSize: '15px', margin: 0 }}>
                  Suas ações alimentam o Coach de IA, que gera insights de hábitos e produtividade. Seu companion virtual ganha XP e cresce junto com você.
                </p>
              </div>
            </div>

          </div>
        </Container>
      </section>

      {/* ── 2. O PROBLEMA ─────────────────────────────────────────────── */}
      <section
        id="problema"
        style={{
          padding: '100px 24px',
          background: '#090D12',
          borderTop: '1px solid rgba(255, 255, 255, 0.03)',
          position: 'relative'
        }}
      >
        <Container>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#C084FC', textTransform: 'uppercase', letterSpacing: '0.05em' }}>O Grande Problema</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#FFFFFF', marginTop: '10px', letterSpacing: '-0.02em' }}>
              A maioria dos aplicativos só organiza tarefas.
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '16px', maxWidth: '600px', margin: '12px auto 0' }}>
              Você perde tempo e foco pulando entre ferramentas fragmentadas que não se comunicam.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'stretch' }} className="problem-comparison-grid">
            
            {/* Antes: Ferramentas Fragmentadas */}
            <div style={{ background: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '36px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#FCA5A5', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ❌ ANTES: Fragmentação Exaustiva
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '30px' }}>
                  <span className="tag-fragmented">Todoist</span>
                  <span className="tag-fragmented">Habit Tracker</span>
                  <span className="tag-fragmented">Pomodoro</span>
                  <span className="tag-fragmented">ChatGPT</span>
                  <span className="tag-fragmented">Calendário</span>
                  <span className="tag-fragmented">Notas</span>
                  <span className="tag-fragmented">Planilhas</span>
                </div>
              </div>
              <p style={{ color: '#FCA5A5', fontSize: '15px', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                👉 Você passa o dia inteiro trocando de aplicativo e preenchendo as mesmas informações em planilhas e agendas para tentar ver algum progresso.
              </p>
            </div>

            {/* Depois: MyFlowDay Tudo Conectado */}
            <div style={{ background: 'rgba(99, 102, 241, 0.03)', border: '1px solid rgba(99, 102, 241, 0.15)', padding: '36px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 0 40px rgba(99, 102, 241, 0.05)' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#818CF8', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✨ DEPOIS: Tudo Conectado
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '30px' }}>
                  <span className="tag-connected">Objetivos Globais</span>
                  <span className="tag-connected">Meu Dia (Tasks)</span>
                  <span className="tag-connected">Cronômetro Foco</span>
                  <span className="tag-connected">Coach IA Integrado</span>
                  <span className="tag-connected">Companion Evolutivo</span>
                  <span className="tag-connected">Métricas & Insights</span>
                </div>
              </div>
              <p style={{ color: '#818CF8', fontSize: '15px', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                👉 Uma única inteligência centralizada acompanha você durante todo o seu dia. Seus dados se integram automaticamente e geram recomendações reais de produtividade.
              </p>
            </div>

          </div>
        </Container>
      </section>

      {/* ── 5. CONHEÇA O MYFLOWDAY (VITRINE DE TELAS) ──────────────────── */}
      <section
        id="conheca"
        style={{
          padding: '100px 24px',
          background: '#07090C',
        }}
      >
        <Container>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#C084FC', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tour Visual</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#FFFFFF', marginTop: '10px', letterSpacing: '-0.02em' }}>
              Explore a Interface do Flow
            </h2>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '40px' }}>
            {[
              { id: 'home', label: 'Home / Lobby' },
              { id: 'meudia', label: 'Meu Dia' },
              { id: 'foco', label: 'Modo Foco' },
              { id: 'coach', label: 'Coach IA' },
              { id: 'evolucao', label: 'Evolução' },
              { id: 'conquistas', label: 'Conquistas' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveShowcaseTab(tab.id)}
                className={`showcase-tab ${activeShowcaseTab === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Showcase Display Area */}
          <div style={{ background: '#0F1318', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '20px', padding: '24px', minHeight: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            
            {activeShowcaseTab === 'home' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }} className="showcase-content-grid">
                <div>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', marginBottom: '16px' }}>Lobby Principal: Seu Copiloto</h3>
                  <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
                    O centro de gravidade do MyFlowDay. Veja o clima atual, acompanhe a saúde da sua planta virtual, verifique sua sequência e obtenha a próxima sugestão prioritária em um layout limpo de glassmorphism.
                  </p>
                  <ul className="premium-list">
                    <li><Check size={14} color="#10B981" /> Companheiro Pet na dobra inicial</li>
                    <li><Check size={14} color="#10B981" /> Quick-Add inteligente por linguagem natural</li>
                    <li><Check size={14} color="#10B981" /> Indicador de consistência semanal rápida</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '40px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '260px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '80px', animation: 'float-animation 4s ease-in-out infinite' }}>🌱</span>
                    <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>Nível 1 (Semente Ativa)</span>
                  </div>
                </div>
              </div>
            )}

            {activeShowcaseTab === 'meudia' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }} className="showcase-content-grid">
                <div>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', marginBottom: '16px' }}>Meu Dia: Execução Focada</h3>
                  <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
                    Sua to-do list definitiva. Destaques automáticos identificam tarefas de impacto conectadas a objetivos ou críticas por prazo. Menus kebab limpam a poluição visual para você focar apenas em marcar checkboxes e concluir missões.
                  </p>
                  <ul className="premium-list">
                    <li><Check size={14} color="#10B981" /> Destaques dinâmicos de sequência</li>
                    <li><Check size={14} color="#10B981" /> Filtros de contexto inteligentes</li>
                    <li><Check size={14} color="#10B981" /> Interface limpa com menu Kebab</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="mini-task-item"><span className="mini-badge-blue">✨ Recomendada</span> <span>Revisar protótipo de UX</span></div>
                  <div className="mini-task-item"><span className="mini-badge-red">🔥 Crítica</span> <span>Resolver bug de checkout</span></div>
                  <div className="mini-task-item"><span className="mini-badge-orange">⚡ Mantém Sequência</span> <span>Cadastrar relatório diário</span></div>
                </div>
              </div>
            )}

            {activeShowcaseTab === 'foco' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }} className="showcase-content-grid">
                <div>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', marginBottom: '16px' }}>Sessão de Foco: Imersão Sonora</h3>
                  <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
                    Bloqueie o world externo. Selecione a tarefa de foco ativo, receba estimativa de XP, ative mixagens sonoras (Chuva, Café, Ruído Branco) e conclua ciclos sem se distrair.
                  </p>
                  <ul className="premium-list">
                    <li><Check size={14} color="#10B981" /> Briefing de Missão com XP estimado</li>
                    <li><Check size={14} color="#10B981" /> Mixer de áudio integrado</li>
                    <li><Check size={14} color="#10B981" /> Modais de sucesso gamificados</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '30px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px' }}>
                  <div className="foco-briefing-glow">
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', marginBottom: '4px' }}>Missão de Foco</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>25:00</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>Meta: +15 XP de Evolução</div>
                  </div>
                </div>
              </div>
            )}

            {activeShowcaseTab === 'coach' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }} className="showcase-content-grid">
                <div>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', marginBottom: '16px' }}>Coach IA: Mentor Pessoal</h3>
                  <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
                    Diferente de IAs estáticas, o Coach IA do MyFlowDay aprende com as suas horas de maior produtividade, tarefas pendentes e objetivos em atraso, gerando planos e análises personalizadas.
                  </p>
                  <ul className="premium-list">
                    <li><Check size={14} color="#10B981" /> Avaliação semanal inteligente</li>
                    <li><Check size={14} color="#10B981" /> Alinhamento de objetivos dormentes</li>
                    <li><Check size={14} color="#10B981" /> Bloqueio inteligente na agenda</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="chat-bubble-showcase">🧠 <b>Coach Flow:</b> Olá! Analisando seu ritmo, notei que você rende muito mais às terças-feiras no período da manhã. Para potencializar seus resultados, sugiro agendar as tarefas do objetivo "Estudos de Tecnologia" nessa janela. Além disso, o seu objetivo "Leitura Diária" está parado há 4 dias — que tal fazermos uma sessão curta de 10 minutos hoje para reativar o seu hábito e manter a planta evoluindo?</div>
                </div>
              </div>
            )}

            {activeShowcaseTab === 'evolucao' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }} className="showcase-content-grid">
                <div>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', marginBottom: '16px' }}>Evolução: Métricas do OS</h3>
                  <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
                    Analise sua evolução. Acompanhe gráficos de consistência diária de hábitos, relatórios de ritmo semanal de tarefas e o progresso macro em cada um dos seus objetivos ativos.
                  </p>
                  <ul className="premium-list">
                    <li><Check size={14} color="#10B981" /> Visualização de ritmo e consistência</li>
                    <li><Check size={14} color="#10B981" /> Distribuição de prioridades de tarefas</li>
                    <li><Check size={14} color="#10B981" /> Monitoramento de objetivos ativos</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '30px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '220px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '36px', fontWeight: 800, color: '#10B981' }}>85%</div>
                    <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>Consistência Geral da Semana</div>
                  </div>
                </div>
              </div>
            )}

            {activeShowcaseTab === 'conquistas' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }} className="showcase-content-grid">
                <div>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', marginBottom: '16px' }}>Gamificação Sem Perder Produtividade</h3>
                  <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
                    Produtividade divertida. Colecione insígnias categorizadas por raridade e curta feedbacks sonoros imersivos sintetizados no momento do desbloqueio.
                  </p>
                  <ul className="premium-list">
                    <li><Check size={14} color="#10B981" /> Medalhas de raridade variável</li>
                    <li><Check size={14} color="#10B981" /> Áudio harmonioso via Web Audio API</li>
                    <li><Check size={14} color="#10B981" /> Toasts animados de feedback</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ padding: '16px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px' }}>🏆</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>Mestre do Foco</div>
                      <span style={{ fontSize: '10px', background: '#38BDF8', color: '#07090C', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>ÉPICA</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

        </Container>
      </section>



      {/* ── 7. O DIFERENCIAL (ANIMAÇÃO CASCATA) ────────────────────────── */}
      <section
        style={{
          padding: '100px 24px',
          background: '#07090C',
          borderTop: '1px solid rgba(255, 255, 255, 0.03)',
        }}
      >
        <Container>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#C084FC', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sem Esforço Duplicado</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#FFFFFF', marginTop: '10px', letterSpacing: '-0.02em' }}>
              Não é só IA. É inteligência contínua.
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '16px', maxWidth: '600px', margin: '12px auto 0' }}>
              Veja como o efeito cascata do MyFlowDay conecta uma simples ação diária à sua evolução geral em tempo real.
            </p>
          </div>

          <div className="cascade-animation-wrapper">
            <div className="cascade-step shadow-indigo"><span className="cascade-icon" style={{ background: '#6366F1' }}>✓</span> <b>Concluir tarefa</b></div>
            <div className="cascade-connector"><ArrowDown size={22} color="#6366F1" /></div>
            <div className="cascade-step shadow-purple"><span className="cascade-icon" style={{ background: '#8B5CF6' }}>🎯</span> <b>Objetivo avança</b></div>
            <div className="cascade-connector"><ArrowDown size={22} color="#8B5CF6" /></div>
            <div className="cascade-step shadow-orange"><span className="cascade-icon" style={{ background: '#F59E0B' }}>🌱</span> <b>Pet ganha XP</b></div>
            <div className="cascade-connector"><ArrowDown size={22} color="#F59E0B" /></div>
            <div className="cascade-step shadow-emerald"><span className="cascade-icon" style={{ background: '#10B981' }}>🧠</span> <b>Coach aprende</b></div>
            <div className="cascade-connector"><ArrowDown size={22} color="#10B981" /></div>
            <div className="cascade-step shadow-sky"><span className="cascade-icon" style={{ background: '#0EA5E9' }}>📊</span> <b>Insights atualizados</b></div>
            <div className="cascade-connector"><ArrowDown size={22} color="#0EA5E9" /></div>
            <div className="cascade-step shadow-cyan"><span className="cascade-icon" style={{ background: '#06B6D4' }}>🏆</span> <b>Conquista progride</b></div>
            <div className="cascade-connector"><ArrowDown size={22} color="#06B6D4" /></div>
            <div className="cascade-step shadow-pink"><span className="cascade-icon" style={{ background: '#EC4899' }}>🏠</span> <b>Home muda recomendações</b></div>
          </div>
        </Container>
      </section>

      {/* ── 8. COMPARAÇÃO ─────────────────────────────────────────────── */}
      <section
        id="comparativo"
        style={{
          padding: '100px 24px',
          background: '#090D12',
          borderTop: '1px solid rgba(255, 255, 255, 0.03)',
        }}
      >
        <Container>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Métricas Honestas</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#FFFFFF', marginTop: '10px', letterSpacing: '-0.02em' }}>
              Por que escolher o MyFlowDay?
            </h2>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', background: '#0F1318' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '20px 24px', fontWeight: 700, color: '#FFFFFF' }}>Funcionalidade</th>
                  <th style={{ padding: '20px 24px', fontWeight: 700, color: '#94A3B8' }}>Outros Apps</th>
                  <th style={{ padding: '20px 24px', fontWeight: 700, color: 'var(--primary, #6366F1)' }}>MyFlowDay</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '18px 24px', fontWeight: 600 }}>Gerenciador de Tarefas</td>
                  <td style={{ padding: '18px 24px', color: '#10B981' }}>✅ Completo</td>
                  <td style={{ padding: '18px 24px', color: '#10B981', fontWeight: 700 }}>✅ Completo</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '18px 24px', fontWeight: 600 }}>Rastreador de Hábitos</td>
                  <td style={{ padding: '18px 24px', color: '#F59E0B' }}>⚠️ Apenas Alguns</td>
                  <td style={{ padding: '18px 24px', color: '#10B981', fontWeight: 700 }}>✅ Integrado</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '18px 24px', fontWeight: 600 }}>Timer de Foco Pomodoro</td>
                  <td style={{ padding: '18px 24px', color: '#F59E0B' }}>⚠️ Apenas Alguns</td>
                  <td style={{ padding: '18px 24px', color: '#10B981', fontWeight: 700 }}>✅ Integrado com áudio</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '18px 24px', fontWeight: 600 }}>Metas e Objetivos Globais</td>
                  <td style={{ padding: '18px 24px', color: '#F59E0B' }}>⚠️ Apenas Alguns</td>
                  <td style={{ padding: '18px 24px', color: '#10B981', fontWeight: 700 }}>✅ Integrado</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '18px 24px', fontWeight: 600 }}>Coach de Inteligência Artificial</td>
                  <td style={{ padding: '18px 24px', color: '#EF4444' }}>❌ Não possui</td>
                  <td style={{ padding: '18px 24px', color: '#10B981', fontWeight: 700 }}>✅ Personalizado e reativo</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '18px 24px', fontWeight: 600 }}>Companion Virtual (Pet)</td>
                  <td style={{ padding: '18px 24px', color: '#EF4444' }}>❌ Não possui</td>
                  <td style={{ padding: '18px 24px', color: '#10B981', fontWeight: 700 }}>✅ Gamificação nativa</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '18px 24px', fontWeight: 600 }}>Gamificação com Conquistas</td>
                  <td style={{ padding: '18px 24px', color: '#EF4444' }}>❌ Raro</td>
                  <td style={{ padding: '18px 24px', color: '#10B981', fontWeight: 700 }}>✅ Com sons sintetizados</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '18px 24px', fontWeight: 600 }}>Central de Insights Semanais</td>
                  <td style={{ padding: '18px 24px', color: '#F59E0B' }}>⚠️ Poucos</td>
                  <td style={{ padding: '18px 24px', color: '#10B981', fontWeight: 700 }}>✅ Automatizado</td>
                </tr>
                <tr style={{ borderBottom: 'none' }}>
                  <td style={{ padding: '18px 24px', fontWeight: 700 }}>Ecossistema 100% Conectado</td>
                  <td style={{ padding: '18px 24px', color: '#EF4444', fontWeight: 600 }}>❌ Ferramentas isoladas</td>
                  <td style={{ padding: '18px 24px', color: '#10B981', fontWeight: 800 }}>✅ Tudo trabalha junto</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Container>
      </section>



      {/* ── 11. PRICING GRID ──────────────────────────────────────────── */}
      <section
        id="planos"
        style={{
          padding: '100px 24px',
          background: '#07090C',
          borderTop: '1px solid rgba(255, 255, 255, 0.03)',
        }}
      >
        <Container>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Planos</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#FFFFFF', marginTop: '10px', letterSpacing: '-0.02em' }}>
              Comece grátis. Evolua quando quiser.
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '16px', maxWidth: '550px', margin: '12px auto 0' }}>
              Sem truques. O plano gratuito já é completo. O Pro existe para quem quer ir mais fundo.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '800px', margin: '0 auto' }} className="pricing-grid">
            {/* Free Plan */}
            <div className="pricing-card">
              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gratuito</span>
                <div style={{ fontSize: '48px', fontWeight: 800, color: '#FFFFFF', marginTop: '8px', lineHeight: 1 }}>
                  R$0
                  <span style={{ fontSize: '16px', fontWeight: 500, color: '#64748B' }}>/mês</span>
                </div>
                <p style={{ color: '#94A3B8', fontSize: '14px', marginTop: '12px', lineHeight: 1.5 }}>
                  Tudo que você precisa para organizar sua evolução pessoal.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                {[
                  { text: 'Tarefas, hábitos e objetivos ilimitados', active: true },
                  { text: 'Timer Pomodoro com áudio ambiente', active: true },
                  { text: 'Companion virtual evolutivo', active: true },
                  { text: 'Conquistas e gamificação completa', active: true },
                  { text: 'Planejamento semanal drag & drop', active: true },
                  { text: 'Coach IA — insights semanais básicos', active: true },
                  { text: 'Análises detalhadas por horário (Pro)', active: false },
                  { text: 'Mentor de Inteligência Avançada (Pro)', active: false }
                ].map((f, i) => {
                  return (
                    <div 
                      key={i} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px', 
                        fontSize: '14px', 
                        color: f.active ? '#E2E8F0' : 'rgba(226, 232, 240, 0.25)',
                        filter: f.active ? 'none' : 'blur(1.5px)',
                        transition: 'filter 0.3s, color 0.3s'
                      }}
                    >
                      <span style={{ color: f.active ? '#10B981' : '#475569', fontSize: '16px', flexShrink: 0 }}>✓</span>
                      {f.text}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={onEnterApp}
                className="btn-purple-glow"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35)',
                }}
              >
                Entrar no Flow
              </button>
            </div>

            {/* Pro Plan */}
            <div className="pricing-card pricing-card-pro">
              <div style={{ position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)' }}>
                <span style={{
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 16px',
                  borderRadius: '0 0 8px 8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Recomendado</span>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pro</span>
                <div style={{ fontSize: '48px', fontWeight: 800, color: '#FFFFFF', marginTop: '8px', lineHeight: 1 }}>
                  R$14,90
                  <span style={{ fontSize: '16px', fontWeight: 500, color: '#64748B' }}>/mês</span>
                </div>
                <p style={{ color: '#94A3B8', fontSize: '14px', marginTop: '12px', lineHeight: 1.5 }}>
                  Para quem quer o máximo do Coach IA e insights profundos.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                {[
                  'Tudo do plano Gratuito',
                  'Coach IA avançado — análises profundas',
                  'Tendências de produtividade por horário',
                  'Relatórios detalhados de comportamento',
                  'Sugestões diárias personalizadas',
                  'Prioridade em novos recursos',
                  'Companions exclusivos',
                  'Suporte prioritário'
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#E2E8F0' }}>
                    <span style={{ color: '#8B5CF6', fontSize: '16px', flexShrink: 0 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
              <button
                onClick={onEnterApp}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'transparent',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                Assinar Pro
              </button>
            </div>
          </div>
        </Container>
      </section>

      {/* ── 12. FAQ ───────────────────────────────────────────────────── */}
      <section
        style={{
          padding: '100px 24px',
          background: '#090D12',
          borderTop: '1px solid rgba(255, 255, 255, 0.03)',
        }}
      >
        <Container>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#C084FC', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Perguntas Frequentes</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#FFFFFF', marginTop: '10px', letterSpacing: '-0.02em' }}>
              Respostas Rápidas
            </h2>
          </div>

          <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              {
                q: 'O que é o MyFlowDay?',
                a: 'O MyFlowDay é um sistema operacional de evolução pessoal que centraliza seus objetivos, tarefas, hábitos, sessões de foco Pomodoro, conquistas gamificadas e um coach inteligente em um ecossistema integrado para ajudá-lo a evoluir dia após dia.'
              },
              {
                q: 'Como o Coach IA funciona?',
                a: 'Ele observa silenciosamente suas horas de maior foco, tarefas concluídas e hábitos cumpridos na semana para fornecer notas reais e relatórios acionáveis de comportamento (como avisar se um objetivo de leitura está parado ou indicar o seu melhor dia de foco).'
              },
              {
                q: 'O que é o companheiro virtual (pet) da Home?',
                a: 'É um avatar dinâmico (inicialmente uma planta semente) que cresce de nível e forma física à medida que você conclui tarefas e hábitos no seu dia. Ele funciona como o espelho visual do seu progresso.'
              },
              {
                q: 'O aplicativo funciona offline?',
                a: 'Sim. O MyFlowDay possui um banco de dados local IndexedDB completo que salva todas as suas alterações em cache. Assim que o seu dispositivo restabelece a conexão com a internet, os dados são sincronizados com o Supabase automaticamente.'
              },
              {
                q: 'Qual a diferença entre o plano Gratuito e o Pro?',
                a: 'O plano Gratuito já inclui todos os módulos essenciais: tarefas, hábitos, objetivos, timer, companion e gamificação. O plano Pro desbloqueia análises profundas do Coach IA, tendências de produtividade por horário, companions exclusivos e suporte prioritário.'
              }
            ].map((item, idx) => (
              <div 
                key={idx} 
                style={{ background: '#0F1318', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => toggleFaq(idx)}
              >
                <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>{item.q}</span>
                  <ChevronDown size={18} style={{ transform: openFaq === idx ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: '#94A3B8', flexShrink: 0 }} />
                </div>
                {openFaq === idx && (
                  <div style={{ padding: '0 24px 20px', fontSize: '14px', lineHeight: 1.6, color: '#94A3B8', borderTop: '1px solid rgba(255, 255, 255, 0.02)', paddingTop: '12px' }}>
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── 12. CTA FINAL ─────────────────────────────────────────────── */}
      <section
        style={{
          padding: '120px 24px',
          background: 'linear-gradient(to top, rgba(99, 102, 241, 0.08) 0%, transparent 100%)',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        <Container>
          <div style={{ maxWidth: '750px', margin: '0 auto', background: '#0F1318', border: '1px solid rgba(255, 255, 255, 0.06)', padding: '60px 40px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.1), transparent 50%)', pointerEvents: 'none' }} />
            
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 800, color: '#FFFFFF', marginBottom: '16px', letterSpacing: '-0.02em' }}>
              Comece sua jornada hoje.
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.6, maxWidth: '500px', margin: '0 auto 30px' }}>
              Experimente um jeito novo e inteligente de planejar e progredir. Junte-se a nós e mude a forma como você lida com a sua rotina.
            </p>
            
            <button
              onClick={onEnterApp}
              className="btn-purple-glow"
              style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                color: 'white',
                fontWeight: 700,
                fontSize: '15px',
                padding: '16px 36px',
                borderRadius: '30px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)'
              }}
            >
              Criar conta gratuitamente
            </button>
          </div>
        </Container>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          background: '#07090C',
          padding: '48px 24px',
          textAlign: 'center'
        }}
      >
        <Container style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={logo.src} alt={logo.alt} style={{ height: '36px', width: 'auto' }} />
          </div>

          <p style={{ fontSize: '14px', color: '#94A3B8', maxWidth: '600px', margin: 0, lineHeight: 1.6 }}>
            MyFlowDay é o sistema operacional de evolução pessoal que une gerenciador de tarefas, controle de metas, cronômetro de foco e mentor de rotina assistido por IA.
          </p>

          <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
            © 2026 MyFlowDay. Todos os direitos reservados.
          </p>
        </Container>
      </footer>

      {/* Global CSS Styles */}
      <style>{`
        html {
          scroll-behavior: smooth;
        }
        
        .nav-link {
          font-size: 13.5px;
          font-weight: 600;
          color: #94A3B8;
          text-decoration: none;
          transition: color 0.2s;
        }

        .nav-link:hover {
          color: #818CF8 !important;
        }

        .nav-btn-secondary {
          padding: 8px 16px;
          border-radius: 20px;
          background: transparent;
          color: #F8FAFC;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.2s;
        }

        .nav-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .nav-btn-primary {
          padding: 8px 20px;
          border-radius: 20px;
          background: #6366F1;
          color: white;
          font-weight: 700;
          font-size: 13.5px;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
        }

        .nav-btn-primary:hover {
          background: #4F46E5;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
        }

        .btn-purple-glow:hover {
          transform: translateY(-2px);
          filter: brightness(1.1);
        }

        /* ── HERO CONNECTED GRAPH MOCKUP ── */
        .hero-mockup-grid {
          display: grid;
          grid-template-areas:
            "tarefa . insights"
            "tarefa objetivo insights"
            "conquista . coach"
            "conquista pet coach";
          grid-template-columns: 1fr 0.1fr 1.2fr;
          grid-template-rows: auto auto auto auto;
          gap: 24px;
          position: relative;
          z-index: 1;
          padding: 20px;
        }

        @media (max-width: 768px) {
          .hero-mockup-grid {
            grid-template-areas:
              "tarefa"
              "objetivo"
              "insights"
              "coach"
              "pet"
              "conquista";
            grid-template-columns: 1fr;
            grid-template-rows: auto;
            gap: 16px;
          }
          .flow-lines-container {
            display: none !important;
          }
        }

        .glass-premium {
          background: rgba(15, 19, 26, 0.8);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
          transition: all 0.3s ease;
        }

        .glass-premium:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 12px 40px 0 rgba(99, 102, 241, 0.1);
        }

        .mockup-card {
          padding: 16px 20px;
        }

        /* Glowing Pulse Animation */
        .glowing-pulse {
          stroke-dasharray: 20 80;
          animation: draw-pulse 3s linear infinite;
        }

        @keyframes draw-pulse {
          from {
            stroke-dashoffset: 100;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes float-animation {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(3deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }

        /* ── PROBLEM TAGS ── */
        .tag-fragmented {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #FCA5A5;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }

        .tag-connected {
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.2);
          color: #818CF8;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }

        /* ── STEPS FLOW ── */
        .steps-flow-container {
          position: relative;
          max-width: 650px;
          margin: 0 auto;
          padding: 20px 0;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }
        
        .steps-flow-container::before {
          content: '';
          position: absolute;
          left: 24px;
          top: 30px;
          bottom: 30px;
          width: 2px;
          background: linear-gradient(180deg, #6366F1 0%, #C084FC 33%, #10B981 66%, #F59E0B 100%);
          z-index: 1;
        }

        .step-row {
          display: flex;
          align-items: center;
          gap: 24px;
          position: relative;
          z-index: 2;
        }

        .step-num-col {
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 3;
        }

        .step-number {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 800;
          color: white;
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
          flex-shrink: 0;
          border: 3px solid #07090C;
        }

        .step-content-card {
          background: #0F1318;
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 20px 24px;
          border-radius: 16px;
          flex: 1;
        }

        /* ── ECOSYSTEM CARD ── */
        .ecosystem-card {
          background: #0F1318;
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 24px;
          border-radius: 16px;
          transition: all 0.3s;
        }

        .ecosystem-card:hover {
          transform: translateY(-3px);
          border-color: rgba(255, 255, 255, 0.08);
          background: rgba(15, 19, 24, 0.9);
        }

        /* ── SHOWCASE TABS ── */
        .showcase-tab {
          padding: 10px 20px;
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.02);
          color: #94A3B8;
          border: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .showcase-tab:hover {
          color: white;
          background: rgba(255, 255, 255, 0.05);
        }

        .showcase-tab.active {
          background: #6366F1;
          color: white;
          border-color: #6366F1;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.25);
        }

        .premium-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .premium-list li {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13.5px;
          color: #CBD5E1;
        }

        .mini-task-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 12px 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          font-weight: 600;
        }

        .mini-badge-blue {
          background: rgba(99, 102, 241, 0.1);
          color: #818CF8;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
        }

        .mini-badge-red {
          background: rgba(239, 68, 68, 0.1);
          color: #F87171;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
        }

        .mini-badge-orange {
          background: rgba(245, 158, 11, 0.1);
          color: #FBBF24;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
        }

        .foco-briefing-glow {
          background: rgba(16, 185, 129, 0.02);
          border: 1px solid rgba(16, 185, 129, 0.15);
          border-radius: 50%;
          width: 140px;
          height: 140px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.08);
        }

        .chat-bubble-showcase {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 12.5px;
          line-height: 1.4;
          color: #CBD5E1;
          text-align: left;
        }

        /* ── COACH DIALOGUES ── */
        .coach-chat-showcase {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 650px;
          margin: 0 auto;
          padding-left: 24px;
        }

        .coach-chat-showcase::before {
          content: '';
          position: absolute;
          left: 10px;
          top: 20px;
          bottom: 20px;
          width: 2px;
          background: linear-gradient(180deg, #10B981 0%, rgba(16, 185, 129, 0.15) 100%);
          z-index: 1;
        }

        .chat-bubble-large {
          background: #0F1318;
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 20px;
          border-radius: 16px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          text-align: left;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          position: relative;
          z-index: 2;
        }

        .chat-avatar {
          font-size: 16px;
          background: #07090C;
          border: 2px solid #10B981;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          position: absolute;
          left: -30px;
          top: 24px;
          z-index: 3;
        }

        .chat-text-wrapper {
          flex: 1;
          margin-left: 12px;
        }

        /* ── CASCADE ANIMATION ── */
        .cascade-animation-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 480px;
          margin: 0 auto;
        }

        .cascade-step {
          background: #0F1318;
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 16px 28px;
          border-radius: 14px;
          width: 100%;
          font-size: 15px;
          color: #FFFFFF;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }

        .cascade-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: white;
          flex-shrink: 0;
        }

        .cascade-connector {
          margin: 8px 0;
          display: flex;
          justify-content: center;
          animation: pulse-arrow 2s infinite;
        }

        @keyframes pulse-arrow {
          0% { opacity: 0.4; transform: translateY(-2px); }
          50% { opacity: 1; transform: translateY(2px); }
          100% { opacity: 0.4; transform: translateY(-2px); }
        }

        .shadow-indigo { border-left: 3px solid #6366F1; }
        .shadow-purple { border-left: 3px solid #8B5CF6; }
        .shadow-orange { border-left: 3px solid #F59E0B; }
        .shadow-emerald { border-left: 3px solid #10B981; }
        .shadow-sky { border-left: 3px solid #0EA5E9; }
        .shadow-cyan { border-left: 3px solid #06B6D4; }
        .shadow-pink { border-left: 3px solid #EC4899; }

        /* ── TARGET CARDS ── */
        .target-card {
          background: #0F1318;
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 28px;
          border-radius: 16px;
          text-align: left;
        }

        /* ── TESTIMONIAL CARDS ── */
        .testimonial-card {
          background: #0F1318;
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 28px;
          border-radius: 16px;
          text-align: left;
        }

        .avatar-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: white;
        }

        /* ── PRICING CARDS ── */
        .pricing-card {
          background: #0F1318;
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 36px 32px;
          border-radius: 20px;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .pricing-card-pro {
          border-color: rgba(99, 102, 241, 0.3);
          background: linear-gradient(170deg, rgba(99, 102, 241, 0.06) 0%, #0F1318 40%);
          box-shadow: 0 8px 40px rgba(99, 102, 241, 0.1);
        }

        /* Responsive */
        @media (max-width: 991px) {
          .showcase-content-grid {
            grid-template-columns: 1fr !important;
            gap: 24px;
          }
          .problem-comparison-grid {
            grid-template-columns: 1fr !important;
            gap: 24px;
          }
          .pricing-grid {
            grid-template-columns: 1fr !important;
            max-width: 420px !important;
          }
        }

        @media (max-width: 768px) {
          .landing-header {
            padding: 14px 16px !important;
          }
          .landing-nav-links {
            display: none !important;
          }
          .problem-comparison-grid {
            display: flex !important;
            flex-direction: row !important;
            overflow-x: auto !important;
            scroll-snap-type: x mandatory;
            gap: 16px !important;
            padding-bottom: 16px;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
          }
          .problem-comparison-grid > div {
            min-width: 280px !important;
            flex: 0 0 85% !important;
            scroll-snap-align: center;
          }
        }
      `}
      </style>
    </div>
  );
}
