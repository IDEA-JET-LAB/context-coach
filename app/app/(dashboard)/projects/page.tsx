import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ProjectsList } from '@/components/projects/projects-list';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get current team from session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const teamId = session?.user?.app_metadata?.team_id;

  if (!teamId) {
    redirect('/teams/new');
  }

  // Check user's role in the team
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single();

  const isAdmin = membership?.role === 'admin';

  // Get team name
  const { data: team } = await supabase
    .from('teams')
    .select('name')
    .eq('id', teamId)
    .single();

  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage projects for {team?.name || 'your team'}
          </p>
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

      <ProjectsList isAdmin={isAdmin} />
    </div>
  );
}
