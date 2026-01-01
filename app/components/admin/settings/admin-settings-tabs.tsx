'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings2,
  FlaskConical,
  Filter,
  Activity,
  History,
} from 'lucide-react';

// Tab content components (will be created next)
import { OverviewTab } from './tabs/overview-tab';
import { UsersTab } from './tabs/users-tab';
import { TeamsTab } from './tabs/teams-tab';
import { AnalysisTab } from './tabs/analysis-tab';
import { ExperimentsTab } from './tabs/experiments-tab';
import { FilteringTab } from './tabs/filtering-tab';
import { SystemTab } from './tabs/system-tab';
import { AuditTab } from './tabs/audit-tab';

interface AdminSettingsTabsProps {
  activeTab: string;
  activeSubtab: string;
  searchParams: {
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
  };
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'teams', label: 'Teams', icon: Building2 },
  { id: 'analysis', label: 'Analysis', icon: Settings2 },
  { id: 'experiments', label: 'Experiments', icon: FlaskConical },
  { id: 'filtering', label: 'Filtering', icon: Filter },
  { id: 'system', label: 'System', icon: Activity },
  { id: 'audit', label: 'Audit', icon: History },
] as const;

export function AdminSettingsTabs({
  activeTab,
  activeSubtab,
  searchParams,
}: AdminSettingsTabsProps) {
  const router = useRouter();
  const urlSearchParams = useSearchParams();

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(urlSearchParams.toString());
      params.set('tab', value);
      // Reset subtab when switching main tabs
      params.delete('subtab');
      // Reset pagination when switching tabs
      params.delete('page');
      router.push(`/admin/settings?${params.toString()}`);
    },
    [router, urlSearchParams]
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 h-auto gap-1 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs sm:text-sm"
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      <div className="mt-6">
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab searchParams={searchParams} />
        </TabsContent>

        <TabsContent value="teams">
          <TeamsTab searchParams={searchParams} />
        </TabsContent>

        <TabsContent value="analysis">
          <AnalysisTab activeSubtab={activeSubtab} />
        </TabsContent>

        <TabsContent value="experiments">
          <ExperimentsTab searchParams={searchParams} />
        </TabsContent>

        <TabsContent value="filtering">
          <FilteringTab />
        </TabsContent>

        <TabsContent value="system">
          <SystemTab />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}
