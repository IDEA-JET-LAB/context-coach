import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Key, Terminal, Clock, Settings } from 'lucide-react';
import Link from 'next/link';
import { maskApiKey } from '@/lib/utils/api-key';
import { CliInstructions } from '@/components/onboarding/cli-instructions';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch the project
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, team_id, name, description, api_key_prefix, created_at, created_by, is_archived')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    notFound();
  }

  // Get team info
  const { data: team } = await supabase
    .from('teams')
    .select('name')
    .eq('id', project.team_id)
    .single();

  // Check if user is admin
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', project.team_id)
    .eq('user_id', user.id)
    .single();

  const isAdmin = membership?.role === 'admin';

  const createdDate = new Date(project.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex-1 w-full flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            {project.name}
            {project.is_archived && (
              <Badge variant="secondary">Archived</Badge>
            )}
          </h1>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Created {createdDate} in {team?.name || 'Unknown Team'}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/projects/${projectId}/settings`}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Link>
        </Button>
      </div>

      {/* API Key Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>API Key</CardTitle>
          </div>
          <CardDescription>
            Use this key to authenticate API requests from this project.
            The full key is only shown once at creation time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-md">
            <p className="font-mono text-sm">{maskApiKey(project.api_key_prefix)}</p>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {isAdmin
              ? "If you've lost your API key, you can regenerate it in Settings."
              : "If you've lost your API key, contact a team admin to regenerate it."}
          </p>
        </CardContent>
      </Card>

      {/* Installation Instructions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            <CardTitle>Installation</CardTitle>
          </div>
          <CardDescription>
            Generate an install token to set up Contextor in your repository.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CliInstructions projectId={project.id} />
          <p className="text-sm text-muted-foreground">
            The install token contains your API key and project configuration.
            Tokens expire after 1 hour for security.
          </p>
        </CardContent>
      </Card>

      {/* Stats Card (Placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
          <CardDescription>
            Prompt capture statistics for this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-muted rounded-md">
              <p className="text-3xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Total Prompts</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-md">
              <p className="text-3xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">This Week</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-md">
              <p className="text-3xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Contributors</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
