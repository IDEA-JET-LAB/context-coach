import { Metadata } from 'next';
import { AdminDashboardContent } from '@/components/admin/dashboard-content';

export const metadata: Metadata = {
  title: 'Admin Dashboard | Contextor',
  description: 'Platform administration dashboard',
};

/**
 * Admin Dashboard Page
 * Story 7.2: Admin Dashboard Overview
 *
 * Displays platform metrics, trends, and system health indicators.
 * Protected by admin layout (Story 7.1).
 */
export default function AdminDashboardPage() {
  return (
    <div data-testid="admin-dashboard" className="space-y-6">
      <AdminDashboardContent />
    </div>
  );
}
