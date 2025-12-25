import React, { useState } from 'react';
import {
  SuggestionCard,
  SuggestionType,
  SparklesIcon,
  ChevronDownIcon,
  HistoryIcon,
  CoachingSection,
  CoachingTip,
  WeakDimension,
} from '../components';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  message: string;
  details?: string;
  createdAt: Date | string;
}

export interface CoachingPanelProps {
  // Legacy suggestion format
  suggestions?: Suggestion[];
  dismissedSuggestions?: Suggestion[];
  // New coaching tips format (Story 19-5)
  coachingTips?: CoachingTip[];
  weakDimensions?: WeakDimension[];
  dismissedTips?: CoachingTip[];
  // Common props
  isLoading?: boolean;
  isMinimized?: boolean;
  onApply?: (suggestionId: string) => void;
  onDismiss?: (suggestionId: string) => void;
  onToggleMinimize?: () => void;
  onRefresh?: () => void;
}

// Loading skeleton
const LoadingSkeleton: React.FC = () => {
  return (
    <div>
      <div className="coaching-panel__loading-skeleton coaching-panel__skeleton-title" />
      {[1, 2].map((i) => (
        <div key={i} className="coaching-panel__loading-skeleton coaching-panel__skeleton-item" />
      ))}
    </div>
  );
};

// Empty state component
const EmptyState: React.FC = () => {
  return (
    <div className="coaching-panel__empty">
      <div className="coaching-panel__empty-icon">
        <SparklesIcon size={48} color="var(--ctx-foreground-muted)" />
      </div>
      <h3 className="coaching-panel__empty-title">No suggestions yet</h3>
      <p className="coaching-panel__empty-desc">
        Coaching tips will appear here as you work to help improve your prompting skills.
      </p>
    </div>
  );
};

// Minimized badge view
const MinimizedBadge: React.FC<{ count: number; onClick?: () => void }> = ({ count, onClick }) => {
  return (
    <div className="coaching-panel__minimized-container">
      <button
        className="coaching-panel__minimized-badge"
        onClick={onClick}
        aria-label={`${count} coaching suggestions. Click to expand.`}
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
  coachingTips = [],
  weakDimensions = [],
  dismissedTips = [],
  isLoading = false,
  isMinimized = false,
  onApply,
  onDismiss,
  onToggleMinimize,
  onRefresh,
}) => {
  const [showHistory, setShowHistory] = useState(false);

  // Use new coaching tips format if available, otherwise fall back to legacy suggestions
  const hasCoachingTips = coachingTips.length > 0 || weakDimensions.length > 0 || dismissedTips.length > 0;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // If using new coaching tips format
  if (hasCoachingTips) {
    const totalCount = coachingTips.length + weakDimensions.length;

    if (isMinimized && totalCount > 0) {
      return <MinimizedBadge count={totalCount} onClick={onToggleMinimize} />;
    }

    return (
      <CoachingSection
        tips={coachingTips}
        weakDimensions={weakDimensions}
        dismissedTips={dismissedTips}
        isLoading={isLoading}
        onDismiss={onDismiss}
        onRefresh={onRefresh}
      />
    );
  }

  // Legacy format handling
  if (suggestions.length === 0 && dismissedSuggestions.length === 0) {
    return <EmptyState />;
  }

  if (isMinimized && suggestions.length > 0) {
    return <MinimizedBadge count={suggestions.length} onClick={onToggleMinimize} />;
  }

  return (
    <div>
      {/* Active Suggestions */}
      {suggestions.length > 0 && (
        <div className="coaching-panel__section">
          <div className="coaching-panel__section-header">
            <span className="coaching-panel__section-title">Active Suggestions</span>
            <span className="coaching-panel__badge-count">{suggestions.length}</span>
          </div>
          <div className="coaching-panel__suggestions-list">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className="coaching-panel__suggestion-item"
                style={{ animationDelay: `${index * 50}ms` }}
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
        <div className="coaching-panel__all-caught-up">
          <p className="coaching-panel__all-caught-up-title">
            All caught up!
          </p>
          <p>No active suggestions right now.</p>
        </div>
      )}

      {/* Dismissed/History Section */}
      {dismissedSuggestions.length > 0 && (
        <div className="coaching-panel__history">
          <button
            className="coaching-panel__history-trigger"
            onClick={() => setShowHistory(!showHistory)}
            aria-expanded={showHistory}
          >
            <span className="coaching-panel__history-label">
              <HistoryIcon size={12} />
              History ({dismissedSuggestions.length})
            </span>
            <span className={`coaching-panel__history-chevron ${showHistory ? 'coaching-panel__history-chevron--expanded' : ''}`}>
              <ChevronDownIcon size={12} />
            </span>
          </button>

          {showHistory && (
            <div className="coaching-panel__history-list">
              {dismissedSuggestions.slice(0, 5).map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  type={suggestion.type}
                  message={suggestion.message}
                  isDismissed
                />
              ))}
              {dismissedSuggestions.length > 5 && (
                <p className="coaching-panel__history-more">
                  +{dismissedSuggestions.length - 5} more in history
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CoachingPanel;
