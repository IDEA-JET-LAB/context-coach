import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CreateFirstTeam } from '@/components/onboarding/create-first-team';
import { OnboardingChecklistWrapper } from '@/components/onboarding/onboarding-checklist-wrapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DashboardMetrics } from './DashboardMetrics';
import Link from 'next/link';
import { Plus } from 'lucide-react';

interface TeamMembership {
  role: string;
  team: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user has any teams
  const { data: teamsData } = await supabase
    .from('team_members')
    .select(
      `
      role,
      team:teams(id, name, description)
    `
    )
    .eq('user_id', user.id);

  const teams = (teamsData || []) as unknown as TeamMembership[];

  // If no teams, show onboarding
  if (teams.length === 0) {
    return <CreateFirstTeam />;
  }

  // Get current team from session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentTeamId = session?.user?.app_metadata?.team_id;

  // Find current team info or use first team
  const currentTeamData =
    teams.find((t) => t.team?.id === currentTeamId) || teams[0];
  const currentTeam = currentTeamData?.team;
  const isAdmin = currentTeamData?.role === 'admin';

  // Get project count for current team
  const { count: projectCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', currentTeam?.id || '');

  // Get team member count for current team
  const { count: memberCount } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', currentTeam?.id || '');

  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      {/* Onboarding Checklist */}
      <OnboardingChecklistWrapper />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{currentTeam?.name || 'Dashboard'}</h1>
          {currentTeam?.description && (
            <p className="text-muted-foreground mt-1">{currentTeam.description}</p>
          )}
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        )}
      </div>

      <DashboardMetrics
        memberCount={memberCount ?? 0}
        projectCount={projectCount ?? 0}
        promptCount={0}
        isAdmin={isAdmin}
      />

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your team and projects</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button variant="outline" asChild>
              <Link href={`/teams/${currentTeam?.id}/settings`}>Team Settings</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/projects">View Projects</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
