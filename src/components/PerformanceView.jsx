import React, { useMemo, useState, useEffect } from 'react';
import { 
  Award, TrendingUp, Clock, Calendar, ShieldAlert, Zap, BarChart2,
  CheckCircle2, AlertTriangle, ArrowUpRight, Flame, Trophy, Shield,
  Sunrise, Sun, Sunset, Moon, Radar, Target, Lightbulb, CalendarDays,
  AlarmClock, Leaf, Activity, CheckCircle, Lock
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import Skeleton from './Skeleton';
import { localDB } from '../db/localDB';


export default function PerformanceView() {
  const {
    tasks,
    goals,
    goalTasks,
    habitsManager,
    isPro,
    currentUser,
    openPaywall,
    setSelectedGoalIdFilter,
    setActiveTab,
    consistencyScore,
    consistencyScoreExplanation,
    isInitializing
  } = useAppContext();

  const [showHealthExplanation, setShowHealthExplanation] = useState(false);
  const [pomodoroStats, setPomodoroStats] = useState({ count: 0, hours: 0 });
  const [activeDays, setActiveDays] = useState(0);

  const activeTasks = useMemo(() => tasks.filter(t => !t.deletedAt && !t.deleted_at), [tasks]);
  const completedTasks = useMemo(() => activeTasks.filter(t => t.completed), [activeTasks]);
  const habits = habitsManager.habits;
  const habitLogs = habitsManager.habitLogs;

  const activeGoals = useMemo(() => goals.filter(g => !g.deletedAt && !g.deleted_at), [goals]);

  const totalEvents = useMemo(() => {
    return completedTasks.length + activeGoals.filter(g => g.status === 'completed').length;
  }, [completedTasks, activeGoals]);

  const hasTwoWeeksHistory = useMemo(() => {
    const allDates = [
      ...completedTasks.map(t => t.completedAt || t.dueDate || t.createdAt),
      ...activeGoals.filter(g => g.status === 'completed').map(g => g.updated_at || g.created_at)
    ].filter(Boolean).map(d => new Date(d).getTime());
    if (allDates.length === 0) return false;
    const minDate = Math.min(...allDates);
    const maxDate = Math.max(...allDates);
    return (maxDate - minDate) >= 14 * 24 * 60 * 60 * 1000;
  }, [completedTasks, goals]);

  const hasEnoughForDayOfWeek = useMemo(() => {
    return totalEvents >= 1 || hasTwoWeeksHistory;
  }, [totalEvents, hasTwoWeeksHistory]);

  // 1. Classificação do Score Geral
  const scoreLabel = useMemo(() => {
    if (consistencyScore >= 90) return { label: 'Excelente', color: 'var(--primary)', desc: 'Sua consistência está incrível! Continue liderando sua jornada.' };
    if (consistencyScore >= 75) return { label: 'Muito Bom', color: '#6B7F8A', desc: 'Ótimo ritmo de crescimento. Mantendo a disciplina.' };
    if (consistencyScore >= 60) return { label: 'Regular', color: '#C89658', desc: 'Bom desempenho, mas há margem para focar em mais hábitos.' };
    return { label: 'Atenção', color: '#C06C6C', desc: 'Foque em planejar tarefas menores para reativar seu ritmo.' };
  }, [consistencyScore]);


  // 2. Mapa de Produtividade por Horário (completed_at)
  const productivityHours = useMemo(() => {
    const counts = { matutino: 0, vespertino: 0, noturno: 0, madrugada: 0 };
    
    completedTasks.forEach(task => {
      if (!task.completedAt) return;
      const hour = new Date(task.completedAt).getHours();
      if (hour >= 6 && hour < 12) counts.matutino++;
      else if (hour >= 12 && hour < 18) counts.vespertino++;
      else if (hour >= 18 && hour < 24) counts.noturno++;
      else counts.madrugada++;
    });

    const total = Math.max(1, Object.values(counts).reduce((a, b) => a + b, 0));
    const matutinoPct = Math.round((counts.matutino / total) * 100);
    const vespertinoPct = Math.round((counts.vespertino / total) * 100);
    const noturnoPct = Math.round((counts.noturno / total) * 100);
    const madrugadaPct = Math.round((counts.madrugada / total) * 100);

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const mostProductiveKey = sorted[0][0];
    const leastProductiveKey = sorted[sorted.length - 1][0];

    const periodNames = {
      matutino: 'Matutino (06h – 12h)',
      vespertino: 'Vespertino (12h – 18h)',
      noturno: 'Noturno (18h – 00h)',
      madrugada: 'Madrugada (00h – 06h)'
    };


    // Recomendação Automática
    let recommendation = 'Você tem um ritmo de execução equilibrado ao longo do dia.';
    if (completedTasks.length < 1) {
      recommendation = 'Dados insuficientes para identificar padrões. Ainda estamos aprendendo sobre sua rotina para gerar recomendações personalizadas.';
    } else if (mostProductiveKey === 'matutino') {
      recommendation = 'Você conclui mais tarefas pela manhã. Agende trabalhos profundos antes do almoço e deixe reuniões para a tarde.';
    } else if (mostProductiveKey === 'vespertino') {
      recommendation = 'Seu foco atinge o ápice à tarde. Aproveite a manhã para organizar o dia e o pós-almoço para execução crítica.';
    } else if (mostProductiveKey === 'noturno') {
      recommendation = 'Seu rendimento melhora à noite. Use a tarde para revisar pendências e dedique a noite a tarefas de alto foco.';
    }

    return {
      counts,
      matutinoPct,
      vespertinoPct,
      noturnoPct,
      madrugadaPct,
      mostProductive: periodNames[mostProductiveKey],
      leastProductive: periodNames[leastProductiveKey],
      recommendation
    };
  }, [completedTasks, totalEvents]);

  // 3. Radar Semanal (Produtividade por dia da semana)
  const radarSemanal = useMemo(() => {
    const days = [0, 0, 0, 0, 0, 0, 0]; // Dom=0, Seg=1...
    completedTasks.forEach(task => {
      const date = task.dueDate || task.completedAt?.split('T')[0] || task.createdAt?.split('T')[0];
      if (date) {
        const d = new Date(date + 'T12:00:00');
        days[d.getDay()]++;
      }
    });

    // Contabiliza objetivos concluídos
    const completedGoals = activeGoals.filter(g => g.status === 'completed');
    completedGoals.forEach(goal => {
      const date = goal.updated_at?.split('T')[0] || goal.created_at?.split('T')[0];
      if (date) {
        const d = new Date(date + 'T12:00:00');
        days[d.getDay()]++;
      }
    });

    const maxVal = Math.max(...days, 1);
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    // Map each day to a performance level
    const radarData = days.map((val, idx) => {
      const pct = (val / maxVal) * 100;
      let level = 'low';    // red
      if (!hasEnoughForDayOfWeek || totalEvents < 7) {
        level = 'neutral';
      } else if (pct > 70) {
        level = 'high';   // green
      } else if (pct > 30) {
        level = 'mid'; // yellow
      }
      return { dayName: dayNames[idx], count: val, level };
    });

    const sortedDays = days.map((val, idx) => ({ idx, val })).sort((a, b) => b.val - a.val);
    const bestDay = dayNames[sortedDays[0].idx];
    
    let worstDay = null;
    if (completedTasks.length > 0) {
      const lateOrOverdueCounts = [0, 0, 0, 0, 0, 0, 0];
      const scheduledCounts = [0, 0, 0, 0, 0, 0, 0];
      let hasLateOrOverdue = false;

      tasks.forEach(task => {
        if (task.dueDate) {
          const d = new Date(task.dueDate + 'T12:00:00');
          scheduledCounts[d.getDay()]++;
        }

        const isOverdue = !task.completed && task.dueDate && new Date(task.dueDate + 'T23:59:59') < new Date();
        let isLate = false;
        if (task.completed && task.dueDate && task.completedAt) {
          const complDate = new Date(task.completedAt.split('T')[0] + 'T12:00:00');
          const dueDate = new Date(task.dueDate + 'T12:00:00');
          if (complDate > dueDate) {
            isLate = true;
          }
        }

        if ((isOverdue || isLate) && task.dueDate) {
          const d = new Date(task.dueDate + 'T12:00:00');
          lateOrOverdueCounts[d.getDay()]++;
          hasLateOrOverdue = true;
        }
      });

      if (hasLateOrOverdue) {
        let maxLate = 0;
        let worstIdx = -1;
        for (let i = 0; i < 7; i++) {
          if (lateOrOverdueCounts[i] > maxLate && scheduledCounts[i] >= 3) {
            maxLate = lateOrOverdueCounts[i];
            worstIdx = i;
          }
        }
        if (worstIdx !== -1) {
          worstDay = dayNames[worstIdx];
        }
      }
    }

    return { radarData, bestDay, worstDay };
  }, [completedTasks, goals, hasEnoughForDayOfWeek, totalEvents, tasks]);

  // 4. Saúde dos Objetivos
  const goalHealthList = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return activeGoals.map(goal => {
      // Tarefas vinculadas
      const linkedTaskIds = goalTasks.filter(gt => gt.goal_id === goal.id).map(gt => gt.task_id);
      const linked = tasks.filter(t => linkedTaskIds.includes(t.id));
      const done = linked.filter(t => t.completed);

      const progressPct = linked.length > 0 ? (done.length / linked.length) * 100 : 0;

      // Calcular dias sem atividade (última conclusão de tarefa vinculada)
      let daysStagnant = 0;
      if (linked.length > 0) {
        const completionDates = done
          .map(t => t.completedAt ? new Date(t.completedAt) : null)
          .filter(Boolean);

        if (completionDates.length > 0) {
          const latest = new Date(Math.max(...completionDates));
          const diffTime = Math.abs(today - latest);
          daysStagnant = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        } else {
          // Nenhuma concluída, ver data de criação do objetivo
          const created = new Date(goal.created_at || today);
          daysStagnant = Math.floor(Math.abs(today - created) / (1000 * 60 * 60 * 24));
        }
      } else {
        const created = new Date(goal.created_at || today);
        daysStagnant = Math.floor(Math.abs(today - created) / (1000 * 60 * 60 * 24));
      }

      // Cálculo de Saúde (reduz 5% por dia estagnado)
      let health = Math.round(progressPct * 0.7 + (100 - Math.min(100, daysStagnant * 5)) * 0.3);
      
      // Se não há NENHUMA tarefa concluída ou vinculada, a saúde do objetivo não pode ser avaliada como positiva.
      if (done.length === 0) {
        health = 0;
      }

      return {
        ...goal,
        health,
        daysStagnant,
        totalTasks: linked.length,
        doneTasks: done.length
      };
    });
  }, [goals, goalTasks, tasks]);

  // Filtra objetivos estagnados há mais de 5 dias
  const stagnantGoals = useMemo(() => {
    return goalHealthList.filter(g => g.status === 'active' && g.daysStagnant > 5);
  }, [goalHealthList]);

  // Subtrai objetivos deletados do cálculo de saúde
  const visibleGoals = activeGoals;

  // 5. Streaks Central
  const streaksData = useMemo(() => {
    // Calcula streak histórico máximo simplificado
    const sortedCompletions = completedTasks
      .map(t => t.dueDate || t.createdAt?.split('T')[0])
      .filter(Boolean)
      .sort();

    const uniqueDates = [...new Set(sortedCompletions)];
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < uniqueDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(uniqueDates[i - 1]);
        const curr = new Date(uniqueDates[i]);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diff <= 1.1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > maxStreak) maxStreak = tempStreak;
    }

    const todayDateStr = new Date().toISOString().split('T')[0];
    const lastCompletion = uniqueDates[uniqueDates.length - 1];
    
    if (lastCompletion === todayDateStr) {
      currentStreak = tempStreak;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (lastCompletion === yesterdayStr) {
        currentStreak = tempStreak;
      } else {
        currentStreak = 0;
      }
    }

    // Nível de Gamificação
    let userLevel = 'Recruta Focado';
    if (maxStreak >= 15) userLevel = 'Mestre Consistente';
    else if (maxStreak >= 7) userLevel = 'Executor Focado';
    else if (maxStreak >= 3) userLevel = 'Explorador Conectado';


    return {
      currentStreak,
      maxStreak: Math.max(maxStreak, currentStreak),
      userLevel
    };
  }, [completedTasks]);

  // 6. Insights Automáticos
  const autoInsights = useMemo(() => {
    const list = [];
    if (completedTasks.length === 0 && activeGoals.length === 0) {
      return [];
    }

    if (totalEvents < 7) {
      return [{
        id: 'insufficient_data',
        icon: 'clock',
        text: 'Dados insuficientes para identificar padrões. Ainda estamos aprendendo sobre sua rotina.'
      }];
    }

    // Insight de Dia
    if (hasEnoughForDayOfWeek && radarSemanal.bestDay) {
      list.push({
        id: 'best_day',
        icon: 'calendar',
        text: `Você conclui mais tarefas às ${radarSemanal.bestDay}s.`
      });
    }

    // Insight de Horário
    if (productivityHours.mostProductive) {
      list.push({
        id: 'best_period',
        icon: 'clock',
        text: `Seu pico de produtividade é no período ${productivityHours.mostProductive}.`
      });
    }


    // Insight de Hábitos
    if (habits.length > 0 && habitLogs.length > 0) {
      habits.forEach(h => {
          const logsCount = habitLogs.filter(l => l.habit_id === h.id).length;
          const rate = Math.round((logsCount / 7) * 100);
          if (rate >= 80) {
            list.push({
              id: `habit_${h.id}`,
              icon: 'leaf',
              text: `Seu hábito "${h.title}" possui consistência excepcional de ${rate}% nesta semana.`
            });
          }
        });
    }

    // Insight de Objetivos Estagnados
    stagnantGoals.forEach(g => {
      list.push({
        id: `goal_${g.id}`,
        icon: 'target',
        text: `O objetivo "${g.title}" está há ${g.daysStagnant} dias sem novas conclusões de tarefas.`
      });
    });


    // Insight de Horário de Objetivos
    const completedGoals = activeGoals.filter(g => g.status === 'completed');
    const goalsWithTime = completedGoals.filter(g => g.start_time && g.end_time);
    if (goalsWithTime.length > 0) {
      const hourCounts = {};
      goalsWithTime.forEach(g => {
        const hour = parseInt(g.start_time.split(':')[0], 10);
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      const bestHour = Object.keys(hourCounts).reduce((a, b) => hourCounts[a] > hourCounts[b] ? a : b);
      const endHour = parseInt(bestHour) + 3;
      list.push({
        id: 'goal_time_insight',
        icon: 'target',
        text: `Maior concentração de agendamento de objetivos concluídos entre ${bestHour}h e ${endHour}h.`
      });

    }

    return list.slice(0, 4); // Limita a 4 insights principais
  }, [radarSemanal, productivityHours, habits, habitLogs, stagnantGoals, activeGoals, totalEvents, hasEnoughForDayOfWeek]);

  // 7. Perfil de Produtividade
  const productivityProfile = useMemo(() => {
    if (totalEvents < 7) {
      return {
        title: 'Seu perfil está sendo descoberto.',
        desc: 'Conclua pelo menos 7 atividades para identificarmos padrões.'
      };
    }
    const counts = productivityHours.counts;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const primaryMode = sorted[0][0];

    const profiles = {
      matutino: {
        title: 'Executor Matinal',
        desc: 'Você rende melhor nas primeiras horas do dia. Sua mente está focada e você gosta de liquidar pendências críticas logo cedo.'
      },
      vespertino: {
        title: 'Focado Vespertino',
        desc: 'Seu pico de energia criativa e foco ocorre no período da tarde. Ideal para agendar projetos e entregas complexas.'
      },
      noturno: {
        title: 'Planejador Noturno',
        desc: 'Sua concentração flui melhor à noite, quando as distrações diminuem. Ótimo perfil para desenvolvimento profundo e reflexão.'
      },
      madrugada: {
        title: 'Coruja da Madrugada',
        desc: 'Você funciona em horários alternativos. A calmaria da madrugada é seu santuário de produtividade.'
      }
    };

    return profiles[primaryMode] || { title: 'Produtor Equilibrado', desc: 'Seus horários de conclusão são distribuídos de maneira regular ao longo de todo o dia.' };
  }, [productivityHours, totalEvents]);

  const bestWeek = useMemo(() => {
    if (completedTasks.length === 0) return 'Nenhuma';
    
    const weeks = {};
    completedTasks.forEach(t => {
      const dateStr = t.completedAt || t.dueDate || t.createdAt;
      if (!dateStr) return;
      const date = new Date(dateStr);
      const day = date.getDay();
      const diff = date.getDate() - day; // Adjust to Sunday
      const sunday = new Date(date.setDate(diff));
      sunday.setHours(0, 0, 0, 0);
      const weekKey = sunday.toISOString().split('T')[0];
      
      weeks[weekKey] = (weeks[weekKey] || 0) + 1;
    });
    
    const sorted = Object.entries(weeks).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return 'Nenhuma';
    
    const [weekDateStr, count] = sorted[0];
    const weekStart = new Date(weekDateStr);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return `${weekStart.getDate()}/${weekStart.getMonth()+1} a ${weekEnd.getDate()}/${weekEnd.getMonth()+1} (${count} concluídas)`;
  }, [completedTasks]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const uniqueActiveDays = new Set(
          tasks
            .filter(t => (t.completed && t.completedAt) || t.createdAt)
            .map(t => (t.completedAt || t.createdAt).split('T')[0])
        ).size;
        setActiveDays(uniqueActiveDays);

        const events = await localDB.getAll('events');
        const focusEvents = events.filter(e => e.user_id === currentUser?.id && e.event_type === 'focus_session_completed');
        
        let count = focusEvents.length;
        let totalMins = focusEvents.reduce((acc, curr) => acc + (curr.metadata?.duration_minutes || 25), 0);
        
        if (currentUser?.isDemo && count === 0) {
          count = 8;
          totalMins = 8 * 25;
        }
        
        setPomodoroStats({
          count,
          hours: Math.round((totalMins / 60) * 10) / 10
        });
      } catch (e) {
        console.warn('Erro ao carregar métricas de foco:', e);
      }
    };
    if (currentUser) {
      fetchStats();
    }
  }, [currentUser, tasks]);

  if (isInitializing) {
    return (
      <div className="performance-view-container animate-fade-in" style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <Skeleton height="32px" width="220px" />
          <Skeleton height="20px" width="380px" style={{ marginTop: '8px' }} />
        </div>
        <div className="perf-grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          <Skeleton height="180px" width="100%" borderRadius="var(--radius-lg)" />
          <Skeleton height="180px" width="100%" borderRadius="var(--radius-lg)" />
          <Skeleton height="180px" width="100%" borderRadius="var(--radius-lg)" />
          <Skeleton height="180px" width="100%" borderRadius="var(--radius-lg)" />
        </div>
      </div>
    );
  }

  // Helper: mapeia icon key para componente lucide
  const InsightIcon = ({ icon, size = 18 }) => {
    const map = {
      calendar: <CalendarDays size={size} color="var(--primary)" />,
      clock:    <AlarmClock   size={size} color="var(--primary)" />,
      leaf:     <Leaf         size={size} color="#22c55e" />,
      target:   <Target       size={size} color="var(--primary)" />,
    };
    return map[icon] || <Activity size={size} color="var(--primary)" />;
  };

  return (
    <div className="performance-view-container animate-fade-in" style={{ padding: '24px 0' }}>
      
      {/* Header */}
      <div className="tasks-page-header" style={{ marginBottom: '32px' }}>
        <h1 className="tasks-page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={24} /> Meu Desempenho
        </h1>
        <p className="tasks-page-subtitle">Descobertas comportamentais e análise de consistência pessoal</p>
      </div>

      {/* Zero State Global — nenhuma tarefa ou objetivo ainda */}
      {completedTasks.length === 0 && (
        <div style={{
          padding: '40px 24px', textAlign: 'center',
          backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--border-medium)', marginBottom: '24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
        }}>
          <Activity size={40} color="var(--primary)" style={{ opacity: 0.7 }} />
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
            {tasks.length === 0 ? 'Sua jornada de produtividade começa aqui!' : 'Conclua sua primeira tarefa!'}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', maxWidth: '480px', margin: 0 }}>
            {tasks.length === 0 
              ? 'Crie suas primeiras tarefas e objetivos para que a nossa IA entenda sua rotina e monte seu gráfico de produtividade real.' 
              : 'Você já possui tarefas criadas. Assim que concluir a primeira delas, o seu painel de desempenho e análise de foco serão ativados!'}
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {(tasks.length === 0 
              ? [
                  { text: 'Criar uma tarefa', action: () => setActiveTab('tasks') },
                  { text: 'Definir um objetivo', action: () => setActiveTab('goals') }
                ]
              : [
                  { text: 'Visualizar Minhas Tarefas', action: () => setActiveTab('tasks') },
                  { text: 'Concluir atividade na Home', action: () => setActiveTab('home') }
                ]
            ).map(step => (
              <button 
                key={step.text} 
                onClick={step.action}
                style={{
                  padding: '6px 14px', borderRadius: '99px', fontSize: '12.5px', fontWeight: '600',
                  backgroundColor: 'var(--primary-light)', color: 'var(--primary)',
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.target.style.backgroundColor = 'var(--primary)';
                  e.target.style.color = '#fff';
                }}
                onMouseLeave={e => {
                  e.target.style.backgroundColor = 'var(--primary-light)';
                  e.target.style.color = 'var(--primary)';
                }}
              >
                {step.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="perf-grid-container">
        
        {/* Bloco 1: Score & Classificação */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} /> Consistência & Tendência
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ width: '90px', height: '90px', borderRadius: '50%', border: '6px solid var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)' }}>{consistencyScore}</span>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: '700', color: scoreLabel.color }}>{scoreLabel.label}</span>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {scoreLabel.desc}
              </p>
            </div>
          </div>

          {/* Accordion do Health Score */}
          <div className="health-accordion animate-fade-in" style={{ marginTop: '12px', width: '100%' }}>
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
        </div>

        {/* Bloco 2: Streaks & Gamificação */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} /> Central de Streaks
          </h3>
          {completedTasks.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-medium)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Flame size={28} color="var(--text-light)" style={{ opacity: 0.5 }} />
              <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>Sem sequência ainda</p>
              <p style={{ fontSize: '11px', color: 'var(--text-light)', margin: 0 }}>Seus insights estão sendo preparados! Complete suas primeiras tarefas para que a nossa IA entenda sua rotina.</p>
            </div>
          ) : (
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <Flame size={28} color="#f97316" style={{ margin: '0 auto 4px' }} />
              <span style={{ fontSize: '20px', fontWeight: '800', display: 'block', color: 'var(--text-main)' }}>{streaksData.currentStreak} dias</span>
              <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Sequência Atual</span>
            </div>
            <div style={{ height: '40px', width: '1px', backgroundColor: 'var(--border-medium)' }} />
            <div style={{ textAlign: 'center' }}>
              <Trophy size={28} color="#eab308" style={{ margin: '0 auto 4px' }} />
              <span style={{ fontSize: '20px', fontWeight: '800', display: 'block', color: 'var(--text-main)' }}>{streaksData.maxStreak} dias</span>
              <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Recorde Histórico</span>
            </div>
            <div style={{ height: '40px', width: '1px', backgroundColor: 'var(--border-medium)' }} />
            <div style={{ textAlign: 'center' }}>
              <Shield size={28} color="var(--primary)" style={{ margin: '0 auto 4px' }} />
              <span style={{ fontSize: '13px', fontWeight: '700', display: 'block', color: 'var(--primary)', marginTop: '6px' }}>{streaksData.userLevel}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Seu Nível</span>
            </div>
          </div>
          )}
        </div>

        {/* Bloco 8: Estatísticas Acumuladas */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={18} /> Estatísticas Acumuladas
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Dias Ativos</span>
              <strong style={{ fontSize: '18px', color: 'var(--text-main)' }}>{activeDays}</strong>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Foco Pomodoro</span>
              <strong style={{ fontSize: '16px', color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>{pomodoroStats.count} sessões</strong>
              <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{pomodoroStats.hours}h totais</span>
            </div>
          </div>
          <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Melhor Ciclo Semanal</span>
            <strong style={{ fontSize: '12.5px', color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>{bestWeek}</strong>
          </div>
        </div>

        {/* Bloco 3: Perfil de Produtividade */}
        <div className="perf-card-double-span" style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Zap size={18} className="text-primary" /> Perfil de Produtor
          </h3>
          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-medium)' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--primary)', marginBottom: '6px' }}>{productivityProfile.title}</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.6' }}>{productivityProfile.desc}</p>
          </div>
        </div>

        {/* Bloco 4: Mapa de Produtividade (Semáforo) */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} /> Mapa de Produtividade
          </h3>
          {totalEvents < 7 ? (
            <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '1px dashed var(--border-medium)', gap: '8px' }}>
              <Clock size={28} color="var(--text-light)" style={{ opacity: 0.5 }} />
              <p style={{ fontSize: '13.5px', color: 'var(--text-main)', fontWeight: '600', margin: 0 }}>Estamos aprendendo sua rotina.</p>
              <p style={{ fontSize: '11.5px', color: 'var(--text-light)', margin: 0, lineHeight: '1.4' }}>Conclua mais atividades para descobrir seus horários naturais de maior foco.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Matutino (06h - 12h)', pct: productivityHours.matutinoPct, color: 'var(--primary)' },
                  { label: 'Vespertino (12h - 18h)', pct: productivityHours.vespertinoPct, color: '#C89658' },
                  { label: 'Noturno (18h - 00h)', pct: productivityHours.noturnoPct, color: '#6B7F8A' },
                  { label: 'Madrugada (00h - 06h)', pct: productivityHours.madrugadaPct, color: '#C06C6C' }
                ].map(period => {
                  let semaforoColor = 'var(--danger)';
                  if (period.pct >= 40) semaforoColor = '#10b981';
                  else if (period.pct >= 15) semaforoColor = '#f59e0b';
                  return (
                    <div key={period.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: semaforoColor, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{period.label}</span>
                        <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                          <div style={{ height: '8px', width: `${period.pct}%`, backgroundColor: period.color }} />
                        </div>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>{period.pct}%</span>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-light)', borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Lightbulb size={12} color="#f59e0b" /> <strong>Recomendação:</strong> {productivityHours.recommendation}</span>
              </p>
            </>
          )}
        </div>

        {/* Bloco 5: Radar Semanal */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} /> Radar Semanal
          </h3>
          {completedTasks.length === 0 && activeGoals.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '1px dashed var(--border-medium)', gap: '8px' }}>
              <Radar size={28} color="var(--text-light)" style={{ opacity: 0.5 }} />
              <p style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '600', margin: 0 }}>Radar inativo</p>
              <p style={{ fontSize: '11px', color: 'var(--text-light)', margin: 0 }}>Seus insights estão sendo preparados! Complete suas primeiras tarefas para ativar o radar de produtividade.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {radarSemanal.radarData.map(day => {
                  const dotColor = day.level === 'high' ? '#22c55e' : day.level === 'mid' ? '#eab308' : day.level === 'neutral' ? '#6B7F8A' : '#ef4444';
                  return (
                    <div key={day.dayName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{day.dayName}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{day.count} concluídas</span>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: dotColor, display: 'inline-block', flexShrink: 0 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-light)', marginTop: '8px', flexWrap: 'wrap' }}>
                {hasEnoughForDayOfWeek && totalEvents >= 1 ? (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <TrendingUp size={12} color="#22c55e" /> Melhor dia: <strong>{radarSemanal.bestDay}</strong>
                    </span>
                    {radarSemanal.worstDay && (
                      <>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} color="#ef4444" /> Pior dia: <strong>{radarSemanal.worstDay}</strong>
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontStyle: 'italic' }}>
                    <AlertTriangle size={12} color="#eab308" /> Ainda estamos aprendendo sobre sua rotina.
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Bloco 6: Saúde dos Objetivos */}
        <div className="perf-card-double-span" style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Zap size={18} /> Saúde dos Objetivos
          </h3>
          {goals.length === 0 ? (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-medium)' }}>
              <Target size={24} style={{ color: 'var(--text-muted)' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: '600', marginTop: '8px' }}>Sem objetivos ativos</p>
              <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>Crie seus primeiros objetivos para visualizar sua saúde de progresso.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {goalHealthList.map(goal => {
                let healthColor = '#C06C6C';
                if (goal.health >= 80) healthColor = 'var(--primary)';
                else if (goal.health >= 50) healthColor = '#C89658';

                return (
                  <div 
                    key={goal.id} 
                    onClick={() => {
                      setSelectedGoalIdFilter(goal.id);
                      setActiveTab('myday');
                    }}
                    style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }}
                    className="goal-health-card-clickable"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{goal.title}</strong>
                      </div>
                      {isPro ? (
                        <span style={{ fontSize: '12px', fontWeight: '800', color: healthColor }}>Saúde: {goal.health}%</span>
                      ) : (
                        <span 
                          onClick={() => openPaywall('goal_health')}
                          style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
                        >
                          <Lock size={10} /> Pro
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>Progresso: {goal.doneTasks}/{goal.totalTasks} tarefas</span>
                      {isPro ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: goal.daysStagnant > 5 ? '#C06C6C' : 'var(--text-light)' }}>
                          <Clock size={11} /> {goal.daysStagnant === 0 ? 'Movimentado hoje' : `${goal.daysStagnant} dias sem novas ações`}
                        </span>
                      ) : (
                        <span 
                          onClick={() => openPaywall('goal_health')}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: 'var(--text-light)', cursor: 'pointer' }}
                        >
                          <Clock size={11} /> <Lock size={10} /> Requer Pro
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bloco 7: Insights Automáticos Cards */}
        <div className="perf-card-double-span" style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', position: 'relative', overflow: 'hidden' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ArrowUpRight size={18} /> Insights Comportamentais Recentes
          </h3>
          <div style={{ filter: !isPro ? 'blur(4px)' : 'none', pointerEvents: !isPro ? 'none' : 'auto', userSelect: !isPro ? 'none' : 'auto' }}>
            {autoInsights.length === 0 ? (
              <div style={{ padding: '28px 24px', textAlign: 'center', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-medium)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <Lightbulb size={32} color="var(--text-light)" style={{ opacity: 0.5 }} />
                <p style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: '700', margin: 0 }}>
                  Seus insights estão sendo preparados!
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', maxWidth: '460px', margin: 0 }}>
                  Complete suas primeiras tarefas para que a nossa IA entenda sua rotina e monte seu gráfico de produtividade real.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {autoInsights.map(insight => (
                  <div key={insight.id} style={{ padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-app)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <InsightIcon icon={insight.icon} size={16} />
                    </div>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-main)', lineHeight: '1.5', margin: 0 }}>{insight.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isPro && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(10, 15, 30, 0.65)',
              backdropFilter: 'blur(2px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              textAlign: 'center',
              zIndex: 10
            }}>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '12px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                Deseja descobrir seus padrões e tendências? Desbloqueie o painel Pro.
              </p>
              <button
                onClick={() => openPaywall('performance_insights')}
                className="btn-primary-glow"
                style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 'bold' }}
              >
                Conhecer Planos Pro
              </button>
            </div>
          )}
        </div>

        </div>
      )}
    </div>
  );
}
