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
  Play,
  Flame,
  Columns,
  Grid,
  Volume2
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

export default function LandingPage({ onEnterApp }) {
  const { handleStartDemoMode } = useAppContext();
  const [scrolled, setScrolled] = useState(false);
  
  // Estados interativos
  const [activeFeatureTab, setActiveFeatureTab] = useState('dashboard');
  const [lostMinutes, setLostMinutes] = useState(30);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cálculo para o simulador de tempo
  const calculatedHoursLost = Math.round((lostMinutes * 365) / 60);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleLinkClick = (e, path) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

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
      {/* ── HEADER / NAVBAR ────────────────────────────────────────────── */}
      <header
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          background: scrolled ? 'rgba(15, 23, 42, 0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--border-light)' : 'none',
          transition: 'all 0.3s ease',
          padding: '0 24px',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto', height: '76px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px', 
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Flame size={18} color="white" />
            </div>
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>
              MyFlowDay
            </span>
          </div>
          
          <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <a href="#como-funciona" className="nav-link" style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}>Como funciona</a>
            <a href="#recursos" className="nav-link" style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}>Recursos</a>
            <a href="#insights" className="nav-link" style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}>Insights</a>
            <a href="#faq" className="nav-link" style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}>FAQ</a>
            <button onClick={onEnterApp} style={{ padding: '8px 16px', borderRadius: '20px', background: 'transparent', color: 'var(--text-main)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', border: '1px solid var(--border-medium)', transition: 'all 0.2s' }}>Entrar</button>
            <button onClick={onEnterApp} style={{ padding: '8px 18px', borderRadius: '20px', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', border: 'none', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>Criar Conta</button>
          </nav>
        </div>
      </header>

      {/* ── HERO SECTION ────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '130px 24px 40px',
          background: 'radial-gradient(ellipse 85% 65% at 50% 0%, rgba(37, 99, 235, 0.15) 0%, transparent 60%)',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1
            style={{
              fontSize: 'clamp(34px, 5.5vw, 62px)',
              fontWeight: 900,
              letterSpacing: '-1.5px',
              lineHeight: 1.15,
              color: 'var(--text-main)',
              fontFamily: 'var(--font-display)',
              marginBottom: '20px',
            }}
          >
            Organize sua rotina, mantenha o foco e descubra como você produz melhor.
          </h1>

          <p
            style={{
              fontSize: 'clamp(16px, 1.8vw, 19px)',
              color: 'var(--text-muted)',
              maxWidth: '740px',
              lineHeight: 1.55,
              marginBottom: '32px',
              fontWeight: 500
            }}
          >
            O MyFlowDay reúne tarefas, agenda, Pomodoro, Kanban, objetivos e uma Central de Insights que analisa sua rotina para ajudar você a trabalhar com mais foco e menos estresse.
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '24px' }}>
            <button
              onClick={onEnterApp}
              style={{
                padding: '14px 34px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                color: 'white',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
                border: 'none',
                boxShadow: '0 6px 20px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 10px 28px rgba(37, 99, 235, 0.45)'; }}
              onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.35)'; }}
            >
              Criar Conta Gratuita ⚡
            </button>
            <button
              onClick={handleStartDemoMode}
              style={{
                padding: '14px 34px',
                borderRadius: '24px',
                background: 'rgba(255,255,255,0.02)',
                color: 'var(--text-main)',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
                border: '1.5px solid var(--border-medium)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'rgba(37, 99, 235, 0.04)'; }}
              onMouseLeave={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.background = 'rgba(255,255,255,0.02)'; }}
            >
              Ver Demonstração 🎮
            </button>
          </div>

          {/* Indicadores de Confiança */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '12px', color: 'var(--text-light)', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14} color="#10b981" /> 100% Gratuito</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14} color="#10b981" /> Sem cartão de crédito</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14} color="#10b981" /> Funciona Offline</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14} color="#10b981" /> Instala como PWA</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14} color="#10b981" /> Dados protegidos</span>
          </div>
        </div>
      </section>

      {/* ── VEJA O MYFLOWDAY EM AÇÃO (SCREENSHOTS REAIS) ─────────────────── */}
      <section
        style={{
          padding: '80px 24px 60px',
          background: 'var(--bg-app)',
          borderTop: '1px solid var(--border-light)',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1px', marginBottom: '32px' }}>
            Veja o MyFlowDay em ação
          </h2>

          {/* Abas de Screenshots */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '32px' }}>
            {[
              { id: 'dashboard', label: '📊 Dashboard' },
              { id: 'agenda', label: '📅 Agenda' },
              { id: 'kanban', label: '📋 Kanban' },
              { id: 'eisenhower', label: '⚖️ Matriz' },
              { id: 'pomodoro', label: '⏱️ Pomodoro' },
              { id: 'insights', label: '💡 Insights' },
              { id: 'gamification', label: '🌱 Mascote' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFeatureTab(tab.id)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '20px',
                  background: activeFeatureTab === tab.id ? 'var(--primary)' : 'var(--bg-card)',
                  color: activeFeatureTab === tab.id ? 'white' : 'var(--text-muted)',
                  border: '1px solid var(--border-light)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: activeFeatureTab === tab.id ? '0 4px 12px rgba(37,99,235,0.25)' : 'none'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Container da Imagem Real com Benefício */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Texto do Benefício */}
            <div style={{ marginBottom: '20px', textAlign: 'left', padding: '0 8px' }}>
              {activeFeatureTab === 'dashboard' && (
                <p style={{ fontSize: '15px', color: 'var(--text-main)', margin: 0 }}>
                  <strong>Painel Central</strong>: Gerencie seu fluxo diário com clareza. Acompanhe tarefas ordenadas por horário, nível de seu mascote e consistência de hábitos em tempo real.
                </p>
              )}
              {activeFeatureTab === 'agenda' && (
                <p style={{ fontSize: '15px', color: 'var(--text-main)', margin: 0 }}>
                  <strong>Agenda & Planejador Semanal</strong>: Planeje seus compromissos e veja de forma visual as tarefas de cada dia integradas diretamente com suas sequências de hábitos.
                </p>
              )}
              {activeFeatureTab === 'kanban' && (
                <p style={{ fontSize: '15px', color: 'var(--text-main)', margin: 0 }}>
                  <strong>Quadro Kanban</strong>: Divida projetos complexos em etapas visuais simples. Mova cartões de tarefas e organize seu fluxo de trabalho por prioridade cronológica.
                </p>
              )}
              {activeFeatureTab === 'eisenhower' && (
                <p style={{ fontSize: '15px', color: 'var(--text-main)', margin: 0 }}>
                  <strong>Matriz de Eisenhower</strong>: Classifique tarefas por urgência e importância de forma ágil para focar no que realmente gera resultados e eliminar distrações.
                </p>
              )}
              {activeFeatureTab === 'pomodoro' && (
                <p style={{ fontSize: '15px', color: 'var(--text-main)', margin: 0 }}>
                  <strong>Modo Foco Inteligente</strong>: Concentre-se profundamente com o cronômetro Pomodoro integrado a um mixer de sons ambientes de alta fidelidade como chuva, floresta e cafeteria.
                </p>
              )}
              {activeFeatureTab === 'insights' && (
                <p style={{ fontSize: '15px', color: 'var(--text-main)', margin: 0 }}>
                  <strong>Central de Insights Cognitivos</strong>: Descubra quais são os seus dias e horários de maior foco e rendimento com relatórios detalhados baseados no seu uso real.
                </p>
              )}
              {activeFeatureTab === 'gamification' && (
                <p style={{ fontSize: '15px', color: 'var(--text-main)', margin: 0 }}>
                  <strong>Mascote Virtual</strong>: Transforme tarefas concluídas em energia para evoluir a sua plantinha virtual. Um incentivo visual amigável e acolhedor para a consistência diária.
                </p>
              )}
            </div>

            {/* Imagem Real do App */}
            <div style={{
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%'
            }}>
              <img
                src={`/assets/${activeFeatureTab}.png`}
                alt={`Screenshot real do ${activeFeatureTab} do MyFlowDay`}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '520px',
                  objectFit: 'contain',
                  display: 'block'
                }}
                onError={(e) => {
                  e.target.src = "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80";
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── SEÇÃO VÍDEO / VJA COMO FUNCIONA ──────────────────────────────── */}
      <section
        style={{
          padding: '80px 24px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-light)',
          borderBottom: '1px solid var(--border-light)',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1px', marginBottom: '16px' }}>
            Veja como funciona em 20 segundos
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6' }}>
            Acompanhe o fluxo completo desde o planejamento inicial até a entrega de insights sobre a sua rotina:
          </p>

          {/* Placeholder interativo de Vídeo/GIF */}
          <div style={{
            width: '100%',
            aspectRatio: '16/9',
            background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(37,99,235,0.15) 100%)',
            border: '1px solid var(--border-medium)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden'
          }} onClick={onEnterApp}>
            {/* Visual Steps Overlay */}
            <div style={{
              position: 'absolute', bottom: '20px', left: '20px', right: '20px',
              display: 'flex', gap: '8px', justifyContent: 'center', zIndex: 2
            }}>
              {['Criar Tarefa', 'Priorizar', 'Entrar em Foco', 'Concluir', 'Receber Insights', 'Evoluir Pet'].map((step, idx) => (
                <span key={idx} style={{
                  background: 'rgba(15,23,42,0.8)', color: 'var(--text-main)',
                  border: '1px solid var(--border-light)', padding: '4px 10px',
                  borderRadius: '12px', fontSize: '11px', fontWeight: 600
                }}>{step}</span>
              ))}
            </div>
            
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
              transition: 'transform 0.2s', zIndex: 2
            }}
            onMouseEnter={e => e.target.style.transform = 'scale(1.08)'}
            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
            >
              <Play size={24} fill="white" style={{ marginLeft: '4px' }} />
            </div>
            
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '16px', fontWeight: 600, zIndex: 2 }}>
              Toque para abrir a demonstração interativa
            </span>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA (4 ETAPAS CURTAS) ─────────────────────────────── */}
      <section
        id="como-funciona"
        style={{
          padding: '100px 24px',
          background: 'var(--bg-app)',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', marginBottom: '48px' }}>
            Como funciona?
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '32px' }}>
            {[
              { step: '1', title: 'Organize suas tarefas', desc: 'Cadastre tarefas e hábitos. Defina horários e organize tudo na visualização de sua preferência: Lista, Kanban ou Matriz.' },
              { step: '2', title: 'Foque com tranquilidade', desc: 'Ative o Pomodoro com sons ambientes relaxantes de alta fidelidade para entrar no estado de flow profundo.' },
              { step: '3', title: 'Conclua suas atividades', desc: 'Marque como feito para subir a sequência (streaks) de consistência diária e evoluir o mascote do seu painel.' },
              { step: '4', title: 'Entenda seus padrões', desc: 'A Central de Insights cruza seus horários e hábitos concluídos para mostrar as melhores faixas de produtividade de sua mente.' }
            ].map((item, idx) => (
              <div key={idx} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'var(--primary)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 800
                }}>{item.step}</span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{item.title}</h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEÇÃO FUNCIONALIDADES EM BENEFÍCIOS ──────────────────────────── */}
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
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px' }}>
              O que você ganha usando o MyFlowDay?
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
            {[
              {
                title: 'Foco profundo sem cansaço mental',
                desc: 'Entre em estado de foco rapidamente utilizando sessões inteligentes de concentração com Pomodoro e sons ambientes de chuva suave ou cafeteria.',
                icon: <Clock size={22} color="var(--primary)" />
              },
              {
                title: 'Decisões ágeis sobre prioridades',
                desc: 'Organize suas tarefas em poucos segundos usando a Matriz de Eisenhower para delegar ou eliminar o que consome sua atenção.',
                icon: <Target size={22} color="var(--secondary)" />
              },
              {
                title: 'Consistência diária motivadora',
                desc: 'Monitore seus hábitos diários sem punições rígidas. Acompanhe streaks de consistência amigáveis e conquistas na barra lateral.',
                icon: <Award size={22} color="#10b981" />
              },
              {
                title: 'Flexibilidade de planejamento',
                desc: 'Gerencie sua semana por listas clássicas, colunas Kanban ou calendário de compromissos integrado com arrastar-e-soltar.',
                icon: <Calendar size={22} color="#F59E0B" />
              },
              {
                title: 'Rotina livre de interrupções',
                desc: 'Trabalhe offline com salvamento local automático. Seus dados sincronizam de forma segura assim que conectar.',
                icon: <Shield size={22} color="#ef4444" />
              },
              {
                title: 'Autoconhecimento através de estatísticas',
                desc: 'Mapeie o seu ritmo de foco. Descubra quais são os melhores dias e horários da sua produtividade de forma prática.',
                icon: <TrendingUp size={22} color="#a855f7" />
              }
            ].map((feat, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-app)', border: '1px solid var(--border-light)',
                borderRadius: '12px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {feat.icon}
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{feat.title}</h3>
                </div>
                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '48px' }}>
            <button onClick={onEnterApp} style={{ padding: '16px 36px', borderRadius: '24px', background: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
              Organizar Minha Rotina ⚡
            </button>
          </div>
        </div>
      </section>

      {/* ── REFORÇO DA CENTRAL DE INSIGHTS ─────────────────────────────── */}
      <section
        id="insights"
        style={{
          padding: '100px 24px',
          background: 'var(--bg-app)',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>
            DIFERENCIAL INTELIGENTE
          </span>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', marginTop: '8px', marginBottom: '24px' }}>
            A inteligência cognitiva que mapeia seus dados
          </h2>
          <p style={{ fontSize: '15.5px', color: 'var(--text-muted)', maxWidth: '680px', margin: '0 auto 48px', lineHeight: '1.6' }}>
            O grande diferencial do MyFlowDay é analisar silenciosamente seus blocos de foco para gerar alertas amigáveis sobre a sua rotina de trabalho ou estudos.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '40px', alignItems: 'center' }}>
            {/* Imagem Real de Insights */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '16px',
              boxShadow: 'var(--shadow-lg)'
            }}>
              <img
                src="/assets/insights.png"
                alt="Central de Insights cognitivos no aplicativo MyFlowDay"
                style={{ width: '100%', height: 'auto', borderRadius: '8px', objectFit: 'contain' }}
                onError={(e) => {
                  e.target.src = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80";
                }}
              />
            </div>

            {/* Exemplos de Insights */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
              {[
                { title: '💡 Horários de Maior Concentração', desc: '"Você conclui suas tarefas de Alta prioridade 42% mais rápido nas terças-feiras de manhã. Que tal agendar suas tarefas estratégicas para este bloco?"' },
                { title: '🛋️ Prevenção de Estresse', desc: '"Seu rendimento em sessões de foco cai 60% às sextas-feiras após as 15h. Que tal adiar novas tarefas complexas e reservar esse horário para revisões simples?"' },
                { title: '📈 Análise de Estabilidade', desc: '"Você manteve a consistência de foco e hábitos por 5 dias seguidos sem picos de procrastinação. Seu ritmo de rotina está excelente."' }
              ].map((item, idx) => (
                <div key={idx} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                  borderRadius: '10px', padding: '20px', position: 'relative', overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--primary)' }} />
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>{item.title}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>{item.desc}</p>
                </div>
              ))}
              
              <button onClick={onEnterApp} style={{ padding: '14px 28px', borderRadius: '24px', background: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: '13.5px', border: 'none', cursor: 'pointer', alignSelf: 'flex-start', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>
                Descobrir Meu Perfil de Produtividade →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── SIMULADOR DE PRODUTIVIDADE ─────────────────────────────────── */}
      <section
        style={{
          padding: '100px 24px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-light)',
          borderBottom: '1px solid var(--border-light)',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)' }}>
            SIMULE SEU PRODUTO
          </span>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', marginTop: '12px', marginBottom: '16px' }}>
            Quanto tempo você perde por dia?
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6' }}>
            Selecione uma opção de distração média e veja o tempo que você pode resgatar organizando melhor sua rotina:
          </p>

          <div style={{
            background: 'var(--bg-app)', border: '1px solid var(--border-light)',
            borderRadius: '16px', padding: '36px', boxShadow: 'var(--shadow-md)', marginBottom: '32px'
          }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '28px' }}>
              {[15, 30, 45, 60].map(minutes => (
                <button
                  key={minutes}
                  onClick={() => setLostMinutes(minutes)}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '24px',
                    background: lostMinutes === minutes ? 'var(--primary)' : 'rgba(255,255,255,0.02)',
                    color: lostMinutes === minutes ? 'white' : 'var(--text-muted)',
                    border: '1px solid var(--border-light)',
                    fontWeight: 750,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {minutes === 60 ? '1 hora' : `${minutes} minutos`}
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
              <div style={{ fontSize: 'clamp(30px, 4.5vw, 44px)', fontWeight: 900, color: 'var(--secondary)', marginBottom: '8px' }}>
                Você pode recuperar aproximadamente {calculatedHoursLost} horas por ano
              </div>
              <p style={{ fontSize: '14.5px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                Recupere cerca de <strong>{Math.round(calculatedHoursLost / 8)} dias úteis</strong> de trabalho no ano ao otimizar sua rotina e manter o foco profundo com o MyFlowDay.
              </p>
            </div>
          </div>

          <button onClick={onEnterApp} style={{ padding: '16px 38px', borderRadius: '30px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', color: 'white', fontWeight: 800, fontSize: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
            Experimentar Agora ⚡
          </button>
        </div>
      </section>

      {/* ── COMPARATIVO VISUAL ─────────────────────────────────────────── */}
      <section
        style={{
          padding: '100px 24px',
          background: 'var(--bg-app)',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', marginBottom: '48px' }}>
            Por que escolher o MyFlowDay?
          </h2>

          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-light)',
            borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', padding: '20px', borderBottom: '1px solid var(--border-light)', fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
              <span style={{ textAlign: 'left' }}>Recurso</span>
              <span>Aplicativos Comuns</span>
              <span style={{ color: 'var(--primary)' }}>MyFlowDay</span>
            </div>
            
            {[
              { label: 'Organização de Tarefas', comm: 'Listas estáticas de afazeres', flow: 'Organização inteligente + Eisenhower' },
              { label: 'Gestão de Foco', comm: 'Pomodoro isolado sem métricas', flow: 'Pomodoro + Sons ambientes + Insights' },
              { label: 'Planejamento e Agenda', comm: 'Agenda comum', flow: 'Agenda integrada + Streaks de hábitos' },
              { label: 'Estatísticas de Rotina', comm: 'Métricas básicas e frias', flow: 'Central de Insights e padrões de foco' },
              { label: 'Flexibilidade', comm: 'Punidor e engessado', flow: 'Gamificação com pets e ritmo saudável' }
            ].map((row, idx) => (
              <div key={idx} style={{
                display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', padding: '20px',
                borderBottom: idx === 4 ? 'none' : '1px solid var(--border-light)',
                fontSize: '13px', textAlign: 'left', alignItems: 'center'
              }}>
                <strong style={{ color: 'var(--text-main)' }}>{row.label}</strong>
                <span style={{ color: 'var(--text-light)', textAlign: 'center' }}>{row.comm}</span>
                <span style={{ color: 'var(--secondary)', textAlign: 'center', fontWeight: 700 }}>{row.flow}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REPOSICIONAMENTO DA FILOSOFIA ───────────────────────────────── */}
      <section
        style={{
          padding: '100px 24px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-light)',
          borderBottom: '1px solid var(--border-light)',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>
            NOSSOS PRINCÍPIOS
          </span>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', marginTop: '12px', marginBottom: '20px' }}>
            Uma rotina sustentável e consistente
          </h2>
          <p style={{ fontSize: '15.5px', color: 'var(--text-muted)', lineHeight: '1.7', margin: 0 }}>
            Acreditamos que a produtividade duradoura nasce do autoconhecimento, não da culpa. Somos o parceiro ideal para a sua jornada profissional e pessoal. Em vez de apenas registrar pendências, nós ajudamos você a mapear seu foco profundo. Entenda seus limites, proteja seu foco e evolua 1% a cada dia no seu ritmo.
          </p>
        </div>
      </section>

      {/* ── FAQ OTIMIZADO PARA SEO ──────────────────────────────────────── */}
      <section
        id="faq"
        style={{
          padding: '100px 24px',
          background: 'var(--bg-app)'
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>
              SEO E DÚVIDAS
            </span>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1.5px', marginTop: '8px' }}>
              Perguntas Frequentes
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              {
                q: 'O MyFlowDay é gratuito?',
                a: 'Sim, o MyFlowDay é 100% gratuito. Você pode criar tarefas, monitorar hábitos, usar o Pomodoro com sons ambientes e receber relatórios de consistência sem pagar nada.'
              },
              {
                q: 'Funciona no celular? É preciso instalar?',
                a: 'Funciona perfeitamente em computadores, tablets e celulares (iOS e Android). Ele é um PWA (Progressive Web App), ou seja, você pode "instalar" diretamente na tela do seu celular clicando em "Adicionar à Tela de Início" pelo navegador.'
              },
              {
                q: 'Posso usar offline?',
                a: 'Sim! Ele foi construído com arquitetura Offline-First. Você pode gerenciar sua rotina, cadastrar hábitos e rodar o Pomodoro mesmo sem internet (por exemplo, no metrô ou avião). Os dados são guardados localmente e sincronizados de forma segura assim que você conectar.'
              },
              {
                q: 'Tem Pomodoro?',
                a: 'Sim! Possui cronômetro Pomodoro integrado com opções de duração customizáveis e mixer de sons de fundo como chuva, cafeteria e ruído branco para ajudar a manter o foco profundo.'
              },
              {
                q: 'Serve para organizar meus estudos?',
                a: 'Com certeza! É excelente para estudantes. Você pode planejar suas matérias no Kanban, agendar revisões no calendário, usar a técnica Pomodoro e evoluir seu pet virtual enquanto completa seus ciclos de estudo.'
              },
              {
                q: 'Posso organizar meu trabalho corporativo ou projetos?',
                a: 'Sim. É ideal para gerenciar tarefas de trabalho, permitindo priorizar por Matriz de Eisenhower e organizar o fluxo do dia com cartões Kanban de forma flexível e cronológica.'
              },
              {
                q: 'Como funciona a Central de Insights?',
                a: 'A Central de Insights cruza seus dados de conclusão e tempos de foco no Pomodoro para revelar quais são os blocos e dias em que o seu cérebro rende mais, além de sugerir alertas simples contra fadiga.'
              },
              {
                q: 'Qual a diferença para outros aplicativos de produtividade?',
                a: 'Aplicativos comuns apenas empilham tarefas de forma fria. O MyFlowDay integra planner, Kanban, Pomodoro e mascostes evolutivos, focado na consistência sem punição e no autoconhecimento de seus dados.'
              }
            ].map((faq, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                borderRadius: '12px', overflow: 'hidden', transition: 'all 0.3s ease'
              }}>
                <button
                  onClick={() => toggleFaq(idx)}
                  style={{
                    width: '100%', padding: '24px', background: 'transparent', border: 'none',
                    textAlign: 'left', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', cursor: 'pointer', color: 'var(--text-main)',
                    fontWeight: 750, fontSize: '15px'
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ transition: 'transform 0.2s', transform: openFaq === idx ? 'rotate(180deg)' : 'none' }}>
                    <ChevronDown size={18} />
                  </span>
                </button>

                {openFaq === idx && (
                  <div style={{
                    padding: '0 24px 24px 24px', fontSize: '14px', color: 'var(--text-muted)',
                    lineHeight: '1.6', borderTop: '1px solid var(--border-light)', paddingTop: '16px'
                  }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA SECTION ───────────────────────────────────────────── */}
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
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.06), transparent 60%)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 44px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: '20px', fontFamily: 'var(--font-display)' }}>
            Organize sua rotina com foco inteligente
          </h2>
          <p style={{ fontSize: '17px', opacity: 0.9, marginBottom: '40px', maxWidth: '580px', margin: '0 auto 40px', lineHeight: '1.6' }}>
            Entre agora gratuitamente, instale no celular e teste o app em segundos sem precisar cadastrar cartão.
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
              Criar Conta Grátis ⚡
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
              Testar Versão Demo 🎮
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: '48px 24px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-light)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px', 
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Flame size={14} color="white" />
            </div>
            <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '16px' }}>MyFlowDay</span>
          </div>
          
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px', lineHeight: '1.6' }}>
            O gerenciador de tarefas inteligente com Pomodoro, Kanban, Planejador Semanal e Central de Insights integrado.
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
        .nav-link:hover {
          color: var(--primary) !important;
        }
        
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
