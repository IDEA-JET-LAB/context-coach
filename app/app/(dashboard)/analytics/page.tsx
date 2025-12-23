import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Your Analytics</h1>
      </div>
      <AnalyticsDashboard userId={user.id} />
    </div>
  );
}
