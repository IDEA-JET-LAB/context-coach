import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NewProjectForm } from '@/components/projects/new-project-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function NewProjectPage() {
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
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">No Team Selected</CardTitle>
            <CardDescription>
              You need to create or join a team before creating a project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/teams/new">Create a Team</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user is admin
  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single();

  if (membershipError || !membership || membership.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Permission Denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Only team admins can create new projects. Please contact your team admin if you need a project created.
              </AlertDescription>
            </Alert>
            <Button asChild variant="outline" className="w-full">
              <Link href="/projects">Back to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create a New Project</CardTitle>
          <CardDescription>
            Create a project to start capturing prompts from your repository.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewProjectForm />
        </CardContent>
      </Card>
    </div>
  );
}
