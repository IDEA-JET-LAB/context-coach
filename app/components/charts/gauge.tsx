'use client';

import { cn } from '@/lib/utils';

export interface GaugeProps {
  /** Value between 0 and 10 */
  value: number;
  /** Optional label below the value */
  label?: string;
  /** Size of the gauge */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the numeric value */
  showValue?: boolean;
  /** Additional class names */
  className?: string;
}

const sizeConfig = {
  sm: { width: 80, strokeWidth: 6, fontSize: 'text-lg', labelSize: 'text-xs' },
  md: { width: 120, strokeWidth: 8, fontSize: 'text-2xl', labelSize: 'text-sm' },
  lg: { width: 160, strokeWidth: 10, fontSize: 'text-3xl', labelSize: 'text-base' },
};

function getScoreColor(value: number): string {
  if (value >= 7) return 'hsl(var(--score-high))';
  if (value >= 4) return 'hsl(var(--score-medium))';
  return 'hsl(var(--score-growth))';
}

export function Gauge({
  value,
  label,
  size = 'md',
  showValue = true,
  className,
}: GaugeProps) {
  const config = sizeConfig[size];
  const normalizedValue = Math.max(0, Math.min(10, value));
  const percentage = normalizedValue / 10;

  // SVG calculations for semi-circle gauge
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage);
  const cx = config.width / 2;
  const cy = config.width / 2;

  const scoreColor = getScoreColor(normalizedValue);

  return (
    <div
      className={cn('flex flex-col items-center', className)}
      data-testid="gauge"
      data-value={normalizedValue}
    >
      <div className="relative" style={{ width: config.width, height: config.width / 2 + 10 }}>
        <svg
          width={config.width}
          height={config.width / 2 + 10}
          viewBox={`0 0 ${config.width} ${config.width / 2 + 10}`}
          className="overflow-visible"
        >
          {/* Background arc */}
          <path
            d={`M ${config.strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${cy}`}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d={`M ${config.strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${cy}`}
            fill="none"
            stroke={scoreColor}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
          />
        </svg>
        {showValue && (
          <div
            className={cn(
              'absolute left-1/2 -translate-x-1/2 font-bold text-foreground',
              config.fontSize
            )}
            style={{ bottom: 0 }}
            data-testid="gauge-value"
          >
            {normalizedValue.toFixed(1)}
          </div>
        )}
      </div>
      {label && (
        <span
          className={cn('mt-1 text-muted-foreground', config.labelSize)}
          data-testid="gauge-label"
        >
          {label}
        </span>
      )}
    </div>
  );
}
