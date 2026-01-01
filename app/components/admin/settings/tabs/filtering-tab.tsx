'use client';

import { useState, useEffect, useCallback } from 'react';
import { Filter, Save, Plus, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { InlineAlert } from '@/components/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  getCaptureConfig,
  updateCaptureConfig,
  validatePattern,
} from '@/lib/services/capture-config';
import type { CaptureConfig, CaptureConfigInput } from '@/lib/services/capture-config-types';

interface ValidationState {
  pattern: string;
  isValid: boolean | null;
  isValidating: boolean;
}

function FilteringSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

/**
 * Filtering Tab
 *
 * Configure prompt capture filtering settings:
 * - Min/max prompt length
 * - Garbage patterns (regex)
 * - Command classification settings
 */
export function FilteringTab() {
  const [config, setConfig] = useState<CaptureConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [minLength, setMinLength] = useState(10);
  const [maxLength, setMaxLength] = useState(100000);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [skipCommandOnly, setSkipCommandOnly] = useState(true);
  const [minCommandArgsLength, setMinCommandArgsLength] = useState(10);

  // Pattern validation state
  const [newPattern, setNewPattern] = useState('');
  const [patternValidation, setPatternValidation] = useState<ValidationState>({
    pattern: '',
    isValid: null,
    isValidating: false,
  });

  // Track if form has changes
  const [hasChanges, setHasChanges] = useState(false);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await getCaptureConfig();

    if (result.success) {
      setConfig(result.data);
      setMinLength(result.data.min_prompt_length);
      setMaxLength(result.data.max_prompt_length);
      setPatterns(result.data.garbage_patterns);
      setSkipCommandOnly(result.data.skip_command_only);
      setMinCommandArgsLength(result.data.min_command_args_length);
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Track changes
  useEffect(() => {
    if (!config) return;

    const changed =
      minLength !== config.min_prompt_length ||
      maxLength !== config.max_prompt_length ||
      skipCommandOnly !== config.skip_command_only ||
      minCommandArgsLength !== config.min_command_args_length ||
      JSON.stringify(patterns) !== JSON.stringify(config.garbage_patterns);

    setHasChanges(changed);
  }, [config, minLength, maxLength, patterns, skipCommandOnly, minCommandArgsLength]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    const input: CaptureConfigInput = {
      min_prompt_length: minLength,
      max_prompt_length: maxLength,
      garbage_patterns: patterns,
      skip_command_only: skipCommandOnly,
      min_command_args_length: minCommandArgsLength,
    };

    const result = await updateCaptureConfig(input);

    if (result.success) {
      setConfig(result.data);
      setSuccessMessage('Configuration saved successfully');
      setHasChanges(false);
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } else {
      setError(result.error.message);
    }

    setIsSaving(false);
  };

  const handleValidatePattern = async (pattern: string) => {
    if (!pattern.trim()) return;

    setPatternValidation({ pattern, isValid: null, isValidating: true });

    const result = await validatePattern(pattern);

    setPatternValidation({
      pattern,
      isValid: result.success,
      isValidating: false,
    });
  };

  const handleAddPattern = () => {
    if (!newPattern.trim() || patternValidation.isValid !== true) return;

    if (!patterns.includes(newPattern)) {
      setPatterns([...patterns, newPattern]);
    }
    setNewPattern('');
    setPatternValidation({ pattern: '', isValid: null, isValidating: false });
  };

  const handleRemovePattern = (patternToRemove: string) => {
    setPatterns(patterns.filter((p) => p !== patternToRemove));
  };

  if (isLoading) {
    return (
      <div data-testid="filtering-tab" className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Capture Filtering
          </h2>
          <p className="text-muted-foreground text-sm">
            Configure which prompts are captured and analyzed.
          </p>
        </div>
        <FilteringSkeleton />
      </div>
    );
  }

  return (
    <div data-testid="filtering-tab" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Capture Filtering
          </h2>
          <p className="text-muted-foreground text-sm">
            Configure which prompts are captured and analyzed.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {error && <InlineAlert variant="error" message={error} />}
      {successMessage && <InlineAlert variant="success" message={successMessage} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Length Constraints */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Length Constraints</CardTitle>
            <CardDescription>
              Set minimum and maximum prompt length for capture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="min-length">Minimum Length</Label>
              <Input
                id="min-length"
                type="number"
                min={0}
                max={1000}
                value={minLength}
                onChange={(e) => setMinLength(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Prompts shorter than this are rejected (0-1000).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-length">Maximum Length</Label>
              <Input
                id="max-length"
                type="number"
                min={100}
                max={1000000}
                value={maxLength}
                onChange={(e) => setMaxLength(parseInt(e.target.value) || 100000)}
              />
              <p className="text-xs text-muted-foreground">
                Prompts longer than this are rejected (100-1,000,000).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Command Classification */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Command Classification</CardTitle>
            <CardDescription>
              Control how slash commands are handled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Skip Command-Only Prompts</Label>
                <p className="text-xs text-muted-foreground">
                  Skip analysis for pure commands like /commit, /dev
                </p>
              </div>
              <Switch
                checked={skipCommandOnly}
                onCheckedChange={setSkipCommandOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-command-args">Min Command Args Length</Label>
              <Input
                id="min-command-args"
                type="number"
                min={0}
                max={1000}
                value={minCommandArgsLength}
                onChange={(e) => setMinCommandArgsLength(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Text after command must be at least this long to trigger analysis.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Garbage Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Garbage Patterns</CardTitle>
          <CardDescription>
            Regex patterns to filter out system messages. Patterns are matched at the start of the prompt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing Patterns */}
          <div className="flex flex-wrap gap-2">
            {patterns.map((pattern) => (
              <Badge
                key={pattern}
                variant="secondary"
                className="font-mono text-xs py-1 px-2 gap-1"
              >
                {pattern}
                <button
                  onClick={() => handleRemovePattern(pattern)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {patterns.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                No patterns configured. All prompts will be captured.
              </p>
            )}
          </div>

          {/* Add New Pattern */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Enter regex pattern (e.g., ^<system-reminder>)"
                value={newPattern}
                onChange={(e) => {
                  setNewPattern(e.target.value);
                  if (e.target.value) {
                    handleValidatePattern(e.target.value);
                  } else {
                    setPatternValidation({ pattern: '', isValid: null, isValidating: false });
                  }
                }}
                className="font-mono"
              />
              {patternValidation.isValidating && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  Validating...
                </span>
              )}
              {!patternValidation.isValidating && patternValidation.isValid === true && newPattern && (
                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              )}
              {!patternValidation.isValidating && patternValidation.isValid === false && newPattern && (
                <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
              )}
            </div>
            <Button
              onClick={handleAddPattern}
              disabled={!newPattern || patternValidation.isValid !== true}
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Pattern
            </Button>
          </div>

          {patternValidation.isValid === false && newPattern && (
            <p className="text-sm text-destructive">
              Invalid regular expression. Please check the pattern syntax.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
