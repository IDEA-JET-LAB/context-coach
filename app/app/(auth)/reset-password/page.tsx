import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Loader2 } from "lucide-react";
import { getResetPasswordError } from "@/lib/utils/auth-messages";

async function ResetPasswordContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  // Use whitelisted error messages to prevent phishing via crafted URLs
  const safeError = getResetPasswordError(params.error);

  return <ForgotPasswordForm error={safeError ?? undefined} />;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
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
          <ResetPasswordContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
