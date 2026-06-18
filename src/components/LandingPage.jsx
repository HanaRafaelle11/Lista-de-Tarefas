import React, { useState, useEffect } from 'react';

// ─── Landing Page Pública ─────────────────────────────────────────────────────
export default function LandingPage({ onEnterApp }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const features = [
    {
      icon: '🎯',
      title: 'Tarefas com Propósito',
      desc: 'Organize e priorize suas tarefas diárias com clareza. Foque no que realmente importa para o seu progresso.',
    },
    {
      icon: '🏆',
      title: 'Objetivos que Movem',
      desc: 'Defina metas de médio e longo prazo, acompanhe o progresso e mantenha o foco na sua evolução.',
    },
    {
      icon: '⏱️',
      title: 'Modo Foco Pomodoro',
      desc: 'Sessões cronometradas com sons ambientes para eliminar distrações e maximizar sua concentração.',
    },
    {
      icon: '📈',
      title: 'Evolução Visível',
      desc: 'Relatórios semanais, gráficos de produtividade e conquistas que celebram cada passo da sua jornada.',
    },
    {
      icon: '🧠',
      title: 'Insights Inteligentes',
      desc: 'A Aura, sua assistente de IA, analisa seus padrões e oferece sugestões personalizadas de produtividade.',
    },
    {
      icon: '📱',
      title: 'PWA Responsivo',
      desc: 'Instale como app no seu celular ou use no navegador. Seus dados sincronizam em todos os dispositivos.',
    },
  ];

  const testimonials = [
    {
      text: '"O MyFlowDay mudou minha relação com produtividade. As streaks me motivam a não perder o ritmo."',
      name: 'Ana C.',
      role: 'Designer UX',
    },
    {
      text: '"Finalmente um app de tarefas que entende que produtividade é sobre consistência, não sobre fazer mais."',
      name: 'Rafael M.',
      role: 'Desenvolvedor Full-Stack',
    },
    {
      text: '"O modo foco com sons ambientes é incrível. Consigo entrar em estado de flow em minutos."',
      name: 'Isabela T.',
      role: 'Empreendedora',
    },
  ];

  return (
    <div className="landing-root" style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-main)', fontFamily: 'var(--font-body)' }}>

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          background: scrolled ? 'rgba(var(--bg-app-rgb, 248,250,252), 0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--border-light)' : 'none',
          transition: 'all 0.3s ease',
          padding: '0 24px',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/branding/logo.svg"
              alt="MyFlowDay"
              style={{ height: '32px', width: 'auto' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-main)' }}>
              MyFlowDay
            </span>
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <a
              href="#beneficios"
              style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = 'var(--primary)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
            >
              Benefícios
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
                boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
              }}
              onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(99,102,241,0.45)'; }}
              onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 4px 14px rgba(99,102,241,0.35)'; }}
            >
              Entrar no App
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '120px 24px 80px',
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', top: '10%', left: '5%', width: '300px', height: '300px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08), transparent)',
          filter: 'blur(40px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '5%', width: '250px', height: '250px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.07), transparent)',
          filter: 'blur(40px)', pointerEvents: 'none',
        }} />

        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 16px', borderRadius: '99px',
            background: 'var(--primary-glow, rgba(99,102,241,0.1))',
            border: '1px solid var(--primary-light)',
            fontSize: '13px', fontWeight: 600, color: 'var(--primary)',
            marginBottom: '28px',
            animation: 'fadeSlideIn 0.6s ease both',
          }}
        >
          ✨ Produtividade com Propósito
        </div>

        <h1
          style={{
            fontSize: 'clamp(36px, 6vw, 68px)',
            fontWeight: 900,
            letterSpacing: '-2px',
            lineHeight: 1.05,
            color: 'var(--text-main)',
            fontFamily: 'var(--font-display)',
            maxWidth: '800px',
            marginBottom: '24px',
            animation: 'fadeSlideIn 0.7s 0.1s ease both',
          }}
        >
          Planeje. Execute.{' '}
          <span style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #818cf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Evolua.
          </span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(16px, 2vw, 20px)',
            color: 'var(--text-muted)',
            maxWidth: '560px',
            lineHeight: 1.6,
            marginBottom: '40px',
            animation: 'fadeSlideIn 0.7s 0.2s ease both',
          }}
        >
          O MyFlowDay é sua plataforma de progresso pessoal. Gerencie tarefas, objetivos e sessões de foco em um só lugar — com insights que realmente importam.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeSlideIn 0.7s 0.3s ease both' }}>
          <button
            id="landing-hero-cta"
            onClick={onEnterApp}
            style={{
              padding: '16px 36px',
              borderRadius: '30px',
              background: 'linear-gradient(135deg, var(--primary) 0%, #818cf8 100%)',
              color: 'white',
              fontWeight: 800,
              fontSize: '16px',
              cursor: 'pointer',
              border: 'none',
              boxShadow: '0 8px 28px rgba(99,102,241,0.4)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 36px rgba(99,102,241,0.5)'; }}
            onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 8px 28px rgba(99,102,241,0.4)'; }}
          >
            Começar Gratuitamente ⚡
          </button>
          <a
            href="#beneficios"
            style={{
              padding: '16px 36px',
              borderRadius: '30px',
              background: 'transparent',
              color: 'var(--text-main)',
              fontWeight: 700,
              fontSize: '16px',
              cursor: 'pointer',
              border: '1.5px solid var(--border-medium)',
              transition: 'all 0.2s',
              textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center',
            }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.color = 'var(--primary)'; }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.color = 'var(--text-main)'; }}
          >
            Ver Benefícios →
          </a>
        </div>

        {/* Stats bar */}
        <div
          style={{
            marginTop: '64px',
            display: 'flex', gap: '48px', flexWrap: 'wrap', justifyContent: 'center',
            padding: '24px 32px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            animation: 'fadeSlideIn 0.7s 0.4s ease both',
          }}
        >
          {[
            { value: '100%', label: 'Offline-ready (PWA)' },
            { value: '∞', label: 'Tarefas e objetivos' },
            { value: '6', label: 'Sons ambientes' },
            { value: 'Grátis', label: 'Para começar' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Benefícios ────────────────────────────────────────────────────── */}
      <section
        id="beneficios"
        style={{ padding: '96px 24px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)', display: 'block', marginBottom: '12px' }}>
              Por que o MyFlowDay?
            </span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, letterSpacing: '-1px', color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>
              Tudo que você precisa para{' '}
              <span style={{ color: 'var(--primary)' }}>evoluir de verdade</span>
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '16px', maxWidth: '540px', margin: '16px auto 0' }}>
              Ferramentas de produtividade pessoal reunidas em uma experiência coesa, bonita e eficaz.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
          }}>
            {features.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: '28px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-light)',
                  transition: 'all 0.25s',
                  cursor: 'default',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--primary-light)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.1)';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-light)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: 'var(--primary-glow, rgba(99,102,241,0.1))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', marginBottom: '16px',
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Depoimentos ─────────────────────────────────────────────────── */}
      <section style={{ padding: '96px 24px', background: 'var(--bg-app)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, letterSpacing: '-1px', color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>
              O que dizem nossos usuários
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {testimonials.map((t, i) => (
              <div
                key={i}
                style={{
                  padding: '28px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  display: 'flex', flexDirection: 'column', gap: '16px',
                }}
              >
                <div style={{ fontSize: '28px', color: 'var(--primary)', lineHeight: 1 }}>"</div>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, fontStyle: 'italic', flex: 1 }}>
                  {t.text}
                </p>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>{t.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ──────────────────────────────────────────────────── */}
      <section
        style={{
          padding: '96px 24px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 50%, #818cf8 100%)',
          color: 'white',
        }}
      >
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: '16px', fontFamily: 'var(--font-display)' }}>
          Sua evolução começa agora.
        </h2>
        <p style={{ fontSize: '18px', opacity: 0.85, marginBottom: '40px', maxWidth: '480px', margin: '0 auto 40px' }}>
          Gratuito para começar. Sem cartão de crédito. Acesso imediato.
        </p>
        <button
          id="landing-final-cta"
          onClick={onEnterApp}
          style={{
            padding: '18px 48px',
            borderRadius: '30px',
            background: 'white',
            color: 'var(--primary)',
            fontWeight: 800,
            fontSize: '17px',
            cursor: 'pointer',
            border: 'none',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'; }}
          onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)'; }}
        >
          Criar Conta Grátis ⚡
        </button>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: '40px 24px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-light)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <img src="/branding/logo.svg" alt="MyFlowDay" style={{ height: '24px' }} onError={e => e.target.style.display = 'none'} />
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>MyFlowDay</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>
            Plataforma de Progresso Pessoal · Versão 1.0
          </p>
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}
            >
              Política de Privacidade
            </a>
            <a
              href="/terms.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}
            >
              Termos de Serviço
            </a>
            <a
              href="mailto:suporte@myflowday.app"
              style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}
            >
              suporte@myflowday.app
            </a>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '20px' }}>
            © 2025 MyFlowDay. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
