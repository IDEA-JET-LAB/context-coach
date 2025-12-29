import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ConversationThreadClient } from "./ConversationThreadClient";
import { ConversationThreadLoading } from "./ConversationThreadLoading";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { sessionId } = await params;
  return {
    title: `Conversation | Contextor`,
    description: `View conversation ${sessionId}`,
  };
}

/**
 * Conversation Thread Page
 *
 * Server component that handles authentication and passes session info
 * to the client component which fetches data via API hooks.
 */
export default async function ConversationThreadPage({ params }: PageProps) {
  const { sessionId } = await params;
  const supabase = await createClient();

  // Authenticate user
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

  return (
    <Suspense fallback={<ConversationThreadLoading />}>
      <ConversationThreadClient
        sessionId={sessionId}
        teamId={membership.team_id}
      />
    </Suspense>
  );
}
