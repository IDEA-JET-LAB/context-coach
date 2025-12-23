'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FolderSearch,
  FileCheck,
  Upload,
  Check,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

export type ImportStep = 'discover' | 'preview' | 'import' | 'complete';

export interface ImportModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Handler when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current import step */
  step?: ImportStep;
  /** Handler when step changes */
  onStepChange?: (step: ImportStep) => void;
  /** Content for the discovery step */
  discoveryContent?: React.ReactNode;
  /** Content for the preview step */
  previewContent?: React.ReactNode;
  /** Content for the import step */
  importContent?: React.ReactNode;
  /** Content for the completion step */
  completeContent?: React.ReactNode;
  /** Whether discovery step is ready to proceed */
  canProceedFromDiscovery?: boolean;
  /** Whether preview step is ready to proceed */
  canProceedFromPreview?: boolean;
  /** Handler for starting the import */
  onStartImport?: () => void;
  /** Handler when import completes */
  onComplete?: () => void;
  /** Additional class names */
  className?: string;
}

const steps: { id: ImportStep; label: string; icon: React.ElementType }[] = [
  { id: 'discover', label: 'Discover', icon: FolderSearch },
  { id: 'preview', label: 'Preview', icon: FileCheck },
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'complete', label: 'Done', icon: Check },
];

const stepIndex = (step: ImportStep): number => {
  const idx = steps.findIndex((s) => s.id === step);
  return idx >= 0 ? idx : 0;
};

export function ImportModal({
  open,
  onOpenChange,
  step: controlledStep,
  onStepChange,
  discoveryContent,
  previewContent,
  importContent,
  completeContent,
  canProceedFromDiscovery = false,
  canProceedFromPreview = false,
  onStartImport,
  onComplete,
  className,
}: ImportModalProps) {
  const [internalStep, setInternalStep] = useState<ImportStep>('discover');
  const currentStep = controlledStep ?? internalStep;
  const currentIndex = stepIndex(currentStep);

  const handleStepChange = useCallback(
    (newStep: ImportStep) => {
      if (onStepChange) {
        onStepChange(newStep);
      } else {
        setInternalStep(newStep);
      }
    },
    [onStepChange]
  );

  const handleNext = useCallback(() => {
    switch (currentStep) {
      case 'discover':
        handleStepChange('preview');
        break;
      case 'preview':
        handleStepChange('import');
        onStartImport?.();
        break;
      case 'import':
        handleStepChange('complete');
        break;
      case 'complete':
        onComplete?.();
        onOpenChange(false);
        break;
    }
  }, [currentStep, handleStepChange, onStartImport, onComplete, onOpenChange]);

  const handleBack = useCallback(() => {
    switch (currentStep) {
      case 'preview':
        handleStepChange('discover');
        break;
      case 'import':
        handleStepChange('preview');
        break;
    }
  }, [currentStep, handleStepChange]);

  const canGoBack = currentStep === 'preview';
  const canProceed =
    (currentStep === 'discover' && canProceedFromDiscovery) ||
    (currentStep === 'preview' && canProceedFromPreview) ||
    currentStep === 'import' ||
    currentStep === 'complete';

  const getButtonLabel = () => {
    switch (currentStep) {
      case 'discover':
        return 'Preview Selection';
      case 'preview':
        return 'Start Import';
      case 'complete':
        return 'Close';
      default:
        return 'Continue';
    }
  };

  const renderContent = () => {
    switch (currentStep) {
      case 'discover':
        return discoveryContent;
      case 'preview':
        return previewContent;
      case 'import':
        return importContent;
      case 'complete':
        return completeContent;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('max-w-3xl max-h-[85vh] overflow-hidden flex flex-col', className)}
        data-testid="import-modal"
      >
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">
            Import Transcripts
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Import your Claude Code conversation history
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="py-4 px-2" data-testid="import-steps">
          <div className="flex items-center justify-between">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isCompleted = idx < currentIndex;
              const isCurrent = s.id === currentStep;
              const isPending = idx > currentIndex;

              return (
                <div key={s.id} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                        isCompleted
                          ? 'border-score-high bg-score-high text-white'
                          : isCurrent
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-muted bg-background text-muted-foreground'
                      )}
                      data-testid={`step-${s.id}`}
                      data-status={isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium transition-colors',
                        isCurrent ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-3 transition-colors',
                        isCompleted ? 'bg-score-high' : 'bg-muted'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div
          className="flex-1 overflow-y-auto py-4 min-h-[300px]"
          data-testid="import-content"
        >
          {renderContent()}
        </div>

        {/* Footer Navigation */}
        {currentStep !== 'import' && (
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <div>
              {canGoBack && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  data-testid="import-back-button"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
            </div>
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              data-testid="import-next-button"
            >
              {getButtonLabel()}
              {currentStep !== 'complete' && <ArrowRight className="h-4 w-4 ml-2" />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Entry point button for triggering import
 */
export interface ImportTriggerButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost';
  /** Size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Additional class names */
  className?: string;
}

export function ImportTriggerButton({
  onClick,
  variant = 'outline',
  size = 'default',
  className,
}: ImportTriggerButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      className={cn('gap-2', className)}
      data-testid="import-trigger-button"
    >
      <Upload className="h-4 w-4" />
      Import History
    </Button>
  );
}
