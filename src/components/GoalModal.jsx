import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Smile } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

const COLORS = [
  { value: '#4A654E', label: 'Verde Sálvia' },
  { value: '#9B6B5A', label: 'Terracota' },
  { value: '#5A6B7A', label: 'Azul Ardósia' },
  { value: '#B09060', label: 'Âmbar' },
  { value: '#8A6B8A', label: 'Malva' },
  { value: '#7A8A5A', label: 'Verde Oliva' },
  { value: '#6A6A9A', label: 'Índigo' },
  { value: '#6A6A6A', label: 'Chumbo' },
];

const ICONS = [
  '🎯', '🚀', '📚', '💰', '🏠', '🌍', '💪', '🧠',
  '❤️', '🎨', '🎵', '🏋️', '✈️', '🌱', '📈', '⭐',
];

export default function GoalModal({ isOpen, onClose, onSave, editingGoal }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4A654E');
  const [icon, setIcon] = useState('🎯');
  const [targetDate, setTargetDate] = useState('');
  const [actions, setActions] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  // Preenche o formulário ao editar
  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title || '');
      setDescription(editingGoal.description || '');
      setColor(editingGoal.color || '#4A654E');
      setIcon(editingGoal.icon || '🎯');
      setTargetDate(editingGoal.target_date || '');
    } else {
      setTitle('');
      setDescription('');
      setColor('#4A654E');
      setIcon('🎯');
      setTargetDate('');
      setActions([]);
    }
  }, [editingGoal, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      color,
      icon,
      target_date: targetDate || null,
      actions: actions.filter(a => a.trim() !== ''),
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
          <div className="tasks-modal-title-wrap">
            <span className="tasks-modal-icon">{editingGoal ? '✏️' : '🎯'}</span>
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
            <span className="goal-modal-preview-icon">{icon}</span>
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

          {/* Seleção de Ícone — Emoji Picker */}
          <div className="todo-form-group">
            <label className="todo-form-label">Ícone (Emoji)</label>
            <div style={{ position: 'relative' }} ref={emojiPickerRef}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-app)',
                  cursor: 'pointer',
                  fontSize: '22px',
                  color: 'var(--text-main)',
                  transition: 'all 0.15s',
                }}
                title="Selecionar emoji"
              >
                <span>{icon}</span>
                <Smile size={14} style={{ color: 'var(--text-light)', marginLeft: '4px' }} />
              </button>
              {showEmojiPicker && (
                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 9999, marginTop: '4px' }}>
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      setIcon(emojiData.emoji);
                      setShowEmojiPicker(false);
                    }}
                    autoFocusSearch={false}
                    lazyLoadEmojis={true}
                    height={380}
                    width={320}
                    searchPlaceholder="Buscar emoji..."
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              )}
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
            <div className="todo-date-input-wrapper">
              <span className="todo-date-icon" style={{ fontSize: '14px', left: '12px', position: 'absolute', color: 'var(--text-light)' }}>📅</span>
              <input
                id="goal-date"
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="todo-modal-date-input"
              />
            </div>
          </div>

          {/* Ações (Tarefas vinculadas) dinâmico */}
          {!editingGoal && (
            <div className="todo-form-group">
              <label className="todo-form-label">Ações Iniciais (Tarefas)</label>
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
          )}

          {/* Ações */}
          <div className="todo-modal-actions">
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
        </form>
      </div>
    </div>
  );
}
