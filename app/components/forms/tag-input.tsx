'use client';

import { useState, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface TagInputProps {
  /** Label for the input */
  label?: string;
  /** Current tags */
  value: string[];
  /** Change handler */
  onChange: (tags: string[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum number of tags */
  maxTags?: number;
  /** Whether tags should be unique */
  unique?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Additional class names */
  className?: string;
}

export function TagInput({
  label,
  value,
  onChange,
  placeholder = 'Type and press Enter',
  maxTags,
  unique = true,
  disabled = false,
  error,
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  const addTag = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;
    if (maxTags && value.length >= maxTags) return;
    if (unique && value.includes(trimmedValue)) return;

    onChange([...value, trimmedValue]);
    setInputValue('');
  };

  const removeTag = (index: number) => {
    const newTags = value.filter((_, i) => i !== index);
    onChange(newTags);
  };

  const canAddMore = !maxTags || value.length < maxTags;

  return (
    <div className={cn('space-y-2', className)} data-testid="tag-input">
      {label && (
        <Label className="text-sm font-medium text-foreground">{label}</Label>
      )}
      <div
        className={cn(
          'flex flex-wrap gap-2 p-2 min-h-[42px] rounded-md border bg-background',
          error ? 'border-destructive' : 'border-input',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {value.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-sm"
            data-testid={`tag-${index}`}
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="hover:bg-primary/20 rounded-sm p-0.5"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {canAddMore && !disabled && (
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder={value.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="flex-1 min-w-[120px] border-0 p-0 h-6 focus-visible:ring-0 focus-visible:ring-offset-0"
            data-testid="tag-input-field"
          />
        )}
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {maxTags && (
        <p className="text-xs text-muted-foreground">
          {value.length}/{maxTags} tags
        </p>
      )}
    </div>
  );
}
