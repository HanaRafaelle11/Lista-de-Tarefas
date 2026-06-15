import React, { useMemo, useState, useEffect } from 'react';
import { Target, CheckCircle, Clock, ChevronRight, Award, Plus } from 'lucide-react';
import { calcStreak, ACHIEVEMENTS } from '../hooks/useAchievements';
import { useAuraAssistant } from '../hooks/useAuraAssistant';
import AuraAssistantWidget from './AuraAssistantWidget';
import { useAppContext } from '../contexts/AppContext';
// Formata data amigável
function formatFriendlyDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${parts[2]} de ${months[parseInt(parts[1]) - 1]}`;
}

// Widget de objetivo individual (linha compacta para a Home)
function GoalProgressRow({ goal, linkedTasks }) {
  const total = linkedTasks.length;
  const done = linkedTasks.filter(t => t.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="home-goal-row">
      <div className="home-goal-row-identity">
        <span className="home-goal-row-icon">{goal.icon}</span>
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
    handleCompleteOnboarding,
    logEvent,
    insights,
    suggestions
  } = useAppContext();
  
  const { habits, habitLogs } = habitsManager;

  const onStartTask = () => setActiveTab('tasks');
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

  // ─── Estado de Onboarding (Bloco 3 - Seção 7) ───
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [activeHomeTab, setActiveHomeTab] = useState('progresso');
  const ONBOARDING_TOTAL_STEPS = 5;

  const onboardingCompleted = !!currentUser?.user_metadata?.onboarding_completed;

  useEffect(() => {
    if (onboardingCompleted) {
      setOnboardingStep(0);
      return;
    }
    const savedStep = localStorage.getItem('flowday_onboarding_step');
    if (savedStep) {
      setOnboardingStep(Number(savedStep));
      return;
    }
    const hasSeenIntro = localStorage.getItem('flowday_onboarding_started');
    if (!hasSeenIntro) {
      setOnboardingStep(0); // mostra a tela de boas-vindas
    } else {
      setOnboardingStep(1);
    }
  }, [onboardingCompleted]);

  const handleStartOnboarding = () => {
    localStorage.setItem('flowday_onboarding_started', 'true');
    localStorage.setItem('flowday_onboarding_step', '1');
    setOnboardingStep(1);
    logEvent('onboarding_started');
  };

  const handleGoToStep = (step, tab) => {
    localStorage.setItem('flowday_onboarding_step', String(step));
    setOnboardingStep(step);
    if (tab) setActiveTab(tab);
  };

  const handleNextStep = () => {
    logEvent('onboarding_step_completed', { step: onboardingStep });
    const next = onboardingStep + 1;
    if (next <= ONBOARDING_TOTAL_STEPS) {
      localStorage.setItem('flowday_onboarding_step', String(next));
      setOnboardingStep(next);
    } else {
      handleFinishOnboarding();
    }
  };

  const handlePrevStep = () => {
    const prev = onboardingStep - 1;
    if (prev >= 1) {
      localStorage.setItem('flowday_onboarding_step', String(prev));
      setOnboardingStep(prev);
    } else {
      localStorage.removeItem('flowday_onboarding_started');
      localStorage.removeItem('flowday_onboarding_step');
      setOnboardingStep(0);
    }
  };

  const handleFinishOnboarding = () => {
    localStorage.removeItem('flowday_onboarding_step');
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

  return (
    <div className="home-view-container animate-fade-in" style={{ paddingBottom: '90px' }}>

      {/* ── 1. Saudação & Consistency Score (Bloco 3 / 5) ──────────────────── */}
      <section className="home-greeting-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h2 className="home-greeting-title" style={{ fontSize: '24px', fontWeight: '800' }}>
            Olá, {currentUser?.name?.split(' ')[0] || 'usuário'} 👋
          </h2>
          <p className="home-reflection-text" style={{ margin: '4px 0 0' }}>
            "Pequenos passos constroem grandes mudanças. Foque no agora e evolua continuamente."
          </p>
        </div>

        {/* Badge do Score de Consistência */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-glow)', border: '1px solid var(--primary-light)', minWidth: '180px' }}>
          <span style={{ fontSize: '28px' }}>🔥</span>
          <div>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', fontWeight: '700', display: 'block' }}>Score de Consistência</span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>{consistencyScore} <span style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: '500' }}>/ 100</span></span>
          </div>
        </div>
      </section>

      {/* ── Widget "Hoje" (Bloco 3 - Seção 8) ─────────────── */}
      <section className="onboarding-card animate-fade-in" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-app) 100%)', border: '1px solid var(--border-medium)', padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          📅 Resumo de Hoje
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
          Começar meu dia ⚡
        </button>
      </section>

      {/* ── Onboarding Guiado (Guia de Boas-Vindas) ─────────────── */}
      {/* Passo 0: tela de boas-vindas */}
      {onboardingStep === 0 && !onboardingCompleted && !localStorage.getItem('flowday_onboarding_started') && (
        <section className="onboarding-card animate-fade-in" style={{ textAlign: 'center', border: '1px solid var(--primary-light)', boxShadow: 'var(--shadow-glow)' }}>
          <div className="onboarding-header" style={{ justifyContent: 'flex-end' }}>
            <button className="onboarding-skip-btn" onClick={() => { logEvent('onboarding_abandoned', { step: 0 }); handleFinishOnboarding(); }}>Pular Guia</button>
          </div>
          <div className="onboarding-body" style={{ alignItems: 'center', paddingTop: '8px' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>👋</div>
            <h4 className="onboarding-title" style={{ fontSize: '20px' }}>Bem-vindo ao Flowday!</h4>
            <p className="onboarding-desc" style={{ maxWidth: '420px', margin: '8px auto 0' }}>
              O Flowday é seu sistema de evolução pessoal. Vamos configurar sua jornada em 5 passos rápidos.
            </p>
            <button onClick={handleStartOnboarding} className="onboarding-cta-btn btn-primary-glow" style={{ marginTop: '20px' }}>
              Iniciar Jornada 🚀
            </button>
          </div>
        </section>
      )}

      {/* Passos 1–5: progressão do guia */}
      {onboardingStep > 0 && !onboardingCompleted && (
        <section className="onboarding-card animate-fade-in" style={{ border: '1px solid var(--primary-light)' }}>
          <div className="onboarding-header">
            <span className="onboarding-step-badge">Jornada Flowday · Passo {onboardingStep} de {ONBOARDING_TOTAL_STEPS}</span>
            <button className="onboarding-skip-btn" onClick={handleAbandonOnboarding}>Pular Guia</button>
          </div>
          
          <div className="onboarding-body">
            {onboardingStep === 1 && (
              <>
                <h4 className="onboarding-title">🎯 Passo 1 — Crie seu primeiro Objetivo</h4>
                <p className="onboarding-desc">
                  Objetivos são as suas grandes metas de vida. Defina para onde você quer caminhar e o app calculará a evolução automaticamente.
                </p>
                <div className="onboarding-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button onClick={() => handleGoToStep(2, 'goals')} className="onboarding-cta-btn btn-primary-glow" style={{ margin: 0 }}>
                    Criar Objetivo 🎯
                  </button>
                  <button onClick={handleNextStep} className="onboarding-complete-btn" style={{ padding: '10px 16px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500' }}>
                    Avançar ➔
                  </button>
                </div>
              </>
            )}
            {onboardingStep === 2 && (
              <>
                <h4 className="onboarding-title">💼 Passo 2 — Adicione sua primeira Tarefa</h4>
                <p className="onboarding-desc">
                  Tarefas são ações diretas. Adicione o que precisa fazer e vincule-a ao seu objetivo.
                </p>
                <div className="onboarding-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button onClick={() => handleGoToStep(3, 'tasks')} className="onboarding-cta-btn btn-primary-glow" style={{ margin: 0 }}>
                    Criar Tarefa 💼
                  </button>
                  <button onClick={handlePrevStep} className="onboarding-complete-btn" style={{ padding: '10px 16px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500' }}>
                    ➔ Voltar
                  </button>
                  <button onClick={handleNextStep} className="onboarding-complete-btn" style={{ padding: '10px 16px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500' }}>
                    Avançar ➔
                  </button>
                </div>
              </>
            )}
            {onboardingStep === 3 && (
              <>
                <h4 className="onboarding-title">🌱 Passo 3 — Crie seu primeiro Hábito</h4>
                <p className="onboarding-desc">
                  Hábitos constroem consistência a longo prazo. Configure hábitos diários na aba de Objetivos.
                </p>
                <div className="onboarding-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button onClick={() => handleGoToStep(4, 'goals')} className="onboarding-cta-btn btn-primary-glow" style={{ margin: 0 }}>
                    Criar Hábito 🌱
                  </button>
                  <button onClick={handlePrevStep} className="onboarding-complete-btn" style={{ padding: '10px 16px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500' }}>
                    ➔ Voltar
                  </button>
                  <button onClick={handleNextStep} className="onboarding-complete-btn" style={{ padding: '10px 16px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500' }}>
                    Avançar ➔
                  </button>
                </div>
              </>
            )}
            {onboardingStep === 4 && (
              <>
                <h4 className="onboarding-title">📈 Passo 4 — Acompanhe sua Evolução</h4>
                <p className="onboarding-desc">
                  Veja seu progresso detalhado, estatísticas de conclusão e insígnias conquistadas.
                </p>
                <div className="onboarding-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button onClick={() => handleGoToStep(5, 'analytics')} className="onboarding-cta-btn btn-primary-glow" style={{ margin: 0 }}>
                    Ver Evolução 📈
                  </button>
                  <button onClick={handlePrevStep} className="onboarding-complete-btn" style={{ padding: '10px 16px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500' }}>
                    ➔ Voltar
                  </button>
                  <button onClick={handleNextStep} className="onboarding-complete-btn" style={{ padding: '10px 16px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500' }}>
                    Avançar ➔
                  </button>
                </div>
              </>
            )}
            {onboardingStep === 5 && (
              <>
                <h4 className="onboarding-title">✨ Passo 5 — Pronto para Começar</h4>
                <p className="onboarding-desc">
                  Tudo configurado! Conclua o guia para salvar seu progresso no banco de dados.
                </p>
                <div className="onboarding-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button onClick={handlePrevStep} className="onboarding-complete-btn" style={{ padding: '10px 16px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500' }}>
                    ➔ Voltar
                  </button>
                  <button onClick={handleFinishOnboarding} className="onboarding-complete-btn" style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--success-light)', color: 'var(--success-text)', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                    Concluir Onboarding ✨
                  </button>
                </div>
              </>
            )}
          </div>
          
          <div className="onboarding-progress-track">
            <div 
              className="onboarding-progress-fill" 
              style={{ width: `${(onboardingStep / ONBOARDING_TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </section>
      )}

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
                    <span className="material-symbols-outlined graphic-icon">eco</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="home-hero-empty-card">
            <div className="home-hero-empty-glow" />
            <Award size={48} className="home-hero-empty-icon" />
            <h4 className="home-hero-empty-title">Você está em dia com tudo!</h4>
            <p className="home-hero-empty-text">
              Nenhuma tarefa pendente de prioridade alta ou média.
              Aproveite para planejar seus próximos objetivos.
            </p>
            <button onClick={() => setActiveTab('tasks')} className="home-hero-empty-btn">
              Criar Nova Tarefa
            </button>
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
              cursor: 'pointer'
            }}
          >
            📈 Foco & Progresso
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
              cursor: 'pointer'
            }}
          >
            🧠 Aura Insights
          </button>
        </div>

        {activeHomeTab === 'progresso' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Bloco compacto de Evolução */}
            {(currentStreak > 0 || unlockedCount > 0 || completedGoalsCount > 0) && (
              <section className="home-evo-block">
                <div className="home-section-header">
                  <h3 className="home-section-eyebrow">📈 Sua Evolução</h3>
                  <button onClick={() => setActiveTab('analytics')} className="home-section-link">
                    Ver evolução
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="home-evo-stats-row">
                  {currentStreak > 0 && (
                    <div className="home-evo-stat">
                      <span className="home-evo-stat-emoji">🔥</span>
                      <div className="home-evo-stat-text">
                        <span className="home-evo-stat-value">{currentStreak} {currentStreak === 1 ? 'dia' : 'dias'}</span>
                        <span className="home-evo-stat-label">seguidos</span>
                      </div>
                    </div>
                  )}
                  {unlockedCount > 0 && (
                    <div className="home-evo-stat">
                      <span className="home-evo-stat-emoji">🏅</span>
                      <div className="home-evo-stat-text">
                        <span className="home-evo-stat-value">{unlockedCount} {unlockedCount === 1 ? 'conquista' : 'conquistas'}</span>
                        <span className="home-evo-stat-label">desbloqueadas</span>
                      </div>
                    </div>
                  )}
                  {completedGoalsCount > 0 && (
                    <div className="home-evo-stat">
                      <span className="home-evo-stat-emoji">🎯</span>
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
                <h3 className="home-section-eyebrow">🎯 Objetivos em Andamento</h3>
                <button onClick={() => setActiveTab('goals')} className="home-section-link">
                  Ver todos
                  <ChevronRight size={14} />
                </button>
              </div>

              {topGoals.length === 0 ? (
                <div className="home-goals-empty">
                  <div className="home-goals-empty-glow" />
                  <p className="home-goals-empty-symbol">✦</p>
                  <h4 className="home-goals-empty-title">Grandes conquistas começam com um objetivo.</h4>
                  <p className="home-goals-empty-desc">
                    Defina para onde você quer ir e acompanhe seu progresso aqui.
                  </p>
                  <button
                    onClick={() => setActiveTab('goals')}
                    className="home-goals-empty-cta"
                  >
                    <Plus size={15} />
                    Criar meu primeiro objetivo
                  </button>
                </div>
              ) : (
                <div className="home-goals-widget">
                  {topGoals.map(({ goal, linkedTasks }) => (
                    <GoalProgressRow
                      key={goal.id}
                      goal={goal}
                      linkedTasks={linkedTasks}
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

            {/* Ritmo de Crescimento */}
            <section className="home-ritmo-section">
              <div className="home-ritmo-content-side">
                <h4 className="home-ritmo-title">Seu ritmo de crescimento</h4>
                <p className="home-ritmo-desc">
                  Você tem mantido uma consistência excepcional na sua lista de afazeres.
                  Concluir pequenas tarefas diárias ativa o ciclo de foco contínuo.
                </p>

                <div className="home-ritmo-map-container">
                  <span className="ritmo-map-label">Últimos 7 dias:</span>
                  {ritmoSemanal.every(day => day.count === 0) ? (
                    <div 
                      className="home-ritmo-empty-state" 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '24px 16px', 
                        backgroundColor: 'var(--bg-card)', 
                        borderRadius: 'var(--radius-md)', 
                        border: '1px dashed var(--border-medium)', 
                        marginTop: '8px',
                        textAlign: 'center',
                        width: '100%'
                      }}
                    >
                      <span style={{ fontSize: '28px' }}>🌱</span>
                      <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: 0, fontWeight: '700' }}>
                        Nenhum progresso nos últimos 7 dias
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: 0 }}>
                        Conclua tarefas com prazos para ativar seu ritmo.
                      </p>
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
                  <div style={{ fontSize: '32px', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ritmoSemanal.every(day => day.count === 0) ? '🌱' : '⚡'}
                  </div>
                </div>
              </div>
            </section>

          </div>
        )}

        {activeHomeTab === 'aura' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Assistente Aura */}
            <AuraAssistantWidget 
              analysis={auraAnalysis} 
              onActionClick={(task) => onStartTask(task)} 
            />

            {/* Sugestões de Engajamento */}
            {suggestions && suggestions.length > 0 && (
              <section className="engagement-suggestions-section animate-fade-in">
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚡</span> Sugestões recomendadas para você
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
                              localStorage.setItem('flowday_onboarding_started', 'true');
                              localStorage.setItem('flowday_onboarding_step', '1');
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
            {insights && insights.length > 0 && (
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
                    🧠 Insights de Produtividade Aura
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {insights.map((ins, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'flex-start', 
                          gap: '12px', 
                          padding: '10px 12px', 
                          backgroundColor: 'var(--bg-card)', 
                          border: '1px solid var(--border-light)', 
                          borderRadius: 'var(--radius-sm)' 
                        }}
                      >
                        <span style={{ fontSize: '20px', lineHeight: '1' }}>{ins.emoji}</span>
                        <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: 0, lineHeight: '1.5' }}>
                          {ins.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

          </div>
        )}
      </div>

    </div>
  );
}
