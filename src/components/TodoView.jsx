import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, X, Calendar, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
import TodoItem from './TodoItem';
import WeeklyPlannerModal from './WeeklyPlannerModal';
import { useAppContext } from '../contexts/AppContext';

// Helper: retorna a data local zerada como string YYYY-MM-DD
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const endOfWeekStr = () => {
  const d = new Date();
  const dayOfWeek = d.getDay(); // 0=dom, 6=sab
  const daysUntilSunday = 7 - dayOfWeek;
  d.setDate(d.getDate() + daysUntilSunday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Organiza tarefas em seções temporais
function categorizeTasks(tasks) {
  const today = todayStr();
  const tomorrow = tomorrowStr();
  const endOfWeek = endOfWeekStr();

  const sections = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    future: [],
    noDueDate: [],
    completed: [],
  };

  tasks.forEach(task => {
    if (task.completed) {
      sections.completed.push(task);
      return;
    }
    if (!task.dueDate) {
      sections.noDueDate.push(task);
      return;
    }
    if (task.dueDate < today) {
      sections.overdue.push(task);
    } else if (task.dueDate === today) {
      sections.today.push(task);
    } else if (task.dueDate === tomorrow) {
      sections.tomorrow.push(task);
    } else if (task.dueDate <= endOfWeek) {
      sections.thisWeek.push(task);
    } else {
      sections.future.push(task);
    }
  });

  return sections;
}

// Prioridade como número para ordenação
const priorityOrder = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
const sortByPriority = (tasks) =>
  [...tasks].sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

// Componente de Seção colapsável
function TaskSection({ title, tasks, icon, accent, onEdit, onDelete, onToggle, defaultOpen = true, isOverdue = false }) {
  const [open, setOpen] = useState(defaultOpen);

  if (tasks.length === 0) return null;

  return (
    <div className={`task-section ${isOverdue ? 'task-section--overdue' : ''}`}>
      <button
        className="task-section-header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="task-section-header-left">
          <span className="task-section-icon">{icon}</span>
          <span className="task-section-title">{title}</span>
          <span className="task-section-count">{tasks.length}</span>
        </div>
        <span className="task-section-chevron">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {open && (
        <div className="task-section-list animate-fade-in">
          {sortByPriority(tasks).map(task => (
            <TodoItem
              key={task.id}
              item={task}
              onToggleComplete={onToggle}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Estado vazio inteligente
function EmptyState({ filter, searchQuery, onAdd }) {
  if (searchQuery) {
    return (
      <div className="tasks-empty-state">
        <div className="tasks-empty-icon-wrap">
          <span className="tasks-empty-emoji">🔍</span>
        </div>
        <h3 className="tasks-empty-title">Nenhum resultado</h3>
        <p className="tasks-empty-desc">Nenhuma tarefa corresponde a "<strong>{searchQuery}</strong>". Tente outras palavras.</p>
      </div>
    );
  }

  if (filter === 'completed') {
    return (
      <div className="tasks-empty-state">
        <div className="tasks-empty-icon-wrap">
          <span className="tasks-empty-emoji">✨</span>
        </div>
        <h3 className="tasks-empty-title">Nenhuma tarefa concluída ainda</h3>
        <p className="tasks-empty-desc">Complete suas primeiras tarefas e elas aparecerão aqui como conquistas.</p>
      </div>
    );
  }

  if (filter === 'active') {
    return (
      <div className="tasks-empty-state tasks-empty-state--celebrate">
        <div className="tasks-empty-icon-wrap">
          <span className="tasks-empty-emoji">🎉</span>
        </div>
        <h3 className="tasks-empty-title">Tudo em dia!</h3>
        <p className="tasks-empty-desc">Você não tem nenhuma tarefa pendente. Momento perfeito para planejar seus próximos passos.</p>
        <button onClick={onAdd} className="tasks-empty-cta">
          <Plus size={15} />
          Planejar próxima tarefa
        </button>
      </div>
    );
  }

  return (
    <div className="tasks-empty-state">
      <div className="tasks-empty-icon-wrap">
        <span className="tasks-empty-emoji">🌱</span>
      </div>
      <h3 className="tasks-empty-title">Sua lista está em branco</h3>
      <p className="tasks-empty-desc">Comece criando sua primeira tarefa. Pequenos passos constroem grandes conquistas.</p>
      <button onClick={onAdd} className="tasks-empty-cta">
        <Plus size={15} />
        Criar primeira tarefa
      </button>
    </div>
  );
}

export default function TodoView() {
  const {
    tasks,
    handleAddTask: onAddTask,
    handleUpdateTask: onUpdateTask,
    handleDeleteTask: onDeleteTask,
    handleToggleComplete: onToggleComplete,
  } = useAppContext();
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  // Abertura automática se o usuário não tem tarefas criadas (onboarding reativo)
  useEffect(() => {
    if (tasks.length === 0) {
      setIsModalOpen(true);
    }
  }, [tasks.length]);

  // Estados do formulário
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Trabalho');
  const [priority, setPriority] = useState('Média');
  const [dueDate, setDueDate] = useState('');

  const openNewTaskModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setCategory('Trabalho');
    setPriority('Média');
    setDueDate('');
    setIsModalOpen(true);
  };

  const openEditTaskModal = (task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setCategory(task.category);
    setPriority(task.priority);
    setDueDate(task.dueDate || '');
    setIsModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const taskData = {
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      dueDate: dueDate || null
    };

    if (editingTask) {
      onUpdateTask(editingTask.id, taskData);
    } else {
      onAddTask(taskData);
    }

    setIsModalOpen(false);
  };

  // Filtragem base
  const baseFiltered = useMemo(() => tasks.filter(task => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = task.title.toLowerCase().includes(q) ||
      (task.description && task.description.toLowerCase().includes(q));

    const matchesStatus =
      filter === 'all' ? true :
      filter === 'active' ? !task.completed :
      task.completed;

    const matchesCat = categoryFilter === 'all' || task.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCat;
  }), [tasks, filter, searchQuery, categoryFilter]);

  const sections = useMemo(() => categorizeTasks(baseFiltered), [baseFiltered]);

  // Estatísticas rápidas
  const total = tasks.length;
  const active = tasks.filter(t => !t.completed).length;
  const completed = tasks.filter(t => t.completed).length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const hasTasks = baseFiltered.length > 0;
  const categories = ['all', 'Trabalho', 'Pessoal', 'Estudos', 'Lazer'];
  const catEmoji = { Trabalho: '💼', Pessoal: '🏠', Estudos: '📚', Lazer: '🎸' };

  return (
    <div className="tasks-view animate-fade-in">

      {/* ── Header da tela ──────────────────────────────── */}
      <div className="tasks-page-header">
        <div className="tasks-page-title-block">
          <h1 className="tasks-page-title">Tarefas</h1>
          <p className="tasks-page-subtitle">
            {active > 0
              ? `${active} pendente${active > 1 ? 's' : ''} · ${rate}% concluído`
              : rate === 100 && total > 0
              ? '🎉 Tudo concluído!'
              : 'Nenhuma tarefa ainda'}
          </p>
        </div>

        {/* Barra de progresso global */}
        {total > 0 && (
          <div className="tasks-global-progress">
            <div className="tasks-progress-track">
              <div
                className="tasks-progress-fill"
                style={{ width: `${rate}%` }}
              />
            </div>
            <span className="tasks-progress-label">{rate}%</span>
          </div>
        )}
      </div>

      {/* ── Controles: Busca + Filtros + Botão ──────────── */}
      <div className="tasks-controls">
        {/* Busca */}
        <div className="tasks-search-wrap">
          <Search size={15} className="tasks-search-icon" />
          <input
            type="text"
            placeholder="Buscar tarefas..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="tasks-search-input"
            id="tasks-search"
          />
          {searchQuery && (
            <button
              className="tasks-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setIsPlannerOpen(true)} className="tasks-add-btn" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-medium)' }}>
            <Calendar size={16} />
            <span className="hide-on-mobile">Planejar Semana</span>
          </button>
          <button onClick={openNewTaskModal} className="tasks-add-btn btn-primary-glow" id="btn-nova-tarefa">
            <Plus size={16} />
            <span>Nova Tarefa</span>
          </button>
        </div>
      </div>

      {/* ── Filtros de Status ────────────────────────────── */}
      <div className="tasks-filter-row">
        <div className="tasks-status-pills">
          {[
            { key: 'all', label: 'Todas', count: total },
            { key: 'active', label: 'Pendentes', count: active },
            { key: 'completed', label: 'Concluídas', count: completed },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`tasks-status-pill ${filter === key ? 'active' : ''}`}
            >
              {label}
              <span className="tasks-pill-badge">{count}</span>
            </button>
          ))}
        </div>

        {/* Filtro de categoria */}
        <div className="tasks-cat-pills">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`tasks-cat-pill ${categoryFilter === cat ? 'active' : ''}`}
            >
              {cat === 'all' ? 'Todas' : `${catEmoji[cat]} ${cat}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Conteúdo Principal ───────────────────────────── */}
      {hasTasks ? (
        <div className="tasks-sections-wrapper">
          {/* Atrasadas */}
          <TaskSection
            title="Atrasadas"
            icon="⚠️"
            accent="overdue"
            tasks={sections.overdue}
            onEdit={openEditTaskModal}
            onDelete={onDeleteTask}
            onToggle={onToggleComplete}
            defaultOpen={true}
            isOverdue={true}
          />

          {/* Hoje */}
          <TaskSection
            title="Hoje"
            icon="☀️"
            tasks={sections.today}
            onEdit={openEditTaskModal}
            onDelete={onDeleteTask}
            onToggle={onToggleComplete}
            defaultOpen={true}
          />

          {/* Amanhã */}
          <TaskSection
            title="Amanhã"
            icon="🌙"
            tasks={sections.tomorrow}
            onEdit={openEditTaskModal}
            onDelete={onDeleteTask}
            onToggle={onToggleComplete}
            defaultOpen={true}
          />

          {/* Esta semana */}
          <TaskSection
            title="Esta semana"
            icon="📅"
            tasks={sections.thisWeek}
            onEdit={openEditTaskModal}
            onDelete={onDeleteTask}
            onToggle={onToggleComplete}
            defaultOpen={true}
          />

          {/* Futuras */}
          <TaskSection
            title="Futuras"
            icon="🚀"
            tasks={sections.future}
            onEdit={openEditTaskModal}
            onDelete={onDeleteTask}
            onToggle={onToggleComplete}
            defaultOpen={false}
          />

          {/* Sem prazo */}
          <TaskSection
            title="Sem prazo definido"
            icon="📌"
            tasks={sections.noDueDate}
            onEdit={openEditTaskModal}
            onDelete={onDeleteTask}
            onToggle={onToggleComplete}
            defaultOpen={false}
          />

          {/* Concluídas */}
          <TaskSection
            title="Concluídas"
            icon="✅"
            tasks={sections.completed}
            onEdit={openEditTaskModal}
            onDelete={onDeleteTask}
            onToggle={onToggleComplete}
            defaultOpen={false}
          />
        </div>
      ) : (
        <EmptyState
          filter={filter}
          searchQuery={searchQuery}
          onAdd={openNewTaskModal}
        />
      )}

      {/* ── Modal de Criar / Editar Tarefa ──────────────── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content tasks-modal animate-scale-up" onClick={e => e.stopPropagation()}>
            {/* Header do Modal */}
            <div className="todo-modal-header">
              <div className="tasks-modal-title-wrap">
                <span className="tasks-modal-icon">{editingTask ? '✏️' : '✨'}</span>
                <h2 className="todo-modal-title">
                  {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="todo-modal-close-btn" aria-label="Fechar modal">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="todo-modal-form">
              {/* Título */}
              <div className="todo-form-group">
                <label className="todo-form-label" htmlFor="task-title">Título da Tarefa *</label>
                <input
                  id="task-title"
                  type="text"
                  placeholder="Ex: Preparar apresentação do projeto"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="todo-modal-input"
                  required
                  autoFocus
                />
              </div>

              {/* Descrição */}
              <div className="todo-form-group">
                <label className="todo-form-label" htmlFor="task-desc">Descrição (opcional)</label>
                <textarea
                  id="task-desc"
                  placeholder="Adicione detalhes, contexto ou próximos passos..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="todo-modal-textarea"
                />
              </div>

              {/* Categoria + Prioridade */}
              <div className="todo-form-row">
                <div className="todo-form-group flex-1">
                  <label className="todo-form-label" htmlFor="task-cat">Categoria</label>
                  <select
                    id="task-cat"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="todo-modal-select"
                  >
                    <option value="Trabalho">💼 Trabalho</option>
                    <option value="Pessoal">🏠 Pessoal</option>
                    <option value="Estudos">📚 Estudos</option>
                    <option value="Lazer">🎸 Lazer</option>
                  </select>
                </div>

                <div className="todo-form-group flex-1">
                  <label className="todo-form-label" htmlFor="task-prio">Prioridade</label>
                  <select
                    id="task-prio"
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="todo-modal-select"
                  >
                    <option value="Alta">🔴 Alta</option>
                    <option value="Média">🟡 Média</option>
                    <option value="Baixa">🟢 Baixa</option>
                  </select>
                </div>
              </div>

              {/* Data de Vencimento */}
              <div className="todo-form-group">
                <label className="todo-form-label" htmlFor="task-date">Data de Vencimento</label>
                <div className="todo-date-input-wrapper">
                  <Calendar size={15} className="todo-date-icon" />
                  <input
                    id="task-date"
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="todo-modal-date-input"
                  />
                </div>
              </div>

              {/* Ações */}
              <div className="todo-modal-actions">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="todo-modal-cancel-btn"
                >
                  Cancelar
                </button>
                <button type="submit" className="todo-modal-save-btn btn-primary-glow">
                  {editingTask ? 'Salvar Alterações' : 'Criar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Planejamento ─────────────────────── */}
      <WeeklyPlannerModal 
        isOpen={isPlannerOpen}
        onClose={() => setIsPlannerOpen(false)}
        tasks={tasks}
        onUpdateTask={onUpdateTask}
      />
    </div>
  );
}
