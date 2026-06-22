import React, { useMemo, useState, useEffect } from 'react';
import { Sparkles, Brain, Clock, ShieldAlert, Award, ArrowUpRight, Zap, Target } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { generateCoachMessage } from '../intelligence/coachEngine';
import { supabase } from '../supabaseClient';

export default function CoachView() {
  const {
    tasks,
    goals,
    goalTasks,
    habitsManager,
    consistencyScore,
    currentUser,
    setCurrentUser,
    isPro,
    openPaywall,
    logEvent,
    setActiveTab,
    setShouldOpenGoalModal
  } = useAppContext();

  const hasData = goals.length > 0 || tasks.length > 0;

  // Carregar periodicidade preferida das configurações do usuário (user_metadata)
  const [periodicity, setPeriodicity] = useState(() => {
    return currentUser?.user_metadata?.coach_periodicity || 'Semanal';
  });

  const [saving, setSaving] = useState(false);

  // Mensagem do Coach gerada com base nos dados do usuário
  const coachData = useMemo(() => {
    return generateCoachMessage({
      tasks,
      goals,
      goalTasks,
      habitsManager,
      consistencyScore,
      currentUser,
      isPro
    });
  }, [tasks, goals, goalTasks, habitsManager, consistencyScore, currentUser, isPro]);

  // Handler para alterar a periodicidade
  const handlePeriodicityChange = async (newVal) => {
    if (!isPro) {
      openPaywall('coach_periodicity');
      return;
    }
    setPeriodicity(newVal);
    setSaving(true);
    try {
      if (!currentUser.isDemo) {
        const { error } = await supabase.auth.updateUser({
          data: { coach_periodicity: newVal }
        });
        if (error) throw error;
      }
      
      setCurrentUser(prev => ({
        ...prev,
        user_metadata: {
          ...prev.user_metadata,
          coach_periodicity: newVal
        }
      }));
      logEvent('coach_periodicity_changed', { periodicity: newVal });
    } catch (err) {
      console.error('[CoachView] Erro ao atualizar periodicidade:', err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    logEvent('coach_viewed');
  }, [logEvent]);

  return (
    <div className="coach-view-container animate-fade-in" style={{ padding: '24px 0', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="tasks-page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Brain size={24} className="text-primary" /> Coach MyFlowDay
          </h1>
          <p className="tasks-page-subtitle">Seu companheiro rumo à consistência sustentável e evolução pessoal</p>
        </div>
        
        {/* Badge Pro */}
        <div 
          onClick={() => !isPro && openPaywall('coach_header_badge')}
          style={{
            padding: '6px 14px',
            borderRadius: '99px',
            background: isPro ? 'var(--primary-glow)' : 'var(--border-medium)',
            border: isPro ? '1px solid var(--primary)' : '1px solid var(--border-light)',
            color: isPro ? 'var(--primary)' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: '700',
            cursor: !isPro ? 'pointer' : 'default',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          {isPro ? '⚡ Coach Pro Ativo' : '🔒 Desbloquear Coach Pro'}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Letter/Card container */}
        {!hasData ? (
          <div 
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '40px 32px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px'
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, var(--primary), #3b82f6)' }} />
            
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
              marginBottom: '8px'
            }}>
              <Brain size={28} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '750', color: 'var(--text-main)', margin: 0, maxWidth: '520px', lineHeight: '1.4' }}>
              Seu coach ainda não possui informações suficientes para gerar análises.
            </h3>
            
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, maxWidth: '520px', lineHeight: '1.6' }}>
              Crie seus primeiros objetivos e tarefas para começar a receber insights personalizados sobre sua produtividade, consistência e hábitos.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button 
                type="button"
                onClick={() => {
                  setActiveTab('goals');
                  setShouldOpenGoalModal(true);
                }}
                style={{ 
                  padding: '10px 20px', 
                  fontSize: '13.5px', 
                  fontWeight: '600', 
                  borderRadius: '8px', 
                  border: 'none', 
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Target size={16} /> Criar Primeiro Objetivo
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('tasks')}
                style={{ 
                  padding: '10px 20px', 
                  fontSize: '13.5px', 
                  fontWeight: '600', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-medium)', 
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ArrowUpRight size={16} /> Adicionar Tarefa
              </button>
            </div>
          </div>
        ) : (
          <div 
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
            }}
          >
            {/* Decorative subtle top gradient line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, var(--primary), #3b82f6)' }} />
            
            {/* Greeting & Subtitle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                  {isPro ? 'Análise Personalizada da Semana' : 'Resumo Semanal'}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                  Gerado reativamente com base no seu ritmo
                </span>
              </div>
            </div>

            {/* Coach Message content */}
            <div 
              style={{ 
                fontSize: '14.5px', 
                color: 'var(--text-main)', 
                lineHeight: '1.8', 
                whiteSpace: 'pre-line',
                fontFamily: 'inherit',
                padding: '16px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                marginBottom: '24px'
              }}
            >
              {coachData.message}
            </div>

            {/* Positioning text inside the card */}
            <div 
              style={{ 
                fontSize: '12px', 
                color: 'var(--text-muted)', 
                textAlign: 'center',
                borderTop: '1px solid var(--border-light)',
                paddingTop: '20px',
                fontStyle: 'italic'
              }}
            >
              "O MyFlowDay ajuda você a compreender sua própria forma de funcionar e desenvolver uma produtividade mais sustentável."
            </div>
          </div>
        )}

        {/* Periodicity Settings */}
        <div 
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 4px 0' }}>
              Periodicidade das Análises do Coach
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: 0 }}>
              Defina com que frequência você gostaria de receber novas análises.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['Semanal', 'Quinzenal', 'Mensal'].map(p => {
              const active = periodicity === p;
              return (
                <button
                  key={p}
                  onClick={() => handlePeriodicityChange(p)}
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border-medium)'}`,
                    backgroundColor: active ? 'var(--primary-glow)' : 'var(--bg-app)',
                    color: active ? 'var(--primary)' : 'var(--text-light)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Upsell box if Free */}
        {!isPro && (
          <div 
            onClick={() => openPaywall('coach_bottom_upsell')}
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(59, 130, 246, 0.05))',
              border: '1px dashed var(--primary)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Zap size={24} className="text-primary" />
            <div>
              <h4 style={{ fontSize: '14.5px', fontWeight: '750', color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                Desbloqueie o Coach MyFlowDay Pro ⚡
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto', lineHeight: '1.5' }}>
                Inicie hoje sua jornada Pro para habilitar análises comportamentais quinzenais ou mensais profundas, alertas preditivos de estagnação e conselhos de IA totalmente customizados.
              </p>
            </div>
            <button className="btn-primary-glow" style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 'bold' }}>
              Experimentar Pro Grátis
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
