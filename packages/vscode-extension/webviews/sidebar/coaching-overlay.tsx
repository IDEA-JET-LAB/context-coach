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

  const containerStyle: React.CSSProperties = {
    maxWidth: '320px',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    fontFamily: 'var(--ctx-font-family)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    backgroundColor: colors.bg,
    borderBottom: `1px solid ${colors.accent}20`,
  };

  const iconStyle: React.CSSProperties = {
    flexShrink: 0,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--ctx-foreground)',
  };

  const bodyStyle: React.CSSProperties = {
    padding: '12px',
  };

  const messageStyle: React.CSSProperties = {
    fontSize: '11px',
    lineHeight: '1.5',
    color: 'var(--ctx-foreground)',
    marginBottom: example ? '12px' : '0',
  };

  const exampleContainerStyle: React.CSSProperties = {
    backgroundColor: 'var(--ctx-background)',
    borderRadius: '4px',
    padding: '10px',
    marginBottom: '12px',
  };

  const exampleLabelStyle: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ctx-foreground-muted)',
    marginBottom: '4px',
  };

  const exampleTextStyle: React.CSSProperties = {
    fontSize: '11px',
    fontFamily: 'var(--ctx-font-mono)',
    lineHeight: '1.4',
    color: 'var(--ctx-foreground)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  const beforeStyle: React.CSSProperties = {
    ...exampleTextStyle,
    textDecoration: 'line-through',
    opacity: 0.6,
  };

  const afterStyle: React.CSSProperties = {
    ...exampleTextStyle,
    color: colors.accent,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    paddingTop: '8px',
    borderTop: '1px solid var(--ctx-border-subtle)',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 500,
    borderRadius: '3px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 100ms ease',
  };

  const applyButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: colors.accent,
    color: '#fff',
  };

  const learnMoreStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'transparent',
    color: 'var(--ctx-link)',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={iconStyle}>
          <CoachingIcon size={14} color={colors.accent} />
        </div>
        <span style={titleStyle}>{title}</span>
      </div>
      <div style={bodyStyle}>
        <p style={messageStyle}>{message}</p>

        {example && (
          <div style={exampleContainerStyle}>
            <div style={{ marginBottom: '8px' }}>
              <div style={exampleLabelStyle}>Before</div>
              <div style={beforeStyle}>{example.before}</div>
            </div>
            <div>
              <div style={exampleLabelStyle}>After</div>
              <div style={afterStyle}>{example.after}</div>
            </div>
          </div>
        )}

        {(onApply || onLearnMore) && (
          <div style={actionsStyle}>
            {onApply && (
              <button style={applyButtonStyle} onClick={onApply}>
                Apply Fix
              </button>
            )}
            {onLearnMore && (
              <button style={learnMoreStyle} onClick={onLearnMore}>
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

  const containerStyle: React.CSSProperties = {
    fontFamily: 'var(--ctx-font-mono)',
    fontSize: '13px',
    lineHeight: '1.6',
    padding: '12px',
    backgroundColor: 'var(--ctx-surface)',
    borderRadius: '4px',
  };

  let decoratedText: React.ReactNode;

  switch (type) {
    case 'underline':
      decoratedText = (
        <span
          style={{
            borderBottom: `2px wavy ${color}`,
            paddingBottom: '2px',
          }}
        >
          {text}
        </span>
      );
      break;
    case 'highlight':
      decoratedText = (
        <span
          style={{
            backgroundColor: `${color}20`,
            borderRadius: '2px',
            padding: '0 2px',
          }}
        >
          {text}
        </span>
      );
      break;
    case 'gutter':
      decoratedText = (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div
            style={{
              width: '4px',
              height: '100%',
              minHeight: '20px',
              backgroundColor: color,
              borderRadius: '2px',
              flexShrink: 0,
            }}
          />
          <span>{text}</span>
        </div>
      );
      break;
    default:
      decoratedText = text;
  }

  return <div style={containerStyle}>{decoratedText}</div>;
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
  const containerStyle: React.CSSProperties = {
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border)',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    minWidth: '200px',
  };

  const headerStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ctx-foreground-muted)',
    backgroundColor: 'var(--ctx-background)',
    borderBottom: '1px solid var(--ctx-border-subtle)',
  };

  const itemStyle = (isPreferred: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '8px 10px',
    cursor: 'pointer',
    backgroundColor: isPreferred ? 'var(--ctx-score-growth-bg)' : 'transparent',
    borderLeft: isPreferred ? '3px solid var(--ctx-score-growth)' : '3px solid transparent',
    transition: 'all 100ms ease',
  });

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--ctx-foreground)',
  };

  const descStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--ctx-foreground-muted)',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Quick Fixes</div>
      {fixes.map((fix, index) => (
        <div
          key={fix.id}
          style={itemStyle(fix.isPreferred || false)}
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
          <span style={labelStyle}>
            {fix.isPreferred && <span style={{ color: 'var(--ctx-score-growth)' }}>★ </span>}
            {fix.label}
          </span>
          {fix.description && <span style={descStyle}>{fix.description}</span>}
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

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    backgroundColor: 'var(--ctx-score-growth-bg)',
    borderRadius: '4px',
    fontSize: '11px',
    color: 'var(--ctx-foreground)',
  };

  const spinnerStyle: React.CSSProperties = {
    width: '12px',
    height: '12px',
    border: '2px solid var(--ctx-score-growth)30',
    borderTopColor: 'var(--ctx-score-growth)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  };

  const progressBarStyle: React.CSSProperties = {
    flex: 1,
    height: '3px',
    backgroundColor: 'var(--ctx-score-growth)30',
    borderRadius: '2px',
    overflow: 'hidden',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    width: progress !== undefined ? `${progress}%` : '30%',
    backgroundColor: 'var(--ctx-score-growth)',
    borderRadius: '2px',
    transition: 'width 200ms ease',
    animation: progress === undefined ? 'indeterminate 1.5s ease-in-out infinite' : 'none',
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
      <div style={containerStyle}>
        <div style={spinnerStyle} />
        <span>{message}</span>
        {progress !== undefined && (
          <div style={progressBarStyle}>
            <div style={progressFillStyle} />
          </div>
        )}
      </div>
    </>
  );
};

export default HoverCard;
