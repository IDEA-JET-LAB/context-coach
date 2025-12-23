'use client';

/**
 * Regex Pattern Tester Component
 * Story 22-2: Classification Rule Editor - Task 5
 *
 * Interactive regex testing with match highlighting and group display.
 */

import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Check, X, Loader2, Info } from 'lucide-react';

interface RegexTestResult {
  matched: boolean;
  matches: Array<{
    text: string;
    index: number;
    length: number;
    groups: Record<string, string>;
  }>;
  executionTime: number;
  error?: string;
}

interface RegexTesterProps {
  pattern: string;
  flags?: string;
  onExecutionTime?: (ms: number) => void;
}

// Sample prompts for testing
const SAMPLE_PROMPTS = [
  'Can you fix the bug in the login form?',
  'Add a new feature for user notifications',
  'Write unit tests for the payment module',
  'Refactor the database connection code',
  'Help me debug this error message',
  'Update the README documentation',
];

export function RegexTester({ pattern, flags = 'i', onExecutionTime }: RegexTesterProps) {
  const [testInput, setTestInput] = useState('');
  const [result, setResult] = useState<RegexTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Auto-test when pattern or input changes
  useEffect(() => {
    if (!pattern || !testInput) {
      setResult(null);
      return;
    }

    const timer = setTimeout(() => {
      runTest();
    }, 300);

    return () => clearTimeout(timer);
  }, [pattern, flags, testInput]);

  const runTest = () => {
    if (!pattern || !testInput) return;

    setIsTesting(true);
    const start = performance.now();

    try {
      // Ensure global flag for finding all matches
      const testFlags = flags.includes('g') ? flags : `${flags}g`;
      const regex = new RegExp(pattern, testFlags);

      const matches: RegexTestResult['matches'] = [];
      let match: RegExpExecArray | null;

      while ((match = regex.exec(testInput)) !== null) {
        matches.push({
          text: match[0],
          index: match.index,
          length: match[0].length,
          groups: match.groups || {},
        });

        // Safety limit
        if (matches.length >= 100) break;

        // Prevent infinite loops on zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }

      const executionTime = performance.now() - start;

      setResult({
        matched: matches.length > 0,
        matches,
        executionTime,
      });

      onExecutionTime?.(executionTime);
    } catch (error) {
      setResult({
        matched: false,
        matches: [],
        executionTime: performance.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Highlighted text with matches
  const highlightedText = useMemo(() => {
    if (!result || !result.matched) return null;

    const parts: Array<{ text: string; isMatch: boolean; matchIndex?: number }> = [];
    let lastIndex = 0;

    result.matches.forEach((match, i) => {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push({
          text: testInput.substring(lastIndex, match.index),
          isMatch: false,
        });
      }

      // Add match
      parts.push({
        text: match.text,
        isMatch: true,
        matchIndex: i,
      });

      lastIndex = match.index + match.length;
    });

    // Add remaining text
    if (lastIndex < testInput.length) {
      parts.push({
        text: testInput.substring(lastIndex),
        isMatch: false,
      });
    }

    return parts;
  }, [result, testInput]);

  return (
    <Card className="border-border bg-surface-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Play className="h-4 w-4" />
          Pattern Tester
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test Input */}
        <div className="space-y-2">
          <Label htmlFor="test-input">Test Input</Label>
          <Textarea
            id="test-input"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Enter a sample prompt to test against the pattern..."
            rows={4}
            className="bg-surface-primary font-mono text-sm"
          />
        </div>

        {/* Sample Prompts */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">Quick samples:</Label>
          <div className="flex flex-wrap gap-1">
            {SAMPLE_PROMPTS.map((sample, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setTestInput(sample)}
              >
                {sample.substring(0, 25)}...
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Results */}
        {isTesting && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Testing pattern...</span>
          </div>
        )}

        {result && !isTesting && (
          <div className="space-y-4">
            {/* Match Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.error ? (
                  <Badge variant="destructive">
                    <X className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                ) : result.matched ? (
                  <Badge className="bg-status-success-subtle text-status-success">
                    <Check className="h-3 w-3 mr-1" />
                    {result.matches.length} match{result.matches.length > 1 ? 'es' : ''}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <X className="h-3 w-3 mr-1" />
                    No match
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {result.executionTime.toFixed(2)}ms
              </span>
            </div>

            {/* Error Message */}
            {result.error && (
              <div className="p-3 rounded-lg bg-status-error-subtle text-status-error text-sm">
                {result.error}
              </div>
            )}

            {/* Highlighted Text */}
            {highlightedText && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Highlighted matches:</Label>
                <div className="p-3 rounded-lg bg-surface-primary text-sm font-mono whitespace-pre-wrap break-all">
                  {highlightedText.map((part, i) => (
                    <span
                      key={i}
                      className={cn(
                        part.isMatch && 'bg-status-warning-subtle text-status-warning font-semibold'
                      )}
                      title={part.isMatch ? `Match #${(part.matchIndex ?? 0) + 1}` : undefined}
                    >
                      {part.text}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Match Details */}
            {result.matches.length > 0 && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Match details:</Label>
                <div className="space-y-2">
                  {result.matches.slice(0, 10).map((match, i) => (
                    <div
                      key={i}
                      className="p-2 rounded bg-surface-tertiary text-sm font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">
                          #{i + 1}
                        </Badge>
                        <span className="truncate">{match.text}</span>
                        <span className="text-muted-foreground text-xs shrink-0">
                          pos: {match.index}
                        </span>
                      </div>
                      {Object.keys(match.groups).length > 0 && (
                        <div className="mt-2 pl-4 text-xs text-muted-foreground">
                          <Info className="h-3 w-3 inline mr-1" />
                          Groups:
                          {Object.entries(match.groups).map(([name, value]) => (
                            <span key={name} className="ml-2">
                              <span className="text-content-accent">{name}</span>: "{value}"
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {result.matches.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center">
                      ... and {result.matches.length - 10} more matches
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!testInput && !result && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Info className="h-4 w-4" />
            <span>Enter test input above to see matches</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
