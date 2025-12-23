'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Save,
  Sparkles,
  AlertTriangle,
  Search,
  MessageSquare,
  Tag,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { showToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { TemplateEditor } from './template-editor';
import { TemplateVariablePanel, VariableUsageSummary } from './template-variable-panel';
import { TemplatePreviewModal } from './template-preview-modal';
import {
  createPromptTemplate,
  updatePromptTemplate,
  publishPromptTemplate,
  getTemplateVariables,
} from '@/lib/services/prompt-templates';
import {
  extractVariables,
  validateTemplate,
  VARIABLES_BY_TYPE,
} from '@/lib/utils/template-engine';
import type {
  PromptTemplate,
  PromptTemplateType,
  PromptTemplateVariable,
  CreatePromptTemplateInput,
} from '@/lib/types/prompt-templates';
import { TEMPLATE_STATUS_CONFIG, TEMPLATE_TYPES } from '@/lib/types/prompt-templates';
import Link from 'next/link';

/**
 * Template Form Component
 *
 * Form for creating and editing prompt templates with:
 * - Name, description, type selection
 * - Template body editor with variable highlighting
 * - Variable panel for reference
 * - Preview functionality
 * - Save/publish workflow
 */

const templateFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  type: z.enum(['analysis', 'feedback', 'classification']),
  body: z.string().min(10, 'Template must be at least 10 characters'),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

interface TemplateFormProps {
  template?: PromptTemplate;
  mode: 'create' | 'edit' | 'view';
}

const typeIcons: Record<PromptTemplateType, typeof Search> = {
  analysis: Search,
  feedback: MessageSquare,
  classification: Tag,
};

export function TemplateForm({ template, mode }: TemplateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [variables, setVariables] = useState<PromptTemplateVariable[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const isReadOnly = mode === 'view' || template?.status === 'active';
  const canPublish = mode === 'edit' && template?.status === 'draft';

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: template?.name || '',
      description: template?.description || '',
      type: template?.type || 'analysis',
      body: template?.body || '',
    },
  });

  const watchedType = form.watch('type');
  const watchedBody = form.watch('body');

  // Get used variables from template body
  const usedVariables = extractVariables(watchedBody);
  const validVariables = VARIABLES_BY_TYPE[watchedType];

  // Load variables for the selected type
  useEffect(() => {
    const loadVariables = async () => {
      startTransition(async () => {
        const result = await getTemplateVariables(watchedType);
        if (result.success) {
          setVariables(result.data);
        }
      });
    };
    loadVariables();
  }, [watchedType]);

  // Validate template on body change
  useEffect(() => {
    if (watchedBody) {
      const validation = validateTemplate(watchedBody, watchedType);
      setValidationErrors(validation.errors);
    } else {
      setValidationErrors([]);
    }
  }, [watchedBody, watchedType]);

  // Handle variable insertion from panel
  const handleInsertVariable = useCallback(
    (variableName: string) => {
      const currentBody = form.getValues('body');
      form.setValue('body', currentBody + `{{${variableName}}}`);
    },
    [form]
  );

  // Save template
  const handleSave = (data: TemplateFormData) => {
    if (validationErrors.length > 0) {
      showToast.error('Please fix validation errors before saving');
      return;
    }

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createPromptTemplate(data as CreatePromptTemplateInput);
        if (result.success) {
          showToast.success('Template created successfully');
          router.push(`/admin/analysis/templates/${result.data.id}`);
        } else {
          showToast.error(result.error.message);
        }
      } else if (template?.id) {
        const result = await updatePromptTemplate(template.id, data);
        if (result.success) {
          showToast.success('Template saved successfully');
          router.refresh();
        } else {
          showToast.error(result.error.message);
        }
      }
    });
  };

  // Publish template
  const handlePublish = () => {
    if (!template?.id) return;

    startTransition(async () => {
      const result = await publishPromptTemplate(template.id);
      if (result.success) {
        showToast.success('Template published successfully');
        setShowPublishDialog(false);
        router.refresh();
      } else {
        showToast.error(result.error.message);
      }
    });
  };

  return (
    <div className="space-y-6" data-testid="template-form">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href="/admin/analysis/templates">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h2 className="text-2xl font-bold text-foreground">
              {mode === 'create'
                ? 'Create Template'
                : mode === 'edit'
                ? 'Edit Template'
                : template?.name || 'View Template'}
            </h2>
          </div>
          {template && (
            <div className="ml-11 flex items-center gap-2">
              <Badge
                variant={TEMPLATE_STATUS_CONFIG[template.status].variant}
                className={cn(
                  template.status === 'active' &&
                    'bg-primary/10 text-primary hover:bg-primary/20'
                )}
              >
                {TEMPLATE_STATUS_CONFIG[template.status].label}
              </Badge>
              <span className="text-sm text-muted-foreground">v{template.version}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Preview Button */}
          <TemplatePreviewModal
            templateBody={watchedBody}
            templateType={watchedType}
            disabled={!watchedBody || watchedBody.length < 10}
          />

          {/* Save Button */}
          {!isReadOnly && (
            <Button
              onClick={form.handleSubmit(handleSave)}
              disabled={isPending || validationErrors.length > 0}
              variant="outline"
            >
              <Save className="mr-2 h-4 w-4" />
              {isPending ? 'Saving...' : 'Save Draft'}
            </Button>
          )}

          {/* Publish Button */}
          {canPublish && (
            <Button
              onClick={() => setShowPublishDialog(true)}
              disabled={isPending || validationErrors.length > 0}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-status-warning/50 bg-status-warning-subtle p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-status-warning" />
            <div>
              <p className="font-medium text-status-warning">Validation Issues</p>
              <ul className="mt-1 space-y-1">
                {validationErrors.map((error, i) => (
                  <li key={i} className="text-sm text-status-warning/80">
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
        {/* Left Column - Form & Editor */}
        <div className="space-y-6 lg:col-span-2">
          {/* Basic Info Card */}
          <Card className="border-border bg-background">
            <CardHeader>
              <CardTitle className="text-base">Template Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Enhanced Clarity Analysis"
                    {...form.register('name')}
                    disabled={isReadOnly}
                    className="bg-card"
                    data-testid="template-name-input"
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                {/* Type */}
                <div className="space-y-2">
                  <Label htmlFor="type">Template Type</Label>
                  <Select
                    value={watchedType}
                    onValueChange={(value) =>
                      form.setValue('type', value as PromptTemplateType)
                    }
                    disabled={isReadOnly || mode === 'edit'}
                  >
                    <SelectTrigger id="type" className="bg-card" data-testid="template-type-select">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPES.map((type) => {
                        const Icon = typeIcons[type.value];
                        return (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <div className="flex flex-col">
                                <span>{type.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {type.description}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of what this template does..."
                  {...form.register('description')}
                  disabled={isReadOnly}
                  className="h-20 resize-none bg-card"
                  data-testid="template-description-input"
                />
              </div>
            </CardContent>
          </Card>

          {/* Template Body Card */}
          <Card className="border-border bg-background">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Template Body</CardTitle>
                <VariableUsageSummary
                  variables={variables}
                  usedVariables={usedVariables}
                />
              </div>
            </CardHeader>
            <CardContent>
              <TemplateEditor
                value={watchedBody}
                onChange={(value) => form.setValue('body', value)}
                templateType={watchedType}
                validVariables={validVariables}
                readOnly={isReadOnly}
                height="350px"
                testId="template-body-editor"
              />
              {form.formState.errors.body && (
                <p className="mt-2 text-sm text-destructive">
                  {form.formState.errors.body.message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Variables */}
        <div className="space-y-6">
          <TemplateVariablePanel
            variables={variables}
            usedVariables={usedVariables}
            onInsert={handleInsertVariable}
            readOnly={isReadOnly}
          />

          {/* Quick Tips */}
          <Card className="border-border bg-background">
            <CardHeader>
              <CardTitle className="text-base">Quick Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Be specific:</strong> Clear
                instructions lead to better AI responses.
              </p>
              <p>
                <strong className="text-foreground">Use examples:</strong> Include
                sample inputs/outputs when possible.
              </p>
              <p>
                <strong className="text-foreground">Test thoroughly:</strong> Use
                the preview to test with different inputs before publishing.
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
              Publishing this template will make it active and available for use
              in analysis configurations. Any existing active template with the
              same name and type will be archived. This action cannot be undone,
              but you can always create a new version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={isPending}>
              {isPending ? 'Publishing...' : 'Publish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
