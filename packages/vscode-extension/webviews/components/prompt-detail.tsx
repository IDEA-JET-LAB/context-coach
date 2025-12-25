/**
 * PromptDetail Component
 * Story 19-4: Real-time Analytics Display
 * Story 19-5: Quick Coaching Tips - Enhanced suggestions display
 *
 * Modal/panel view for displaying full prompt analysis details.
 */

import React, { useState } from 'react';
import { ChevronLeftIcon, XIcon, ChevronDownIcon, SparklesIcon } from './icons';
import { DimensionScoreCard } from './dimension-score-card';
import { ScoreBadge } from './score-badge';
import { getDimensionColor, getDimensionBgColor, SCORE_COLORS } from '../shared/tokens';
import './prompt-detail.css';

export interface PromptSuggestion {
  dimension: string;
  type: 'reinforcement' | 'improvement';
  message: string;
  example?: string;
}

export interface PromptDetailProps {
  /** Prompt UUID */
  id: string;
  /** Full prompt text */
  text: string;
  /** Overall score (0-100) */
  score: number;
  /** Creation timestamp (ISO 8601) */
  timestamp: string;
  /** Individual dimension scores */
  dimensions: Record<string, number>;
  /** Improvement suggestions */
  suggestions: PromptSuggestion[];
  /** Callback to close the detail view */
  onClose: () => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Formats a timestamp to a readable date string.
 */
function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Capitalizes the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Note: Dimension colors are now imported from shared/tokens

export const PromptDetail: React.FC<PromptDetailProps> = ({
  text,
  score,
  timestamp,
  dimensions,
  suggestions,
  onClose,
  className = '',
}) => {
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<number>>(new Set());

  // Convert score from 0-100 to 0-10 for ScoreBadge
  const normalizedScore = score / 10;

  // CSS custom properties for dynamic colors (set on container)
  const customProperties = {
    '--prompt-detail-score-high': SCORE_COLORS.high,
    '--prompt-detail-score-medium': SCORE_COLORS.medium,
  } as React.CSSProperties;

  const containerClasses = ['prompt-detail', className].filter(Boolean).join(' ');

  return (
    <div className={containerClasses} style={customProperties}>
      {/* Header */}
      <header className="prompt-detail__header">
        <button
          className="prompt-detail__back-btn"
          onClick={onClose}
          aria-label="Back to analytics"
        >
          <ChevronLeftIcon size={14} />
          <span>Back</span>
        </button>
        <button
          className="prompt-detail__close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <XIcon size={14} />
        </button>
      </header>

      {/* Content */}
      <div className="prompt-detail__content">
        {/* Score Header */}
        <div className="prompt-detail__score-header">
          <ScoreBadge score={normalizedScore} size="lg" showLabel />
          <span className="prompt-detail__timestamp">{formatDate(timestamp)}</span>
        </div>

        {/* Prompt Text */}
        <section className="prompt-detail__section">
          <h3 className="prompt-detail__section-title">Prompt</h3>
          <div className="prompt-detail__text">{text}</div>
        </section>

        {/* Dimension Scores */}
        <section className="prompt-detail__section">
          <h3 className="prompt-detail__section-title">Dimension Scores</h3>
          <div className="prompt-detail__dimensions" role="list">
            {Object.entries(dimensions).map(([name, dimScore]) => (
              <DimensionScoreCard
                key={name}
                name={name}
                score={dimScore}
                size="sm"
              />
            ))}
          </div>
        </section>

        {/* Suggestions - Enhanced for Story 19-5 */}
        {suggestions.length > 0 && (
          <section className="prompt-detail__section">
            <h3 className="prompt-detail__section-title prompt-detail__section-title--with-icon">
              <SparklesIcon size={12} />
              Improvement Suggestions
            </h3>

            {/* Group suggestions by type */}
            {suggestions.filter(s => s.type === 'reinforcement').length > 0 && (
              <div className="prompt-detail__suggestions-group">
                <div className="prompt-detail__suggestions-group-title prompt-detail__suggestions-group-title--reinforcement">
                  What you did well
                </div>
                {suggestions.filter(s => s.type === 'reinforcement').map((suggestion, index) => {
                  const dimColor = getDimensionColor(suggestion.dimension);
                  const dimBgColor = getDimensionBgColor(suggestion.dimension);
                  const customProps = {
                    '--prompt-detail-dim-color': dimColor,
                    '--prompt-detail-dim-bg': dimBgColor,
                  } as React.CSSProperties;

                  return (
                    <div
                      key={`reinforce-${index}`}
                      className="prompt-detail__suggestion prompt-detail__suggestion--reinforcement"
                      style={customProps}
                    >
                      <div className="prompt-detail__suggestion-dimension">
                        {capitalize(suggestion.dimension)}
                      </div>
                      <p className="prompt-detail__suggestion-message">{suggestion.message}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {suggestions.filter(s => s.type === 'improvement').length > 0 && (
              <div className="prompt-detail__suggestions-group">
                <div className="prompt-detail__suggestions-group-title prompt-detail__suggestions-group-title--improvement">
                  Opportunities to improve
                </div>
                {suggestions.filter(s => s.type === 'improvement').map((suggestion, index) => {
                  const actualIndex = suggestions.findIndex(s => s === suggestion);
                  const isExpanded = expandedSuggestions.has(actualIndex);
                  const dimColor = getDimensionColor(suggestion.dimension);
                  const dimBgColor = getDimensionBgColor(suggestion.dimension);
                  const customProps = {
                    '--prompt-detail-dim-color': dimColor,
                    '--prompt-detail-dim-bg': dimBgColor,
                  } as React.CSSProperties;

                  return (
                    <div
                      key={`improve-${index}`}
                      className="prompt-detail__suggestion prompt-detail__suggestion--improvement"
                      style={customProps}
                    >
                      <div className="prompt-detail__suggestion-dimension">
                        {capitalize(suggestion.dimension)}
                      </div>
                      <p className="prompt-detail__suggestion-message">{suggestion.message}</p>

                      {suggestion.example && (
                        <>
                          <button
                            onClick={() => {
                              setExpandedSuggestions(prev => {
                                const next = new Set(prev);
                                if (next.has(actualIndex)) {
                                  next.delete(actualIndex);
                                } else {
                                  next.add(actualIndex);
                                }
                                return next;
                              });
                            }}
                            className="prompt-detail__example-toggle"
                            aria-expanded={isExpanded}
                          >
                            <span className={`prompt-detail__example-toggle-icon ${isExpanded ? 'prompt-detail__example-toggle-icon--expanded' : ''}`}>
                              <ChevronDownIcon size={10} />
                            </span>
                            {isExpanded ? 'Hide' : 'Show'} improved example
                          </button>

                          {isExpanded && (
                            <div className="prompt-detail__example">
                              <div className="prompt-detail__example-label">
                                Improved version:
                              </div>
                              <code className="prompt-detail__example-code">
                                {suggestion.example}
                              </code>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default PromptDetail;
