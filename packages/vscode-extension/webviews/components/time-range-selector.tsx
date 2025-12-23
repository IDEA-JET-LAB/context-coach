/**
 * TimeRangeSelector Component
 * Story 19-4: Real-time Analytics Display
 *
 * Segmented control for selecting time range (Today, 7 Days, 30 Days).
 */

import React from 'react';

export type TimeRange = '1d' | '7d' | '30d';

export interface TimeRangeSelectorProps {
  /** Currently selected time range */
  value: TimeRange;
  /** Callback when time range changes */
  onChange: (range: TimeRange) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
}

interface TimeRangeOption {
  value: TimeRange;
  label: string;
}

const options: TimeRangeOption[] = [
  { value: '1d', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border-subtle)',
    borderRadius: 'var(--ctx-radius)',
    padding: '2px',
    gap: '2px',
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
  };

  const buttonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '3px 8px',
    fontSize: '10px',
    fontWeight: 500,
    color: isActive ? 'var(--ctx-foreground)' : 'var(--ctx-foreground-muted)',
    backgroundColor: isActive ? 'var(--ctx-surface-hover)' : 'transparent',
    border: 'none',
    borderRadius: 'var(--ctx-radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 100ms ease',
    whiteSpace: 'nowrap',
  });

  const handleClick = (range: TimeRange) => {
    if (!disabled && range !== value) {
      onChange(range);
    }
  };

  return (
    <div
      className={className}
      style={containerStyle}
      role="tablist"
      aria-label="Select time period"
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isActive}
            aria-controls={`analytics-${option.value}`}
            style={buttonStyle(isActive)}
            onClick={() => handleClick(option.value)}
            disabled={disabled}
            onMouseEnter={(e) => {
              if (!isActive && !disabled) {
                e.currentTarget.style.color = 'var(--ctx-foreground)';
                e.currentTarget.style.backgroundColor = 'var(--ctx-surface-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive && !disabled) {
                e.currentTarget.style.color = 'var(--ctx-foreground-muted)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default TimeRangeSelector;
