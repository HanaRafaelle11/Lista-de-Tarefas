import React, { useMemo, useState, useEffect } from 'react';
import { Target, CheckCircle, Clock, ChevronRight, Award, Plus, Flame, Calendar, Lightbulb, Sparkles, AlertTriangle, BarChart3, Zap, Brain } from 'lucide-react';
import { calcStreak, ACHIEVEMENTS } from '../hooks/useAchievements';
import { useAuraAssistant } from '../hooks/useAuraAssistant';
import AuraAssistantWidget from './AuraAssistantWidget';
import Skeleton from './Skeleton';
import { useAppContext } from '../contexts/AppContext';
import MFIcon from './MFIcon';
import { EVOLUTION_CATEGORIES, EVOLUTION_CATEGORY_LIST } from '../config/evolutionConfig';
import { getEvolutionStage } from '../utils/getEvolutionStage';
import EvolutionStageImage from './EvolutionStageImage';
// Formata data amigável
function formatFriendlyDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${parts[2]} de ${months[parseInt(parts[1]) - 1]}`;
}

// Widget de objetivo individual (linha compacta para a Home)
function GoalProgressRow({ goal, linkedTasks, onClick }) {
  const total = linkedTasks.length;
  const done = linkedTasks.filter(t => t.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="home-goal-row" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="home-goal-row-identity">
        <span className="home-goal-row-title">{goal.title}</span>
      </div>
      <div className="home-goal-row-progress">
        <div className="home-goal-row-track">
          <div
            className="home-goal-row-fill"
            style={{ width: `${pct}%`, backgroundColor: goal.color }}
          />
        </div>
        <span className="home-goal-row-pct" style={{ color: goal.color }}>{pct}%</span>
      </div>
      {total > 0 && (
        <span className="home-goal-row-tasks">{done}/{total}</span>
      )}
    </div>
  );
}

export default function HomeView() {
  const { 
    tasks, 
    goals, 
    goalTasks, 
    currentUser, 
    setActiveTab, 
    unlockedAchievements, 
    habitsManager, 
    consistencyScore, 
    consistencyScoreExplanation,
    handleCompleteOnboarding,
    logEvent,
    insights,
    suggestions,
    setShouldOpenGoalModal,
    isInitializing,
    handleUpdateTask
  } = useAppContext();
  
  const [showHealthExplanation, setShowHealthExplanation] = useState(false);
  
  // Persistent dismiss for "Resumo de Hoje" card (resets daily)
  const todaySummaryKey = `flowday_today_summary_dismissed_${currentUser?.id || 'guest'}_${new Date().toISOString().split('T')[0]}`;
  const [showTodaySummary, setShowTodaySummary] = useState(false);
  const dismissTodaySummary = () => {
    localStorage.setItem(todaySummaryKey, 'true');
    setShowTodaySummary(false);
  };

  useEffect(() => {
    const dismissed = localStorage.getItem(todaySummaryKey) === 'true';
    setShowTodaySummary(!dismissed);
  }, [todaySummaryKey]);
  
  const { habits, habitLogs } = habitsManager;

  const onStartTask = (task) => {
    if (task && task.id) {
      localStorage.setItem('flowday_pomodoro_selected_task_id', task.id);
      setActiveTab('focus');
    } else {
      setActiveTab('tasks');
    }
  };
  const pendingTasks = tasks.filter(t => !t.completed);

  // Lógica de priorização do Hero Card
  const getPriorityTask = () => {
    if (pendingTasks.length === 0) return null;

    const highTasks = pendingTasks.filter(t => t.priority === 'Alta');
    const highWithDate = highTasks.filter(t => t.dueDate);
    if (highWithDate.length > 0) return highWithDate.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    if (highTasks.length > 0) return highTasks[0];

    const medTasks = pendingTasks.filter(t => t.priority === 'Média');
    const medWithDate = medTasks.filter(t => t.dueDate);
    if (medWithDate.length > 0) return medWithDate.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];

    return pendingTasks[0];
  };

  const priorityTask = getPriorityTask();

  // Top 3 objetivos ativos com progresso calculated
  const topGoals = useMemo(() => {
    const activeGoals = goals.filter(g => g.status === 'active');

    return activeGoals
      .map(goal => {
        const linkedIds = goalTasks.filter(gt => gt.goal_id === goal.id).map(gt => gt.task_id);
        const linked = tasks.filter(t => linkedIds.includes(t.id));
        const done = linked.filter(t => t.completed).length;
        const pct = linked.length > 0 ? Math.round((done / linked.length) * 100) : 0;
        return { goal, linkedTasks: linked, pct };
      })
      // Ordenar por progresso decrescente (mais avançados primeiro = mais motivador)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
  }, [goals, goalTasks, tasks]);

  // Estatísticas rápidas
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const activeGoalsCount = goals.filter(g => g.status === 'active').length;
  const completedGoalsCount = goals.filter(g => g.status === 'completed').length;

  // Streak real (calculado via hook)
  const currentStreak = useMemo(() => calcStreak(tasks), [tasks]);
  const unlockedCount = (unlockedAchievements || []).length;

  // Consistência dos últimos 7 dias
  const ritmoSemanal = useMemo(() => {
    const ritmo = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() - i);
      const dayStr = dayDate.toISOString().split('T')[0];

      const count = tasks.filter(t => {
        if (!t.completed) return false;
        const taskDate = t.dueDate || (t.createdAt ? t.createdAt.split('T')[0] : '');
        return taskDate === dayStr;
      }).length;

      const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      ritmo.push({ dayName: weekDays[dayDate.getDay()], dateStr: dayStr, count, isToday: i === 0 });
    }
    return ritmo;
  }, [tasks]);

  const streakDays = currentStreak;
  const auraAnalysis = useAuraAssistant(tasks, goals, goalTasks, currentStreak, unlockedCount);

  // ─── Estado de Onboarding & Pet de Crescimento ───
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [activeHomeTab, setActiveHomeTab] = useState('progresso');
  const [growthPet, setGrowthPet] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('flowday_growth_pet') || 'plant';
    }
    return 'plant';
  });

  const handleSelectGrowthPet = (pet) => {
    setGrowthPet(pet);
    if (typeof window !== 'undefined') {
      localStorage.setItem('flowday_growth_pet', pet);
    }
  };

  const ONBOARDING_TOTAL_STEPS = 5;

  const localOnboardingCompletedKey = `flowday_onboarding_completed_${currentUser?.id || 'guest'}`;
  const onboardingCompleted = !!currentUser?.user_metadata?.onboarding_completed || localStorage.getItem(localOnboardingCompletedKey) === 'true';
  
  const startedKey = `flowday_onboarding_started_${currentUser?.id || 'guest'}`;
  const stepKey = `flowday_onboarding_step_${currentUser?.id || 'guest'}`;

  useEffect(() => {
    if (onboardingCompleted) {
      setOnboardingStep(0);
      return;
    }
    const savedStep = localStorage.getItem(stepKey);
    if (savedStep) {
      setOnboardingStep(Number(savedStep));
      return;
    }
    const hasSeenIntro = localStorage.getItem(startedKey);
    if (!hasSeenIntro) {
      setOnboardingStep(0); // mostra a tela de boas-vindas
    } else {
      setOnboardingStep(1);
    }
  }, [onboardingCompleted, currentUser?.id, startedKey, stepKey]);

  const handleStartOnboarding = () => {
    localStorage.setItem(startedKey, 'true');
    localStorage.setItem(stepKey, '1');
    setOnboardingStep(1);
    logEvent('onboarding_started');
  };

  const handleGoToStep = (step, tab) => {
    localStorage.setItem(stepKey, String(step));
    setOnboardingStep(step);
    if (tab) setActiveTab(tab);
  };

  const handleNextStep = () => {
    logEvent('onboarding_step_completed', { step: onboardingStep });
    const next = onboardingStep + 1;
    if (next <= ONBOARDING_TOTAL_STEPS) {
      localStorage.setItem(stepKey, String(next));
      setOnboardingStep(next);
    } else {
      handleFinishOnboarding();
    }
  };

  const handlePrevStep = () => {
    const prev = onboardingStep - 1;
    if (prev >= 1) {
      localStorage.setItem(stepKey, String(prev));
      setOnboardingStep(prev);
    } else {
      localStorage.removeItem(startedKey);
      localStorage.removeItem(stepKey);
      setOnboardingStep(0);
    }
  };

  const handleFinishOnboarding = () => {
    localStorage.removeItem(stepKey);
    handleCompleteOnboarding(); // Persiste no Supabase Auth metadata
    setOnboardingStep(0);
  };

  const handleAbandonOnboarding = () => {
    logEvent('onboarding_abandoned', { step: onboardingStep });
    handleFinishOnboarding();
  };

  // Cálculo de pendências do Widget "Hoje"
  const getTodayDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayDate = getTodayDateStr();
  const completedHabitsToday = habitLogs.filter(l => l.completed_date === todayDate).length;
  const pendingHabitsCount = Math.max(0, habits.length - completedHabitsToday);

  if (isInitializing) {
    return (
      <div className="home-view-container animate-fade-in" style={{ paddingBottom: '90px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <section style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <Skeleton height="32px" width="200px" />
            <Skeleton height="20px" width="350px" style={{ marginTop: '8px' }} />
          </div>
          <Skeleton height="54px" width="180px" borderRadius="var(--radius-md)" />
        </section>
        
        <Skeleton height="150px" width="100%" borderRadius="var(--radius-lg)" />
        <Skeleton height="180px" width="100%" borderRadius="var(--radius-lg)" />
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          <Skeleton height="250px" width="100%" borderRadius="var(--radius-lg)" />
          <Skeleton height="250px" width="100%" borderRadius="var(--radius-lg)" />
        </div>
      </div>
    );
  }

  return (
    <div className="home-view-container animate-fade-in" style={{ paddingBottom: '90px' }}>

      {/* ── 1. Saudação & Consistency Score (Bloco 3 / 5) ──────────────────── */}
      <section className="home-greeting-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h2 className="home-greeting-title" style={{ fontSize: '24px', fontWeight: '800' }}>
            Olá, {currentUser?.name?.split(' ')[0] || 'usuário'}
          </h2>
          <p className="home-reflection-text" style={{ margin: '4px 0 0' }}>
            "Pequenos passos constroem grandes mudanças. Foque no agora e evolua continuamente."
          </p>
        </div>

        {/* Badge do Score de Consistência */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-glow)', border: '1px solid var(--primary-light)', minWidth: '180px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--primary)' }}>
            <Flame size={28} style={{ color: 'var(--primary)' }} />
          </span>
          <div>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', fontWeight: '700', display: 'block' }}>Score de Consistência</span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>{consistencyScore} <span style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: '500' }}>/ 100</span></span>
          </div>
        </div>
      </section>

      {/* Accordion do Health Score */}
      <div className="health-accordion animate-fade-in" style={{ marginBottom: '24px' }}>
        <button 
          className="health-accordion-header" 
          onClick={() => setShowHealthExplanation(!showHealthExplanation)}
          type="button"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Target size={14} /> Detalhamento do Score</span>
          <span>{showHealthExplanation ? '▲' : '▼'}</span>
        </button>
        {showHealthExplanation && (
          <div className="health-accordion-content animate-fade-in" style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-main)', fontStyle: 'italic', margin: '0 0 6px 0', borderBottom: '1px dashed var(--border-light)', paddingBottom: '8px', lineHeight: '1.4' }}>
                <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '6px' }}><Lightbulb size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#f59e0b' }} /> "{consistencyScoreExplanation.motivationalMessage}"</span>
              </p>
              
              {consistencyScoreExplanation.breakdown && Object.entries(consistencyScoreExplanation.breakdown).map(([key, item]) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: 'var(--text-main)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', color: item.ok ? '#10b981' : 'var(--border-medium)', marginRight: '2px' }}>{item.ok ? <CheckCircle size={13} /> : <div style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1px solid var(--border-medium)' }} />}</span>
                      {item.label}
                    </span>
                    <span style={{ fontWeight: '700', color: item.ok ? 'var(--primary)' : 'var(--text-light)' }}>
                      {item.valueText}
                    </span>
                  </div>
                  <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '6px', width: `${item.pct}%`, backgroundColor: item.ok ? 'var(--primary)' : 'var(--border-medium)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-light)', lineHeight: '1.3' }}>
                    {item.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Widget "Hoje" (Bloco 3 - Seção 8) ─────────────── */}
      {showTodaySummary && (
        <section className="onboarding-card animate-fade-in" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-app) 100%)', border: '1px solid var(--border-medium)', padding: '24px', position: 'relative' }}>
          <button
            onClick={dismissTodaySummary}
            aria-label="Fechar resumo de hoje"
            style={{ position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '28px', height: '28px', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>×</span>
          </button>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Calendar size={18} style={{ color: 'var(--primary)' }} /> Resumo de Hoje
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Aqui está o que você precisa focar hoje para manter sua consistência:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-light)', display: 'block' }}>Tarefas Pendentes</span>
              <span style={{ fontSize: '20px', fontWeight: '800', color: pendingTasks.length > 0 ? 'var(--primary)' : 'var(--text-light)' }}>{pendingTasks.length}</span>
            </div>
            <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-light)', display: 'block' }}>Hábitos Pendentes</span>
              <span style={{ fontSize: '20px', fontWeight: '800', color: pendingHabitsCount > 0 ? '#C89658' : 'var(--text-light)' }}>{pendingHabitsCount}</span>
            </div>
            <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-light)', display: 'block' }}>Objetivos Ativos</span>
              <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>{activeGoalsCount}</span>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('focus')} 
            className="btn-primary-glow"
            style={{ padding: '12px 24px', fontSize: '14px', fontWeight: '600', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            Começar meu dia
          </button>
        </section>
      )}

      {/* O Guia Estático foi removido em favor do Tour Interativo (react-joyride) */}

      {/* ── 2. Hero Card — Prioridade máxima ─────────────── */}
      <section className="home-hero-section">
        <h3 className="home-section-eyebrow">O que realmente importa agora?</h3>

        {priorityTask ? (
          <div className="home-hero-card">
            <div className="home-hero-bg-glow" />
            <div className="home-hero-content-wrapper">
              <div className="home-hero-text-side">
                <div className="home-hero-priority-badge">
                  <Target size={15} />
                  <span>Sua prioridade agora</span>
                </div>

                <h4 className="home-hero-task-title">{priorityTask.title}</h4>

                <div className="home-hero-meta-grid">
                  <div className="home-hero-meta-item">
                    <span className="home-hero-meta-label">Prazo</span>
                    <span className="home-hero-meta-value">
                      {priorityTask.dueDate ? formatFriendlyDate(priorityTask.dueDate) : 'Sem prazo'}
                    </span>
                  </div>
                  <div className="home-hero-meta-item">
                    <span className="home-hero-meta-label">Categoria</span>
                    <span className="home-hero-meta-value">{priorityTask.category}</span>
                  </div>
                  <div className="home-hero-meta-item">
                    <span className="home-hero-meta-label">Prioridade</span>
                    <span className="home-hero-meta-value">{priorityTask.priority}</span>
                  </div>
                </div>

                <button
                  onClick={() => onStartTask(priorityTask)}
                  className="home-hero-action-btn btn-primary-glow"
                >
                  Começar Agora
                </button>
              </div>

              <div className="home-hero-graphic-side">
                <div className="home-graphic-circle">
                  <div className="home-graphic-inner-circle">
                    <MFIcon name="flow-mode" size={32} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="home-hero-empty-card premium-glass" style={{ border: '1px solid var(--border-medium)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)', backdropFilter: 'blur(12px)', borderRadius: 'var(--radius-lg)', padding: '40px 24px', textAlign: 'center' }}>
            <div className="home-hero-empty-glow" />
            <Award size={48} className="home-hero-empty-icon" style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 8px var(--primary-light))', opacity: 0.8 }} />
            <h4 className="home-hero-empty-title" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', margin: '8px 0', fontFamily: 'var(--font-display)' }}>Sua jornada de evolução começa aqui</h4>
            <p className="home-hero-empty-text" style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto 24px', lineHeight: '1.6' }}>
              "Pequenos passos constroem grandes mudanças." <br />
              Comece definindo um objetivo para direcionar seu foco, ou adicione suas primeiras tarefas para criar impulso diário.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button 
                onClick={() => {
                  setShouldOpenGoalModal(true);
                  setActiveTab('goals');
                }}
                className="btn-primary-glow"
                style={{ padding: '10px 20px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Target size={15} />
                + Novo Objetivo
              </button>
              <button 
                onClick={() => setActiveTab('tasks')}
                className="btn-secondary"
                style={{ padding: '10px 20px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'var(--border-medium)', color: 'var(--text-main)' }}
              >
                <Plus size={15} />
                + Nova Tarefa
              </button>
              <button 
                onClick={handleStartOnboarding}
                className="btn-secondary"
                style={{ padding: '10px 20px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', borderColor: 'var(--primary-light)', backgroundColor: 'transparent' }}
              >
                <Sparkles size={15} />
                Guia Rápido
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── 3. Tabs internas para seções secundárias ── */}
      <div className="home-tabs-container" style={{ marginTop: '24px' }}>
        <div className="home-tabs-selector" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-medium)', paddingBottom: '8px', marginBottom: '16px' }}>
          <button 
            type="button"
            onClick={() => setActiveHomeTab('progresso')}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '700',
              borderBottom: activeHomeTab === 'progresso' ? '2.5px solid var(--primary)' : 'none',
              color: activeHomeTab === 'progresso' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MFIcon name="performance" size={16} /> Foco & Progresso
          </button>
          <button 
            type="button"
            onClick={() => setActiveHomeTab('aura')}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '700',
              borderBottom: activeHomeTab === 'aura' ? '2.5px solid var(--primary)' : 'none',
              color: activeHomeTab === 'aura' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MFIcon name="insights" size={16} /> Central de Insights
          </button>
        </div>

        {activeHomeTab === 'progresso' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
             {/* Bloco compacto de Evolução */}
            {(currentStreak > 0 || unlockedCount > 0 || completedGoalsCount > 0) && (
              <section className="home-evo-block">
                <div className="home-section-header">
                  <h3 className="home-section-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MFIcon name="evolution" size={16} /> Sua Evolução
                  </h3>
                  <button onClick={() => setActiveTab('analytics')} className="home-section-link">
                    Ver evolução
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="home-evo-stats-row">
                  {currentStreak > 0 && (
                    <div className="home-evo-stat">
                      <MFIcon name="streak" size={24} style={{ color: 'var(--accent-orange, #f97316)' }} />
                      <div className="home-evo-stat-text">
                        <span className="home-evo-stat-value">{currentStreak} {currentStreak === 1 ? 'dia' : 'dias'}</span>
                        <span className="home-evo-stat-label">seguidos</span>
                      </div>
                    </div>
                  )}
                  {unlockedCount > 0 && (
                    <div className="home-evo-stat">
                      <MFIcon name="achievements" size={24} style={{ color: 'var(--accent-yellow, #eab308)' }} />
                      <div className="home-evo-stat-text">
                        <span className="home-evo-stat-value">{unlockedCount} {unlockedCount === 1 ? 'conquista' : 'conquistas'}</span>
                        <span className="home-evo-stat-label">desbloqueadas</span>
                      </div>
                    </div>
                  )}
                  {completedGoalsCount > 0 && (
                    <div className="home-evo-stat">
                      <MFIcon name="objectives" size={24} style={{ color: 'var(--primary)' }} />
                      <div className="home-evo-stat-text">
                        <span className="home-evo-stat-value">{completedGoalsCount} {completedGoalsCount === 1 ? 'objetivo' : 'objetivos'}</span>
                        <span className="home-evo-stat-label">{completedGoalsCount === 1 ? 'concluído' : 'concluídos'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Widget de Objetivos */}
            <section className="home-goals-section">
              <div className="home-section-header">
                <h3 className="home-section-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MFIcon name="objectives" size={16} /> Objetivos em Andamento
                </h3>
                <button onClick={() => setActiveTab('goals')} className="home-section-link">
                  Ver todos
                  <ChevronRight size={14} />
                </button>
              </div>

              {topGoals.length === 0 ? (
                <div className="home-goals-empty">
                  <div className="home-goals-empty-glow" />
                  <Target size={24} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                  <h4 className="home-goals-empty-title">
                    {goals.length > 0 ? 'Foque em um novo objetivo.' : 'Grandes conquistas começam com um objetivo.'}
                  </h4>
                  <p className="home-goals-empty-desc">
                    {goals.length > 0 
                      ? 'Defina novas metas para continuar evoluindo no MyFlowDay.' 
                      : 'Defina para onde você quer ir e acompanhe seu progresso aqui.'}
                  </p>
                  <button
                    onClick={() => {
                      setShouldOpenGoalModal(true);
                      setActiveTab('goals');
                    }}
                    className="home-goals-empty-cta"
                  >
                    <Plus size={15} />
                    {goals.length > 0 ? 'Criar novo objetivo' : 'Criar meu primeiro objetivo'}
                  </button>
                </div>
              ) : (
                <div className="home-goals-widget">
                  {topGoals.map(({ goal, linkedTasks }) => (
                    <GoalProgressRow
                      key={goal.id}
                      goal={goal}
                      linkedTasks={linkedTasks}
                      onClick={() => setActiveTab('goals')}
                    />
                  ))}

                  {activeGoalsCount > 3 && (
                    <button
                      onClick={() => setActiveTab('goals')}
                      className="home-goals-see-more"
                    >
                      +{activeGoalsCount - 3} objetivo{activeGoalsCount - 3 > 1 ? 's' : ''} •  Ver todos
                    </button>
                  )}
                </div>
              )}
            </section>
            
            {/* Ritmo de Crescimento com Escolha de Pet / Tipo de Crescimento */}
            {(() => {
              const weeklyTotal = ritmoSemanal.reduce((acc, d) => acc + d.count, 0);

              const currentPetData = EVOLUTION_CATEGORIES[growthPet] || EVOLUTION_CATEGORIES.plant;
              const stageIndex = getEvolutionStage({
                weeklyTotal,
                currentStreak,
                completedGoalsCount
              }, currentPetData.stages.length);
              const currentStage = currentPetData.stages[stageIndex];

              return (
                <section className="home-ritmo-section">
                  <div className="home-ritmo-content-side">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      <h4 className="home-ritmo-title" style={{ margin: 0 }}>Seu ritmo de crescimento</h4>
                      
                      {/* Seleção de Pet / Tipo de Crescimento */}
                      <div className="home-ritmo-pets-selector">
                        {EVOLUTION_CATEGORY_LIST.map(pet => (
                          <button
                            key={pet.id}
                            onClick={() => handleSelectGrowthPet(pet.id)}
                            style={{
                              border: 'none',
                              backgroundColor: growthPet === pet.id ? 'var(--primary)' : 'transparent',
                              color: growthPet === pet.id ? '#ffffff' : 'var(--text-light)',
                              borderRadius: '16px',
                              padding: '4px 10px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease',
                              boxShadow: growthPet === pet.id ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                              flexShrink: 0
                            }}
                            title={`Escolher ${pet.name}`}
                          >
                            <span style={{ fontSize: '13px', marginRight: '2px', lineHeight: '1' }}>{pet.emoji}</span>
                            <span>{pet.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div 
                      className="home-ritmo-desc-card animate-fade-in"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '16px',
                        padding: '16px',
                        marginBottom: '16px',
                        boxShadow: 'var(--shadow-sm)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '-20px',
                        right: '-20px',
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: currentStage.color,
                        filter: 'blur(30px)',
                        opacity: 0.15,
                        pointerEvents: 'none'
                      }} />
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', backgroundColor: `${currentStage.color}15`, color: currentStage.color, border: `1px solid ${currentStage.color}30` }}>
                          {currentStage.badge}
                        </span>
                      </div>

                      <p className="home-ritmo-desc" style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-muted)' }}>
                        {currentStage.desc}
                      </p>
                    </div>

                    <div className="home-ritmo-map-container">
                      <span className="ritmo-map-label">Últimos 7 dias:</span>
                      {ritmoSemanal.every(day => day.count === 0) ? (
                        <div 
                          className="home-ritmo-empty-state" 
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: '12px', 
                            padding: '36px 24px', 
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)',
                            borderRadius: '24px', 
                            border: '1px solid var(--border-light)', 
                            marginTop: '12px',
                            textAlign: 'center',
                            width: '100%',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            top: '-50%',
                            left: '-50%',
                            width: '200%',
                            height: '200%',
                            background: `radial-gradient(circle, ${currentStage.color}05 0%, transparent 70%)`,
                            pointerEvents: 'none',
                            zIndex: 0
                          }} />
                          <div 
                            className="home-ritmo-empty-illustration" 
                            style={{ 
                              position: 'relative', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              width: '64px', 
                              height: '64px', 
                              borderRadius: '50%', 
                              background: `${currentStage.color}15`, 
                              color: currentStage.color, 
                              marginBottom: '8px',
                              boxShadow: `0 0 20px ${currentStage.color}20`,
                              border: `1px solid ${currentStage.color}30`,
                              zIndex: 2
                            }}
                          >
                            <span style={{ fontSize: '28px', zIndex: 2 }}>{currentPetData.emoji}</span>
                            <div style={{ 
                              position: 'absolute', 
                              width: '100%', 
                              height: '100%', 
                              borderRadius: '50%', 
                              border: `1px solid ${currentStage.color}40`, 
                              animation: 'ping-animation 2s cubic-bezier(0, 0, 0.2, 1) infinite' 
                            }} />
                          </div>
                          <h4 style={{ fontSize: '15px', color: 'var(--text-main)', margin: 0, fontWeight: '700', fontFamily: 'var(--font-display)', zIndex: 2 }}>
                            Comece hoje sua sequência
                          </h4>
                          <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: '0 0 8px 0', maxWidth: '280px', lineHeight: '1.4', zIndex: 2 }}>
                            De acordo com a sua constância na conclusão de tarefas e objetivos, seu {currentPetData.name.toLowerCase()} vai evoluindo!
                          </p>
                          <button 
                            onClick={() => setActiveTab('tasks')}
                            style={{
                              background: 'var(--primary)',
                              color: '#ffffff',
                              border: 'none',
                              padding: '10px 20px',
                              borderRadius: '99px',
                              fontSize: '12.5px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                              zIndex: 2
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.3)';
                            }}
                          >
                            <span>Ver Minhas Tarefas</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="home-ritmo-dots-row">
                          {ritmoSemanal.map(day => {
                            let colorClass = 'dot-level-0';
                            if (day.count === 1) colorClass = 'dot-level-1';
                            else if (day.count === 2) colorClass = 'dot-level-2';
                            else if (day.count >= 3) colorClass = 'dot-level-3';
                            return (
                              <div key={day.dateStr} className="home-ritmo-dot-item" title={`${day.count} tarefas em ${day.dayName}`}>
                                <div className={`ritmo-dot ${colorClass} ${day.isToday ? 'today-dot' : ''}`} />
                                <span className="ritmo-dot-day-name">{day.dayName}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="home-ritmo-graphic-side">
                    <div className="home-ritmo-wave-container">
                      <div className="wave wave-1" />
                      <div className="wave wave-2" />
                      <div className="wave wave-3" />
                      <EvolutionStageImage
                        asset={currentStage.asset}
                        alt={currentStage.alt}
                        color={currentStage.color}
                        animationKey={`${growthPet}-${stageIndex}`}
                      />
                      <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)', padding: '2px 8px', borderRadius: '10px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', zIndex: 2, marginTop: '4px' }}>{currentStage.title}</span>
                    </div>
                  </div>
                </section>
              );
            })()}

          </div>
        )}

        {activeHomeTab === 'aura' && (() => {
          const hasNoData = tasks.filter(t => !t.deletedAt).length === 0 && (habits || []).length === 0 && goals.filter(g => !g.deletedAt).length === 0;
          if (hasNoData) {
            return (
              <div 
                className="animate-fade-in" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-sm)',
                  gap: '16px',
                  marginTop: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--primary)' }}><Lightbulb size={48} /></div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                  Você ainda não possui dados suficientes.
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0, maxWidth: '400px', lineHeight: '1.6' }}>
                  Crie tarefas, hábitos ou objetivos para receber insights.
                </p>
              </div>
            );
          }
          return (
             <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Coach MyFlowDay */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <AuraAssistantWidget 
                  analysis={auraAnalysis} 
                  onActionClick={(task, actionType) => {
                    if (actionType === 'today') {
                      const todayStr = new Date().toISOString().split('T')[0];
                      handleUpdateTask(task.id, { dueDate: todayStr });
                    } else if (actionType === 'tomorrow') {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const tomorrowStr = tomorrow.toISOString().split('T')[0];
                      handleUpdateTask(task.id, { dueDate: tomorrowStr });
                    } else {
                      onStartTask(task);
                    }
                  }} 
                />
                <button
                  onClick={() => setActiveTab('coach')}
                  className="btn-secondary"
                  style={{
                    alignSelf: 'flex-start',
                    padding: '8px 16px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '-16px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-main)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    zIndex: 1
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
                >
                  <Brain size={14} className="text-primary" /> Conversar com seu Coach MyFlowDay
                </button>
              </div>

              {/* Sugestões de Engajamento */}
              {suggestions && suggestions.length > 0 && (
                <section className="engagement-suggestions-section animate-fade-in">
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} style={{ color: 'var(--primary)' }} /> Sugestões recomendadas para você
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {suggestions.map((sug) => (
                      <div 
                        key={sug.id} 
                        className="suggestion-card-premium" 
                        style={{ 
                          padding: '16px', 
                          borderRadius: 'var(--radius-md)', 
                          backgroundColor: 'var(--bg-card)', 
                          border: '1px solid var(--border-medium)',
                          boxShadow: 'var(--shadow-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div>
                          <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 6px' }}>
                            {sug.title}
                          </h4>
                          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                            {sug.message}
                          </p>
                        </div>
                        {sug.ctaText && (
                          <button 
                            onClick={() => {
                              if (sug.actionTab) setActiveTab(sug.actionTab);
                              if (sug.id === 'onboarding_guided_loop' || sug.id === 'onboarding_loop') {
                                localStorage.setItem(startedKey, 'true');
                                localStorage.setItem(stepKey, '1');
                                setOnboardingStep(1);
                                logEvent('onboarding_started');
                              }
                            }} 
                            className="btn-primary-glow"
                            style={{ 
                              alignSelf: 'flex-start',
                              padding: '8px 16px', 
                              fontSize: '12px', 
                              fontWeight: '600', 
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            {sug.ctaText}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Insights Comportamentais Inteligentes */}
              {(!insights || insights.length === 0) ? (
                <section className="behavioral-insights-section animate-fade-in">
                  <div 
                    style={{ 
                      background: 'var(--bg-card)', 
                      border: '1px dashed var(--border-medium)', 
                      borderRadius: 'var(--radius-md)', 
                      padding: '24px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px'
                    }}
                  >
                    <div style={{ color: 'var(--accent-yellow, #eab308)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lightbulb size={32} />
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                      Você ainda não possui dados suficientes.
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, maxWidth: '350px', lineHeight: '1.6' }}>
                      Crie tarefas, hábitos ou objetivos para receber insights.
                    </p>
                  </div>
                </section>
              ) : (() => {
                const insightIconMap = {
                  'chart': <MFIcon name="chart" size={18} color="var(--primary)" />,
                  'warning': <MFIcon name="warning" size={18} color="#ef4444" />,
                  'fire': <MFIcon name="fire" size={18} color="#f59e0b" />,
                  'bolt': <MFIcon name="bolt" size={18} color="var(--primary)" />,
                  'calendar': <MFIcon name="calendar" size={18} color="var(--primary)" />,
                  'trophy': <MFIcon name="trophy" size={18} color="#eab308" />,
                  'bulb': <MFIcon name="bulb" size={18} color="#eab308" />,
                };
                return (
                  <section className="behavioral-insights-section animate-fade-in">
                    <div 
                      style={{ 
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%)', 
                        border: '1px solid var(--primary-light)', 
                        borderRadius: 'var(--radius-md)', 
                        padding: '20px' 
                      }}
                    >
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={16} style={{ color: 'var(--primary)' }} /> Insights do MyFlowDay
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {insights.map((ins, idx) => (
                          <div 
                            key={idx} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'flex-start', 
                              gap: '12px', 
                              padding: '10.5px 12px', 
                              backgroundColor: 'var(--bg-card)', 
                              border: '1px solid var(--border-light)', 
                              borderRadius: 'var(--radius-sm)' 
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                              {insightIconMap[ins.emoji] || <Lightbulb size={18} style={{ color: 'var(--text-muted)' }} />}
                            </span>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: 0, lineHeight: '1.5' }}>
                                {ins.message}
                              </p>
                              {ins.confidenceLevel && (
                                <div style={{ display: 'flex', gap: '10px', fontSize: '10.5px', color: 'var(--text-light)', marginTop: '6px', flexWrap: 'wrap' }}>
                                  <span>Confiança: <strong style={{ color: ins.confidenceLevel === 'alta' ? '#22c55e' : ins.confidenceLevel === 'média' ? '#eab308' : '#ef4444' }}>{ins.confidenceLevel.toUpperCase()}</strong></span>
                                  <span>•</span>
                                  <span>Precisão: <strong>{ins.estimatedAccuracy}%</strong></span>
                                  <span>•</span>
                                  <span>Amostra: <strong>{ins.sampleSize} {ins.sampleSize === 1 ? 'atividade' : 'atividades'}</strong></span>
                                  <span>•</span>
                                  <span>Período: <strong>{ins.timeRangeWeeks} {ins.timeRangeWeeks === 1 ? 'semana' : 'semanas'}</strong></span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              })()}

            </div>
          );
        })()}
      </div>

    </div>
  );
}
