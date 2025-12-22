import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/login-form";
import { Loader2 } from "lucide-react";
import { getErrorMessage, getInfoMessage } from "@/lib/utils/auth-messages";

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; message?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect if already logged in
  if (user) {
    redirect("/prompts");
  }

  const params = await searchParams;

  // Use whitelisted messages to prevent phishing via crafted URLs
  const safeError = getErrorMessage(params.error);
  const safeMessage = getInfoMessage(params.message);

  return (
    <LoginForm
      sessionExpired={params.expired === "true"}
      message={safeMessage ?? undefined}
      error={safeError ?? undefined}
    />
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; message?: string; error?: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
