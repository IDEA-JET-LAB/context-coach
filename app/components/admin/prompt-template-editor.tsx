'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { showToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CodeEditor } from './code-editor';
import {
  Save,
  Play,
  History,
  Eye,
  AlertTriangle,
  Check,
  Copy,
  FileText,
  Sparkles,
  Settings2,
  Loader2,
} from 'lucide-react';

/**
 * Prompt Template Editor
 *
 * A comprehensive editor for LLM prompt templates with:
 * - Syntax highlighting via CodeEditor
 * - Variable insertion UI
 * - Template preview/test panel
 * - Save/publish workflow with validation
 */

// Template schema
const promptTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  content: z.string().min(10, 'Template content must be at least 10 characters'),
  category: z.enum(['system', 'dimension', 'classification', 'custom']),
  variables: z.array(z.string()).optional(),
});

type PromptTemplateFormData = z.infer<typeof promptTemplateSchema>;

// Available template variables
const TEMPLATE_VARIABLES = [
  { name: 'prompt', description: 'The user\'s prompt text' },
  { name: 'user_context', description: 'User profile and preferences' },
  { name: 'team_context', description: 'Team settings and context' },
  { name: 'history', description: 'Previous conversation history' },
  { name: 'dimension_name', description: 'Name of the dimension being scored' },
  { name: 'scoring_criteria', description: 'Criteria for scoring' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'system', label: 'System Prompt', description: 'Main analysis system prompt' },
  { value: 'dimension', label: 'Dimension Template', description: 'Per-dimension scoring template' },
  { value: 'classification', label: 'Classification', description: 'Prompt classification rules' },
  { value: 'custom', label: 'Custom', description: 'Custom template for specific use' },
] as const;

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;
  category: 'system' | 'dimension' | 'classification' | 'custom';
  variables: string[];
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromptTemplateEditorProps {
  template?: PromptTemplate;
  mode: 'create' | 'edit' | 'view';
  onSave?: (data: PromptTemplateFormData) => Promise<{ success: boolean; error?: string }>;
  onPublish?: (id: string) => Promise<{ success: boolean; error?: string }>;
  onTest?: (content: string, testPrompt: string) => Promise<{ success: boolean; result?: string; error?: string }>;
  onViewHistory?: (id: string) => void;
}

