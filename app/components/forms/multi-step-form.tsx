'use client';

import { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export interface Step {
  id: string;
  title: string;
  description?: string;
}

export interface MultiStepFormProps {
  /** Form steps configuration */
  steps: Step[];
  /** Current step index (controlled) */
  currentStep?: number;
  /** Step change handler (controlled) */
  onStepChange?: (step: number) => void;
  /** Render function for step content */
  children: (props: { step: number; isFirst: boolean; isLast: boolean }) => ReactNode;
  /** Submit handler */
  onSubmit?: () => void;
  /** Whether to allow clicking on step indicators */
  clickableSteps?: boolean;
  /** Custom next button text */
  nextLabel?: string;
  /** Custom previous button text */
  prevLabel?: string;
  /** Custom submit button text */
  submitLabel?: string;
  /** Loading state for submit */
  submitting?: boolean;
  /** Additional class names */
  className?: string;
}

export function MultiStepForm({
  steps,
  currentStep: controlledStep,
  onStepChange,
  children,
  onSubmit,
  clickableSteps = false,
  nextLabel = 'Continue',
  prevLabel = 'Back',
  submitLabel = 'Submit',
  submitting = false,
  className,
}: MultiStepFormProps) {
  const [internalStep, setInternalStep] = useState(0);
  const currentStep = controlledStep ?? internalStep;

  const handleStepChange = (step: number) => {
    if (onStepChange) {
      onStepChange(step);
    } else {
      setInternalStep(step);
    }
  };

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onSubmit?.();
    } else {
      handleStepChange(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      handleStepChange(currentStep - 1);
    }
  };

  const handleStepClick = (index: number) => {
    if (clickableSteps && index <= currentStep) {
      handleStepChange(index);
    }
  };

  return (
    <div className={cn('space-y-6', className)} data-testid="multi-step-form">
      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={step.id} className="flex-1 flex items-center">
              <button
                type="button"
                onClick={() => handleStepClick(index)}
                disabled={!clickableSteps || index > currentStep}
                className={cn(
                  'relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                  isCompleted
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'border-primary bg-background text-primary'
                      : 'border-muted bg-background text-muted-foreground',
                  clickableSteps && index <= currentStep && 'cursor-pointer hover:bg-muted'
                )}
                data-testid={`step-indicator-${index}`}
                data-status={isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2',
                    isCompleted ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step title and description */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">
          {steps[currentStep]?.title}
        </h3>
        {steps[currentStep]?.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {steps[currentStep]?.description}
          </p>
        )}
      </div>

      {/* Step content */}
      <div className="min-h-[200px]" data-testid="step-content">
        {children({ step: currentStep, isFirst, isLast })}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrev}
          disabled={isFirst}
          data-testid="prev-button"
        >
          {prevLabel}
        </Button>
        <span className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {steps.length}
        </span>
        <Button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          data-testid={isLast ? 'submit-button' : 'next-button'}
        >
          {submitting ? 'Submitting...' : isLast ? submitLabel : nextLabel}
        </Button>
      </div>
    </div>
  );
}
