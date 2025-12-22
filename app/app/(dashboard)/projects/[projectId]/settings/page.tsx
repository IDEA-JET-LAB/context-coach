import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Key, Terminal, AlertTriangle, Settings } from 'lucide-react';
import Link from 'next/link';
import { maskApiKey } from '@/lib/utils/api-key';
import { ProjectSettingsForm } from '@/components/projects/project-settings-form';
import { RegenerateKeyDialog } from '@/components/projects/regenerate-key-dialog';
import { ArchiveProjectDialog } from '@/components/projects/archive-project-dialog';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectSettingsPage({ params }: PageProps) {
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
              <Link href={`/projects/${projectId}`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Project
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Project Settings
            {project.is_archived && (
              <Badge variant="secondary">Archived</Badge>
            )}
          </h1>
          <p className="text-muted-foreground">
            {project.name} - {team?.name || 'Unknown Team'}
          </p>
        </div>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-medium">Read-only view</p>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Only team admins can modify project settings.
          </p>
        </div>
      )}

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          {isAdmin && <TabsTrigger value="danger">Danger Zone</TabsTrigger>}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>
                {isAdmin
                  ? 'Update your project name and description.'
                  : 'View project information.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectSettingsForm
                projectId={projectId}
                initialData={{
                  name: project.name,
                  description: project.description || '',
                }}
                isAdmin={isAdmin}
                isArchived={project.is_archived}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
              <CardDescription>
                Additional details about this project.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <p>{createdDate}</p>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Project ID</label>
                <p className="font-mono text-sm">{projectId}</p>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Team</label>
                <p>{team?.name || 'Unknown'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                <CardTitle>API Key</CardTitle>
              </div>
              <CardDescription>
                Use this key to authenticate API requests from this project.
                The full key is only shown once at creation or regeneration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-md">
                <p className="font-mono text-sm">
                  {project.api_key_prefix
                    ? maskApiKey(project.api_key_prefix)
                    : 'No API key (archived)'}
                </p>
              </div>

              {isAdmin && !project.is_archived && (
                <div className="flex justify-end">
                  <RegenerateKeyDialog projectId={projectId} />
                </div>
              )}

              {!isAdmin && (
                <p className="text-sm text-muted-foreground">
                  Only team admins can regenerate API keys.
                </p>
              )}
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
                To install Contextor in your repository, use the install token.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-900 text-slate-100 p-4 rounded-md">
                <p className="font-mono text-sm">
                  <span className="text-green-400">$</span> npx @contextor/cli init &quot;YOUR_INSTALL_TOKEN&quot;
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                The install token contains your API key and project configuration.
                {isAdmin
                  ? " If you've lost it, regenerate the API key to get a new install token."
                  : " Contact a team admin if you need a new install token."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger Zone Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="danger" className="space-y-6">
            <Card className="border-destructive/50">
              <CardHeader>
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <CardTitle>Danger Zone</CardTitle>
                </div>
                <CardDescription>
                  Irreversible and destructive actions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!project.is_archived ? (
                  <div className="flex items-start justify-between gap-4 p-4 border border-destructive/30 rounded-lg">
                    <div>
                      <h3 className="font-medium">Archive this project</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Archiving will immediately invalidate the API key and remove the project
                        from the active list. Historical data will remain accessible.
                      </p>
                    </div>
                    <ArchiveProjectDialog
                      projectId={projectId}
                      projectName={project.name}
                    />
                  </div>
                ) : (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">
                      This project has been archived. Its API key has been invalidated
                      and it no longer appears in the active projects list.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
