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
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";
import { Loader2, Mail, AlertCircle } from "lucide-react";

interface ForgotPasswordFormProps extends React.ComponentPropsWithoutRef<"div"> {
  error?: string;
}

export function ForgotPasswordForm({
  className,
  error: initialError,
  ...props
}: ForgotPasswordFormProps) {
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: ForgotPasswordInput) {
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/callback?type=recovery`,
    });

    if (error) {
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

    // Always show success to prevent email enumeration
    setSubmittedEmail(data.email);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We&apos;ve sent a password reset link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              If an account exists for{" "}
              <span className="font-medium text-foreground">
                {submittedEmail}
              </span>
              , you&apos;ll receive a password reset link shortly.
            </p>
            <Button variant="ghost" className="w-full" asChild>
              <Link href="/login">Back to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a link to reset your
            password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {initialError && (
                <Alert
                  variant="destructive"
                  className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {initialError === "expired"
                      ? "This reset link has expired. Please request a new one."
                      : initialError}
                  </AlertDescription>
                </Alert>
              )}

              {form.formState.errors.root && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
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
                    Sending...
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>

              <div className="text-center text-sm">
                Remember your password?{" "}
                <Link href="/login" className="underline underline-offset-4">
                  Login
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
