import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Target, Sprout, Award, Archive } from 'lucide-react';
import GoalCard from './GoalCard';
import GoalModal from './GoalModal';
import GoalTasksModal from './GoalTasksModal';
import HabitsWidget from './HabitsWidget';
import { useAppContext } from '../contexts/AppContext';

// Estado vazio para cada filtro
function GoalsEmptyState({ filter, onAdd }) {
  const messages = {
    active: {
      icon: <Sprout size={32} style={{ color: 'var(--primary)' }} />,
      title: 'Nenhum objetivo ativo',
      desc: 'Grandes conquistas começam com um objetivo. Defina para onde você quer ir.',
      cta: 'Criar meu primeiro objetivo',
    },
    completed: {
      icon: <Award size={32} style={{ color: 'var(--primary)' }} />,
      title: 'Nenhum objetivo concluído ainda',
      desc: 'Quando você concluir um objetivo, ele aparecerá aqui como uma conquista.',
      cta: null,
    },
    archived: {
      icon: <Archive size={32} style={{ color: 'var(--primary)' }} />,
      title: 'Nenhum objetivo arquivado',
      desc: 'Objetivos pausados ou descontinuados ficam guardados aqui.',
      cta: null,
    },
    all: {
      icon: <Target size={32} style={{ color: 'var(--primary)' }} />,
      title: 'Nenhum objetivo ainda',
      desc: 'Grandes conquistas começam com um objetivo. Defina para onde você quer ir.',
      cta: 'Criar meu primeiro objetivo',
    },
  };

  const msg = messages[filter] || messages.all;

  return (
    <div className="goals-empty-state">
      <div className="goals-empty-icon-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {msg.icon}
      </div>
      <h3 className="goals-empty-title">{msg.title}</h3>
      <p className="goals-empty-desc">{msg.desc}</p>
      {msg.cta && onAdd && (
        <button onClick={onAdd} className="goals-empty-cta">
          <Plus size={15} />
          {msg.cta}
        </button>
      )}
    </div>
  );
}

