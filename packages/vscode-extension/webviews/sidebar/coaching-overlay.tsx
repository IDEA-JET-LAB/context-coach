import React from 'react';
import { SuggestionType, CoachingIcon } from '../components';

/**
 * Real-time Coaching Overlay Components
 *
 * These components are designed for future integration with VS Code's
 * editor overlay and decoration APIs. They provide real-time feedback
 * on prompt quality as users type.
 *
 * Implementation Note (for Epic 20):
 * These will be rendered using VS Code's:
 * - TextEditorDecorationType for inline highlights
 * - Hover providers for suggestion previews
 * - Code actions for quick fixes
 */

// ============================================
// Hover Card for Suggestion Preview
// ============================================

export interface HoverCardProps {
  type: SuggestionType;
  title: string;
  message: string;
  example?: {
    before: string;
    after: string;
  };
  onApply?: () => void;
  onLearnMore?: () => void;
}

export const HoverCard: React.FC<HoverCardProps> = ({
  type,
  title,
  message,
  example,
  onApply,
  onLearnMore,
}) => {
  const typeColors = {
    improvement: {
      accent: 'var(--ctx-score-growth)',
      bg: 'var(--ctx-score-growth-bg)',
    },
    warning: {
      accent: 'var(--ctx-score-medium)',
      bg: 'var(--ctx-score-medium-bg)',
    },
    achievement: {
      accent: 'var(--ctx-score-high)',
      bg: 'var(--ctx-score-high-bg)',
    },
  };

  const colors = typeColors[type];

  return (
    <div className="coaching-hover-card">
      <div className={`coaching-hover-card__header coaching-hover-card__header--${type}`}>
        <div className="coaching-hover-card__icon">
          <CoachingIcon size={14} color={colors.accent} />
        </div>
        <span className="coaching-hover-card__title">{title}</span>
      </div>
      <div className="coaching-hover-card__body">
        <p className={`coaching-hover-card__message ${example ? 'coaching-hover-card__message--with-example' : ''}`}>
          {message}
        </p>

        {example && (
          <div className="coaching-hover-card__example">
            <div className="coaching-hover-card__example-section">
              <div className="coaching-hover-card__example-label">Before</div>
              <div className="coaching-hover-card__example-text coaching-hover-card__example-text--before">
                {example.before}
              </div>
            </div>
            <div className="coaching-hover-card__example-section">
              <div className="coaching-hover-card__example-label">After</div>
              <div
                className="coaching-hover-card__example-text coaching-hover-card__example-text--after"
                style={{ '--example-after-color': colors.accent } as React.CSSProperties}
              >
                {example.after}
              </div>
            </div>
          </div>
        )}

        {(onApply || onLearnMore) && (
          <div className="coaching-hover-card__actions">
            {onApply && (
              <button
                className="coaching-hover-card__button coaching-hover-card__button--apply"
                onClick={onApply}
                style={{ '--apply-button-bg': colors.accent } as React.CSSProperties}
              >
                Apply Fix
              </button>
            )}
            {onLearnMore && (
              <button
                className="coaching-hover-card__button coaching-hover-card__button--learn-more"
                onClick={onLearnMore}
              >
                Learn More
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Inline Decoration Preview
// ============================================

export interface InlineDecorationProps {
  type: 'underline' | 'highlight' | 'gutter';
  severity: 'info' | 'warning' | 'suggestion';
  text: string;
}

export const InlineDecorationPreview: React.FC<InlineDecorationProps> = ({
  type,
  severity,
  text,
}) => {
  const severityColors = {
    info: 'var(--ctx-score-growth)',
    warning: 'var(--ctx-score-medium)',
    suggestion: 'var(--ctx-score-high)',
  };

  const color = severityColors[severity];

  let decoratedText: React.ReactNode;

  switch (type) {
    case 'underline':
      decoratedText = (
        <span
          className="coaching-inline-decoration__underline"
          style={{ '--decoration-color': color } as React.CSSProperties}
        >
          {text}
        </span>
      );
      break;
    case 'highlight':
      decoratedText = (
        <span
          className="coaching-inline-decoration__highlight"
          style={{ '--decoration-bg': `${color}20` } as React.CSSProperties}
        >
          {text}
        </span>
      );
      break;
    case 'gutter':
      decoratedText = (
        <div className="coaching-inline-decoration__gutter">
          <div
            className="coaching-inline-decoration__gutter-bar"
            style={{ '--gutter-color': color } as React.CSSProperties}
          />
          <span>{text}</span>
        </div>
      );
      break;
    default:
      decoratedText = text;
  }

  return <div className="coaching-inline-decoration">{decoratedText}</div>;
};

// ============================================
// Quick Fix Action Pattern
// ============================================

export interface QuickFixProps {
  fixes: Array<{
    id: string;
    label: string;
    description?: string;
    isPreferred?: boolean;
  }>;
  onSelectFix: (fixId: string) => void;
}

export const QuickFixMenu: React.FC<QuickFixProps> = ({ fixes, onSelectFix }) => {
  return (
    <div className="coaching-quick-fix-menu">
      <div className="coaching-quick-fix-menu__header">Quick Fixes</div>
      {fixes.map((fix) => (
        <div
          key={fix.id}
          className={`coaching-quick-fix-menu__item ${fix.isPreferred ? 'coaching-quick-fix-menu__item--preferred' : ''}`}
          onClick={() => onSelectFix(fix.id)}
          onMouseEnter={(e) => {
            if (!fix.isPreferred) {
              e.currentTarget.style.backgroundColor = 'var(--ctx-surface-hover)';
            }
          }}
          onMouseLeave={(e) => {
            if (!fix.isPreferred) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onSelectFix(fix.id)}
        >
          <span className="coaching-quick-fix-menu__label">
            {fix.isPreferred && <span className="coaching-quick-fix-menu__star">★ </span>}
            {fix.label}
          </span>
          {fix.description && (
            <span className="coaching-quick-fix-menu__description">{fix.description}</span>
          )}
        </div>
      ))}
    </div>
  );
};

// ============================================
// Coaching Progress Indicator
// ============================================

export interface ProgressIndicatorProps {
  isAnalyzing: boolean;
  progress?: number;
  message?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  isAnalyzing,
  progress,
  message = 'Analyzing prompt...',
}) => {
  if (!isAnalyzing) return null;

  return (
    <div className="coaching-progress-indicator">
      <div className="coaching-progress-indicator__spinner" />
      <span>{message}</span>
      {progress !== undefined && (
        <div className="coaching-progress-indicator__progress-bar">
          <div
            className={`coaching-progress-indicator__progress-fill ${progress === undefined ? 'coaching-progress-indicator__progress-fill--indeterminate' : ''}`}
            style={{ width: progress !== undefined ? `${progress}%` : undefined }}
          />
        </div>
      )}
    </div>
  );
};

export default HoverCard;
