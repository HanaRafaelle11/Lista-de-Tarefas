import React, { useMemo, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Target, CheckCircle, Clock, ChevronRight, Award, Plus, Flame, Calendar, Lightbulb, Sparkles, AlertTriangle, BarChart3, Zap, Brain, Play } from 'lucide-react';
import { calcStreak } from '../hooks/useAchievements';
import { useAuraAssistant } from '../hooks/useAuraAssistant';
import AuraAssistantWidget from './AuraAssistantWidget';
import Skeleton from './Skeleton';
import { useAppContext, parseTaskMetadata } from '../contexts/AppContext';
import MFIcon from './MFIcon';
import { EVOLUTION_CATEGORIES, EVOLUTION_CATEGORY_LIST } from '../config/evolutionConfig';
import { getEvolutionStage } from '../utils/getEvolutionStage';
import EvolutionStageImage from './EvolutionStageImage';
import PremiumOverlay from './PremiumOverlay';

import GoalModal from './GoalModal';
import { extractDateAndTimeParts } from '../utils/dateUtils';
import { executeAIClassifier } from '../intelligence/aiClassifier';

// Formata data amigável
function formatFriendlyDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${parts[2]} de ${months[parseInt(parts[1]) - 1]}`;
}

// Formata hora amigável
function formatTaskTimeDisplay(dueDate, dueTime) {
  if (!dueTime) return '';
  return dueTime;
}

// Formata a mensagem do coach em JSX interpretando markdown
function formatCoachMessage(message = '') {
  if (!message) return null;
  const lines = message.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} style={{ height: '8px' }} />;
    
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={idx} style={{ 
          fontSize: '15px', 
          fontWeight: '850', 
          color: 'var(--primary)', 
          margin: '16px 0 8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '4px'
        }}>
          {trimmed.replace('### ', '')}
        </h4>
      );
    }
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      return (
        <strong key={idx} style={{ 
          display: 'block', 
          fontSize: '12.5px', 
          color: 'var(--text-main)', 
          marginTop: '12px',
          fontWeight: '750'
        }}>
          {trimmed.replace(/\*\*/g, '')}
        </strong>
      );
    }
    if (trimmed.startsWith('* ')) {
      return (
        <div key={idx} style={{ 
          fontSize: '12.5px', 
          color: 'var(--text-muted)', 
          lineHeight: '1.5',
          margin: '6px 0',
          paddingLeft: '16px',
          position: 'relative'
        }}>
          <span style={{ position: 'absolute', left: '2px', color: 'var(--primary)', fontWeight: 'bold' }}>•</span>
          {trimmed.replace(/^\*\s+/, '')}
        </div>
      );
    }
    
    return (
      <p key={idx} style={{ 
        fontSize: '12.5px', 
        color: 'var(--text-muted)', 
        lineHeight: '1.5',
        margin: '6px 0' 
      }}>
        {trimmed}
      </p>
    );
  });
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
    handleUpdateTask,
    isPro,
    openPaywall,
    handleToggleComplete,
    handleAddTask,
    handleAddGoal,
    userProfile,
    handleUpdateGoal: onUpdateGoal,
    setSelectedGoalIdFilter,
    growthPet,
    handleSelectGrowthPet,
    getLevelFromCount,
    categories,
    focusEvents,
    companionProgressVersion
  } = useAppContext();
  
  const [showHealthExplanation, setShowHealthExplanation] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [prefilledGoalTitle, setPrefilledGoalTitle] = useState('');
  const [localNotification, setLocalNotification] = useState(null);
  const [showGoalsSection, setShowGoalsSection] = useState(true);
  
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
      setActiveTab('myday');
    }
  };
  const activeTasksList = useMemo(() => tasks.filter(t => !t.deletedAt && !t.deleted_at), [tasks]);
  const activeGoalsList = useMemo(() => goals.filter(g => !g.deletedAt && !g.deleted_at), [goals]);

  const pendingTasks = activeTasksList.filter(t => !t.completed);

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

  // Top 3 objetivos ativos com progresso calculado
  const topGoals = useMemo(() => {
    const activeGoals = activeGoalsList.filter(g => g.status === 'active');

    return activeGoals
      .map(goal => {
        const linkedIds = goalTasks.filter(gt => gt.goal_id === goal.id).map(gt => gt.task_id);
        const linked = activeTasksList.filter(t => linkedIds.includes(t.id));
        const done = linked.filter(t => t.completed).length;
        const pct = linked.length > 0 ? Math.round((done / linked.length) * 100) : 0;
        return { goal, linkedTasks: linked, pct };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
  }, [activeGoalsList, goalTasks, activeTasksList]);

  // Estatísticas rápidas (Filtrando exclusões lógicas)
  const totalTasks = activeTasksList.length;
  const completedTasks = activeTasksList.filter(t => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const activeGoalsCount = activeGoalsList.filter(g => g.status === 'active').length;
  const completedGoalsCount = activeGoalsList.filter(g => g.status === 'completed').length;

  // Streak real
  const currentStreak = useMemo(() => calcStreak(activeTasksList), [activeTasksList]);
  const unlockedCount = (unlockedAchievements || []).length;

  const handleQuickSubmit = async (e) => {
    e.preventDefault();
    if (!quickInput.trim()) return;

    const text = quickInput.trim();
    // Executa a classificação inteligente via IA
    const aiResult = executeAIClassifier(text, categories);
    const type = aiResult.type;
    const detectedCat = aiResult.category;

    if (type === 'objective') {
      setPrefilledGoalTitle(text);
      setIsGoalModalOpen(true);
      setQuickInput('');
      setLocalNotification({
        title: 'IA detectou um Objetivo!',
        desc: 'Abrindo configurador de metas para planejar os detalhes.',
        type: 'info'
      });
      setTimeout(() => setLocalNotification(null), 4000);
    } else {
      try {
        const todayStr = todayDate;
        
        // Mapeia a categoria detectada pela IA para o ID/Nome real nas categorias cadastradas do usuário
        let mappedCategory = detectedCat;
        if (detectedCat && detectedCat !== 'Sem categoria') {
          const matched = categories?.find(c => (c.name || '').toLowerCase() === detectedCat.toLowerCase());
          if (matched) {
            mappedCategory = matched.id || matched.name;
          }
        }

        await handleAddTask({
          title: text,
          dueDate: todayStr,
          priority: 'Média',
          category: mappedCategory
        });
        setQuickInput('');
        setLocalNotification({
          title: 'IA detectou uma Tarefa!',
          desc: `Adicionada hoje: "${text}"` + (detectedCat === 'Sem categoria' ? '' : ` (${detectedCat})`),
          type: 'success'
        });
        setTimeout(() => setLocalNotification(null), 4000);
      } catch (err) {
        console.error('Erro ao adicionar tarefa rápida:', err);
      }
    }
  };

  // Consistência dos últimos 7 dias
  const ritmoSemanal = useMemo(() => {
    const ritmo = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() - i);
      const dayStr = dayDate.toISOString().split('T')[0];

      const count = activeTasksList.filter(t => {
        if (!t.completed) return false;
        const taskDate = t.completedAt ? t.completedAt.split('T')[0] : (t.dueDate || (t.createdAt ? t.createdAt.split('T')[0] : ''));
        return taskDate === dayStr;
      }).length;

      const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      ritmo.push({ dayName: weekDays[dayDate.getDay()], dateStr: dayStr, count, isToday: i === 0 });
    }
    return ritmo;
  }, [activeTasksList]);

  const streakDays = currentStreak;
  const auraAnalysis = useAuraAssistant(activeTasksList, activeGoalsList, goalTasks, currentStreak, unlockedCount);



  // Pet de Crescimento é gerenciado no AppContext globalmente
  const [viewedPet, setViewedPet] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('flowday_viewed_pet') || growthPet || 'plant';
    }
    return growthPet || 'plant';
  });

  const handleSwitchViewedPet = (petId) => {
    setViewedPet(petId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('flowday_viewed_pet', petId);
    }
  };

  const getTodayDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayDate = getTodayDateStr();

  const sortByTime = (list) => {
    return [...list].sort((a, b) => {
      const metaA = parseTaskMetadata(a.description || '');
      const metaB = parseTaskMetadata(b.description || '');
      const timeA = metaA.due_time || '';
      const timeB = metaB.due_time || '';
      if (timeA && timeB) return timeA.localeCompare(timeB);
      if (timeA) return -1;
      if (timeB) return 1;
      return 0;
    });
  };

  const agendaItems = useMemo(() => {
    const items = [];
    
    // Add today's tasks
    tasks.forEach(t => {
      if (t.completed || t.deletedAt || t.deleted_at) return;
      if (!t.dueDate) return;
      const taskDateOnly = extractDateAndTimeParts(t.dueDate).datePart;
      if (taskDateOnly === todayDate) {
        items.push({
          id: t.id,
          title: t.title,
          type: 'task',
          time: t.dueDate,
          category: t.category || 'Geral',
          color: null,
          icon: null,
          raw: t
        });
      }
    });

    // Add today's goals
    goals.forEach(g => {
      if (g.status !== 'active' || g.deletedAt || g.deleted_at) return;
      if (!g.target_date) return;
      const goalDateOnly = extractDateAndTimeParts(g.target_date).datePart;
      if (goalDateOnly === todayDate) {
        items.push({
          id: g.id,
          title: g.title,
          type: 'goal',
          time: g.target_date,
          category: 'Objetivo',
          color: g.color || 'var(--primary)',
          icon: g.icon || 'target',
          raw: g
        });
      }
    });

    // Sort by time
    return items.sort((a, b) => {
      const metaA = a.type === 'task' ? parseTaskMetadata(a.raw.description || '') : {};
      const metaB = b.type === 'task' ? parseTaskMetadata(b.raw.description || '') : {};
      const timeA = a.type === 'task' ? (metaA.due_time || '') : (a.raw.start_time || '');
      const timeB = b.type === 'task' ? (metaB.due_time || '') : (b.raw.start_time || '');
      if (timeA && timeB) return timeA.localeCompare(timeB);
      if (timeA) return -1;
      if (timeB) return 1;
      return 0;
    });
  }, [tasks, goals, todayDate]);

  const viewedPetCompletedGoals = useMemo(() => {
    if (!currentUser?.id) return 0;
    const storageKey = `flowday_shared_completed_goals_${currentUser.id}`;
    return Number(localStorage.getItem(storageKey)) || 0;
  }, [currentUser?.id, companionProgressVersion]);

  const weeklyTotal = ritmoSemanal.reduce((acc, d) => acc + d.count, 0);
  const currentPetData = EVOLUTION_CATEGORIES[viewedPet] || EVOLUTION_CATEGORIES.plant;
  const hasNoItems = activeTasksList.length === 0 && activeGoalsList.length === 0 && habits.length === 0;
  const calculatedStageIndex = hasNoItems ? 0 : getEvolutionStage({
    weeklyTotal,
    currentStreak,
    completedGoalsCount: viewedPetCompletedGoals,
    consistencyScore
  }, currentPetData.stages.length);
  
  // Free users are capped at stage index 1 (level 2)
  const stageIndex = !isPro ? Math.min(1, calculatedStageIndex) : calculatedStageIndex;
  const nextStageIsBlocked = !isPro && calculatedStageIndex > 1;
  const currentStage = currentPetData.stages[stageIndex];

  // Limit companion displayed level to 2 if Free
  const calculatedLevel = getLevelFromCount(viewedPetCompletedGoals);
  const displayedLevel = !isPro ? Math.min(2, calculatedLevel) : calculatedLevel;

  useEffect(() => {
    if (hasNoItems && growthPet !== 'plant') {
      handleSelectGrowthPet('plant');
    }
  }, [hasNoItems, growthPet, handleSelectGrowthPet]);

  const petSpeechText = useMemo(() => {
    const completedTasksList = tasks.filter(t => t.completed && !t.deletedAt && !t.deleted_at);
    const activeTasksList = tasks.filter(t => !t.deletedAt && !t.deleted_at);
    const incompleteTasks = activeTasksList.filter(t => !t.completed);

    if (activeTasksList.length > 0 && incompleteTasks.length === 0) {
      return "Incrível! Todas as suas tarefas de hoje foram concluídas. Você está dominando o seu dia! 🌟";
    }

    if (completedTasksList.length > 0) {
      const dates = completedTasksList.map(t => new Date(t.completedAt || t.updated_at || t.createdAt)).sort((a, b) => b - a);
      const lastCompletedDate = dates[0];
      const diffDays = Math.floor((new Date() - lastCompletedDate) / (1000 * 60 * 60 * 24));
      if (diffDays >= 4) {
        return `Psiu... Nosso progresso ficou parado nos últimos ${diffDays} dias. Que tal retomar sua rotina e manter sua evolução viva hoje?`;
      }
    } else if (activeTasksList.length > 0 && completedTasksList.length === 0) {
      return "Tudo pronto por aqui! Vamos concluir a primeira tarefa para iniciarmos nossa evolução?";
    }

    if (stageIndex < currentPetData.stages.length - 1) {
      const thresholds = [30, 75, 145, 245];
      const nextThreshold = thresholds[stageIndex] || 245;
      const goalsNeeded = Math.max(1, nextThreshold - viewedPetCompletedGoals);
      return `Você está a apenas ${goalsNeeded} objetivo${goalsNeeded > 1 ? 's' : ''} concluído${goalsNeeded > 1 ? 's' : ''} do meu próximo nível! Vamos concluir juntos?`;
    }

    const activeGoals = goals.filter(g => g.status === 'active' && !g.deletedAt && !g.deleted_at);
    if (activeGoals.length > 0) {
      const randomGoal = activeGoals[Math.floor(Math.random() * activeGoals.length)];
      return `Hoje é um excelente dia para dar atenção ao seu objetivo: "${randomGoal.title}". Vamos dar um passo nele hoje?`;
    }

    return "Estou pronto para crescer junto com a sua consistência. Qual o nosso foco de hoje?";
  }, [tasks, goals, stageIndex, currentPetData, weeklyTotal, viewedPetCompletedGoals]);

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
      
      {/* Cabeçalho superior com Saudação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="tasks-page-title" style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>
            Olá, {userProfile?.nickname || userProfile?.name || currentUser?.name || 'usuário'}
          </h1>
          <p className="tasks-page-subtitle" style={{ margin: '4px 0 0 0' }}>
            "Pequenos passos constroem grandes mudanças."
          </p>
        </div>
      </div>

      {/* CARD PLANEJE SEU DIA (Classificação Inteligente via IA) */}
      <div className="home-quick-plan-card animate-fade-in" style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--focus) 100%)',
          filter: 'blur(40px)',
          opacity: 0.15,
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Sparkles size={16} style={{ color: 'var(--primary)' }} />
          <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: 'var(--text-main)' }}>Classificador Inteligente</h4>
          <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-light)', backgroundColor: 'var(--primary-light)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(94, 96, 206, 0.1)' }}>
            Classificador IA
          </span>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px 0', lineHeight: '1.4' }}>
          A IA do MyFlowDay analisa o texto e decide se cria uma tarefa rápida para hoje ou se abre o planejador detalhado de metas.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginBottom: '16px', fontSize: '11.5px', color: 'var(--text-light)' }}>
          <span>✓ Classificação em Tarefa ou Objetivo</span>
          <span>✓ Mapeamento automático de categoria</span>
          <span>✓ Planejamento ágil e simplificado</span>
        </div>

        <div style={{ position: 'relative', minHeight: !isPro ? '195px' : 'auto' }}>
          <form 
            onSubmit={handleQuickSubmit} 
            style={{ 
              display: 'flex', 
              gap: '12px',
              filter: !isPro ? 'blur(5px)' : 'none',
              pointerEvents: !isPro ? 'none' : 'auto',
              userSelect: !isPro ? 'none' : 'auto'
            }}
          >
            <textarea 
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickSubmit(e);
                }
              }}
              placeholder="Conte seu objetivo ou descreva um sonho. A IA do MyFlowDay cria seu plano..."
              rows={2}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '13.5px',
                fontWeight: '550',
                outline: 'none',
                transition: 'border-color 0.2s',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.4'
              }}
            />
            <button 
              type="submit"
              className="btn-primary-glow" 
              style={{ 
                padding: '10px 24px', 
                fontSize: '13px', 
                fontWeight: '700',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={14} />
              <span>Adicionar</span>
            </button>
          </form>

          {!isPro && (
            <PremiumOverlay 
              title="Classificação Inteligente disponível no Pro"
              description="Receba análises inteligentes e classificação automática utilizando IA."
              buttonText="Quero o MyFlowDay Pro"
              paywallSource={{ source: 'ai_classifier', trigger: 'quick_plan_input' }}
              containerStyle={{ borderRadius: 'var(--radius-md)' }}
            />
          )}
        </div>
      </div>

      {/* Layout Grid do Dashboard */}
      <div className="home-grid-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* COLUNA ESQUERDA: Companheiro Virtual + Consistency Score + IA Speech Bubble */}
        <div className="home-column-left" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Card do Companheiro Virtual e Score */}
          <div className="companion-hero-card" style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)'
          }}>
            {/* Efeito Glow correspondente ao nível */}
            <div style={{
              position: 'absolute',
              top: '-30px',
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              background: currentStage.color || 'var(--primary)',
              filter: 'blur(60px)',
              opacity: 0.1,
              pointerEvents: 'none'
            }} />

            {/* Cabeçalho do Card: Pet Nome & Selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '16px', zIndex: 1 }}>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seu Companheiro</span>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: '2px 0 0' }}>
                  {currentStage.title}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  {viewedPet === growthPet ? (
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                      ★ Evoluindo
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSelectGrowthPet(viewedPet)}
                      style={{ fontSize: '10px', fontWeight: '700', color: 'var(--primary)', backgroundColor: 'var(--primary-light)', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Focar evolução neste
                    </button>
                  )}
                </div>
              </div>

              {/* Selector compacto de Pets */}
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-card-hover)', padding: '2px', borderRadius: '20px' }}>
                {EVOLUTION_CATEGORY_LIST.map(pet => (
                  <button
                    key={pet.id}
                    onClick={() => handleSwitchViewedPet(pet.id)}
                    style={{
                      border: 'none',
                      background: viewedPet === pet.id ? 'var(--primary)' : 'transparent',
                      color: viewedPet === pet.id ? '#ffffff' : 'var(--text-light)',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    title={pet.name}
                  >
                    {pet.emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Balão de Fala do Pet */}
            <div className="pet-speech-bubble animate-scale-up" style={{
              position: 'relative',
              backgroundColor: 'var(--bg-card-hover)',
              border: '1px solid var(--border-medium)',
              borderRadius: '16px',
              padding: '12px 16px',
              margin: '8px 0 16px 0',
              maxWidth: '92%',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-main)',
              lineHeight: '1.45',
              boxShadow: 'var(--shadow-sm)',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1
            }}>
              <span>{petSpeechText}</span>
              <div style={{
                position: 'absolute',
                bottom: '-6px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '10px',
                height: '10px',
                backgroundColor: 'var(--bg-card-hover)',
                borderRight: '1px solid var(--border-medium)',
                borderBottom: '1px solid var(--border-medium)'
              }} />
            </div>

            {/* Espaço do Bicho animado */}
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12px 0', position: 'relative' }}>
              <EvolutionStageImage
                asset={currentStage.asset}
                alt={currentStage.alt}
                color={currentStage.color}
                animationKey={`${viewedPet}-${stageIndex}`}
              />
            </div>

            {/* Informações de Nível ou Bloqueio Pro */}
            {nextStageIsBlocked ? (
              <PremiumOverlay 
                title="Seu companheiro está pronto para evoluir ainda mais."
                buttonText="Desbloquear Evoluções"
                paywallSource={{ source: 'pet_evolution', trigger: 'companion_card' }}
                inline={true}
              />
            ) : (
              <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 12px', borderRadius: '20px', backgroundColor: `${currentStage.color}15`, color: currentStage.color, border: `1px solid ${currentStage.color}25`, marginBottom: '16px' }}>
                Nível {displayedLevel} • {currentStage.title} • Metas: {viewedPetCompletedGoals}
              </span>
            )}

            {/* Consistency Score integrado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', cursor: 'pointer' }} onClick={() => setShowHealthExplanation(!showHealthExplanation)}>
              <Flame size={22} style={{ color: 'var(--primary)' }} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase' }}>Consistência Geral</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>{consistencyScore}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>/ 100</span>
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)' }}>{showHealthExplanation ? 'Fechar' : 'Detalhes'}</span>
            </div>

          </div>

          {/* Breakdown do Score (Accordion expandido abaixo do card) */}
          {showHealthExplanation && (
            <div className="health-accordion-content animate-fade-in" style={{ padding: '18px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '12.5px', color: 'var(--text-main)', fontStyle: 'italic', margin: '0 0 6px 0', borderBottom: '1px dashed var(--border-light)', paddingBottom: '8px', lineHeight: '1.4' }}>
                  <Lightbulb size={13} style={{ display: 'inline-block', marginRight: '4px', color: '#f59e0b' }} />
                  "{consistencyScoreExplanation.motivationalMessage}"
                </p>
                {consistencyScoreExplanation.breakdown && Object.entries(consistencyScoreExplanation.breakdown).map(([key, item]) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600', color: 'var(--text-main)' }}>
                        <span style={{ color: item.ok ? '#10b981' : 'var(--border-medium)' }}>{item.ok ? '✓' : '○'}</span>
                        {item.label}
                      </span>
                      <span style={{ fontWeight: '700', color: item.ok ? 'var(--primary)' : 'var(--text-light)' }}>
                        {item.valueText}
                      </span>
                    </div>
                    <div style={{ height: '5px', width: '100%', backgroundColor: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '5px', width: `${item.pct}%`, backgroundColor: item.ok ? 'var(--primary)' : 'var(--border-medium)', borderRadius: '3px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}



        </div>

        {/* COLUNA DIREITA: Agenda do Dia / Tarefas Pendentes de Hoje */}
        <div className="home-column-right" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="home-today-agenda-card" style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            boxShadow: 'var(--shadow-md)',
            minHeight: '380px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Agenda de Hoje</h3>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-light)' }}>
                {agendaItems.length} {agendaItems.length === 1 ? 'compromisso' : 'compromissos'}
              </span>
            </div>

            {/* Lista de itens de hoje */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {agendaItems.length > 0 ? (
                agendaItems.map(item => {
                  const timeText = item.type === 'task'
                    ? formatTaskTimeDisplay(item.time, parseTaskMetadata(item.raw.description || '').due_time)
                    : (item.raw.start_time ? `${item.raw.start_time}${item.raw.end_time ? ` - ${item.raw.end_time}` : ''}` : '');

                  return (
                    <div 
                      key={`${item.type}-${item.id}`} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        gap: '12px',
                        transition: 'all 0.2s ease',
                        borderLeft: item.type === 'goal' ? `3px solid ${item.color}` : '1px solid var(--border-light)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div 
                          onClick={() => {
                            if (item.type === 'task') {
                              handleToggleComplete(item.id);
                            } else {
                              onUpdateGoal(item.id, { status: 'completed' });
                            }
                          }}
                          className={`custom-checkbox ${item.type === 'task' && item.raw.completed ? 'checked' : ''}`}
                          style={{ width: '18px', height: '18px', flexShrink: 0, cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            {timeText && (
                              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <Clock size={11} /> {timeText}
                              </span>
                            )}
                            {item.type === 'goal' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: item.color, fontWeight: '800' }}>
                                <MFIcon name={item.icon} size={11} />
                                {item.category}
                              </span>
                            ) : (
                              <span className={`badge-category ${(item.category || 'Trabalho').toLowerCase()}`} style={{ fontSize: '9px', padding: '1px 6px' }}>
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {item.type === 'task' && (
                        <button
                          onClick={() => onStartTask(item.raw)}
                          className="todo-item-action-btn play-btn"
                          style={{ color: 'var(--primary)', flexShrink: 0, padding: '6px', cursor: 'pointer' }}
                          title="Focar nesta tarefa"
                        >
                          <Play size={14} fill="var(--primary)" />
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  flex: 1,
                  padding: '24px'
                }}>
                  <CheckCircle size={32} style={{ color: 'var(--success)', opacity: 0.8 }} />
                  <div>
                    <h4 style={{ fontSize: '14.5px', fontWeight: '750', color: 'var(--text-main)', margin: '0 0 4px' }}>Tudo concluído!</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-light)', maxWidth: '220px', margin: 0, lineHeight: '1.4' }}>
                      Nenhuma tarefa ou objetivo pendente com vencimento para hoje. Organize seu dia na aba "Meu Dia".
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('myday')}
                    className="btn-primary-glow"
                    style={{ padding: '8px 16px', fontSize: '12px', marginTop: '8px' }}
                  >
                    Ver Meu Dia
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* ── SEÇÃO INFERIOR: Objetivos em Andamento ── */}
      <section className="home-goals-dashboard-section" style={{ marginTop: '24px' }}>
        
        <div
          onClick={() => setShowGoalsSection(v => !v)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            marginBottom: showGoalsSection ? '16px' : '0',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.2s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Objetivos em Andamento</h3>
            {topGoals.length > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '600', backgroundColor: 'var(--bg-card-hover)', borderRadius: '10px', padding: '1px 7px' }}>
                {topGoals.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={e => { e.stopPropagation(); setActiveTab('myday'); }} className="home-section-link" style={{ fontSize: '12px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: '600' }}>
              Ver todos no Meu Dia <ChevronRight size={14} />
            </button>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-light)',
              transition: 'transform 0.2s ease',
              transform: showGoalsSection ? 'rotate(90deg)' : 'rotate(0deg)'
            }}>
              <ChevronRight size={16} />
            </span>
          </div>
        </div>

        {showGoalsSection && (
          <>
        {topGoals.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {topGoals.map(({ goal, linkedTasks, pct }) => (
              <div 
                key={goal.id}
                onClick={() => {
                  setSelectedGoalIdFilter(goal.id);
                  setActiveTab('myday');
                }}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'all 0.2s ease',
                  borderLeft: `4px solid ${goal.color || 'var(--primary)'}`
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ display: 'inline-flex', color: goal.color || 'var(--primary)' }}>
                      <MFIcon name={goal.icon || 'target'} size={14} />
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase' }}>
                      Objetivo
                    </span>
                  </div>
                  <h4 style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--text-main)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {goal.title}
                  </h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', fontWeight: '700' }}>
                    <span style={{ color: 'var(--text-light)' }}>Progresso</span>
                    <span style={{ color: goal.color || 'var(--primary)' }}>{pct}%</span>
                  </div>
                  <div style={{ height: '5px', width: '100%', backgroundColor: 'var(--bg-card-hover)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, backgroundColor: goal.color || 'var(--primary)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Target size={24} style={{ color: 'var(--text-muted)' }} />
            <h4 style={{ fontSize: '14px', fontWeight: '750', color: 'var(--text-main)', margin: 0 }}>Nenhum objetivo ativo</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: 0, maxWidth: '280px', lineHeight: '1.4' }}>
              Defina metas claras para guiar sua rotina e veja o progresso de seus objetivos diretamente aqui.
            </p>
            <button
              onClick={() => {
                setPrefilledGoalTitle('');
                setIsGoalModalOpen(true);
              }}
              className="btn-primary-glow"
              style={{ padding: '8px 16px', fontSize: '12.5px' }}
            >
              Criar Objetivo
            </button>
          </div>
        )}

          </>
        )}

      </section>

      {/* MODAL DE CRIAÇÃO DE OBJETIVO DIRETO NA HOME */}
      {isGoalModalOpen && (
        <GoalModal
          isOpen={isGoalModalOpen}
          onClose={() => {
            setIsGoalModalOpen(false);
            setPrefilledGoalTitle('');
          }}
          onSave={async (goalData) => {
            try {
              await handleAddGoal({
                title: goalData.title,
                description: goalData.description || '',
                color: goalData.color || '#4F51B5',
                icon: goalData.icon || 'target',
                target_date: goalData.target_date || null
              });
              setIsGoalModalOpen(false);
              setPrefilledGoalTitle('');
              setLocalNotification({
                title: 'Objetivo Criado!',
                desc: `O objetivo "${goalData.title}" foi estabelecido com sucesso na Home.`,
                type: 'success'
              });
              setTimeout(() => setLocalNotification(null), 4000);
            } catch (err) {
              console.error('Erro ao salvar objetivo na Home:', err);
            }
          }}
          editingGoal={prefilledGoalTitle ? { title: prefilledGoalTitle } : null}
        />
      )}

      {localNotification && ReactDOM.createPortal(
        <div 
          className="animate-scale-up animate-fade-in" 
          onClick={() => {
            setActiveTab('myday');
            setLocalNotification(null);
          }}
          style={{ 
            position: 'fixed', 
            top: '24px', 
            right: '24px', 
            zIndex: 11000, 
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderLeft: `4px solid ${localNotification.type === 'success' ? '#10b981' : '#3b82f6'}`,
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '360px',
            width: '90vw',
            cursor: 'pointer'
          }}
        >
          <Sparkles size={18} style={{ color: localNotification.type === 'success' ? '#10b981' : '#3b82f6', flexShrink: 0 }} />
          <div>
            <strong style={{ display: 'block', fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>{localNotification.title}</strong>
            <span style={{ fontSize: '12px', color: 'var(--text-light)', display: 'block', marginTop: '2px', lineHeight: '1.4' }}>{localNotification.desc}</span>
          </div>
        </div>,
        document.body
      )}



    </div>
  );
}
