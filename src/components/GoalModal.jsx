import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { X, Plus, Trash2, Smile, Calendar, Clock, Target, Edit2 } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { useAppContext } from '../contexts/AppContext';

const COLORS = [
  { value: 'hsl(243, 75%, 59%)', label: 'Foco & Trabalho (Índigo)' },
  { value: 'hsl(162, 76%, 45%)', label: 'Saúde & Hábitos (Esmeralda)' },
  { value: 'hsl(217, 91%, 60%)', label: 'Crescimento & Estudos (Azul)' },
  { value: 'hsl(38, 92%, 50%)', label: 'Pessoal & Projetos (Âmbar)' },
  { value: 'hsl(322, 85%, 60%)', label: 'Bem-estar (Rosa)' },
  { value: 'hsl(280, 75%, 60%)', label: 'Mente (Roxo)' },
  { value: 'hsl(180, 75%, 40%)', label: 'Finanças (Ciano)' },
  { value: 'hsl(0, 75%, 60%)', label: 'Urgente (Vermelho)' },
];

const ICONS = [
  { value: 'target', label: 'Alvo' },
  { value: 'rocket', label: 'Foguete' },
  { value: 'book', label: 'Livro' },
  { value: 'dollar', label: 'Dinheiro' },
  { value: 'home', label: 'Casa' },
  { value: 'globe', label: 'Mundo' },
  { value: 'dumbbell', label: 'Exercício' },
  { value: 'brain', label: 'Mente' },
  { value: 'heart', label: 'Saúde' },
  { value: 'palette', label: 'Arte' },
  { value: 'music', label: 'Música' },
  { value: 'plane', label: 'Viagem' },
  { value: 'sprout', label: 'Crescimento' },
  { value: 'trending', label: 'Tendência' },
  { value: 'star', label: 'Destaque' },
  { value: 'users', label: 'Social' },
];

