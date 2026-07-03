import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, ChevronUp, HelpCircle, ArrowLeft, Search, 
  Rocket, CheckSquare, Target, Flame, Clock, Sparkles, 
  Award, CreditCard, User, Wifi, BookOpen, AlertCircle, CheckCircle2, XCircle, Lightbulb, Compass
} from 'lucide-react';
import { HELP_CATEGORIES, HELP_ARTICLES } from '../data/helpCenterData';

const ICON_MAP = {
  Rocket, CheckSquare, Target, Flame, Clock, Sparkles, 
  Award, CreditCard, User, Wifi, BookOpen
};

function RenderCategoryIcon({ name, size = 18, color = 'currentColor' }) {
  const IconComponent = ICON_MAP[name] || HelpCircle;
  return <IconComponent size={size} style={{ color }} />;
}

function ArticleCard({ article }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        borderRadius: 'var(--radius-md, 12px)',
        border: `1px solid ${open ? 'var(--primary, #10b981)' : 'var(--border-light, rgba(255,255,255,0.08))'}`,
        backgroundColor: 'var(--bg-card, rgba(30,30,38,0.95))',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
        boxShadow: open ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
        marginBottom: '12px'
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
          color: '#ffffff'
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: '17px', fontWeight: '800', fontFamily: 'var(--font-display, sans-serif)', lineHeight: '1.5', color: '#f8fafc' }}>
          {article.title}
        </span>
        <span style={{ color: 'var(--primary, #34d399)', flexShrink: 0 }}>
          {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 20px 24px', fontSize: '15px', color: '#e2e8f0', lineHeight: '1.75', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          
          {/* O que é */}
          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#34d399', marginBottom: '6px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lightbulb size={14} /> O que é
            </h4>
            <p style={{ margin: 0, color: '#f8fafc' }}>{article.whatIs}</p>
          </div>

          {/* Para que serve */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#60a5fa', marginBottom: '6px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={14} /> Para que serve
            </h4>
            <p style={{ margin: 0, color: '#f8fafc' }}>{article.purpose}</p>
          </div>

          {/* Como acessar & usar */}
          <div style={{ marginBottom: '20px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h4 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#fbbf24', marginBottom: '8px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Compass size={14} /> Como Acessar e Utilizar
            </h4>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#f8fafc' }}><strong>Acesso:</strong> {article.howToAccess}</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#f8fafc' }}><strong>Como usar:</strong> {article.howToUse}</p>
          </div>

          {/* Guia de Campos */}
          {article.fieldGuide && article.fieldGuide.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#c084fc', marginBottom: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={14} /> Guia de Preenchimento Correto
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {article.fieldGuide.map((f, idx) => (
                  <div key={idx} style={{ fontSize: '14px', padding: '10px 14px', backgroundColor: 'rgba(168, 85, 247, 0.1)', borderRadius: '6px', borderLeft: '4px solid #c084fc' }}>
                    <strong style={{ color: '#ffffff' }}>Campo {f.field}:</strong> <span style={{ color: '#f8fafc' }}>{f.tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exemplos Práticos */}
          {article.examples && (
            <div style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontSize: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: '800', marginBottom: '6px' }}>
                  <XCircle size={18} /> Exemplo Inadequado
                </div>
                <span style={{ color: '#f8fafc' }}>{article.examples.bad}</span>
              </div>
              <div style={{ padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', fontSize: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: '800', marginBottom: '6px' }}>
                  <CheckCircle2 size={18} /> Exemplo Recomendado
                </div>
                <span style={{ color: '#f8fafc' }}>{article.examples.good}</span>
              </div>
            </div>
          )}

          {/* Dicas e Erros Comuns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: '16px' }}>
            {article.bestPractices && (
              <div style={{ fontSize: '14px', color: '#e2e8f0', fontStyle: 'italic', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lightbulb size={14} style={{ color: '#fbbf24' }} /> <span><strong>Boa Prática:</strong> {article.bestPractices}</span>
              </div>
            )}
            {article.commonErrors && (
              <div style={{ fontSize: '14px', color: '#e2e8f0', fontStyle: 'italic', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={14} style={{ color: '#ef4444' }} /> <span><strong>Erro Comum:</strong> {article.commonErrors}</span>
              </div>
            )}
          </div>

          {/* FAQ Específica */}
          {article.faq && (
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '14px', color: '#34d399' }}>
              <HelpCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> <strong>Dúvida Frequente:</strong> <span style={{ color: '#f8fafc' }}>{article.faq}</span>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default function FaqView({ onGoBack }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const goBack = () => {
    if (onGoBack) {
      onGoBack();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.history.pushState(null, '', '/');
      window.dispatchEvent(new Event('popstate'));
    }
  };

  const filteredArticles = useMemo(() => {
    return HELP_ARTICLES.filter(art => {
      const matchesCat = selectedCategory === 'all' || art.categoryId === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        art.title.toLowerCase().includes(q) || 
        art.whatIs.toLowerCase().includes(q) || 
        art.purpose.toLowerCase().includes(q) ||
        (art.faq && art.faq.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app, #0f172a)', color: '#ffffff' }}>
      {/* Top Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: 'rgba(24, 28, 26, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={goBack}
            aria-label="Voltar"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', fontSize: '13px', fontWeight: '600',
              borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff',
              cursor: 'pointer', transition: 'all 0.15s ease'
            }}
          >
            <ArrowLeft size={16} /> Voltar
          </button>
          <span style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-display, sans-serif)' }}>
            Central de Ajuda & FAQ
          </span>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '32px 16px 80px', boxSizing: 'border-box' }}>
        
        {/* Banner de Boas-Vindas */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '18px', backgroundColor: 'rgba(16, 185, 129, 0.15)', marginBottom: '16px' }}>
            <HelpCircle size={32} style={{ color: 'var(--primary, #10b981)' }} />
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: '800', margin: '0 0 10px 0', fontFamily: 'var(--font-display, sans-serif)' }}>
            Como podemos ajudar você hoje?
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(255, 255, 255, 0.6)', maxWidth: '580px', margin: '0 auto', lineHeight: '1.6' }}>
            Explore o guia completo de funcionalidades, tutoriais de uso, dicas de produtividade e solução para dúvidas de pagamento.
          </p>
        </div>

        {/* Busca Inteligente */}
        <div style={{ position: 'relative', marginBottom: '28px' }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
          <input 
            type="text"
            placeholder="Digite sua dúvida (ex: Pix, Tarefas, Cancelamento, IA, Mascotes)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px 14px 48px',
              backgroundColor: 'rgba(30, 30, 38, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '15px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Navegação por Categorias (Filtros em Carrossel / Grid) */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '32px', scrollbarWidth: 'none' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: '1px solid',
              backgroundColor: selectedCategory === 'all' ? 'var(--primary, #10b981)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: selectedCategory === 'all' ? 'var(--primary, #10b981)' : 'rgba(255, 255, 255, 0.1)',
              color: selectedCategory === 'all' ? '#ffffff' : 'rgba(255, 255, 255, 0.7)'
            }}
          >
            Todas as Categorias
          </button>
          {HELP_CATEGORIES.map(cat => {
            const isSel = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: '1px solid',
                  backgroundColor: isSel ? 'var(--primary, #10b981)' : 'rgba(255, 255, 255, 0.05)',
                  borderColor: isSel ? 'var(--primary, #10b981)' : 'rgba(255, 255, 255, 0.1)',
                  color: isSel ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                  transition: 'all 0.15s ease'
                }}
              >
                <RenderCategoryIcon name={cat.icon} size={16} color={isSel ? '#ffffff' : 'var(--primary, #10b981)'} />
                <span>{cat.title}</span>
              </button>
            );
          })}
        </div>

        {/* Lista de Artigos */}
        <div>
          {filteredArticles.length > 0 ? (
            filteredArticles.map(art => (
              <ArticleCard key={art.id} article={art} />
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <AlertCircle size={36} style={{ color: '#f59e0b', marginBottom: '12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 6px 0' }}>Nenhum artigo encontrado</h3>
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', margin: 0 }}>
                Tente buscar por termos mais genéricos ou selecione outra categoria acima.
              </p>
            </div>
          )}
        </div>

        {/* Footer CTA de Suporte Directo */}
        <div style={{ marginTop: '48px', textAlign: 'center', padding: '32px 24px', borderRadius: '16px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 6px 0', color: '#10b981' }}>
            Ainda precisa de ajuda?
          </h3>
          <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', margin: 0, lineHeight: '1.5' }}>
            Vá em Configurações → Compartilhe com o MyFlowDay e envie sua mensagem que teremos prazer em responder o quanto antes :)
          </p>
        </div>

      </div>
    </div>
  );
}
