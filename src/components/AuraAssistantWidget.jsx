import React from 'react';
import { Sparkles, AlertTriangle, TrendingUp, Lightbulb } from 'lucide-react';

export default function AuraAssistantWidget({ analysis, onActionClick }) {
  if (!analysis) return null;

  // Se não há análises para mostrar, não renderiza
  if (!analysis.nextBestAction && !analysis.risk && !analysis.summary && !analysis.insight) {
    return null;
  }

  return (
    <div className="aura-assistant-widget animate-fade-in">
      <div className="aura-assistant-header">
        <Sparkles size={16} className="aura-assistant-icon" />
        <span className="aura-assistant-title">Coach MyFlowDay</span>
      </div>

      <div className="aura-assistant-body">
        {analysis.nextBestAction && (
          <div className="aura-card-item aura-action">
            <div className="aura-card-header">Melhor ação agora</div>
            <div className="aura-card-content">
              <span className="aura-card-text">{analysis.nextBestAction.message}</span>
              {analysis.nextBestAction.goal && (
                <span className="aura-card-subtext">Contribui para: {analysis.nextBestAction.goal.title}</span>
              )}
            </div>
            <button 
              className="aura-action-btn"
              onClick={() => onActionClick && onActionClick(analysis.nextBestAction.task)}
            >
              Começar
            </button>
          </div>
        )}

        {analysis.risk && (
          <div className="aura-card-item aura-risk" style={{ flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertTriangle size={15} className="aura-item-icon" style={{ marginTop: '2px' }} />
              <span className="aura-card-text">{analysis.risk.message}</span>
            </div>

            {analysis.risk.type === 'overdue' && analysis.risk.tasks && analysis.risk.tasks.length > 0 && (
              <div className="aura-overdue-tasks-list" style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                {analysis.risk.tasks.map(task => (
                  <div key={task.id} className="aura-overdue-task-card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    gap: '12px'
                  }}>
                    <span className="aura-overdue-task-title" style={{ fontSize: '12px', fontWeight: '550', color: 'var(--text-main)', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={task.title}>
                      {task.title}
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button 
                        onClick={() => onActionClick && onActionClick(task, 'today')}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--primary)',
                          color: 'var(--bg-app)',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        Hoje
                      </button>
                      <button 
                        onClick={() => onActionClick && onActionClick(task, 'tomorrow')}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-card-hover)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-medium)',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        Amanhã
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="aura-horizontal-row">
          {analysis.summary && (
            <div className="aura-card-item aura-summary">
              <TrendingUp size={15} className="aura-item-icon" />
              <span className="aura-card-text">{analysis.summary.message}</span>
            </div>
          )}

          {analysis.insight && (
            <div className="aura-card-item aura-insight">
              <Lightbulb size={15} className="aura-item-icon" />
              <span className="aura-card-text">{analysis.insight.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
