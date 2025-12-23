'use client';

import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

export interface WeightSliderProps {
  /** Label for the weight */
  label: string;
  /** Current value (0-100) */
  value: number;
  /** Change handler */
  onChange: (value: number) => void;
  /** Optional description */
  description?: string;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Whether to show the percentage value */
  showValue?: boolean;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

export function WeightSlider({
  label,
  value,
  onChange,
  description,
  min = 0,
  max = 100,
  step = 1,
  showValue = true,
  disabled = false,
  className,
}: WeightSliderProps) {
  return (
    <div className={cn('space-y-3', className)} data-testid="weight-slider">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-foreground">
          {label}
        </Label>
        {showValue && (
          <span className="text-sm font-medium text-primary" data-testid="weight-value">
            {value}%
          </span>
        )}
      </div>
      <Slider
        value={[value]}
        onValueChange={([newValue]) => onChange(newValue ?? value)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full"
      />
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
