import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { supabase } from '../supabaseClient';
import { tasksService } from '../services/tasksService';
import { goalsService } from '../services/goalsService';
import { habitsService } from '../services/habitsService';
import { achievementsService } from '../services/achievementsService';
import { eventsService } from '../services/eventsService';
import { profilesService } from '../services/profilesService';
import { ACHIEVEMENTS, calcStats, calcStreak } from '../hooks/useAchievements';
import { subscribe as subscribeSync, initSyncQueue, generateId } from '../services/syncQueue';
import { initEventBatcher } from '../services/eventBatcher';
import { generateInsights } from '../intelligence/productIntelligence';
import { getEngagementSuggestions } from '../intelligence/retentionEngine';
import { eventStore } from '../services/eventStore';
import { stateEngine } from '../services/stateEngine';
import { eventEmitter } from '../services/eventEmitter';
import { localDB } from '../db/localDB';
import { isAdmin as checkIsAdmin } from '../../lib/auth/adminAuth.js';
import { useAuthMachine } from '../hooks/useAuthMachine.js';
import AccountReactivationModal from '../components/AccountReactivationModal.jsx';
import CustomDialogModal from '../components/CustomDialogModal.jsx';
import { ensureDateTimezoneNoon } from '../utils/dateUtils';

// ─── Helpers para Metadados de Tarefas (Horário e Recorrência) ───────────────
export function parseTaskMetadata(description = '') {
  if (!description) return { due_time: '', recurrence: 'nenhuma', archived: false };
  const marker = '--flowday-meta--';
  const parts = description.split(marker);
  if (parts.length < 2) return { due_time: '', recurrence: 'nenhuma', archived: false };
  try {
    const parsed = JSON.parse(parts[1].trim());
    return { due_time: '', recurrence: 'nenhuma', archived: false, ...parsed };
  } catch (e) {
    return { due_time: '', recurrence: 'nenhuma', archived: false };
  }
}

export function formatDescriptionWithoutMetadata(description = '') {
  if (!description) return '';
  const marker = '--flowday-meta--';
  return description.split(marker)[0].trim();
}

export function buildDescriptionWithMetadata(userDesc = '', due_time = '', recurrence = 'nenhuma', archived = false, extraMeta = {}) {
  const cleanDesc = formatDescriptionWithoutMetadata(userDesc);
  const existingMeta = parseTaskMetadata(userDesc);
  const marker = '--flowday-meta--';
  const meta = { ...existingMeta, due_time, recurrence, archived, ...extraMeta };
  return `${cleanDesc}\n\n${marker}\n${JSON.stringify(meta)}`;
}

