import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth/session";
import { ProfileForm } from "@/components/settings/profile-form";
import { Loader2 } from "lucide-react";

async function SettingsContent() {
  const profile = await getUserProfile();

  if (!profile) {
    redirect("/login?message=Your session has expired. Please log in again.");
  }

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="mb-8 text-3xl font-bold">Settings</h1>
      <ProfileForm
        user={{
          id: profile.id,
          name: profile.name,
          avatar_url: profile.avatar_url,
        }}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
