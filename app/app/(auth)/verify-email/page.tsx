"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { Loader2, Mail, CheckCircle } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResendVerification() {
    if (!email) return;

    setIsResending(true);
    setError(null);
    setResendSuccess(false);

    const supabase = createClient();

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (resendError) {
      if (resendError.message.includes("rate limit")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Failed to resend. Please try again later.");
      }
    } else {
      setResendSuccess(true);
    }

    setIsResending(false);
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Check your email</CardTitle>
              <CardDescription>
                We&apos;ve sent a verification link to confirm your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {email && (
                <p className="text-center text-sm text-muted-foreground">
                  Sent to{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              )}

              {resendSuccess && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Verification email sent! Please check your inbox.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {email && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleResendVerification}
                    disabled={isResending}
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Resend verification email"
                    )}
                  </Button>
                )}

                <Button variant="ghost" className="w-full" asChild>
                  <Link href="/login">Back to login</Link>
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Didn&apos;t receive an email? Check your spam folder or try
                resending.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
