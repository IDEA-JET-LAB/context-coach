'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Suspense, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, FileText, Scale, Gauge } from 'lucide-react';

// Lazy load sub-tab content to improve performance
const ConfigSubtab = lazy(() => import('./analysis/config-subtab').then(m => ({ default: m.ConfigSubtab })));
const TemplatesSubtab = lazy(() => import('./analysis/templates-subtab').then(m => ({ default: m.TemplatesSubtab })));
const RulesSubtab = lazy(() => import('./analysis/rules-subtab').then(m => ({ default: m.RulesSubtab })));
const WeightsSubtab = lazy(() => import('./analysis/weights-subtab').then(m => ({ default: m.WeightsSubtab })));

interface AnalysisTabProps {
  activeSubtab: string;
}

const SUBTABS = [
  { id: 'config', label: 'Config', icon: Settings },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'rules', label: 'Rules', icon: Scale },
  { id: 'weights', label: 'Weights', icon: Gauge },
] as const;

function SubtabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Analysis Tab
 *
 * Sub-tabbed section for analysis configuration:
 * - Config: General analysis settings
 * - Templates: Prompt analysis templates
 * - Rules: Classification rules
 * - Weights: Scoring weights
 */
export function AnalysisTab({ activeSubtab }: AnalysisTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubtabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'analysis');
      params.set('subtab', value);
      router.push(`/admin/settings?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div data-testid="analysis-tab" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Analysis Configuration</h2>
        <p className="text-muted-foreground text-sm">
          Configure prompt analysis settings, templates, and scoring rules.
        </p>
      </div>

      <Tabs value={activeSubtab} onValueChange={handleSubtabChange}>
        <TabsList>
          {SUBTABS.map((subtab) => {
            const Icon = subtab.icon;
            return (
              <TabsTrigger key={subtab.id} value={subtab.id} className="gap-1.5">
                <Icon className="h-4 w-4" />
                {subtab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="config">
            <Suspense fallback={<SubtabSkeleton />}>
              <ConfigSubtab />
            </Suspense>
          </TabsContent>

          <TabsContent value="templates">
            <Suspense fallback={<SubtabSkeleton />}>
              <TemplatesSubtab />
            </Suspense>
          </TabsContent>

          <TabsContent value="rules">
            <Suspense fallback={<SubtabSkeleton />}>
              <RulesSubtab />
            </Suspense>
          </TabsContent>

          <TabsContent value="weights">
            <Suspense fallback={<SubtabSkeleton />}>
              <WeightsSubtab />
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
