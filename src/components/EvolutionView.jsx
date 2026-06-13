import React, { useMemo } from 'react';
import { CheckCircle, Clock, AlertTriangle, BarChart3, PieChart, Target } from 'lucide-react';
import { ACHIEVEMENTS, calcStats, calcStreak } from '../hooks/useAchievements';
import { useAppContext } from '../contexts/AppContext';

// ─── Utilitários ─────────────────────────────────────────────────────────────
function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Card de Métrica ─────────────────────────────────────────────────────────
function MetricCard({ emoji, value, label, highlight }) {
  return (
    <div className={`evo-metric-card ${highlight ? 'evo-metric-card--highlight' : ''}`}>
      <div className="evo-metric-icon">{emoji}</div>
      <div className="evo-metric-info">
        <span className="evo-metric-value">{value}</span>
        <span className="evo-metric-label">{label}</span>
      </div>
    </div>
  );
}

// ─── Badge de Conquista ──────────────────────────────────────────────────────
function AchievementBadge({ achievement, unlocked, unlockedAt }) {
  return (
    <div
      className={`evo-achievement-badge ${unlocked ? 'evo-achievement-badge--unlocked' : 'evo-achievement-badge--locked'}`}
      title={unlocked ? `${achievement.title} — ${achievement.desc}` : `Bloqueada: ${achievement.desc}`}
    >
      <div className="evo-achievement-emoji-wrap">
        <span className="evo-achievement-emoji" role="img" aria-label={achievement.title}>
          {unlocked ? achievement.emoji : '🔒'}
        </span>
      </div>
      <div className="evo-achievement-info">
        <span className="evo-achievement-title">{achievement.title}</span>
        {unlocked && unlockedAt && (
          <span className="evo-achievement-date">{formatDate(unlockedAt)}</span>
        )}
        {!unlocked && (
          <span className="evo-achievement-hint">{achievement.desc}</span>
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
      const count = tasks.filter(t => t.completed && t.dueDate === dateStr).length;
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
  const categories = ['Trabalho', 'Pessoal', 'Estudos', 'Lazer'];
  const colors = {
    Trabalho: 'var(--cat-trabalho)',
    Pessoal: 'var(--cat-pessoal)',
    Estudos: 'var(--cat-estudos)',
    Lazer: 'var(--cat-lazer)',
  };
  const emojis = { Trabalho: '💼', Pessoal: '🏠', Estudos: '📚', Lazer: '🎸' };

  const total = tasks.length;
  const counts = categories.reduce((acc, c) => { acc[c] = tasks.filter(t => t.category === c).length; return acc; }, {});
  const circumference = 2 * Math.PI * 50;
  let accumulated = 0;

  const slices = categories
    .filter(c => counts[c] > 0)
    .map(c => {
      const pct = (counts[c] / Math.max(total, 1)) * 100;
      const len = (pct / 100) * circumference;
      const rotation = (accumulated / 100) * 360 - 90;
      accumulated += pct;
      return { c, pct: Math.round(pct), len, rotation, color: colors[c], count: counts[c] };
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
        <circle cx="70" cy="70" r="50" fill="transparent" stroke="var(--border-light)" strokeWidth="14" />
        {slices.map((s, i) => (
          <circle
            key={i}
            cx="70" cy="70" r="50"
            fill="transparent"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${s.len} ${circumference - s.len}`}
            strokeDashoffset="0"
            style={{ transform: `rotate(${s.rotation}deg)`, transformOrigin: '70px 70px' }}
          />
        ))}
        <text x="70" y="66" textAnchor="middle" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', fill: 'var(--text-main)' }}>{total}</text>
        <text x="70" y="82" textAnchor="middle" style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fill: 'var(--text-muted)' }}>TAREFAS</text>
      </svg>
      <div className="evo-donut-legend">
        {categories.map(c => (
          <div key={c} className="evo-legend-row">
            <span className="evo-legend-dot" style={{ backgroundColor: colors[c] }} />
            <span className="evo-legend-cat">{emojis[c]} {c}</span>
            <span className="evo-legend-val">{counts[c]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Gráfico de Prioridades ───────────────────────────────────────────────────
function PriorityBars({ tasks }) {
  const priorities = ['Alta', 'Média', 'Baixa'];
  const colors = { Alta: 'var(--prio-alta-border)', Média: 'var(--prio-media-border)', Baixa: 'var(--prio-baixa-border)' };
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
  const { tasks, goals, unlockedAchievements } = useAppContext();
  const stats = useMemo(() => calcStats(tasks, goals), [tasks, goals]);
  const streak = stats.currentStreak;

  // Mapa de conquistas desbloqueadas: key -> unlocked_at
  const unlockedMap = useMemo(() => {
    const m = {};
    unlockedAchievements.forEach(a => { m[a.achievement_key] = a.unlocked_at; });
    return m;
  }, [unlockedAchievements]);

  const unlockedCount = Object.keys(unlockedMap).length;

  // Próximo marco de streak
  const streakMilestones = [3, 7, 14, 30, 60, 90];
  const nextMilestone = streakMilestones.find(m => m > streak) || null;
  const streakProgress = nextMilestone
    ? Math.round((streak / nextMilestone) * 100)
    : 100;

  // Objetivos concluídos com detalhes
  const completedGoals = goals.filter(g => g.status === 'completed');

  // Mensagem motivacional
  const getMotivation = () => {
    if (stats.completedTasks === 0) return { title: 'Seu diário começa agora.', desc: 'Conclua sua primeira tarefa para dar início à sua evolução.' };
    if (stats.completionRate === 100) return { title: 'Incrível! Tudo concluído.', desc: 'Você alcançou 100% de conclusão. Descanse e planeje o próximo ciclo.' };
    if (stats.completionRate >= 80) return { title: 'Produtividade excepcional.', desc: 'Você está no topo do seu jogo. Mantenha esse ritmo.' };
    if (stats.completionRate >= 50) return { title: 'Ótimo progresso.', desc: 'Metade do caminho percorrido. Continue focado.' };
    return { title: 'Cada passo conta.', desc: 'Você está construindo um hábito sólido. Persista.' };
  };
  const motivation = getMotivation();

  return (
    <div className="evo-view animate-fade-in">

      {/* ── Banner motivacional ─────────────────────────── */}
      <section className="evo-motivation-banner">
        <div className="evo-motivation-icon">📈</div>
        <div>
          <h2 className="evo-motivation-title">{motivation.title}</h2>
          <p className="evo-motivation-desc">{motivation.desc}</p>
        </div>
      </section>

      {/* ── Grid de métricas ────────────────────────────── */}
      <section className="evo-metrics-grid">
        <MetricCard emoji="✅" value={stats.completedTasks} label="Tarefas concluídas" />
        <MetricCard emoji="📊" value={`${stats.completionRate}%`} label="Taxa de conclusão" />
        <MetricCard emoji="🔥" value={streak > 0 ? `${streak} dias` : '—'} label="Sequência atual" highlight={streak >= 3} />
        <MetricCard emoji="🎯" value={stats.activeGoals} label="Objetivos ativos" />
        <MetricCard emoji="🏆" value={stats.completedGoals} label="Objetivos concluídos" />
        <MetricCard emoji="🏅" value={`${unlockedCount}/${ACHIEVEMENTS.length}`} label="Conquistas" />
      </section>

      {/* ── Sequência atual ─────────────────────────────── */}
      <section className="evo-card">
        <div className="evo-card-header">
          <h3 className="evo-card-title">🔥 Sequência atual</h3>
          {streak > 0 && (
            <span className="evo-streak-badge">{streak} {streak === 1 ? 'dia' : 'dias'}</span>
          )}
        </div>

        {streak === 0 ? (
          <p className="evo-streak-hint">
            Conclua uma tarefa hoje para iniciar sua sequência. Dias consecutivos constroem hábitos duradouros.
          </p>
        ) : (
          <>
            {nextMilestone && (
              <div className="evo-streak-progress-wrap">
                <div className="evo-streak-progress-labels">
                  <span className="evo-streak-progress-current">🔥 {streak} dias</span>
                  <span className="evo-streak-progress-next">Próximo marco: {nextMilestone} dias</span>
                </div>
                <div className="evo-streak-track">
                  <div className="evo-streak-fill" style={{ width: `${streakProgress}%` }} />
                </div>
              </div>
            )}
          </>
        )}

        <div className="evo-card-section-label">Últimos 7 dias</div>
        <WeeklyRhythm tasks={tasks} />
      </section>

      {/* ── Conquistas ──────────────────────────────────── */}
      <section className="evo-card">
        <div className="evo-card-header">
          <h3 className="evo-card-title">🏅 Suas Conquistas</h3>
          <span className="evo-achievements-count">
            {unlockedCount} de {ACHIEVEMENTS.length} desbloqueadas
          </span>
        </div>

        <div className="evo-achievements-grid">
          {ACHIEVEMENTS.map(a => (
            <AchievementBadge
              key={a.key}
              achievement={a}
              unlocked={!!unlockedMap[a.key]}
              unlockedAt={unlockedMap[a.key]}
            />
          ))}
        </div>
      </section>

      {/* ── Objetivos concluídos ─────────────────────────── */}
      {completedGoals.length > 0 && (
        <section className="evo-card">
          <div className="evo-card-header">
            <h3 className="evo-card-title">🏆 Objetivos alcançados</h3>
            <span className="evo-achievements-count">{completedGoals.length}</span>
          </div>
          <div className="evo-completed-goals-list">
            {completedGoals.map(g => (
              <div key={g.id} className="evo-completed-goal-row">
                <span className="evo-completed-goal-icon">{g.icon}</span>
                <span className="evo-completed-goal-title">{g.title}</span>
                {g.updated_at && (
                  <span className="evo-completed-goal-date">{formatDate(g.updated_at)}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Análise detalhada ────────────────────────────── */}
      <section className="evo-charts-row">
        <div className="evo-card evo-chart-card">
          <div className="evo-card-header">
            <h3 className="evo-card-title">
              <PieChart size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              Por categoria
            </h3>
          </div>
          <CategoryDonut tasks={tasks} />
        </div>

        <div className="evo-card evo-chart-card">
          <div className="evo-card-header">
            <h3 className="evo-card-title">
              <BarChart3 size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              Por prioridade
            </h3>
          </div>
          <PriorityBars tasks={tasks} />
        </div>
      </section>
    </div>
  );
}
