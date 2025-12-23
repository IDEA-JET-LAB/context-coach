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

/**
 * Dimension color configuration for badges
 */
const dimensionColors: Record<string, string> = {
  clarity: '#3b82f6',
  context: '#8b5cf6',
  specificity: '#10b981',
  actionability: '#f59e0b',
  efficiency: '#ef4444',
};

/**
 * Gets badge background color for a dimension
 */
function getDimensionColor(dimension: string): string {
  return dimensionColors[dimension.toLowerCase()] || '#6b7280';
}

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
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--ctx-background)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid var(--ctx-border-subtle)',
    flexShrink: 0,
  };

  const backButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--ctx-radius-sm)',
    color: 'var(--ctx-foreground-muted)',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 100ms ease',
  };

  const closeButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--ctx-radius-sm)',
    color: 'var(--ctx-foreground-muted)',
    cursor: 'pointer',
    transition: 'all 100ms ease',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ctx-foreground-muted)',
    marginBottom: '12px',
  };

  const promptTextStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border-subtle)',
    borderRadius: 'var(--ctx-radius)',
    fontSize: '12px',
    lineHeight: '1.5',
    color: 'var(--ctx-foreground)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '150px',
    overflowY: 'auto',
  };

  const scoreHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  };

  const timestampStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--ctx-foreground-muted)',
  };

  const dimensionsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const suggestionCardStyle = (type: 'reinforcement' | 'improvement'): React.CSSProperties => ({
    padding: '10px 12px',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border-subtle)',
    borderLeft: `3px solid ${type === 'reinforcement' ? 'var(--ctx-score-high)' : 'var(--ctx-score-medium)'}`,
    borderRadius: 'var(--ctx-radius)',
    marginBottom: '8px',
  });

  const suggestionDimensionStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--ctx-foreground-muted)',
    marginBottom: '4px',
  };

  const suggestionMessageStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--ctx-foreground)',
    lineHeight: '1.4',
  };

  const suggestionExampleStyle: React.CSSProperties = {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: 'var(--ctx-background)',
    borderRadius: 'var(--ctx-radius-sm)',
    fontSize: '11px',
    fontFamily: 'var(--ctx-font-mono)',
    color: 'var(--ctx-foreground-muted)',
    whiteSpace: 'pre-wrap',
  };

  // Convert score from 0-100 to 0-10 for ScoreBadge
  const normalizedScore = score / 10;

  return (
    <div className={className} style={containerStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <button
          style={backButtonStyle}
          onClick={onClose}
          aria-label="Back to analytics"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--ctx-foreground)';
            e.currentTarget.style.backgroundColor = 'var(--ctx-surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ctx-foreground-muted)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <ChevronLeftIcon size={14} />
          <span>Back</span>
        </button>
        <button
          style={closeButtonStyle}
          onClick={onClose}
          aria-label="Close"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--ctx-foreground)';
            e.currentTarget.style.backgroundColor = 'var(--ctx-surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ctx-foreground-muted)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <XIcon size={14} />
        </button>
      </header>

      {/* Content */}
      <div style={contentStyle}>
        {/* Score Header */}
        <div style={scoreHeaderStyle}>
          <ScoreBadge score={normalizedScore} size="lg" showLabel />
          <span style={timestampStyle}>{formatDate(timestamp)}</span>
        </div>

        {/* Prompt Text */}
        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Prompt</h3>
          <div style={promptTextStyle}>{text}</div>
        </section>

        {/* Dimension Scores */}
        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Dimension Scores</h3>
          <div style={dimensionsContainerStyle} role="list">
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
          <section style={sectionStyle}>
            <h3 style={{
              ...sectionTitleStyle,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <SparklesIcon size={12} />
              Improvement Suggestions
            </h3>

            {/* Group suggestions by type */}
            {suggestions.filter(s => s.type === 'reinforcement').length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--ctx-score-high, #22c55e)',
                  marginBottom: '8px',
                }}>
                  What you did well
                </div>
                {suggestions.filter(s => s.type === 'reinforcement').map((suggestion, index) => {
                  const dimColor = getDimensionColor(suggestion.dimension);
                  return (
                    <div key={`reinforce-${index}`} style={{
                      ...suggestionCardStyle(suggestion.type),
                      borderLeftColor: 'var(--ctx-score-high, #22c55e)',
                    }}>
                      <div style={{
                        display: 'inline-block',
                        fontSize: '9px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '2px 6px',
                        borderRadius: '2px',
                        backgroundColor: `${dimColor}20`,
                        color: dimColor,
                        marginBottom: '4px',
                      }}>
                        {capitalize(suggestion.dimension)}
                      </div>
                      <p style={suggestionMessageStyle}>{suggestion.message}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {suggestions.filter(s => s.type === 'improvement').length > 0 && (
              <div>
                <div style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--ctx-score-medium, #f59e0b)',
                  marginBottom: '8px',
                }}>
                  Opportunities to improve
                </div>
                {suggestions.filter(s => s.type === 'improvement').map((suggestion, index) => {
                  const actualIndex = suggestions.findIndex(s => s === suggestion);
                  const isExpanded = expandedSuggestions.has(actualIndex);
                  const dimColor = getDimensionColor(suggestion.dimension);

                  return (
                    <div key={`improve-${index}`} style={{
                      ...suggestionCardStyle(suggestion.type),
                      borderLeftColor: 'var(--ctx-score-medium, #f59e0b)',
                    }}>
                      <div style={{
                        display: 'inline-block',
                        fontSize: '9px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '2px 6px',
                        borderRadius: '2px',
                        backgroundColor: `${dimColor}20`,
                        color: dimColor,
                        marginBottom: '4px',
                      }}>
                        {capitalize(suggestion.dimension)}
                      </div>
                      <p style={suggestionMessageStyle}>{suggestion.message}</p>

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
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '10px',
                              color: 'var(--ctx-link, var(--vscode-textLink-foreground))',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              marginTop: '4px',
                            }}
                            aria-expanded={isExpanded}
                          >
                            <span style={{
                              transition: 'transform 150ms ease',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                            }}>
                              <ChevronDownIcon size={10} />
                            </span>
                            {isExpanded ? 'Hide' : 'Show'} improved example
                          </button>

                          {isExpanded && (
                            <div style={{
                              ...suggestionExampleStyle,
                              animation: 'fadeIn 150ms ease-out',
                            }}>
                              <style>{`
                                @keyframes fadeIn {
                                  from { opacity: 0; transform: translateY(-4px); }
                                  to { opacity: 1; transform: translateY(0); }
                                }
                              `}</style>
                              <div style={{
                                fontSize: '9px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: 'var(--ctx-score-high, #22c55e)',
                                marginBottom: '4px',
                              }}>
                                Improved version:
                              </div>
                              <code style={{
                                display: 'block',
                                color: 'var(--ctx-foreground)',
                                fontFamily: 'var(--ctx-font-mono)',
                                fontSize: '11px',
                                lineHeight: '1.4',
                              }}>
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
