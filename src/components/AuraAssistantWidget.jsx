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
        <span className="aura-assistant-title">MyFlowDay Insights</span>
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
          <div className="aura-card-item aura-risk">
            <AlertTriangle size={15} className="aura-item-icon" />
            <span className="aura-card-text">{analysis.risk.message}</span>
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
