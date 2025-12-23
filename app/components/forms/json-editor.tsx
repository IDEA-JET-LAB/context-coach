'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check } from 'lucide-react';

export interface JsonEditorProps {
  /** Label for the editor */
  label?: string;
  /** Current JSON value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Description/help text */
  description?: string;
  /** Number of rows */
  rows?: number;
  /** Whether to validate JSON */
  validate?: boolean;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

export function JsonEditor({
  label,
  value,
  onChange,
  description,
  rows = 10,
  validate = true,
  disabled = false,
  className,
}: JsonEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    if (!validate || !value.trim()) {
      setError(null);
      setIsValid(true);
      return;
    }

    try {
      JSON.parse(value);
      setError(null);
      setIsValid(true);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Invalid JSON');
      }
      setIsValid(false);
    }
  }, [value, validate]);

  const handleFormat = () => {
    if (!value.trim()) return;
    try {
      const parsed = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
    } catch {
      // Don't format invalid JSON
    }
  };

  return (
    <div className={cn('space-y-2', className)} data-testid="json-editor">
      <div className="flex items-center justify-between">
        {label && (
          <Label className="text-sm font-medium text-foreground">{label}</Label>
        )}
        <div className="flex items-center gap-2">
          {validate && value.trim() && (
            <div className="flex items-center gap-1">
              {isValid ? (
                <>
                  <Check className="h-4 w-4 text-score-high" />
                  <span className="text-xs text-score-high">Valid JSON</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-destructive">Invalid JSON</span>
                </>
              )}
            </div>
          )}
          {isValid && value.trim() && (
            <button
              type="button"
              onClick={handleFormat}
              className="text-xs text-primary hover:underline"
              disabled={disabled}
            >
              Format
            </button>
          )}
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        disabled={disabled}
        className={cn(
          'font-mono text-sm',
          error && 'border-destructive focus-visible:ring-destructive'
        )}
        placeholder='{"key": "value"}'
        data-testid="json-input"
      />
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {description && !error && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
