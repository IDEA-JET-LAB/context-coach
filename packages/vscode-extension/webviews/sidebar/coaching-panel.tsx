import React, { useState } from 'react';
import { SuggestionCard, SuggestionType, SparklesIcon, ChevronDownIcon, HistoryIcon } from '../components';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  message: string;
  details?: string;
  createdAt: Date | string;
}

export interface CoachingPanelProps {
  suggestions?: Suggestion[];
  dismissedSuggestions?: Suggestion[];
  isLoading?: boolean;
  isMinimized?: boolean;
  onApply?: (suggestionId: string) => void;
  onDismiss?: (suggestionId: string) => void;
  onToggleMinimize?: () => void;
}

// Loading skeleton
const LoadingSkeleton: React.FC = () => {
  const skeletonStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--ctx-surface) 0%, var(--ctx-surface-hover) 50%, var(--ctx-surface) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s ease-in-out infinite',
    borderRadius: '4px',
  };

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div>
        <div style={{ ...skeletonStyle, width: '120px', height: '10px', marginBottom: '12px' }} />
        {[1, 2].map((i) => (
          <div key={i} style={{ ...skeletonStyle, height: '80px', marginBottom: '8px' }} />
        ))}
      </div>
    </>
  );
};

// Empty state component
const EmptyState: React.FC = () => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '32px 16px',
    color: 'var(--ctx-foreground-muted)',
  };

  const iconStyle: React.CSSProperties = {
    marginBottom: '16px',
    opacity: 0.5,
    animation: 'pulse 2s ease-in-out infinite',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--ctx-foreground)',
    marginBottom: '8px',
  };

  const descStyle: React.CSSProperties = {
    fontSize: '11px',
    lineHeight: '1.5',
    maxWidth: '180px',
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
      <div style={containerStyle}>
        <div style={iconStyle}>
          <SparklesIcon size={48} color="var(--ctx-foreground-muted)" />
        </div>
        <h3 style={titleStyle}>No suggestions yet</h3>
        <p style={descStyle}>
          Coaching tips will appear here as you work to help improve your prompting skills.
        </p>
      </div>
    </>
  );
};

// Minimized badge view
const MinimizedBadge: React.FC<{ count: number; onClick?: () => void }> = ({ count, onClick }) => {
  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'var(--ctx-badge-bg)',
    color: 'var(--ctx-badge-fg)',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 100ms ease',
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <button
        style={badgeStyle}
        onClick={onClick}
        aria-label={`${count} coaching suggestions. Click to expand.`}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <SparklesIcon size={12} />
        {count} {count === 1 ? 'suggestion' : 'suggestions'}
      </button>
    </div>
  );
};

export const CoachingPanel: React.FC<CoachingPanelProps> = ({
  suggestions = [],
  dismissedSuggestions = [],
  isLoading = false,
  isMinimized = false,
  onApply,
  onDismiss,
  onToggleMinimize,
}) => {
  const [showHistory, setShowHistory] = useState(false);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (suggestions.length === 0 && dismissedSuggestions.length === 0) {
    return <EmptyState />;
  }

  if (isMinimized && suggestions.length > 0) {
    return <MinimizedBadge count={suggestions.length} onClick={onToggleMinimize} />;
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ctx-foreground-muted)',
  };

  const badgeCountStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '18px',
    height: '18px',
    padding: '0 5px',
    fontSize: '10px',
    fontWeight: 600,
    backgroundColor: 'var(--ctx-badge-bg)',
    color: 'var(--ctx-badge-fg)',
    borderRadius: '9px',
  };

  const collapsibleTriggerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '8px 0',
    background: 'transparent',
    border: 'none',
    color: 'var(--ctx-foreground-muted)',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    cursor: 'pointer',
    transition: 'color 100ms ease',
  };

  const chevronStyle: React.CSSProperties = {
    transition: 'transform 200ms ease',
    transform: showHistory ? 'rotate(180deg)' : 'rotate(0)',
  };

  return (
    <div>
      {/* Active Suggestions */}
      {suggestions.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>Active Suggestions</span>
            <span style={badgeCountStyle}>{suggestions.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                style={{
                  animation: 'slideInRight 200ms ease-out',
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: 'backwards',
                }}
              >
                <SuggestionCard
                  type={suggestion.type}
                  message={suggestion.message}
                  details={suggestion.details}
                  onApply={onApply ? () => onApply(suggestion.id) : undefined}
                  onDismiss={onDismiss ? () => onDismiss(suggestion.id) : undefined}
                  animateIn={index === 0}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty active state but has history */}
      {suggestions.length === 0 && dismissedSuggestions.length > 0 && (
        <div style={{
          textAlign: 'center',
          padding: '20px 16px',
          color: 'var(--ctx-foreground-muted)',
          fontSize: '12px',
        }}>
          <p style={{ marginBottom: '4px', fontWeight: 500, color: 'var(--ctx-foreground)' }}>
            All caught up!
          </p>
          <p>No active suggestions right now.</p>
        </div>
      )}

      {/* Dismissed/History Section */}
      {dismissedSuggestions.length > 0 && (
        <div style={{ borderTop: '1px solid var(--ctx-border-subtle)', paddingTop: '12px' }}>
          <button
            style={collapsibleTriggerStyle}
            onClick={() => setShowHistory(!showHistory)}
            aria-expanded={showHistory}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ctx-foreground)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ctx-foreground-muted)'; }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HistoryIcon size={12} />
              History ({dismissedSuggestions.length})
            </span>
            <span style={chevronStyle}>
              <ChevronDownIcon size={12} />
            </span>
          </button>

          {showHistory && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingTop: '8px',
                animation: 'slideUp 200ms ease-out',
              }}
            >
              {dismissedSuggestions.slice(0, 5).map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  type={suggestion.type}
                  message={suggestion.message}
                  isDismissed
                />
              ))}
              {dismissedSuggestions.length > 5 && (
                <p style={{
                  fontSize: '11px',
                  color: 'var(--ctx-foreground-muted)',
                  textAlign: 'center',
                  padding: '8px 0',
                }}>
                  +{dismissedSuggestions.length - 5} more in history
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CoachingPanel;
