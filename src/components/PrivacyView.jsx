import React from 'react';
import { ArrowLeft, ShieldCheck, Mail, Building2, Eye, Lock, FileText, Database, ShieldAlert, Calendar, Globe } from 'lucide-react';
import { getLogo } from '../design-system/branding/logo';

export default function PrivacyView({ onGoBack, onNavigateToTerms }) {
  // Garantimos que a visualização legal use o padrão escuro/dark theme do MyFlowDay
  const logo = getLogo('dark', 'legal');
  return (
    <div className="dark" style={{ minHeight: '100vh', backgroundColor: '#0F172A', color: '#F8FAFC', fontFamily: 'var(--font-body)', paddingBottom: '60px' }}>
      
      {/* ── Top Header ─────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #334155', padding: '0 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={onGoBack}>
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
            <Lock size={12} />
            <span>Documento Oficial</span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: '#F8FAFC', fontFamily: 'var(--font-display)', marginBottom: '12px', letterSpacing: '-0.5px' }}>
            Política de Privacidade
          </h1>
          <p style={{ fontSize: '15px', color: '#94A3B8', maxWidth: '540px', margin: '0 auto' }}>
            Transparência total sobre como coletamos, usamos e protegemos seus dados pessoais de acordo com a LGPD e Google OAuth.
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
            <li><a href="#s1" style={{ color: '#22D3EE', textDecoration: 'none' }}>Quem somos</a></li>
            <li><a href="#s2" style={{ color: '#22D3EE', textDecoration: 'none' }}>Dados que coletamos</a></li>
            <li><a href="#s3" style={{ color: '#22D3EE', textDecoration: 'none' }}>Como usamos seus dados</a></li>
            <li><a href="#s4" style={{ color: '#22D3EE', textDecoration: 'none' }}>Armazenamento e segurança</a></li>
            <li><a href="#s5" style={{ color: '#22D3EE', textDecoration: 'none' }}>Compartilhamento de dados</a></li>
            <li><a href="#s6" style={{ color: '#22D3EE', textDecoration: 'none' }}>Retenção de dados</a></li>
            <li><a href="#s7" style={{ color: '#22D3EE', textDecoration: 'none' }}>Seus direitos (LGPD)</a></li>
            <li><a href="#s8" style={{ color: '#22D3EE', textDecoration: 'none' }}>Cookies e rastreamento</a></li>
            <li><a href="#s9" style={{ color: '#22D3EE', textDecoration: 'none' }}>Contato</a></li>
          </ol>
        </nav>

        {/* Seção 1: Quem somos */}
        <section id="s1" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <Building2 size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 01</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Quem somos</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '12px' }}>
            O <strong>MyFlowDay</strong> é um aplicativo web de produtividade pessoal que oferece gerenciamento de tarefas, acompanhamento de metas, calendário integrado e modo foco. Ele é projetado para ajudar você a gerenciar sua rotina diária de forma limpa e intuitiva. A controladora dos dados e encarregada pelo tratamento é a <strong>equipe de Privacidade do MyFlowDay</strong>.
          </p>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '16px' }}>
            Este documento rege o tratamento de dados pessoais da nossa plataforma, em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong> e as diretrizes e políticas de conformidade do Google Cloud OAuth 2.0.
          </p>
          <div style={{ borderLeft: '3px solid #22D3EE', backgroundColor: 'rgba(34, 211, 238, 0.05)', borderRadius: '0 8px 8px 0', padding: '14px 18px', fontSize: '14px', color: '#22D3EE', fontWeight: '500' }}>
            Ao utilizar o MyFlowDay e autenticar-se via Google, você aceita integralmente as práticas de privacidade detalhadas neste documento.
          </div>
        </section>

        {/* Seção 2: Dados coletados */}
        <section id="s2" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <Eye size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 02</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Dados que coletamos</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '16px' }}>
            Coletamos apenas informações estritamente necessárias para a prestação do serviço de produtividade. Nosso login com Google OAuth coleta e processa apenas o seu endereço de e-mail, nome e foto de perfil. Garantimos transparência absoluta: não solicitamos, acessamos ou armazenamos qualquer outro dado de sua conta Google, tais como arquivos do Google Drive, contatos ou agendas.
          </p>

          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#94A3B8' }}>Dado</th>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#94A3B8' }}>Origem</th>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#94A3B8' }}>Finalidade</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>Endereço de e-mail</td>
                  <td style={{ padding: '10px' }}><span style={{ backgroundColor: '#1E3A8A', color: '#93C5FD', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>Google OAuth</span></td>
                  <td style={{ padding: '10px', color: '#94A3B8' }}>Identificação única e comunicações sobre o serviço.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>Nome e Foto de Perfil</td>
                  <td style={{ padding: '10px' }}><span style={{ backgroundColor: '#1E3A8A', color: '#93C5FD', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>Google OAuth</span></td>
                  <td style={{ padding: '10px', color: '#94A3B8' }}>Personalização da interface e avatar da conta.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>Dados de Uso e Progresso</td>
                  <td style={{ padding: '10px' }}><span style={{ backgroundColor: '#064E3B', color: '#A7F3D0', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>App Interno</span></td>
                  <td style={{ padding: '10px', color: '#94A3B8' }}>Tarefas, metas, status de assinatura e progresso de produtividade.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Seção 3: Como usamos */}
        <section id="s3" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <FileText size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 03</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Como usamos seus dados</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '12px' }}>
            Seus dados são tratados estritamente para fornecer e melhorar o serviço:
          </p>
          <ul style={{ paddingLeft: '20px', color: '#94A3B8', fontSize: '14px', lineHeight: '1.8', marginBottom: '16px' }}>
            <li>Autenticação de conta via Google OAuth 2.0.</li>
            <li>Sincronização de tarefas e objetivos entre múltiplos dispositivos.</li>
            <li>Exibição de análises e métricas de desempenho diário/semanal.</li>
            <li>Suporte e atendimento ao cliente.</li>
          </ul>
          <div style={{ borderLeft: '3px solid #10B981', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '0 8px 8px 0', padding: '14px 18px', fontSize: '14px', color: '#10B981', fontWeight: '500' }}>
            ✦ Nós nunca utilizamos seus dados pessoais para fins de publicidade, e jamais vendemos ou compartilhamos informações para remarketing comportamental.
          </div>
        </section>

        {/* Seção 4: Armazenamento e segurança */}
        <section id="s4" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <Database size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 04</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Armazenamento e segurança</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '12px' }}>
            Todos os dados coletados são armazenados de forma estruturada e segura na infraestrutura de servidores da plataforma <strong>Supabase</strong>.
          </p>
          <ul style={{ paddingLeft: '20px', color: '#94A3B8', fontSize: '14px', lineHeight: '1.8', marginBottom: '16px' }}>
            <li>Criptografia de dados em trânsito e em repouso.</li>
            <li>Políticas de Row Level Security (RLS) impedem o acesso a dados de outros usuários.</li>
            <li>O acesso às informações administrativas é estritamente limitado aos administradores do serviço.</li>
          </ul>
        </section>

        {/* Seção 5: Compartilhamento */}
        <section id="s5" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <ShieldCheck size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 05</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Compartilhamento de dados</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6' }}>
            <strong>Não vendemos, alugamos ou comercializamos</strong> seus dados sob nenhuma circunstância. Compartilhamos seus dados apenas com provedores de infraestrutura essenciais (Supabase, Google e Vercel) para a correta execução do aplicativo.
          </p>
        </section>

        {/* Seção 6: Retenção */}
        <section id="s6" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <ShieldAlert size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 06</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Retenção de dados</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6' }}>
            Seus dados são retidos na infraestrutura do Supabase enquanto sua conta estiver ativa. Caso decida solicitar a exclusão de sua conta, todos os registros relacionados (e-mail, nome, tarefas e metas) são deletados de forma definitiva e permanente de nossos bancos de dados ativos em até 7 dias úteis.
          </p>
        </section>

        {/* Seção 7: Seus direitos */}
        <section id="s7" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <ShieldCheck size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 07</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Seus direitos (LGPD)</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6' }}>
            De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem total controle sobre suas informações pessoais, incluindo direitos de acesso, retificação, eliminação de dados desnecessários, portabilidade e revogação do consentimento de login a qualquer momento.
          </p>
        </section>

        {/* Seção 8: Cookies */}
        <section id="s8" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <Eye size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 08</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Cookies e rastreamento</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6' }}>
            Utilizamos apenas cookies essenciais e de sessão para manter a autenticação ativa (tokens do Supabase) e o <code>localStorage</code> do seu navegador para guardar preferências locais de interface (como tema claro/escuro). Declaramos explicitamente que não utilizamos cookies de remarketing, publicidade, rastreamento de terceiros ou anúncios.
          </p>
        </section>

        {/* Seção 9: Contato */}
        <section id="s9" style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '32px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <Mail size={24} style={{ color: '#22D3EE' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase' }}>Seção 09</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Contato e Suporte</h2>
            </div>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.6', marginBottom: '16px' }}>
            Para exercer seus direitos de privacidade ou esclarecer dúvidas sobre seus dados, entre em contato direto pelo canal do encarregado:
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '18px 20px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#22D3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F172A', fontWeight: 'bold' }}>
              <Lock size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: '#F8FAFC' }}>Equipe de Privacidade</div>
              <div style={{ fontSize: '13px', color: '#22D3EE' }}><a href="mailto:privacidade@myflowday.com" style={{ color: '#22D3EE', textDecoration: 'none' }}>privacidade@myflowday.com</a></div>
            </div>
          </div>
        </section>

        {/* ── Document Switcher ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: '#1E293B', border: '1px solid #22D3EE', borderRadius: '12px', padding: '20px 22px' }}>
            <div style={{ color: '#22D3EE', display: 'flex', alignItems: 'center' }}>
              <Lock size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#22D3EE', marginBottom: '2px' }}>Você está aqui</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#22D3EE' }}>Política de Privacidade</div>
            </div>
            <div style={{ marginLeft: 'auto', color: '#22D3EE', fontSize: '18px' }}>✓</div>
          </div>
          
          <div 
            onClick={onNavigateToTerms}
            style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px 22px', cursor: 'pointer', transition: 'border-color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#22D3EE'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
          >
            <div style={{ color: '#64748B', display: 'flex', alignItems: 'center' }}>
              <FileText size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '2px' }}>Leia também</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#F8FAFC' }}>Termos de Serviço</div>
            </div>
            <div style={{ marginLeft: 'auto', color: '#64748B', fontSize: '18px' }}>→</div>
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
