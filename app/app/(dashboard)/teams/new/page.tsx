import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CreateTeamForm } from '@/components/team/create-team-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function NewTeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create a New Team</CardTitle>
          <CardDescription>
            Create a team to organize your projects and collaborate with others.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTeamForm />
        </CardContent>
      </Card>
    </div>
  );
}
