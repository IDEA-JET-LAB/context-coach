/**
 * Project Stage Analytics Page - Story 31-9
 *
 * Server component that renders the StageDashboard for a project.
 */

import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { StageDashboard } from "@/components/analytics/stage-dashboard";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectStagesPage({ params }: PageProps) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the project
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, team_id, name")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    notFound();
  }

  // Check team membership
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", project.team_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    notFound();
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-6 max-w-6xl mx-auto">
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
          <h1 className="text-3xl font-bold">Stage Analytics</h1>
          <p className="text-muted-foreground">
            Analyze how time is spent across different project stages in {project.name}.
          </p>
        </div>
      </div>

      {/* Dashboard */}
      <StageDashboard projectId={projectId} />
    </div>
  );
}
