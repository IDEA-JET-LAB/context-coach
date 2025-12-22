import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { ProjectSuccessContent } from '@/components/projects/project-success-content';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectCreatedPage({ params }: PageProps) {
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

  return <ProjectSuccessContent project={project} />;
}
