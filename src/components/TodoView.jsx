import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { 
  Plus, Search, X, Calendar, ChevronDown, ChevronRight, 
  List, Columns, Grid, Trash2, Edit2, AlertCircle, ArrowLeft, ArrowRight,
  Sparkles, Award, Sprout, Pin, Zap, CheckCircle, Moon, Sun, Tag, AlertTriangle, RotateCcw
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import CategoryIcon from './CategoryIcon';
import TodoItem from './TodoItem';
import AchievementModal from './AchievementModal'; // Importar AchievementModal
import Skeleton from './Skeleton';
import EisenhowerMatrix from './EisenhowerMatrix';
import { TASK_TEMPLATES } from '../data/taskTemplates';
const WeeklyPlannerModal = lazy(() => import('./WeeklyPlannerModal'));
import { 
  useAppContext, 
  parseTaskMetadata, 
  formatDescriptionWithoutMetadata, 
  buildDescriptionWithMetadata 
} from '../contexts/AppContext';

// Importar SVGs personalizados
import MfTasksIcon from '../assets/Icons/mf-tasks.svg';
import MfCalendarIcon from '../assets/Icons/mf-calendar.svg';

// Importar serviço do Google Calendar
import { addToGoogleCalendar, exportAllTasksToCalendar } from '../services/googleCalendarService';

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

function getGoalIconEmoji(iconName) {
  if (!iconName) return '🎯';
  const isEmoji = /\p{Emoji}/u.test(iconName) && !/^[a-zA-Z0-9-]+$/.test(iconName);
  if (isEmoji) return iconName;

  const emojiMap = {
    target: '🎯',
    rocket: '🚀',
    book: '📖',
    dollar: '💰',
    home: '🏠',
    globe: '🌐',
    dumbbell: '💪',
    brain: '🧠',
    heart: '❤️',
    palette: '🎨',
    music: '🎵',
    plane: '✈️',
    sprout: '🌱',
    trending: '📈',
    star: '⭐',
    users: '👥',
  };

  return emojiMap[iconName.toLowerCase()] || '🎯';
}

const formatarDataBR = (str) => {
  if (!str) return '';
  const p = str.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : new Date(str).toLocaleDateString('pt-BR');
};


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
    templateGroups: {},
    completed: [],
  };

  tasks.forEach(task => {
    if (task.completed) {
      sections.completed.push(task);
      return;
    }

    // Identificar se pertence a um modelo
    const meta = parseTaskMetadata(task.description);
    if (meta.template_name) {
      const groupName = meta.template_name;
      if (!sections.templateGroups[groupName]) {
        sections.templateGroups[groupName] = [];
      }
      sections.templateGroups[groupName].push(task);
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
        <div className="tasks-empty-icon-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Search size={24} style={{ color: 'var(--text-light)' }} />
        </div>
        <h3 className="tasks-empty-title">Nenhum resultado</h3>
        <p className="tasks-empty-desc">Nenhuma tarefa corresponde a "<strong>{searchQuery}</strong>". Tente outras palavras.</p>
      </div>
    );
  }

  if (filter === 'completed') {
    return (
      <div className="tasks-empty-state">
        <div className="tasks-empty-icon-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={24} style={{ color: 'var(--text-light)' }} />
        </div>
        <h3 className="tasks-empty-title">Nenhuma tarefa concluída ainda</h3>
        <p className="tasks-empty-desc">Complete suas primeiras tarefas e elas aparecerão aqui como conquistas.</p>
      </div>
    );
  }

  if (filter === 'active') {
    return (
      <div className="tasks-empty-state tasks-empty-state--celebrate">
        <div className="tasks-empty-icon-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Award size={24} style={{ color: 'var(--text-light)' }} />
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
      <div className="tasks-empty-icon-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sprout size={24} style={{ color: 'var(--text-light)' }} />
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
    handleBulkDeleteCompleted: onBulkDeleteCompleted,
    handleToggleComplete: onToggleComplete, // Original onToggleComplete from context
    categories,
    handleAddCategory,
    handleDeleteCategory,
    habitsManager,
    logEvent,
    goals
  } = useAppContext();

  // Estados locais
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [customizingTemplate, setCustomizingTemplate] = useState(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [showCompletedKanban, setShowCompletedKanban] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // Estados para AchievementModal
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [achievementData, setAchievementData] = useState({ title: '', message: '', icon: '' });

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
  const [linkedGoal, setLinkedGoal] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Salva modo de visualização e rastreia analytics
  useEffect(() => {
    localStorage.setItem('flowday_tasks_view_mode', viewMode);
    if (viewMode === 'calendar') {
      logEvent('calendar_viewed');
    } else if (viewMode === 'kanban') {
      logEvent('kanban_viewed');
    } else if (viewMode === 'eisenhower') {
      logEvent('eisenhower_matrix_viewed');
    }
  }, [viewMode, logEvent]);

  // Removido o Abertura automática no primeiro uso para evitar reaberturas após deletar a última tarefa

  const openNewTaskModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setCategory(categories[0]?.id || 'Trabalho');
    setPriority('Média');
    setDueDate('');
    setDueTime('');
    setRecurrence('nenhuma');
    setLinkedGoal('');
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

  const closeTaskModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setDueDate('');
    setDueTime('');
    setCategory(categories[0]?.id || 'Trabalho');
    setPriority('Média');
    setRecurrence('nenhuma');
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeTaskModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

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
      dueDate: dueDate || null,
      goal_id: linkedGoal || null
    };

    if (editingTask) {
      onUpdateTask(editingTask.id, taskData);
    } else {
      onAddTask(taskData);
    }

    closeTaskModal();
  };

  // Caixa de Entrada Rápida
  const handleQuickAddSubmit = (e) => {
    e.preventDefault();
    if (quickTitle.trim()) {
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

  // Lógica para Achievement Modal: Verificar "Primeira do Dia"
  const handleToggleCompleteWithAchievement = async (taskId) => {
    const taskToToggle = tasks.find(t => t.id === taskId);
    
    // Só verifica conquista se a tarefa estiver sendo marcada como concluída
    if (taskToToggle && !taskToToggle.completed) {
      const today = todayStr();
      // Filtrar tarefas *já* completadas hoje (excluindo a tarefa atual)
      const completedTasksTodayBefore = tasks.filter(t => 
        t.id !== taskId && t.completed && t.completedAt && t.completedAt.startsWith(today)
      );

      if (completedTasksTodayBefore.length === 0) {
        setAchievementData({
          title: 'Primeira do Dia!',
          message: 'Você completou sua primeira tarefa de hoje. Parabéns pelo foco!',
          icon: '🏆'
        });
        setShowAchievementModal(true);
      }
    }

    // Chamar a função original de toggle complete do AppContext
    await onToggleComplete(taskId);
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

  const activeTemplates = useMemo(() => {
    const active = new Set();
    tasks.forEach(task => {
      if (!task.completed && !task.deletedAt) {
        const meta = parseTaskMetadata(task.description);
        if (meta.template_name) {
          active.add(meta.template_name);
        }
      }
    });
    return active;
  }, [tasks]);

  const handleLoadTemplate = (template) => {
    if (activeTemplates.has(template.title)) {
      alert(`O modelo "${template.title}" já está ativo em sua lista.`);
      return;
    }
    setCustomizingTemplate({
      ...template,
      tasks: template.tasks.map((t, idx) => ({
        id: `t_${idx}_${Date.now()}`,
        title: t.title,
        description: t.description || '',
        category: template.category || 'Pessoal',
        priority: t.priority || 'Média',
        enabled: true
      }))
    });
  };

  const handleCancelCustomization = () => {
    setCustomizingTemplate(null);
  };

  const handleToggleCustomTask = (taskId) => {
    setCustomizingTemplate(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? { ...t, enabled: !t.enabled } : t)
      };
    });
  };

  const handleUpdateCustomTask = (taskId, field, value) => {
    setCustomizingTemplate(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t)
      };
    });
  };

  const handleAddCustomTask = () => {
    setCustomizingTemplate(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: [
          ...prev.tasks,
          {
            id: `t_custom_${Date.now()}`,
            title: '',
            description: '',
            category: prev.category || 'Pessoal',
            priority: 'Média',
            enabled: true
          }
        ]
      };
    });
  };

  const handleRemoveCustomTask = (taskId) => {
    setCustomizingTemplate(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.filter(t => t.id !== taskId)
      };
    });
  };

  const handleImportCustomizedTemplate = async () => {
    if (!customizingTemplate) return;
    const enabledTasks = customizingTemplate.tasks.filter(t => t.enabled && t.title.trim());
    if (enabledTasks.length === 0) {
      alert("Selecione ou preencha pelo menos uma tarefa com título.");
      return;
    }

    for (const t of enabledTasks) {
      const metaDescription = `\n\n--flowday-meta--\n${JSON.stringify({ due_time: '', recurrence: 'nenhuma', template_name: customizingTemplate.title })}`;
      const finalDesc = t.description ? `${t.description}${metaDescription}` : metaDescription;
      
      const catExists = categories.some(cat => cat.id === t.category || cat.name === t.category);
      const categoryId = catExists ? t.category : (categories[0]?.id || 'Trabalho');

      await onAddTask({
        title: t.title.trim(),
        description: finalDesc,
        category: categoryId,
        priority: t.priority || 'Média',
        dueDate: null
      });
    }

    setCustomizingTemplate(null);
    setIsTemplatesOpen(false);
    logEvent('template_loaded', { template_id: customizingTemplate.id });
  };

  const handleExportGoogleCalendar = () => {
    exportAllTasksToCalendar(tasks);
    window.open('https://calendar.google.com/calendar/r/settings/export', '_blank');
    setIsSyncModalOpen(false);
    logEvent('calendar_google_sync_clicked');
  };

  const handleExportIcsOnly = () => {
    exportAllTasksToCalendar(tasks);
    setIsSyncModalOpen(false);
    logEvent('calendar_ics_sync_clicked');
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
            { key: 'list', label: 'Lista', icon: <img src={MfTasksIcon} alt="Tarefas" width={16} height={16} style={{ filter: 'var(--icon-filter)' }} /> },
            { key: 'kanban', label: 'Kanban', icon: <Columns size={16} /> },
            { key: 'eisenhower', label: 'Matriz', icon: <Grid size={16} /> },
            { key: 'calendar', label: 'Agenda', icon: <img src={MfCalendarIcon} alt="Agenda" width={16} height={16} style={{ filter: 'var(--icon-filter)' }} /> }
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
      <form onSubmit={handleQuickAddSubmit} className="quick-inbox-container">
        <input 
          type="text" 
          placeholder="Captura rápida: digite uma tarefa e pressione Enter..."
          value={quickTitle}
          onChange={e => setQuickTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleQuickAddSubmit(e);
            }
          }}
          className="quick-inbox-input"
        />
      </form>

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

        <div 
          className="no-scrollbar"
          style={{ 
            display: 'flex', 
            gap: '8px', 
            overflowX: 'auto', 
            width: '100%', 
            whiteSpace: 'nowrap',
            paddingBottom: '4px',
            flexShrink: 0
          }}
        >
          <button 
            onClick={() => setShowCategoryManager(!showCategoryManager)} 
            className="tasks-add-btn" 
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-medium)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Tag size={14} />
            <span>Categorias</span>
          </button>
          <button 
            onClick={() => setIsTemplatesOpen(true)} 
            className="tasks-add-btn" 
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-medium)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={14} style={{ color: 'var(--primary)' }} />
            <span>Modelos</span>
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
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Tag size={12} /> Todas
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

      {/* Botão de limpeza em lote e banner de confirmação */}
      {viewMode === 'list' && completed > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '4px', gap: '8px' }}>
          {showBulkConfirm ? (
            <div
              className="animate-fade-in"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, var(--danger) 10%, var(--bg-card))',
                border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                fontSize: '13px', color: 'var(--text-main)'
              }}
            >
              <span>Remover <strong>{completed}</strong> {completed === 1 ? 'tarefa concluída' : 'tarefas concluídas'}?</span>
              <button
                onClick={async () => { await onBulkDeleteCompleted(); setShowBulkConfirm(false); }}
                className="btn-confirm-danger"
                style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '700', borderRadius: 'var(--radius-xs)', cursor: 'pointer' }}
              >
                Sim, remover
              </button>
              <button
                onClick={() => setShowBulkConfirm(false)}
                style={{ padding: '5px 10px', fontSize: '12px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowBulkConfirm(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', fontSize: '12px', fontWeight: '600',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)',
                background: 'var(--bg-card)', color: 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              title={`Apagar as ${completed} tarefas concluídas`}
            >
              <Trash2 size={13} />
              Limpar concluídas ({completed})
            </button>
          )}
        </div>
      )}

      {/* Conteúdos das Abas (Visualizações Bloco 4) */}
      {viewMode === 'list' && (
        <>
          {baseFiltered.length > 0 ? (
            <div className="tasks-sections-wrapper">
              <TaskSection
                title="Atrasadas"
                icon={<AlertTriangle size={15} style={{ color: 'var(--danger)' }} />}
                accent="overdue"
                tasks={sections.overdue}
                onEdit={openEditTaskModal}
                onDelete={onDeleteTask}
                onToggle={handleToggleCompleteWithAchievement} // Usar a função com lógica de conquista
                defaultOpen={true}
                isOverdue={true}
              />
              <TaskSection
                title="Hoje"
                icon={<Sun size={15} style={{ color: 'var(--primary)' }} />}
                tasks={sections.today}
                onEdit={openEditTaskModal}
                onDelete={onDeleteTask}
                onToggle={handleToggleCompleteWithAchievement} // Usar a função com lógica de conquista
                defaultOpen={true}
              />
              <TaskSection
                title="Amanhã"
                icon={<Moon size={15} style={{ color: '#818cf8' }} />}
                tasks={sections.tomorrow}
                onEdit={openEditTaskModal}
                onDelete={onDeleteTask}
                onToggle={handleToggleCompleteWithAchievement} // Usar a função com lógica de conquista
                defaultOpen={true}
              />
              <TaskSection
                title="Esta semana"
                icon={<Calendar size={15} />}
                tasks={sections.thisWeek}
                onEdit={openEditTaskModal}
                onDelete={onDeleteTask}
                onToggle={handleToggleCompleteWithAchievement} // Usar a função com lógica de conquista
                defaultOpen={true}
              />
              <TaskSection
                title="Futuras"
                icon={<Zap size={15} style={{ color: '#eab308' }} />}
                tasks={sections.future}
                onEdit={openEditTaskModal}
                onDelete={onDeleteTask}
                onToggle={handleToggleCompleteWithAchievement} // Usar a função com lógica de conquista
                defaultOpen={false}
              />
              <TaskSection
                title="Sem prazo definido"
                icon={<Pin size={15} />}
                tasks={sections.noDueDate}
                onEdit={openEditTaskModal}
                onDelete={onDeleteTask}
                onToggle={handleToggleCompleteWithAchievement} // Usar a função com lógica de conquista
                defaultOpen={false}
              />
              {Object.entries(sections.templateGroups || {}).map(([templateName, templateTasks]) => (
                <TaskSection
                  key={templateName}
                  title={templateName}
                  icon={<Sparkles size={15} style={{ color: 'var(--primary)' }} />}
                  tasks={templateTasks}
                  onEdit={openEditTaskModal}
                  onDelete={onDeleteTask}
                  onToggle={handleToggleCompleteWithAchievement}
                  defaultOpen={true}
                />
              ))}
              <TaskSection
                title="Concluídas"
                icon={<CheckCircle size={15} style={{ color: '#22c55e' }} />}
                tasks={sections.completed}
                onEdit={openEditTaskModal}
                onDelete={onDeleteTask}
                onToggle={handleToggleCompleteWithAchievement} // Usar a função com lógica de conquista
                defaultOpen={false}
              />
            </div>
          ) : (
            <EmptyState filter={filter} searchQuery={searchQuery} onAdd={openNewTaskModal} />
          )}
        </>
      )}

      {viewMode === 'kanban' && (
        (() => {
          const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
          return (
            <div className="kanban-view-container animate-fade-in">
              {/* Coluna 1: A Fazer */}
              <div className="kanban-column" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'todo')}>
                <div className="kanban-column-header">
                  <span className="kanban-column-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Pin size={14} /> A Fazer
                  </span>
                  <span className="kanban-column-count">{kanbanTasks.todo.length}</span>
                </div>
                <div className="kanban-cards-list">
                  {kanbanTasks.todo.map(task => {
                    const meta = parseTaskMetadata(task.description);
                    const cleanDesc = formatDescriptionWithoutMetadata(task.description);
                    return (
                      <div key={task.id} className="kanban-card" draggable="true" onDragStart={(e) => handleDragStart(e, task.id)}>
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
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={11} />
                            <span>{formatarDataBR(task.dueDate)} {meta.due_time ? `às ${meta.due_time}` : ''}</span>
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
                  <span className="kanban-column-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} style={{ color: '#eab308' }} /> Em Progresso
                  </span>
                  <span className="kanban-column-count">{kanbanTasks.inProgress.length}</span>
                </div>
                <div className="kanban-cards-list">
                  {kanbanTasks.inProgress.map(task => {
                    const meta = parseTaskMetadata(task.description);
                    const cleanDesc = formatDescriptionWithoutMetadata(task.description);
                    return (
                      <div key={task.id} className="kanban-card" draggable="true" onDragStart={(e) => handleDragStart(e, task.id)}>
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
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={11} />
                            <span>{formatarDataBR(task.dueDate)} {meta.due_time ? `às ${meta.due_time}` : ''}</span>
                          </span>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => handleMoveKanban(task, 'todo')} className="todo-item-action-btn edit-btn" style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px' }} title="Mover para A Fazer">
                              <ArrowLeft size={12} />
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
                <div className="kanban-column-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="kanban-column-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={14} style={{ color: '#22c55e' }} /> Concluído
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setShowCompletedKanban(!showCompletedKanban)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-light)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s'
                      }}
                      title={showCompletedKanban ? 'Ocultar concluídas' : 'Mostrar concluídas'}
                    >
                      {showCompletedKanban ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <span className="kanban-column-count">{kanbanTasks.completed.length}</span>
                  </div>
                </div>
                <div className="kanban-cards-list">
                  {showCompletedKanban ? (
                    kanbanTasks.completed.map(task => {
                      const meta = parseTaskMetadata(task.description);
                      const cleanDesc = formatDescriptionWithoutMetadata(task.description);
                      return (
                        <div key={task.id} className="kanban-card" style={{ opacity: 0.75 }} draggable="true" onDragStart={(e) => handleDragStart(e, task.id)}>
                          <span className="kanban-card-title" style={{ textDecoration: 'line-through' }}>{task.title}</span>
                          {cleanDesc && <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{cleanDesc}</span>}
                          <div className="kanban-card-meta">
                            <span className={`badge-category ${task.category.toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                              {task.category}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', alignItems: 'center' }}>
                            <button onClick={() => handleMoveKanban(task, 'in_progress')} className="todo-item-action-btn edit-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 8px' }}>
                              <RotateCcw size={12} /> Reabrir
                            </button>
                            <button onClick={() => onDeleteTask(task.id)} className="todo-item-action-btn delete-btn"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      );
                    })
                  ) : kanbanTasks.completed.length > 0 ? (
                    <div 
                      onClick={() => setShowCompletedKanban(true)}
                      style={{
                        padding: '16px',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-app)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--border-medium)',
                        cursor: 'pointer',
                        color: 'var(--text-light)',
                        fontSize: '13px',
                        fontWeight: '550',
                        transition: 'all 0.2s',
                        width: '100%'
                      }}
                    >
                      👁️ {kanbanTasks.completed.length} tarefas concluídas ocultas
                      <span style={{ display: 'block', fontSize: '11px', fontWeight: '400', marginTop: '4px', color: 'var(--text-muted)' }}>Clique para visualizar</span>
                    </div>
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                      Nenhuma tarefa concluída
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      )}

      {viewMode === 'eisenhower' && (
        <EisenhowerMatrix
          tasks={baseFiltered}
          onEditTask={openEditTaskModal}
          onDeleteTask={onDeleteTask}
          onUpdateTask={onUpdateTask}
          onToggleComplete={handleToggleCompleteWithAchievement}
        />
      )}

      {viewMode === 'calendar' && (
        <div className="calendar-view-container animate-fade-in">
          <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="calendar-title">{getMonthName()}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => {
                  setIsSyncModalOpen(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  border: '1px solid var(--primary)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                title="Sincronizar todo o calendário de tarefas (.ics)"
              >
                <Calendar size={13} /> Sincronizar Calendário
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { changeMonth(-1); logEvent('calendar_month_selected', { direction: 'prev' }); }} className="calendar-nav-btn"><ArrowLeft size={16} /></button>
                <button onClick={() => { changeMonth(1); logEvent('calendar_month_selected', { direction: 'next' }); }} className="calendar-nav-btn"><ArrowRight size={16} /></button>
              </div>
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
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={18} style={{ color: 'var(--primary)' }} /> {formatFriendlyDate(selectedCalendarDay)}
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
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-app)', opacity: task.completed ? 0.6 : 1 }}>
                    <input 
                      type="checkbox" 
                      checked={task.completed} 
                      onChange={() => handleToggleCompleteWithAchievement(task.id)} // Usar a função com lógica de conquista
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--text-muted)' : 'var(--text-main)', flex: 1 }}>{task.title}</span>
                    
                    {/* Botão Adicionar ao Google Calendar */}
                    {task.dueDate && (
                      <button
                        onClick={() => addToGoogleCalendar({ ...task, dueTime: parseTaskMetadata(task.description).due_time })}
                        className="todo-item-action-btn" // Reusing a similar style, adjust as needed
                        title="Adicionar ao Google Calendar"
                        aria-label="Adicionar tarefa ao Google Calendar"
                        style={{ padding: '4px', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Calendar size={14} />
                      </button>
                    )}

                    <button 
                      onClick={() => onDeleteTask(task.id)} 
                      style={{ padding: '4px', color: 'var(--text-light)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
                      title="Excluir tarefa"
                    >
                      <Trash2 size={14} />
                    </button>
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
        <div className="modal-overlay" onClick={closeTaskModal}>
          <div className="modal-content tasks-modal animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="todo-modal-header">
              <div className="tasks-modal-title-wrap">
                <span className="tasks-modal-icon">{editingTask ? '✏️' : '✨'}</span>
                <h2 className="todo-modal-title">
                  {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
                </h2>
              </div>
              <button onClick={closeTaskModal} className="todo-modal-close-btn" aria-label="Fechar modal">
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

              {!editingTask && goals.length > 0 && (
                <div className="todo-form-group">
                  <label className="todo-form-label" htmlFor="task-goal">Vincular a um Objetivo (opcional)</label>
                  <select
                    id="task-goal"
                    value={linkedGoal}
                    onChange={e => setLinkedGoal(e.target.value)}
                    className="todo-modal-select"
                  >
                    <option value="">Nenhum objetivo</option>
                    {goals.filter(g => g.status === 'active').map(g => (
                      <option key={g.id} value={g.id}>{getGoalIconEmoji(g.icon)} {g.title}</option>
                    ))}
                  </select>
                </div>
              )}

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
                  onClick={closeTaskModal}
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

      {/* Achievement Modal */}
      <AchievementModal
        isOpen={showAchievementModal}
        onClose={() => setShowAchievementModal(false)}
        title={achievementData.title}
        message={achievementData.message}
        icon={achievementData.icon}
      />

      {/* Modal de Escolha de Sincronização do Calendário */}
      {isSyncModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSyncModalOpen(false)} style={{ zIndex: 11000 }}>
          <div 
            className="modal-content" 
            role="dialog" 
            aria-modal="true" 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '420px', width: '90%', padding: '24px', textAlign: 'center' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--primary)' }} /> Sincronizar Calendário
              </h3>
              <button 
                onClick={() => setIsSyncModalOpen(false)} 
                className="todo-modal-close-btn"
                style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5', textAlign: 'left' }}>
              Escolha o formato que preferir para integrar suas tarefas agendadas ao seu calendário pessoal:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleExportGoogleCalendar}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-app)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.2s',
                  width: '100%',
                }}
                className="calendar-sync-option"
              >
                <span style={{ fontSize: '24px' }}>📅</span>
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-main)' }}>Google Calendar (Recomendado)</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Exporta o arquivo .ics e abre a página de importação do Google.</span>
                </div>
              </button>

              <button
                onClick={handleExportIcsOnly}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-app)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.2s',
                  width: '100%',
                }}
                className="calendar-sync-option"
              >
                <span style={{ fontSize: '24px' }}>📥</span>
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-main)' }}>Baixar arquivo .ics</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Apenas exporta e baixa o arquivo de calendário para programas locais.</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer de Templates de Tarefas */}
      <div 
        className={`templates-drawer-overlay ${isTemplatesOpen ? 'open' : ''}`}
        onClick={() => setIsTemplatesOpen(false)}
      >
        <div 
          className="templates-drawer"
          onClick={e => e.stopPropagation()}
        >
          <div className="templates-drawer-header">
            <h3 className="templates-drawer-title">
              <Sparkles size={18} style={{ color: 'var(--primary)' }} />
              Modelos de Tarefa
            </h3>
            <button 
              className="templates-drawer-close"
              onClick={() => setIsTemplatesOpen(false)}
              aria-label="Fechar modelos"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="templates-drawer-body">
            {customizingTemplate ? (
              <div className="template-customizer-container">
                <div className="template-customizer-header">
                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 4px' }}>
                    Personalizar: {customizingTemplate.title}
                  </h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    Ajuste os títulos e descrições das tarefas antes de importá-las.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px', marginBottom: '12px' }}>
                  {customizingTemplate.tasks.map((t) => (
                    <div key={t.id} className="template-customizer-task-card" style={{ opacity: t.enabled ? 1 : 0.6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '12px', color: 'var(--text-main)', flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={t.enabled}
                            onChange={() => handleToggleCustomTask(t.id)}
                            style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                          />
                          <span>Incluir tarefa</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomTask(t.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Trash2 size={12} /> Remover
                        </button>
                      </div>

                      {t.enabled && (
                        <>
                          <div className="template-customizer-input-group">
                            <span className="template-customizer-label">Título da Tarefa</span>
                            <input
                              type="text"
                              value={t.title}
                              onChange={(e) => handleUpdateCustomTask(t.id, 'title', e.target.value)}
                              placeholder="Título da tarefa..."
                              className="template-customizer-input"
                            />
                          </div>

                          <div className="template-customizer-input-group">
                            <span className="template-customizer-label">Descrição (Opcional)</span>
                            <input
                              type="text"
                              value={t.description}
                              onChange={(e) => handleUpdateCustomTask(t.id, 'description', e.target.value)}
                              placeholder="Descrição adicional..."
                              className="template-customizer-input"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddCustomTask}
                  className="template-customizer-btn-add"
                >
                  <Plus size={14} /> Adicionar Nova Tarefa
                </button>

                <div className="template-customizer-actions">
                  <button
                    type="button"
                    onClick={handleCancelCustomization}
                    className="template-customizer-btn-back"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleImportCustomizedTemplate}
                    className="template-customizer-btn-confirm"
                  >
                    Confirmar e Importar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
                  Selecione um modelo baseado na sua persona para injetar tarefas sugeridas automaticamente na sua lista.
                </p>
                
                {TASK_TEMPLATES.map(template => {
                  const isAlreadyActive = activeTemplates.has(template.title);
                  const templateIconMap = {
                    'Pets': '🐾',
                    'Trabalho': '💼',
                    'Estudos': '📚',
                    'Lazer': '🎸',
                  };
                  const icon = templateIconMap[template.category] || '🏠';

                  return (
                    <div 
                      key={template.id} 
                      className={`template-persona-card ${isAlreadyActive ? 'template-disabled-card' : ''}`}
                    >
                      <h4 className="template-persona-title">
                        <span style={{ fontSize: '16px', marginRight: '6px' }}>{icon}</span>
                        {template.title}
                      </h4>
                      <p className="template-persona-desc">{template.description}</p>
                      
                      {isAlreadyActive && (
                        <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} /> Modelo já ativo (Tarefas importadas)
                        </div>
                      )}

                      <div className="template-tasks-preview" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px', marginTop: '10px' }}>
                        {template.tasks.map((t, i) => (
                          <div key={i} className="template-task-item">
                            <span className="template-task-item-bullet" />
                            <span style={{ fontWeight: '500' }}>{t.title}</span>
                          </div>
                        ))}
                      </div>
                      
                      <button
                        className="template-load-btn"
                        onClick={() => handleLoadTemplate(template)}
                        disabled={isAlreadyActive}
                      >
                        <Plus size={14} />
                        {isAlreadyActive ? 'Modelo Ativo' : 'Carregar Tarefas'}
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