function GoalIcon({ name, size = 18, className = '' }) {
  if (!name) return null;
  const isEmoji = /\p{Emoji}/u.test(name) && !/^[a-zA-Z0-9-]+$/.test(name);
  if (isEmoji) {
    return <span className={className} role="img" aria-label="ícone">{name}</span>;
  }
  
  const iconMap = {
    target: LucideIcons.Target,
    rocket: LucideIcons.Rocket,
    book: LucideIcons.BookOpen,
    dollar: LucideIcons.DollarSign,
    home: LucideIcons.Home,
    globe: LucideIcons.Globe,
    dumbbell: LucideIcons.Dumbbell,
    brain: LucideIcons.Brain,
    heart: LucideIcons.Heart,
    palette: LucideIcons.Palette,
    music: LucideIcons.Music,
    plane: LucideIcons.Plane,
    sprout: LucideIcons.Sprout,
    trending: LucideIcons.TrendingUp,
    star: LucideIcons.Star,
    users: LucideIcons.Users,
  };

  const IconComponent = iconMap[name.toLowerCase()] || LucideIcons.Target;
  return <IconComponent size={size} className={className} />;
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function GoalModal({ isOpen, onClose, onSave, onDelete, editingGoal }) {
  const { currentUser, openCustomAlert } = useAppContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('hsl(243, 75%, 59%)');
  const [icon, setIcon] = useState('target');
  const [targetDate, setTargetDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [actions, setActions] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileToBase64 = (f) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });

      if (currentUser?.isDemo) {
        const base64Data = await fileToBase64(file);
        setAttachments(prev => [...prev, {
          name: file.name,
          url: base64Data,
          type: file.type,
          size: file.size,
          path: null
        }]);
        return;
      }

      const { goalsService } = await import('../services/goalsService');
      const result = await goalsService.uploadAttachment(currentUser.id, file);
      if (result.error) {
        console.warn('Erro no upload para Supabase, usando base64 local como fallback:', result.error);
        const base64Data = await fileToBase64(file);
        setAttachments(prev => [...prev, {
          name: file.name,
          url: base64Data,
          type: file.type,
          size: file.size,
          path: null
        }]);
      } else {
        setAttachments(prev => [...prev, {
          name: result.name,
          url: result.url,
          type: result.type,
          size: result.size,
          path: result.path
        }]);
      }
    } catch (err) {
      console.warn('Erro inesperado no upload, usando base64 local como fallback:', err);
      try {
        const fileToBase64 = (f) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(f);
          reader.onload = () => resolve(reader.result);
          reader.onerror = error => reject(error);
        });
        const base64Data = await fileToBase64(file);
        setAttachments(prev => [...prev, {
          name: file.name,
          url: base64Data,
          type: file.type,
          size: file.size,
          path: null
        }]);
      } catch (innerErr) {
        openCustomAlert('Erro ao processar arquivo local: ' + innerErr.message);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // Preenche o formulário ao editar
  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title || '');
      setDescription(editingGoal.description || '');
      setColor(editingGoal.color || 'hsl(243, 75%, 59%)');
      setIcon(editingGoal.icon || 'target');
      setTargetDate(editingGoal.target_date || '');
      setStartTime(editingGoal.start_time || '');
      setEndTime(editingGoal.end_time || '');
      setAttachments(editingGoal.attachments || []);
    } else {
      setTitle('');
      setDescription('');
      setColor('hsl(243, 75%, 59%)');
      setIcon('target');
      setTargetDate('');
      setStartTime('');
      setEndTime('');
      setActions([]);
      setAttachments([]);
    }
  }, [editingGoal, isOpen]);

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (!editingGoal && targetDate) {
      const todayStr = getLocalDateString();
      if (targetDate < todayStr) {
        openCustomAlert('Objetivos não podem ser criados em datas passadas.');
        return;
      }
    }

    if (startTime && endTime) {
      const start = new Date(`1970-01-01T${startTime}:00`);
      const end = new Date(`1970-01-01T${endTime}:00`);
      if (end <= start) {
        openCustomAlert('O horário final deve ser posterior ao horário inicial.');
        return;
      }
    }

    onSave({
      title: title.trim(),
      description: description.trim(),
      color,
      icon,
      target_date: targetDate || null,
      start_time: startTime || null,
      end_time: endTime || null,
      actions: actions.filter(a => a.trim() !== ''),
      attachments,
    });
  };

  const handleAddAction = () => {
    setActions([...actions, '']);
  };

  const handleActionChange = (index, value) => {
    const newActions = [...actions];
    newActions[index] = value;
    setActions(newActions);
  };

  const handleRemoveAction = (index) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content goal-modal animate-scale-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="todo-modal-header">
          <div className="tasks-modal-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="tasks-modal-icon" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--primary)' }}>
              {editingGoal ? <Edit2 size={18} /> : <Target size={18} />}
            </span>
            <h2 className="todo-modal-title">
              {editingGoal ? 'Editar Objetivo' : 'Novo Objetivo'}
            </h2>
          </div>
          <button onClick={onClose} className="todo-modal-close-btn" aria-label="Fechar modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="todo-modal-form">
          {/* Preview do objetivo */}
          <div className="goal-modal-preview" style={{ borderLeftColor: color }}>
            <span className="goal-modal-preview-icon" style={{ display: 'inline-flex', alignItems: 'center', color }}>
              <GoalIcon name={icon} size={24} />
            </span>
            <span className="goal-modal-preview-title">
              {title || 'Meu objetivo...'}
            </span>
          </div>

          {/* Título */}
          <div className="todo-form-group">
            <label className="todo-form-label" htmlFor="goal-title">Nome do Objetivo *</label>
            <input
              id="goal-title"
              type="text"
              placeholder="Ex: Inglês Fluente, Reserva de Emergência..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="todo-modal-input"
              required
              autoFocus
            />
          </div>

          {/* Descrição */}
          <div className="todo-form-group">
            <label className="todo-form-label" htmlFor="goal-desc">Descrição / Motivação (opcional)</label>
            <textarea
              id="goal-desc"
              placeholder="Por que esse objetivo é importante para você?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="todo-modal-textarea"
            />
          </div>

          {/* Anexos */}
          <div className="todo-form-group" style={{ marginBottom: '16px' }}>
            <label className="todo-form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <LucideIcons.Paperclip size={14} />
              <span>Anexos (imagens ou arquivos)</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="file" 
                onChange={handleFileChange} 
                disabled={uploading} 
                style={{ display: 'none' }} 
                id="goal-file-upload" 
              />
              <label 
                htmlFor="goal-file-upload" 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px dashed var(--border-medium)',
                  backgroundColor: 'var(--bg-app)',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  color: 'var(--text-light)',
                  textAlign: 'center',
                  justifyContent: 'center',
                  transition: 'border-color 0.2s'
                }}
              >
                {uploading ? (
                  'Fazendo upload...'
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <LucideIcons.Paperclip size={14} /> Escolher arquivo / imagem (Max 5MB)
                  </span>
                )}
              </label>

              {attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {attachments.map((file, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '6px 10px', 
                        borderRadius: 'var(--radius-sm)', 
                        backgroundColor: 'var(--primary-glow)', 
                        border: '1px solid var(--border-light)' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <LucideIcons.FileText size={14} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                          {file.name}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-light)' }}>
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveAttachment(idx)} 
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'var(--danger)', 
                          cursor: 'pointer', 
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Seleção de Ícone — Lucide Grid + Emoji Picker Fallback */}
          <div className="todo-form-group">
            <label className="todo-form-label">Ícone do Objetivo</label>
            <div className="goal-icon-grid" style={{ marginBottom: '8px' }}>
              {ICONS.map(i => {
                const isSelected = icon === i.value;
                return (
                  <button
                    key={i.value}
                    type="button"
                    onClick={() => setIcon(i.value)}
                    className={`goal-icon-btn ${isSelected ? 'selected' : ''}`}
                    title={i.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-app)',
                      cursor: 'pointer',
                      color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <GoalIcon name={i.value} size={18} />
                  </button>
                );
              })}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>Ou escolha um emoji personalizado:</span>
              <div style={{ position: 'relative' }} ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-app)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--text-main)',
                  }}
                >
                  <Smile size={14} style={{ color: 'var(--text-light)' }} />
                  <span>Outro emoji...</span>
                </button>
                {showEmojiPicker && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, left: 'auto', zIndex: 9999, marginTop: '4px', width: 'min(320px, 75vw)' }}>
                    <EmojiPicker
                      onEmojiClick={(emojiData) => {
                        setIcon(emojiData.emoji);
                        setShowEmojiPicker(false);
                      }}
                      autoFocusSearch={false}
                      lazyLoadEmojis={true}
                      height={350}
                      width="100%"
                      searchPlaceholder="Buscar emoji..."
                      previewConfig={{ showPreview: false }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seleção de Cor */}
          <div className="todo-form-group">
            <label className="todo-form-label">Cor do Objetivo</label>
            <div className="goal-color-grid">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`goal-color-btn ${color === c.value ? 'selected' : ''}`}
                  title={c.label}
                  style={{ backgroundColor: c.value }}
                >
                  {color === c.value && (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Data-alvo */}
          <div className="todo-form-group">
            <label className="todo-form-label" htmlFor="goal-date">Data-alvo (opcional)</label>
            <div className="todo-date-input-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
              <span className="todo-date-icon" style={{ left: '12px', position: 'absolute', color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center' }}>
                <Calendar size={14} />
              </span>
              <input
                id="goal-date"
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                min={getLocalDateString()}
                className="todo-modal-date-input"
              />
            </div>
          </div>

          {/* Horários */}
          <div className="todo-form-group" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 calc(50% - 8px)', minWidth: '140px' }}>
              <label className="todo-form-label" htmlFor="goal-start-time">Horário Inicial (opcional)</label>
              <div className="todo-date-input-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="todo-date-icon" style={{ left: '12px', position: 'absolute', color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center' }}>
                  <Clock size={14} />
                </span>
                <input
                  id="goal-start-time"
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="todo-modal-date-input"
                />
              </div>
            </div>
            <div style={{ flex: '1 1 calc(50% - 8px)', minWidth: '140px' }}>
              <label className="todo-form-label" htmlFor="goal-end-time">Horário Final (opcional)</label>
              <div className="todo-date-input-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="todo-date-icon" style={{ left: '12px', position: 'absolute', color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center' }}>
                  <Clock size={14} />
                </span>
                <input
                  id="goal-end-time"
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="todo-modal-date-input"
                />
              </div>
            </div>
          </div>

          {/* Ações (Tarefas vinculadas) dinâmico */}
          <div className="todo-form-group">
            <label className="todo-form-label">{editingGoal ? 'Incluir Novas Ações (Tarefas)' : 'Ações Iniciais (Tarefas)'}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {actions.map((action, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder={`Ação ${index + 1}`}
                    value={action}
                    onChange={(e) => handleActionChange(index, e.target.value)}
                    className="todo-modal-input"
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    onClick={() => handleRemoveAction(index)}
                    style={{ padding: '8px', background: 'transparent', color: 'var(--text-light)', border: 'none', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddAction}
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0' }}
              >
                <Plus size={14} /> Adicionar ação
              </button>
            </div>
          </div>

          {/* Ações */}
          <div className="todo-modal-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
            <div>
              {editingGoal && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="todo-modal-cancel-btn"
                  style={{ color: 'var(--danger)' }}
                >
                  <Trash2 size={16} style={{ marginRight: '6px' }} />
                  Excluir
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={onClose} className="todo-modal-cancel-btn">
                Cancelar
              </button>
              <button
                type="submit"
                className="todo-modal-save-btn btn-primary-glow"
                style={{ backgroundColor: color }}
              >
                {editingGoal ? 'Salvar Alterações' : 'Criar Objetivo'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
