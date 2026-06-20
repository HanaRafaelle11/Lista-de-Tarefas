import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Target, Sprout, Award, Archive, Sparkles, X, AlertTriangle } from 'lucide-react';
import GoalCard from './GoalCard';
import GoalModal from './GoalModal';
import GoalTasksModal from './GoalTasksModal';
import HabitsWidget from './HabitsWidget';
import Skeleton from './Skeleton';
import { useAppContext } from '../contexts/AppContext';
import { GOAL_TEMPLATES } from '../data/taskTemplates';

// Estado vazio para cada filtro
function GoalsEmptyState({ filter, onAdd, hasAnyGoals }) {
  const messages = {
    active: {
      icon: <Sprout size={32} style={{ color: 'var(--primary)' }} />,
      title: 'Nenhum objetivo ativo',
      desc: 'Grandes conquistas começam com um objetivo. Defina para onde você quer ir.',
      cta: hasAnyGoals ? 'Criar novo objetivo' : 'Criar meu primeiro objetivo',
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
      cta: hasAnyGoals ? 'Criar novo objetivo' : 'Criar meu primeiro objetivo',
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
    handleUpdateTask: onUpdateTask,
    habitsManager,
    shouldOpenGoalModal,
    setShouldOpenGoalModal,
    isInitializing,
    handleBulkDeleteCompletedGoals,
    handleDeleteAllGoals
  } = useAppContext();
  const [filter, setFilter] = useState('active');
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [isTemplatesDrawerOpen, setIsTemplatesDrawerOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [managingGoal, setManagingGoal] = useState(null);
  // Confirmation dialog for completing a goal with incomplete linked tasks
  const [pendingCompleteGoalId, setPendingCompleteGoalId] = useState(null);

  const [showBulkConfirmCompleted, setShowBulkConfirmCompleted] = useState(false);
  const [showBulkConfirmAll, setShowBulkConfirmAll] = useState(false);

  useEffect(() => {
    if (shouldOpenGoalModal) {
      setShouldOpenGoalModal(false);
      setEditingGoal(null);
      setIsGoalModalOpen(true);
    }
  }, [shouldOpenGoalModal, setShouldOpenGoalModal]);

  const activeGoals = useMemo(() => {
    return (goals || []).filter(g => !g.deletedAt);
  }, [goals]);

  // Filtrar objetivos por status
  const filteredGoals = useMemo(() => {
    if (filter === 'all') return activeGoals;
    return activeGoals.filter(g => g.status === filter);
  }, [activeGoals, filter]);

  // Contagens por status
  const counts = useMemo(() => ({
    all: activeGoals.length,
    active: activeGoals.filter(g => g.status === 'active').length,
    completed: activeGoals.filter(g => g.status === 'completed').length,
    archived: activeGoals.filter(g => g.status === 'archived').length,
  }), [activeGoals]);

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

  // Concluir objetivo — verifica tarefas vinculadas incompletas
  const handleCompleteGoal = (id) => {
    const linkedIds = goalTasks.filter(gt => gt.goal_id === id).map(gt => gt.task_id);
    const incompleteLinked = tasks.filter(t => linkedIds.includes(t.id) && !t.completed);
    if (incompleteLinked.length > 0) {
      setPendingCompleteGoalId(id);
    } else {
      onUpdateGoal(id, { status: 'completed' });
    }
  };

  const confirmCompleteGoalWithTasks = () => {
    if (!pendingCompleteGoalId) return;
    const linkedIds = goalTasks.filter(gt => gt.goal_id === pendingCompleteGoalId).map(gt => gt.task_id);
    const incompleteLinked = tasks.filter(t => linkedIds.includes(t.id) && !t.completed);
    incompleteLinked.forEach(t => onUpdateTask(t.id, { completed: true }));
    onUpdateGoal(pendingCompleteGoalId, { status: 'completed' });
    setPendingCompleteGoalId(null);
  };

  const confirmCompleteGoalWithoutTasks = () => {
    if (!pendingCompleteGoalId) return;
    onUpdateGoal(pendingCompleteGoalId, { status: 'completed' });
    setPendingCompleteGoalId(null);
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

        <div 
          className="no-scrollbar"
          style={{ 
            display: 'flex', 
            gap: '10px', 
            overflowX: 'auto', 
            width: '100%', 
            whiteSpace: 'nowrap',
            paddingBottom: '4px',
            flexShrink: 0
          }}
        >
          <button
            onClick={() => setIsTemplatesDrawerOpen(true)}
            className="goals-add-btn"
            style={{
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              border: '1px solid var(--primary)',
            }}
          >
            <Sparkles size={16} />
            <span>Modelos Prontos</span>
          </button>

          <button
            onClick={openNewGoalModal}
            className="goals-add-btn btn-primary-glow"
            id="btn-novo-objetivo"
          >
            <Plus size={16} />
            <span>Novo Objetivo</span>
          </button>
        </div>
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

      {/* Botões de limpeza em lote de objetivos */}
      {activeGoals.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '12px', marginBottom: '8px', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* Limpar concluídos */}
          {counts.completed > 0 && (
            <div>
              {showBulkConfirmCompleted ? (
                <div
                  className="animate-fade-in"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                    background: 'color-mix(in srgb, var(--danger) 10%, var(--bg-card))',
                    border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                    fontSize: '12.5px', color: 'var(--text-main)'
                  }}
                >
                  <span>Remover {counts.completed} objetivo{counts.completed > 1 ? 's' : ''} concluído{counts.completed > 1 ? 's' : ''}?</span>
                  <button
                    onClick={() => {
                      handleBulkDeleteCompletedGoals();
                      setShowBulkConfirmCompleted(false);
                    }}
                    className="btn-confirm-danger"
                    style={{
                      padding: '4px 10px', borderRadius: '4px',
                      fontSize: '11.5px', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    Sim, remover
                  </button>
                  <button
                    onClick={() => setShowBulkConfirmCompleted(false)}
                    style={{
                      background: 'none', border: '1px solid var(--border-medium)',
                      color: 'var(--text-main)', padding: '3px 8px', borderRadius: '4px',
                      fontSize: '11.5px', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBulkConfirmCompleted(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', fontSize: '12px', fontWeight: '600',
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)',
                    background: 'var(--bg-card)', color: 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  title={`Apagar os ${counts.completed} objetivos concluídos`}
                >
                  <span>🗑 Limpar concluídos ({counts.completed})</span>
                </button>
              )}
            </div>
          )}

          {/* Apagar todos */}
          {counts.all > 0 && (
            <div>
              {showBulkConfirmAll ? (
                <div
                  className="animate-fade-in"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                    background: 'color-mix(in srgb, var(--danger) 10%, var(--bg-card))',
                    border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                    fontSize: '12.5px', color: 'var(--text-main)'
                  }}
                >
                  <span>Remover todos os {counts.all} objetivos?</span>
                  <button
                    onClick={() => {
                      handleDeleteAllGoals();
                      setShowBulkConfirmAll(false);
                    }}
                    className="btn-confirm-danger"
                    style={{
                      padding: '4px 10px', borderRadius: '4px',
                      fontSize: '11.5px', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    Sim, remover
                  </button>
                  <button
                    onClick={() => setShowBulkConfirmAll(false)}
                    style={{
                      background: 'none', border: '1px solid var(--border-medium)',
                      color: 'var(--text-main)', padding: '3px 8px', borderRadius: '4px',
                      fontSize: '11.5px', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBulkConfirmAll(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', fontSize: '12px', fontWeight: '600',
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)',
                    background: 'var(--bg-card)', color: 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  title="Apagar todos os objetivos"
                >
                  <span>🗑 Apagar todos ({counts.all})</span>
                </button>
              )}
            </div>
          )}

        </div>
      )}

      {/* ── Lista de Objetivos ──────────────────────────── */}
      {isInitializing ? (
        <div className="goals-grid" style={{ marginTop: '24px' }}>
          <Skeleton height="180px" width="100%" borderRadius="var(--radius-md)" />
          <Skeleton height="180px" width="100%" borderRadius="var(--radius-md)" />
          <Skeleton height="180px" width="100%" borderRadius="var(--radius-md)" />
        </div>
      ) : filteredGoals.length === 0 ? (
        <GoalsEmptyState
          filter={filter}
          onAdd={filter === 'active' || filter === 'all' ? openNewGoalModal : null}
          hasAnyGoals={goals.length > 0}
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

      {/* Drawer de Templates de Objetivos */}
      <div 
        className={`templates-drawer-overlay ${isTemplatesDrawerOpen ? 'open' : ''}`}
        onClick={() => setIsTemplatesDrawerOpen(false)}
        style={{ zIndex: 10000 }}
      >
        <div 
          className="templates-drawer"
          onClick={e => e.stopPropagation()}
        >
          <div className="templates-drawer-header">
            <h3 className="templates-drawer-title">
              <Sparkles size={18} style={{ color: 'var(--primary)' }} />
              Modelos de Objetivos
            </h3>
            <button 
              className="templates-drawer-close"
              onClick={() => setIsTemplatesDrawerOpen(false)}
              aria-label="Fechar modelos"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="templates-drawer-body">
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
              Importe um modelo de objetivo macro estruturado com sugestões de tarefas integradas para acelerar o seu progresso.
            </p>
            
            {GOAL_TEMPLATES.map(template => {
              const isAlreadyActive = goals.some(g => g.title === template.title && g.status === 'active');
              
              const handleImportGoal = () => {
                if (isAlreadyActive) return;
                onAddGoal({
                  title: template.title,
                  description: template.description,
                  color: template.color,
                  icon: template.icon,
                  actions: template.actions
                });
                setIsTemplatesDrawerOpen(false);
              };

              return (
                <div 
                  key={template.id} 
                  className={`template-persona-card ${isAlreadyActive ? 'template-disabled-card' : ''}`}
                >
                  <h4 className="template-persona-title">
                    <span style={{ fontSize: '16px', marginRight: '6px' }}>{template.icon}</span>
                    {template.title}
                  </h4>
                  <p className="template-persona-desc">{template.description}</p>
                  
                  {isAlreadyActive && (
                    <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} /> Objetivo já ativo
                    </div>
                  )}

                  <div className="template-tasks-preview" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px', marginTop: '10px' }}>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>Sub-tarefas inclusas:</span>
                    {template.actions.map((act, i) => (
                      <div key={i} className="template-task-item">
                        <span className="template-task-item-bullet" style={{ backgroundColor: template.color }} />
                        <span style={{ fontWeight: '500' }}>{act}</span>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    className="template-load-btn"
                    onClick={handleImportGoal}
                    disabled={isAlreadyActive}
                    style={{
                      border: `1px solid ${template.color}`,
                      color: template.color,
                      backgroundColor: `${template.color}15`
                    }}
                  >
                    <Plus size={14} />
                    {isAlreadyActive ? 'Objetivo Ativo' : 'Importar Objetivo'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Diálogo de confirmação: concluir tarefas vinculadas ── */}
      {pendingCompleteGoalId && (() => {
        const linkedIds = goalTasks.filter(gt => gt.goal_id === pendingCompleteGoalId).map(gt => gt.task_id);
        const incompleteLinked = tasks.filter(t => linkedIds.includes(t.id) && !t.completed);
        return (
          <div
            className="modal-overlay"
            style={{ zIndex: 10001 }}
            onClick={() => setPendingCompleteGoalId(null)}
          >
            <div
              className="modal-content animate-scale-up"
              style={{ maxWidth: '420px', padding: '28px', textAlign: 'center' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🏆</div>
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>
                Concluir objetivo
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>
                Você tem <strong>{incompleteLinked.length} {incompleteLinked.length === 1 ? 'tarefa vinculada ainda aberta' : 'tarefas vinculadas ainda abertas'}</strong>.
                Deseja marcá-{incompleteLinked.length === 1 ? 'la' : 'las'} como concluída{incompleteLinked.length === 1 ? '' : 's'} também?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={confirmCompleteGoalWithTasks}
                  className="btn-primary-glow"
                  style={{ padding: '12px 24px', width: '100%', fontSize: '14px', fontWeight: '700' }}
                >
                  ✅ Concluir objetivo e tarefas
                </button>
                <button
                  onClick={confirmCompleteGoalWithoutTasks}
                  style={{
                    padding: '11px 24px',
                    width: '100%',
                    fontSize: '13px',
                    fontWeight: '600',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  Apenas concluir o objetivo
                </button>
                <button
                  onClick={() => setPendingCompleteGoalId(null)}
                  style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
