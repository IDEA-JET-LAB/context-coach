'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DimensionEditor } from './dimension-editor';
import {
  ArrowLeft,
  Edit,
  Copy,
  Zap,
  Save,
  X,
  Lock,
} from 'lucide-react';
import {
  activateConfig,
  duplicateConfig,
  updateAnalysisConfig,
} from '@/lib/services/admin-config';
import {
  analysisConfigSchema,
  AI_MODEL_OPTIONS,
  type AnalysisConfigFormInput,
  type AnalysisConfigInput,
  type AnalysisConfigWithDimensions,
} from '@/lib/validations/analysis-config';

interface ConfigDetailViewProps {
  config: AnalysisConfigWithDimensions;
  initialEditMode?: boolean;
}

export function ConfigDetailView({ config, initialEditMode = false }: ConfigDetailViewProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(initialEditMode && !config.is_active);
  const [isPending, startTransition] = useTransition();
  const [isActivating, setIsActivating] = useState(false);

  const form = useForm<AnalysisConfigFormInput>({
    resolver: zodResolver(analysisConfigSchema),
    defaultValues: {
      name: config.name,
      system_prompt: config.system_prompt,
      model: config.model as AnalysisConfigFormInput['model'],
      dimensions: config.analysis_dimensions.map((dim) => ({
        id: dim.id,
        name: dim.name,
        description: dim.description || '',
        weight: dim.weight,
        prompt_template: dim.prompt_template,
        scoring_criteria: dim.scoring_criteria,
        sort_order: dim.sort_order,
        enabled: dim.enabled,
      })),
    },
  });

  const handleActivate = async () => {
    setIsActivating(true);
    const result = await activateConfig(config.id);
    setIsActivating(false);

    if (result.success) {
      toast.success('Configuration activated');
      router.refresh();
    } else {
      toast.error(result.error.message);
    }
  };

  const handleDuplicate = () => {
    startTransition(async () => {
      const result = await duplicateConfig(config.id);
      if (result.success) {
        toast.success('Configuration duplicated');
        router.push(`/admin/config/${result.data.id}`);
      } else {
        toast.error(result.error.message);
      }
    });
  };

  const handleSave = (data: AnalysisConfigFormInput) => {
    startTransition(async () => {
      // Parse through schema to apply defaults
      const parsedData = analysisConfigSchema.parse(data);
      const result = await updateAnalysisConfig(config.id, parsedData);
      if (result.success) {
        toast.success('Configuration updated');
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  };

  const handleCancelEdit = () => {
    form.reset();
    setIsEditing(false);
    router.push(`/admin/config/${config.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-foreground">{config.name}</h2>
            {config.is_active ? (
              <Badge
                data-testid="active-badge"
                className="bg-green-500/20 text-green-500 hover:bg-green-500/30"
              >
                Active
              </Badge>
            ) : (
              <Badge
                data-testid="inactive-badge"
                variant="secondary"
                className="bg-muted/50"
              >
                Inactive
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Version {config.version} &middot; {config.model}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={form.handleSubmit(handleSave)} disabled={isPending}>
                <Save className="mr-2 h-4 w-4" />
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" asChild>
                <Link href="/admin/config">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Link>
              </Button>

              <Button
                variant="outline"
                onClick={handleDuplicate}
                disabled={isPending}
              >
                <Copy className="mr-2 h-4 w-4" />
                {isPending ? 'Duplicating...' : 'Duplicate'}
              </Button>

              {!config.is_active && (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="bg-green-600 hover:bg-green-700">
                        <Zap className="mr-2 h-4 w-4" />
                        Activate
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Activate Configuration</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to activate &quot;{config.name}&quot;? This will
                          deactivate the currently active configuration. New analyses will use
                          this configuration, but existing analyses will retain their original
                          config.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleActivate}
                          disabled={isActivating}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isActivating ? 'Activating...' : 'Confirm'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Read-only notice for active configs */}
      {config.is_active && !isEditing && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-amber-500">
          <Lock className="h-4 w-4" />
          <span className="text-sm">
            Active configs cannot be edited. Duplicate this config to make changes.
          </span>
        </div>
      )}

      {/* System Prompt */}
      <Card className="border-[#2a2a2a] bg-[#0f0f0f]">
        <CardHeader>
          <CardTitle className="text-lg">System Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-2">
              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Version Name</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    className="bg-[#1a1a1a]"
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">AI Model</Label>
                  <Select
                    value={form.watch('model')}
                    onValueChange={(value) =>
                      form.setValue('model', value as AnalysisConfigFormInput['model'])
                    }
                  >
                    <SelectTrigger id="model" className="bg-[#1a1a1a]">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_MODEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            {option.label}
                            <span className="text-xs text-muted-foreground">
                              ({option.provider})
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Label htmlFor="system_prompt">System Prompt</Label>
              <Textarea
                id="system_prompt"
                {...form.register('system_prompt')}
                rows={6}
                className="bg-[#1a1a1a]"
              />
              {form.formState.errors.system_prompt && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.system_prompt.message}
                </p>
              )}
            </div>
          ) : (
            <pre
              data-testid="config-system-prompt"
              className="whitespace-pre-wrap font-mono text-sm text-muted-foreground bg-[#1a1a1a] p-4 rounded-lg"
            >
              {config.system_prompt}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Dimensions */}
      <Card className="border-[#2a2a2a] bg-[#0f0f0f]">
        <CardContent className="pt-6">
          {isEditing ? (
            <>
              <DimensionEditor form={form} />
              {form.formState.errors.dimensions?.root && (
                <p className="mt-2 text-sm text-destructive">
                  {form.formState.errors.dimensions.root.message}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Scoring Dimensions
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {config.analysis_dimensions.length} dimensions configured
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {config.analysis_dimensions.map((dim) => (
                  <Card key={dim.id} className="border-[#2a2a2a] bg-[#1a1a1a]">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{dim.name}</CardTitle>
                        <Badge variant="secondary">{dim.weight}%</Badge>
                      </div>
                      {dim.description && (
                        <p className="text-sm text-muted-foreground">{dim.description}</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Prompt Template
                        </Label>
                        <pre className="mt-1 whitespace-pre-wrap font-mono text-xs bg-[#0f0f0f] p-2 rounded">
                          {dim.prompt_template}
                        </pre>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Scoring Criteria
                        </Label>
                        <pre className="mt-1 whitespace-pre-wrap font-mono text-xs bg-[#0f0f0f] p-2 rounded">
                          {dim.scoring_criteria}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
