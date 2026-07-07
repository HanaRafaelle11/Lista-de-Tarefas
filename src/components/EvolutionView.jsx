import React, { useMemo, useState, lazy, Suspense } from 'react';
import { CheckCircle, Clock, AlertTriangle, BarChart3, PieChart, Target, Star, Award, ShieldAlert, Zap, Calendar, X, Brain, RefreshCw } from 'lucide-react';
import { ACHIEVEMENTS, calcStats, calcStreak } from '../hooks/useAchievements';
import { useAppContext } from '../contexts/AppContext';
import CategoryIcon from './CategoryIcon';
import MFIcon from './MFIcon';
import CoachView from './CoachView';
import { generateCoachMessage } from '../intelligence/coachEngine';

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
          fontSize: '14px', 
          fontWeight: '800', 
          color: 'var(--primary)', 
          margin: '12px 0 6px 0',
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
          fontSize: '12px', 
          color: 'var(--text-main)', 
          marginTop: '8px',
          fontWeight: '700'
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
          lineHeight: '1.45',
          margin: '4px 0',
          paddingLeft: '14px',
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
        lineHeight: '1.45',
        margin: '4px 0' 
      }}>
        {trimmed}
      </p>
    );
  });
}

const WeeklyPlannerModal = lazy(() => import('./WeeklyPlannerModal'));

// ─── Utilitários ─────────────────────────────────────────────────────────────
function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Card de Métrica ─────────────────────────────────────────────────────────
function MetricCard({ iconName, iconColor, value, label, highlight }) {
  return (
    <div className={`evo-metric-card ${highlight ? 'evo-metric-card--highlight' : ''}`}>
      <div className="evo-metric-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MFIcon name={iconName} size={28} color={iconColor} />
      </div>
      <div className="evo-metric-info">
        <span className="evo-metric-value">{value}</span>
        <span className="evo-metric-label">{label}</span>
      </div>
    </div>
  );
}

// ─── Badge de Conquista Rarity Map ──────────────────────────────────────────
const RARITY_MAP = {
  first_task: { rarity: 'Bronze', color: '#cd7f32', bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.03) 100%)', border: '1px solid rgba(205, 127, 50, 0.35)' },
  tasks_10: { rarity: 'Bronze', color: '#cd7f32', bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.03) 100%)', border: '1px solid rgba(205, 127, 50, 0.35)' },
  first_goal: { rarity: 'Bronze', color: '#cd7f32', bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.03) 100%)', border: '1px solid rgba(205, 127, 50, 0.35)' },
  streak_3: { rarity: 'Bronze', color: '#cd7f32', bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.03) 100%)', border: '1px solid rgba(205, 127, 50, 0.35)' },
  pet_lover: { rarity: 'Bronze', color: '#cd7f32', bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.03) 100%)', border: '1px solid rgba(205, 127, 50, 0.35)' },
  financista: { rarity: 'Bronze', color: '#cd7f32', bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.03) 100%)', border: '1px solid rgba(205, 127, 50, 0.35)' },
  carreira: { rarity: 'Bronze', color: '#cd7f32', bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.03) 100%)', border: '1px solid rgba(205, 127, 50, 0.35)' },
  perfect_habits: { rarity: 'Bronze', color: '#cd7f32', bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.03) 100%)', border: '1px solid rgba(205, 127, 50, 0.35)' },
  
  tasks_50: { rarity: 'Prata', color: '#9ca3af', bg: 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(156, 163, 175, 0.03) 100%)', border: '1px solid rgba(156, 163, 175, 0.35)' },
  streak_7: { rarity: 'Prata', color: '#9ca3af', bg: 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(156, 163, 175, 0.03) 100%)', border: '1px solid rgba(156, 163, 175, 0.35)' },
  first_goal_completed: { rarity: 'Prata', color: '#9ca3af', bg: 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(156, 163, 175, 0.03) 100%)', border: '1px solid rgba(156, 163, 175, 0.35)' },
  
  tasks_100: { rarity: 'Ouro', color: '#fbbf24', bg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.03) 100%)', border: '1px solid rgba(251, 191, 36, 0.35)' },
  streak_30: { rarity: 'Ouro', color: '#fbbf24', bg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.03) 100%)', border: '1px solid rgba(251, 191, 36, 0.35)' },
  goals_10: { rarity: 'Ouro', color: '#fbbf24', bg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.03) 100%)', border: '1px solid rgba(251, 191, 36, 0.35)' }
};

