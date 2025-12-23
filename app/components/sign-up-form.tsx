"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { Loader2 } from "lucide-react";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { useEffect } from "react";

interface SignUpFormProps extends React.ComponentPropsWithoutRef<"div"> {
  inviteToken?: string;
  prefillEmail?: string;
}

export function SignUpForm({
  className,
  inviteToken,
  prefillEmail,
  ...props
}: SignUpFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get invite token and email from URL params if not provided as props
  const token = inviteToken || searchParams.get("invite_token") || undefined;
  const emailFromParams = prefillEmail || searchParams.get("email") || "";

  // Get redirect URL from search params (used for invitation flows)
  const redirectTo = searchParams.get("redirect") || undefined;

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: emailFromParams,
      password: "",
      confirmPassword: "",
    },
  });

  // Update email field if prefillEmail changes
  useEffect(() => {
    if (emailFromParams) {
      form.setValue("email", emailFromParams);
    }
  }, [emailFromParams, form]);

  const { isSubmitting } = form.formState;

  // Check if this is an invitation signup (email should be readonly)
  const isInvitation = !!token && !!emailFromParams;

  async function onSubmit(data: SignupInput) {
    const supabase = createClient();

    // Build email redirect URL with invite token and/or redirect path if present
    let emailRedirectUrl = `${window.location.origin}/callback`;
    const emailParams = new URLSearchParams();
    if (token) {
      emailParams.set("invite_token", token);
    }
    if (redirectTo) {
      emailParams.set("next", redirectTo);
    }
    if (emailParams.toString()) {
      emailRedirectUrl += `?${emailParams.toString()}`;
    }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: emailRedirectUrl,
      },
    });

    if (error) {
      // Only show generic errors to prevent email enumeration
      if (error.message.includes("rate limit")) {
        form.setError("root", {
          message: "Too many attempts. Please try again later.",
        });
      } else {
        form.setError("root", {
          message: "An error occurred. Please try again.",
        });
      }
      return;
    }

    // Check if email confirmations are disabled (user is auto-confirmed)
    // This happens when enable_confirmations = false in Supabase config
    if (signUpData?.user?.email_confirmed_at) {
      // User is already confirmed, redirect to specified URL or home
      router.push(redirectTo || "/home");
      return;
    }

    // Email confirmation required - redirect to verification page
    let verifyUrl = "/verify-email?email=" + encodeURIComponent(data.email);
    if (token) {
      verifyUrl += "&invite_token=" + encodeURIComponent(token);
    }
    if (redirectTo) {
      verifyUrl += "&redirect=" + encodeURIComponent(redirectTo);
    }
    router.push(verifyUrl);
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>Create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {form.formState.errors.root && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {form.formState.errors.root.message}
                  </AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="m@example.com"
                        autoComplete="email"
                        readOnly={isInvitation}
                        className={isInvitation ? "bg-muted" : ""}
                        {...field}
                      />
                    </FormControl>
                    {isInvitation && (
                      <p className="text-xs text-muted-foreground">
                        Email is set by the invitation
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>

              <div className="text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="underline underline-offset-4">
                  Login
                </Link>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <GoogleAuthButton redirectTo={redirectTo} />
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
