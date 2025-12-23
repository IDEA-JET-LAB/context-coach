import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserProfile, getUser } from "@/lib/auth/session";
import { ProfileForm } from "@/components/settings/profile-form";
import { EmailChangeForm } from "@/components/settings/email-change-form";
import { PasswordChangeForm } from "@/components/settings/password-change-form";
import { DangerZone } from "@/components/settings/danger-zone";
import { SettingsMessageHandler } from "@/components/settings/settings-message-handler";
import { Loader2, History, ChevronRight } from "lucide-react";

async function SettingsContent() {
  const [profile, user] = await Promise.all([getUserProfile(), getUser()]);

  if (!profile || !user) {
    redirect("/login?message=session-expired");
  }

  // Check if user has email/password authentication (not just OAuth)
  const hasEmailProvider = user.identities?.some(
    (identity) => identity.provider === "email"
  ) ?? false;

  return (
    <div className="container max-w-2xl py-8">
      <SettingsMessageHandler />
      <h1 className="mb-8 text-3xl font-bold">Settings</h1>
      <div className="space-y-6">
        <ProfileForm
          user={{
            id: profile.id,
            name: profile.name,
            avatar_url: profile.avatar_url,
          }}
        />
        <EmailChangeForm
          currentEmail={user.email ?? ""}
          hasEmailProvider={hasEmailProvider}
        />
        <PasswordChangeForm hasEmailIdentity={hasEmailProvider} />

        {/* Data Management Section */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Data Management</h2>
          <Link
            href="/settings/import-history"
            className="flex items-center justify-between p-4 -mx-2 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Import History</p>
                <p className="text-sm text-muted-foreground">
                  View and manage your historical prompt imports
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        </div>

        <DangerZone userEmail={user.email ?? ""} />
      </div>
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
