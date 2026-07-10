import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Search, X, Calendar, ChevronDown, ChevronRight,
  List, Columns, Grid, Trash2, Edit2, AlertCircle, ArrowLeft, ArrowRight,
  Sparkles, Award, Sprout, Pin, Zap, CheckCircle, Moon, Sun, Tag, AlertTriangle, RotateCcw, Copy, Check, Download,
  Archive, Target, MoreVertical, Trash, Paperclip, Image
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import CategoryIcon from './CategoryIcon';
import MFIcon from './MFIcon';
import TodoItem from './TodoItem';
import AchievementModal from './AchievementModal'; // Importar AchievementModal
import Skeleton from './Skeleton';
import EisenhowerMatrix from './EisenhowerMatrix';
import { TASK_TEMPLATES } from '../data/taskTemplates';
import HabitsWidget from './HabitsWidget';
import GoalModal from './GoalModal';
const WeeklyPlannerModal = lazy(() => import('./WeeklyPlannerModal'));
import {
  useAppContext,
  parseTaskMetadata,
  formatDescriptionWithoutMetadata,
  buildDescriptionWithMetadata
} from '../contexts/AppContext';
import {
  combineDateAndTime,
  extractDateAndTimeParts,
  formatTaskDateDisplay,
  formatTaskTimeDisplay
} from '../utils/dateUtils';

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
  const day = d.getDay();
  const diff = d.getDate() + (6 - day);
  const end = new Date(d.setDate(diff));
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
};

const isTaskOnDate = (task, dateStr) => {
  if (!task.dueDate) return false;
  const taskDateOnly = extractDateAndTimeParts(task.dueDate).datePart;
  if (taskDateOnly === dateStr) return true;

  // Recorrência diária espelhada em todos os dias subsequentes se não concluída
  if (taskDateOnly < dateStr && !task.completed) {
    const meta = parseTaskMetadata(task.description);
    if (meta.recurrence === 'diaria') {
      return true;
    }
  }
  return false;
};

function formatFriendlyDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${parts[2]} de ${months[parseInt(parts[1]) - 1]} de ${parts[0]}`;
}



const formatarDataBR = (str) => {
  return formatTaskDateDisplay(str);
};


// Categorizar tarefas
function categorizeTasks(tasks, goals = [], goalTasks = []) {
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
      // Se não tiver prazo e estiver vinculada a um objetivo ativo, agrupa sob o título do objetivo
      const link = goalTasks.find(gt => gt.task_id === task.id);
      const goal = link ? goals.find(g => g.id === link.goal_id && !g.deletedAt) : null;
      if (goal) {
        const groupName = goal.title;
        if (!sections.templateGroups[groupName]) {
          sections.templateGroups[groupName] = [];
        }
        sections.templateGroups[groupName].push(task);
      } else {
        sections.noDueDate.push(task);
      }
      return;
    }

    const taskDateOnly = extractDateAndTimeParts(task.dueDate).datePart;

    if (taskDateOnly < today) {
      sections.overdue.push(task);
    } else if (taskDateOnly === today) {
      sections.today.push(task);
    } else if (taskDateOnly === tomorrow) {
      sections.tomorrow.push(task);
    } else if (taskDateOnly <= endOfWeek) {
      sections.thisWeek.push(task);
    } else {
      sections.future.push(task);
    }
  });

  return sections;
}

const priorityOrder = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
const sortByTime = (tasksList) =>
  [...tasksList].sort((a, b) => {
    const dateA = a.dueDate ? a.dueDate.split('T')[0] : '';
    const dateB = b.dueDate ? b.dueDate.split('T')[0] : '';

    if (dateA && dateB) {
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const metaA = parseTaskMetadata(a.description);
      const metaB = parseTaskMetadata(b.description);
      const timeA = metaA.due_time || '';
      const timeB = metaB.due_time || '';

      if (timeA && timeB) return timeA.localeCompare(timeB);
      if (timeA && !timeB) return -1;
      if (!timeA && timeB) return 1;

      const pA = priorityOrder[a.priority] ?? 2;
      const pB = priorityOrder[b.priority] ?? 2;
      if (pA !== pB) return pA - pB;

      return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
    }

    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;

    const pA = priorityOrder[a.priority] ?? 2;
    const pB = priorityOrder[b.priority] ?? 2;
    if (pA !== pB) return pA - pB;

    return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
  });

function TaskSection({ title, tasks, icon, accent, onEdit, onDelete, onToggle, defaultOpen = true, isOverdue = false, goalId, onUnlinkGoal }) {
  const [open, setOpen] = useState(defaultOpen);
  const { handleDuplicateTask, goalTasks, tasks: allTasks } = useAppContext();

  if (tasks.length === 0) return null;

  const getTaskHighlights = (task) => {
    if (task.completed) return { isRecommended: false, isCritical: false, isStreak: false };

    const now = new Date();
    const meta = parseTaskMetadata(task.description || '');
    const { datePart } = extractDateAndTimeParts(task.dueDate);
    
    let overdue = false;
    if (datePart) {
      const activeTime = meta.due_time || '';
      if (activeTime) {
        const [hours, minutes] = activeTime.split(':').map(Number);
        const [year, month, day] = datePart.split('-').map(Number);
        const taskDateTime = new Date(year, month - 1, day, hours, minutes, 59, 999);
        overdue = taskDateTime < now;
      } else {
        const [year, month, day] = datePart.split('-').map(Number);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
        overdue = endOfDay < now;
      }
    }

    const todayStrStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = datePart === todayStrStr;
    const isCritical = overdue || (task.priority === 'Alta' && isToday);

    const linkedGoalId = (goalTasks || []).find(gt => gt.task_id === task.id)?.goal_id;
    const isRecommended = !!linkedGoalId;

    const completedToday = (allTasks || []).filter(t => t.completed && t.completedAt && t.completedAt.split('T')[0] === todayStrStr).length;
    const isStreak = isToday && completedToday === 0;

    return { isRecommended, isCritical, isStreak, linkedGoalId };
  };

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
          {sortByTime(tasks).map(task => {
            const highlights = getTaskHighlights(task);
            return (
              <TodoItem
                key={task.id}
                item={task}
                onToggleComplete={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
                goalId={goalId || highlights.linkedGoalId}
                onUnlinkGoal={onUnlinkGoal}
                onDuplicate={handleDuplicateTask}
                isRecommended={highlights.isRecommended}
                isCritical={highlights.isCritical}
                isStreak={highlights.isStreak}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ filter, searchQuery, onAdd, onAddGoal }) {
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

  if (filter === 'archived') {
    return (
      <div className="tasks-empty-state">
        <div className="tasks-empty-icon-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Archive size={24} style={{ color: 'var(--text-light)' }} />
        </div>
        <h3 className="tasks-empty-title">Nenhum item arquivado</h3>
        <p className="tasks-empty-desc">Arquive tarefas concluídas ou antigas para manter sua lista organizada.</p>
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
      <h3 className="tasks-empty-title">Sua lista está vazia</h3>
      <p className="tasks-empty-desc">Comece criando sua primeira tarefa ou objetivo.</p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
        <button onClick={onAdd} className="tasks-empty-cta" style={{ margin: 0 }}>
          <Plus size={15} />
          Criar tarefa
        </button>
        <button onClick={onAddGoal} className="tasks-empty-cta" style={{ margin: 0, backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }}>
          <Plus size={15} />
          Criar objetivo
        </button>
      </div>
    </div>
  );
}

export default function MyDayView() {
  const {
    tasks = [],
    handleAddTask: onAddTask,
    handleUpdateTask: onUpdateTask,
    handleDeleteTask: onDeleteTask,
    handleBulkDeleteCompleted: onBulkDeleteCompleted,
    handleToggleComplete: onToggleComplete, // Original onToggleComplete from context
    categories = [],
    handleAddCategory,
    handleDeleteCategory,
    habitsManager,
    logEvent = () => { },
    goals = [],
    goalTasks = [],
    handleUnlinkTask,
    isPro,
    openPaywall,
    hiddenTasksCount,
    deletedTasks,
    setActiveTab,
    setSettingsTab,
    handleDuplicateTask: onDuplicateTask,
    openCustomAlert,
    handleAddGoal: onAddGoal,
    handleUpdateGoal: onUpdateGoal,
    handleDeleteGoal: onDeleteGoal,
    handleLinkTask: onLinkTask,
    shouldOpenGoalModal,
    setShouldOpenGoalModal,
    shouldOpenTaskModal,
    setShouldOpenTaskModal,
    openCustomConfirm,
    selectedGoalIdFilter,
    setSelectedGoalIdFilter,
    handleDuplicateGoal
  } = useAppContext();

  // Estados locais
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const [archivedTab, setArchivedTab] = useState('goals');
  const [activeGoalKebabId, setActiveGoalKebabId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [customizingTemplate, setCustomizingTemplate] = useState(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [showCompletedKanban, setShowCompletedKanban] = useState(true);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Estados locais para Objetivos
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [expandedGoals, setExpandedGoals] = useState(() => {
    try {
      const saved = localStorage.getItem('flowday_expanded_goals');
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });
  const [pendingCompleteGoalId, setPendingCompleteGoalId] = useState(null);

  // Estados para AchievementModal
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [achievementData, setAchievementData] = useState({ title: '', message: '', icon: '' });

  // Bloco 4 - Visualização
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('flowday_tasks_view_mode') || 'list');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');

  const getCategoryEmoji = (cat) => {
    const emojiMap = {
      briefcase: '💼',
      user: '🏠',
      book: '📚',
      dumbbell: '💪',
      heart: '❤️',
      palette: '🎨',
      music: '🎵',
      plane: '✈️',
      sprout: '🌱',
      trending: '📈',
      star: '⭐',
      users: '👥',
      trabalho: '💼',
      pessoal: '🏠',
      estudos: '📚',
      lazer: '🧘'
    };

    const val = cat.emoji || cat.iconName || cat.id || '';
    const key = val.toLowerCase();

    if (emojiMap[key]) return emojiMap[key];

    const name = (cat.name || '').toLowerCase();
    if (name.includes('trabalho') || name.includes('work')) return '💼';
    if (name.includes('pessoal') || name.includes('personal')) return '🏠';
    if (name.includes('estudo') || name.includes('study') || name.includes('academic')) return '📚';
    if (name.includes('lazer') || name.includes('leisure') || name.includes('free time')) return '🧘';

    if (val.length <= 2 && !/^[a-zA-Z0-9]$/.test(val)) return val;

    return '📁';
  };

  useEffect(() => {
    if (!showCategoryManager) return;
    const handleOutsideClick = (e) => {
      const panel = document.querySelector('.category-manager-panel');
      const btn = e.target.closest('.tasks-add-btn');
      if (panel && !panel.contains(e.target) && (!btn || !btn.contains(e.target))) {
        setShowCategoryManager(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setShowCategoryManager(false);
    };
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showCategoryManager]);

  // Configurações do Calendário
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  const [activeLightboxFile, setActiveLightboxFile] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    setZoomLevel(1);
  }, [activeLightboxFile]);

  // Categorias customizadas
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('briefcase');
  const [newCatColor, setNewCatColor] = useState('#6B7F8A');

  // Formulário de tarefa
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('Média');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [recurrence, setRecurrence] = useState('nenhuma');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceUnit, setRecurrenceUnit] = useState('dias');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [linkedGoal, setLinkedGoal] = useState('');

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

  // Efeito e Handlers para Objetivos
  useEffect(() => {
    if (shouldOpenGoalModal) {
      setShouldOpenGoalModal(false);
      setEditingGoal(null);
      setIsGoalModalOpen(true);
    }
  }, [shouldOpenGoalModal, setShouldOpenGoalModal]);

  // Efeito para abrir modal de nova tarefa vindo de outras telas
  useEffect(() => {
    if (shouldOpenTaskModal) {
      setShouldOpenTaskModal(false);
      setEditingTask(null);
      setIsModalOpen(true);
    }
  }, [shouldOpenTaskModal, setShouldOpenTaskModal]);

  const toggleGoalExpand = (goalId) => {
    setExpandedGoals(prev => {
      const updated = { ...prev, [goalId]: !prev[goalId] };
      localStorage.setItem('flowday_expanded_goals', JSON.stringify(updated));
      return updated;
    });
  };

  const openNewGoalModal = () => {
    setEditingGoal(null);
    setIsGoalModalOpen(true);
  };

  const openEditGoalModal = (goal) => {
    setEditingGoal(goal);
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = (data) => {
    if (editingGoal) {
      onUpdateGoal(editingGoal.id, data);
    } else {
      onAddGoal(data);
    }
    setIsGoalModalOpen(false);
    setEditingGoal(null);
  };

  const handleDeleteGoal = () => {
    if (!editingGoal) return;
    openCustomConfirm(
      `Deseja realmente excluir o objetivo "${editingGoal.title}"? Isso desvinculará suas tarefas associadas.`,
      "Excluir Objetivo",
      async () => {
        await onDeleteGoal(editingGoal.id);
        setIsGoalModalOpen(false);
        setEditingGoal(null);
      }
    );
  };

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

  const openNewTaskModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setCategory(categories[0]?.id || 'Trabalho');
    setPriority('Média');
    setDueDate('');
    setDueTime('');
    setRecurrence('nenhuma');
    setRecurrenceInterval(1);
    setRecurrenceUnit('dias');
    setRecurrenceDays([]);
    setLinkedGoal('');
    setIsModalOpen(true);
  };

  const openEditTaskModal = (task) => {
    setEditingTask(task);
    setTitle(task.title);

    const meta = parseTaskMetadata(task.description);
    const cleanDesc = formatDescriptionWithoutMetadata(task.description);
    const { datePart, timePart } = extractDateAndTimeParts(task.dueDate);

    setDescription(cleanDesc);
    setCategory(task.category);
    setPriority(task.priority);
    setDueDate(datePart || '');
    setDueTime(meta.due_time || '');
    setRecurrence(meta.recurrence || 'nenhuma');
    setRecurrenceInterval(meta.recurrence_interval || 1);
    setRecurrenceUnit(meta.recurrence_unit || 'dias');
    setRecurrenceDays(meta.recurrence_days || []);

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
    setRecurrenceInterval(1);
    setRecurrenceUnit('dias');
    setRecurrenceDays([]);
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

    const combinedDueDate = combineDateAndTime(dueDate, dueTime);
    
    const extraMeta = {};
    if (recurrence === 'personalizada') {
      extraMeta.recurrence_interval = recurrenceInterval;
      extraMeta.recurrence_unit = recurrenceUnit;
    } else if (recurrence === 'dias_semana') {
      extraMeta.recurrence_days = recurrenceDays;
    }

    const metaDescription = buildDescriptionWithMetadata(description, dueTime, recurrence, false, extraMeta);

    const taskData = {
      title: title.trim(),
      description: metaDescription,
      category,
      priority,
      dueDate: combinedDueDate,
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
      const completedTasksTodayBefore = tasks.filter(t => {
        if (t.id === taskId || !t.completed || !t.completedAt) return false;
        const { datePart } = extractDateAndTimeParts(t.completedAt);
        return datePart === today;
      });

      if (completedTasksTodayBefore.length === 0) {
        setAchievementData({
          title: 'Primeira do Dia!',
          message: 'Você completou sua primeira tarefa de hoje. Parabéns pelo foco!',
          icon: 'trophy'
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
      emoji: newCatIcon,
      color: newCatColor
    });
    setNewCatName('');
  };

  const activeTemplates = useMemo(() => {
    const active = new Set();
    goals.forEach(goal => {
      if (goal.status === 'active' && !goal.deletedAt && !goal.deleted_at) {
        active.add(goal.title);
      }
    });
    return active;
  }, [goals]);

  const handleLoadTemplate = (template) => {
    if (activeTemplates.has(template.title)) {
      openCustomAlert(`O modelo "${template.title}" já está ativo em sua lista.`);
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
      openCustomAlert("Selecione ou preencha pelo menos uma tarefa com título.");
      return;
    }

    const goalTitle = customizingTemplate.title;
    const actions = enabledTasks.map(t => t.title.trim());
    const category = customizingTemplate.category || 'Pessoal';

    const categoryColors = {
      'Pets': '#B5A296',
      'Pessoal': '#10b981',
      'Trabalho': '#6366f1',
      'Estudos': '#3B82F6',
      'Lazer': '#EC4899'
    };
    const categoryIcons = {
      'Pets': 'pets',
      'Pessoal': 'home',
      'Trabalho': 'career',
      'Estudos': 'studies',
      'Lazer': 'travel'
    };

    const color = categoryColors[category] || '#4A654E';
    const icon = categoryIcons[category] || 'target';

    await onAddGoal({
      title: goalTitle,
      description: customizingTemplate.description || '',
      color,
      icon,
      actions,
      category
    });

    setCustomizingTemplate(null);
    setIsTemplatesOpen(false);
    logEvent('template_loaded', { template_id: customizingTemplate.id });
  };

  const handleExportGoogleCalendar = () => {
    if (!isPro) {
      openPaywall('google_calendar');
      setIsSyncModalOpen(false);
      return;
    }
    try {
      exportAllTasksToCalendar(tasks);
      window.open('https://calendar.google.com/calendar/r/settings/export', '_blank');
    } catch (err) {
      openCustomAlert(err.message, "Calendário");
    }
    setIsSyncModalOpen(false);
    logEvent('calendar_google_sync_clicked');
  };

  const handleExportIcsOnly = () => {
    if (!isPro) {
      openPaywall('google_calendar');
      setIsSyncModalOpen(false);
      return;
    }
    try {
      exportAllTasksToCalendar(tasks);
    } catch (err) {
      openCustomAlert(err.message, "Calendário");
    }
    setIsSyncModalOpen(false);
    logEvent('calendar_ics_sync_clicked');
  };

  // Filtragem de tarefas
  const baseFiltered = useMemo(() => {
    return tasks.filter(task => {
      if (task.deletedAt) return false;
      const meta = parseTaskMetadata(task.description);

      if (meta.archived) {
        if (filter !== 'archived') return false;
      } else {
        if (filter === 'archived') return false;
      }

      const q = searchQuery.toLowerCase();
      const matchesSearch = task.title.toLowerCase().includes(q) ||
        (task.description && task.description.toLowerCase().includes(q));

      const matchesStatus =
        filter === 'all' ? true :
          filter === 'active' ? !task.completed :
            filter === 'archived' ? true :
              task.completed;

      const matchesCat = categoryFilter === 'all' || task.category === categoryFilter;

      let matchesGoal = true;
      if (selectedGoalIdFilter !== 'all') {
        matchesGoal = (goalTasks || []).some(gt => gt.goal_id === selectedGoalIdFilter && gt.task_id === task.id);
      }

      return matchesSearch && matchesStatus && matchesCat && matchesGoal;
    });
  }, [tasks, filter, searchQuery, categoryFilter, selectedGoalIdFilter, goalTasks]);

  // Filtragem exclusiva para o Kanban que ignora o filtro de status superior (all/active/completed)
  const kanbanFiltered = useMemo(() => {
    return tasks.filter(task => {
      if (task.deletedAt) return false;
      const meta = parseTaskMetadata(task.description);
      if (meta.archived) return false;

      const q = searchQuery.toLowerCase();
      const matchesSearch = task.title.toLowerCase().includes(q) ||
        (task.description && task.description.toLowerCase().includes(q));

      const matchesCat = categoryFilter === 'all' || task.category === categoryFilter;

      let matchesGoal = true;
      if (selectedGoalIdFilter !== 'all') {
        matchesGoal = (goalTasks || []).some(gt => gt.goal_id === selectedGoalIdFilter && gt.task_id === task.id);
      }

      return matchesSearch && matchesCat && matchesGoal;
    });
  }, [tasks, searchQuery, categoryFilter, selectedGoalIdFilter, goalTasks]);

  const looseTasksFiltered = useMemo(() => {
    return baseFiltered.filter(task => {
      const link = goalTasks.find(gt => gt.task_id === task.id);
      const goal = link ? goals.find(g => g.id === link.goal_id && !g.deletedAt) : null;
      if (goal && goal.status === 'active') return false;
      return true;
    });
  }, [baseFiltered, goalTasks, goals]);

  const activeGoals = useMemo(() => {
    let baseGoals = (goals || []).filter(g => g.status === 'active' && !g.deletedAt);
    if (selectedGoalIdFilter !== 'all') {
      baseGoals = baseGoals.filter(g => g.id === selectedGoalIdFilter);
    }

    // Sort goals chronologically by target_date
    return [...baseGoals].sort((a, b) => {
      const dateA = a.target_date || '';
      const dateB = b.target_date || '';

      if (dateA && dateB) {
        return dateA.localeCompare(dateB);
      }
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;

      return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
    });
  }, [goals, selectedGoalIdFilter]);

  const sections = useMemo(() => categorizeTasks(looseTasksFiltered, goals, goalTasks), [looseTasksFiltered, goals, goalTasks]);

  // Estatísticas rápidas
  const activeTasks = useMemo(() => tasks.filter(t => !t.deletedAt), [tasks]);
  const total = activeTasks.length;
  const active = activeTasks.filter(t => !t.completed).length;
  const completed = activeTasks.filter(t => t.completed).length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Lógica Kanban
  const kanbanTasks = useMemo(() => {
    const list = { todo: [], inProgress: [], completed: [] };
    kanbanFiltered.forEach(task => {
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
    // Sort each column by time
    list.todo = sortByTime(list.todo);
    list.inProgress = sortByTime(list.inProgress);
    list.completed = sortByTime(list.completed);
    return list;
  }, [kanbanFiltered]);

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
    <div className="tasks-view animate-fade-in" style={{ paddingBottom: '80px' }}>

      {/* ── Hábitos Diários (Fixo no Topo) ── */}
      <div className="myday-habits-container animate-fade-in" style={{ marginBottom: '24px' }}>
        <HabitsWidget habitsManager={habitsManager} goals={goals} />
      </div>

      {/* ── Header da página ──────────────────────────────── */}
      <div className="tasks-page-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div className="tasks-page-title-block">
          <h1 className="tasks-page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span>Meu Dia</span>
            <button
              onClick={() => {
                setSettingsTab('trash');
                setActiveTab('settings');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: '500',
                padding: '4px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                color: 'var(--prio-alta-text)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                verticalAlign: 'middle'
              }}
              title="Ver tarefas excluídas na lixeira"
            >
              <Trash2 size={12} />
              <span>Lixeira ({deletedTasks?.length || 0})</span>
            </button>
            <button
              onClick={() => setIsArchivedModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: '500',
                padding: '4px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                color: 'var(--primary)',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                verticalAlign: 'middle'
              }}
              title="Ver itens arquivados"
            >
              <Archive size={12} />
              <span>Arquivados ({(goals || []).filter(g => g.status === 'archived' && !g.deletedAt).length + (tasks || []).filter(t => parseTaskMetadata(t.description).archived === true && !t.deletedAt).length})</span>
            </button>
          </h1>
          <p className="tasks-page-subtitle">
            {active > 0
              ? `${active} pendente${active > 1 ? 's' : ''} · ${rate}% concluído`
              : rate === 100 && total > 0
                ? 'Tudo concluído!'
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
              onClick={() => { setViewMode(item.key); setShowCategoryManager(false); }}
              className={`nav-tab-button ${viewMode === item.key ? 'active-nav-tab' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
            >
              {item.icon}
              <span className="hide-on-mobile">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Aviso de Tarefas Ocultas (Plano Free) */}
      {!isPro && hiddenTasksCount > 0 && (
        <div
          className="animate-fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'rgba(2, 132, 199, 0.08)',
            border: '1px solid rgba(2, 132, 199, 0.2)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>
              Você possui <strong>{hiddenTasksCount}</strong> {hiddenTasksCount === 1 ? 'tarefa antiga oculta' : 'tarefas antigas ocultas'} pelo limite de 30 dias do plano Free.
            </span>
          </div>
          <button
            onClick={() => openPaywall('tasks_history_limit_warning')}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={e => e.target.style.opacity = 0.9}
            onMouseLeave={e => e.target.style.opacity = 1}
          >
            Desbloquear Histórico Pro
          </button>
        </div>
      )}

      {/* Caixa de Entrada Rápida (Inbox Bloco 4) */}
      <form onSubmit={handleQuickAddSubmit} className="quick-inbox-container">
        <input
          type="text"
          placeholder="Digite uma tarefa e pressione Enter..."
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
          <button
            onClick={openNewGoalModal}
            className="tasks-add-btn"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-medium)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Target size={14} style={{ color: 'var(--primary)' }} />
            <span>Novo Objetivo</span>
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
                    {cat.iconName || cat.emoji ? (
                      <MFIcon name={cat.iconName || cat.emoji} size={16} style={{ color: cat.color }} />
                    ) : (
                      <MFIcon name="briefcase" size={16} style={{ color: cat.color }} />
                    )}
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
              <select
                value={newCatIcon}
                onChange={e => setNewCatIcon(e.target.value)}
                className="form-input"
                style={{ width: '110px', height: '36px', padding: '0 8px', cursor: 'pointer', fontSize: '12px' }}
                title="Selecionar Ícone"
              >
                <option value="briefcase">Trabalho</option>
                <option value="user">Pessoal</option>
                <option value="book">Estudos</option>
                <option value="dumbbell">Saúde</option>
                <option value="heart">Bem-estar</option>
                <option value="palette">Criatividade</option>
                <option value="music">Música</option>
                <option value="plane">Viagem</option>
                <option value="sprout">Crescimento</option>
                <option value="trending">Finanças</option>
                <option value="star">Favorito</option>
                <option value="users">Social</option>
              </select>
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
        <div className="tasks-filter-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="tasks-status-pills" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'Todas', count: total },
              { key: 'active', label: 'Pendentes', count: active },
              { key: 'completed', label: 'Concluídas', count: completed }
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

            <div className="tasks-cat-dropdown" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '4px' }}>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: '600',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
              >
                <option value="all">🏷️ Todas as Categorias</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {getCategoryEmoji(cat)} {cat.name}
                  </option>
                ))}
              </select>
            </div>
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
          {/* Banner de Filtro de Objetivo Ativo */}
          {selectedGoalIdFilter !== 'all' && (
            (() => {
              const activeGoal = goals.find(g => g.id === selectedGoalIdFilter);
              if (!activeGoal) return null;
              return (
                <div style={{
                  backgroundColor: 'var(--primary-glow)',
                  border: '1px solid var(--primary-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 18px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }} className="animate-fade-in">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={16} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                      Filtrado por objetivo: <strong style={{ color: activeGoal.color || 'var(--primary)' }}>{activeGoal.title}</strong>
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedGoalIdFilter('all')}
                    style={{
                      border: 'none',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '12px',
                      padding: '4px 12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: 'var(--text-light)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Limpar Filtro
                  </button>
                </div>
              );
            })()
          )}
          {/* 🎯 Objetivos Ativos (Accordions) */}
          {filter === 'all' && activeGoals.length > 0 && (
            <div className="myday-goals-section animate-fade-in" style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingLeft: '4px' }}>
                <Target size={16} style={{ color: 'var(--primary)' }} />
                <span>Objetivos em Andamento</span>
                <span style={{ fontSize: '12px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-light)' }}>
                  {activeGoals.length}
                </span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeGoals.map(goal => {
                  const linkedTasks = tasks.filter(t => {
                    const link = goalTasks.find(gt => gt.goal_id === goal.id && gt.task_id === t.id);
                    return link && !t.deletedAt;
                  });
                  const totalTasks = linkedTasks.length;
                  const doneTasks = linkedTasks.filter(t => t.completed).length;
                  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
                  const isExpanded = selectedGoalIdFilter === goal.id || !!expandedGoals[goal.id];
                  const isMatchingCategory = categoryFilter === 'all' || linkedTasks.some(t => t.category === categoryFilter);

                  return (
                    <div
                      key={goal.id}
                      className="myday-goal-accordion-card"
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        border: isMatchingCategory
                          ? `2px solid ${goal.color || 'var(--primary)'}`
                          : `1px solid var(--border-light)`,
                        borderRadius: 'var(--radius-md)',
                        overflow: activeGoalKebabId === goal.id ? 'visible' : 'hidden',
                        opacity: isMatchingCategory ? 1 : 0.45,
                        transition: 'all 0.2s ease',
                        boxShadow: isExpanded ? `0 4px 12px ${goal.color ? `${goal.color}15` : 'rgba(0,0,0,0.1)'}` : 'none'
                      }}
                    >
                      {/* Accordion Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          gap: '12px',
                          borderBottom: isExpanded ? '1px solid var(--border-light)' : '1px solid transparent'
                        }}
                        onClick={() => toggleGoalExpand(goal.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: `${goal.color || 'var(--primary)'}15`, color: goal.color || 'var(--primary)', flexShrink: 0 }}>
                            <MFIcon name={goal.icon || 'target'} size={15} />
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {goal.title}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                              <div style={{ height: '4px', width: '100px', backgroundColor: 'var(--bg-card-hover)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                                <div style={{ height: '100%', width: `${pct}%`, backgroundColor: goal.color || 'var(--primary)', transition: 'width 0.3s ease' }} />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: '600', color: goal.color || 'var(--primary)' }}>
                                {pct}% ({doneTasks}/{totalTasks})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, position: 'relative' }} onClick={e => e.stopPropagation()}>

                          {/* Goal Kebab Menu Trigger */}
                          <button
                            onClick={() => setActiveGoalKebabId(activeGoalKebabId === goal.id ? null : goal.id)}
                            className="todo-item-action-btn edit-btn"
                            style={{ padding: '6px' }}
                            title="Opções do Objetivo"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {/* Kebab Dropdown Panel */}
                          {activeGoalKebabId === goal.id && (
                            <>
                              <div
                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                                onClick={() => setActiveGoalKebabId(null)}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '32px',
                                  right: '24px',
                                  backgroundColor: 'var(--bg-card)',
                                  border: '1px solid var(--border-medium)',
                                  borderRadius: '8px',
                                  padding: '6px 0',
                                  zIndex: 1000,
                                  minWidth: '130px',
                                  boxShadow: 'var(--shadow-md)',
                                  display: 'flex',
                                  flexDirection: 'column'
                                }}
                              >
                                <button
                                  onClick={() => {
                                    openEditGoalModal(goal);
                                    setActiveGoalKebabId(null);
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-main)',
                                    fontSize: '12.5px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <Edit2 size={13} />
                                  <span>Editar</span>
                                </button>

                                <button
                                  onClick={() => {
                                    handleDuplicateGoal(goal.id);
                                    setActiveGoalKebabId(null);
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-main)',
                                    fontSize: '12.5px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <Copy size={13} />
                                  <span>Duplicar</span>
                                </button>

                                <button
                                  onClick={() => {
                                    handleCompleteGoal(goal.id);
                                    setActiveGoalKebabId(null);
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    background: 'none',
                                    border: 'none',
                                    color: '#22c55e',
                                    fontSize: '12.5px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <Check size={13} />
                                  <span>Concluir</span>
                                </button>

                                <button
                                  onClick={() => {
                                    openCustomConfirm(
                                      "Deseja realmente arquivar este objetivo?",
                                      "Arquivar Objetivo",
                                      () => onUpdateGoal(goal.id, { status: 'archived' })
                                    );
                                    setActiveGoalKebabId(null);
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    fontSize: '12.5px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <Archive size={13} />
                                  <span>Arquivar</span>
                                </button>

                                <button
                                  onClick={() => {
                                    openCustomConfirm(
                                      "Deseja realmente excluir permanentemente este objetivo?",
                                      "Excluir Objetivo",
                                      () => onDeleteGoal(goal.id)
                                    );
                                    setActiveGoalKebabId(null);
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    fontSize: '12.5px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <Trash size={13} />
                                  <span>Excluir</span>
                                </button>
                              </div>
                            </>
                          )}

                          <span style={{ color: 'var(--text-muted)', display: 'flex', paddingLeft: '4px' }} onClick={() => toggleGoalExpand(goal.id)}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </span>
                        </div>
                      </div>

                      {/* Accordion Body */}
                      {isExpanded && (
                        <div style={{ padding: '16px', backgroundColor: 'var(--bg-card-hover)' }}>
                          {/* Goal Details: description and attachments */}
                          {(goal.description || (goal.attachments && goal.attachments.length > 0)) && (
                            <div style={{
                              marginBottom: '16px',
                              padding: '12px 14px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid var(--border-light)'
                            }}>
                              {goal.description && (
                                <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '0 0 8px 0', whiteSpace: 'pre-wrap', lineHeight: '1.45' }}>
                                  {goal.description}
                                </p>
                              )}
                              {goal.attachments && goal.attachments.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: goal.description ? '10px' : '0' }}>
                                  {goal.attachments.map((file, idx) => {
                                    const isImg = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name || file.url);
                                    if (isImg) {
                                      return (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveLightboxFile(file);
                                          }}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '5px 10px',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: 'var(--text-main)',
                                            backgroundColor: 'var(--bg-card)',
                                            border: '1px solid var(--border-light)',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                          }}
                                          onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = 'var(--primary)';
                                            e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                                          }}
                                          onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = 'var(--border-light)';
                                            e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                                          }}
                                        >
                                          <Image size={12} style={{ color: 'var(--primary)' }} />
                                          <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {file.name || 'Anexo'}
                                          </span>
                                        </button>
                                      );
                                    }
                                    return (
                                      <a
                                        key={idx}
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '5px 10px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          color: 'var(--text-main)',
                                          backgroundColor: 'var(--bg-card)',
                                          border: '1px solid var(--border-light)',
                                          borderRadius: '20px',
                                          textDecoration: 'none',
                                          transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={e => {
                                          e.currentTarget.style.borderColor = 'var(--primary)';
                                          e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                                        }}
                                        onMouseLeave={e => {
                                          e.currentTarget.style.borderColor = 'var(--border-light)';
                                          e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                                        }}
                                      >
                                        <Paperclip size={12} />
                                        <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {file.name || 'Anexo'}
                                        </span>
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {linkedTasks.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {sortByTime(linkedTasks).map(task => (
                                <TodoItem
                                  key={task.id}
                                  item={task}
                                  onToggleComplete={handleToggleCompleteWithAchievement}
                                  onDelete={setTaskToDelete}
                                  onEdit={openEditTaskModal}
                                  goalId={goal.id}
                                  onUnlinkGoal={handleUnlinkTask}
                                  onDuplicate={onDuplicateTask}
                                />
                              ))}
                              {/* Link task button always visible at the bottom of the list */}
                              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                                <button
                                  onClick={() => {
                                    setEditingTask(null);
                                    setTitle('');
                                    setDescription('');
                                    setCategory(categories[0]?.id || 'Trabalho');
                                    setPriority('Média');
                                    setDueDate('');
                                    setDueTime('');
                                    setRecurrence('nenhuma');
                                    setLinkedGoal(goal.id);
                                    setIsModalOpen(true);
                                  }}
                                  className="tasks-add-btn btn-primary-glow"
                                  style={{ display: 'inline-flex', padding: '6px 12px', fontSize: '12px' }}
                                >
                                  <Plus size={14} /> Nova tarefa
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)', fontSize: '13px' }}>
                              <p style={{ margin: '0 0 10px' }}>Nenhuma tarefa vinculada a este objetivo.</p>
                              <button
                                onClick={() => {
                                  setEditingTask(null);
                                  setTitle('');
                                  setDescription('');
                                  setCategory(categories[0]?.id || 'Trabalho');
                                  setPriority('Média');
                                  setDueDate('');
                                  setDueTime('');
                                  setRecurrence('nenhuma');
                                  setLinkedGoal(goal.id);
                                  setIsModalOpen(true);
                                }}
                                className="tasks-add-btn btn-primary-glow"
                                style={{ display: 'inline-flex', padding: '6px 12px', fontSize: '12px' }}
                              >
                                <Plus size={14} /> Vincular tarefa
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {looseTasksFiltered.length > 0 ? (
            <div className="tasks-sections-wrapper">
              <TaskSection
                title="Atrasadas"
                icon={<AlertTriangle size={15} style={{ color: 'var(--danger)' }} />}
                accent="overdue"
                tasks={sections.overdue}
                onEdit={openEditTaskModal}
                onDelete={setTaskToDelete}
                onToggle={handleToggleCompleteWithAchievement}
                defaultOpen={true}
                isOverdue={true}
              />
              <TaskSection
                title="Hoje"
                icon={<Sun size={15} style={{ color: 'var(--primary)' }} />}
                tasks={sections.today}
                onEdit={openEditTaskModal}
                onDelete={setTaskToDelete}
                onToggle={handleToggleCompleteWithAchievement}
                defaultOpen={true}
              />
              <TaskSection
                title="Amanhã"
                icon={<Moon size={15} style={{ color: '#818cf8' }} />}
                tasks={sections.tomorrow}
                onEdit={openEditTaskModal}
                onDelete={setTaskToDelete}
                onToggle={handleToggleCompleteWithAchievement}
                defaultOpen={true}
              />
              <TaskSection
                title="Esta semana"
                icon={<Calendar size={15} />}
                tasks={sections.thisWeek}
                onEdit={openEditTaskModal}
                onDelete={setTaskToDelete}
                onToggle={handleToggleCompleteWithAchievement}
                defaultOpen={true}
              />
              <TaskSection
                title="Futuras"
                icon={<Zap size={15} style={{ color: '#eab308' }} />}
                tasks={sections.future}
                onEdit={openEditTaskModal}
                onDelete={setTaskToDelete}
                onToggle={handleToggleCompleteWithAchievement}
                defaultOpen={false}
              />
              <TaskSection
                title="Sem prazo definido"
                icon={<Pin size={15} />}
                tasks={sections.noDueDate}
                onEdit={openEditTaskModal}
                onDelete={setTaskToDelete}
                onToggle={handleToggleCompleteWithAchievement}
                defaultOpen={false}
              />
              {Object.entries(sections.templateGroups || {}).map(([templateName, templateTasks]) => {
                const goal = goals.find(g => g.title === templateName && !g.deletedAt);
                return (
                  <TaskSection
                    key={templateName}
                    title={templateName}
                    icon={goal ? <MFIcon name={goal.icon || 'target'} size={15} color="var(--primary)" /> : <Sparkles size={15} style={{ color: 'var(--primary)' }} />}
                    tasks={templateTasks}
                    onEdit={openEditTaskModal}
                    onDelete={setTaskToDelete}
                    onToggle={handleToggleCompleteWithAchievement}
                    defaultOpen={true}
                    goalId={goal?.id}
                    onUnlinkGoal={handleUnlinkTask}
                  />
                );
              })}
              <TaskSection
                title="Concluídas"
                icon={<CheckCircle size={15} style={{ color: '#22c55e' }} />}
                tasks={sections.completed}
                onEdit={openEditTaskModal}
                onDelete={setTaskToDelete}
                onToggle={handleToggleCompleteWithAchievement}
                defaultOpen={false}
              />
            </div>
          ) : (
            activeGoals.length === 0 && (
              <EmptyState filter={filter} searchQuery={searchQuery} onAdd={openNewTaskModal} onAddGoal={openNewGoalModal} />
            )
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
                          <span className={`badge-category ${(task.category || 'Trabalho').toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                            {task.category || 'Trabalho'}
                          </span>
                          <span className={`badge-priority ${(task.priority || 'Média').toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                            {task.priority || 'Média'}
                          </span>
                        </div>
                        {task.dueDate && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={11} />
                            <span>{formatTaskDateDisplay(task.dueDate)}{formatTaskTimeDisplay(task.dueDate, meta.due_time) ? ` • ${formatTaskTimeDisplay(task.dueDate, meta.due_time)}` : ''}</span>
                          </span>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', alignItems: 'center' }}>
                          <button
                            onClick={() => handleMoveKanban(task, 'in_progress')}
                            className="todo-item-action-btn edit-btn"
                            style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', padding: '4px 8px' }}
                          >
                            Fazer
                          </button>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => onDuplicateTask(task.id)} className="todo-item-action-btn duplicate-btn" title="Duplicar"><Copy size={13} /></button>
                            <button onClick={() => openEditTaskModal(task)} className="todo-item-action-btn edit-btn"><Edit2 size={13} /></button>
                            <button onClick={() => setTaskToDelete(task)} className="todo-item-action-btn delete-btn"><Trash2 size={13} /></button>
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
                          <span className={`badge-category ${(task.category || 'Trabalho').toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                            {task.category || 'Trabalho'}
                          </span>
                          <span className={`badge-priority ${(task.priority || 'Média').toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                            {task.priority || 'Média'}
                          </span>
                        </div>
                        {task.dueDate && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={11} />
                            <span>{formatTaskDateDisplay(task.dueDate)}{formatTaskTimeDisplay(task.dueDate, meta.due_time) ? ` • ${formatTaskTimeDisplay(task.dueDate, meta.due_time)}` : ''}</span>
                          </span>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => handleMoveKanban(task, 'todo')} className="todo-item-action-btn edit-btn" style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px' }} title="Mover para A Fazer">
                              <ArrowLeft size={12} />
                            </button>
                            <button onClick={() => handleMoveKanban(task, 'completed')} className="todo-item-action-btn edit-btn" style={{ fontSize: '11px', padding: '4px 8px' }}>
                              Concluir
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => onDuplicateTask(task.id)} className="todo-item-action-btn duplicate-btn" title="Duplicar"><Copy size={13} /></button>
                            <button onClick={() => openEditTaskModal(task)} className="todo-item-action-btn edit-btn"><Edit2 size={13} /></button>
                            <button onClick={() => setTaskToDelete(task)} className="todo-item-action-btn delete-btn"><Trash2 size={13} /></button>
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
                            <span className={`badge-category ${(task.category || 'Trabalho').toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                              {task.category || 'Trabalho'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', alignItems: 'center' }}>
                            <button onClick={() => handleMoveKanban(task, 'in_progress')} className="todo-item-action-btn edit-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 8px' }}>
                              <RotateCcw size={12} /> Reabrir
                            </button>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button onClick={() => onDuplicateTask(task.id)} className="todo-item-action-btn duplicate-btn" title="Duplicar"><Copy size={13} /></button>
                              <button onClick={() => setTaskToDelete(task)} className="todo-item-action-btn delete-btn"><Trash2 size={13} /></button>
                            </div>
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
                      <span>{kanbanTasks.completed.length} tarefas concluídas ocultas</span>
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
              const dayTasks = tasks.filter(t => isTaskOnDate(t, cell.dateStr));
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
              {tasks.filter(t => isTaskOnDate(t, selectedCalendarDay)).length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhuma tarefa agendada.</p>
              ) : (
                tasks.filter(t => isTaskOnDate(t, selectedCalendarDay)).map(task => (
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
                        {isCompleted && <Check size={10} />}
                      </button>
                      <span style={{ fontSize: '13px', color: 'var(--text-main)', flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sprout size={13} style={{ color: 'var(--success)' }} /> {habit.title}
                      </span>
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
                <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>{editingTask ? <Edit2 size={16} /> : <Sparkles size={16} />}</div>
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
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
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
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
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
                      <option key={g.id} value={g.id}>{g.title}</option>
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
                  <option value="diaria">Diária</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                  <option value="dias_semana">Dias específicos da semana</option>
                  <option value="personalizada">Personalizada</option>
                </select>
              </div>

              {recurrence === 'personalizada' && (
                <div className="todo-form-row animate-scale-up" style={{ marginTop: '12px', gap: '12px' }}>
                  <div className="todo-form-group" style={{ flex: 1 }}>
                    <label className="todo-form-label">Repetir a cada</label>
                    <input
                      type="number"
                      min="1"
                      value={recurrenceInterval}
                      onChange={e => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                      className="todo-modal-input"
                    />
                  </div>
                  <div className="todo-form-group" style={{ flex: 1 }}>
                    <label className="todo-form-label">Unidade de tempo</label>
                    <select
                      value={recurrenceUnit}
                      onChange={e => setRecurrenceUnit(e.target.value)}
                      className="todo-modal-select"
                    >
                      <option value="dias">Dia(s)</option>
                      <option value="semanas">Semana(s)</option>
                      <option value="meses">Mês(es)</option>
                    </select>
                  </div>
                </div>
              )}

              {recurrence === 'dias_semana' && (
                <div className="todo-form-group animate-scale-up" style={{ marginTop: '12px' }}>
                  <label className="todo-form-label">Escolha os dias da semana</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                    {[
                      { label: 'Dom', val: 0 },
                      { label: 'Seg', val: 1 },
                      { label: 'Ter', val: 2 },
                      { label: 'Qua', val: 3 },
                      { label: 'Qui', val: 4 },
                      { label: 'Sex', val: 5 },
                      { label: 'Sáb', val: 6 },
                    ].map(d => {
                      const isChecked = recurrenceDays.includes(d.val);
                      return (
                        <button
                          key={d.val}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setRecurrenceDays(prev => prev.filter(v => v !== d.val));
                            } else {
                              setRecurrenceDays(prev => [...prev, d.val].sort());
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12.5px',
                            fontWeight: '600',
                            border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                            backgroundColor: isChecked ? 'var(--primary-glow)' : 'var(--bg-card-hover)',
                            color: isChecked ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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
                <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}><Calendar size={24} /></div>
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
                <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}><Download size={24} /></div>
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
              Modelos de Objetivos
            </h3>
            <button
              onClick={() => {
                setIsTemplatesOpen(false);
                openNewGoalModal();
              }}
              style={{
                marginLeft: 'auto',
                marginRight: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '600',
                color: 'white',
                background: 'var(--primary)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              + Novo Objetivo
            </button>
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
                    'Pets': 'target',
                    'Trabalho': 'briefcase',
                    'Estudos': 'book',
                    'Lazer': 'heart',
                  };
                  const iconName = templateIconMap[template.category] || 'briefcase';

                  return (
                    <div
                      key={template.id}
                      className={`template-persona-card ${isAlreadyActive ? 'template-disabled-card' : ''}`}
                    >
                      <h4 className="template-persona-title">
                        <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}><MFIcon name={iconName} size={16} /></span>
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
                        {isAlreadyActive ? 'Objetivo Ativo' : 'Importar Objetivo'}
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Global de Confirmação de Deleção (Lixeira / Soft Delete) */}
      {taskToDelete && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 999999, padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)',
            maxWidth: '400px', width: '100%', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', marginBottom: '12px' }}>
              <AlertCircle size={24} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>Excluir tarefa?</h3>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
              Tem certeza que deseja mover a tarefa <strong>"{taskToDelete.title}"</strong> para a lixeira? Ela poderá ser restaurada a qualquer momento a partir da aba Lixeira.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setTaskToDelete(null)}
                className="btn-secondary"
                style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--border-medium)', background: 'transparent', color: 'var(--text-main)' }}
              >
                Cancelar
              </button>
              <button
                ref={el => { if (el) el.focus({ preventScroll: true }); }}
                onClick={() => {
                  onDeleteTask(taskToDelete.id);
                  setTaskToDelete(null);
                }}
                className="btn-primary"
                style={{ backgroundColor: 'var(--danger)', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', border: 'none', fontWeight: '600' }}
              >
                Mover para Lixeira
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Criação / Edição de Objetivos */}
      {isGoalModalOpen && (
        <GoalModal
          isOpen={isGoalModalOpen}
          editingGoal={editingGoal}
          onClose={() => {
            setIsGoalModalOpen(false);
            setEditingGoal(null);
          }}
          onSave={handleSaveGoal}
          onDelete={handleDeleteGoal}
        />
      )}

      {/* Alerta de confirmação para conclusão de objetivo com tarefas pendentes */}
      {pendingCompleteGoalId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 999999, padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)',
            maxWidth: '400px', width: '100%', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '12px' }}>
              <AlertCircle size={24} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>Concluir Objetivo?</h3>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
              Este objetivo possui tarefas pendentes. Deseja marcar todas as tarefas vinculadas a ele como concluídas também?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setPendingCompleteGoalId(null)}
                className="btn-secondary"
                style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--border-medium)', background: 'transparent', color: 'var(--text-main)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onUpdateGoal(pendingCompleteGoalId, { status: 'completed' });
                  setPendingCompleteGoalId(null);
                }}
                className="btn-secondary"
                style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--border-medium)', background: 'var(--bg-card-hover)', color: 'var(--text-main)' }}
              >
                Apenas Objetivo
              </button>
              <button
                onClick={confirmCompleteGoalWithTasks}
                className="btn-primary"
                style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', border: 'none', fontWeight: '600' }}
              >
                Concluir Tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Itens Arquivados */}
      {isArchivedModalOpen && (
        <div
          className="modal-overlay animate-fade-in"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 15000,
            padding: '16px'
          }}
        >
          <div
            className="modal-content animate-scale-up"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '550px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Archive size={20} style={{ color: 'var(--primary)' }} />
                <span>Itens Arquivados</span>
              </h3>
              <button
                onClick={() => setIsArchivedModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tab Selection */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', padding: '0 16px' }}>
              <button
                onClick={() => setArchivedTab('goals')}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'none',
                  border: 'none',
                  color: archivedTab === 'goals' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: '700',
                  fontSize: '14px',
                  borderBottom: archivedTab === 'goals' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Objetivos ({(goals || []).filter(g => g.status === 'archived' && !g.deletedAt).length})
              </button>
              <button
                onClick={() => setArchivedTab('tasks')}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'none',
                  border: 'none',
                  color: archivedTab === 'tasks' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: '700',
                  fontSize: '14px',
                  borderBottom: archivedTab === 'tasks' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Tarefas ({(tasks || []).filter(t => parseTaskMetadata(t.description).archived === true && !t.deletedAt).length})
              </button>
            </div>

            {/* List Area */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {archivedTab === 'goals' ? (
                (goals || []).filter(g => g.status === 'archived' && !g.deletedAt).length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: '40px 0', fontSize: '13.5px' }}>
                    Nenhum objetivo arquivado.
                  </div>
                ) : (
                  (goals || []).filter(g => g.status === 'archived' && !g.deletedAt).map(goal => (
                    <div
                      key={goal.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                        {goal.title}
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            onUpdateGoal(goal.id, { status: 'active' });
                            openCustomAlert("Objetivo restaurado com sucesso!", "Restaurado");
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: 'var(--primary)',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Restaurar
                        </button>
                        <button
                          onClick={() => {
                            openCustomConfirm(
                              "Excluir permanentemente este objetivo?",
                              "Excluir Objetivo",
                              () => onDeleteGoal(goal.id)
                            );
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))
                )
              ) : (
                (tasks || []).filter(t => parseTaskMetadata(t.description).archived === true && !t.deletedAt).length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: '40px 0', fontSize: '13.5px' }}>
                    Nenhuma tarefa arquivada.
                  </div>
                ) : (
                  (tasks || []).filter(t => parseTaskMetadata(t.description).archived === true && !t.deletedAt).map(task => {
                    const meta = parseTaskMetadata(task.description);
                    const cleanDesc = formatDescriptionWithoutMetadata(task.description);
                    return (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-light)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {task.title}
                          </span>
                          {cleanDesc && (
                            <span style={{ fontSize: '11px', color: 'var(--text-light)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {cleanDesc}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              const updatedDesc = buildDescriptionWithMetadata(task.description, meta.due_time, meta.recurrence, false);
                              onUpdateTask(task.id, { description: updatedDesc });
                              openCustomAlert("Tarefa restaurada com sucesso!", "Restaurada");
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: 'var(--primary)',
                              color: '#FFFFFF',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            Restaurar
                          </button>
                          <button
                            onClick={() => {
                              openCustomConfirm(
                                "Excluir permanentemente esta tarefa?",
                                "Excluir Tarefa",
                                () => onDeleteTask(task.id)
                              );
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

