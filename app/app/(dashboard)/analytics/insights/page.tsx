import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InsightsDashboard } from './insights-dashboard';

export const metadata = {
  title: 'Insights | Contextor',
  description: 'Interactive analytics dashboard with personalized insights',
};

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's current team
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Insights Dashboard</h1>
          <p className="text-muted-foreground">
            Visualize your prompting patterns and track your progress
          </p>
        </div>
      </div>
      <InsightsDashboard userId={user.id} teamId={membership?.team_id} />
    </div>
  );
}
