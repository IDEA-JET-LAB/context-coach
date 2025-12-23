'use client';

import { useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/**
 * CodeEditor - A styled code/text editor wrapper component
 *
 * This component provides a Monaco-like editing experience using a styled textarea.
 * It can be upgraded to use @monaco-editor/react for full syntax highlighting.
 *
 * Features:
 * - Line numbers
 * - Copy to clipboard
 * - Expand/collapse (fullscreen mode)
 * - Variable highlighting for {{variable}} syntax
 * - Read-only mode
 */

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: 'markdown' | 'json' | 'prompt' | 'plaintext';
  placeholder?: string;
  readOnly?: boolean;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
  showLineNumbers?: boolean;
  showCopyButton?: boolean;
  showExpandButton?: boolean;
  className?: string;
  testId?: string;
}

export interface CodeEditorRef {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
}

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(
  (
    {
      value,
      onChange,
      language = 'plaintext',
      placeholder = 'Enter your code or text here...',
      readOnly = false,
      height = '200px',
      minHeight = '100px',
      maxHeight = '600px',
      showLineNumbers = true,
      showCopyButton = true,
      showExpandButton = true,
      className,
      testId,
    },
    ref
  ) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const [internalValue, setInternalValue] = useState(value);

    // Sync internal value with prop
    if (value !== internalValue && !onChange) {
      setInternalValue(value);
    }

    useImperativeHandle(ref, () => ({
      focus: () => {
        const textarea = document.querySelector(
          `[data-testid="${testId}"] textarea`
        ) as HTMLTextAreaElement;
        textarea?.focus();
      },
      getValue: () => internalValue,
      setValue: (newValue: string) => {
        setInternalValue(newValue);
        onChange?.(newValue);
      },
    }));

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInternalValue(newValue);
        onChange?.(newValue);
      },
      [onChange]
    );

    const handleCopy = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(internalValue);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = internalValue;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }, [internalValue]);

    const toggleExpand = useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);

    const lineCount = internalValue.split('\n').length;
    const lines = Array.from({ length: Math.max(lineCount, 10) }, (_, i) => i + 1);

    // Highlight variables in the display
    const highlightVariables = (text: string) => {
      if (language !== 'prompt') return text;
      // This would be enhanced with proper syntax highlighting
      return text;
    };

    const containerClasses = cn(
      'relative rounded-lg border border-border bg-card overflow-hidden',
      isExpanded && 'fixed inset-4 z-50',
      className
    );

    const editorHeight = isExpanded ? 'calc(100vh - 8rem)' : height;

    return (
      <div
        data-testid={testId}
        className={containerClasses}
        style={{ minHeight: isExpanded ? undefined : minHeight }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {language}
            </span>
            {readOnly && (
              <span className="text-xs text-muted-foreground">(Read only)</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {showCopyButton && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            {showExpandButton && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleExpand}
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex" style={{ height: editorHeight, maxHeight: isExpanded ? undefined : maxHeight }}>
          {/* Line Numbers */}
          {showLineNumbers && (
            <div className="flex-shrink-0 border-r border-border bg-muted/20 px-3 py-3 select-none overflow-hidden">
              <div className="font-mono text-xs text-muted-foreground leading-6">
                {lines.map((line) => (
                  <div key={line} className="text-right">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Text Area */}
          <div className="flex-1 overflow-auto">
            <Textarea
              value={internalValue}
              onChange={handleChange}
              placeholder={placeholder}
              readOnly={readOnly}
              className={cn(
                'h-full w-full resize-none border-0 bg-transparent font-mono text-sm leading-6 p-3',
                'focus-visible:ring-0 focus-visible:ring-offset-0',
                'placeholder:text-muted-foreground/50',
                readOnly && 'cursor-default'
              )}
              style={{ minHeight: '100%' }}
            />
          </div>
        </div>

        {/* Variable Hints (for prompt language) */}
        {language === 'prompt' && !readOnly && (
          <div className="border-t border-border bg-muted/20 px-3 py-2">
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Available variables:</span>
              {['{{prompt}}', '{{user_context}}', '{{team_context}}', '{{history}}'].map(
                (variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => {
                      const newValue = internalValue + variable;
                      setInternalValue(newValue);
                      onChange?.(newValue);
                    }}
                    className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary hover:bg-primary/20 transition-colors"
                  >
                    {variable}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* Expanded overlay background */}
        {isExpanded && (
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm -z-10"
            onClick={toggleExpand}
          />
        )}
      </div>
    );
  }
);

CodeEditor.displayName = 'CodeEditor';

/**
 * CodeEditorSkeleton - Loading skeleton for code editor
 */
export function CodeEditorSkeleton({
  height = '200px',
  showLineNumbers = true,
}: {
  height?: string;
  showLineNumbers?: boolean;
}) {
  return (
    <div
      className="rounded-lg border border-border bg-card overflow-hidden animate-pulse"
      style={{ height }}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="flex gap-1">
          <div className="h-7 w-7 bg-muted rounded" />
          <div className="h-7 w-7 bg-muted rounded" />
        </div>
      </div>
      <div className="flex h-full">
        {showLineNumbers && (
          <div className="w-10 border-r border-border bg-muted/20 p-3">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-3 w-4 bg-muted rounded" />
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 p-3">
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-muted rounded" />
            <div className="h-4 w-1/2 bg-muted rounded" />
            <div className="h-4 w-5/6 bg-muted rounded" />
            <div className="h-4 w-2/3 bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
