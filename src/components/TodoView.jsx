import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { 
  Plus, Search, X, Calendar, ChevronDown, ChevronRight, 
  List, Columns, Grid, Trash2, Edit2, AlertCircle, ArrowLeft, ArrowRight
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import TodoItem from './TodoItem';
const WeeklyPlannerModal = lazy(() => import('./WeeklyPlannerModal'));
import { 
  useAppContext, 
  parseTaskMetadata, 
  formatDescriptionWithoutMetadata, 
  buildDescriptionWithMetadata 
} from '../contexts/AppContext';

// Helpers de data local
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
  const dayOfWeek = d.getDay();
  const daysUntilSunday = 7 - dayOfWeek;
  d.setDate(d.getDate() + daysUntilSunday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function formatFriendlyDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${parts[2]} de ${months[parseInt(parts[1]) - 1]} de ${parts[0]}`;
}

// Categorizar tarefas
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

const priorityOrder = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
const sortByPriority = (tasks) =>
  [...tasks].sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

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
    categories,
    handleAddCategory,
    handleDeleteCategory,
    habitsManager,
    logEvent
  } = useAppContext();

  // Estados locais
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  // Bloco 4 - Visualização
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('flowday_tasks_view_mode') || 'list');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');

  // Configurações do Calendário
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  // Categorias customizadas
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('🏷️');
  const [newCatColor, setNewCatColor] = useState('#6B7F8A');

  // Formulário de tarefa
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('Média');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [recurrence, setRecurrence] = useState('nenhuma');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Salva modo de visualização e rastreia analytics
  useEffect(() => {
    localStorage.setItem('flowday_tasks_view_mode', viewMode);
    if (viewMode === 'calendar') {
      logEvent('calendar_viewed');
    } else if (viewMode === 'kanban') {
      logEvent('kanban_viewed');
    }
  }, [viewMode, logEvent]);

  // Abertura automática no primeiro uso
  useEffect(() => {
    if (tasks.length === 0) {
      setIsModalOpen(true);
    }
  }, [tasks.length]);

  const openNewTaskModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setCategory(categories[0]?.id || 'Trabalho');
    setPriority('Média');
    setDueDate('');
    setDueTime('');
    setRecurrence('nenhuma');
    setIsModalOpen(true);
  };

  const openEditTaskModal = (task) => {
    setEditingTask(task);
    setTitle(task.title);
    
    const meta = parseTaskMetadata(task.description);
    const cleanDesc = formatDescriptionWithoutMetadata(task.description);
    
    setDescription(cleanDesc);
    setCategory(task.category);
    setPriority(task.priority);
    setDueDate(task.dueDate || '');
    setDueTime(meta.due_time || '');
    setRecurrence(meta.recurrence || 'nenhuma');
    
    setIsModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Constrói descrição serializada com metadados de time/recurrence
    const metaDescription = buildDescriptionWithMetadata(description, dueTime, recurrence);

    const taskData = {
      title: title.trim(),
      description: metaDescription,
      category,
      priority,
      dueDate: dueDate || null
    };

    if (editingTask) {
      onUpdateTask(editingTask.id, taskData);
    } else {
      onAddTask(taskData);
    }

    // Limpar state após salvar
    setTitle('');
    setDescription('');
    setDueDate('');
    setDueTime('');
    setCategory('Trabalho');
    setPriority('Média');
    setRecurrence('nenhuma');
    setIsModalOpen(false);
  };

  // Caixa de Entrada Rápida
  const handleQuickAddSubmit = (e) => {
    if (e.key === 'Enter' && quickTitle.trim()) {
      const metaDescription = buildDescriptionWithMetadata('', '', 'nenhuma');
      onAddTask({
        title: quickTitle.trim(),
        description: metaDescription,
        category: categories[0]?.id || 'Trabalho',
        priority: 'Média',
        dueDate: null
      });
      setQuickTitle('');
    }
  };

  // CRUD de categorias locais
  const handleCreateCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const catId = newCatName.trim();
    handleAddCategory({
      id: catId,
      name: newCatName.trim(),
      emoji: newCatEmoji,
      color: newCatColor
    });
    setNewCatName('');
  };

  // Filtragem de tarefas
  const baseFiltered = useMemo(() => {
    return tasks.filter(task => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = task.title.toLowerCase().includes(q) ||
        (task.description && task.description.toLowerCase().includes(q));

      const matchesStatus =
        filter === 'all' ? true :
        filter === 'active' ? !task.completed :
        task.completed;

      const matchesCat = categoryFilter === 'all' || task.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCat;
    });
  }, [tasks, filter, searchQuery, categoryFilter]);

  const sections = useMemo(() => categorizeTasks(baseFiltered), [baseFiltered]);

  // Estatísticas rápidas
  const total = tasks.length;
  const active = tasks.filter(t => !t.completed).length;
  const completed = tasks.filter(t => t.completed).length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Lógica Kanban
  const kanbanTasks = useMemo(() => {
    const list = { todo: [], inProgress: [], completed: [] };
    baseFiltered.forEach(task => {
      if (task.completed) {
        list.completed.push(task);
      } else {
        const meta = parseTaskMetadata(task.description);
        if (meta.kanban_status === 'in_progress') {
          list.inProgress.push(task);
        } else {
          list.todo.push(task);
        }
      }
    });
    return list;
  }, [baseFiltered]);

  const handleMoveKanban = (task, nextCol) => {
    const isCompleted = nextCol === 'completed';
    const wasCompleted = task.completed;
    
    const meta = parseTaskMetadata(task.description);
    const updatedMeta = { ...meta, kanban_status: nextCol };
    const nextDesc = `${formatDescriptionWithoutMetadata(task.description)}\n\n--flowday-meta--\n${JSON.stringify(updatedMeta)}`;
    
    // We update description and completed status in a single pass
    const updates = { description: nextDesc };
    if (isCompleted !== wasCompleted) {
      updates.completed = isCompleted;
      updates.completedAt = isCompleted ? new Date().toISOString() : null;
    }
    
    onUpdateTask(task.id, updates);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      handleMoveKanban(task, status);
    }
  };

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  // Lógica Calendário
  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Dias do mês anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const date = new Date(year, month - 1, dayNum);
      const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      cells.push({ dayNumber: dayNum, dateStr: dStr, isCurrentMonth: false, isToday: false });
    }

    // Dias do mês atual
    const today = todayStr();
    for (let i = 1; i <= daysInMonth; i++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({ dayNumber: i, dateStr: dStr, isCurrentMonth: true, isToday: dStr === today });
    }

    // Dias do mês seguinte
    let nextDay = 1;
    while (cells.length < 42) {
      const date = new Date(year, month + 1, nextDay);
      const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      cells.push({ dayNumber: nextDay, dateStr: dStr, isCurrentMonth: false, isToday: false });
      nextDay++;
    }

    return cells;
  }, [currentMonth]);

  const changeMonth = (offset) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const getMonthName = () => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  };

  return (
    <div className="tasks-view animate-fade-in">

      {/* ── Header da página ──────────────────────────────── */}
      <div className="tasks-page-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
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

        {/* Seletor de visualização (Abas Bloco 4) */}
        <div className="navbar-navigation" style={{ display: 'inline-flex', padding: '4px', borderRadius: 'var(--radius-md)', background: 'var(--primary-glow)', alignSelf: 'center' }}>
          {[
            { key: 'list', label: 'Lista', icon: <List size={16} /> },
            { key: 'kanban', label: 'Kanban', icon: <Columns size={16} /> },
            { key: 'calendar', label: 'Agenda', icon: <Grid size={16} /> }
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setViewMode(item.key)}
              className={`nav-tab-button ${viewMode === item.key ? 'active-nav-tab' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
            >
              {item.icon}
              <span className="hide-on-mobile">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Caixa de Entrada Rápida (Inbox Bloco 4) */}
      <div className="quick-inbox-container">
        <input 
          type="text" 
          placeholder="⚡ Captura rápida: digite uma tarefa e pressione Enter..."
          value={quickTitle}
          onChange={e => setQuickTitle(e.target.value)}
          onKeyDown={handleQuickAddSubmit}
          className="quick-inbox-input"
        />
      </div>

      {/* Controles de Busca e Criação */}
      <div className="tasks-controls">
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
            <button className="tasks-search-clear" onClick={() => setSearchQuery('')} aria-label="Limpar busca">
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setShowCategoryManager(!showCategoryManager)} 
            className="tasks-add-btn" 
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-medium)' }}
          >
            <span>🏷️ Categorias</span>
          </button>
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

      {/* CRUD/Gerenciador de Categorias Panel */}
      {showCategoryManager && (
        <div className="category-manager-panel animate-fade-in">
          <h4 className="category-manager-title">Gerenciar Categorias Customizadas</h4>
          
          <div className="categories-list">
            {categories.map(cat => {
              // Apenas categorias customizadas possuem id que não é id padrão
              const isCustom = !['Trabalho', 'Pessoal', 'Estudos', 'Lazer'].includes(cat.id);
              return (
                <div key={cat.id} className="category-item-row">
                  <div className="category-item-info">
                    <span style={{ fontSize: '16px' }}>{cat.emoji}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{cat.name}</span>
                    <span className="category-item-color-dot" style={{ backgroundColor: cat.color }} />
                  </div>
                  {isCustom ? (
                    <button 
                      onClick={() => handleDeleteCategory(cat.id)} 
                      style={{ color: '#ef4444', fontSize: '12px', padding: '4px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.08)' }}
                    >
                      Excluir
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-light)', fontStyle: 'italic' }}>Padrão</span>
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleCreateCategory} className="category-form-inline">
            <input 
              type="text" 
              placeholder="Nome da Categoria" 
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              className="form-input category-input-text"
              required
            />
            <div style={{ position: 'relative' }}>
              <button 
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="form-input category-input-emoji"
                style={{ width: '40px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }}
                title="Selecionar Emoji"
              >
                {newCatEmoji || '😀'}
              </button>
              {showEmojiPicker && (
                <div style={{ position: 'absolute', zIndex: 100, bottom: '100%', left: 0, marginBottom: '8px' }}>
                  <EmojiPicker onEmojiClick={(e) => { setNewCatEmoji(e.emoji); setShowEmojiPicker(false); }} theme="auto" />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {['#6B7F8A', '#7A8B7B', '#B09E86', '#A88891', '#4A654E', '#9B6B5A', '#5A6B7A', '#8A6B8A'].map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewCatColor(color)}
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%', backgroundColor: color,
                    border: newCatColor === color ? '2px solid var(--text-main)' : '1px solid var(--border-medium)',
                    cursor: 'pointer', padding: 0
                  }}
                  title="Selecionar cor"
                />
              ))}
            </div>
            <button type="submit" className="btn-primary-glow" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Adicionar
            </button>
          </form>
        </div>
      )}

      {/* Filtros rápidos de Status e Categorias */}
      {viewMode === 'list' && (
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

          <div className="tasks-cat-pills" style={{ overflowX: 'auto', display: 'flex', gap: '6px', paddingBottom: '4px' }}>
            <button
              onClick={() => setCategoryFilter('all')}
              className={`tasks-cat-pill ${categoryFilter === 'all' ? 'active' : ''}`}
            >
              🏷️ Todas
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`tasks-cat-pill ${categoryFilter === cat.id ? 'active' : ''}`}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdos das Abas (Visualizações Bloco 4) */}
      {viewMode === 'list' && (
        <>
          {baseFiltered.length > 0 ? (
            <div className="tasks-sections-wrapper">
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
              <TaskSection
                title="Hoje"
                icon="☀️"
                tasks={sections.today}
                onEdit={openEditTaskModal}
                onDelete={onDeleteTask}
                onToggle={onToggleComplete}
                defaultOpen={true}
              />
              <TaskSection
                title="Amanhã"
                icon="🌙"
                tasks={sections.tomorrow}
                onEdit={openEditTaskModal}
                onDelete={onDeleteTask}
                onToggle={onToggleComplete}
                defaultOpen={true}
              />
              <TaskSection
                title="Esta semana"
                icon="📅"
                tasks={sections.thisWeek}
                onEdit={openEditTaskModal}
                onDelete={onDeleteTask}
                onToggle={onToggleComplete}
                defaultOpen={true}
              />
              <TaskSection
                title="Futuras"
                icon="🚀"
                tasks={sections.future}
                onEdit={openEditTaskModal}
                onDelete={onDeleteTask}
                onToggle={onToggleComplete}
                defaultOpen={false}
              />
              <TaskSection
                title="Sem prazo definido"
                icon="📌"
                tasks={sections.noDueDate}
                onEdit={openEditTaskModal}
                onDelete={onDeleteTask}
                onToggle={onToggleComplete}
                defaultOpen={false}
              />
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
            <EmptyState filter={filter} searchQuery={searchQuery} onAdd={openNewTaskModal} />
          )}
        </>
      )}

      {viewMode === 'kanban' && (
        <div className="kanban-view-container animate-fade-in">
          {/* Coluna 1: A Fazer */}
          <div className="kanban-column" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'todo')}>
            <div className="kanban-column-header">
              <span className="kanban-column-title">📌 A Fazer</span>
              <span className="kanban-column-count">{kanbanTasks.todo.length}</span>
            </div>
            <div className="kanban-cards-list">
              {kanbanTasks.todo.map(task => {
                const meta = parseTaskMetadata(task.description);
                const cleanDesc = formatDescriptionWithoutMetadata(task.description);
                return (
                  <div key={task.id} className="kanban-card" draggable onDragStart={(e) => handleDragStart(e, task.id)}>
                    <span className="kanban-card-title">{task.title}</span>
                    {cleanDesc && <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{cleanDesc}</span>}
                    <div className="kanban-card-meta">
                      <span className={`badge-category ${task.category.toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                        {task.category}
                      </span>
                      <span className={`badge-priority ${task.priority.toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                        {task.priority}
                      </span>
                    </div>
                    {task.dueDate && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        📅 {task.dueDate} {meta.due_time ? `às ${meta.due_time}` : ''}
                      </span>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', alignItems: 'center' }}>
                      <button 
                        onClick={() => handleMoveKanban(task, 'in_progress')}
                        className="todo-item-action-btn edit-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', padding: '4px 8px' }}
                      >
                        Fazer ➔
                      </button>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openEditTaskModal(task)} className="todo-item-action-btn edit-btn"><Edit2 size={13} /></button>
                        <button onClick={() => onDeleteTask(task.id)} className="todo-item-action-btn delete-btn"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna 2: Em Progresso */}
          <div className="kanban-column" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'in_progress')}>
            <div className="kanban-column-header">
              <span className="kanban-column-title">⚡ Em Progresso</span>
              <span className="kanban-column-count">{kanbanTasks.inProgress.length}</span>
            </div>
            <div className="kanban-cards-list">
              {kanbanTasks.inProgress.map(task => {
                const meta = parseTaskMetadata(task.description);
                const cleanDesc = formatDescriptionWithoutMetadata(task.description);
                return (
                  <div key={task.id} className="kanban-card" draggable onDragStart={(e) => handleDragStart(e, task.id)}>
                    <span className="kanban-card-title">{task.title}</span>
                    {cleanDesc && <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{cleanDesc}</span>}
                    <div className="kanban-card-meta">
                      <span className={`badge-category ${task.category.toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                        {task.category}
                      </span>
                      <span className={`badge-priority ${task.priority.toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                        {task.priority}
                      </span>
                    </div>
                    {task.dueDate && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        📅 {task.dueDate} {meta.due_time ? `às ${meta.due_time}` : ''}
                      </span>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => handleMoveKanban(task, 'todo')} className="todo-item-action-btn edit-btn" style={{ fontSize: '11px', padding: '4px 8px' }}>
                          ⬅️
                        </button>
                        <button onClick={() => handleMoveKanban(task, 'completed')} className="todo-item-action-btn edit-btn" style={{ fontSize: '11px', padding: '4px 8px' }}>
                          Concluir ➔
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openEditTaskModal(task)} className="todo-item-action-btn edit-btn"><Edit2 size={13} /></button>
                        <button onClick={() => onDeleteTask(task.id)} className="todo-item-action-btn delete-btn"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna 3: Concluídas */}
          <div className="kanban-column" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'completed')}>
            <div className="kanban-column-header">
              <span className="kanban-column-title">✅ Concluído</span>
              <span className="kanban-column-count">{kanbanTasks.completed.length}</span>
            </div>
            <div className="kanban-cards-list">
              {kanbanTasks.completed.map(task => {
                const meta = parseTaskMetadata(task.description);
                const cleanDesc = formatDescriptionWithoutMetadata(task.description);
                return (
                  <div key={task.id} className="kanban-card" style={{ opacity: 0.75 }} draggable onDragStart={(e) => handleDragStart(e, task.id)}>
                    <span className="kanban-card-title" style={{ textDecoration: 'line-through' }}>{task.title}</span>
                    {cleanDesc && <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{cleanDesc}</span>}
                    <div className="kanban-card-meta">
                      <span className={`badge-category ${task.category.toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                        {task.category}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', alignItems: 'center' }}>
                      <button onClick={() => handleMoveKanban(task, 'in_progress')} className="todo-item-action-btn edit-btn" style={{ fontSize: '11px', padding: '4px 8px' }}>
                        ⬅️ Reabrir
                      </button>
                      <button onClick={() => onDeleteTask(task.id)} className="todo-item-action-btn delete-btn"><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="calendar-view-container animate-fade-in">
          <div className="calendar-header">
            <h3 className="calendar-title">{getMonthName()}</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { changeMonth(-1); logEvent('calendar_month_selected', { direction: 'prev' }); }} className="calendar-nav-btn"><ArrowLeft size={16} /></button>
              <button onClick={() => { changeMonth(1); logEvent('calendar_month_selected', { direction: 'next' }); }} className="calendar-nav-btn"><ArrowRight size={16} /></button>
            </div>
          </div>

          <div className="calendar-grid-header">
            <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
          </div>

          <div className="calendar-grid-days">
            {calendarCells.map((cell, idx) => {
              const dayTasks = tasks.filter(t => t.dueDate === cell.dateStr);
              const habitsDone = habitsManager.habitLogs.filter(l => l.completed_date === cell.dateStr);
              
              return (
                <div 
                  key={idx}
                  onClick={() => {
                    setSelectedCalendarDay(cell.dateStr);
                    logEvent('calendar_day_selected', { date: cell.dateStr });
                  }}
                  className={`calendar-day-cell ${cell.isCurrentMonth ? '' : 'other-month'} ${cell.isToday ? 'today-cell' : ''}`}
                >
                  <span className="calendar-day-number">{cell.dayNumber}</span>
                  <div className="calendar-dots-container">
                    {dayTasks.map(t => (
                      <span key={t.id} className="calendar-task-dot" title={`Tarefa: ${t.title}`} style={{ backgroundColor: t.completed ? 'var(--text-light)' : 'var(--primary)' }} />
                    ))}
                    {habitsDone.map(h => (
                      <span key={h.id} className="calendar-habit-dot" title="Hábito Concluído" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modal de Detalhes do Dia (Calendário) ──────────────── */}
      {selectedCalendarDay && (
        <div className="modal-overlay" onClick={() => setSelectedCalendarDay(null)}>
          <div className="modal-content animate-scale-up" onClick={e => e.stopPropagation()} style={{ padding: '24px', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>
                📅 {formatFriendlyDate(selectedCalendarDay)}
              </h3>
              <button onClick={() => setSelectedCalendarDay(null)} className="todo-modal-close-btn">
                <X size={18} />
              </button>
            </div>
            
            <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>Tarefas do Dia</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '180px', overflowY: 'auto' }}>
              {tasks.filter(t => t.dueDate === selectedCalendarDay).length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhuma tarefa agendada.</p>
              ) : (
                tasks.filter(t => t.dueDate === selectedCalendarDay).map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-app)' }}>
                    <input 
                      type="checkbox" 
                      checked={task.completed} 
                      onChange={() => onToggleComplete(task.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', textDecoration: task.completed ? 'line-through' : 'none', color: 'var(--text-main)', flex: 1 }}>{task.title}</span>
                  </div>
                ))
              )}
            </div>

            <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>Hábitos do Dia</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', maxHeight: '180px', overflowY: 'auto' }}>
              {habitsManager.habits.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum hábito ativo.</p>
              ) : (
                habitsManager.habits.map(habit => {
                  const isCompleted = habitsManager.habitLogs.some(l => l.habit_id === habit.id && l.completed_date === selectedCalendarDay);
                  return (
                    <div key={habit.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-app)' }}>
                      <button 
                        onClick={() => habitsManager.toggleHabitLog(habit.id, selectedCalendarDay)}
                        style={{
                          backgroundColor: isCompleted ? 'var(--primary)' : 'transparent',
                          border: '1.5px solid var(--primary)',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '10px',
                          padding: 0
                        }}
                      >
                        {isCompleted && '✓'}
                      </button>
                      <span style={{ fontSize: '13px', color: 'var(--text-main)', flex: 1 }}>{habit.emoji} {habit.title}</span>
                    </div>
                  );
                })
              )}
            </div>

            <button 
              onClick={() => {
                setSelectedCalendarDay(null);
                openNewTaskModal();
                setDueDate(selectedCalendarDay);
              }}
              className="btn-primary-glow"
              style={{ width: '100%', padding: '12px', fontSize: '13.5px' }}
            >
              + Nova Tarefa para este dia
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de Criar / Editar Tarefa ──────────────── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content tasks-modal animate-scale-up" onClick={e => e.stopPropagation()}>
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

              <div className="todo-form-row">
                <div className="todo-form-group flex-1">
                  <label className="todo-form-label" htmlFor="task-cat">Categoria</label>
                  <select
                    id="task-cat"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="todo-modal-select"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                    ))}
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

              {/* Data, Horário e Recorrência (Bloco 4) */}
              <div className="todo-form-row">
                <div className="todo-form-group flex-1">
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

                <div className="todo-form-group flex-1">
                  <label className="todo-form-label" htmlFor="task-time">Horário (opcional)</label>
                  <input
                    id="task-time"
                    type="time"
                    value={dueTime}
                    onChange={e => setDueTime(e.target.value)}
                    className="todo-modal-date-input"
                    style={{ paddingLeft: '12px' }}
                  />
                </div>
              </div>

              <div className="todo-form-group">
                <label className="todo-form-label" htmlFor="task-recurrence">Recorrência (repetição automática)</label>
                <select
                  id="task-recurrence"
                  value={recurrence}
                  onChange={e => setRecurrence(e.target.value)}
                  className="todo-modal-select"
                >
                  <option value="nenhuma">Não repetir</option>
                  <option value="diaria">🔄 Diária</option>
                  <option value="semanal">🔄 Semanal</option>
                  <option value="mensal">🔄 Mensal</option>
                </select>
              </div>

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

      {/* Modal de Planejamento Semanal */}
      <Suspense fallback={null}>
        <WeeklyPlannerModal 
          isOpen={isPlannerOpen}
          onClose={() => setIsPlannerOpen(false)}
          tasks={tasks}
          onUpdateTask={onUpdateTask}
        />
      </Suspense>
    </div>
  );
}