// ─── Badge de Conquista ──────────────────────────────────────────────────────
function AchievementBadge({ achievement, unlocked, unlockedAt }) {
  const info = RARITY_MAP[achievement.key] || { rarity: 'Bronze', color: '#cd7f32', bg: 'var(--bg-card)', border: '1px solid var(--border-light)' };
  
  const cardStyle = unlocked 
    ? {
        background: info.bg,
        border: info.border,
        padding: '16px',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'relative',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.3s ease',
      }
    : {
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        padding: '16px',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'relative',
        opacity: 0.65,
        filter: 'grayscale(90%)',
        transition: 'all 0.3s ease',
      };

  return (
    <div style={cardStyle} className="achievement-card-premium">
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        backgroundColor: unlocked ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        border: unlocked ? `2px solid ${info.color}` : '2px dashed var(--border-medium)',
        flexShrink: 0
      }}>
        {unlocked ? <MFIcon name={achievement.icon} size={20} color={info.color} /> : <MFIcon name="lock" size={20} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
          <strong style={{ fontSize: '13.5px', color: 'var(--text-main)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {achievement.title}
          </strong>
          <span style={{ 
            fontSize: '9px', 
            fontWeight: '800', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em', 
            color: info.color,
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: unlocked ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-app)'
          }}>
            {info.rarity}
          </span>
        </div>
        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: '1.4' }}>
          {achievement.desc}
        </p>
        {unlocked && unlockedAt && (
          <span style={{ fontSize: '9.5px', color: 'var(--text-light)', display: 'block', marginTop: '6px' }}>
            Desbloqueado em {formatDate(unlockedAt)}
          </span>
        )}
        {!unlocked && (
          <span style={{ fontSize: '9.5px', color: 'var(--text-light)', display: 'block', marginTop: '6px', fontStyle: 'italic' }}>
            Requisito pendente
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Mapa de Ritmo Semanal ──────────────────────────────────────────────────
function WeeklyRhythm({ tasks }) {
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = tasks.filter(t => {
        if (!t.completed) return false;
        const taskDate = t.completedAt ? t.completedAt.split('T')[0] : (t.dueDate || (t.createdAt ? t.createdAt.split('T')[0] : ''));
        return taskDate === dateStr;
      }).length;
      const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      result.push({ name: names[d.getDay()], dateStr, count, isToday: i === 0 });
    }
    return result;
  }, [tasks]);

  return (
    <div className="evo-rhythm-row">
      {days.map(day => {
        let level = 'dot-level-0';
        if (day.count === 1) level = 'dot-level-1';
        else if (day.count === 2) level = 'dot-level-2';
        else if (day.count >= 3) level = 'dot-level-3';
        return (
          <div key={day.dateStr} className="evo-rhythm-day" title={`${day.count} tarefa${day.count !== 1 ? 's' : ''} em ${day.name}`}>
            <div className={`ritmo-dot ${level} ${day.isToday ? 'today-dot' : ''}`} />
            <span className="evo-rhythm-label">{day.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Gráfico Donut de Categorias ─────────────────────────────────────────────
function CategoryDonut({ tasks }) {
  const { categories = [] } = useAppContext();
  
  const colors = categories.reduce((acc, cat) => {
    acc[cat.id] = cat.color || 'var(--primary)';
    return acc;
  }, {});

  const total = tasks.length;
  const counts = categories.reduce((acc, cat) => {
    acc[cat.id] = tasks.filter(t => t.category === cat.id).length;
    return acc;
  }, {});
  
  const circumference = 2 * Math.PI * 50;
  let accumulated = 0;

  const slices = categories
    .filter(cat => counts[cat.id] > 0)
    .map(cat => {
      const pct = (counts[cat.id] / Math.max(total, 1)) * 100;
      const len = (pct / 100) * circumference;
      const rotation = (accumulated / 100) * 360 - 90;
      accumulated += pct;
      return { id: cat.id, name: cat.name, pct: Math.round(pct), len, rotation, color: colors[cat.id], count: counts[cat.id] };
    });

  if (total === 0) {
    return (
      <div className="evo-chart-empty">
        <span>Conclua tarefas para ver a distribuição por categoria.</span>
      </div>
    );
  }

  return (
    <div className="evo-donut-container">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <defs>
          <pattern id="pattern-Trabalho" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="white" strokeWidth="2.5" opacity="0.4" />
          </pattern>
          <pattern id="pattern-Pessoal" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.5" fill="white" opacity="0.4" />
          </pattern>
          <pattern id="pattern-Estudos" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="white" strokeWidth="2.5" opacity="0.4" />
          </pattern>
          <pattern id="pattern-Lazer" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 0 0 L 10 10 M 10 0 L 0 10" stroke="white" strokeWidth="1.5" opacity="0.4" />
          </pattern>
          <pattern id="pattern-Pets" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="3" height="3" fill="white" opacity="0.4" />
          </pattern>
        </defs>
        <circle cx="70" cy="70" r="50" fill="transparent" stroke="var(--border-light)" strokeWidth="14" />
        {slices.map((s, i) => (
          <React.Fragment key={i}>
            <circle
              cx="70" cy="70" r="50"
              fill="transparent"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${s.len} ${circumference - s.len}`}
              strokeDashoffset="0"
              style={{ transform: `rotate(${s.rotation}deg)`, transformOrigin: '70px 70px' }}
            />
            {['Trabalho', 'Pessoal', 'Estudos', 'Lazer', 'Pets'].includes(s.id) && (
              <circle
                cx="70" cy="70" r="50"
                fill="transparent"
                stroke={`url(#pattern-${s.id})`}
                strokeWidth="14"
                strokeDasharray={`${s.len} ${circumference - s.len}`}
                strokeDashoffset="0"
                style={{ transform: `rotate(${s.rotation}deg)`, transformOrigin: '70px 70px' }}
              />
            )}
          </React.Fragment>
        ))}
        <text x="70" y="66" textAnchor="middle" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', fill: 'var(--text-main)' }}>{total}</text>
        <text x="70" y="82" textAnchor="middle" style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fill: 'var(--text-muted)' }}>TAREFAS</text>
      </svg>
      <div className="evo-donut-legend">
        {categories.map(cat => {
          if (counts[cat.id] === 0) return null;
          return (
            <div key={cat.id} className="evo-legend-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" style={{ borderRadius: '50%', flexShrink: 0 }}>
                <circle cx="7" cy="7" r="7" fill={colors[cat.id]} />
                {['Trabalho', 'Pessoal', 'Estudos', 'Lazer', 'Pets'].includes(cat.id) && (
                  <circle cx="7" cy="7" r="7" fill={`url(#pattern-${cat.id})`} />
                )}
              </svg>
              <span className="evo-legend-cat" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <CategoryIcon categoryId={cat.id} size={14} />
                <span>{cat.name}</span>
              </span>
              <span className="evo-legend-val">{counts[cat.id]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Gráfico de Prioridades ───────────────────────────────────────────────────
function PriorityBars({ tasks }) {
  const priorities = ['Alta', 'Média', 'Baixa'];
  const colors = { Alta: '#EF4444', Média: '#F59E0B', Baixa: '#10B981' };
  const total = tasks.length;
  const counts = priorities.reduce((acc, p) => { acc[p] = tasks.filter(t => t.priority === p).length; return acc; }, {});
  const maxCount = Math.max(...Object.values(counts), 1);

  return (
    <div className="evo-bars-container">
      {priorities.map(p => {
        const count = counts[p];
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const width = (count / maxCount) * 100;
        return (
          <div key={p} className="evo-bar-row">
            <div className="evo-bar-labels">
              <span className="evo-bar-name">{p}</span>
              <span className="evo-bar-count">{count} ({pct}%)</span>
            </div>
            <div className="evo-bar-track">
              <div className="evo-bar-fill" style={{ width: `${width}%`, backgroundColor: colors[p] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── View Principal ───────────────────────────────────────────────────────────
export default function EvolutionView() {
  const { 
    tasks, 
    goals, 
    goalTasks,
    unlockedAchievements, 
    habitsManager, 
    isPro, 
    openPaywall, 
    handleUpdateTask,
    handleToggleComplete,
    currentUser,
    setActiveTab,
    consistencyScore,
    isAccessChecked
  } = useAppContext();

  if (!isAccessChecked || goalTasks === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--text-light)', gap: '12px' }}>
        <RefreshCw style={{ animation: 'spin 2s linear infinite' }} size={32} />
        <p style={{ fontSize: '14.5px', color: 'var(--text-muted)' }}>Carregando dados de evolução...</p>
      </div>
    );
  }

  const [isWeeklyPlannerOpen, setIsWeeklyPlannerOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(() => localStorage.getItem('flowday_hide_evo_guide') !== 'true');
  const [isAchievementsExpanded, setIsAchievementsExpanded] = useState(false);
  const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);

  const achievementsRef = useRef(null);
  const goalsRef = useRef(null);

  useEffect(() => {
    if (isAchievementsExpanded && achievementsRef.current) {
      achievementsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isAchievementsExpanded]);

  useEffect(() => {
    if (isGoalsExpanded && goalsRef.current) {
      goalsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isGoalsExpanded]);

  const dismissGuide = () => {
    setShowGuide(false);
    localStorage.setItem('flowday_hide_evo_guide', 'true');
  };

  // Filtra itens deletados antes de calcular stats
  const activeTasks = useMemo(() => tasks.filter(t => !t.deletedAt), [tasks]);
  const activeGoals = useMemo(() => goals.filter(g => !g.deletedAt), [goals]);
  const hasAnyData = activeTasks.length > 0 || activeGoals.length > 0;

  const stats = useMemo(() => calcStats(activeTasks, activeGoals), [activeTasks, activeGoals]);
  const streak = stats.currentStreak;

  // Mapa de conquistas desbloqueadas
  const unlockedMap = useMemo(() => {
    const m = {};
    const list = unlockedAchievements || [];
    list.forEach(a => { m[a.achievement_key] = a.unlocked_at; });
    return m;
  }, [unlockedAchievements]);

  const unlockedCount = Object.keys(unlockedMap).length;
  const displayUnlockedCount = hasAnyData ? unlockedCount : 0;
  const displayUnlockedMap = hasAnyData ? unlockedMap : {};

  const coachData = useMemo(() => {
    return generateCoachMessage({
      tasks: activeTasks,
      goals: activeGoals,
      goalTasks,
      habitsManager,
      consistencyScore,
      currentUser,
      isPro
    });
  }, [activeTasks, activeGoals, goalTasks, habitsManager, consistencyScore, currentUser, isPro]);

  // Próximo marco de streak
  const streakMilestones = [3, 7, 14, 30, 60, 90];
  const nextMilestone = streakMilestones.find(m => m > streak) || null;
  const streakProgress = nextMilestone
    ? Math.round((streak / nextMilestone) * 100)
    : 100;

  const completedGoals = activeGoals.filter(g => g.status === 'completed');

  // Lógica do Relatório Semanal
  const weeklyReportData = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;

    const recentCompletedTasks = activeTasks.filter(t => t.completed && t.dueDate && t.dueDate >= dateStr).length;
    const recentHabitLogsCount = habitsManager.habitLogs.filter(l => l.completed_date >= dateStr).length;
    
    const weeklyPlan = currentUser?.user_metadata?.weekly_plan || null;
    const hasWeeklyPlan = !!(weeklyPlan && (weeklyPlan.focus?.trim() || weeklyPlan.criticalPriorities?.filter(p => p.trim()).length > 0 || weeklyPlan.linkedGoals?.length > 0));

    let planTasks = [];
    if (hasWeeklyPlan && weeklyPlan?.linkedGoals?.length > 0) {
      planTasks = activeTasks.filter(t => !t.completed);
    } else {
      planTasks = activeTasks.filter(t => !t.completed).slice(0, 5);
    }
    
    return {
      completedTasks: recentCompletedTasks,
      completedHabits: recentHabitLogsCount,
      plan: hasWeeklyPlan ? weeklyPlan : null,
      planTasks: planTasks.slice(0, 8),
    };
  }, [activeTasks, habitsManager.habitLogs, currentUser]);

  const getMotivation = () => {
    if (stats.completedTasks === 0) return { title: 'Seu diário começa agora.', desc: 'Conclua sua primeira tarefa para dar início à sua evolução.' };
    if (stats.completionRate === 100) return { title: 'Incrível! Tudo concluído.', desc: 'Você alcançou 100% de conclusão. Descanse e planeje o próximo ciclo.' };
    if (stats.completionRate >= 80) return { title: 'Produtividade excepcional.', desc: 'Você está no topo do seu jogo. Mantenha esse ritmo.' };
    if (stats.completionRate >= 50) return { title: 'Ótimo progresso.', desc: 'Metade do caminho percorrido. Continue focado.' };
    return { title: 'Cada passo conta.', desc: 'Você está construindo um hábito sólido. Persista.' };
  };
  const motivation = getMotivation();

  // ─── LÓGICA DE PERFORMANCE (TRAZIDA DO PERFORMANCEVIEW) ───
  const productivityHours = useMemo(() => {
    const counts = { matutino: 0, vespertino: 0, noturno: 0, madrugada: 0 };
    
    activeTasks.filter(t => t.completed).forEach(task => {
      const dateToUse = task.completedAt || task.updatedAt || task.createdAt;
      if (!dateToUse) return;
      const hour = new Date(dateToUse).getHours();
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

    const periodNames = {
      matutino: 'Matutino (06h – 12h)',
      vespertino: 'Vespertino (12h – 18h)',
      noturno: 'Noturno (18h – 00h)',
      madrugada: 'Madrugada (00h – 06h)'
    };

    let recommendation = 'Você tem um ritmo de execução equilibrado ao longo do dia.';
    if (activeTasks.filter(t => t.completed).length < 7) {
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
      recommendation
    };
  }, [activeTasks]);

  const radarSemanalData = useMemo(() => {
    const days = [0, 0, 0, 0, 0, 0, 0];
    const completedTasksList = activeTasks.filter(t => t.completed);
    completedTasksList.forEach(task => {
      const date = task.dueDate || task.completedAt?.split('T')[0] || task.createdAt?.split('T')[0];
      if (date) {
        const d = new Date(date + 'T12:00:00');
        days[d.getDay()]++;
      }
    });

    const maxVal = Math.max(...days, 1);
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const totalEvents = completedTasksList.length;

    const radarData = days.map((val, idx) => {
      const pct = (val / maxVal) * 100;
      let level = 'low';
      if (totalEvents < 7) {
        level = 'neutral';
      } else if (pct > 70) {
        level = 'high';
      } else if (pct > 30) {
        level = 'mid';
      }
      return { dayName: dayNames[idx], count: val, level };
    });

    const sortedDays = days.map((val, idx) => ({ idx, val })).sort((a, b) => b.val - a.val);
    const bestDay = dayNames[sortedDays[0].idx];

    return { radarData, bestDay, totalEvents };
  }, [activeTasks, activeGoals]);

  const goalHealthList = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return activeGoals.map(goal => {
      const linkedTaskIds = (goalTasks || []).filter(gt => gt.goal_id === goal.id).map(gt => gt.task_id);
      const linked = tasks.filter(t => linkedTaskIds.includes(t.id));
      const done = linked.filter(t => t.completed);
      const progressPct = linked.length > 0 ? (done.length / linked.length) * 100 : 0;

      let daysStagnant = 0;
      if (linked.length > 0) {
        const completionDates = done
          .map(t => t.completedAt ? new Date(t.completedAt) : null)
          .filter(Boolean);

        if (completionDates.length > 0) {
          const latest = new Date(Math.max(...completionDates));
          daysStagnant = Math.floor(Math.abs(today - latest) / (1000 * 60 * 60 * 24));
        } else {
          const created = new Date(goal.created_at || today);
          daysStagnant = Math.floor(Math.abs(today - created) / (1000 * 60 * 60 * 24));
        }
      } else {
        const created = new Date(goal.created_at || today);
        daysStagnant = Math.floor(Math.abs(today - created) / (1000 * 60 * 60 * 24));
      }

      let health = Math.round(progressPct * 0.7 + (100 - Math.min(100, daysStagnant * 5)) * 0.3);
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
  }, [goals, goalTasks, tasks, activeGoals]);

  const handleExportPDF = () => {
    if (!isPro) {
      openPaywall('export_pdf');
      return;
    }

    const today = new Date().toLocaleDateString('pt-BR');
    const tasksList = activeTasks;
    const goalsList = activeGoals;
    const habitsList = habitsManager?.habits || [];

    const tasksHtml = tasksList.map(t => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${t.title}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${t.category || 'Geral'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${t.priority}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${t.completed ? 'Concluída' : 'Pendente'}</td>
      </tr>
    `).join('');

    const goalsHtml = goalsList.map(g => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${g.title}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${g.status === 'completed' ? 'Alcançado' : 'Ativo'}</td>
      </tr>
    `).join('');

    const habitsHtml = habitsList.map(h => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${h.title}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${h.frequency === 'diaria' ? 'Diário' : 'Semanal'}</td>
      </tr>
    `).join('');

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const printDoc = iframe.contentWindow.document;
    printDoc.open();
    printDoc.write(`
      <html>
        <head>
          <title>Relatório de Evolução MyFlowDay - ${today}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 40px; }
            h1 { color: #6366f1; font-size: 24px; margin-bottom: 4px; }
            .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
            h2 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 30px; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; background-color: #f8fafc; padding: 10px 8px; border-bottom: 2px solid #e2e8f0; font-size: 13px; color: #475569; }
            td { font-size: 13px; color: #1e293b; }
          </style>
        </head>
        <body>
          <h1>Relatório de Evolução MyFlowDay</h1>
          <div class="subtitle">Gerado em: ${today}</div>

          <h2>Objetivos</h2>
          <table>
            <thead>
              <tr><th>Objetivo</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${goalsHtml || '<tr><td colspan="2" style="padding:8px;color:#94a3b8;">Nenhum objetivo registrado</td></tr>'}
            </tbody>
          </table>

          <h2>Tarefas</h2>
          <table>
            <thead>
              <tr><th>Título</th><th>Categoria</th><th>Prioridade</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${tasksHtml || '<tr><td colspan="4" style="padding:8px;color:#94a3b8;">Nenhuma tarefa registrada</td></tr>'}
            </tbody>
          </table>

          <h2>Hábitos</h2>
          <table>
            <thead>
              <tr><th>Hábito</th><th>Frequência</th></tr>
            </thead>
            <tbody>
              ${habitsHtml || '<tr><td colspan="2" style="padding:8px;color:#94a3b8;">Nenhum hábito registrado</td></tr>'}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.parent.document.body.removeChild(window.frameElement);
              }, 1000);
            }
          </script>
        </body>
      </html>
    `);
    printDoc.close();
  };

  // Abas internas da Central de Evolução (Jornada vs Coach) com persistência
  const [activeEvoTab, setActiveEvoTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('flowday_active_evo_tab') || 'jornada';
    }
    return 'jornada';
  });

  const handleSwitchEvoTab = (tab) => {
    setActiveEvoTab(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('flowday_active_evo_tab', tab);
    }
  };

  return (
    <div className="evo-view animate-fade-in" style={{ paddingBottom: '90px' }}>
      
      {/* Seletor de abas internas no topo da tela de Evolução */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', marginBottom: '24px' }}>
        <button 
          onClick={() => handleSwitchEvoTab('jornada')}
          style={{
            padding: '8px 16px',
            fontSize: '14.5px',
            fontWeight: '700',
            background: 'none',
            border: 'none',
            borderBottom: activeEvoTab === 'jornada' ? '2.5px solid var(--primary)' : 'none',
            color: activeEvoTab === 'jornada' ? 'var(--primary)' : 'var(--text-light)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Jornada & Métricas
        </button>
        <button 
          onClick={() => handleSwitchEvoTab('coach')}
          style={{
            padding: '8px 16px',
            fontSize: '14.5px',
            fontWeight: '700',
            background: 'none',
            border: 'none',
            borderBottom: activeEvoTab === 'coach' ? '2.5px solid var(--primary)' : 'none',
            color: activeEvoTab === 'coach' ? 'var(--primary)' : 'var(--text-light)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Coach & Insights
        </button>
      </div>

      {activeEvoTab === 'coach' ? (
        <CoachView />
      ) : !hasAnyData ? (
        /* Empty State */
        <section className="evo-card" style={{ padding: '48px 32px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)',
            width: '300px', height: '300px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{
            position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '96px', height: '96px', borderRadius: '50%',
            background: 'var(--primary-glow, rgba(99,102,241,0.1))',
            border: '2px solid var(--primary-light)',
            marginBottom: '24px',
          }}>
            <MFIcon name="chart" size={40} color="var(--primary)" />
          </div>

          <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-display)', marginBottom: '12px' }}>
            Seus insights aparecem aqui
          </h3>

          <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: '420px', margin: '0 auto 32px' }}>
            Comece a registrar suas tarefas para ver seus insights aqui. Acompanhe sua sequência, conquistas, taxas de conclusão e muito mais.
          </p>

          <button onClick={() => setActiveTab('myday')} className="btn-primary-glow" style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 700 }}>
            Criar minha primeira tarefa
          </button>
        </section>
      ) : (
        /* Conteúdo Normal da Jornada */
        <>
          {/* ── Banner motivacional ─────────────────────────── */}
          <section className="evo-motivation-banner">
            <div className="evo-motivation-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={32} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="evo-motivation-title">{motivation.title}</h2>
              <p className="evo-motivation-desc">{motivation.desc}</p>
            </div>
          </section>

          {/* ── Guia Rápido ─────────────────────────── */}
          {showGuide && (
            <section className="evo-card" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 5%, var(--bg-card))', position: 'relative' }}>
              <button 
                onClick={dismissGuide} 
                style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                aria-label="Fechar guia"
              >
                <X size={16} />
              </button>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Star size={16} style={{ color: 'var(--primary)' }} /> Sua evolução em números
              </h3>
              <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-muted)', marginBottom: '0' }}>
                Aqui é onde tudo fica registrado: tarefas concluídas, hábitos mantidos, metas batidas
                e tendências ao longo das semanas. Quanto mais você usa, mais preciso fica o retrato
                do seu ritmo real.
              </p>
            </section>
          )}

          {/* ── Grid Principal de Evolução ── */}
          <div className="evo-top-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            
            {/* Card 1: Sequência atual & Rhythm */}
            <section className="evo-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="evo-card-header" style={{ padding: '0 0 12px 0' }}>
                  <h3 className="evo-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MFIcon name="streak" size={20} style={{ color: 'var(--accent-orange, #f97316)' }} /> Sequência atual
                  </h3>
                  {streak > 0 && (
                    <span className="evo-streak-badge" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', color: 'var(--accent-orange, #f97316)' }}>{streak} {streak === 1 ? 'dia' : 'dias'}</span>
                  )}
                </div>

                {streak === 0 ? (
                  <p className="evo-streak-hint" style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                    Conclua uma tarefa hoje para iniciar sua sequência. Dias consecutivos constroem hábitos duradouros.
                  </p>
                ) : (
                  <div style={{ marginBottom: '16px' }}>
                    {nextMilestone && (
                      <div className="evo-streak-progress-wrap">
                        <div className="evo-streak-progress-labels" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span className="evo-streak-progress-current" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '700', color: 'var(--text-main)' }}>
                            {streak} dias
                          </span>
                          <span className="evo-streak-progress-next" style={{ color: 'var(--text-light)' }}>Próximo marco: {nextMilestone} dias</span>
                        </div>
                        <div className="evo-streak-track" style={{ height: '6px', backgroundColor: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div className="evo-streak-fill" style={{ height: '100%', width: `${streakProgress}%`, backgroundColor: 'var(--accent-orange, #f97316)', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="evo-card-section-label" style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '8px' }}>Últimos 7 dias</div>
                <WeeklyRhythm tasks={tasks} />
              </div>
            </section>

            {/* Card 2: Conquistas (PS5 style) */}
            <section ref={achievementsRef} className="evo-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
              <div>
                <div 
                  className="evo-card-header" 
                  style={{ padding: '0 0 12px 0', borderBottom: 'none', cursor: 'pointer' }}
                  onClick={() => setIsAchievementsExpanded(!isAchievementsExpanded)}
                >
                  <h3 className="evo-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MFIcon name="achievements" size={20} style={{ color: 'var(--accent-yellow, #eab308)' }} /> Conquistas
                  </h3>
                  <span className="evo-achievements-count" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-light)' }}>
                    {displayUnlockedCount} de {ACHIEVEMENTS.length}
                  </span>
                </div>

                <div 
                  style={{ marginBottom: '16px', cursor: 'pointer' }}
                  onClick={() => setIsAchievementsExpanded(!isAchievementsExpanded)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Progresso da Coleção</span>
                    <strong style={{ color: 'var(--primary)' }}>{Math.round((displayUnlockedCount / ACHIEVEMENTS.length) * 100)}%</strong>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${(displayUnlockedCount / ACHIEVEMENTS.length) * 100}%`, 
                      background: 'linear-gradient(90deg, var(--primary) 0%, var(--accent-yellow, #eab308) 100%)', 
                      borderRadius: '3px',
                      transition: 'width 0.4s ease-out'
                    }} />
                  </div>
                </div>
              </div>

              {/* Galeria de Conquistas Expandida Inline */}
              {isAchievementsExpanded && (
                <div 
                  className="animate-fade-in" 
                  style={{ 
                    marginTop: '12px', 
                    paddingTop: '16px', 
                    borderTop: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxHeight: '320px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                    marginBottom: '16px'
                  }}
                >
                  {/* Master Trophy */}
                  <div style={{
                    background: displayUnlockedCount === ACHIEVEMENTS.length
                      ? 'linear-gradient(135deg, rgba(0, 210, 255, 0.15) 0%, rgba(56, 189, 248, 0.03) 100%)' 
                      : 'var(--bg-app)',
                    border: displayUnlockedCount === ACHIEVEMENTS.length
                      ? '1px solid rgba(0, 210, 255, 0.35)' 
                      : '1px dashed var(--border-medium)',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    opacity: displayUnlockedCount === ACHIEVEMENTS.length ? 1 : 0.6
                  }}>
                    <MFIcon name="trophy" size={20} color="#00d2ff" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text-main)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>Platina: Mestre do Flowday</strong>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Desbloqueie todas as outras conquistas.</span>
                    </div>
                  </div>

                  {/* List of achievements */}
                  {ACHIEVEMENTS.map(a => (
                    <AchievementBadge
                      key={a.key}
                      achievement={a}
                      unlocked={!!displayUnlockedMap[a.key]}
                      unlockedAt={displayUnlockedMap[a.key]}
                    />
                  ))}
                </div>
              )}

              <button 
                onClick={() => setIsAchievementsExpanded(!isAchievementsExpanded)}
                className="btn-secondary"
                style={{ width: '100%', padding: '10px', fontSize: '12.5px', fontWeight: '600' }}
              >
                {isAchievementsExpanded ? 'Recolher Galeria' : 'Ver Minha Galeria'}
              </button>
            </section>

            {/* Card 3: Planejamento Semanal */}
            <section className="evo-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--primary-glow) 100%)', border: '1px solid var(--primary-light)' }}>
              <div>
                <div className="evo-card-header" style={{ padding: '0 0 12px 0' }}>
                  <h3 className="evo-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={20} style={{ color: 'var(--primary)' }} /> Resumo Semanal
                  </h3>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-light)', display: 'block' }}>Tarefas (7 dias)</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>{weeklyReportData.completedTasks}</span>
                  </div>
                  <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-light)', display: 'block' }}>Hábitos (7 dias)</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: '#C89658' }}>{weeklyReportData.completedHabits}</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setIsWeeklyPlannerOpen(true)}
                className="btn-primary-glow"
                style={{ width: '100%', padding: '10px', fontSize: '12.5px', fontWeight: '700' }}
              >
                <Zap size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Planejar Semana
              </button>
            </section>

            {/* Card 4: Objetivos Alcançados */}
            <section ref={goalsRef} className="evo-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
              <div>
                <div 
                  className="evo-card-header" 
                  style={{ padding: '0 0 12px 0', borderBottom: 'none', cursor: 'pointer' }}
                  onClick={() => setIsGoalsExpanded(!isGoalsExpanded)}
                >
                  <h3 className="evo-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MFIcon name="consistency" size={20} style={{ color: 'var(--primary)' }} /> Objetivos Alcançados
                  </h3>
                  <span className="evo-achievements-count" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-light)' }}>
                    {completedGoals.length}
                  </span>
                </div>

                <div 
                  style={{ marginBottom: '16px', cursor: 'pointer' }}
                  onClick={() => setIsGoalsExpanded(!isGoalsExpanded)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Metas Concluídas</span>
                    <strong style={{ color: 'var(--primary)' }}>
                      {completedGoals.length} concluída{completedGoals.length !== 1 ? 's' : ''}
                    </strong>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: 0, lineHeight: '1.4' }}>
                    Acompanhe sua lista de grandes marcos e sonhos concluídos com sucesso.
                  </p>
                </div>
              </div>

              {/* Lista de Objetivos Expandida Inline */}
              {isGoalsExpanded && (
                <div 
                  className="animate-fade-in" 
                  style={{ 
                    marginTop: '12px', 
                    paddingTop: '16px', 
                    borderTop: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxHeight: '320px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                    marginBottom: '16px'
                  }}
                >
                  {completedGoals.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: '24px 0', fontSize: '12.5px' }}>
                      Nenhum objetivo concluído ainda. Vamos focar nas suas metas!
                    </div>
                  ) : (
                    completedGoals.map(g => (
                      <div key={g.id} className="evo-completed-goal-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <span className="evo-completed-goal-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                           <MFIcon name={g.icon || 'target'} size={18} color={g.color} />
                        </span>
                        <span className="evo-completed-goal-title" style={{ flex: 1, fontSize: '13.5px', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{g.title}</span>
                        {g.updated_at && (
                          <span className="evo-completed-goal-date" style={{ fontSize: '11.5px', color: 'var(--text-light)' }}>{formatDate(g.updated_at)}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              <button 
                onClick={() => setIsGoalsExpanded(!isGoalsExpanded)}
                className="btn-secondary"
                style={{ width: '100%', padding: '10px', fontSize: '12.5px', fontWeight: '600' }}
              >
                {isGoalsExpanded ? 'Recolher Objetivos' : 'Ver Meus Objetivos'}
              </button>
            </section>

          </div>

          {/* ── Estatísticas Avançadas Accordion ── */}
          <details className="evo-details-accordion" style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
            marginBottom: '24px'
          }}>
            <summary style={{
              padding: '18px 24px',
              fontSize: '15px',
              fontWeight: '800',
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-card-hover)',
              userSelect: 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={18} style={{ color: 'var(--primary)' }} />
                <span>Estatísticas Avançadas & Análise IA</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold' }}>Ver detalhes</span>
            </summary>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', borderTop: '1px solid var(--border-light)' }}>
              
              {/* Botão de Exportar PDF */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '16px', borderBottom: '1px dashed var(--border-light)' }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 2px 0' }}>Exportar Relatório Completo</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Gere um PDF do seu histórico completo de produtividade.</p>
                </div>
                <button
                  onClick={handleExportPDF}
                  className="btn-primary-glow"
                  style={{ padding: '8px 16px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Award size={14} />
                  Exportar em PDF
                </button>
              </div>

              {/* Seção: Mapa de Produtividade por Horário */}
              <div>
                <h4 style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} style={{ color: 'var(--primary)' }} />
                  Mapa de Produtividade por Horário
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  {[
                    { name: 'Matutino (6h-12h)', pct: productivityHours.matutinoPct, color: 'var(--primary)' },
                    { name: 'Vespertino (12h-18h)', pct: productivityHours.vespertinoPct, color: '#C89658' },
                    { name: 'Noturno (18h-00h)', pct: productivityHours.noturnoPct, color: 'var(--accent-orange, #f97316)' },
                    { name: 'Madrugada (00h-06h)', pct: productivityHours.madrugadaPct, color: 'var(--text-light)' }
                  ].map(period => (
                    <div key={period.name} style={{ padding: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>{period.name}</span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                        <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>{period.pct}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', borderLeft: '3px solid var(--primary)', lineHeight: '1.5' }}>
                  {productivityHours.recommendation}
                </p>
              </div>

              {/* Seção: Radar Semanal */}
              <div>
                <h4 style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={16} style={{ color: 'var(--primary)' }} />
                  Radar de Produtividade Semanal
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {radarSemanalData.radarData.map(day => {
                    const dayColor = day.level === 'high' ? 'var(--primary)' : day.level === 'mid' ? '#C89658' : 'var(--text-light)';
                    const maxVal = Math.max(...radarSemanalData.radarData.map(d => d.count), 1);
                    return (
                      <div key={day.dayName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                        <span style={{ width: '80px', fontWeight: '600', color: 'var(--text-main)' }}>{day.dayName}</span>
                        <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--bg-app)', borderRadius: '3px', margin: '0 12px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(day.count / maxVal) * 100}%`, backgroundColor: dayColor, borderRadius: '3px' }} />
                        </div>
                        <span style={{ width: '40px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)' }}>{day.count}</span>
                      </div>
                    );
                  })}
                </div>
                {radarSemanalData.totalEvents >= 7 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '8px' }}>
                    Melhor dia para execução: <strong style={{ color: 'var(--primary)' }}>{radarSemanalData.bestDay}</strong>
                  </div>
                )}
              </div>

              {/* Seção: Saúde dos Objetivos */}
              <div>
                <h4 style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={16} style={{ color: 'var(--primary)' }} />
                  Saúde dos Objetivos Ativos
                </h4>
                {activeGoals.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-light)', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-medium)' }}>
                    Nenhum objetivo registrado.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    {goalHealthList.map(goal => {
                      let healthColor = '#C06C6C';
                      if (goal.health >= 80) healthColor = 'var(--primary)';
                      else if (goal.health >= 50) healthColor = '#C89658';

                      return (
                        <div key={goal.id} style={{ padding: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{goal.title}</strong>
                            {isPro ? (
                              <span style={{ fontSize: '11px', fontWeight: '800', color: healthColor }}>Saúde: {goal.health}%</span>
                            ) : (
                              <span 
                                onClick={() => openPaywall('goal_health')}
                                style={{ fontSize: '10px', color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                Pro
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Progresso: {goal.doneTasks}/{goal.totalTasks} tarefas • {goal.daysStagnant === 0 ? 'Ativo hoje' : `${goal.daysStagnant}d sem ações`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Distribuição por Categoria e Prioridade */}
              <div>
                <h4 style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart3 size={16} style={{ color: 'var(--primary)' }} />
                  Distribuição e Classificação
                </h4>
                <section className={`premium-lock-overlay ${!isPro ? 'premium-lock-active' : ''}`} style={{ position: 'relative' }}>
                  {!isPro && (
                    <div className="premium-lock-banner">
                      <h4 className="premium-lock-title">
                        <ShieldAlert size={20} style={{ color: 'var(--primary)' }} />
                        Gráficos de Análise Avançada (Pro)
                      </h4>
                      <p className="premium-lock-desc">
                        Obtenha insights sobre a sua alocação de tempo e esforço.
                      </p>
                      <button 
                        onClick={() => openPaywall('evolution_charts')} 
                        className="btn-primary-glow"
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                      >
                        Ativar Flowday Pro
                      </button>
                    </div>
                  )}

                  <div className={!isPro ? 'premium-lock-blur' : ''} style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '260px', padding: '16px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: '750', color: 'var(--text-main)', display: 'block', marginBottom: '12px' }}>Distribuição de Categorias</span>
                      <CategoryDonut tasks={tasks} />
                    </div>
                    <div style={{ flex: 1, minWidth: '260px', padding: '16px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: '750', color: 'var(--text-main)', display: 'block', marginBottom: '12px' }}>Distribuição de Prioridades</span>
                      <PriorityBars tasks={tasks} />
                    </div>
                  </div>
                </section>
              </div>

            </div>
          </details>

        </>
      )}

      <Suspense fallback={null}>
        <WeeklyPlannerModal 
          isOpen={isWeeklyPlannerOpen} 
          onClose={() => setIsWeeklyPlannerOpen(false)} 
          tasks={tasks} 
          onUpdateTask={handleUpdateTask} 
        />
      </Suspense>
    </div>
  );
}