export function PromptTemplateEditor({
  template,
  mode,
  onSave,
  onPublish,
  onTest,
  onViewHistory,
}: PromptTemplateEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'test'>('edit');
  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const form = useForm<PromptTemplateFormData>({
    resolver: zodResolver(promptTemplateSchema),
    defaultValues: template
      ? {
          name: template.name,
          description: template.description || '',
          content: template.content,
          category: template.category,
          variables: template.variables,
        }
      : {
          name: '',
          description: '',
          content: '',
          category: 'custom',
          variables: [],
        },
  });

  const watchedContent = form.watch('content');
  const watchedCategory = form.watch('category');

  // Detect variables used in template
  const detectVariables = useCallback((content: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = content.matchAll(regex);
    const variables = new Set<string>();
    for (const match of matches) {
      if (match[1]) {
        variables.add(match[1]);
      }
    }
    return Array.from(variables);
  }, []);

  const usedVariables = detectVariables(watchedContent);

  // Validate template
  const validateTemplate = useCallback((content: string): string[] => {
    const errors: string[] = [];

    // Check for required variables based on category
    if (watchedCategory === 'dimension' && !content.includes('{{dimension_name}}')) {
      errors.push('Dimension templates should include {{dimension_name}}');
    }

    // Check for balanced braces
    const openBraces = (content.match(/\{\{/g) || []).length;
    const closeBraces = (content.match(/\}\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Unbalanced template variables - check your {{ and }} brackets');
    }

    // Check for unknown variables
    const knownVars: string[] = TEMPLATE_VARIABLES.map((v) => v.name);
    usedVariables.forEach((v) => {
      if (!knownVars.includes(v)) {
        errors.push(`Unknown variable: {{${v}}}`);
      }
    });

    return errors;
  }, [watchedCategory, usedVariables]);

  // Update validation errors when content changes
  const errors = validateTemplate(watchedContent);

  const handleSave = (data: PromptTemplateFormData) => {
    if (errors.length > 0) {
      showToast.error('Please fix validation errors before saving');
      return;
    }

    startTransition(async () => {
      if (onSave) {
        const result = await onSave({
          ...data,
          variables: usedVariables,
        });
        if (result.success) {
          showToast.success('Template saved successfully');
          if (mode === 'create') {
            router.push('/admin/config');
          }
        } else {
          showToast.error(result.error || 'Failed to save template');
        }
      }
    });
  };

  const handlePublish = () => {
    if (!template?.id) return;

    startTransition(async () => {
      if (onPublish) {
        const result = await onPublish(template.id);
        if (result.success) {
          showToast.success('Template published successfully');
          setShowPublishDialog(false);
          router.refresh();
        } else {
          showToast.error(result.error || 'Failed to publish template');
        }
      }
    });
  };

  const handleTest = async () => {
    if (!testPrompt.trim()) {
      showToast.error('Please enter a test prompt');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    if (onTest) {
      const result = await onTest(watchedContent, testPrompt);
      if (result.success && result.result) {
        setTestResult(result.result);
      } else {
        showToast.error(result.error || 'Test failed');
      }
    } else {
      // Mock test result for demo
      const interpolated = watchedContent
        .replace('{{prompt}}', testPrompt)
        .replace('{{user_context}}', '[User Context]')
        .replace('{{team_context}}', '[Team Context]');
      setTestResult(interpolated);
    }

    setIsTesting(false);
  };

  const insertVariable = (variable: string) => {
    const currentContent = form.getValues('content');
    form.setValue('content', currentContent + `{{${variable}}}`);
  };

  const isReadOnly = mode === 'view';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">
            {mode === 'create'
              ? 'Create Template'
              : mode === 'edit'
              ? 'Edit Template'
              : template?.name || 'View Template'}
          </h2>
          {template && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">v{template.version}</Badge>
              {template.isActive && (
                <Badge className="bg-green-500/20 text-green-500">Active</Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {CATEGORY_OPTIONS.find((c) => c.value === template.category)?.label}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {template && onViewHistory && (
            <Button
              variant="outline"
              onClick={() => onViewHistory(template.id)}
            >
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
          )}

          {!isReadOnly && (
            <>
              <Button
                variant="outline"
                onClick={form.handleSubmit(handleSave)}
                disabled={isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {isPending ? 'Saving...' : 'Save Draft'}
              </Button>

              {template && !template.isActive && (
                <Button
                  onClick={() => setShowPublishDialog(true)}
                  disabled={isPending || errors.length > 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Publish
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Validation Warnings */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-amber-500">Validation Issues</p>
              <ul className="mt-1 space-y-1">
                {errors.map((error, i) => (
                  <li key={i} className="text-sm text-amber-500/80">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card className="border-border bg-background">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Template Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Clarity Scoring v2"
                    {...form.register('name')}
                    disabled={isReadOnly}
                    className="bg-card"
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={watchedCategory}
                    onValueChange={(value) =>
                      form.setValue('category', value as PromptTemplateFormData['category'])
                    }
                    disabled={isReadOnly}
                  >
                    <SelectTrigger id="category" className="bg-card">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="Brief description of what this template does"
                  {...form.register('description')}
                  disabled={isReadOnly}
                  className="bg-card"
                />
              </div>
            </CardContent>
          </Card>

          {/* Template Content Tabs */}
          <Card className="border-border bg-background">
            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="mb-4">
                  <TabsTrigger value="edit" disabled={isReadOnly}>
                    <Settings2 className="mr-2 h-4 w-4" />
                    Edit
                  </TabsTrigger>
                  <TabsTrigger value="preview">
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="test">
                    <Play className="mr-2 h-4 w-4" />
                    Test
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="space-y-4">
                  <CodeEditor
                    value={watchedContent}
                    onChange={(value) => form.setValue('content', value)}
                    language="prompt"
                    placeholder="Enter your prompt template here...

Use {{variable}} syntax for dynamic content.
Example: Analyze the following prompt: {{prompt}}"
                    readOnly={isReadOnly}
                    height="400px"
                    testId="template-editor"
                  />
                  {form.formState.errors.content && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.content.message}
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="preview">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                      {watchedContent || 'No content to preview'}
                    </pre>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Variables detected: {usedVariables.length > 0 ? usedVariables.map((v) => `{{${v}}}`).join(', ') : 'None'}</span>
                  </div>
                </TabsContent>

                <TabsContent value="test" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Test Prompt</Label>
                    <CodeEditor
                      value={testPrompt}
                      onChange={setTestPrompt}
                      language="plaintext"
                      placeholder="Enter a sample prompt to test your template..."
                      height="150px"
                      showLineNumbers={false}
                      testId="test-prompt-input"
                    />
                  </div>

                  <Button
                    onClick={handleTest}
                    disabled={isTesting || !testPrompt.trim()}
                    className="w-full"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running Test...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Run Test
                      </>
                    )}
                  </Button>

                  {testResult && (
                    <div className="space-y-2">
                      <Label>Test Result</Label>
                      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                        <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                          {testResult}
                        </pre>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Variables & Help */}
        <div className="space-y-6">
          {/* Variables Panel */}
          <Card className="border-border bg-background">
            <CardHeader>
              <CardTitle className="text-lg">Template Variables</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Click to insert a variable at the cursor position.
              </p>

              <div className="space-y-2">
                {TEMPLATE_VARIABLES.map((variable) => {
                  const isUsed = usedVariables.includes(variable.name);
                  return (
                    <button
                      key={variable.name}
                      type="button"
                      onClick={() => !isReadOnly && insertVariable(variable.name)}
                      disabled={isReadOnly}
                      className={cn(
                        'w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                        isUsed
                          ? 'border-green-500/50 bg-green-500/10'
                          : 'border-border bg-card hover:bg-muted/50',
                        isReadOnly && 'cursor-default opacity-50'
                      )}
                    >
                      <code className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
                        {`{{${variable.name}}}`}
                      </code>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {variable.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {variable.description}
                        </p>
                      </div>
                      {isUsed && (
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Category Help */}
          <Card className="border-border bg-background">
            <CardHeader>
              <CardTitle className="text-lg">Category Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {CATEGORY_OPTIONS.map((category) => (
                  <div
                    key={category.value}
                    className={cn(
                      'rounded-lg border p-3',
                      watchedCategory === category.value
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border'
                    )}
                  >
                    <p className="font-medium text-sm text-foreground">
                      {category.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {category.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="border-border bg-background">
            <CardHeader>
              <CardTitle className="text-lg">Quick Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Be specific:</strong>{' '}
                Clear instructions lead to better AI responses.
              </p>
              <p>
                <strong className="text-foreground">Use examples:</strong>{' '}
                Include sample inputs/outputs when possible.
              </p>
              <p>
                <strong className="text-foreground">Test thoroughly:</strong>{' '}
                Try different prompts before publishing.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Publish Confirmation Dialog */}
      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Template</AlertDialogTitle>
            <AlertDialogDescription>
              Publishing this template will make it active and replace the current
              version. All new analyses will use this template. This action cannot
              be undone, but you can always create a new version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePublish}
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {isPending ? 'Publishing...' : 'Publish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * PromptTemplateList - Grid/list view of templates
 */
interface PromptTemplateListProps {
  templates: PromptTemplate[];
  onSelect: (template: PromptTemplate) => void;
  onDuplicate?: (template: PromptTemplate) => void;
  selectedId?: string;
}

export function PromptTemplateList({
  templates,
  onSelect,
  onDuplicate,
  selectedId,
}: PromptTemplateListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <Card
          key={template.id}
          className={cn(
            'cursor-pointer border-border bg-background transition-colors hover:bg-muted/50',
            selectedId === template.id && 'border-primary'
          )}
          onClick={() => onSelect(template)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">{template.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {template.category}
                  </Badge>
                  {template.isActive && (
                    <Badge className="bg-green-500/20 text-green-500 text-xs">
                      Active
                    </Badge>
                  )}
                </div>
              </div>
              {onDuplicate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(template);
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {template.description || 'No description'}
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span>v{template.version}</span>
              <span>{template.variables.length} variables</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
