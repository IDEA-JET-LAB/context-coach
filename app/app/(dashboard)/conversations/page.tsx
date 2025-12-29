import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ConversationsPageClient } from "./ConversationsPageClient";
import { ConversationsLoading } from "./ConversationsLoading";

export const metadata = {
  title: "Conversations | Contextor",
  description: "Browse your Claude Code conversations",
};

/**
 * Conversations List Page
 *
 * Server component that handles authentication and initial data fetching,
 * then renders the client component for interactive features.
 */

interface PageProps {
  searchParams: Promise<{
    project_id?: string;
    stage?: string;
    has_loop?: string;
    sort_by?: string;
  }>;
}

export default async function ConversationsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's team
  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    redirect("/onboarding");
  }

  // Get projects for filter dropdown
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("team_id", membership.team_id)
    .order("name");

  return (
    <Suspense fallback={<ConversationsLoading />}>
      <ConversationsPageClient
        teamId={membership.team_id}
        projects={projects || []}
        currentUserId={user.id}
        initialFilters={{
          projectId: resolvedSearchParams.project_id,
          stage: resolvedSearchParams.stage,
          hasLoop:
            resolvedSearchParams.has_loop === "true"
              ? true
              : resolvedSearchParams.has_loop === "false"
                ? false
                : undefined,
          sortBy:
            (resolvedSearchParams.sort_by as "date" | "messages" | "score") ||
            "date",
        }}
      />
    </Suspense>
  );
}
