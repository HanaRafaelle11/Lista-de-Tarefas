import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

const faqs = [
  {
    id: 1,
    question: 'O MyFlowDay é gratuito?',
    answer: 'Sim! O MyFlowDay oferece um plano gratuito completo com tarefas, hábitos, objetivos e insights de produtividade. Um plano Pro com recursos avançados estará disponível em breve para quem quiser ir além.',
  },
  {
    id: 2,
    question: 'Meus dados ficam seguros?',
    answer: 'Absolutamente. Seus dados são armazenados com segurança no Supabase, uma plataforma de banco de dados em nuvem com criptografia em trânsito e em repouso. Você pode exportar ou excluir seus dados a qualquer momento. Para saber mais, consulte nossa Política de Privacidade.',
  },
  {
    id: 3,
    question: 'O que é o "Score de Consistência"?',
    answer: 'É uma pontuação de 0 a 100 que reflete a regularidade das suas atividades nos últimos 7 dias. Ele considera tarefas concluídas, hábitos mantidos e a progressão dos seus objetivos. Quanto mais consistente você for, mais alto é o score — e isso se reflete em insights mais precisos sobre seus padrões de produtividade.',
  },
  {
    id: 4,
    question: 'Como funcionam os Objetivos e as Tarefas vinculadas?',
    answer: 'Objetivos são metas de médio e longo prazo. Você pode vincular tarefas a cada objetivo para acompanhar o progresso automaticamente. Quando você conclui um objetivo com tarefas vinculadas, o MyFlowDay pergunta se deseja marcá-las como concluídas também — evitando inconsistências entre as seções.',
  },
  {
    id: 5,
    question: 'O que são os Insights do MyFlowDay?',
    answer: 'São análises inteligentes geradas automaticamente com base nos seus dados. Eles identificam padrões como seu melhor horário de foco, dias mais produtivos, hábitos em risco e sequências de consistência. Quanto mais você usa o app, mais precisos ficam os insights.',
  },
  {
    id: 6,
    question: 'O app funciona offline?',
    answer: 'Sim! O MyFlowDay é um Progressive Web App (PWA) e pode ser instalado no seu celular ou computador. Você consegue criar tarefas e registrar hábitos mesmo sem conexão — os dados são sincronizados automaticamente quando a internet volta.',
  },
  {
    id: 7,
    question: 'Posso usar o MyFlowDay no celular?',
    answer: 'Sim! O MyFlowDay é responsivo e funciona no navegador do celular. Além disso, você pode instalá-lo como um app nativo via PWA: no Android, acesse o site pelo Chrome e toque em "Adicionar à tela inicial". No iPhone, use o Safari e toque em "Compartilhar" > "Adicionar à Tela Inicial".',
  },
  {
    id: 8,
    question: 'Como posso enviar um feedback ou reportar um problema?',
    answer: 'Adoramos ouvir nossos usuários! Vá em Configurações → "Compartilhe com o MyFlowDay" e nos envie sua mensagem diretamente pelo app. Você também pode abrir uma issue no nosso repositório público no GitHub. Toda sugestão é bem-vinda e lida com atenção.',
  },
  {
    id: 9,
    question: 'O MyFlowDay vai ter mais recursos no futuro?',
    answer: 'Definitivamente! Estamos trabalhando em novas funcionalidades como relatórios avançados, integração com Google Calendar, modo colaborativo para equipes e muito mais. Acompanhe as atualizações pelo app e compartilhe suas ideias — o roadmap do MyFlowDay é construído junto com a comunidade.',
  },
];

function FaqItem({ item }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="faq-item"
      style={{
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${open ? 'var(--primary-light)' : 'var(--border-light)'}`,
        backgroundColor: open ? 'var(--bg-card)' : 'var(--bg-card)',
        overflow: 'hidden',
        transition: 'border-color 0.25s, box-shadow 0.25s',
        boxShadow: open ? 'var(--shadow-md)' : 'var(--shadow-xs)',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          padding: '18px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', lineHeight: '1.4' }}>
          {item.question}
        </span>
        <span style={{ color: 'var(--primary)', flexShrink: 0 }}>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      {open && (
        <div
          className="animate-fade-in"
          style={{ padding: '0 20px 18px', fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.7', borderTop: '1px solid var(--border-light)' }}
        >
          <p style={{ margin: '14px 0 0' }}>{item.answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FaqView() {
  return (
    <div
      style={{
        maxWidth: '760px',
        margin: '0 auto',
        padding: '48px 24px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'var(--primary-glow)',
            marginBottom: '20px',
          }}
        >
          <HelpCircle size={28} style={{ color: 'var(--primary)' }} />
        </div>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: '800',
            color: 'var(--text-main)',
            marginBottom: '10px',
            fontFamily: 'var(--font-display)',
          }}
        >
          Perguntas Frequentes
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto', lineHeight: '1.6' }}>
          Tudo que você precisa saber para aproveitar ao máximo o MyFlowDay.
          Não encontrou o que procurava? Use a seção de feedback nas Configurações.
        </p>
      </div>

      {/* FAQ List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {faqs.map(faq => (
          <FaqItem key={faq.id} item={faq} />
        ))}
      </div>

      {/* Footer CTA */}
      <div
        style={{
          textAlign: 'center',
          padding: '32px 24px',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, var(--primary-glow) 0%, transparent 100%)',
          border: '1px solid var(--primary-light)',
        }}
      >
        <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
          Ainda tem dúvidas?
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '0' }}>
          Vá em <strong>Configurações → Compartilhe com o MyFlowDay</strong> e nos envie sua mensagem. Respondemos pessoalmente! 🙌
        </p>
      </div>
    </div>
  );
}
