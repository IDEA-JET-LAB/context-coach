'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  extractVariables,
  isValidVariable,
  VARIABLE_REGEX,
} from '@/lib/utils/template-engine';
import type { PromptTemplateType } from '@/lib/types/prompt-templates';

/**
 * Template Editor Component
 *
 * A specialized code editor for prompt templates with:
 * - Variable highlighting (green for valid, yellow for unknown)
 * - Line numbers
 * - Autocomplete for variables
 * - Copy/expand functionality
 */

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  templateType: PromptTemplateType;
  validVariables: string[];
  placeholder?: string;
  readOnly?: boolean;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
  testId?: string;
}

export function TemplateEditor({
  value,
  onChange,
  templateType,
  validVariables,
  placeholder = 'Enter your prompt template here...\n\nUse {{variable}} syntax for dynamic content.',
  readOnly = false,
  height = '300px',
  minHeight = '150px',
  maxHeight = '600px',
  className,
  testId = 'template-editor',
}: TemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [autocompleteFilter, setAutocompleteFilter] = useState('');

  // Sync scroll between textarea and highlight overlay
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('scroll', syncScroll);
      return () => textarea.removeEventListener('scroll', syncScroll);
    }
  }, [syncScroll]);

  // Handle text input and check for autocomplete trigger
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Check for autocomplete trigger (typing after {{)
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const match = textBeforeCursor.match(/\{\{(\w*)$/);

    if (match && match[1] !== undefined) {
      setAutocompleteFilter(match[1].toLowerCase());
      setShowAutocomplete(true);
      // Position autocomplete near cursor (simplified)
      const rect = e.target.getBoundingClientRect();
      setAutocompletePosition({
        top: 40, // Below the first line
        left: Math.min((cursorPos || 0) * 8, rect.width - 200), // Rough estimate
      });
    } else {
      setShowAutocomplete(false);
    }
  };

  // Insert variable from autocomplete
  const insertVariable = (variable: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);

    // Find where {{ starts
    const match = textBeforeCursor.match(/\{\{(\w*)$/);
    if (match) {
      const insertStart = cursorPos - match[0].length;
      const newValue =
        value.substring(0, insertStart) +
        `{{${variable}}}` +
        textAfterCursor;
      onChange(newValue);

      // Move cursor after inserted variable
      setTimeout(() => {
        const newPos = insertStart + variable.length + 4;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    }

    setShowAutocomplete(false);
  };

  // Handle keyboard navigation in autocomplete
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAutocomplete) {
      if (e.key === 'Escape') {
        setShowAutocomplete(false);
        e.preventDefault();
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        // Insert first matching variable
        const filtered = validVariables.filter((v) =>
          v.toLowerCase().startsWith(autocompleteFilter)
        );
        if (filtered.length > 0 && filtered[0]) {
          insertVariable(filtered[0]);
          e.preventDefault();
        }
      }
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Highlight variables in the content
  const getHighlightedHtml = () => {
    if (!value) return '';

    // Escape HTML and add highlighting
    const escaped = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Replace variables with highlighted spans
    return escaped.replace(
      /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
      (match, varName) => {
        const isValid = isValidVariable(varName, templateType);
        const className = isValid
          ? 'bg-status-success-subtle text-status-success rounded px-0.5'
          : 'bg-status-warning-subtle text-status-warning rounded px-0.5';
        return `<span class="${className}">${match}</span>`;
      }
    );
  };

  // Line numbers
  const lineCount = Math.max((value || '').split('\n').length, 10);
  const lines = Array.from({ length: lineCount }, (_, i) => i + 1);

  // Filter autocomplete options
  const filteredVariables = validVariables.filter((v) =>
    v.toLowerCase().startsWith(autocompleteFilter)
  );

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
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Template
          </span>
          {readOnly && (
            <span className="text-xs text-muted-foreground">(Read only)</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-status-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div
        className="relative flex"
        style={{ height: editorHeight, maxHeight: isExpanded ? undefined : maxHeight }}
      >
        {/* Line Numbers */}
        <div className="flex-shrink-0 select-none overflow-hidden border-r border-border bg-muted/20 px-3 py-3">
          <div className="font-mono text-xs leading-6 text-muted-foreground">
            {lines.map((line) => (
              <div key={line} className="text-right">
                {line}
              </div>
            ))}
          </div>
        </div>

        {/* Editor Container */}
        <div className="relative flex-1 overflow-auto">
          {/* Highlight Overlay */}
          <div
            ref={highlightRef}
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words p-3 font-mono text-sm leading-6"
            style={{ color: 'transparent' }}
            dangerouslySetInnerHTML={{ __html: getHighlightedHtml() }}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            readOnly={readOnly}
            className={cn(
              'absolute inset-0 h-full w-full resize-none border-0 bg-transparent p-3 font-mono text-sm leading-6 caret-foreground',
              'placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-0',
              readOnly && 'cursor-default'
            )}
            spellCheck={false}
            data-testid={`${testId}-textarea`}
          />

          {/* Autocomplete Dropdown */}
          {showAutocomplete && filteredVariables.length > 0 && !readOnly && (
            <div
              className="absolute z-10 rounded-md border border-border bg-popover p-1 shadow-md"
              style={{
                top: autocompletePosition.top,
                left: autocompletePosition.left,
                minWidth: 200,
              }}
              data-testid="autocomplete-dropdown"
            >
              {filteredVariables.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => insertVariable(variable)}
                >
                  <code className="rounded bg-primary/10 px-1 text-xs text-primary">
                    {`{{${variable}}}`}
                  </code>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Variable hints footer */}
      {!readOnly && (
        <div className="border-t border-border bg-muted/20 px-3 py-2">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">
              Type {"{{" } to see available variables:
            </span>
            {validVariables.slice(0, 4).map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => {
                  if (textareaRef.current) {
                    const pos = textareaRef.current.selectionStart;
                    const newValue =
                      value.substring(0, pos) +
                      `{{${variable}}}` +
                      value.substring(pos);
                    onChange(newValue);
                    textareaRef.current.focus();
                  }
                }}
                className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary transition-colors hover:bg-primary/20"
              >
                {`{{${variable}}}`}
              </button>
            ))}
            {validVariables.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{validVariables.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded overlay background */}
      {isExpanded && (
        <div
          className="fixed inset-0 -z-10 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}
