import React from 'react';
import { ArrowLeft, ShieldCheck, Mail, Building2, Eye, Lock, FileText, Database, ShieldAlert, Calendar, Globe } from 'lucide-react';
import { getLogo } from '../design-system/branding/logo';

export default function TermsView({ onGoBack, onNavigateToPrivacy }) {
  // Garantimos que a visualização legal use o padrão escuro/dark theme do MyFlowDay
  const logo = getLogo('dark', 'legal');
  return (
    <div className="dark" style={{ minHeight: '100vh', backgroundColor: '#0F172A', color: '#F8FAFC', fontFamily: 'var(--font-body)', paddingBottom: '60px' }}>
      
      {/* ── Top Header ─────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #334155', padding: '0 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={onGoBack}>
            <img 
              src={logo.src} 
              alt={logo.alt} 
              style={{ height: '36px', width: 'auto', objectFit: 'contain' }} 
            />
          </div>
          
          <button 
            onClick={onGoBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'transparent',
              border: '1px solid #475569',
              borderRadius: '20px',
              padding: '8px 16px',
              color: '#F8FAFC',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            className="app-top-logout-btn"
          >
            <ArrowLeft size={16} />
            <span>Voltar</span>
          </button>
        </div>
      </header>

      {/* ── Hero Banner ────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)', borderBottom: '1px solid #334155', padding: '56px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(34, 211, 238, 0.12)', border: '1px solid rgba(34, 211, 238, 0.3)', borderRadius: '99px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', color: '#22D3EE', textTransform: 'uppercase', marginBottom: '20px' }}>
            <FileText size={12} />
            <span>Contrato de Uso</span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: '#F8FAFC', fontFamily: 'var(--font-display)', marginBottom: '12px', letterSpacing: '-0.5px' }}>
            Termos de Serviço
          </h1>
          <p style={{ fontSize: '15px', color: '#94A3B8', maxWidth: '540px', margin: '0 auto' }}>
            As regras e condições que regem o uso e a prestação do serviço da plataforma MyFlowDay.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '24px', fontSize: '13px', color: '#64748B' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Calendar size={13} /> Vigência: 18 de junho de 2026</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Globe size={13} /> Versão: 1.0</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={13} /> LGPD Compliant</span>
          </div>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        
        {/* Sumário */}
        <nav style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px 24px', marginBottom: '32px' }} aria-label="Sumário">
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748B', marginBottom: '12px' }}>Sumário</div>
          <ol style={{ listStyle: 'decimal', paddingLeft: '20px', color: '#22D3EE', fontSize: '14px', lineHeight: '2' }}>
            <li><a href="#s1" style={{ color: '#22D3EE', textDecoration: 'none' }}>Aceitação dos Termos</a></li>
            <li><a href="#s2" style={{ color: '#22D3EE', textDecoration: 'none' }}>Descrição do Serviço</a></li>
            <li><a href="#s3" style={{ color: '#22D3EE', textDecoration: 'none' }}>Uso Aceitável</a></li>
            <li><a href="#s4" style={{ color: '#22D3EE', textDecoration: 'none' }}>Propriedade Intelectual</a></li>
            <li><a href="#s5" style={{ color: '#22D3EE', textDecoration: 'none' }}>Planos e Assinaturas</a></li>
            <li><a href="#s6" style={{ color: '#22D3EE', textDecoration: 'none' }}>Limitação de Responsabilidade</a></li>
            <li><a href="#s7" style={{ color: '#22D3EE', textDecoration: 'none' }}>Cancelamento e Encerramento</a></li>
            <li><a href="#s8" style={{ color: '#22D3EE', textDecoration: 'none' }}>Contato</a></li>
          </ol>
        </nav>

        {/* Seção 1: Aceitação */}
        <section id="s1" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <Building2 size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 01</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Aceitação dos Termos</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '12px' }}>
            Bem-vindo ao <strong>MyFlowDay</strong>. Ao acessar, instalar ou utilizar a plataforma — seja via navegador web, Progressive Web App (PWA) ou qualquer outro meio de acesso disponibilizado — você declara ter lido, compreendido e concordado integralmente com estes Termos de Serviço.
          </p>
          <div style={{ borderLeft: '3px solid #22D3EE', backgroundColor: 'rgba(34, 211, 238, 0.05)', borderRadius: '0 8px 8px 0', padding: '14px 18px', fontSize: '14px', color: '#22D3EE', fontWeight: '500' }}>
            ⚠️ Se você não concordar com qualquer parte destes termos, por favor, não utilize o MyFlowDay. O uso contínuo da plataforma constitui aceitação tácita destas condições.
          </div>
        </section>

        {/* Seção 2: Descrição */}
        <section id="s2" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <FileText size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 02</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Descrição do Serviço</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '12px' }}>
            O MyFlowDay é uma plataforma de produtividade pessoal que oferece recursos para gerenciar tarefas com priorização, criar metas/objetivos de médio e longo prazo, monitorar sessões de foco (cronômetro Pomodoro) e obter estatísticas semanais.
          </p>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6' }}>
            O aplicativo é fornecido no modelo SaaS (Software as a Service) com sincronização em nuvem e possibilidade de uso offline como PWA.
          </p>
        </section>

        {/* Seção 3: Uso Aceitável */}
        <section id="s3" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <Eye size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 03</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Uso Aceitável</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '12px' }}>
            Você se compromete a utilizar o MyFlowDay exclusivamente para fins legítimos de produtividade pessoal. É estritamente proibido:
          </p>
          <ul style={{ paddingLeft: '20px', color: '#94A3B8', fontSize: '14px', lineHeight: '1.8', marginBottom: '16px' }}>
            <li>Utilizar o aplicativo para fins ilegais, difamatórios ou prejudiciais.</li>
            <li>Tentar violar a segurança ou burlar o controle de dados do Supabase.</li>
            <li>Automatizar acessos (bots, scrapers) abusivos de requisições.</li>
            <li>Engenharia reversa ou descompilação de pacotes do aplicativo.</li>
          </ul>
        </section>

        {/* Seção 4: Propriedade Intelectual */}
        <section id="s4" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <Database size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 04</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Propriedade Intelectual</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '12px' }}>
            Todo o conteúdo original do MyFlowDay (incluindo design, códigos, estrutura lógica, logotipos e ilustrações) é de propriedade exclusiva dos seus criadores originais e protegido por direitos autorais.
          </p>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6' }}>
            Sua licença de uso é pessoal, temporária e não exclusiva. As tarefas e metas criadas por você na plataforma pertencem exclusivamente a você.
          </p>
        </section>

        {/* Seção 5: Planos e Assinaturas */}
        <section id="s5" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <ShieldCheck size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 05</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Planos e Assinaturas</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '12px' }}>
            Oferecemos uma modalidade gratuita básica e uma assinatura Pro (paga e recorrente) para recursos adicionais, tais como histórico completo e metas ilimitadas. A cobrança é feita mensal ou anualmente, sendo renovada automaticamente caso o cancelamento não seja solicitado.
          </p>
        </section>

        {/* Seção 6: Limitação de Responsabilidade */}
        <section id="s6" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <ShieldAlert size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 06</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Limitação de Responsabilidade</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '12px' }}>
            O aplicativo é fornecido <strong>"como está"</strong> (<em>as is</em>), sem garantias de funcionamento ininterrupto, isenção completa de erros ou eficácia absoluta de produtividade. Não nos responsabilizamos por perda de dados resultantes de mau uso ou problemas de conexão do usuário.
          </p>
        </section>

        {/* Seção 7: Cancelamento e Encerramento */}
        <section id="s7" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <Lock size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 07</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Cancelamento e Encerramento</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '12px' }}>
            Você pode cancelar sua assinatura Pro a qualquer momento no menu de configurações do app.
          </p>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6' }}>
            Para encerrar definitivamente sua conta e deletar os dados do Supabase, você pode enviar uma solicitação de exclusão ao nosso canal de atendimento por e-mail.
          </p>
        </section>

        {/* Seção 8: Contato */}
        <section id="s8" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <Mail size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 08</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Fale com a Gente</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '16px' }}>
            Caso tenha qualquer dúvida relacionada a este contrato de serviço, por favor entre em contato:
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '18px 20px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#22D3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F172A', fontWeight: 'bold', fontSize: '18px' }}>HR</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: '#F8FAFC' }}>Hana Oliveira &mdash; Canal Fale com a Gente</div>
              <div style={{ fontSize: '13px', color: '#22D3EE' }}><a href="mailto:suporte@myflowday.com.br" style={{ color: '#22D3EE', textDecoration: 'none' }}>suporte@myflowday.com.br</a></div>
            </div>
          </div>
        </section>

        {/* ── Document Switcher ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div 
            onClick={onNavigateToPrivacy}
            style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px 22px', cursor: 'pointer', transition: 'border-color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#22D3EE'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
          >
            <div style={{ fontSize: '20px' }}>🔒</div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '2px' }}>Leia também</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#F8FAFC' }}>Política de Privacidade</div>
            </div>
            <div style={{ marginLeft: 'auto', color: '#64748B', fontSize: '18px' }}>→</div>
          </div>

          <div style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: '#1E293B', border: '1px solid #22D3EE', borderRadius: '12px', padding: '20px 22px' }}>
            <div style={{ fontSize: '20px' }}>📋</div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#22D3EE', marginBottom: '2px' }}>Você está aqui</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#22D3EE' }}>Termos de Serviço</div>
            </div>
            <div style={{ marginLeft: 'auto', color: '#22D3EE', fontSize: '18px' }}>✓</div>
          </div>
        </div>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid #334155', padding: '40px 24px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
        <p>© 2026 MyFlowDay. Todos os direitos reservados.</p>
        <p style={{ marginTop: '6px' }}>
          <span style={{ cursor: 'pointer', color: '#22D3EE' }} onClick={onGoBack}>Voltar ao Aplicativo</span>
        </p>
      </footer>

    </div>
  );
}