export function calculateNextOccurrence(dueDateStr, recurrence, metadata = {}) {
  if (!dueDateStr) {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  }

  const [year, month, day] = dueDateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (recurrence === 'diaria') {
    date.setDate(date.getDate() + 1);
  } else if (recurrence === 'semanal') {
    date.setDate(date.getDate() + 7);
  } else if (recurrence === 'mensal') {
    date.setMonth(date.getMonth() + 1);
  } else if (recurrence === 'personalizada') {
    const interval = Number(metadata.recurrence_interval) || 1;
    const unit = metadata.recurrence_unit || 'dias';
    if (unit === 'dias') {
      date.setDate(date.getDate() + interval);
    } else if (unit === 'semanas') {
      date.setDate(date.getDate() + interval * 7);
    } else if (unit === 'meses') {
      date.setMonth(date.getMonth() + interval);
    }
  } else if (recurrence === 'dias_semana') {
    const targetDays = metadata.recurrence_days || []; // ex: [1, 3, 5] (Seg, Qua, Sex)
    if (targetDays.length > 0) {
      let found = false;
      for (let i = 1; i <= 7; i++) {
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + i);
        if (targetDays.includes(nextDay.getDay())) {
          date.setDate(date.getDate() + i);
          found = true;
          break;
        }
      }
      if (!found) {
        date.setDate(date.getDate() + 1);
      }
    } else {
      date.setDate(date.getDate() + 1);
    }
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ─── Categorias Padrão ────────────────────────────────────────────────────────
const defaultCategories = [
  { id: 'Trabalho', name: 'Trabalho', iconName: 'career', color: 'var(--primary)' },
  { id: 'Pessoal', name: 'Pessoal', iconName: 'home', color: 'var(--secondary)' },
  { id: 'Estudos', name: 'Estudos', iconName: 'studies', color: 'var(--accent)' },
  { id: 'Lazer', name: 'Lazer', iconName: 'travel', color: 'var(--focus)' },
  { id: 'Pets', name: 'Pets', iconName: 'pets', color: 'var(--success)' }
];

// ─── Context ──────────────────────────────────────────────────────────────────
export const AppContext = createContext(null);
const APP_MOUNT_TIME = Date.now();

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext deve ser usado dentro de <AppProvider>');
  return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {

  // ── Auth State Machine (Single Source of Truth) ───────────────────────────
  // Toda lógica de auth vive em useAuthMachine — AppContext é apenas consumidor.
  const authMachine = useAuthMachine();
  
  // Use a ref to avoid dependency changes and loops when dispatching / setting currentUser
  const authRef = React.useRef(authMachine);
  authRef.current = authMachine;

  // Derivados da machine — usados pelo restante do contexto e componentes.
  const currentUser = authMachine.user;
  const isInitializing = authMachine.isLoading;

  // setCurrentUser: shim de compatibilidade para código legado que ainda chama
  // setCurrentUser diretamente (handleLoginSuccess, handleLogout, etc.).
  // Roteia via dispatch da machine para manter SSoT.
  const setCurrentUser = useCallback((userOrUpdaterFn) => {
    const currentAuth = authRef.current;
    if (typeof userOrUpdaterFn === 'function') {
      // Suporte a updates funcionais (ex: USER_UPDATED com weekly_plan)
      // A machine já trata USER_UPDATED via onAuthStateChange — este path
      // é mantido apenas para retrocompatibilidade com código legado.
      const next = userOrUpdaterFn(currentAuth.user);
      if (next) {
        currentAuth.dispatch({ type: 'SIGNED_IN', rawUser: { ...next, user_metadata: next.user_metadata || {} }, session: currentAuth.session });
      } else {
        currentAuth.dispatch({ type: 'SIGNED_OUT' });
      }
    } else if (userOrUpdaterFn) {
      currentAuth.dispatch({ type: 'SIGNED_IN', rawUser: { ...userOrUpdaterFn, user_metadata: userOrUpdaterFn.user_metadata || {} }, session: currentAuth.session });
    } else {
      currentAuth.dispatch({ type: 'SIGNED_OUT' });
    }
  }, []);

  // ── Sync Status (resilience) ─────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState('healthy'); // 'healthy' | 'degraded' | 'offline'
  const [syncWarnings, setSyncWarnings] = useState([]);

  // ── Perfil do Usuário ──
  const [userProfile, setUserProfile] = useState(null);

  // ── Navegação ────────────────────────────────────────────────────────────────
  const VALID_TABS = new Set(['home', 'myday', 'focus', 'evolution', 'profile', 'admin', 'revenue', 'settings', 'goals', 'tasks', 'coach', 'analytics', 'performance', 'semanal', 'quinzenal', 'mensal']);
  const [activeTab, setActiveTab] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname.toLowerCase().replace(/\/$/, '');
        if (pathname.includes('/admin')) return 'admin';
        if (pathname.includes('/tasks') || pathname.includes('/tarefas')) return 'myday';
        if (pathname.includes('/goals') || pathname.includes('/objetivos')) return 'myday';
        if (pathname.includes('/myday') || pathname.includes('/meudia')) return 'myday';
        if (pathname.includes('/focus') || pathname.includes('/foco')) return 'focus';
        if (pathname.includes('/coach') || pathname.includes('/semanal') || pathname.includes('/quinzenal') || pathname.includes('/mensal')) return 'evolution';
        if (pathname.includes('/analytics') || pathname.includes('/evolucao')) return 'evolution';
        if (pathname.includes('/performance') || pathname.includes('/desempenho')) return 'evolution';
        if (pathname.includes('/evolution')) return 'evolution';
        if (pathname.includes('/profile') || pathname.includes('/perfil')) return 'profile';
        if (pathname.includes('/revenue') || pathname.includes('/financas')) return 'revenue';
        if (pathname.includes('/settings') || pathname.includes('/configuracoes')) return 'settings';

        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam && VALID_TABS.has(tabParam)) {
          if (tabParam === 'tasks' || tabParam === 'goals') return 'myday';
          if (tabParam === 'analytics' || tabParam === 'performance' || tabParam === 'coach' || tabParam === 'semanal' || tabParam === 'quinzenal' || tabParam === 'mensal') return 'evolution';
          return tabParam;
        }
        const rawHash = window.location.hash.replace(/^#\/?/, '');
        if (rawHash && VALID_TABS.has(rawHash)) {
          if (rawHash === 'tasks' || rawHash === 'goals') return 'myday';
          if (rawHash === 'analytics' || rawHash === 'performance' || rawHash === 'coach' || rawHash === 'semanal' || rawHash === 'quinzenal' || rawHash === 'mensal') return 'evolution';
          return rawHash;
        }
      }
    } catch (_) { }
    return 'home';
  });

  const [activeEvoTab, setActiveEvoTab] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname.toLowerCase();
        const search = window.location.search.toLowerCase();
        const hash = window.location.hash.toLowerCase();
        if (pathname.includes('/coach') || pathname.includes('/semanal') || pathname.includes('/quinzenal') || pathname.includes('/mensal') || search.includes('tab=coach') || hash.includes('coach')) {
          return 'coach';
        }
        return localStorage.getItem('flowday_active_evo_tab') || 'jornada';
      }
    } catch (_) {}
    return 'jornada';
  });

  const [coachPeriodicity, setCoachPeriodicity] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname.toLowerCase();
        const search = window.location.search.toLowerCase();
        const hash = window.location.hash.toLowerCase();
        if (pathname.includes('/semanal') || search.includes('semanal') || hash.includes('semanal')) return 'Semanal';
        if (pathname.includes('/quinzenal') || search.includes('quinzenal') || hash.includes('quinzenal')) return 'Quinzenal';
        if (pathname.includes('/mensal') || search.includes('mensal') || hash.includes('mensal')) return 'Mensal';
      }
    } catch (_) {}
    return 'Semanal';
  });

  const handleSetActiveTab = useCallback((tab, subTab = null, periodicity = null) => {
    let target = tab;
    
    // Normalize tab mapping
    if (tab === 'tasks' || tab === 'diario' || tab === 'myday' || tab === 'meudia') {
      target = 'myday';
    } else if (tab === 'goals') {
      target = 'home';
    } else if (tab === 'coach' || tab === 'semanal' || tab === 'quinzenal' || tab === 'mensal') {
      target = 'evolution';
      setActiveEvoTab('coach');
      if (typeof window !== 'undefined') localStorage.setItem('flowday_active_evo_tab', 'coach');
      
      let pVal = null;
      if (tab === 'semanal') pVal = 'Semanal';
      else if (tab === 'quinzenal') pVal = 'Quinzenal';
      else if (tab === 'mensal') pVal = 'Mensal';
      
      if (pVal) {
        setCoachPeriodicity(pVal);
      }
    } else if (tab === 'analytics' || tab === 'performance' || tab === 'evolution' || tab === 'jornada') {
      target = 'evolution';
      if (tab !== 'evolution') {
        setActiveEvoTab('jornada');
        if (typeof window !== 'undefined') localStorage.setItem('flowday_active_evo_tab', 'jornada');
      }
    }
    
    if (subTab) {
      setActiveEvoTab(subTab);
      if (typeof window !== 'undefined') localStorage.setItem('flowday_active_evo_tab', subTab);
    }
    if (periodicity) {
      setCoachPeriodicity(periodicity);
    }
    
    setActiveTab(target);
  }, []);

  const [settingsTab, setSettingsTab] = useState('general'); // 'general' | 'trash'

  // ── Som Ambiente Global ──
  const [ambientSoundFile, setAmbientSoundFile] = useState(() => localStorage.getItem('flowday_ambient_sound_file') || 'none');
  const [ambientSoundVolume, setAmbientSoundVolume] = useState(() => {
    const vol = localStorage.getItem('flowday_ambient_sound_volume');
    return vol !== null ? Number(vol) : 0.5;
  });
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const ambientAudioRef = useRef(null);
  const fadeIntervalRef = useRef(null);

  // Inicializa o elemento Audio e configura loops
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.onerror = (e) => {
      console.warn('[Audio] Erro ao reproduzir som ambiente:', e);
    };
    ambientAudioRef.current = audio;

    return () => {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        ambientAudioRef.current = null;
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, []);

  // Controla reprodução do som ambiente
  useEffect(() => {
    const audio = ambientAudioRef.current;
    if (!audio) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    if (ambientSoundFile === 'none') {
      audio.pause();
      audio.src = '';
      setIsAmbientPlaying(false);
      setAudioBlocked(false);
      localStorage.setItem('flowday_ambient_is_playing', 'false');
      localStorage.setItem('flowday_ambient_sound_file', 'none');
      return;
    }

    const targetSrc = `${window.location.origin}/assets/audio/${ambientSoundFile}`;
    if (audio.src !== targetSrc) {
      audio.pause();
      audio.src = targetSrc;
      audio.load();
    }

    audio.volume = ambientSoundVolume;
    localStorage.setItem('flowday_ambient_sound_file', ambientSoundFile);
    localStorage.setItem('flowday_ambient_sound_volume', String(ambientSoundVolume));
    localStorage.setItem('flowday_ambient_is_playing', String(isAmbientPlaying));

    if (isAmbientPlaying) {
      audio.play()
        .then(() => {
          setAudioBlocked(false);
        })
        .catch(e => {
          if (e.name === 'NotAllowedError') {
            setAudioBlocked(true);
            setIsAmbientPlaying(false);
            console.info('[Audio] Autoplay bloqueado pelo navegador.');
          } else {
            console.error('[Audio] Erro ao tocar som ambiente:', e);
          }
        });
    } else {
      audio.pause();
    }
  }, [ambientSoundFile, isAmbientPlaying]);

  // Sincroniza volume ao arrastar slider se não estiver no meio do fade
  useEffect(() => {
    const audio = ambientAudioRef.current;
    if (!audio || ambientSoundFile === 'none') return;
    if (!fadeIntervalRef.current) {
      audio.volume = ambientSoundVolume;
    }
    localStorage.setItem('flowday_ambient_sound_volume', String(ambientSoundVolume));
  }, [ambientSoundVolume, ambientSoundFile]);
  const [shouldOpenGoalModal, setShouldOpenGoalModal] = useState(false);

  // ── Tema ─────────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
  const [appBgColor, setAppBgColor] = useState(localStorage.getItem('app_bg_color') || '#F8FAFC');

  // ── Dados ────────────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [goalTasks, setGoalTasks] = useState([]);
  const [selectedGoalIdFilter, setSelectedGoalIdFilter] = useState('all');

  // ── Conquistas ───────────────────────────────────────────────────────────────
  const [unlockedAchievements, setUnlockedAchievements] = useState(null);
  const [unlockedKeys, setUnlockedKeys] = useState(null);
  const [toastQueue, setToastQueue] = useState([]);
  const [focusEvents, setFocusEvents] = useState([]);

  // ── Hábitos ──────────────────────────────────────────────────────────────────
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState([]);
  const [habitsLoading, setHabitsLoading] = useState(false);

  // ── Notificações & Undo (Soft Delete) ──────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [undoAction, setUndoAction] = useState(null);

  // ── Ref para lock de conquistas ───────────────────────────────────────────────
  const achievementChecking = useRef(false);
  const unlockedKeysRef = useRef(new Set());
  // Garante que first_success_action é emitido apenas uma vez por sessão
  const firstSuccessLogged = useRef(false);
  const dataLoadedOnce = useRef(false);
  const initialGoalsCount = useRef(-1);
  const initialCompletedTasksCount = useRef(-1);
  const initialLoadFinished = useRef(false);

  const [shouldOpenTaskModal, setShouldOpenTaskModal] = useState(false);

  // ── User State Intelligence (Growth) ─────────────────────────────────────────────
  const [userState, setUserState] = useState({
    stage: 'new',
    activation_score: 0,
    last_success_action: null,
    time_to_value_ms: null,
    days_since_active: 0,
    has_first_success: false,
  });

  // ── Product Intelligence & Retention (Fase 2.0) ──
  const [insights, setInsights] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  // ── Companion & Level Celebration State ─────────────────────────────────────
  const [growthPet, setGrowthPet] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('flowday_growth_pet') || 'plant';
    }
    return 'plant';
  });

  const handleSelectGrowthPet = useCallback((pet) => {
    setGrowthPet(pet);
    if (typeof window !== 'undefined') {
      localStorage.setItem('flowday_growth_pet', pet);
    }
  }, []);

  const [celebrationState, setCelebrationState] = useState({
    isOpen: false,
    companionType: 'plant',
    level: 1
  });

  const closeCelebration = useCallback(() => {
    setCelebrationState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const getLevelFromCount = useCallback((count) => {
    if (count >= 245) return 5;
    if (count >= 145) return 4;
    if (count >= 75) return 3;
    if (count >= 30) return 2;
    return 1;
  }, []);

  const triggerLevelUpCelebration = useCallback((companionType, newLevel) => {
    setCelebrationState({
      isOpen: true,
      companionType,
      level: newLevel
    });
    // Adiciona notificação do sistema imediatamente
    setNotifications(prev => [
      {
        id: 'lvl_up_' + Date.now(),
        type: 'achievement',
        title: 'Companheiro evoluiu! 🎉',
        description: `Parabéns! Sua consistência levou seu/sua ${companionType === 'plant' ? 'Plantinha' : 'Pet'} ao Nível ${newLevel}!`,
        read: false,
        created_at: new Date().toISOString()
      },
      ...prev
    ]);
  }, []);

  const incrementCompanionProgress = useCallback((userId) => {
    const petType = localStorage.getItem('flowday_growth_pet') || 'plant';
    const storageKey = `flowday_${petType}_completed_goals_${userId}`;
      
    const currentCount = Number(localStorage.getItem(storageKey)) || 0;
    const newCount = currentCount + 1;
    localStorage.setItem(storageKey, String(newCount));
    
    const levelBefore = getLevelFromCount(currentCount);
    const levelAfter = getLevelFromCount(newCount);
    if (levelAfter > levelBefore) {
      console.log(`[AppContext] Companheiro subiu de nível! ${petType}: Nível ${levelAfter}`);
      triggerLevelUpCelebration(petType, levelAfter);
    }
  }, [getLevelFromCount, triggerLevelUpCelebration]);

  // Inicializa progresso de evolução para Planta/Pet a partir das metas concluídas legadas
  useEffect(() => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;
    const totalCompleted = goals.filter(g => g.status === 'completed' && !g.deletedAt && !g.deleted_at).length;
    
    const legacyPetVal = localStorage.getItem(`flowday_pet_completed_goals_${userId}`);
    const defaultPetVal = legacyPetVal !== null ? legacyPetVal : String(totalCompleted);

    if (localStorage.getItem(`flowday_plant_completed_goals_${userId}`) === null) {
      localStorage.setItem(`flowday_plant_completed_goals_${userId}`, String(totalCompleted));
    }
    ['baby', 'dog', 'cat'].forEach(p => {
      if (localStorage.getItem(`flowday_${p}_completed_goals_${userId}`) === null) {
        localStorage.setItem(`flowday_${p}_completed_goals_${userId}`, defaultPetVal);
      }
    });
  }, [currentUser?.id, goals]);

  // Auto-conclusão de objetivos ao finalizar tarefas vinculadas
  useEffect(() => {
    if (!currentUser?.id) return;
    const activeTasks = tasks.filter(t => !t.deletedAt && !t.deleted_at);
    const activeGoals = goals.filter(g => g.status === 'active' && !g.deletedAt && !g.deleted_at);

    activeGoals.forEach(goal => {
      const linkedIds = goalTasks.filter(gt => gt.goal_id === goal.id).map(gt => gt.task_id);
      const linked = activeTasks.filter(t => linkedIds.includes(t.id));
      if (linked.length > 0 && linked.every(t => t.completed)) {
        console.log(`[AppContext] Auto-completing goal "${goal.title}" because all ${linked.length} linked tasks are complete.`);
        handleUpdateGoal(goal.id, { status: 'completed' });
      }
    });
  }, [tasks, goals, goalTasks, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) {
      setInsights([]);
      setSuggestions([]);
      return;
    }
    // 1. Recalcula insights comportamentais
    const activeTasks = tasks.filter(t => !t.deletedAt && !t.deleted_at);
    const newInsights = generateInsights(activeTasks);
    setInsights(newInsights);

    // 2. Recalcula sugestões de retenção baseadas no progresso
    const isObCompleted = !!currentUser?.user_metadata?.onboarding_completed;
    const newSuggestions = getEngagementSuggestions(userState, activeTasks, isObCompleted);
    setSuggestions(newSuggestions);
  }, [tasks, userState, currentUser?.id, currentUser?.user_metadata?.onboarding_completed]);

  // ── Feature Flags & Assinatura (SaaS) ───────────────────────────────────────
  const [isPro, setIsProState] = useState(false);
  const [isAccessChecked, setIsAccessChecked] = useState(false);

  const setIsPro = useCallback((valOrFn) => {
    setIsProState((prev) => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      return next;
    });
  }, []);

  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallSource, setPaywallSource] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('free'); // 'ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING'
  const [subscriptionPlan, setSubscriptionPlan] = useState('free'); // 'pro', 'free'
  const [subscriptionDetails, setSubscriptionDetails] = useState(null);
  const [churnScore, setChurnScore] = useState(0);
  const [churnRisk, setChurnRisk] = useState('low');

  // ── Modais de Reativação e Diálogos Customizados ───────────────────────
  const [showReactivationModal, setShowReactivationModal] = useState(false);
  const [pendingDeletionDate, setPendingDeletionDate] = useState(null);

  const [dialogConfig, setDialogConfig] = useState({
    isOpen: false,
    type: 'alert',
    title: 'MyFlowDay',
    message: '',
    confirmText: 'OK',
    cancelText: 'Cancelar',
    onConfirm: () => { },
    onCancel: () => { }
  });

  const openCustomAlert = useCallback((message, title = 'MyFlowDay') => {
    setDialogConfig({
      isOpen: true,
      type: 'alert',
      title,
      message,
      confirmText: 'OK',
      onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
    });
  }, []);

  const openCustomConfirm = useCallback((message, title = 'Atenção', onConfirmCallback, confirmText = 'Confirmar', cancelText = 'Cancelar') => {
    setDialogConfig({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        if (onConfirmCallback) onConfirmCallback();
      },
      onCancel: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
    });
  }, []);

  useEffect(() => {
    window.alert = (msg) => {
      openCustomAlert(String(msg), '');
    };
  }, [openCustomAlert]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const handleLoginSuccess = useCallback((user) => {
    setCurrentUser(user);
    eventsService.logEvent(user.id, 'login', { method: 'explicit' }).catch(() => { });
    setActiveTab('home');
  }, []);

  const handleLogout = useCallback(async (skipReload = false) => {
    try {
      localStorage.removeItem('flowday_demo_active'); // Limpa a flag de modo demo ativo
      if (currentUser?.id) {
        if (!currentUser.isDemo) {
          await eventsService.logEvent(currentUser.id, 'logout').catch(() => { });
        }
      }
      if (!currentUser?.isDemo) {
        await supabase.auth.signOut().catch(() => { });
      }

      if (currentUser?.isDemo) {
        localStorage.removeItem(`flowday_demo_tasks_${currentUser.id}`);
        localStorage.removeItem(`flowday_demo_goals_${currentUser.id}`);
        localStorage.removeItem(`flowday_demo_habits_${currentUser.id}`);
        localStorage.removeItem(`flowday_demo_achievements_${currentUser.id}`);
      }

      // Limpa caches locais no IndexedDB para isolamento multiusuário
      await localDB.clear('tasks').catch(() => { });
      await localDB.clear('goals').catch(() => { });
      await localDB.clear('habits').catch(() => { });
      await localDB.clear('profile').catch(() => { });
      await localDB.clear('events').catch(() => { });
      await localDB.clear('notifications').catch(() => { });

      setCurrentUser(null);
      setUserProfile(null);

      if (!skipReload) {
        window.location.href = '/';
      }
    } catch (e) {
      console.error(e);
      if (!skipReload) {
        window.location.href = '/';
      }
    }
  }, [currentUser, setCurrentUser, setUserProfile]);

  // Determina se usuário logado é administrador
  const isAdmin = useMemo(() => checkIsAdmin(currentUser), [currentUser]);

  const loadSubscription = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        const status = (data.status || 'free').toLowerCase();
        const plan = (data.plan || 'free').toLowerCase();
        const expiresAt = data.expires_at || data.current_period_end;

        const active = (status === 'active') &&
          (plan === 'pro' || plan === 'premium') &&
          (!expiresAt || new Date(expiresAt) > new Date());

        // Previne sobrescrever para falso se o checkServerAccess (SSOT) determinou true
        setIsPro(prev => prev === true ? true : active);
        setSubscriptionStatus(prev => {
          if (prev === 'ACTIVE') return 'ACTIVE';
          return (active ? 'active' : status).toUpperCase();
        });
        setSubscriptionPlan(prev => {
          if (prev === 'premium' || prev === 'pro') return prev;
          return plan;
        });
      }
    } catch (e) {
      console.warn('[AppContext] Erro ao carregar subscriptions:', e.message);
    }
  }, [setIsPro]);

  // ── Categorias Customizadas (SaaS) ──────────────────────────────────────────
  const categories = useMemo(() => {
    const custom = currentUser?.user_metadata?.custom_categories || [];
    return [...defaultCategories, ...custom];
  }, [currentUser]);

  // ── Validação Supabase ──────────────────────────────────────────────────────
  const supabaseConfigError = typeof window !== 'undefined' && !!window.supabaseConfigError;

  // ── Subscrição ao syncQueue ───────────────────────────────────────────────────
  useEffect(() => {
    // Inicialização assíncrona do IndexedDB da fila e do batcher
    initSyncQueue().catch(err => console.error('[AppContext] Erro initSyncQueue:', err));
    initEventBatcher().catch(err => console.error('[AppContext] Erro initEventBatcher:', err));

    const unsub = subscribeSync((state) => {
      setSyncStatus(state.supabase || state.syncStatus || 'healthy');
      setSyncWarnings(state.warnings || []);
    });
    return unsub;
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMA — aplicação e persistência
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const applyTheme = (t) => {
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (t === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', prefersDark);
      }
    };
    applyTheme(theme);
    localStorage.setItem('theme', theme);

    // Aplicar a cor de fundo customizada
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.style.setProperty('--bg-app', '#0F172A');
    } else {
      document.documentElement.style.setProperty('--bg-app', appBgColor);
    }
    localStorage.setItem('app_bg_color', appBgColor);
  }, [theme, appBgColor]);

  // Sincronização de tema entre abas
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'theme' && e.newValue && e.newValue !== theme) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [theme]);

  // Sincronização de unlockedKeysRef com o estado unlockedKeys
  useEffect(() => {
    if (unlockedKeys) {
      unlockedKeysRef.current = new Set(unlockedKeys);
    } else {
      unlockedKeysRef.current = new Set();
    }
  }, [unlockedKeys]);

  // ── Re-hidratação de Estado por Event Sourcing (Fase 3.0) ──
  const rehydrateUserState = useCallback(async (userId) => {
    if (!userId) return null;
    try {
      const evs = await eventStore.getEventsForUser(userId);
      const projected = stateEngine.computeUserState(evs);
      setUserState(projected);

      // Atualiza o estado de sessões de foco a partir do log de eventos
      const fe = evs.filter(e => e.event_type === 'focus_session_completed');
      setFocusEvents(fe);

      return projected;
    } catch (err) {
      console.warn('[AppContext] Erro ao re-hidratar estado:', err.message);
      return null;
    }
  }, []);

  // ── Notificações Helpers ──
  const loadNotifications = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const localNotifs = await localDB.getAll('notifications');
      const userNotifs = localNotifs.filter(n => n.user_id === userId);
      setNotifications(userNotifs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (err) {
      console.warn('[AppContext] Erro ao carregar notificações:', err.message);
    }
  }, []);

  const addNotification = useCallback(async (type, title, description, metadata = {}) => {
    if (!currentUser?.id) return;

    const notifId = metadata?.notification_id || generateId();

    setNotifications(prev => {
      // Evita duplicações por ID idêntico ou por conteúdo recente idêntico (5 segundos)
      const isDuplicate = prev.some(n =>
        n.id === notifId ||
        (n.title === title && n.description === description && Math.abs(new Date(n.timestamp) - new Date()) < 5000)
      );
      if (isDuplicate) return prev;

      const newNotif = {
        id: notifId,
        user_id: currentUser.id,
        type,
        title,
        description,
        timestamp: new Date().toISOString(),
        read: false,
        metadata
      };

      // Gravação assíncrona no IndexedDB local
      localDB.put('notifications', newNotif).catch(err => {
        console.warn('[AppContext] Erro ao salvar notificação local no IndexedDB:', err.message);
      });

      // Feedback sonoro sintetizado e vibração tátil (Android fallback)
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // Ré5
          oscillator.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12); // Lá5

          gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

          oscillator.start(audioCtx.currentTime);
          oscillator.stop(audioCtx.currentTime + 0.4);
        }
      } catch (audioErr) {
        console.warn('[AppContext] Falha ao tocar som sintetizado de notificação:', audioErr);
      }

      return [newNotif, ...prev];
    });
  }, [currentUser?.id]);

  const markNotificationsAsRead = useCallback(async () => {
    if (!currentUser?.id) return;
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    try {
      for (const n of updated) {
        await localDB.put('notifications', n);
      }
    } catch (err) {
      console.warn('[AppContext] Erro ao marcar notificações como lidas:', err.message);
    }
  }, [currentUser?.id, notifications]);

  const clearNotifications = useCallback(async () => {
    if (!currentUser?.id) return;
    setNotifications([]);
    try {
      const all = await localDB.getAll('notifications');
      const userNotifs = all.filter(n => n.user_id === currentUser.id);
      for (const n of userNotifs) {
        await localDB.delete('notifications', n.id);
      }
    } catch (err) {
      console.warn('[AppContext] Erro ao limpar notificações:', err.message);
    }
  }, [currentUser?.id]);

  // ── Modo Demo Helpers ──
  const initDemoData = () => {
    const demoTasksKey = `flowday_demo_tasks_${currentUser.id}`;
    const demoGoalsKey = `flowday_demo_goals_${currentUser.id}`;
    const demoHabitsKey = `flowday_demo_habits_${currentUser.id}`;
    const demoAchievementsKey = `flowday_demo_achievements_${currentUser.id}`;

    let localTasks = localStorage.getItem(demoTasksKey);
    let localGoals = localStorage.getItem(demoGoalsKey);
    let localHabits = localStorage.getItem(demoHabitsKey);
    let localAchievements = localStorage.getItem(demoAchievementsKey);

    const now = new Date();
    if (localTasks) {
      setTasks(JSON.parse(localTasks));
    } else {
      const mockTasks = [
        { id: 'dt1', user_id: currentUser.id, title: 'Revisar hooks avançados do React', description: 'Focar em useMemo e useCallback', category: 'Estudos', priority: 'Alta', dueDate: now.toISOString().split('T')[0], completed: false, createdAt: now.toISOString(), completedAt: null, deletedAt: null },
        { id: 'dt2', user_id: currentUser.id, title: 'Correr 5km no parque', description: 'Treinar endurance e ritmo constante', category: 'Lazer', priority: 'Alta', dueDate: now.toISOString().split('T')[0], completed: false, createdAt: now.toISOString(), deletedAt: null },
        { id: 'dt3', user_id: currentUser.id, title: 'Refatorar design system do Flowday', description: 'Ajustar variáveis de cores e glassmorphism', category: 'Trabalho', priority: 'Alta', dueDate: now.toISOString().split('T')[0], completed: false, createdAt: now.toISOString(), deletedAt: null },
        { id: 'dt4', user_id: currentUser.id, title: 'Comprar tênis de corrida com amortecimento', description: 'Focar em proteção de articulações', category: 'Pessoal', priority: 'Média', dueDate: '', completed: false, createdAt: now.toISOString(), completedAt: null, deletedAt: null },
        { id: 'dt5', user_id: currentUser.id, title: 'Ler 20 páginas do livro atual', description: 'Hábito de leitura offline diária', category: 'Pessoal', priority: 'Baixa', dueDate: now.toISOString().split('T')[0], completed: false, createdAt: now.toISOString(), completedAt: null, deletedAt: null },
        { id: 'dt6', user_id: currentUser.id, title: 'Aprender sobre App Router do Next.js', description: 'Estudar layouts e subrotas dinâmicas', category: 'Estudos', priority: 'Média', dueDate: '', completed: false, createdAt: now.toISOString(), deletedAt: null },
        { id: 'dt7', user_id: currentUser.id, title: 'Preparar marmitas saudáveis', description: 'Alimentação equilibrada para a semana', category: 'Pessoal', priority: 'Média', dueDate: '', completed: false, createdAt: now.toISOString(), deletedAt: null }
      ];
      setTasks(mockTasks);
      localStorage.setItem(demoTasksKey, JSON.stringify(mockTasks));
    }

    if (localGoals) {
      const parsed = JSON.parse(localGoals);
      setGoals(parsed.goals || []);
      setGoalTasks(parsed.goalTasks || []);
    } else {
      const mockGoals = [
        { id: 'dg1', user_id: currentUser.id, title: 'Dominar o React', description: 'Ficar proficiente em React, hooks e Next.js', color: '#6366f1', icon: 'target', target_date: '', status: 'active', deletedAt: null },
        { id: 'dg2', user_id: currentUser.id, title: 'Corrida 10K', description: 'Treinar para correr 10km direto sem paradas', color: '#10b981', icon: 'target', target_date: '', status: 'active', deletedAt: null },
        { id: 'dg3', user_id: currentUser.id, title: 'Hábito de Leitura', description: 'Ler pelo menos 1 livro por mês este ano', color: '#f59e0b', icon: 'book', target_date: '', status: 'active', deletedAt: null }
      ];
      const mockGoalTasks = [
        { goal_id: 'dg1', task_id: 'dt1' },
        { goal_id: 'dg1', task_id: 'dt6' },
        { goal_id: 'dg2', task_id: 'dt2' },
        { goal_id: 'dg2', task_id: 'dt4' },
        { goal_id: 'dg3', task_id: 'dt5' }
      ];
      setGoals(mockGoals);
      setGoalTasks(mockGoalTasks);
      localStorage.setItem(demoGoalsKey, JSON.stringify({ goals: mockGoals, goalTasks: mockGoalTasks }));
    }

    if (localHabits) {
      const parsed = JSON.parse(localHabits);
      setHabits(parsed.habits || []);
      setHabitLogs(parsed.habitLogs || []);
    } else {
      const mockHabits = [
        { id: 'dh1', user_id: currentUser.id, title: 'Meditar 10 min', description: 'Foco na respiração mindfulness', frequency: 'diaria', created_at: new Date().toISOString() },
        { id: 'dh2', user_id: currentUser.id, title: 'Beber 2L de água', description: 'Garrafa na mesa sempre cheia', frequency: 'diaria', created_at: new Date().toISOString() }
      ];
      const mockLogs = [];
      const today = now.toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      mockLogs.push({ id: 'dl1', habit_id: 'dh2', completed_date: today, user_id: currentUser.id });
      mockLogs.push({ id: 'dl2', habit_id: 'dh1', completed_date: yesterdayStr, user_id: currentUser.id });
      mockLogs.push({ id: 'dl3', habit_id: 'dh2', completed_date: yesterdayStr, user_id: currentUser.id });

      setHabits(mockHabits);
      setHabitLogs(mockLogs);
      localStorage.setItem(demoHabitsKey, JSON.stringify({ habits: mockHabits, habitLogs: mockLogs }));
    }

    if (localAchievements) {
      const parsed = JSON.parse(localAchievements);
      setUnlockedAchievements(parsed);
      const keys = new Set(parsed.map(a => a.achievement_key));
      setUnlockedKeys(keys);
      if (unlockedKeysRef) unlockedKeysRef.current = keys;
    } else {
      const mockAchievements = [
        { achievement_key: 'first_task', unlocked_at: now.toISOString(), seen: true, dismissed_at: null }
      ];
      setUnlockedAchievements(mockAchievements);
      const keys = new Set(['first_task']);
      setUnlockedKeys(keys);
      if (unlockedKeysRef) unlockedKeysRef.current = keys;
      localStorage.setItem(demoAchievementsKey, JSON.stringify(mockAchievements));
    }

    setIsPro(true);
    setSubscriptionStatus('active');
    setSubscriptionPlan('pro');
    // isInitializing is derived from authMachine.isLoading — no setter needed.
    // The machine transitions to AUTHENTICATED when setCurrentUser dispatches SIGNED_IN.

    // Notificação de boas vindas
    setTimeout(() => {
      addNotification('system', 'Modo Demo Ativo', 'Você está experimentando o Flowday com uma conta temporária. Fique à vontade para explorar!');
    }, 1000);
  };

  const handleStartDemoMode = () => {
    const demoUser = {
      id: 'demo-user',
      email: 'demo@flowday.app',
      name: 'Explorador Demo',
      isDemo: true,
      user_metadata: { name: 'Explorador Demo', onboarding_completed: true }
    };
    localStorage.setItem('flowday_demo_active', 'true'); // Persistir modo demo ativo no recarregamento
    setCurrentUser(demoUser);
    logEvent('demo_started');
    setActiveTab('home');
  };

  // ── Purga automática de lixeira 30 dias ──
  const purgeTrash = useCallback(async (userId) => {
    if (!userId || currentUser?.isDemo) return;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const allTasks = await localDB.getAll('tasks');
      const oldTasks = allTasks.filter(t => t.user_id === userId && t.deletedAt && new Date(t.deletedAt) < thirtyDaysAgo);
      for (const t of oldTasks) {
        await tasksService.deletePermanent(userId, t.id);
      }

      // Purga de goals via banco — defensivo para quando deleted_at não existir
      try {
        const { data: oldGoals, error: goalsErr } = await supabase
          .from('goals')
          .select('id')
          .eq('user_id', userId)
          .not('deleted_at', 'is', null)
          .lt('deleted_at', thirtyDaysAgo.toISOString());

        if (goalsErr && (goalsErr.code === '42703' || goalsErr.message?.includes('deleted_at'))) {
          // deleted_at column doesn't exist yet — purge only from local cache
          console.warn('[AppContext] Coluna goals.deleted_at ausente — purgando apenas cache local.');
          const localGoals = await localDB.getAll('goals');
          const oldLocalGoals = localGoals.filter(g => g.user_id === userId && g.deletedAt && new Date(g.deletedAt) < thirtyDaysAgo);
          for (const g of oldLocalGoals) {
            await goalsService.deletePermanent(userId, g.id);
          }
        } else if (oldGoals && oldGoals.length > 0) {
          for (const g of oldGoals) {
            await goalsService.deletePermanent(userId, g.id);
          }
        }
      } catch (goalsErr) {
        console.warn('[AppContext] Erro ao purgar goals da lixeira:', goalsErr.message);
      }
    } catch (err) {
      console.warn('[AppContext] Erro ao purgar lixeira:', err.message);
    }
  }, [currentUser?.isDemo]);

  // LOGGER DE EVENTOS com session tracking
  // ═══════════════════════════════════════════════════════════════════════════
  const logEvent = useCallback(async (eventType, metadata = {}) => {
    if (!currentUser?.id) return;
    try {
      // 1. Salva localmente via Event Sourcing (e emite no barramento síncrono)
      await eventStore.saveEvent(currentUser.id, eventType, metadata);

      // 2. Envia ao batcher para sincronização eventual
      await eventsService.logEvent(currentUser.id, eventType, metadata);

      // 3. Atualiza estado projetado do usuário a partir dos eventos
      await rehydrateUserState(currentUser.id);
    } catch (e) {
      console.warn('[AppContext.logEvent] Falha ao rastrear:', e.message);
    }
  }, [currentUser?.id, rehydrateUserState]);

  // Session tracking: emite session_started no login e session_ended no unload
  useEffect(() => {
    if (!currentUser?.id) return;

    logEvent('session_started', {
      ts: new Date().toISOString()
    });

    const handleUnload = () => {
      logEvent('session_ended', {
        ts: new Date().toISOString()
      });
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [currentUser?.id, logEvent]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE DE CONSISTÊNCIA (Bloco 5)
  // ═══════════════════════════════════════════════════════════════════════════
  const consistencyScore = useMemo(() => {
    if (!currentUser) return 0;

    const activeTasks = tasks.filter(t => !t.deletedAt && !t.deleted_at);
    const activeGoals = goals.filter(g => !g.deletedAt && !g.deleted_at);

    // Se a conta está limpa (sem dados base), score é absoluto 0.
    if (activeTasks.length === 0 && habits.length === 0 && activeGoals.length === 0) {
      return 0;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Taxa de conclusão de tarefas nos últimos 7 dias (40% de peso)
    const recentTasks = activeTasks.filter(t => {
      const date = t.dueDate || t.createdAt?.split('T')[0];
      return date && new Date(date) >= sevenDaysAgo;
    });
    const taskCount = recentTasks.length;
    const completedTaskCount = recentTasks.filter(t => t.completed).length;
    const taskRate = taskCount > 0 ? (completedTaskCount / taskCount) : 0;

    // 2. Taxa de conclusão de hábitos nos últimos 7 dias (40% de peso)
    const activeHabitIds = habits.map(h => h.id);
    const recentLogs = habitLogs.filter(l => activeHabitIds.includes(l.habit_id) && new Date(l.completed_date) >= sevenDaysAgo);
    
    let totalPossibleLogs = 0;
    const todayVal = new Date();
    todayVal.setHours(0, 0, 0, 0);
    habits.forEach(h => {
      const createdDate = h.created_at ? new Date(h.created_at.split('T')[0]) : new Date(todayVal);
      createdDate.setHours(0, 0, 0, 0);
      const diffTime = Math.max(0, todayVal - createdDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const habitDaysCount = Math.min(7, diffDays + 1);
      totalPossibleLogs += habitDaysCount;
    });
    
    const habitRate = totalPossibleLogs > 0 ? (recentLogs.length / totalPossibleLogs) : 0;

    // 3. Progresso dos objetivos ativos (20% de peso)
    const activeGoalsFiltered = activeGoals.filter(g => g.status === 'active');
    let totalPct = 0;
    activeGoalsFiltered.forEach(goal => {
      const linkedIds = goalTasks.filter(gt => gt.goal_id === goal.id).map(gt => gt.task_id);
      const linked = activeTasks.filter(t => linkedIds.includes(t.id));
      const done = linked.filter(t => t.completed).length;
      const pct = linked.length > 0 ? (done / linked.length) : 0;
      totalPct += pct;
    });
    const goalRate = activeGoalsFiltered.length > 0 ? (totalPct / activeGoalsFiltered.length) : 0;

    const finalScore = Math.min(100, Math.round(
      (taskRate * 40) +
      (habitRate * 40) +
      (goalRate * 20)
    ));
    return isNaN(finalScore) ? 0 : finalScore;
  }, [tasks, habits, habitLogs, goals, goalTasks, currentUser]);

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADERS
  // ═══════════════════════════════════════════════════════════════════════════
  const loadTasks = useCallback(async (userId) => {
    const { data } = await tasksService.getAll(userId);
    if (data) setTasks(data);
  }, []);

  const loadGoals = useCallback(async (userId) => {
    const { data } = await goalsService.getAll(userId);
    if (data) {
      setGoals(data.goals);
      setGoalTasks(data.goalTasks);
    }
  }, []);

  const loadAchievements = useCallback(async (userId) => {
    const { data } = await achievementsService.getAll(userId);
    const list = data || [];
    setUnlockedAchievements(list);
    const keys = new Set(list.map((a) => a.achievement_key));
    setUnlockedKeys(keys);
    if (unlockedKeysRef) unlockedKeysRef.current = keys;
  }, []);

  const loadHabits = useCallback(async (userId) => {
    setHabitsLoading(true);
    try {
      const { data } = await habitsService.getAll(userId);
      if (data) {
        setHabits(data.habits);
        setHabitLogs(data.habitLogs);
      }
    } finally {
      setHabitsLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async (userId, email = '') => {
    const { data } = await profilesService.getProfile(userId, email);
    let profileData = data || { id: userId, avatar_url: '' };

    const localAvatar = localStorage.getItem(`flowday_user_avatar_${userId}`);
    if (localAvatar && (!profileData.avatar_url || profileData.avatar_url === '')) {
      profileData.avatar_url = localAvatar;
    }

    setUserProfile(profileData);

    // Sync name with currentUser metadata to avoid generic name in auth machine
    if (profileData && profileData.nickname && !['user', 'usuario', 'null', 'undefined', ''].includes(profileData.nickname.toLowerCase().trim())) {
      setCurrentUser(prev => {
        if (!prev) return prev;
        if (prev.user_metadata?.name === profileData.nickname) return prev;
        return {
          ...prev,
          user_metadata: {
            ...prev.user_metadata,
            name: profileData.nickname
          }
        };
      });
    }
  }, [setCurrentUser]);

  // ── Health Check SILENCIOSO (não-bloqueante) ──────────────────────────────────
  // Diagnostica o Supabase mas NUNCA impede o app de carregar.
  // Apenas popula syncWarnings para observabilidade.
  const runSilentHealthCheck = useCallback(async (userId) => {
    const issues = [];
    try {
      const { error: profilesErr } = await supabase.from('profiles').select('id').limit(0);
      if (profilesErr && profilesErr.message?.includes('Could not find the table')) {
        issues.push('Tabela profiles ausente no Supabase (usando fallback local)');
      }

      const { error: eventsErr } = await supabase.from('events').select('id').limit(0);
      if (eventsErr && eventsErr.message?.includes('Could not find the table')) {
        issues.push('Tabela events ausente (eventos serão enfileirados localmente)');
      }

      const { error: tasksErr } = await supabase.from('tasks').select('completed_at').limit(0);
      if (tasksErr && tasksErr.message?.includes('completed_at')) {
        issues.push('Coluna completed_at ausente em tasks');
      }
    } catch (err) {
      issues.push(`Supabase inacessível: ${err.message}`);
    }

    if (issues.length > 0) {
      issues.forEach(w => console.warn('[SilentHealthCheck]', w));
      // O syncQueue já vai atualizar o syncStatus via subscribe
    }
    // Nunca bloqueia — sempre retorna true
    return true;
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH — gerenciado pela Auth State Machine (useAuthMachine)
  // Toda lógica de auth (getSession, onAuthStateChange, fallback, PKCE) vive
  // no hook. O AppContext é apenas um consumidor — não há lógica de auth aqui.
  // ═══════════════════════════════════════════════════════════════════════════
  // (auth state já inicializado no topo do provider via useAuthMachine)

  const checkServerAccess = useCallback(async (userId) => {
    if (!userId) {
      setIsPro(false);
      setSubscriptionStatus('FREE');
      setSubscriptionPlan('free');
      setSubscriptionDetails(null);
      setChurnScore(0);
      setChurnRisk('low');
      return false;
    }
    try {
      const response = await fetch(`/api/access/check?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        const active = !!data.canAccessPro;

        // Só atualiza se realmente mudar, prevenindo loops de re-render
        setIsPro(prev => prev !== active ? active : prev);
        setSubscriptionStatus(prev => prev !== (data.status || 'free').toUpperCase() ? (data.status || 'free').toUpperCase() : prev);
        setSubscriptionPlan(prev => prev !== (data.plan || 'free') ? (data.plan || 'free') : prev);

        if (data.subscriptionDetails) {
          setSubscriptionDetails(data.subscriptionDetails);
        } else {
          setSubscriptionDetails(null);
        }

        if (data.churn) {
          setChurnScore(prev => prev !== data.churn.score ? data.churn.score : prev);
          setChurnRisk(prev => prev !== data.churn.risk ? data.churn.risk : prev);
        }

        return active;
      }
    } catch (err) {
      console.warn('[AppContext] Erro ao verificar acesso no servidor:', err.message);
    }
    return false;
  }, [setIsPro]);

  // 2. Efeito central de carga de dados baseado em currentUser?.id
  useEffect(() => {
    if (!currentUser?.id) {
      setIsAmbientPlaying(false);
      initialLoadFinished.current = false;
      setUserProfile(null);
      setTasks([]);
      setGoals([]);
      setGoalTasks([]);
      setUnlockedAchievements(null);
      setUnlockedKeys(null);
      setHabits([]);
      setHabitLogs([]);
      setNotifications([]);
      setIsPro(false);
      setSubscriptionStatus('free');
      setSubscriptionPlan('free');
      setSubscriptionDetails(null);
      setIsAccessChecked(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('flowday_access_checked');
        localStorage.removeItem('flowday_is_pro');
      }
      return;
    }

    const userId = currentUser.id;
    initialLoadFinished.current = false;
    setIsAccessChecked(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('flowday_access_checked');
    }

    // Tratamento para Modo Demo
    if (currentUser.isDemo) {
      initDemoData();
      loadNotifications(userId);
      initialLoadFinished.current = true;
      setIsAccessChecked(true);
      if (typeof window !== 'undefined') localStorage.setItem('flowday_access_checked', 'true');
      return;
    }

    let active = true;

    const loadAll = async () => {
      try {
        await Promise.all([
          loadTasks(userId),
          loadGoals(userId),
          loadAchievements(userId),
          loadHabits(userId),
          loadProfile(userId, currentUser?.email),
          loadSubscription(userId),
          loadNotifications(userId),
          rehydrateUserState(userId),
          purgeTrash(userId),
          checkServerAccess(userId), // Validação Zero-Trust na carga inicial
        ]);
      } catch (err) {
        console.error('[AppContext] Erro ao carregar dados do usuário:', err);
      } finally {
        if (active) {
          initialLoadFinished.current = true;
          setIsAccessChecked(true);
          if (typeof window !== 'undefined') localStorage.setItem('flowday_access_checked', 'true');
        }
      }
    };

    loadAll();

    return () => {
      active = false;
    };
  }, [currentUser?.id, loadTasks, loadGoals, loadAchievements, loadHabits, loadProfile, loadSubscription, loadNotifications, rehydrateUserState, purgeTrash, checkServerAccess, setIsPro]);

  // A validação de acesso PRO é feita exclusivamente via checkServerAccess()
  // no carregamento e por realtime hooks ao detectar mudanças na tabela profiles.

  // ── Checagem de Período de Exclusão de Conta (Reativação de 0-30 dias) ──
  useEffect(() => {
    if (!currentUser?.id || currentUser.isDemo) return;

    const isDeleted = currentUser?.user_metadata?.account_status === 'deleted' || userProfile?.account_status === 'deleted';
    const deletedAt = currentUser?.user_metadata?.deleted_at || userProfile?.deleted_at;

    if (isDeleted && deletedAt) {
      const deletedDateObj = new Date(deletedAt);
      const now = new Date();
      const diffDays = (now.getTime() - deletedDateObj.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays > 30) {
        openCustomAlert('Sua conta foi excluída permanentemente após o período de recuperação de 30 dias.', 'Conta Excluída');
        handleLogout();
      } else {
        setPendingDeletionDate(deletedAt);
        setShowReactivationModal(true);
      }
    } else {
      setShowReactivationModal(false);
    }
  }, [currentUser, userProfile, handleLogout, openCustomAlert]);

  const handleReactivateAccount = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const { error: metaErr } = await supabase.auth.updateUser({
        data: {
          account_status: 'active',
          deleted_at: null
        }
      });
      if (metaErr) throw metaErr;

      await supabase.from('profiles').update({
        account_status: 'active',
        deleted_at: null
      }).eq('id', currentUser.id);

      if (userProfile) {
        setUserProfile(prev => ({ ...prev, account_status: 'active', deleted_at: null }));
      }
      setShowReactivationModal(false);
      logEvent('account_reactivated', { userId: currentUser.id });
      addNotification('system', 'Conta Reativada', 'Sua conta foi reativada com sucesso! Todos os seus dados continuam intactos.');
    } catch (err) {
      console.error('Erro ao reativar conta:', err);
    }
  }, [currentUser?.id, userProfile, logEvent, addNotification]);

  const handleConfirmDeletion = useCallback(() => {
    logEvent('account_deletion_confirmed', { userId: currentUser?.id });
    setShowReactivationModal(false);
    handleLogout();
  }, [currentUser?.id, logEvent, handleLogout]);

  // ── Escuta em tempo real (Supabase Realtime) para atualizações de faturamento no Perfil ──
  useEffect(() => {
    if (!currentUser?.id || currentUser.isDemo) return;

    console.log(`[Realtime] Iniciando canal de escuta para perfil do usuário ${currentUser.id}`);
    const channel = supabase
      .channel(`profile-realtime-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`
        },
        (payload) => {
          console.log('[Realtime] Perfil do usuário atualizado remotamente:', payload.new);

          setUserProfile(prevProfile => {
            if (!prevProfile) return payload.new;

            // Só atualiza o estado do perfil se houver mudanças estruturais ou de cobrança
            const planoChanged = prevProfile.plano !== payload.new.plano;
            const statusChanged = prevProfile.assinatura_status !== payload.new.assinatura_status;
            const expiraChanged = prevProfile.assinatura_expira_em !== payload.new.assinatura_expira_em;
            const infoChanged = prevProfile.name !== payload.new.name ||
              prevProfile.nickname !== payload.new.nickname ||
              prevProfile.avatar_url !== payload.new.avatar_url ||
              prevProfile.bio !== payload.new.bio ||
              prevProfile.profession !== payload.new.profession;

            if (planoChanged || statusChanged || expiraChanged || infoChanged) {
              return payload.new;
            }

            return prevProfile; // Previne re-render se o registro for idêntico
          });

          // Revalida a assinatura com o servidor para obter a decisão final oficial (Zero Trust!)
          checkServerAccess(currentUser.id);
        }
      )
      .subscribe();

    return () => {
      console.log(`[Realtime] Removendo canal de escuta para perfil do usuário ${currentUser.id}`);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUser?.isDemo, checkServerAccess]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONQUISTAS — detecção automática (PROTEGIDA contra false positives)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const checkAchievements = async () => {
      if (!currentUser?.id || achievementChecking.current || unlockedKeys === null || !initialLoadFinished.current) return;

      // GUARD CRÍTICO: Só verifica conquistas após os dados terem sido carregados ao menos uma vez.
      // Isso evita o popup falso que acontecia quando tasks=[] e goals=[] logo após o login.
      if (!dataLoadedOnce.current) {
        dataLoadedOnce.current = true;
        initialGoalsCount.current = goals.length;
        initialCompletedTasksCount.current = tasks.filter(t => t.completed).length;
        // Na primeira carga, só prossegue se existem dados reais — se não, aborta silenciosamente.
        if (tasks.length === 0 && goals.length === 0) return;
      }

      achievementChecking.current = true;
      try {
        const activeTasksForStats = tasks.filter(t => !t.deletedAt && !t.deleted_at);
        const activeGoalsForStats = goals.filter(g => !g.deletedAt && !g.deleted_at);
        const stats = calcStats(activeTasksForStats, activeGoalsForStats, habits, habitLogs);

        // Bloqueia/deleta conquistas cujos requisitos deixaram de ser atendidos (após exclusão)
        const keysToLock = [];
        for (const key of Array.from(unlockedKeys || [])) {
          const ach = ACHIEVEMENTS.find(a => a.key === key);
          if (ach && !ach.check(stats)) {
            // Guard: Não revoga conquista inicial se o usuário de fato já concluiu algo antes
            if (ach.key === 'first_task' && stats.completedTasks >= 1) continue;
            keysToLock.push(key);
          }
        }

        if (keysToLock.length > 0) {
          console.log('[AppContext] Bloqueando conquistas revogadas devido a exclusão:', keysToLock);
          if (currentUser.isDemo) {
            const demoAchievementsKey = `flowday_demo_achievements_${currentUser.id}`;
            const localAchievements = JSON.parse(localStorage.getItem(demoAchievementsKey) || '[]');
            const nextLocal = localAchievements.filter(la => !keysToLock.includes(la.achievement_key));
            localStorage.setItem(demoAchievementsKey, JSON.stringify(nextLocal));
          } else {
            await achievementsService.lock(currentUser.id, keysToLock);
          }

          setUnlockedKeys(prev => {
            const n = new Set(prev);
            keysToLock.forEach(k => {
              n.delete(k);
              if (unlockedKeysRef.current) unlockedKeysRef.current.delete(k);
            });
            return n;
          });

          setUnlockedAchievements(prev => (prev || []).filter(item => !keysToLock.includes(item.achievement_key)));
        }

        // GUARD SECUNDÁRIO: conquistas que exigem ação real do usuário
        // só disparam se há evidência real de interação (não apenas dados carregados).
        const newlyUnlocked = ACHIEVEMENTS.filter((a) => {
          if (unlockedKeys.has(a.key) || unlockedKeysRef.current.has(a.key)) return false;
          // Conquistas baseadas em tarefas concluídas: só disparam se há completedTasks > 0
          if (['first_task', 'tasks_10', 'tasks_50', 'tasks_100'].includes(a.key)) {
            if (a.key === 'first_task' && initialCompletedTasksCount.current >= 1) return false;
            if (stats.completedTasks === 0) return false;
          }
          // Conquista de primeiro objetivo: só dispara se foi criado na sessão atual
          if (a.key === 'first_goal') {
            if (initialGoalsCount.current >= 1) return false;
            if (stats.totalGoals === 0) return false;
          }
          // Conquistas baseadas em streak: só disparam se streak > 0 (ou seja, há atividade real)
          if (['streak_3', 'streak_7', 'streak_30'].includes(a.key)) {
            if (stats.currentStreak === 0) return false;
          }
          // Conquistas baseadas em objetivos concluídos
          if (['first_goal_completed', 'goals_10'].includes(a.key)) {
            if (stats.completedGoals === 0) return false;
          }
          // Conquistas baseadas em hábitos
          if (a.key === 'perfect_habits') {
            if (!stats.habits100PercentToday) return false;
          }
          return a.check(stats);
        });

        if (currentUser.isDemo) {
          newlyUnlocked.forEach((a) => {
            unlockedKeysRef.current.add(a.key);
            setUnlockedKeys((prev) => { const n = new Set(prev); n.add(a.key); return n; });
            setUnlockedAchievements((prev) => [
              ...(prev || []),
              {
                achievement_key: a.key,
                unlocked_at: new Date().toISOString(),
                seen: true,
                viewed_at: new Date().toISOString(),
                dismissed_at: null
              },
            ]);
            const id = `${a.key}-${Date.now()}`;
            setToastQueue((prev) => [...prev, { id, achievement: a }]);
            addNotification('achievement', `Nova conquista: ${a.title}`, a.desc, { tab: 'evolution' });

            // Salva no localStorage para o demo
            const demoAchievementsKey = `flowday_demo_achievements_${currentUser.id}`;
            const localAchievements = JSON.parse(localStorage.getItem(demoAchievementsKey) || '[]');
            localAchievements.push({
              achievement_key: a.key,
              unlocked_at: new Date().toISOString(),
              seen: true,
              viewed_at: new Date().toISOString(),
              dismissed_at: null
            });
            localStorage.setItem(demoAchievementsKey, JSON.stringify(localAchievements));
          });
          return;
        }

        // Lock síncrono imediato no ref para evitar unlocks concorrentes durante a chamada de rede abaixo
        newlyUnlocked.forEach((a) => unlockedKeysRef.current.add(a.key));

        try {
          const { error } = await achievementsService.unlock(
            currentUser.id,
            newlyUnlocked.map((a) => a.key)
          );
          if (error) {
            console.warn('[AppContext] Falha ao sincronizar conquistas com o Supabase, continuando fluxo local:', error);
          }
        } catch (err) {
          console.warn('[AppContext] Erro ao invocar achievementsService.unlock, prosseguindo localmente:', err);
        }

        newlyUnlocked.forEach((a) => {
          // Guard: se já foi dispensada anteriormente (localStorage ou banco), não re-exibe
          const dismissedLocalKey = `myflowday_dismissed_achievements_${currentUser.id}`;
          let dismissedLocal = {};
          try {
            const val = localStorage.getItem(dismissedLocalKey);
            if (val) dismissedLocal = JSON.parse(val);
          } catch (_) { }

          if (dismissedLocal[a.key]) {
            // Já foi dispensada antes — apenas marca no unlockedKeys, sem toast
            unlockedKeysRef.current.add(a.key);
            setUnlockedKeys((prev) => { const n = new Set(prev); n.add(a.key); return n; });
            setUnlockedAchievements((prev) => [
              ...(prev || []),
              { achievement_key: a.key, unlocked_at: new Date().toISOString(), seen: true, viewed_at: new Date().toISOString(), dismissed_at: dismissedLocal[a.key] },
            ]);
            achievementsService.markAsSeen(currentUser.id, [a.key]);
            return;
          }

          unlockedKeysRef.current.add(a.key);
          setUnlockedKeys((prev) => { const n = new Set(prev); n.add(a.key); return n; });
          setUnlockedAchievements((prev) => [
            ...(prev || []),
            {
              achievement_key: a.key,
              unlocked_at: new Date().toISOString(),
              seen: true,
              viewed_at: new Date().toISOString(),
              dismissed_at: null
            },
          ]);
          // Só adiciona ao toast se ainda não estiver na fila (evita duplicata com loadAchievements)
          setToastQueue((prev) => {
            if (prev.some(t => t.achievement?.key === a.key)) return prev;
            const id = `${a.key}-${Date.now()}`;
            return [...prev, { id, achievement: a }];
          });
          addNotification('achievement', `Nova conquista: ${a.title}`, a.desc, { tab: 'evolution' });

          // Marca como visto no banco
          achievementsService.markAsSeen(currentUser.id, [a.key]);
        });
      } finally {
        achievementChecking.current = false;
      }
    };
    checkAchievements();
  }, [tasks, goals, habits, habitLogs, currentUser?.id, unlockedKeys, unlockedAchievements]);



  const dismissToast = useCallback(async (id, key) => {
    // Remove localmente do toastQueue para resposta visual instantiva
    setToastQueue((prev) => prev.filter((t) => t.id !== id));

    if (currentUser?.id && key) {
      const userId = currentUser.id;
      const dismissedLocalKey = `myflowday_dismissed_achievements_${userId}`;
      try {
        let localDismissed = {};
        const localVal = localStorage.getItem(dismissedLocalKey);
        if (localVal) localDismissed = JSON.parse(localVal);
        localDismissed[key] = new Date().toISOString();
        localStorage.setItem(dismissedLocalKey, JSON.stringify(localDismissed));
      } catch (e) {
        console.warn('[AppContext] Falha ao salvar no localStorage:', e);
      }

      setUnlockedAchievements((prev) =>
        (prev || []).map((item) =>
          item.achievement_key === key
            ? { ...item, seen: true, dismissed_at: new Date().toISOString() }
            : item
        )
      );

      const { error } = await achievementsService.markAsDismissed(userId, key);
      if (error) {
        console.warn('[AppContext] Erro ao salvar dismissed_at no banco de dados (usando fallback local):', error.message);
      }
    }
  }, [currentUser?.id]);

  const handleCompleteOnboarding = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      localStorage.setItem(`flowday_onboarding_completed_${currentUser.id}`, 'true');
      if (currentUser.isDemo) {
        setCurrentUser(prev => ({
          ...prev,
          user_metadata: {
            ...prev.user_metadata,
            onboarding_completed: true
          }
        }));
        logEvent('onboarding_completed');
        return;
      }
      const { error } = await supabase.auth.updateUser({
        data: { onboarding_completed: true }
      });
      if (error) throw error;
      setCurrentUser(prev => ({
        ...prev,
        user_metadata: {
          ...prev.user_metadata,
          onboarding_completed: true
        }
      }));
      logEvent('onboarding_completed');
      eventsService.flushLocalEvents(currentUser.id).catch(() => {});
    } catch (e) {
      console.error('Erro ao marcar onboarding como concluído:', e);
    }
  }, [currentUser, logEvent]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TASKS CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  const resetAchievementsIfEmpty = useCallback(async (userId, updatedTasks, updatedGoals) => {
    const activeTasks = updatedTasks.filter(t => !t.deletedAt && !t.deleted_at);
    const activeGoals = updatedGoals.filter(g => !g.deletedAt && !g.deleted_at);
    if (activeTasks.length === 0 && activeGoals.length === 0) {
      console.log('[AppContext] Limpeza total de tarefas e objetivos detectada. Resetando conquistas.');
      try {
        if (currentUser?.isDemo) {
          const demoAchievementsKey = `flowday_demo_achievements_${currentUser.id}`;
          localStorage.setItem(demoAchievementsKey, JSON.stringify([]));
        } else {
          await achievementsService.resetAll(userId);
        }
        setUnlockedAchievements([]);
        setUnlockedKeys(new Set());
        if (unlockedKeysRef.current) {
          unlockedKeysRef.current = new Set();
        }
      } catch (err) {
        console.warn('[AppContext] Erro ao resetar conquistas:', err);
      }
    }
  }, [currentUser]);

  const handleAddTask = useCallback(async (taskData) => {
    if (!currentUser?.id) return;
    const { goal_id, ...payload } = taskData;

    if (currentUser.isDemo) {
      const demoId = 'dt_' + Date.now();
      const newTask = {
        id: demoId,
        user_id: currentUser.id,
        title: payload.title,
        description: payload.description || '',
        category: payload.category,
        priority: payload.priority,
        dueDate: payload.dueDate ? ensureDateTimezoneNoon(payload.dueDate) : '',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        updatedAt: new Date().toISOString(),
        deletedAt: null
      };
      const updated = [newTask, ...tasks];
      setTasks(updated);
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      logEvent('task_created', { taskId: demoId, title: payload.title });

      if (goal_id) {
        const updatedGT = [...goalTasks, { goal_id, task_id: demoId }];
        setGoalTasks(updatedGT);
        localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals, goalTasks: updatedGT }));
      }
      addNotification('task', 'Tarefa criada', payload.title);
      return newTask;
    }

    // Optimistic UI Update
    const tempId = 'temp_task_' + Date.now();
    const optimisticTask = {
      id: tempId,
      user_id: currentUser.id,
      title: payload.title,
      description: payload.description || '',
      category: payload.category || 'Pessoal',
      priority: payload.priority || 'Média',
      dueDate: payload.dueDate || '',
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null
    };

    setTasks((prev) => [optimisticTask, ...prev]);
    if (goal_id) {
      setGoalTasks((prev) => [...prev, { goal_id, task_id: tempId }]);
    }

    try {
      const { data } = await tasksService.create(currentUser.id, payload);
      if (data) {
        setTasks((prev) => prev.map(t => t.id === tempId ? data : t));
        logEvent('task_created', { taskId: data.id, title: payload.title });
        if (goal_id) {
          await goalsService.linkTask(goal_id, data.id);
          setGoalTasks((prev) => prev.map(gt => gt.task_id === tempId ? { goal_id, task_id: data.id } : gt));
        }
        return data;
      } else {
        // Rollback
        setTasks((prev) => prev.filter(t => t.id !== tempId));
        if (goal_id) {
          setGoalTasks((prev) => prev.filter(gt => gt.task_id !== tempId));
        }
        return null;
      }
    } catch (err) {
      // Rollback
      setTasks((prev) => prev.filter(t => t.id !== tempId));
      if (goal_id) {
        setGoalTasks((prev) => prev.filter(gt => gt.task_id !== tempId));
      }
      return null;
    }
  }, [currentUser, tasks, goals, goalTasks, logEvent, addNotification]);

  const handleUpdateTask = useCallback(async (id, updatedData) => {
    if (!currentUser?.id) return;

    const existingTask = tasks.find(t => t.id === id);

    // OPTIMISTIC UPDATE
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...updatedData } : t));
    logEvent('task_updated', { task_id: id });

    if (updatedData.completed === true) {
      logEvent('task_completed', { taskId: id });
      if (existingTask && existingTask.dueDate) {
        logEvent('calendar_task_completed', { taskId: id });
      }

      if (tasks.length > 0) {
        const alreadyHadSuccess = tasks.some(t => t.id !== id && t.completed);
        if (!alreadyHadSuccess && !firstSuccessLogged.current) {
          firstSuccessLogged.current = true;
          logEvent('first_success_action', { task_id: id });
        }
      }
    }

    if (updatedData.dueDate !== undefined) {
      if (updatedData.dueDate && (!existingTask || !existingTask.dueDate)) {
        logEvent('calendar_task_scheduled', { taskId: id, date: updatedData.dueDate });
        logEvent('task_scheduled', { taskId: id, date: updatedData.dueDate });
      } else if (existingTask && existingTask.dueDate && updatedData.dueDate && existingTask.dueDate !== updatedData.dueDate) {
        logEvent('calendar_task_moved', { taskId: id, oldDate: existingTask.dueDate, newDate: updatedData.dueDate });
        logEvent('task_rescheduled', { taskId: id, oldDate: existingTask.dueDate, newDate: updatedData.dueDate });
      }
    }

    if (currentUser.isDemo) {
      const updatedList = tasks.map((t) => t.id === id ? { ...t, ...updatedData, updatedAt: new Date().toISOString() } : t);
      setTasks(updatedList);
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updatedList));
      return;
    }

    tasksService.update(currentUser.id, id, updatedData).catch(err => {
      console.error('[AppContext] Erro ao atualizar tarefa:', err);
    });
  }, [currentUser, tasks, logEvent]);

  const handleDeleteTask = useCallback(async (id) => {
    if (!currentUser?.id) return;

    if (undoAction && undoAction.id === id) {
      clearTimeout(undoAction.timerId);
    }

    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    // 1. Marca visualmente como excluído na UI (esconde definindo deletedAt temporário)
    const nowIso = new Date().toISOString();

    // 2. Executa a deleção lógica imediatamente no banco/cache
    if (currentUser.isDemo) {
      setTasks(prev => {
        const updatedTasks = prev.map(t => t.id === id ? { ...t, deletedAt: nowIso, deleted_at: nowIso } : t);
        localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updatedTasks));
        return updatedTasks;
      });
      logEvent('task_deleted', { task_id: id });
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, deletedAt: nowIso, deleted_at: nowIso } : t));
      tasksService.delete(currentUser.id, id).then(({ error, degraded }) => {
        if (!error || degraded) {
          logEvent('task_deleted', { task_id: id });
        }
      });
    }

    // 3. Agenda a expiração do undo
    const timerId = setTimeout(() => {
      setUndoAction(null);
      setTasks(currentTasks => {
        setGoals(currentGoals => {
          resetAchievementsIfEmpty(currentUser.id, currentTasks, currentGoals);
          return currentGoals;
        });
        return currentTasks;
      });
    }, 3000);

    // 4. Ativa o Undo Action
    setUndoAction({
      type: 'task',
      id,
      timerId,
      item: taskToDelete
    });
  }, [currentUser, tasks, goals, goalTasks, undoAction, logEvent, resetAchievementsIfEmpty]);

  // Exclusão em lote de tarefas concluídas (soft delete com undo em 5s)
  const handleBulkDeleteCompleted = useCallback(async () => {
    if (!currentUser?.id) return;
    const completedTasks = tasks.filter(t => t.completed && !t.deletedAt && !t.deleted_at);
    if (completedTasks.length === 0) return;

    const nowIso = new Date().toISOString();
    const ids = completedTasks.map(t => t.id);

    // 1. Soft delete imediato na UI
    setTasks(prev => {
      const updated = prev.map(t => ids.includes(t.id) ? { ...t, deletedAt: nowIso, deleted_at: nowIso } : t);
      if (currentUser.isDemo) {
        localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    // 2. Cancela qualquer undo ativo anterior para não conflitar
    if (undoAction) clearTimeout(undoAction.timerId);

    // 3. Executa a deleção no banco imediatamente
    if (!currentUser.isDemo) {
      Promise.all(ids.map(id => tasksService.delete(currentUser.id, id))).then(() => {
        logEvent('bulk_tasks_deleted', { count: ids.length });
      });
    } else {
      logEvent('bulk_tasks_deleted', { count: ids.length });
    }

    // 4. Agenda a expiração do undo (3 segundos)
    const timerId = setTimeout(() => {
      setUndoAction(null);
      setTasks(currentTasks => {
        setGoals(currentGoals => {
          const activeTasks = currentTasks.filter(t => !t.deletedAt && !t.deleted_at);
          const activeGoals = currentGoals.filter(g => !g.deletedAt && !g.deleted_at);
          resetAchievementsIfEmpty(currentUser.id, activeTasks, activeGoals);
          return currentGoals;
        });
        return currentTasks;
      });
    }, 3000);

    // 5. Undo action para lote (restaura todos)
    setUndoAction({
      type: 'bulk_task',
      ids,
      timerId,
      items: completedTasks
    });

    return completedTasks.length;
  }, [currentUser, tasks, goals, goalTasks, undoAction, logEvent]);

  const handleDeleteAllTasks = useCallback(async () => {
    if (!currentUser?.id) return;

    const nowIso = new Date().toISOString();
    let activeIds = [];

    setTasks(prev => {
      activeIds = prev.filter(t => !t.deletedAt && !t.deleted_at).map(t => t.id);
      if (activeIds.length === 0) return prev;

      const updatedList = prev.map(t => activeIds.includes(t.id) ? { ...t, deletedAt: nowIso, deleted_at: nowIso } : t);
      if (currentUser.isDemo) {
        localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updatedList));
      } else {
        Promise.all(activeIds.map(id => tasksService.delete(currentUser.id, id))).then(() => {
          logEvent('all_tasks_deleted', { count: activeIds.length });
        }).catch(err => console.error('Error batch deleting tasks:', err));
      }
      const activeTasks = updatedList.filter(t => !t.deletedAt && !t.deleted_at);
      const activeGoals = goals.filter(g => !g.deletedAt && !g.deleted_at);
      resetAchievementsIfEmpty(currentUser.id, activeTasks, activeGoals);
      return updatedList;
    });

    if (undoAction?.timerId) clearTimeout(undoAction.timerId);
    setUndoAction(null);
  }, [currentUser, undoAction, logEvent, goals, resetAchievementsIfEmpty]);

  const handleResetAllData = useCallback(async () => {
    if (!currentUser?.id) return false;

    // Check if there is actually anything to delete
    const hasData = tasks.length > 0 || goals.length > 0 || habits.length > 0 || habitLogs.length > 0;
    if (!hasData) return false;

    // Clean states functionally
    setTasks([]);
    setGoals([]);
    setGoalTasks([]);
    setHabits([]);
    setHabitLogs([]);

    if (currentUser.isDemo) {
      localStorage.removeItem(`flowday_demo_tasks_${currentUser.id}`);
      localStorage.removeItem(`flowday_demo_goals_${currentUser.id}`);
      localStorage.removeItem(`flowday_demo_habits_${currentUser.id}`);
      localStorage.setItem(`flowday_demo_achievements_${currentUser.id}`, JSON.stringify([]));
    } else {
      try {
        await Promise.all([
          supabase.from('tasks').delete().eq('user_id', currentUser.id),
          supabase.from('goals').delete().eq('user_id', currentUser.id),
          supabase.from('habits').delete().eq('user_id', currentUser.id),
          supabase.from('habit_logs').delete().eq('user_id', currentUser.id),
          supabase.from('user_achievements').delete().eq('user_id', currentUser.id)
        ]);
      } catch (err) {
        console.error('Error clearing all database data:', err);
      }
    }

    // Resetar flags de onboarding para que o tour e guia reiniciem como no primeiro acesso
    localStorage.removeItem(`flowday_tour_v2_${currentUser.id}`);
    localStorage.removeItem('flowday_hide_evo_guide');

    addNotification('system', 'Dados limpos', 'Todos os seus dados foram excluídos permanentemente.');
    resetAchievementsIfEmpty(currentUser.id, [], []);
    return true;
  }, [currentUser, tasks, goals, habits, habitLogs, addNotification, resetAchievementsIfEmpty]);

  const handleToggleComplete = useCallback(async (id) => {
    if (!currentUser?.id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const next = !task.completed;
    const completedAt = next ? new Date().toISOString() : null;

    setTasks((prev) => {
      const updated = prev.map((t) => t.id === id ? { ...t, completed: next, completedAt } : t);
      if (currentUser.isDemo) {
        localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    if (next) {
      logEvent('task_completed', { taskId: id });
      const alreadyHadSuccess = tasks.some(t => t.id !== id && t.completed);
      if (!alreadyHadSuccess && !firstSuccessLogged.current) {
        firstSuccessLogged.current = true;
        logEvent('first_success_action', {
          task_id: id,
          task_title: task.title,
          ts: new Date().toISOString(),
        });
      }
    }

    if (currentUser.isDemo) {
      return;
    }

    tasksService.toggleComplete(currentUser.id, id, task.completed).then(async ({ error, degraded }) => {
      if (!error || degraded) {
        if (next) {
          const meta = parseTaskMetadata(task.description);
          if (meta && meta.recurrence && meta.recurrence !== 'nenhuma') {
            const nextDueDate = calculateNextOccurrence(task.dueDate, meta.recurrence, meta);
            const nextTask = {
              title: task.title,
              description: task.description,
              category: task.category,
              priority: task.priority,
              dueDate: nextDueDate,
            };
            const { data: createdTask } = await tasksService.create(currentUser.id, nextTask);
            if (createdTask) {
              setTasks((prev) => [createdTask, ...prev]);
              logEvent('task_created', { title: nextTask.title, recurrence_parent: id });
            }
          }
        }
      } else {
        setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !next, completedAt: task.completedAt } : t));
      }
    }).catch((err) => {
      console.error('[AppContext] Erro ao toggleComplete:', err);
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !next, completedAt: task.completedAt } : t));
    });
  }, [currentUser, tasks, goals, goalTasks, logEvent, incrementCompanionProgress]);

  const handleUpdateProfileFields = useCallback(async (fields) => {
    if (!currentUser?.id) return;
    const { data } = await profilesService.updateProfileFields(currentUser.id, fields);
    if (data) {
      const localAvatar = localStorage.getItem(`flowday_user_avatar_${currentUser.id}`);
      const updated = { ...data };
      if (localAvatar && (!updated.avatar_url || updated.avatar_url === '')) {
        updated.avatar_url = localAvatar;
      }
      setUserProfile(updated);
    }
  }, [currentUser?.id]);

  const logAuthEvent = useCallback(async (eventType, email, details = {}) => {
    try {
      const uId = currentUser?.id || null;
      await supabase.from('auth_logs').insert([{
        user_id: uId,
        event_type: eventType,
        email,
        details
      }]);
    } catch (e) {
      console.warn('[AppContext] Erro ao gravar log de auth:', e.message);
    }
  }, [currentUser]);

  const handleUpdateProfile = useCallback(async (profileData) => {
    if (!currentUser?.id) return;
    const { data } = await profilesService.updateProfile(currentUser.id, profileData);
    if (data) {
      setUserProfile(prev => {
        const merged = { ...prev, ...data };
        const localAvatar = localStorage.getItem(`flowday_user_avatar_${currentUser.id}`);
        if (localAvatar && (!merged.avatar_url || merged.avatar_url === '')) {
          merged.avatar_url = localAvatar;
        }
        return merged;
      });
      logEvent('profile_updated');
    }
  }, [currentUser?.id, logEvent]);

  const handleUploadAvatar = useCallback(async (file) => {
    if (!currentUser?.id) return;

    // Instant base64 local preview
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Url = reader.result;
      setUserProfile(prev => ({ ...prev, avatar_url: base64Url }));
      localStorage.setItem(`flowday_user_avatar_${currentUser.id}`, base64Url);
      logEvent('profile_updated', { avatar: true });

      // Background upload if not a demo user
      if (!currentUser.isDemo) {
        try {
          const { publicUrl } = await profilesService.uploadAvatar(currentUser.id, file);
          if (publicUrl) {
            setUserProfile(prev => ({ ...prev, avatar_url: publicUrl }));
            localStorage.setItem(`flowday_user_avatar_${currentUser.id}`, publicUrl);
          }
        } catch (err) {
          console.warn('[AppContext] Supabase avatar upload failed, using local fallback:', err);
        }
      }
    };
    reader.readAsDataURL(file);
  }, [currentUser?.id, logEvent]);

  const handleDeleteAvatar = useCallback(async () => {
    if (!currentUser?.id) return;

    setUserProfile(prev => ({ ...prev, avatar_url: '' }));
    localStorage.removeItem(`flowday_user_avatar_${currentUser.id}`);
    logEvent('profile_updated', { avatar: false });

    if (!currentUser.isDemo) {
      try {
        await profilesService.deleteAvatar(currentUser.id);
      } catch (err) {
        console.warn('[AppContext] Supabase avatar delete failed:', err);
      }
    }
  }, [currentUser?.id, logEvent]);

  // Duplicar Objetivos e Tarefas
  const handleDuplicateGoal = useCallback(async (goalId) => {
    if (!currentUser?.id) return;
    const origin = goals.find(g => g.id === goalId);
    if (!origin) return;

    const duplicatePayload = {
      title: `${origin.title} (Cópia)`,
      description: origin.description || '',
      color: origin.color || '#4A654E',
      icon: origin.icon || 'target',
      target_date: origin.target_date || null,
      start_time: origin.start_time || null,
      end_time: origin.end_time || null,
      attachments: origin.attachments || [],
      status: 'active'
    };

    // Obter tarefas vinculadas originais
    const linkedTaskIds = goalTasks.filter(gt => gt.goal_id === goalId).map(gt => gt.task_id);
    const originalTasks = tasks.filter(t => linkedTaskIds.includes(t.id));

    if (currentUser.isDemo) {
      const demoGoalId = 'dg_' + Date.now();
      const newGoal = {
        id: demoGoalId,
        user_id: currentUser.id,
        ...duplicatePayload,
        deletedAt: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const newTasks = [];
      const newGoalTasks = [];

      originalTasks.forEach((ot, idx) => {
        const newTaskId = `dt_${Date.now()}_${idx}`;
        newTasks.push({
          ...ot,
          id: newTaskId,
          title: ot.title,
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        newGoalTasks.push({
          id: `dgt_${Date.now()}_${idx}`,
          goal_id: demoGoalId,
          task_id: newTaskId,
          created_at: new Date().toISOString()
        });
      });

      const updatedGoals = [newGoal, ...goals];
      setGoals(updatedGoals);
      setTasks(prev => [...newTasks, ...prev]);
      setGoalTasks(prev => [...newGoalTasks, ...prev]);

      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: updatedGoals, goalTasks: [...newGoalTasks, ...goalTasks] }));
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify([...newTasks, ...tasks]));

      logEvent('goal_created', { title: duplicatePayload.title, duplicated_from: goalId });
      addNotification('goal', 'Objetivo duplicado', duplicatePayload.title);
      return;
    }

    const tempGoalId = 'temp_goal_' + Date.now();
    const optimisticGoal = {
      id: tempGoalId,
      user_id: currentUser.id,
      ...duplicatePayload,
      deletedAt: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setGoals((prev) => [optimisticGoal, ...prev]);

    try {
      // 1. Criar o novo objetivo no backend
      const { data: newGoalData } = await goalsService.create(currentUser.id, duplicatePayload);
      if (newGoalData) {
        setGoals((prev) => prev.map(g => g.id === tempGoalId ? newGoalData : g));

        // 2. Duplicar as tarefas e vincular
        if (originalTasks.length > 0) {
          const newTasksData = originalTasks.map(ot => ({
            title: ot.title,
            description: ot.description || '',
            category: ot.category || 'Pessoal',
            priority: ot.priority || 'Média',
            dueDate: ot.dueDate || null,
            completed: false
          }));

          for (const taskPayload of newTasksData) {
            const { data: createdTask } = await tasksService.create(currentUser.id, taskPayload);
            if (createdTask) {
              setTasks(prev => [createdTask, ...prev]);
              const { data: linkData } = await goalsService.linkTask(newGoalData.id, createdTask.id);
              if (linkData) {
                setGoalTasks(prev => [...prev, linkData]);
              }
            }
          }
        }

        logEvent('goal_created', { title: duplicatePayload.title, duplicated_from: goalId });
        addNotification('goal', 'Objetivo duplicado', duplicatePayload.title);
      } else {
        setGoals((prev) => prev.filter(g => g.id !== tempGoalId));
      }
    } catch (err) {
      console.error(err);
      setGoals((prev) => prev.filter(g => g.id !== tempGoalId));
    }
  }, [currentUser, goals, tasks, goalTasks, logEvent, addNotification]);

  const handleDuplicateTask = useCallback(async (taskId) => {
    if (!currentUser?.id) return;
    const origin = tasks.find(t => t.id === taskId);
    if (!origin) return;

    const linkedGoal = goalTasks.find(gt => gt.task_id === taskId);
    const goal_id = linkedGoal ? linkedGoal.goal_id : null;

    const duplicatePayload = {
      title: `${origin.title} (Cópia)`,
      description: origin.description || '',
      category: origin.category || 'Pessoal',
      priority: origin.priority || 'Média',
      dueDate: origin.dueDate || '',
      completed: false
    };

    if (currentUser.isDemo) {
      const demoId = 'dt_' + Date.now();
      const newTask = {
        id: demoId,
        user_id: currentUser.id,
        title: duplicatePayload.title,
        description: duplicatePayload.description,
        category: duplicatePayload.category,
        priority: duplicatePayload.priority,
        dueDate: duplicatePayload.dueDate,
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        updatedAt: new Date().toISOString(),
        deletedAt: null
      };
      const updated = [newTask, ...tasks];
      setTasks(updated);
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      logEvent('task_created', { taskId: demoId, title: duplicatePayload.title, duplicated_from: taskId });

      if (goal_id) {
        const updatedGT = [...goalTasks, { goal_id, task_id: demoId }];
        setGoalTasks(updatedGT);
        localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals, goalTasks: updatedGT }));
      }
      addNotification('task', 'Tarefa duplicada', duplicatePayload.title);
      return;
    }

    const tempId = 'temp_task_' + Date.now();
    const optimisticTask = {
      id: tempId,
      user_id: currentUser.id,
      title: duplicatePayload.title,
      description: duplicatePayload.description,
      category: duplicatePayload.category,
      priority: duplicatePayload.priority,
      dueDate: duplicatePayload.dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null
    };

    setTasks((prev) => [optimisticTask, ...prev]);
    if (goal_id) {
      setGoalTasks((prev) => [...prev, { goal_id, task_id: tempId }]);
    }

    try {
      const { data } = await tasksService.create(currentUser.id, duplicatePayload);
      if (data) {
        setTasks((prev) => prev.map(t => t.id === tempId ? data : t));
        logEvent('task_created', { taskId: data.id, title: duplicatePayload.title, duplicated_from: taskId });
        if (goal_id) {
          await goalsService.linkTask(goal_id, data.id);
          setGoalTasks((prev) => prev.map(gt => gt.task_id === tempId ? { goal_id, task_id: data.id } : gt));
        }
        addNotification('task', 'Tarefa duplicada', duplicatePayload.title);
      } else {
        setTasks((prev) => prev.filter(t => t.id !== tempId));
        if (goal_id) {
          setGoalTasks((prev) => prev.filter(gt => gt.task_id !== tempId));
        }
      }
    } catch (err) {
      setTasks((prev) => prev.filter(t => t.id !== tempId));
      if (goal_id) {
        setGoalTasks((prev) => prev.filter(gt => gt.task_id !== tempId));
      }
    }
  }, [currentUser, tasks, goals, goalTasks, logEvent, addNotification]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GOALS CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddGoal = useCallback(async (goalData) => {
    if (!currentUser?.id) return;
    const { actions, category, ...goalPayload } = goalData;

    if (currentUser.isDemo) {
      const demoGoalId = 'dg_' + Date.now();
      const newGoal = {
        id: demoGoalId,
        user_id: currentUser.id,
        title: goalPayload.title,
        description: goalPayload.description || '',
        color: goalPayload.color || '#4A654E',
        icon: goalPayload.icon || 'target',
        target_date: goalPayload.target_date || null,
        start_time: goalPayload.start_time || null,
        end_time: goalPayload.end_time || null,
        status: 'active',
        deletedAt: null
      };

      const updatedGoals = [newGoal, ...goals];
      setGoals(updatedGoals);
      logEvent('goal_created', { title: goalPayload.title });

      let currentDemoTasks = [...tasks];
      let currentDemoGT = [...goalTasks];

      if (actions && actions.length > 0) {
        for (const actionTitle of actions) {
          const actionId = 'dt_' + Math.random().toString(36).substr(2, 9);
          const taskData = {
            id: actionId,
            user_id: currentUser.id,
            title: actionTitle,
            description: '',
            category: category || 'Trabalho',
            priority: 'Média',
            dueDate: null,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
            deletedAt: null
          };
          currentDemoTasks.push(taskData);
          currentDemoGT.push({ goal_id: demoGoalId, task_id: actionId });
        }
        setTasks(currentDemoTasks);
        setGoalTasks(currentDemoGT);
      }

      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: updatedGoals, goalTasks: currentDemoGT }));
      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(currentDemoTasks));
      addNotification('goal', 'Objetivo criado', goalPayload.title);
      return;
    }

    const tempGoalId = 'temp_goal_' + Date.now();
    const optimisticGoal = {
      id: tempGoalId,
      user_id: currentUser.id,
      title: goalPayload.title,
      description: goalPayload.description || '',
      color: goalPayload.color || '#4A654E',
      icon: goalPayload.icon || 'target',
      target_date: goalPayload.target_date || null,
      start_time: goalPayload.start_time || null,
      end_time: goalPayload.end_time || null,
      status: 'active',
      deletedAt: null
    };

    setGoals((prev) => [optimisticGoal, ...prev]);

    const tempActions = [];
    if (actions && actions.length > 0) {
      actions.forEach((actionTitle, index) => {
        const tempActionId = `temp_action_${index}_${Date.now()}`;
        tempActions.push({
          tempId: tempActionId,
          task: {
            id: tempActionId,
            user_id: currentUser.id,
            title: actionTitle,
            description: '',
            category: category || 'Trabalho',
            priority: 'Média',
            dueDate: null,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
            deletedAt: null
          }
        });
      });

      setTasks((prev) => [...tempActions.map(ta => ta.task), ...prev]);
      setGoalTasks((prev) => [...prev, ...tempActions.map(ta => ({ goal_id: tempGoalId, task_id: ta.tempId }))]);
    }

    try {
      const { data } = await goalsService.create(currentUser.id, goalPayload);
      if (data) {
        setGoals((prev) => prev.map(g => g.id === tempGoalId ? data : g));
        logEvent('goal_created', { title: goalPayload.title });
        if (goalPayload.start_time && goalPayload.end_time) {
          logEvent('goal_scheduled', { title: goalPayload.title, start_time: goalPayload.start_time, end_time: goalPayload.end_time });
        }

        if (tempActions.length > 0) {
          const createdTasks = [];
          const createdLinks = [];
          const failedTempIds = [];

          await Promise.all(
            tempActions.map(async (ta) => {
              const taskData = {
                title: ta.task.title,
                description: '',
                category: category || 'Trabalho',
                priority: 'Média',
                dueDate: null,
              };
              try {
                const { data: taskResponse } = await tasksService.create(currentUser.id, taskData);
                if (taskResponse) {
                  createdTasks.push({ tempId: ta.tempId, task: taskResponse });
                  await goalsService.linkTask(data.id, taskResponse.id);
                  createdLinks.push({ tempId: ta.tempId, realId: taskResponse.id });
                } else {
                  failedTempIds.push(ta.tempId);
                }
              } catch (e) {
                console.error('[AppContext] Error importing task for predefined goal:', e);
                failedTempIds.push(ta.tempId);
              }
            })
          );

          // Update tasks state once
          setTasks((prev) => {
            let updated = [...prev];
            createdTasks.forEach(({ tempId, task }) => {
              updated = updated.map(t => t.id === tempId ? task : t);
            });
            if (failedTempIds.length > 0) {
              updated = updated.filter(t => !failedTempIds.includes(t.id));
            }
            return updated;
          });

          // Update goalTasks state once
          setGoalTasks((prev) => {
            let updated = [...prev];
            createdLinks.forEach(({ tempId, realId }) => {
              updated = updated.map(gt => 
                (gt.goal_id === tempGoalId && gt.task_id === tempId)
                  ? { goal_id: data.id, task_id: realId }
                  : gt
              );
            });
            if (failedTempIds.length > 0) {
              updated = updated.filter(gt => gt.goal_id !== tempGoalId || !failedTempIds.includes(gt.task_id));
            }
            // Fix remaining references
            updated = updated.map(gt => 
              gt.goal_id === tempGoalId ? { ...gt, goal_id: data.id } : gt
            );
            return updated;
          });
        }
      } else {
        // Rollback
        setGoals((prev) => prev.filter(g => g.id !== tempGoalId));
        if (tempActions.length > 0) {
          const tempIds = tempActions.map(ta => ta.tempId);
          setTasks((prev) => prev.filter(t => !tempIds.includes(t.id)));
          setGoalTasks((prev) => prev.filter(gt => gt.goal_id !== tempGoalId));
        }
      }
    } catch (err) {
      // Rollback
      setGoals((prev) => prev.filter(g => g.id !== tempGoalId));
      if (tempActions.length > 0) {
        const tempIds = tempActions.map(ta => ta.tempId);
        setTasks((prev) => prev.filter(t => !tempIds.includes(t.id)));
        setGoalTasks((prev) => prev.filter(gt => gt.goal_id !== tempGoalId));
      }
    }
  }, [currentUser, goals, tasks, goalTasks, logEvent, addNotification]);

  const handleUpdateGoal = useCallback(async (id, updatedData) => {
    if (!currentUser?.id) return;
    const existingGoal = goals.find(g => g.id === id);
    const { actions, ...payloadData } = updatedData;

    if (currentUser.isDemo) {
      const updatedGoals = goals.map((g) => g.id === id ? { ...g, ...payloadData } : g);
      setGoals(updatedGoals);

      let currentDemoTasks = [...tasks];
      let currentDemoGT = [...goalTasks];

      if (actions && actions.length > 0) {
        for (const actionTitle of actions) {
          const actionId = 'dt_' + Math.random().toString(36).substr(2, 9);
          const taskData = {
            id: actionId,
            user_id: currentUser.id,
            title: actionTitle,
            description: '',
            category: 'Trabalho',
            priority: 'Média',
            dueDate: null,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
            deletedAt: null
          };
          currentDemoTasks.push(taskData);
          currentDemoGT.push({ goal_id: id, task_id: actionId });
        }
        setTasks(currentDemoTasks);
        setGoalTasks(currentDemoGT);
      }

      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: updatedGoals, goalTasks: currentDemoGT }));
      
      if (payloadData.status === 'active' && (existingGoal?.status === 'completed' || existingGoal?.status === 'archived')) {
        logEvent('goal_reopened', { goal_id: id });
        const linkedIds = currentDemoGT.filter(gt => gt.goal_id === id).map(gt => gt.task_id);
        currentDemoTasks = currentDemoTasks.map(t => 
          (linkedIds.includes(t.id) && t.completed) ? { ...t, completed: false, completedAt: null } : t
        );
        setTasks(currentDemoTasks);
      }

      localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(currentDemoTasks));
      logEvent('goal_updated', { goal_id: id });
      if (payloadData.status === 'completed' && existingGoal?.status !== 'completed') {
        logEvent('goal_completed', { goal_id: id });
        addNotification('goal', 'Objetivo Concluído!', existingGoal.title);
        incrementCompanionProgress(currentUser.id);
      }
      return;
    }

    const { data: payload } = await goalsService.update(currentUser.id, id, payloadData);
    if (payload) {
      setGoals((prev) => prev.map((g) => g.id === id ? { ...g, ...payload } : g));
      logEvent('goal_updated', { goal_id: id });

      if (actions && actions.length > 0) {
        const newTasks = [];
        for (const actionTitle of actions) {
          const tempActionId = `temp_action_${Math.random()}_${Date.now()}`;
          const tempTask = {
            id: tempActionId,
            user_id: currentUser.id,
            title: actionTitle,
            description: '',
            category: 'Trabalho',
            priority: 'Média',
            dueDate: null,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
            deletedAt: null
          };
          newTasks.push({ tempId: tempActionId, task: tempTask });
        }

        // Atualização otimista
        setTasks((prev) => [...newTasks.map(nt => nt.task), ...prev]);
        setGoalTasks((prev) => [...prev, ...newTasks.map(nt => ({ goal_id: id, task_id: nt.tempId }))]);

        // Gravação assíncrona no banco
        for (const nt of newTasks) {
          const taskData = {
            title: nt.task.title,
            description: '',
            category: 'Trabalho',
            priority: 'Média',
            dueDate: null,
          };
          const { data: taskResponse } = await tasksService.create(currentUser.id, taskData);
          if (taskResponse) {
            setTasks((prev) => prev.map(t => t.id === nt.tempId ? taskResponse : t));
            await goalsService.linkTask(id, taskResponse.id);
            setGoalTasks((prev) => prev.map(gt =>
              (gt.goal_id === id && gt.task_id === nt.tempId)
                ? { goal_id: id, task_id: taskResponse.id }
                : gt
            ));
          } else {
            setTasks((prev) => prev.filter(t => t.id !== nt.tempId));
            setGoalTasks((prev) => prev.filter(gt => gt.task_id !== nt.tempId));
          }
        }
      }

      if (payloadData.start_time !== undefined && existingGoal.start_time !== payloadData.start_time) {
        logEvent('goal_time_updated', { goal_id: id, start_time: payloadData.start_time, end_time: payloadData.end_time });
      }
      if (payloadData.status === 'completed' && existingGoal?.status !== 'completed') {
        logEvent('goal_completed', { goal_id: id });
        addNotification('goal', 'Objetivo Concluído!', existingGoal.title);
        if (existingGoal.start_time) {
          logEvent('goal_completed_with_schedule', { goal_id: id });
        }
        incrementCompanionProgress(currentUser.id);
      } else if (payloadData.status === 'archived') {
        logEvent('goal_archived', { goal_id: id });
      } else if (existingGoal && (existingGoal.status === 'completed' || existingGoal.status === 'archived') && payloadData.status === 'active') {
        logEvent('goal_reopened', { goal_id: id });
        const linkedIds = goalTasks.filter(gt => gt.goal_id === id).map(gt => gt.task_id);
        
        // Reactivate linked completed tasks in the database and local state
        for (const taskId of linkedIds) {
          const task = tasks.find(t => t.id === taskId);
          if (task && task.completed) {
            await tasksService.update(currentUser.id, taskId, { completed: false, completedAt: null });
          }
        }
        setTasks(prev => prev.map(t => 
          (linkedIds.includes(t.id) && t.completed) ? { ...t, completed: false, completedAt: null } : t
        ));
      }
    }
  }, [currentUser, goals, goalTasks, tasks, logEvent, addNotification, incrementCompanionProgress]);

  const handleDeleteGoal = useCallback(async (id) => {
    if (!currentUser?.id) return;

    if (undoAction && undoAction.id === id) {
      clearTimeout(undoAction.timerId);
    }

    const goalToDelete = goals.find(g => g.id === id);
    if (!goalToDelete) return;

    // 1. Marca visualmente como excluído
    const nowIso = new Date().toISOString();

    // 2. Executa a deleção imediatamente no banco
    if (currentUser.isDemo) {
      setGoals(prev => {
        const updatedGoals = prev.map(g => g.id === id ? { ...g, deletedAt: nowIso, deleted_at: nowIso } : g);
        localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: updatedGoals, goalTasks }));
        return updatedGoals;
      });
      logEvent('goal_deleted', { goal_id: id });
    } else {
      setGoals(prev => prev.map(g => g.id === id ? { ...g, deletedAt: nowIso, deleted_at: nowIso } : g));
      goalsService.delete(currentUser.id, id).then(({ error }) => {
        if (!error) {
          logEvent('goal_deleted', { goal_id: id });
        }
      });
    }

    // 3. Agenda a expiração do undo
    const timerId = setTimeout(() => {
      setUndoAction(null);
      setGoals(currentGoals => {
        resetAchievementsIfEmpty(currentUser.id, tasks, currentGoals);
        return currentGoals;
      });
    }, 3000);

    // 4. Ativa o Undo
    setUndoAction({
      type: 'goal',
      id,
      timerId,
      item: goalToDelete
    });
  }, [currentUser, goals, goalTasks, tasks, undoAction, logEvent, resetAchievementsIfEmpty]);

  const handleBulkDeleteCompletedGoals = useCallback(async () => {
    if (!currentUser?.id) return;
    const completedGoals = goals.filter(g => g.status === 'completed' && !g.deletedAt && !g.deleted_at);
    if (completedGoals.length === 0) return;

    const nowIso = new Date().toISOString();
    const ids = completedGoals.map(g => g.id);

    // 1. Soft delete imediato na UI
    setGoals(prev => {
      const updated = prev.map(g => ids.includes(g.id) ? { ...g, deletedAt: nowIso, deleted_at: nowIso } : g);
      if (currentUser.isDemo) {
        localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: updated, goalTasks }));
      }
      return updated;
    });

    // 2. Cancela qualquer undo ativo anterior para não conflitar
    if (undoAction) clearTimeout(undoAction.timerId);

    // 3. Executa a deleção no banco imediatamente
    if (!currentUser.isDemo) {
      Promise.all(ids.map(id => goalsService.delete(currentUser.id, id))).then(() => {
        logEvent('bulk_goals_deleted', { count: ids.length });
      });
    } else {
      logEvent('bulk_goals_deleted', { count: ids.length });
    }

    // 4. Agenda a expiração do undo (3 segundos)
    const timerId = setTimeout(() => {
      setUndoAction(null);
      setGoals(currentGoals => {
        setTasks(currentTasks => {
          const activeTasks = currentTasks.filter(t => !t.deletedAt && !t.deleted_at);
          const activeGoals = currentGoals.filter(g => !g.deletedAt && !g.deleted_at);
          resetAchievementsIfEmpty(currentUser.id, activeTasks, activeGoals);
          return currentTasks;
        });
        return currentGoals;
      });
    }, 3000);

    // 5. Ativa o Undo
    setUndoAction({
      type: 'bulk_goal',
      ids,
      timerId,
      items: completedGoals
    });
  }, [currentUser, goals, goalTasks, tasks, undoAction, logEvent, resetAchievementsIfEmpty]);

  const handleDeleteAllGoals = useCallback(async () => {
    if (!currentUser?.id) return;
    const activeGoals = goals.filter(g => !g.deletedAt && !g.deleted_at);
    if (activeGoals.length === 0) return;

    const nowIso = new Date().toISOString();
    const ids = activeGoals.map(g => g.id);

    // 1. Soft delete imediato na UI
    setGoals(prev => {
      const updated = prev.map(g => ids.includes(g.id) ? { ...g, deletedAt: nowIso, deleted_at: nowIso } : g);
      if (currentUser.isDemo) {
        localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: updated, goalTasks }));
      }
      return updated;
    });

    // 2. Cancela qualquer undo ativo anterior para não conflitar
    if (undoAction) clearTimeout(undoAction.timerId);

    // 3. Executa a deleção no banco imediatamente
    if (!currentUser.isDemo) {
      Promise.all(ids.map(id => goalsService.delete(currentUser.id, id))).then(() => {
        logEvent('all_goals_deleted', { count: ids.length });
      });
    } else {
      logEvent('all_goals_deleted', { count: ids.length });
    }

    // 4. Agenda a expiração do undo (3 segundos)
    const timerId = setTimeout(() => {
      setUndoAction(null);
      setGoals(currentGoals => {
        setTasks(currentTasks => {
          const activeTasks = currentTasks.filter(t => !t.deletedAt && !t.deleted_at);
          const activeGoals = currentGoals.filter(g => !g.deletedAt && !g.deleted_at);
          resetAchievementsIfEmpty(currentUser.id, activeTasks, activeGoals);
          return currentTasks;
        });
        return currentGoals;
      });
    }, 3000);

    // 5. Ativa o Undo
    setUndoAction({
      type: 'bulk_goal',
      ids,
      timerId,
      items: activeGoals
    });
  }, [currentUser, goals, goalTasks, tasks, undoAction, logEvent, resetAchievementsIfEmpty]);

  const handleLinkTask = useCallback(async (goalId, taskId) => {
    console.log('[AppContext] handleLinkTask called with:', { goalId, taskId, isDemo: currentUser?.isDemo });
    if (goalTasks.some((gt) => gt.goal_id === goalId && gt.task_id === taskId)) {
      console.log('[AppContext] handleLinkTask already linked, ignoring');
      return;
    }

    if (currentUser?.isDemo) {
      const updatedGT = [...goalTasks, { goal_id: goalId, task_id: taskId }];
      console.log('[AppContext] handleLinkTask Demo mode, setting goalTasks:', updatedGT);
      setGoalTasks(updatedGT);
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals, goalTasks: updatedGT }));
      return;
    }

    const { error } = await goalsService.linkTask(goalId, taskId);
    if (!error) {
      console.log('[AppContext] handleLinkTask success, setting goalTasks');
      setGoalTasks((prev) => [...prev, { goal_id: goalId, task_id: taskId }]);
      logEvent('task_linked_to_goal', { goal_id: goalId, task_id: taskId });
    } else {
      console.error('[AppContext] handleLinkTask service error:', error);
    }
  }, [goalTasks, currentUser, goals, logEvent]);

  const handleUnlinkTask = useCallback(async (goalId, taskId) => {
    if (currentUser?.isDemo) {
      const updatedGT = goalTasks.filter(gt => !(gt.goal_id === goalId && gt.task_id === taskId));
      setGoalTasks(updatedGT);
      localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals, goalTasks: updatedGT }));
      return;
    }

    const { error } = await goalsService.unlinkTask(goalId, taskId);
    if (!error) {
      setGoalTasks((prev) => prev.filter((gt) => !(gt.goal_id === goalId && gt.task_id === taskId)));
      logEvent('task_unlinked_from_goal', { goal_id: goalId, task_id: taskId });
    }
  }, [currentUser, goalTasks, goals, logEvent]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORIAS CRUD (Bloco 4)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddCategory = useCallback(async (newCat) => {
    if (!currentUser?.id) return;
    const currentCustom = currentUser.user_metadata?.custom_categories || [];

    if (currentCustom.some(c => c.id.toLowerCase() === newCat.id.toLowerCase()) ||
      defaultCategories.some(c => c.id.toLowerCase() === newCat.id.toLowerCase())) {
      openCustomAlert('Essa categoria já existe.');
      return;
    }
    const updatedCustom = [...currentCustom, newCat];
    try {
      if (!currentUser.isDemo) {
        const { error } = await supabase.auth.updateUser({
          data: { custom_categories: updatedCustom }
        });
        if (error) throw error;
      } else {
        const localKey = `flowday_demo_user_${currentUser.id}`;
        const localUserData = localStorage.getItem(localKey);
        if (localUserData) {
          const parsed = JSON.parse(localUserData);
          parsed.user_metadata = { ...parsed.user_metadata, custom_categories: updatedCustom };
          localStorage.setItem(localKey, JSON.stringify(parsed));
        }
      }
      setCurrentUser(prev => ({
        ...prev,
        user_metadata: { ...prev.user_metadata, custom_categories: updatedCustom }
      }));
      logEvent('category_created', { category: newCat.name });
    } catch (e) {
      console.error('Erro ao adicionar categoria:', e);
    }
  }, [currentUser, logEvent]);

  const handleUpdateCategory = useCallback(async (id, name, emoji, color) => {
    if (!currentUser?.id) return;
    const currentCustom = currentUser.user_metadata?.custom_categories || [];
    const updatedCustom = currentCustom.map(c => c.id === id ? { ...c, name, emoji, color } : c);
    try {
      if (!currentUser.isDemo) {
        const { error } = await supabase.auth.updateUser({
          data: { custom_categories: updatedCustom }
        });
        if (error) throw error;
      } else {
        const localKey = `flowday_demo_user_${currentUser.id}`;
        const localUserData = localStorage.getItem(localKey);
        if (localUserData) {
          const parsed = JSON.parse(localUserData);
          parsed.user_metadata = { ...parsed.user_metadata, custom_categories: updatedCustom };
          localStorage.setItem(localKey, JSON.stringify(parsed));
        }
      }
      setCurrentUser(prev => ({
        ...prev,
        user_metadata: { ...prev.user_metadata, custom_categories: updatedCustom }
      }));
      logEvent('category_updated', { category: name });
    } catch (e) {
      console.error('Erro ao atualizar categoria:', e);
    }
  }, [currentUser, logEvent]);

  const handleDeleteCategory = useCallback(async (id) => {
    if (!currentUser?.id) return;
    const currentCustom = currentUser.user_metadata?.custom_categories || [];
    const updatedCustom = currentCustom.filter(c => c.id !== id);
    try {
      if (!currentUser.isDemo) {
        const { error } = await supabase.auth.updateUser({
          data: { custom_categories: updatedCustom }
        });
        if (error) throw error;
      } else {
        const localKey = `flowday_demo_user_${currentUser.id}`;
        const localUserData = localStorage.getItem(localKey);
        if (localUserData) {
          const parsed = JSON.parse(localUserData);
          parsed.user_metadata = { ...parsed.user_metadata, custom_categories: updatedCustom };
          localStorage.setItem(localKey, JSON.stringify(parsed));
        }
      }
      setCurrentUser(prev => ({
        ...prev,
        user_metadata: { ...prev.user_metadata, custom_categories: updatedCustom }
      }));
      logEvent('category_deleted', { category_id: id });
    } catch (e) {
      console.error('Erro ao excluir categoria:', e);
    }
  }, [currentUser, logEvent]);

  const openPaywall = useCallback((sourceOrOptions) => {
    setIsPaywallOpen(true);
    let src = '';
    let meta = {};
    if (typeof sourceOrOptions === 'object' && sourceOrOptions !== null) {
      src = sourceOrOptions.source || '';
      meta = sourceOrOptions;
    } else {
      src = sourceOrOptions || '';
      meta = { source: src };
    }
    setPaywallSource(src);
    logEvent('paywall_viewed', meta);
  }, [logEvent]);

  const closePaywall = useCallback(() => {
    setIsPaywallOpen(false);
  }, []);

  const handleCancelSubscription = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      logEvent('downgrade_clicked');

      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });

      if (!response.ok) {
        throw new Error('Falha ao processar o cancelamento da assinatura.');
      }

      const data = await response.json();
      if (data.success) {
        setIsPro(false);
        setSubscriptionStatus('canceled');
        setSubscriptionPlan('free');

        // Atualiza o perfil localmente se estiver carregado
        if (userProfile) {
          setUserProfile(prev => ({
            ...prev,
            plano: 'free',
            assinatura_status: 'canceled'
          }));
        }

        addNotification('system', 'Assinatura Cancelada', 'Sua assinatura Premium foi cancelada com sucesso. Você retornou ao plano Free.');
      } else {
        throw new Error(data.error || 'Erro ao cancelar assinatura.');
      }
    } catch (e) {
      console.error('Erro ao cancelar assinatura:', e);
      openCustomAlert('Não foi possível cancelar sua assinatura automaticamente: ' + e.message);
    }
  }, [currentUser, userProfile, setIsPro, addNotification, logEvent]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HABITS — interface compatível com useHabits anterior
  // ═══════════════════════════════════════════════════════════════════════════
  const habitsManager = useMemo(() => {
    return {
      habits,
      habitLogs,
      loading: habitsLoading,
      addHabit: async (habitData) => {
        if (!currentUser?.id) return null;
        if (currentUser.isDemo) {
          const demoId = 'dh_' + Date.now();
          const newHabit = {
            id: demoId,
            user_id: currentUser.id,
            ...habitData,
            created_at: new Date().toISOString()
          };
          const nextHabits = [newHabit, ...habits];
          setHabits(nextHabits);
          localStorage.setItem(`flowday_demo_habits_${currentUser.id}`, JSON.stringify({ habits: nextHabits, habitLogs }));
          logEvent('habit_created', { title: habitData.title });
          return newHabit;
        }
        const { data } = await habitsService.create(currentUser.id, habitData);
        if (data) {
          setHabits((prev) => [data, ...prev]);
          logEvent('habit_created', { title: habitData.title });
        }
        return data;
      },
      updateHabit: async (id, updates) => {
        if (!currentUser?.id) return null;
        if (currentUser.isDemo) {
          const nextHabits = habits.map((h) => h.id === id ? { ...h, ...updates } : h);
          setHabits(nextHabits);
          localStorage.setItem(`flowday_demo_habits_${currentUser.id}`, JSON.stringify({ habits: nextHabits, habitLogs }));
          logEvent('habit_updated', { habit_id: id });
          return nextHabits.find((h) => h.id === id) || null;
        }
        const { data } = await habitsService.update(currentUser.id, id, updates);
        if (data) {
          setHabits((prev) => prev.map((h) => h.id === id ? data : h));
          logEvent('habit_updated', { habit_id: id });
        }
        return data;
      },
      deleteHabit: async (id) => {
        if (!currentUser?.id) return false;
        if (currentUser.isDemo) {
          const nextHabits = habits.filter((h) => h.id !== id);
          const nextLogs = habitLogs.filter((l) => l.habit_id !== id);
          setHabits(nextHabits);
          setHabitLogs(nextLogs);
          localStorage.setItem(`flowday_demo_habits_${currentUser.id}`, JSON.stringify({ habits: nextHabits, habitLogs: nextLogs }));
          logEvent('habit_deleted', { habit_id: id });
          return true;
        }
        const { error } = await habitsService.delete(currentUser.id, id);
        if (!error) {
          setHabits((prev) => prev.filter((h) => h.id !== id));
          setHabitLogs((prev) => prev.filter((l) => l.habit_id !== id));
          logEvent('habit_deleted', { habit_id: id });
        }
        return !error;
      },
      toggleHabitLog: async (habitId, dateStr) => {
        if (!currentUser?.id) return false;
        const existing = habitLogs.find((l) => l.habit_id === habitId && l.completed_date === dateStr);
        
        if (currentUser.isDemo) {
          let nextLogs;
          if (existing) {
            nextLogs = habitLogs.filter((l) => !(l.habit_id === habitId && l.completed_date === dateStr));
            setHabitLogs(nextLogs);
          } else {
            const tempId = 'dl_' + Date.now();
            const tempLog = { id: tempId, habit_id: habitId, completed_date: dateStr, user_id: currentUser.id, created_at: new Date().toISOString() };
            nextLogs = [...habitLogs, tempLog];
            setHabitLogs(nextLogs);
            logEvent('habit_completed', { habit_id: habitId, date: dateStr });
          }
          localStorage.setItem(`flowday_demo_habits_${currentUser.id}`, JSON.stringify({ habits, habitLogs: nextLogs }));
          return true;
        }

        // Optimistic UI update
        const tempId = 'temp_hlog_' + Date.now();
        if (existing) {
          setHabitLogs((prev) => prev.filter((l) => !(l.habit_id === habitId && l.completed_date === dateStr)));
        } else {
          const tempLog = { id: tempId, habit_id: habitId, completed_date: dateStr, created_at: new Date().toISOString() };
          setHabitLogs((prev) => [...prev, tempLog]);
        }

        try {
          const { data: checked, logData } = await habitsService.toggleLog(
            currentUser.id, habitId, dateStr, existing?.id ?? null
          );
          if (checked === false) {
            // Confirm removal locally
            setHabitLogs((prev) => prev.filter((l) => !(l.habit_id === habitId && l.completed_date === dateStr)));
          } else if (checked === true && logData) {
            // Replace temporary log item with real database item
            setHabitLogs((prev) => prev.map((l) => l.id === tempId ? logData : l));
            logEvent('habit_completed', { habit_id: habitId, date: dateStr });
          }
          return checked ?? false;
        } catch (e) {
          console.error('Erro ao alternar hábito:', e);
          // Rollback on error
          if (existing) {
            setHabitLogs((prev) => [...prev, existing]);
          } else {
            setHabitLogs((prev) => prev.filter((l) => l.id !== tempId));
          }
          return false;
        }
      }
    };
  }, [habits, habitLogs, habitsLoading, currentUser, logEvent]);

  // ═══════════════════════════════════════════════════════════════════════════
  // USER STATE INTELLIGENCE — Re-hidratação baseada em eventos (Event Sourcing)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!currentUser?.id || currentUser.isDemo) return;

    setTimeout(() => {
      rehydrateUserState(currentUser.id).then((state) => {
        if (state?.has_first_success) firstSuccessLogged.current = true;
      });
    }, 0);

    const unsub = eventEmitter.on('*', () => {
      rehydrateUserState(currentUser.id).then((state) => {
        if (state?.has_first_success) firstSuccessLogged.current = true;
      });
    });

    return unsub;
  }, [currentUser?.id, currentUser?.isDemo, rehydrateUserState]);

  // ── Lógica do Desfazer (Undo) e Lixeira ──
  const triggerUndo = useCallback(async () => {
    if (!undoAction) return;
    clearTimeout(undoAction.timerId);

    // Restaura localmente na UI e no banco
    if (undoAction.type === 'task') {
      setTasks(prev => {
        const exists = prev.some(t => t.id === undoAction.id);
        if (exists) {
          return prev.map(t => t.id === undoAction.id ? { ...t, deletedAt: null } : t);
        } else if (undoAction.item) {
          return [...prev, { ...undoAction.item, deletedAt: null }];
        }
        return prev;
      });
      if (!currentUser.isDemo) {
        await tasksService.restore(currentUser.id, undoAction.id);
      } else {
        const mockTasks = tasks.map(t => t.id === undoAction.id ? { ...t, deletedAt: null } : t);
        localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(mockTasks));
      }
    } else if (undoAction.type === 'bulk_task') {
      const restoredIds = new Set(undoAction.ids);
      setTasks(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const toAdd = (undoAction.items || []).filter(item => !existingIds.has(item.id)).map(item => ({ ...item, deletedAt: null }));
        const updated = prev.map(t => restoredIds.has(t.id) ? { ...t, deletedAt: null } : t);
        return [...updated, ...toAdd];
      });
      if (!currentUser.isDemo) {
        await Promise.all(undoAction.ids.map(id => tasksService.restore(currentUser.id, id)));
      } else {
        const updated = tasks.map(t => restoredIds.has(t.id) ? { ...t, deletedAt: null } : t);
        localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      }
    } else if (undoAction.type === 'goal') {
      setGoals(prev => {
        const exists = prev.some(g => g.id === undoAction.id);
        if (exists) {
          return prev.map(g => g.id === undoAction.id ? { ...g, deletedAt: null } : g);
        } else if (undoAction.item) {
          return [...prev, { ...undoAction.item, deletedAt: null }];
        }
        return prev;
      });
      if (!currentUser.isDemo) {
        await goalsService.restore(currentUser.id, undoAction.id);
      } else {
        const mockGoals = goals.map(g => g.id === undoAction.id ? { ...g, deletedAt: null } : g);
        localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: mockGoals, goalTasks }));
      }
    } else if (undoAction.type === 'bulk_goal') {
      const restoredIds = new Set(undoAction.ids);
      setGoals(prev => {
        const existingIds = new Set(prev.map(g => g.id));
        const toAdd = (undoAction.items || []).filter(item => !existingIds.has(item.id)).map(item => ({ ...item, deletedAt: null }));
        const updated = prev.map(g => restoredIds.has(g.id) ? { ...g, deletedAt: null } : g);
        return [...updated, ...toAdd];
      });
      if (!currentUser.isDemo) {
        await Promise.all(undoAction.ids.map(id => goalsService.restore(currentUser.id, id)));
      } else {
        const mockGoals = goals.map(g => restoredIds.has(g.id) ? { ...g, deletedAt: null } : g);
        localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: mockGoals, goalTasks }));
      }
    }

    setUndoAction(null);
    addNotification('system', 'Ação Desfeita', 'Os itens removidos foram restaurados com sucesso.');
  }, [currentUser, undoAction, tasks, goals, goalTasks, addNotification]);


  const handleRestoreTask = useCallback(async (id) => {
    if (!currentUser?.id) return;
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, deletedAt: null, deleted_at: null } : t);
      if (currentUser.isDemo) {
        localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    if (currentUser.isDemo) return;
    await tasksService.restore(currentUser.id, id);
    addNotification('system', 'Tarefa restaurada', 'A tarefa foi movida de volta à lista ativa.');
  }, [currentUser, addNotification]);

  const handleDeleteTaskPermanent = useCallback(async (id, force = false) => {
    if (!currentUser?.id) return;

    const proceed = async () => {
      let finalTasks = [];
      setTasks(prev => {
        finalTasks = prev.filter(t => t.id !== id);
        if (currentUser.isDemo) {
          localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(finalTasks));
        }
        return finalTasks;
      });
      setGoalTasks(prev => {
        const nextGoalTasks = prev.filter(gt => gt.task_id !== id);
        if (currentUser.isDemo) {
          localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals, goalTasks: nextGoalTasks }));
        }
        return nextGoalTasks;
      });

      if (!currentUser.isDemo) {
        await tasksService.deletePermanent(currentUser.id, id);
        addNotification('system', 'Tarefa excluída', 'A tarefa foi removida em definitivo.');
      }

      setGoals(currentGoals => {
        resetAchievementsIfEmpty(currentUser.id, finalTasks, currentGoals);
        return currentGoals;
      });
    };

    if (force) {
      await proceed();
    } else {
      openCustomConfirm(
        'Excluir esta tarefa permanentemente? Esta ação não pode ser desfeita.',
        'Excluir Tarefa',
        proceed
      );
    }
  }, [currentUser, goals, addNotification, openCustomConfirm, resetAchievementsIfEmpty]);

  const handleRestoreGoal = useCallback(async (id) => {
    if (!currentUser?.id) return;
    setGoals(prev => {
      const updated = prev.map(g => g.id === id ? { ...g, deletedAt: null, deleted_at: null } : g);
      if (currentUser.isDemo) {
        localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: updated, goalTasks }));
      }
      return updated;
    });

    if (currentUser.isDemo) return;
    await goalsService.restore(currentUser.id, id);
    addNotification('system', 'Objetivo restaurado', 'O objetivo foi restaurado com sucesso.');
  }, [currentUser, goalTasks, addNotification]);

  const handleDeleteGoalPermanent = useCallback(async (id, force = false) => {
    if (!currentUser?.id) return;

    const proceed = async () => {
      let finalGoals = [];
      setGoals(prev => {
        finalGoals = prev.filter(g => g.id !== id);
        if (currentUser.isDemo) {
          localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: finalGoals, goalTasks }));
        }
        return finalGoals;
      });
      setGoalTasks(prev => {
        const nextGoalTasks = prev.filter(gt => gt.goal_id !== id);
        if (currentUser.isDemo) {
          localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: finalGoals, goalTasks: nextGoalTasks }));
        }
        return nextGoalTasks;
      });

      if (!currentUser.isDemo) {
        await goalsService.deletePermanent(currentUser.id, id);
        addNotification('system', 'Objetivo excluído', 'O objetivo foi removido em definitivo.');
      }

      setTasks(currentTasks => {
        resetAchievementsIfEmpty(currentUser.id, currentTasks, finalGoals);
        return currentTasks;
      });
    };

    if (force) {
      await proceed();
    } else {
      openCustomConfirm(
        'Excluir este objetivo permanentemente? Isso removerá todas as referências dele.',
        'Excluir Objetivo',
        proceed
      );
    }
  }, [currentUser, addNotification, openCustomConfirm, resetAchievementsIfEmpty]);

  const handleEmptyTrash = useCallback(async () => {
    if (!currentUser?.id) return;

    // Get deleted tasks and goals from current synchronous state
    const deletedTasks = tasks.filter(t => t.deletedAt || t.deleted_at);
    const deletedGoals = goals.filter(g => g.deletedAt || g.deleted_at);
    
    const deletedTaskIds = deletedTasks.map(t => t.id);
    const deletedGoalIds = deletedGoals.map(g => g.id);

    if (deletedTaskIds.length === 0 && deletedGoalIds.length === 0) {
      addNotification('system', 'Lixeira esvaziada', 'Sua lixeira já está vazia.');
      return;
    }

    try {
      // 1. Run background DB deletes if not in demo
      if (!currentUser.isDemo) {
        const taskDeletions = deletedTaskIds.map(id => tasksService.deletePermanent(currentUser.id, id));
        const goalDeletions = deletedGoalIds.map(id => goalsService.deletePermanent(currentUser.id, id));
        
        // Wait for all deletions to process
        const results = await Promise.all([...taskDeletions, ...goalDeletions]);
        
        // Check if any deletion failed critically
        const criticalError = results.find(r => r && r.error && !r.degraded);
        if (criticalError) {
          throw criticalError.error;
        }
      }

      // 2. Update tasks state
      const finalTasksList = tasks.filter(t => !t.deletedAt && !t.deleted_at);
      setTasks(finalTasksList);
      if (currentUser.isDemo) {
        localStorage.setItem(`flowday_demo_tasks_${currentUser.id}`, JSON.stringify(finalTasksList));
      }

      // 3. Update goals state
      const finalGoalsList = goals.filter(g => !g.deletedAt && !g.deleted_at);
      setGoals(finalGoalsList);

      // 4. Update goal-tasks link state
      setGoalTasks(prev => {
        const updatedGT = prev.filter(gt => !deletedTaskIds.includes(gt.task_id) && !deletedGoalIds.includes(gt.goal_id));
        if (currentUser.isDemo) {
          localStorage.setItem(`flowday_demo_goals_${currentUser.id}`, JSON.stringify({ goals: finalGoalsList, goalTasks: updatedGT }));
        }
        return updatedGT;
      });

      // 5. Trigger success notification
      addNotification('system', 'Lixeira esvaziada', 'Todos os itens foram excluídos permanentemente.');
      resetAchievementsIfEmpty(currentUser.id, finalTasksList, finalGoalsList);
    } catch (err) {
      console.error('[handleEmptyTrash] Erro ao esvaziar lixeira:', err);
      openCustomAlert('Não foi possível esvaziar a lixeira: ' + (err.message || err));
    }
  }, [currentUser, tasks, goals, addNotification, resetAchievementsIfEmpty, openCustomAlert]);

  // ── Explicação Detalhada do Health Score (Consistency Score) ──
  const consistencyScoreExplanation = useMemo(() => {
    if (!currentUser) return { positives: [], negatives: [], breakdown: {}, motivationalMessage: '' };

    const positives = [];
    const negatives = [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const activeTasks = tasks.filter(t => !t.deletedAt);
    const activeGoals = goals.filter(g => !g.deletedAt);

    // 1. Conclusão de tarefas nos últimos 7 dias
    const recentTasks = activeTasks.filter(t => {
      const date = t.dueDate || t.createdAt?.split('T')[0];
      return date && new Date(date) >= sevenDaysAgo;
    });
    const taskCount = recentTasks.length;
    const completedTaskCount = recentTasks.filter(t => t.completed).length;

    if (completedTaskCount > 0) {
      positives.push({ text: `${completedTaskCount} tarefas concluídas nos últimos 7 dias`, value: `+${Math.round((completedTaskCount / Math.max(1, taskCount)) * 40)}%` });
    } else if (taskCount > 0) {
      negatives.push({ text: 'Nenhuma das tarefas recentes foi concluída', value: '-15%' });
    }

    // 2. Conclusão de hábitos nos últimos 7 dias
    const recentLogs = habitLogs.filter(l => new Date(l.completed_date) >= sevenDaysAgo);
    let totalPossibleLogs = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    habits.forEach(h => {
      const createdDate = h.created_at ? new Date(h.created_at.split('T')[0]) : new Date(today);
      createdDate.setHours(0, 0, 0, 0);
      const diffTime = Math.max(0, today - createdDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const habitDaysCount = Math.min(7, diffDays + 1);
      totalPossibleLogs += habitDaysCount;
    });

    if (recentLogs.length > 0) {
      positives.push({ text: `${recentLogs.length} execuções de hábitos registradas`, value: `+${Math.round((recentLogs.length / Math.max(1, totalPossibleLogs)) * 40)}%` });
    } else if (habits.length > 0) {
      negatives.push({ text: 'Nenhum hábito realizado recentemente', value: '-20%' });
    }

    // 3. Progresso dos objetivos ativos
    const activeGoalsFiltered = activeGoals.filter(g => g.status === 'active');
    let totalPct = 0;
    activeGoalsFiltered.forEach(goal => {
      const linkedIds = goalTasks.filter(gt => gt.goal_id === goal.id).map(gt => gt.task_id);
      const linked = activeTasks.filter(t => linkedIds.includes(t.id));
      const done = linked.filter(t => t.completed).length;
      const pct = linked.length > 0 ? (done / linked.length) : 0;
      totalPct += pct;
    });

    if (activeGoalsFiltered.length > 0) {
      const avgGoalProgress = Math.round((totalPct / activeGoalsFiltered.length) * 100);
      if (avgGoalProgress > 0) {
        positives.push({ text: `Objetivos em andamento avançando (média de ${avgGoalProgress}% concluído)`, value: `+${Math.round((avgGoalProgress / 100) * 20)}%` });
      }
    }

    // Penalidade: Tarefas Atrasadas
    const lateTasks = activeTasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < new Date());
    if (lateTasks.length > 0) {
      negatives.push({ text: `${lateTasks.length} tarefas estão com prazo atrasado`, value: `-${Math.min(15, lateTasks.length * 2)}%` });
    }

    // Planejamento semanal
    const weeklyPlan = currentUser?.user_metadata?.weekly_plan || null;
    if (weeklyPlan) {
      positives.push({ text: 'Planejamento semanal concluído', value: '+10% (Bônus)' });
    } else {
      negatives.push({ text: 'Nenhum planejamento semanal feito para este ciclo', value: '-5%' });
    }

    // ─── CÁLCULO DO DETALHAMENTO TRANSPARENTE (6 COMPONENTES) ───

    // A. Dias ativos recentes
    const activeDates = new Set();
    activeTasks.filter(t => t.completed && t.completedAt).forEach(t => {
      const dateStr = t.completedAt.split('T')[0];
      if (dateStr >= sevenDaysAgoStr) activeDates.add(dateStr);
    });
    habitLogs.filter(l => l.completed_date >= sevenDaysAgoStr).forEach(l => {
      activeDates.add(l.completed_date);
    });
    const activeDaysRecent = activeDates.size;
    const diasAtivosPct = Math.round((activeDaysRecent / 7) * 100);
    const diasAtivosOk = activeDaysRecent >= 3;

    // B. Sequência atual
    const streak = calcStreak(tasks);
    const sequenciaPct = Math.min(100, Math.round((streak / 7) * 100));
    const sequenciaOk = streak >= 1;

    // C. Sessões de foco concluídas
    const focusCount = userState?.stats?.sessions || 0;
    const finalFocusCount = (currentUser?.isDemo && focusCount === 0) ? 8 : focusCount;
    const focoPct = Math.min(100, Math.round((finalFocusCount / 5) * 100));
    const focoOk = finalFocusCount >= 1;

    // D. Tarefas finalizadas
    const completedTasksCount = activeTasks.filter(t => t.completed).length;
    const totalTasksCount = activeTasks.length;
    const taskRate = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) : 0;
    const tarefasPct = Math.round(taskRate * 100);
    const tarefasOk = completedTasksCount >= 1;

    // E. Objetivos movimentados
    const completedGoalsCount = activeGoals.filter(g => g.status === 'completed').length;
    const totalGoalsCount = activeGoals.length;
    const goalRate = activeGoalsFiltered.length > 0 ? (totalPct / activeGoalsFiltered.length) : 0;
    const objetivosPct = Math.round((completedGoalsCount > 0 || goalRate > 0) ? (completedGoalsCount / Math.max(1, totalGoalsCount) * 50 + goalRate * 50) : 0);
    const objetivosOk = activeGoals.length > 0;

    // F. Regularidade semanal
    const hasWeeklyPlan = !!(weeklyPlan && (weeklyPlan.focus || weeklyPlan.linkedGoals?.length > 0));
    const regularidadePct = hasWeeklyPlan ? 100 : 0;
    const regularidadeOk = hasWeeklyPlan;

    const breakdown = {
      diasAtivos: {
        pct: diasAtivosPct,
        valueText: `${activeDaysRecent} de 7 dias`,
        label: 'Dias ativos recentes',
        desc: 'Sua frequência diária de atividades concluídas na última semana.',
        ok: diasAtivosOk
      },
      sequencia: {
        pct: sequenciaPct,
        valueText: `${streak} ${streak === 1 ? 'dia' : 'dias'}`,
        label: 'Sequência atual',
        desc: 'Dias consecutivos em ação. A regularidade constrói hábitos sólidos.',
        ok: sequenciaOk
      },
      foco: {
        pct: focoPct,
        valueText: `${finalFocusCount} ${finalFocusCount === 1 ? 'sessão' : 'sessões'}`,
        label: 'Sessões de foco concluídas',
        desc: 'Períodos de concentração profunda no modo foco (Pomodoro).',
        ok: focoOk
      },
      tarefas: {
        pct: tarefasPct,
        valueText: `${completedTasksCount} de ${totalTasksCount}`,
        label: 'Tarefas finalizadas',
        desc: 'A proporção de tarefas concluídas em relação às criadas.',
        ok: tarefasOk
      },
      objetivos: {
        pct: objetivosPct,
        valueText: `${completedGoalsCount} concluídos`,
        label: 'Objetivos movimentados',
        desc: 'Progresso das suas grandes metas de longo prazo.',
        ok: objetivosOk
      },
      regularidade: {
        pct: regularidadePct,
        valueText: hasWeeklyPlan ? 'Planejado' : 'Pendente',
        label: 'Regularidade semanal',
        desc: 'Planejar sua semana no planejador acalma a mente e define o rumo.',
        ok: regularidadeOk
      }
    };

    // Mensagem motivacional amigável baseada em score
    let motivationalMessage = "Você está construindo seu ritmo. Continue com pequenos avanços!";
    if (consistencyScore >= 85) {
      motivationalMessage = "Incrível! Sua consistência está fantástica. Você está no controle absoluto da sua evolução.";
    } else if (consistencyScore >= 50) {
      motivationalMessage = "Pequenos avanços aumentam sua consistência. Mantenha o foco!";
    } else if (consistencyScore > 0) {
      motivationalMessage = "Você está definindo seu ritmo. Cada pequena ação conta para sua evolução!";
    } else {
      motivationalMessage = "Sua jornada de evolução começa agora. Defina uma tarefa ou objetivo para iniciar!";
    }

    return { positives, negatives, breakdown, motivationalMessage };
  }, [tasks, habits, habitLogs, goals, goalTasks, currentUser, userState, consistencyScore]);

  // ═══════════════════════════════════════════════════════════════════════════
  // VISIBLE DATA & HIDDEN COUNTS (SaaS History Limits)
  // ═══════════════════════════════════════════════════════════════════════════
  const visibleTasks = useMemo(() => {
    const activeTasks = tasks.filter(t => !t.deletedAt && !t.deleted_at);
    if (isPro) return activeTasks;
    const limit = APP_MOUNT_TIME - 30 * 24 * 60 * 60 * 1000;
    return activeTasks.filter(task => {
      const dateStr = task.completedAt || task.dueDate || task.createdAt;
      if (!dateStr) return true;
      const time = new Date(dateStr).getTime();
      return time >= limit || time > APP_MOUNT_TIME;
    });
  }, [tasks, isPro]);

  const visibleGoals = useMemo(() => {
    const activeGoals = goals.filter(g => !g.deletedAt && !g.deleted_at);
    if (isPro) return activeGoals;
    const limit = APP_MOUNT_TIME - 30 * 24 * 60 * 60 * 1000;
    return activeGoals.filter(goal => {
      const dateStr = goal.updated_at || goal.created_at;
      if (!dateStr) return true;
      const time = new Date(dateStr).getTime();
      return time >= limit || time > APP_MOUNT_TIME;
    });
  }, [goals, isPro]);

  const hiddenTasksCount = useMemo(() => {
    if (isPro) return 0;
    const activeTasks = tasks.filter(t => !t.deletedAt && !t.deleted_at);
    return activeTasks.length - visibleTasks.length;
  }, [tasks, visibleTasks, isPro]);

  const hiddenGoalsCount = useMemo(() => {
    if (isPro) return 0;
    const activeGoals = goals.filter(g => !g.deletedAt && !g.deleted_at);
    return activeGoals.length - visibleGoals.length;
  }, [goals, visibleGoals, isPro]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════════════════════
  const value = {
    // Auth
    currentUser,
    setCurrentUser,
    isInitializing,
    handleLoginSuccess,
    handleLogout,
    handleStartDemoMode,

    // Navigation
    activeTab,
    setActiveTab: handleSetActiveTab,
    shouldOpenGoalModal,
    setShouldOpenGoalModal,
    shouldOpenTaskModal,
    setShouldOpenTaskModal,
    activeEvoTab,
    setActiveEvoTab,
    coachPeriodicity,
    setCoachPeriodicity,
    selectedGoalIdFilter,
    setSelectedGoalIdFilter,

    // Theme
    theme,
    setTheme,
    appBgColor,
    setAppBgColor,

    // Data
    tasks: visibleTasks,
    goals: visibleGoals,
    allTasks: tasks,
    allGoals: goals,
    deletedTasks: tasks.filter(t => t.deletedAt || t.deleted_at),
    deletedGoals: goals.filter(g => g.deletedAt || g.deleted_at),
    goalTasks,
    unlockedAchievements,
    toastQueue,
    dismissToast,
    focusEvents,

    // Notificações
    notifications,
    addNotification,
    markNotificationsAsRead,
    clearNotifications,

    // Undo Action
    undoAction,
    triggerUndo,

    // Tasks actions
    handleAddTask,
    handleUpdateTask,
    handleDeleteTask,
    handleBulkDeleteCompleted,
    handleDeleteAllTasks,
    handleResetAllData,
    handleToggleComplete,
    handleRestoreTask,
    handleDeleteTaskPermanent,

    // Goals actions
    handleAddGoal,
    handleUpdateGoal,
    handleDeleteGoal,
    handleBulkDeleteCompletedGoals,
    handleDeleteAllGoals,
    handleLinkTask,
    handleUnlinkTask,
    handleRestoreGoal,
    handleDeleteGoalPermanent,
    handleEmptyTrash,

    // Habits
    habitsManager,

    // SaaS additions
    isPro,
    isAccessChecked,
    isAdmin,
    categories,
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    logEvent,
    consistencyScore,
    consistencyScoreExplanation,
    handleCompleteOnboarding,
    supabaseConfigError,

    // Paywall and billing state/actions
    isPaywallOpen,
    paywallSource,
    subscriptionStatus,
    subscriptionPlan,
    subscriptionDetails,
    hiddenTasksCount,
    hiddenGoalsCount,
    openPaywall,
    closePaywall,
    handleCancelSubscription,
    checkServerAccess,
    churnScore,
    churnRisk,

    // Profiles additions
    userProfile,
    handleUpdateProfile,
    handleUpdateProfileFields,
    handleUploadAvatar,
    handleDeleteAvatar,
    logAuthEvent,

    // Sync / Resiliência
    syncStatus,
    syncWarnings,

    // Settings state
    settingsTab,
    setSettingsTab,

    // Audio global states
    ambientSoundFile,
    setAmbientSoundFile,
    ambientSoundVolume,
    setAmbientSoundVolume,
    isAmbientPlaying,
    setIsAmbientPlaying,
    audioBlocked,
    setAudioBlocked,

    // Duplications
    handleDuplicateGoal,
    handleDuplicateTask,

    // Growth & Intelligence
    userState,
    insights,
    suggestions,
    growthPet,
    handleSelectGrowthPet,
    getLevelFromCount,
    celebrationState,
    closeCelebration,

    // Custom Dialogs & Reactivation
    openCustomAlert,
    openCustomConfirm
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <AccountReactivationModal
        isOpen={showReactivationModal}
        deletedAt={pendingDeletionDate}
        onReactivate={handleReactivateAccount}
        onConfirmDeletion={handleConfirmDeletion}
      />
      <CustomDialogModal
        isOpen={dialogConfig.isOpen}
        type={dialogConfig.type}
        title={dialogConfig.title}
        message={dialogConfig.message}
        confirmText={dialogConfig.confirmText}
        cancelText={dialogConfig.cancelText}
        onConfirm={dialogConfig.onConfirm}
        onCancel={dialogConfig.onCancel}
      />
    </AppContext.Provider>
  );
}

