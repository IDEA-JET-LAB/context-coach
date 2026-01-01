import { AdminDashboardContent } from '@/components/admin/dashboard-content';

/**
 * Overview Tab
 *
 * Displays platform metrics, trends, and system health indicators.
 * Wraps the existing AdminDashboardContent component.
 */
export function OverviewTab() {
  return (
    <div data-testid="overview-tab" className="space-y-6">
      <AdminDashboardContent />
    </div>
  );
}
