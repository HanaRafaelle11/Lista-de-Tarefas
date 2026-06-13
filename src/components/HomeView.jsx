import React, { useMemo, useState, useEffect } from 'react';
import { Target, CheckCircle, Clock, ChevronRight, Award, Plus } from 'lucide-react';
import { calcStreak, ACHIEVEMENTS } from '../hooks/useAchievements';
import { useAuraAssistant } from '../hooks/useAuraAssistant';
import AuraAssistantWidget from './AuraAssistantWidget';
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

export default function HomeView({ tasks, goals, goalTasks, currentUser, onStartTask, setActiveTab, unlockedAchievements }) {
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

  // ─── Estado de Onboarding ───
  const [onboardingStep, setOnboardingStep] = useState(0);

  useEffect(() => {
    const isDone = localStorage.getItem('focuslist_onboarding_done');
    if (isDone === 'true') {
      setOnboardingStep(0);
      return;
    }
    if (tasks.length === 0 && goals.length === 0) {
      setOnboardingStep(1);
    } else if (goals.length > 0 && tasks.length === 0) {
      setOnboardingStep(2);
    } else if (goals.length > 0 && tasks.length > 0) {
      setOnboardingStep(3);
    } else {
      setOnboardingStep(0);
    }
  }, [tasks.length, goals.length]);

  const handleFinishOnboarding = () => {
    localStorage.setItem('focuslist_onboarding_done', 'true');
    setOnboardingStep(0);
  };

  return (
    <div className="home-view-container animate-fade-in">

      {/* ── 1. Saudação ──────────────────────────────────── */}
      <section className="home-greeting-section">
        <h2 className="home-greeting-title">
          Bom dia, {currentUser?.name?.split(' ')[0] || 'usuário'} 👋
        </h2>
        <p className="home-reflection-text">
          "Pequenos passos constroem grandes mudanças. Foque no agora e confie no processo."
        </p>
        {streakDays > 0 && (
          <div className="home-streak-banner">
            <span className="material-symbols-outlined streak-icon">local_fire_department</span>
            <span className="streak-text">Você está há {streakDays} dias avançando nos seus objetivos</span>
          </div>
        )}
      </section>

      {/* ── Onboarding (Guia de Boas-Vindas) ─────────────── */}
      {onboardingStep > 0 && (
        <section className="onboarding-card animate-fade-in">
          <div className="onboarding-header">
            <span className="onboarding-step-badge">Guia de Boas-Vindas · Passo {onboardingStep} de 3</span>
            <button className="onboarding-skip-btn" onClick={handleFinishOnboarding}>Pular Guia</button>
          </div>
          
          <div className="onboarding-body">
            {onboardingStep === 1 && (
              <>
                <h4 className="onboarding-title">🎯 Defina seu primeiro Objetivo</h4>
                <p className="onboarding-desc">
                  Para onde você quer canalizar sua energia? Definir objetivos ajuda você a entender o impacto real das suas tarefas diárias.
                </p>
                <button onClick={() => setActiveTab('goals')} className="onboarding-cta-btn btn-primary-glow">
                  Criar Primeiro Objetivo 🎯
                </button>
              </>
            )}
            {onboardingStep === 2 && (
              <>
                <h4 className="onboarding-title">💼 Crie sua primeira Tarefa</h4>
                <p className="onboarding-desc">
                  Agora, quebre seu objetivo em ações simples. Crie uma tarefa específica e associe-a ao seu novo objetivo.
                </p>
                <button onClick={() => setActiveTab('tasks')} className="onboarding-cta-btn btn-primary-glow">
                  Criar Minha Primeira Tarefa 💼
                </button>
              </>
            )}
            {onboardingStep === 3 && (
              <>
                <h4 className="onboarding-title">📈 Acompanhe sua Evolução</h4>
                <p className="onboarding-desc">
                  Tudo pronto! À medida que você conclui tarefas e avança nos seus objetivos, seus gráficos e insígnias serão desbloqueados na aba <strong>Evolução</strong>.
                </p>
                <div className="onboarding-actions">
                  <button onClick={() => setActiveTab('analytics')} className="onboarding-cta-btn btn-primary-glow">
                    Ver minha Evolução 📈
                  </button>
                  <button onClick={handleFinishOnboarding} className="onboarding-complete-btn">
                    Concluir Guia ✨
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="onboarding-progress-track">
            <div 
              className="onboarding-progress-fill" 
              style={{ width: `${(onboardingStep / 3) * 100}%` }}
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

      {/* ── Assistente Aura ────────────────────────────── */}
      <AuraAssistantWidget 
        analysis={auraAnalysis} 
        onActionClick={(task) => onStartTask(task)} 
      />

      {/* ── 3. Bloco compacto de Evolução ────────────────── */}
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

      {/* ── 4. Widget de Objetivos ───────────────────────── */}
      <section className="home-goals-section">
        <div className="home-section-header">
          <h3 className="home-section-eyebrow">🎯 Objetivos em Andamento</h3>
          <button onClick={() => setActiveTab('goals')} className="home-section-link">
            Ver todos
            <ChevronRight size={14} />
          </button>
        </div>

        {topGoals.length === 0 ? (
          /* Estado vazio — inspirador */
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
          /* Lista de progresso compacta */
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

      {/* ── 4. Ritmo de Crescimento ──────────────────────── */}
      <section className="home-ritmo-section">
        <div className="home-ritmo-content-side">
          <h4 className="home-ritmo-title">Seu ritmo de crescimento</h4>
          <p className="home-ritmo-desc">
            Você tem mantido uma consistência excepcional na sua lista de afazeres.
            Concluir pequenas tarefas diárias ativa o ciclo de foco contínuo.
          </p>

          <div className="home-ritmo-map-container">
            <span className="ritmo-map-label">Últimos 7 dias:</span>
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
          </div>
        </div>

        <div className="home-ritmo-graphic-side">
          <div className="home-ritmo-wave-container">
            <div className="wave wave-1" />
            <div className="wave wave-2" />
            <div className="wave wave-3" />
          </div>
        </div>
      </section>
    </div>
  );
}
