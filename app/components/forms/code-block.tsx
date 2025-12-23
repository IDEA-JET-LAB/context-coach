'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CodeBlockProps {
  /** Code content */
  code: string;
  /** Programming language (for future syntax highlighting) */
  language?: string;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Whether to show copy button */
  copyable?: boolean;
  /** Title/filename */
  title?: string;
  /** Maximum height before scrolling */
  maxHeight?: string | number;
  /** Additional class names */
  className?: string;
}

export function CodeBlock({
  code,
  language,
  showLineNumbers = false,
  copyable = true,
  title,
  maxHeight = '400px',
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');

  return (
    <div
      className={cn('rounded-lg border border-border bg-card overflow-hidden', className)}
      data-testid="code-block"
    >
      {/* Header */}
      {(title || copyable) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            {title && (
              <span className="text-sm font-medium text-foreground">{title}</span>
            )}
            {language && (
              <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                {language}
              </span>
            )}
          </div>
          {copyable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2"
              data-testid="copy-button"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1 text-score-high" />
                  <span className="text-xs">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  <span className="text-xs">Copy</span>
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Code content */}
      <div
        className="overflow-auto p-4"
        style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
      >
        <pre className="text-sm">
          <code className="text-foreground font-mono">
            {showLineNumbers ? (
              <table className="border-collapse">
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index}>
                      <td className="pr-4 text-muted-foreground text-right select-none align-top">
                        {index + 1}
                      </td>
                      <td className="whitespace-pre">{line || ' '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              code
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}
