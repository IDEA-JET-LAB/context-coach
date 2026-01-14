import { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminSettingsTabs } from '@/components/admin/settings/admin-settings-tabs';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Settings | Admin',
  description: 'Platform administration settings',
};

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    subtab?: string;
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
    category?: string;
  }>;
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Admin Settings Page
 *
 * Consolidated admin settings with tabs:
 * - Overview: Dashboard metrics
 * - Users: User management
 * - Teams: Team management
 * - Analysis: Config, Templates, Rules, Weights (sub-tabs)
 * - Experiments: A/B testing
 * - Filtering: Prompt capture configuration (NEW)
 * - System: Health monitoring
 * - Audit: Change history
 */
export default async function AdminSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeTab = params.tab || 'overview';
  const activeSubtab = params.subtab || 'config';

  return (
    <div data-testid="admin-settings-page">
      <Suspense fallback={<SettingsSkeleton />}>
        <AdminSettingsTabs
          activeTab={activeTab}
          activeSubtab={activeSubtab}
          searchParams={params}
        />
      </Suspense>
    </div>
  );
}