export default function GoalsView() {
  const {
    goals, goalTasks, tasks,
    handleAddGoal: onAddGoal,
    handleUpdateGoal: onUpdateGoal,
    handleDeleteGoal: onDeleteGoal,
    handleLinkTask: onLinkTask,
    handleUnlinkTask: onUnlinkTask,
    habitsManager,
    shouldOpenGoalModal,
    setShouldOpenGoalModal,
  } = useAppContext();
  const [filter, setFilter] = useState('active');
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [managingGoal, setManagingGoal] = useState(null);

  useEffect(() => {
    if (shouldOpenGoalModal) {
      setShouldOpenGoalModal(false);
      setEditingGoal(null);
      setIsGoalModalOpen(true);
    }
  }, [shouldOpenGoalModal, setShouldOpenGoalModal]);

  // Filtrar objetivos por status
  const filteredGoals = useMemo(() => {
    if (filter === 'all') return goals;
    return goals.filter(g => g.status === filter);
  }, [goals, filter]);

  // Contagens por status
  const counts = useMemo(() => ({
    all: goals.length,
    active: goals.filter(g => g.status === 'active').length,
    completed: goals.filter(g => g.status === 'completed').length,
    archived: goals.filter(g => g.status === 'archived').length,
  }), [goals]);

  // Abrir modal de novo objetivo
  const openNewGoalModal = () => {
    setEditingGoal(null);
    setIsGoalModalOpen(true);
  };

  // Abrir modal de edição
  const openEditGoalModal = (goal) => {
    setEditingGoal(goal);
    setIsGoalModalOpen(true);
  };

  // Salvar objetivo (criar ou editar)
  const handleSaveGoal = (data) => {
    if (editingGoal) {
      onUpdateGoal(editingGoal.id, data);
    } else {
      onAddGoal(data);
    }
    setIsGoalModalOpen(false);
    setEditingGoal(null);
  };

  // Concluir objetivo
  const handleCompleteGoal = (id) => {
    onUpdateGoal(id, { status: 'completed' });
  };

  // Arquivar objetivo
  const handleArchiveGoal = (id) => {
    onUpdateGoal(id, { status: 'archived' });
  };

  // Restaurar objetivo
  const handleRestoreGoal = (id) => {
    onUpdateGoal(id, { status: 'active' });
  };

  // Abrir modal de gerenciamento de tarefas
  const handleManageTasks = (goal) => {
    setManagingGoal(goal);
    setIsTasksModalOpen(true);
  };

  // Obter IDs das tarefas vinculadas ao objetivo em gestão
  const managingGoalLinkedTaskIds = useMemo(() => {
    if (!managingGoal) return [];
    return goalTasks
      .filter(gt => gt.goal_id === managingGoal.id)
      .map(gt => gt.task_id);
  }, [managingGoal, goalTasks]);

  // Obter tarefas vinculadas a um objetivo específico
  const getLinkedTasksForGoal = (goalId) => {
    const linkedIds = goalTasks
      .filter(gt => gt.goal_id === goalId)
      .map(gt => gt.task_id);
    return tasks.filter(t => linkedIds.includes(t.id));
  };

  const filters = [
    { key: 'active', label: 'Ativos' },
    { key: 'completed', label: 'Concluídos' },
    { key: 'archived', label: 'Arquivados' },
    { key: 'all', label: 'Todos' },
  ];

  return (
    <div className="goals-view animate-fade-in">

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="goals-page-header">
        <div className="goals-page-title-block">
          <h1 className="goals-page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={24} style={{ color: 'var(--primary)' }} /> Meus Objetivos</h1>
          <p className="goals-page-subtitle">
            {counts.active > 0
              ? `${counts.active} objetivo${counts.active > 1 ? 's' : ''} ativo${counts.active > 1 ? 's' : ''}`
              : 'Defina seus próximos grandes passos'}
            {counts.completed > 0 && ` · ${counts.completed} concluído${counts.completed > 1 ? 's' : ''}`}
          </p>
        </div>

        <button
          onClick={openNewGoalModal}
          className="goals-add-btn btn-primary-glow"
          id="btn-novo-objetivo"
        >
          <Plus size={16} />
          <span>Novo Objetivo</span>
        </button>
      </div>

      {/* ── Seção de Hábitos ────────────────────────────── */}
      <HabitsWidget habitsManager={habitsManager} goals={goals} />

      {/* ── Filtros ──────────────────────────────────────── */}
      <div className="goals-filter-row">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`goals-filter-pill ${filter === key ? 'active' : ''}`}
          >
            {label}
            <span className="goals-filter-count">{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* ── Lista de Objetivos ──────────────────────────── */}
      {filteredGoals.length === 0 ? (
        <GoalsEmptyState
          filter={filter}
          onAdd={filter === 'active' || filter === 'all' ? openNewGoalModal : null}
        />
      ) : (
        <div className="goals-grid">
          {filteredGoals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              linkedTasks={getLinkedTasksForGoal(goal.id)}
              onEdit={openEditGoalModal}
              onComplete={handleCompleteGoal}
              onArchive={handleArchiveGoal}
              onRestore={handleRestoreGoal}
              onDelete={onDeleteGoal}
              onManageTasks={handleManageTasks}
            />
          ))}
        </div>
      )}

      {/* ── Modais ──────────────────────────────────────── */}
      {isGoalModalOpen && (
        <GoalModal
          isOpen={isGoalModalOpen}
          onClose={() => { setIsGoalModalOpen(false); setEditingGoal(null); }}
          onSave={handleSaveGoal}
          onDelete={() => { onDeleteGoal(editingGoal.id); setIsGoalModalOpen(false); setEditingGoal(null); }}
          editingGoal={editingGoal}
        />
      )}

      <GoalTasksModal
        isOpen={isTasksModalOpen}
        onClose={() => { setIsTasksModalOpen(false); setManagingGoal(null); }}
        goal={managingGoal}
        tasks={tasks}
        linkedTaskIds={managingGoalLinkedTaskIds}
        onLink={(taskId) => onLinkTask(managingGoal.id, taskId)}
        onUnlink={(taskId) => onUnlinkTask(managingGoal.id, taskId)}
      />
    </div>
  );
}
