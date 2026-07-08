import React, { useState, useEffect } from 'react';
import { 
  Target, Award, Clock, TrendingUp, Sparkles, ArrowRight,
  Zap, Check, Activity, Calendar, HelpCircle, ChevronDown,
  Flame, Brain, Play, CheckCircle2, Compass, Heart, Shield,
  MessageSquare, Users, Leaf, Star, ChevronRight
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

  // Calculadora de tempo recuperado
  const [tasksPerDay, setTasksPerDay] = useState(5);
  const [lostTime, setLostTime] = useState(10);
  const [workDays, setWorkDays] = useState(5);

  const hoursPerYear = Math.round((tasksPerDay * lostTime * workDays * 52) / 60);
  const hoursPerMonth = Math.round((tasksPerDay * lostTime * workDays * 4.33) / 60);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleFaq = (index) => setOpenFaq(openFaq === index ? null : index);

  /* ── Reusable small components ─── */
  const TrustBadge = ({ text }) => (
    <span style={{ fontSize: '12.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '5px' }}>
      <Check size={13} color="#10B981" /> {text}
    </span>
  );

  const SectionLabel = ({ color = '#818CF8', children }) => (
    <span style={{ fontSize: '12px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </span>
  );

  const SectionTitle = ({ children, gradient }) => (
    <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: '#FFFFFF', marginTop: '10px', letterSpacing: '-0.02em' }}>
      {children}
    </h2>
  );

  /* ── Data ─── */
  const steps = [
    { icon: Target, label: 'Criar objetivo',      desc: 'Define o que quer alcançar',          color: '#6366F1', grad: 'linear-gradient(135deg,#6366F1,#8B5CF6)' },
    { icon: CheckCircle2, label: 'Criar tarefas',  desc: 'Ações pequenas e executáveis',         color: '#8B5CF6', grad: 'linear-gradient(135deg,#8B5CF6,#C084FC)' },
    { icon: RefreshCw, label: 'Criar hábitos',       desc: 'Rotina diária que consolida',          color: '#C084FC', grad: 'linear-gradient(135deg,#C084FC,#E879F9)' },
    { icon: Clock, label: 'Sessão de foco',     desc: 'Pomodoro integrado e contextual',      color: '#10B981', grad: 'linear-gradient(135deg,#10B981,#34D399)' },
    { icon: Brain, label: 'Coach IA acompanha',        desc: 'Insights reais do seu progresso',      color: '#38BDF8', grad: 'linear-gradient(135deg,#38BDF8,#0EA5E9)' },
    { icon: Leaf, label: 'Planta cresce',       desc: 'Evolução visual da consistência',      color: '#22D3EE', grad: 'linear-gradient(135deg,#22D3EE,#6EE7B7)' },
    { icon: Award, label: 'Pet evolui',          desc: 'Gamificação que motiva de verdade',    color: '#F59E0B', grad: 'linear-gradient(135deg,#F59E0B,#FBBF24)' },
    { icon: TrendingUp, label: 'Você evolui',         desc: 'Estatísticas reais de impacto',        color: '#EC4899', grad: 'linear-gradient(135deg,#EC4899,#F472B6)' }
  ];

  const benefits = [
    { icon: Heart, color: '#818CF8', title: 'Menos ansiedade', desc: 'Tudo organizado em um lugar. Você sabe o que precisa fazer — sem a sensação de estar perdendo algo.' },
    { icon: Target, color: '#10B981', title: 'Clareza total',   desc: 'Cada manhã você sabe exatamente o próximo passo. Sem paralisia por excesso de listas.' },
    { icon: RefreshCw, color: '#38BDF8', title: 'Consistência diária', desc: 'Hábitos e tarefas conectados ao sistema criam ritmo automático. A rotina se consolida sozinha.' },
    { icon: Award, color: '#F59E0B', title: 'Motivação real',  desc: 'Ver sua planta crescer e seu companion evoluir gera motivação genuína — não só checkboxes.' },
    { icon: Zap, color: '#C084FC', title: 'Menos procrastinação', desc: 'Com o Coach IA sugerindo o próximo passo e o timer integrado, começar ficou simples.' },
    { icon: TrendingUp, color: '#EC4899', title: 'Progresso visível', desc: 'Conquistas desbloqueadas, sequências mantidas, metas concluídas. Você sente que evolui.' }
  ];


  const compRows = [
    { f: 'Lista de tarefas',           o: '✅ Sim',             m: '✅ Integrada a objetivos' },
    { f: 'Rastreador de hábitos',      o: '⚠️ Apps separados',  m: '✅ Nativo e conectado' },
    { f: 'Timer Pomodoro',             o: '⚠️ Apps separados',  m: '✅ Com áudio e XP' },
    { f: 'Metas e objetivos',          o: '⚠️ Isolados',        m: '✅ 100% integrado' },
    { f: 'Coach com IA',               o: '❌ Não possui',       m: '✅ Personalizado' },
    { f: 'Gamificação e companion',    o: '❌ Não possui',       m: '✅ Pet + conquistas' },
    { f: 'Ecossistema 100% conectado', o: '❌ Ferramentas isoladas', m: '✅ Tudo trabalha junto' }
  ];

  const faqs = [
    { q: 'O que é o MyFlowDay?', a: 'É um sistema integrado de evolução pessoal que conecta objetivos, tarefas, hábitos, timer Pomodoro, gamificação e IA — tudo em um único ecossistema para gerar progresso consistente.' },
    { q: 'Como o Coach IA funciona?', a: 'Ele analisa sua rotina real: horários de maior foco, hábitos cumpridos, objetivos em atraso — e gera sugestões acionáveis e insights semanais personalizados para você.' },
    { q: 'O que é o companheiro virtual?', a: 'É um avatar dinâmico (planta, pet ou bebê) que cresce de nível à medida que você conclui tarefas e mantém hábitos. É o espelho visual do seu progresso.' },
    { q: 'O app funciona offline?', a: 'Sim. O MyFlowDay usa IndexedDB local para salvar dados. Quando a conexão é restaurada, tudo sincroniza automaticamente com a nuvem via Supabase.' },
    { q: 'Qual a diferença entre Gratuito e Pro?', a: 'O Gratuito já inclui todos os módulos essenciais. O Pro desbloqueia análises avançadas do Coach IA, tendências por horário, companions exclusivos e suporte prioritário.' }
  ];

  const freeFeatures = [
    { text: 'Organize sua rotina (Tarefas)', on: true },
    { text: 'Crie metas e objetivos', on: true },
    { text: 'Rastreamento de hábitos', on: true },
    { text: 'Timer Pomodoro integrado', on: true },
    { text: 'Companion básico', on: true },
    { text: 'Coach IA ilimitado', on: false },
    { text: 'Relatórios e análises inteligentes', on: false }
  ];

  const proFeatures = [
    'Tudo do plano Gratuito',
    'Coach IA ilimitado',
    'Insights diários personalizados',
    'Relatórios de foco completos',
    'Análises de produtividade inteligentes',
    'Companions e avatares exclusivos',
    'Temas exclusivos (Dark/Glow Premium)',
    'Histórico de evolução ilimitado',
    'Acesso antecipado a novidades'
  ];

  const showcaseTabs = [
    { id: 'home',      label: '🏠 Início' },
    { id: 'meudia',   label: '📋 Meu Dia' },
    { id: 'foco',     label: '⏱️ Foco' },
    { id: 'coach',    label: '🧠 Mentor' },
    { id: 'evolucao', label: '📈 Evolução' },
    { id: 'conquistas', label: '🏆 Conquistas' }
  ];

  /* ── Shared inline styles ─── */
  const S = {
    section: (bg) => ({ padding: '48px 24px', background: bg, borderTop: '1px solid rgba(255,255,255,0.03)' }),
    sectionHead: { textAlign: 'center', marginBottom: '36px' },
    ctaBtn: {
      background: 'linear-gradient(135deg,#6366F1 0%,#8B5CF6 100%)',
      color: 'white', fontWeight: 700, fontSize: '15px',
      padding: '15px 32px', borderRadius: '30px', border: 'none',
      cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
      gap: '8px', transition: 'all 0.2s',
      boxShadow: '0 8px 30px rgba(99,102,241,0.35)'
    }
  };

  return (
    <div className="landing-root" style={{ minHeight: '100vh', background: '#07090C', color: '#F8FAFC', fontFamily: 'var(--font-body,"Plus Jakarta Sans",sans-serif)', overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>

      {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
      <header className="landing-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: scrolled ? 'rgba(7,9,12,0.9)' : 'transparent', backdropFilter: scrolled ? 'blur(16px)' : 'none', borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)', padding: scrolled ? '12px 24px' : '20px 24px' }}>
        <Container className="landing-header-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="landing-logo-container" style={{ display: 'flex', alignItems: 'center', height: '56px', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src={logo.src} alt={logo.alt} style={{ height: '56px', width: 'auto', objectFit: 'contain', marginTop: '-4px' }} onError={e => { e.target.style.display = 'none'; }} />
          </div>
          <div className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <a href="#como-funciona" className="nav-link">Como Funciona</a>
            <a href="#beneficios" className="nav-link">Benefícios</a>
            <a href="#comparativo" className="nav-link">Comparação</a>
            <a href="#planos" className="nav-link">Planos</a>
          </div>
          <div className="landing-nav-buttons" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={onEnterApp} className="nav-btn-secondary">Entrar</button>
            <button onClick={onEnterApp} className="nav-btn-primary">Criar Conta</button>
          </div>
        </Container>
      </header>

      {/* ── 1. HERO ─────────────────────────────────────────────────────── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '140px 24px 64px', background: 'radial-gradient(circle 900px at 50% -200px,rgba(99,102,241,0.15) 0%,transparent 80%)', position: 'relative' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>

          {/* Eyebrow */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '99px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', fontSize: '11.5px', fontWeight: 700, color: '#818CF8', marginBottom: '28px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Sparkles size={12} /> Sistema integrado de evolução pessoal
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(34px,5.5vw,66px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.03em', marginBottom: '22px', color: '#FFFFFF', fontFamily: 'var(--font-display,sans-serif)' }}>
            Pare de começar tudo<br />
            <span style={{ background: 'linear-gradient(to right,#818CF8,#C084FC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>e abandonar no meio.</span>
          </h1>

          {/* Sub */}
          <p style={{ fontSize: 'clamp(15px,2vw,19px)', lineHeight: 1.65, color: '#94A3B8', maxWidth: '640px', marginBottom: '36px' }}>
            O MyFlowDay conecta tarefas, hábitos, metas, foco e IA para transformar pequenas ações em evolução real todos os dias.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '18px' }}>
            <button onClick={onEnterApp} className="btn-purple-glow" style={S.ctaBtn}>
              Começar gratuitamente <ArrowRight size={16} />
            </button>
            <button onClick={handleStartDemoMode} style={{ background: 'rgba(255,255,255,0.04)', color: '#F8FAFC', fontWeight: 600, fontSize: '15px', padding: '15px 28px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
              <Play size={14} /> Ver demonstração
            </button>
          </div>

          {/* Trust signals */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '56px' }}>
            {['Gratuito', 'Sem cartão', 'Configuração em 2 minutos'].map((t, i) => <TrustBadge key={i} text={t} />)}
          </div>
        </div>

        {/* Hero Mockup */}
        <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1 }} className="hero-visual-wrapper">
          <div className="flow-lines-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
            <svg width="100%" height="100%" viewBox="0 0 1000 450" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.75 }}>
              <path d="M 230 115 C 320 115, 340 75, 450 75" stroke="rgba(99,102,241,0.2)" strokeWidth="2" strokeDasharray="6 4" />
              <path className="glowing-pulse" d="M 230 115 C 320 115, 340 75, 450 75" stroke="url(#gi)" strokeWidth="3" strokeLinecap="round" />
              <path d="M 590 120 C 650 120, 680 230, 770 230" stroke="rgba(192,132,252,0.2)" strokeWidth="2" strokeDasharray="6 4" />
              <path className="glowing-pulse" d="M 590 120 C 650 120, 680 230, 770 230" stroke="url(#gp)" strokeWidth="3" strokeLinecap="round" />
              <path d="M 770 290 C 680 290, 630 380, 520 380" stroke="rgba(16,185,129,0.2)" strokeWidth="2" strokeDasharray="6 4" />
              <path className="glowing-pulse" d="M 770 290 C 680 290, 630 380, 520 380" stroke="url(#ge)" strokeWidth="3" strokeLinecap="round" />
              <path d="M 400 380 C 330 380, 310 290, 220 290" stroke="rgba(245,158,11,0.2)" strokeWidth="2" strokeDasharray="6 4" />
              <path className="glowing-pulse" d="M 400 380 C 330 380, 310 290, 220 290" stroke="url(#go)" strokeWidth="3" strokeLinecap="round" />
              <path d="M 220 240 C 320 240, 350 200, 480 200" stroke="rgba(56,189,248,0.2)" strokeWidth="2" strokeDasharray="6 4" />
              <path className="glowing-pulse" d="M 220 240 C 320 240, 350 200, 480 200" stroke="url(#gs)" strokeWidth="3" strokeLinecap="round" />
              <defs>
                {[['gi','#6366F1'],['gp','#C084FC'],['ge','#10B981'],['go','#F59E0B'],['gs','#38BDF8']].map(([id,c]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={c} stopOpacity="0" />
                    <stop offset="50%" stopColor={c} stopOpacity="1" />
                    <stop offset="100%" stopColor={c} stopOpacity="0" />
                  </linearGradient>
                ))}
              </defs>
            </svg>
          </div>

          <div className="hero-mockup-grid">
            <div className="mockup-card glass-premium" style={{ gridArea: 'tarefa', borderLeft: '3px solid #6366F1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ backgroundColor: '#6366F1', width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#6366F1', textTransform: 'uppercase' }}>Tarefa Executada</span>
              </div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', margin: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#10B981" /> Ler 10 páginas de psicologia
              </p>
            </div>
            <div className="mockup-card glass-premium" style={{ gridArea: 'objetivo', borderLeft: '3px solid #C084FC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#C084FC', textTransform: 'uppercase' }}>Objetivo Associado</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#C084FC' }}>75%</span>
              </div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px', textAlign: 'left' }}>📚 Ler 12 Livros no Ano</p>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '75%', height: '100%', background: 'linear-gradient(to right,#6366F1,#C084FC)', borderRadius: '3px' }} />
              </div>
            </div>
            <div className="mockup-card glass-premium" style={{ gridArea: 'coach', borderLeft: '3px solid #10B981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Brain size={14} color="#10B981" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase' }}>Coach IA</span>
              </div>
              <p style={{ fontSize: '12px', lineHeight: 1.4, color: '#E2E8F0', margin: 0, textAlign: 'left', fontStyle: 'italic' }}>
                "👉 Você rende melhor à tarde. Bloqueei 20min amanhã às 17h para manter sua sequência de leitura."
              </p>
            </div>
            <div className="mockup-card glass-premium" style={{ gridArea: 'pet', borderLeft: '3px solid #F59E0B' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase' }}>Companheiro</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#F59E0B' }}>Nível 3</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>🌱</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF', textAlign: 'left' }}>Sua Planta cresceu!</div>
                  <div style={{ fontSize: '11px', color: '#10B981', fontWeight: 700, textAlign: 'left' }}>+45 XP de Foco</div>
                </div>
              </div>
            </div>
            <div className="mockup-card glass-premium" style={{ gridArea: 'conquista', borderLeft: '3px solid #38BDF8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Award size={14} color="#38BDF8" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase' }}>Conquista</span>
              </div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 2px', textAlign: 'left' }}>🏆 Devorador de Páginas</p>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, textAlign: 'left' }}>Concluiu 10 tarefas de leitura.</p>
            </div>
            <div className="mockup-card glass-premium" style={{ gridArea: 'insights', borderLeft: '3px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Tendência Semanal</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981' }}>+12% Foco</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '40px', gap: '6px', padding: '0 10px' }}>
                {[30,45,60,50,75,85].map((h, i) => (
                  <div key={i} style={{ height: `${h}%`, width: '100%', background: i === 5 ? 'linear-gradient(to top,#6366F1,#C084FC)' : `rgba(255,255,255,${h/400})`, borderRadius: '2px' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. CALCULADORA DE TEMPO RECUPERADO ───────────────────────────────── */}
      <section id="calculadora" style={S.section('#090D12')}>
        <Container style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={S.sectionHead}>
            <SectionLabel color="#818CF8">Economia Real</SectionLabel>
            <SectionTitle>Descubra quanto tempo você pode recuperar</SectionTitle>
            <p style={{ color: '#94A3B8', fontSize: '15px', maxWidth: '520px', margin: '12px auto 0' }}>
              Pequenos minutos economizados todos os dias se transformam em dezenas de horas por ano.
            </p>
          </div>

          <div className="glass-premium" style={{ padding: '36px', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '36px' }} className="showcase-content-grid">
              
              {/* Form de Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Input 1 */}
                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, color: '#CBD5E1', marginBottom: '8px' }}>
                    <span>Quantas tarefas você faz por dia?</span>
                    <span style={{ color: '#818CF8' }}>{tasksPerDay} tarefas</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={tasksPerDay} 
                    onChange={(e) => setTasksPerDay(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#6366F1', cursor: 'pointer' }}
                  />
                </div>

                {/* Input 2 */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#CBD5E1', marginBottom: '10px' }}>
                    Quanto tempo você perde procurando o que fazer?
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {[5, 10, 15, 20].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setLostTime(t)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          border: lostTime === t ? '1px solid #818CF8' : '1px solid rgba(255,255,255,0.08)',
                          background: lostTime === t ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                          color: lostTime === t ? '#818CF8' : '#CBD5E1',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {t} min
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input 3 */}
                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, color: '#CBD5E1', marginBottom: '8px' }}>
                    <span>Quantos dias por semana você trabalha?</span>
                    <span style={{ color: '#818CF8' }}>{workDays} dias</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="7" 
                    value={workDays} 
                    onChange={(e) => setWorkDays(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#6366F1', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Resultado */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '28px', borderRadius: '16px' }}>
                <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Você pode economizar aproximadamente</span>
                
                <div style={{ margin: '20px 0' }}>
                  <div style={{ fontSize: '38px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.1 }}>
                    <span style={{ background: 'linear-gradient(to right,#818CF8,#C084FC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {hoursPerYear} horas
                    </span>
                  </div>
                  <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>por ano</span>
                  
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#CBD5E1', marginTop: '12px' }}>
                    ou {hoursPerMonth} horas/mês
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace', marginTop: '12px', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    Cálculo: {tasksPerDay} tarefas/dia × {lostTime} min × {workDays} dias/sem × 52 sem = {hoursPerYear}h/ano
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5, margin: '0 0 20px', maxWidth: '280px' }}>
                  Imagine usar esse tempo para estudar, descansar ou concluir seus projetos.
                </p>

                <button 
                  onClick={onEnterApp}
                  className="btn-purple-glow"
                  style={{ ...S.ctaBtn, width: '100%', justifyContent: 'center', padding: '12px 24px', fontSize: '14px' }}
                >
                  Começar a recuperar meu tempo
                </button>
              </div>

            </div>
          </div>
        </Container>
      </section>

      {/* ── 2.5. CREDIBILIDADE (SOCIAL PROOF) ──────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', background: '#07090C', padding: '24px 24px', textAlign: 'center' }}>
        <Container>
          <p style={{ fontSize: '14px', color: '#94A3B8', fontWeight: 600, margin: 0, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Sparkles size={16} color="#818CF8" /> Desenvolvido com base em anos de experiência em Customer Success e produtividade.
          </p>
        </Container>
      </div>

      {/* ── 3. O PROBLEMA ───────────────────────────────────────────────── */}
      <section id="problema" style={S.section('#090D12')}>
        <Container>
          <div style={S.sectionHead}>
            <SectionLabel color="#C084FC">O Grande Problema</SectionLabel>
            <SectionTitle>
              A maioria dos apps organiza.<br />
              O MyFlowDay <span style={{ color: '#818CF8' }}>evolui</span>.
            </SectionTitle>
            <p style={{ color: '#94A3B8', fontSize: '15px', maxWidth: '520px', margin: '12px auto 0' }}>
              Você perde tempo e foco pulando entre ferramentas que não se comunicam e não geram progresso real.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', alignItems: 'stretch' }} className="problem-comparison-grid">
            <div style={{ background: 'rgba(239,68,68,0.02)', border: '1px solid rgba(239,68,68,0.1)', padding: '28px', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FCA5A5', marginBottom: '18px' }}>❌ Sem o MyFlowDay</h3>
              {['Apps separados que não se conversam','Metas esquecidas depois de 2 semanas','Hábitos sem acompanhamento real','IA genérica sem contexto seu','Sem motivação visual de progresso'].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#94A3B8', marginBottom: '9px' }}>
                  <span style={{ color: '#EF4444', fontWeight: 700, flexShrink: 0 }}>✕</span> {t}
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.15)', padding: '28px', borderRadius: '16px', boxShadow: '0 0 40px rgba(99,102,241,0.05)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#818CF8', marginBottom: '18px' }}>✨ Com o MyFlowDay</h3>
              {['Metas, tarefas e hábitos 100% conectados','IA que aprende com sua rotina real','Foco com Pomodoro integrado ao sistema','Gamificação que mantém a motivação','Planta e pet que evoluem com você'].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#CBD5E1', fontWeight: 500, marginBottom: '9px' }}>
                  <span style={{ color: '#10B981', fontWeight: 700, flexShrink: 0 }}>✓</span> {t}
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── 3. COMO FUNCIONA ────────────────────────────────────────────── */}
      <section id="como-funciona" style={S.section('#07090C')}>
        <Container>
          <div style={S.sectionHead}>
            <SectionLabel color="#10B981">Como Funciona</SectionLabel>
            <SectionTitle>Um sistema que te guia do começo ao fim.</SectionTitle>
          </div>
          <div className="steps-flow-container">
            {steps.map((step, i) => {
              const StepIcon = step.icon;
              return (
                <div key={i} className="step-row">
                  <div className="step-num-col">
                    <div className="step-number" style={{ background: step.grad }}>
                      <StepIcon size={20} color="#FFFFFF" />
                    </div>
                  </div>
                  <div className="step-content-card">
                    <h3 style={{ fontSize: '13.5px', fontWeight: 700, color: step.color, marginBottom: '4px' }}>{step.label}</h3>
                    <p style={{ color: '#64748B', fontSize: '12px', margin: 0, lineHeight: 1.4 }}>{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ── 4. DEMONSTRAÇÃO ─────────────────────────────────────────────── */}
      <section id="conheca" style={S.section('#090D12')}>
        <Container>
          <div style={S.sectionHead}>
            <SectionLabel color="#C084FC">Tour Visual</SectionLabel>
            <SectionTitle>
              Veja sua evolução acontecendo<br />
              <span style={{ color: '#818CF8' }}>em tempo real.</span>
            </SectionTitle>
          </div>

          {/* Mini Fluxo Conectado (Live Demo Visual Flow) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '32px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '16px 24px', borderRadius: '16px', maxWidth: '780px', margin: '0 auto 28px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginRight: '6px' }}>Ecossistema Conectado:</span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#FFFFFF', padding: '6px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px' }}>
              <CheckCircle2 size={14} color="#10B981" /> Tarefa concluída
            </div>
            
            <ChevronRight size={14} color="#475569" />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#FFFFFF', padding: '6px 12px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: '8px' }}>
              <Leaf size={14} color="#22D3EE" /> Planta cresce
            </div>
            
            <ChevronRight size={14} color="#475569" />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#FFFFFF', padding: '6px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px' }}>
              <Award size={14} color="#F59E0B" /> Conquista desbloqueada
            </div>
            
            <ChevronRight size={14} color="#475569" />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#FFFFFF', padding: '6px 12px', background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.2)', borderRadius: '8px' }}>
              <TrendingUp size={14} color="#EC4899" /> Evolução aumenta
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '28px' }}>
            {showcaseTabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveShowcaseTab(tab.id)} className={`showcase-tab ${activeShowcaseTab === tab.id ? 'active' : ''}`}>{tab.label}</button>
            ))}
          </div>
          <div style={{ background: '#0F1318', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '28px', minHeight: '360px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            {activeShowcaseTab === 'home' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }} className="showcase-content-grid">
                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginBottom: '12px' }}>Seu painel central de evolução</h3>
                  <p style={{ color: '#94A3B8', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '18px' }}>Tudo que importa em uma tela. Companion, sequência de hábitos, próximas tarefas e insights inteligentes — num design de glassmorphism limpo.</p>
                  <ul className="premium-list">
                    <li><Check size={14} color="#10B981" /> Companion virtual na primeira dobra</li>
                    <li><Check size={14} color="#10B981" /> Quick-add por linguagem natural</li>
                    <li><Check size={14} color="#10B981" /> Indicador de consistência semanal</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '40px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '220px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '72px', animation: 'float-animation 4s ease-in-out infinite', display: 'block' }}>🌱</span>
                    <span style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>Nível 1 — Semente Ativa</span>
                  </div>
                </div>
              </div>
            )}
            {activeShowcaseTab === 'meudia' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }} className="showcase-content-grid">
                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginBottom: '12px' }}>Meu Dia: execução sem ruído</h3>
                  <p style={{ color: '#94A3B8', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '18px' }}>Lista inteligente que destaca o que importa. Sem pop-ups, sem distrações — só você e as tarefas que movem seus objetivos.</p>
                  <ul className="premium-list">
                    <li><Check size={14} color="#10B981" /> Destaques automáticos de prioridade</li>
                    <li><Check size={14} color="#10B981" /> Filtros inteligentes de contexto</li>
                    <li><Check size={14} color="#10B981" /> Interface limpa com ações ocultas</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="mini-task-item"><span className="mini-badge-blue">✨ Recomendada</span> <span>Revisar protótipo de UX</span></div>
                  <div className="mini-task-item"><span className="mini-badge-red">🔥 Crítica</span> <span>Resolver bug de checkout</span></div>
                  <div className="mini-task-item"><span className="mini-badge-orange">⚡ Mantém Sequência</span> <span>Cadastrar relatório diário</span></div>
                </div>
              </div>
            )}
            {activeShowcaseTab === 'foco' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }} className="showcase-content-grid">
                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginBottom: '12px' }}>Foco profundo com Pomodoro</h3>
                  <p style={{ color: '#94A3B8', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '18px' }}>Selecione a tarefa, ative o timer e mergulhe. Sons ambiente integrados e XP ao concluir cada ciclo.</p>
                  <ul className="premium-list">
                    <li><Check size={14} color="#10B981" /> Timer vinculado ao objetivo ativo</li>
                    <li><Check size={14} color="#10B981" /> Mixer de áudio integrado</li>
                    <li><Check size={14} color="#10B981" /> XP e conquistas ao completar</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '30px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                  <div className="foco-briefing-glow">
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', marginBottom: '4px' }}>Missão de Foco</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>25:00</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>Meta: +15 XP</div>
                  </div>
                </div>
              </div>
            )}
            {activeShowcaseTab === 'coach' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }} className="showcase-content-grid">
                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginBottom: '12px' }}>Mentor Inteligente: seu guia pessoal</h3>
                  <p style={{ color: '#94A3B8', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '18px' }}>Diferente de sistemas genéricos, o Mentor aprende com sua rotina real — horários de pico, objetivos em atraso e padrões de hábito.</p>
                  <ul className="premium-list">
                    <li><Check size={14} color="#10B981" /> Análise semanal personalizada</li>
                    <li><Check size={14} color="#10B981" /> Sugestões baseadas no histórico</li>
                    <li><Check size={14} color="#10B981" /> Criação de tarefas por voz natural</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="chat-bubble-showcase">🧠 <b>Mentor:</b> Você rende mais às terças pela manhã. Agendei suas tarefas de "Estudos" nessa janela. Seu objetivo de leitura está 4 dias parado — que tal 10 minutos hoje?</div>
                </div>
              </div>
            )}
            {activeShowcaseTab === 'evolucao' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }} className="showcase-content-grid">
                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginBottom: '12px' }}>Métricas reais de progresso</h3>
                  <p style={{ color: '#94A3B8', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '18px' }}>Consistência diária, sequências de hábitos, objetivos completados e crescimento do companion — tudo em um painel visual.</p>
                  <ul className="premium-list">
                    <li><Check size={14} color="#10B981" /> Consistência e ritmo semanal</li>
                    <li><Check size={14} color="#10B981" /> Progresso de cada objetivo ativo</li>
                    <li><Check size={14} color="#10B981" /> Conquistas e nível do companion</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '30px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '42px', fontWeight: 800, color: '#10B981' }}>85%</div>
                    <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px' }}>Consistência Semanal</div>
                    <div style={{ fontSize: '12px', color: '#6366F1', marginTop: '4px', fontWeight: 600 }}>🔥 12 dias de sequência</div>
                  </div>
                </div>
              </div>
            )}
            {activeShowcaseTab === 'conquistas' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }} className="showcase-content-grid">
                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginBottom: '12px' }}>Gamificação que motiva de verdade</h3>
                  <p style={{ color: '#94A3B8', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '18px' }}>Conquistas desbloqueadas com sons sintetizados, insígnias de raridade e toasts animados. Produtividade ficou divertida.</p>
                  <ul className="premium-list">
                    <li><Check size={14} color="#10B981" /> Medalhas por raridade</li>
                    <li><Check size={14} color="#10B981" /> Áudio via Web Audio API</li>
                    <li><Check size={14} color="#10B981" /> Galeria de conquistas</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ padding: '16px', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
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

      {/* ── 5. BENEFÍCIOS EMOCIONAIS ────────────────────────────────────── */}
      <section id="beneficios" style={S.section('#07090C')}>
        <Container>
          <div style={S.sectionHead}>
            <SectionLabel color="#F59E0B">Transformação Real</SectionLabel>
            <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: '#FFFFFF', marginTop: '10px', letterSpacing: '-0.02em' }}>
              O que muda quando você usa{' '}
              <span style={{ background: 'linear-gradient(to right,#818CF8,#C084FC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>o MyFlowDay</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '14px' }}>
            {benefits.map((b, i) => {
              const BenefitIcon = b.icon;
              return (
                <div key={i} style={{ background: '#0F1318', border: '1px solid rgba(255,255,255,0.04)', padding: '22px', borderRadius: '16px', transition: 'all 0.3s' }} className="benefit-card">
                  <div style={{ marginBottom: '14px', background: `${b.color}15`, width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BenefitIcon size={20} color={b.color} />
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: b.color, marginBottom: '6px' }}>{b.title}</h3>
                  <p style={{ fontSize: '13.5px', color: '#64748B', lineHeight: 1.6, margin: 0 }}>{b.desc}</p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>


      {/* ── 7. COMPARAÇÃO ──────────────────────────────────────────────── */}
      <section id="comparativo" style={S.section('#07090C')}>
        <Container>
          <div style={S.sectionHead}>
            <SectionLabel color="#818CF8">Por que o MyFlowDay</SectionLabel>
            <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: '#FFFFFF', marginTop: '10px', letterSpacing: '-0.02em' }}>
              Outros apps organizam.<br />
              <span style={{ color: '#818CF8' }}>Nós integramos tudo.</span>
            </h2>
          </div>
          <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', background: '#0F1318', maxWidth: '780px', margin: '0 auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '480px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '16px 22px', fontWeight: 700, color: '#FFFFFF', fontSize: '13px' }}>Funcionalidade</th>
                  <th style={{ padding: '16px 22px', fontWeight: 700, color: '#64748B', fontSize: '13px' }}>Outros Apps</th>
                  <th style={{ padding: '16px 22px', fontWeight: 700, color: '#818CF8', fontSize: '13px' }}>MyFlowDay</th>
                </tr>
              </thead>
              <tbody>
                {compRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < compRows.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <td style={{ padding: '14px 22px', fontWeight: 600, color: '#CBD5E1', fontSize: '13.5px' }}>{row.f}</td>
                    <td style={{ padding: '14px 22px', color: row.o.startsWith('✅') ? '#10B981' : row.o.startsWith('⚠️') ? '#F59E0B' : '#EF4444', fontSize: '13px' }}>{row.o}</td>
                    <td style={{ padding: '14px 22px', color: '#10B981', fontWeight: 700, fontSize: '13px' }}>{row.m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      {/* ── 7.5. MANIFESTO / EMOCIONAL ─────────────────────────────────── */}
      <section style={{ ...S.section('#07090C'), textAlign: 'center', padding: '80px 24px' }}>
        <Container style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '99px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', fontSize: '12px', fontWeight: 700, color: '#818CF8', marginBottom: '24px', textTransform: 'uppercase' }}>
            Nossa Filosofia
          </div>
          
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#FFFFFF', marginBottom: '20px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Pequenas ações mudam grandes histórias
          </h2>
          
          <p style={{ fontSize: 'clamp(15px, 2vw, 17px)', color: '#94A3B8', lineHeight: 1.7, marginBottom: '18px' }}>
            A maioria das pessoas não deixa seus objetivos de lado por falta de capacidade. Elas desistem porque perdem consistência.
          </p>
          
          <p style={{ fontSize: 'clamp(15px, 2vw, 17px)', color: '#CBD5E1', lineHeight: 1.7, fontWeight: 500 }}>
            O MyFlowDay foi criado para transformar pequenas ações diárias em progresso visível, ajudando você a construir uma rotina sustentável sem depender apenas de força de vontade.
          </p>
        </Container>
      </section>

      {/* ── 8. PLANOS ──────────────────────────────────────────────────── */}
      <section id="planos" style={S.section('#090D12')}>
        <Container>
          <div style={S.sectionHead}>
            <SectionLabel color="#10B981">Planos</SectionLabel>
            <SectionTitle>Comece grátis. Evolua quando quiser.</SectionTitle>
            <p style={{ color: '#94A3B8', fontSize: '15px', maxWidth: '460px', margin: '12px auto 0' }}>
              O plano gratuito já é completo. O Pro existe para quem quer ir mais fundo.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '780px', margin: '0 auto' }} className="pricing-grid">
            {/* Free */}
            <div className="pricing-card">
              <div style={{ marginBottom: '22px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gratuito</span>
                <div style={{ fontSize: '42px', fontWeight: 800, color: '#FFFFFF', marginTop: '8px', lineHeight: 1 }}>R$0<span style={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>/mês</span></div>
                <p style={{ color: '#64748B', fontSize: '13px', marginTop: '8px', lineHeight: 1.5 }}>Tudo que você precisa para organizar e evoluir.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {freeFeatures.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: f.on ? '#CBD5E1' : 'rgba(100,116,139,0.4)', filter: f.on ? 'none' : 'blur(1px)' }}>
                    <span style={{ color: f.on ? '#10B981' : '#374151', flexShrink: 0, fontWeight: 700 }}>✓</span>
                    {f.text}
                  </div>
                ))}
              </div>
              <button onClick={onEnterApp} className="btn-purple-glow" style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#6366F1 0%,#8B5CF6 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '14.5px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}>
                Começar gratuitamente
              </button>
            </div>
            {/* Pro */}
            <div className="pricing-card pricing-card-pro">
              <div style={{ position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)' }}>
                <span style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#FFFFFF', fontSize: '11px', fontWeight: 700, padding: '4px 18px', borderRadius: '0 0 10px 10px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>⭐ Mais escolhido</span>
              </div>
              <div style={{ marginBottom: '22px', marginTop: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pro</span>
                <div style={{ fontSize: '42px', fontWeight: 800, color: '#FFFFFF', marginTop: '8px', lineHeight: 1 }}>R$14,90<span style={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>/mês</span></div>
                <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '8px', lineHeight: 1.5 }}>Para quem quer o máximo do Coach IA e análises profundas de comportamento.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {proFeatures.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#CBD5E1' }}>
                    <span style={{ color: '#8B5CF6', flexShrink: 0, fontWeight: 700 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <button onClick={onEnterApp} style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#6366F1 0%,#8B5CF6 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '14.5px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}
                onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                onMouseOut={e => { e.currentTarget.style.filter = 'none'; }}>
                Assinar Pro →
              </button>
            </div>
          </div>
        </Container>
      </section>

      {/* ── 9. FAQ ──────────────────────────────────────────────────────── */}
      <section style={S.section('#07090C')}>
        <Container>
          <div style={S.sectionHead}>
            <SectionLabel color="#C084FC">Dúvidas</SectionLabel>
            <SectionTitle>Perguntas frequentes</SectionTitle>
          </div>
          <div style={{ maxWidth: '660px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {faqs.map((item, idx) => (
              <div key={idx} style={{ background: '#0F1318', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => toggleFaq(idx)}>
                <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF' }}>{item.q}</span>
                  <ChevronDown size={17} style={{ transform: openFaq === idx ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: '#94A3B8', flexShrink: 0 }} />
                </div>
                {openFaq === idx && (
                  <div style={{ padding: '0 22px 18px', paddingTop: '12px', fontSize: '14px', lineHeight: 1.65, color: '#94A3B8', borderTop: '1px solid rgba(255,255,255,0.02)' }}>{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── 10. CTA FINAL ───────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px', background: 'linear-gradient(to top,rgba(99,102,241,0.1) 0%,transparent 100%)', textAlign: 'center' }}>
        <Container>
          <div style={{ maxWidth: '660px', margin: '0 auto', background: '#0F1318', border: '1px solid rgba(99,102,241,0.2)', padding: '52px 36px', borderRadius: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at top right,rgba(99,102,241,0.08),transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '26px', marginBottom: '14px' }}>🌱</div>
              <h2 style={{ fontSize: 'clamp(24px,4vw,34px)', fontWeight: 800, color: '#FFFFFF', marginBottom: '14px', letterSpacing: '-0.02em' }}>
                Grandes mudanças começam<br />com pequenas ações.
              </h2>
              <p style={{ color: '#64748B', fontSize: '15px', lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 26px' }}>
                Crie sua conta gratuita e dê o primeiro passo hoje. Sem cartão, sem compromisso.
              </p>
              <button onClick={onEnterApp} className="btn-purple-glow" style={{ ...S.ctaBtn, padding: '16px 40px' }}>
                Começar gratuitamente <ArrowRight size={16} />
              </button>
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
                {['Gratuito para sempre', 'Sem cartão necessário', '2 minutos para começar'].map((t, i) => (
                  <span key={i} style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={12} color="#10B981" /> {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#07090C', padding: '36px 24px', textAlign: 'center' }}>
        <Container style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <img src={logo.src} alt={logo.alt} style={{ height: '36px', width: 'auto' }} />
          <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '520px', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
            <strong>Transformando pequenas ações em grandes evoluções.</strong><br />
            Organize sua rotina. Construa consistência. Evolua todos os dias.
          </p>
          <p style={{ fontSize: '12px', color: '#374151', margin: 0 }}>© 2026 MyFlowDay. Todos os direitos reservados.</p>
        </Container>
      </footer>

      {/* ── CSS GLOBAL ──────────────────────────────────────────────────── */}
      <style>{`
        html { scroll-behavior: smooth; }

        .nav-link { font-size:13.5px; font-weight:600; color:#94A3B8; text-decoration:none; transition:color 0.2s; }
        .nav-link:hover { color:#818CF8 !important; }

        .mini-flow-step {
          transition: all 0.3s ease;
        }
        .mini-flow-step:hover {
          transform: translateY(-2px);
          filter: brightness(1.15);
        }

        .nav-btn-secondary { padding:8px 16px; border-radius:20px; background:transparent; color:#F8FAFC; font-weight:600; font-size:13.5px; cursor:pointer; border:1px solid rgba(255,255,255,0.1); transition:all 0.2s; }
        .nav-btn-secondary:hover { background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.2); }

        .nav-btn-primary { padding:8px 20px; border-radius:20px; background:#6366F1; color:white; font-weight:700; font-size:13.5px; cursor:pointer; border:none; transition:all 0.2s; box-shadow:0 4px 12px rgba(99,102,241,0.25); }
        .nav-btn-primary:hover { background:#4F46E5; box-shadow:0 4px 20px rgba(99,102,241,0.4); }

        .btn-purple-glow:hover { transform:translateY(-2px); filter:brightness(1.1); }

        .hero-mockup-grid {
          display: grid;
          grid-template-areas: "tarefa . insights" "tarefa objetivo insights" "conquista . coach" "conquista pet coach";
          grid-template-columns: 1fr 0.1fr 1.2fr;
          gap: 24px; position: relative; z-index: 1; padding: 20px;
        }
        @media (max-width: 768px) {
          .hero-mockup-grid { grid-template-areas:"tarefa" "objetivo" "insights" "coach" "pet" "conquista"; grid-template-columns:1fr; gap:16px; }
          .flow-lines-container { display:none !important; }
        }

        .glass-premium { background:rgba(15,19,26,0.8); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.05); border-radius:14px; box-shadow:0 8px 32px 0 rgba(0,0,0,0.3); transition:all 0.3s ease; }
        .glass-premium:hover { transform:translateY(-4px); border-color:rgba(255,255,255,0.1); box-shadow:0 12px 40px 0 rgba(99,102,241,0.1); }
        .mockup-card { padding:16px 20px; }

        .glowing-pulse { stroke-dasharray:20 80; animation:draw-pulse 3s linear infinite; }
        @keyframes draw-pulse { from { stroke-dashoffset:100; } to { stroke-dashoffset:0; } }
        @keyframes float-animation { 0% { transform:translateY(0px) rotate(0deg); } 50% { transform:translateY(-10px) rotate(3deg); } 100% { transform:translateY(0px) rotate(0deg); } }

        .steps-flow-container { position:relative; width:100%; padding:20px 0 24px; display:flex; flex-direction:row; gap:18px; overflow-x:auto; scrollbar-width:thin; scrollbar-color:rgba(99,102,241,0.3) transparent; }
        .steps-flow-container::before { content:''; position:absolute; left:45px; right:45px; top:45px; height:2px; background:linear-gradient(90deg,#6366F1 0%,#C084FC 33%,#10B981 66%,#F59E0B 100%); z-index:1; }
        .step-row { display:flex; flex-direction:column; align-items:center; gap:12px; position:relative; z-index:2; min-width:200px; flex:1 0 200px; }
        .step-num-col { display:flex; justify-content:center; align-items:center; z-index:3; }
        .step-number { width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; box-shadow:0 0 20px rgba(99,102,241,0.2); flex-shrink:0; border:3px solid #07090C; }
        .step-content-card { background:#0F1318; border:1px solid rgba(255,255,255,0.04); padding:14px 16px; border-radius:12px; text-align:center; width:100%; box-sizing:border-box; flex:1; }

        .showcase-tab { padding:9px 16px; border-radius:30px; background:rgba(255,255,255,0.02); color:#94A3B8; border:1px solid rgba(255,255,255,0.05); font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; }
        .showcase-tab:hover { color:white; background:rgba(255,255,255,0.05); }
        .showcase-tab.active { background:#6366F1; color:white; border-color:#6366F1; box-shadow:0 4px 15px rgba(99,102,241,0.25); }

        .premium-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:9px; }
        .premium-list li { display:flex; align-items:center; gap:8px; font-size:13.5px; color:#CBD5E1; }

        .mini-task-item { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:11px 14px; border-radius:8px; display:flex; align-items:center; gap:12px; font-size:13px; font-weight:600; color:#E2E8F0; }
        .mini-badge-blue { background:rgba(99,102,241,0.1); color:#818CF8; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:700; }
        .mini-badge-red { background:rgba(239,68,68,0.1); color:#F87171; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:700; }
        .mini-badge-orange { background:rgba(245,158,11,0.1); color:#FBBF24; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:700; }

        .foco-briefing-glow { background:rgba(16,185,129,0.02); border:1px solid rgba(16,185,129,0.15); border-radius:50%; width:140px; height:140px; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 0 30px rgba(16,185,129,0.08); }
        .chat-bubble-showcase { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:14px 16px; border-radius:12px; font-size:12.5px; line-height:1.5; color:#CBD5E1; text-align:left; }

        .benefit-card:hover { border-color:rgba(255,255,255,0.08) !important; transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,0,0,0.3); }

        .pricing-card { background:#0F1318; border:1px solid rgba(255,255,255,0.06); padding:30px; border-radius:20px; position:relative; display:flex; flex-direction:column; }
        .pricing-card-pro { border-color:rgba(99,102,241,0.3); background:linear-gradient(170deg,rgba(99,102,241,0.06) 0%,#0F1318 40%); box-shadow:0 8px 40px rgba(99,102,241,0.1); }

        @media (max-width: 991px) {
          .showcase-content-grid { grid-template-columns:1fr !important; gap:24px; }
          .problem-comparison-grid { grid-template-columns:1fr !important; gap:24px; }
          .pricing-grid { display:flex !important; flex-direction:row !important; overflow-x:auto !important; scroll-snap-type:x mandatory; gap:16px !important; padding-bottom:16px; scroll-behavior:smooth; -webkit-overflow-scrolling:touch; max-width:100% !important; }
          .pricing-grid > .pricing-card { min-width:280px !important; flex:1 0 45% !important; scroll-snap-align:center; }
        }
        @media (max-width: 550px) {
          .pricing-grid > .pricing-card { flex:0 0 85% !important; }
        }
        @media (max-width: 768px) {
          .landing-header { padding:14px 16px !important; }
          .landing-nav-links { display:none !important; }
          .problem-comparison-grid { display:flex !important; flex-direction:row !important; overflow-x:auto !important; scroll-snap-type:x mandatory; gap:16px !important; padding-bottom:16px; -webkit-overflow-scrolling:touch; }
          .problem-comparison-grid > div { min-width:280px !important; flex:0 0 85% !important; scroll-snap-align:center; }
        }
      `}</style>
    </div>
  );
}


