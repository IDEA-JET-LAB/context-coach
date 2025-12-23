'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AnalysisConfig, AnalysisDimension } from '@/lib/validations/analysis-config';
import {
  ArrowRight,
  Scale,
  FileText,
  ChevronDown,
  ChevronUp,
  Equal,
  ArrowUp,
  ArrowDown,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ExperimentConfigComparisonProps {
  controlConfig: AnalysisConfig;
  variantConfig: AnalysisConfig;
}

interface ConfigWithDimensions extends AnalysisConfig {
  analysis_dimensions: AnalysisDimension[];
}

interface DimensionDiff {
  name: string;
  control?: AnalysisDimension;
  variant?: AnalysisDimension;
  weightDiff: number;
  hasPromptDiff: boolean;
  hasScoringDiff: boolean;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
}

export function ExperimentConfigComparison({
  controlConfig,
  variantConfig,
}: ExperimentConfigComparisonProps) {
  const [controlWithDimensions, setControlWithDimensions] = useState<ConfigWithDimensions | null>(null);
  const [variantWithDimensions, setVariantWithDimensions] = useState<ConfigWithDimensions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPromptDiff, setShowPromptDiff] = useState(false);

  useEffect(() => {
    async function loadDimensions() {
      setIsLoading(true);
      const supabase = createClient();

      const [controlResult, variantResult] = await Promise.all([
        supabase
          .from('analysis_configs')
          .select(`
            *,
            analysis_dimensions(*)
          `)
          .eq('id', controlConfig.id)
          .single(),
        supabase
          .from('analysis_configs')
          .select(`
            *,
            analysis_dimensions(*)
          `)
          .eq('id', variantConfig.id)
          .single(),
      ]);

      if (controlResult.data) {
        setControlWithDimensions(controlResult.data as ConfigWithDimensions);
      }
      if (variantResult.data) {
        setVariantWithDimensions(variantResult.data as ConfigWithDimensions);
      }
      setIsLoading(false);
    }

    loadDimensions();
  }, [controlConfig.id, variantConfig.id]);

  if (isLoading) {
    return (
      <Card className="border-border bg-background">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuration Comparison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!controlWithDimensions || !variantWithDimensions) {
    return (
      <Card className="border-border bg-background">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Unable to load config details</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate dimension differences
  const dimensionDiffs: DimensionDiff[] = [];
  const allDimensionNames = new Set<string>();

  controlWithDimensions.analysis_dimensions.forEach(d => allDimensionNames.add(d.name));
  variantWithDimensions.analysis_dimensions.forEach(d => allDimensionNames.add(d.name));

  allDimensionNames.forEach(name => {
    const control = controlWithDimensions.analysis_dimensions.find(d => d.name === name);
    const variant = variantWithDimensions.analysis_dimensions.find(d => d.name === name);

    let status: DimensionDiff['status'] = 'unchanged';
    if (!control) status = 'added';
    else if (!variant) status = 'removed';
    else if (
      control.weight !== variant.weight ||
      control.prompt_template !== variant.prompt_template ||
      control.scoring_criteria !== variant.scoring_criteria ||
      control.enabled !== variant.enabled
    ) {
      status = 'changed';
    }

    dimensionDiffs.push({
      name,
      control,
      variant,
      weightDiff: (variant?.weight ?? 0) - (control?.weight ?? 0),
      hasPromptDiff: control?.prompt_template !== variant?.prompt_template,
      hasScoringDiff: control?.scoring_criteria !== variant?.scoring_criteria,
      status,
    });
  });

  // Sort by status (changed first) then by name
  dimensionDiffs.sort((a, b) => {
    const statusOrder = { changed: 0, added: 1, removed: 2, unchanged: 3 };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return a.name.localeCompare(b.name);
  });

  const hasModelDiff = controlWithDimensions.model !== variantWithDimensions.model;
  const hasSystemPromptDiff = controlWithDimensions.system_prompt !== variantWithDimensions.system_prompt;
  const changedCount = dimensionDiffs.filter(d => d.status !== 'unchanged').length;

  return (
    <Card className="border-border bg-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Configuration Comparison
            {changedCount > 0 && (
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-500">
                {changedCount} difference{changedCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Config Names */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-1">Control</p>
            <p className="font-medium">{controlWithDimensions.name}</p>
            <p className="text-xs text-muted-foreground">v{controlWithDimensions.version}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground mx-4" />
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-1">Variant</p>
            <p className="font-medium">{variantWithDimensions.name}</p>
            <p className="text-xs text-muted-foreground">v{variantWithDimensions.version}</p>
          </div>
        </div>

        {/* Model and System Prompt Differences */}
        {(hasModelDiff || hasSystemPromptDiff) && (
          <div className="space-y-2">
            {hasModelDiff && (
              <div className="flex items-center justify-between rounded-lg border border-amber-500/50 bg-amber-500/10 p-2">
                <span className="text-sm font-medium">Model</span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{controlWithDimensions.model}</span>
                  <ArrowRight className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-500">{variantWithDimensions.model}</span>
                </div>
              </div>
            )}
            {hasSystemPromptDiff && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => setShowPromptDiff(!showPromptDiff)}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    System Prompt Changed
                  </span>
                  {showPromptDiff ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                {showPromptDiff && (
                  <Tabs defaultValue="control" className="mt-2">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="control">Control</TabsTrigger>
                      <TabsTrigger value="variant">Variant</TabsTrigger>
                    </TabsList>
                    <TabsContent value="control" className="mt-2">
                      <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-32">
                        {controlWithDimensions.system_prompt}
                      </pre>
                    </TabsContent>
                    <TabsContent value="variant" className="mt-2">
                      <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-32">
                        {variantWithDimensions.system_prompt}
                      </pre>
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dimension Weights Comparison */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Scale className="h-4 w-4" />
            Dimension Weights
          </div>
          <div className="space-y-1">
            {dimensionDiffs.map((diff) => (
              <div
                key={diff.name}
                className={cn(
                  'flex items-center justify-between rounded-lg p-2 text-sm',
                  diff.status === 'changed' && 'bg-amber-500/10 border border-amber-500/50',
                  diff.status === 'added' && 'bg-green-500/10 border border-green-500/50',
                  diff.status === 'removed' && 'bg-red-500/10 border border-red-500/50',
                  diff.status === 'unchanged' && 'bg-muted/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{diff.name}</span>
                  {diff.status === 'added' && (
                    <Badge variant="secondary" className="bg-green-500/20 text-green-500 text-xs">
                      New
                    </Badge>
                  )}
                  {diff.status === 'removed' && (
                    <Badge variant="secondary" className="bg-red-500/20 text-red-500 text-xs">
                      Removed
                    </Badge>
                  )}
                  {diff.hasPromptDiff && (
                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-500 text-xs">
                      Prompt
                    </Badge>
                  )}
                  {diff.hasScoringDiff && (
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-500 text-xs">
                      Criteria
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-10 text-right">
                    {diff.control?.weight ?? '-'}%
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className={cn(
                    'w-10 text-right font-medium',
                    diff.weightDiff > 0 && 'text-green-500',
                    diff.weightDiff < 0 && 'text-red-500'
                  )}>
                    {diff.variant?.weight ?? '-'}%
                  </span>
                  {diff.weightDiff !== 0 && (
                    <span className={cn(
                      'flex items-center text-xs',
                      diff.weightDiff > 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      {diff.weightDiff > 0 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {Math.abs(diff.weightDiff)}
                    </span>
                  )}
                  {diff.weightDiff === 0 && diff.status === 'unchanged' && (
                    <Equal className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* No differences message */}
        {changedCount === 0 && !hasModelDiff && !hasSystemPromptDiff && (
          <div className="text-center py-4 text-muted-foreground">
            <Equal className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm">These configurations are identical</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
