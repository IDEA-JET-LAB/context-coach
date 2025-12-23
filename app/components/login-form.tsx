"use client";

import { useState, useEffect, useRef } from "react";
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
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

interface LoginFormProps extends React.ComponentPropsWithoutRef<"div"> {
  sessionExpired?: boolean;
  message?: string;
  error?: string;
}

export function LoginForm({
  className,
  sessionExpired,
  message,
  error: initialError,
  ...props
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);

  // Get redirect URL from search params (used for invitation flows)
  const redirectTo = searchParams.get("redirect") || undefined;
  const passwordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoginAttemptRef = useRef<number>(0);
  const loginAttemptsRef = useRef<number>(0);

  // Auto-hide password after 5 seconds when revealed
  useEffect(() => {
    if (showPassword) {
      passwordTimeoutRef.current = setTimeout(() => {
        setShowPassword(false);
      }, 5000);
    }
    return () => {
      if (passwordTimeoutRef.current) {
        clearTimeout(passwordTimeoutRef.current);
      }
    };
  }, [showPassword]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: LoginInput) {
    // Client-side rate limiting: max 5 attempts per minute
    const now = Date.now();
    const timeSinceLastAttempt = now - lastLoginAttemptRef.current;

    // Reset counter if more than 60 seconds have passed
    if (timeSinceLastAttempt > 60000) {
      loginAttemptsRef.current = 0;
    }

    // Check if user has exceeded rate limit
    if (loginAttemptsRef.current >= 5 && timeSinceLastAttempt < 60000) {
      const remainingTime = Math.ceil((60000 - timeSinceLastAttempt) / 1000);
      form.setError("root", {
        message: `Too many login attempts. Please wait ${remainingTime} seconds.`,
      });
      return;
    }

    loginAttemptsRef.current++;
    lastLoginAttemptRef.current = now;

    const supabase = createClient();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        // Map Supabase errors to user-friendly messages
        if (error.message.includes("Invalid login credentials")) {
          form.setError("root", {
            message: "Invalid email or password",
          });
        } else if (error.message.includes("Email not confirmed")) {
          form.setError("root", {
            message: "Please verify your email before logging in",
          });
        } else if (error.code === "over_request_rate_limit") {
          form.setError("root", {
            message: "Too many attempts. Please wait a moment.",
          });
        } else {
          form.setError("root", {
            message: "An error occurred. Please try again.",
          });
        }
        return;
      }

      // Redirect to specified URL or dashboard on success
      router.push(redirectTo || "/prompts");
      router.refresh();
    } catch (err) {
      // Network error detection
      if (err instanceof TypeError && err.message.includes("fetch")) {
        form.setError("root", {
          message: "Unable to connect. Please check your internet.",
        });
      } else {
        form.setError("root", {
          message: "An unexpected error occurred. Please try again.",
        });
      }
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {sessionExpired && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your session has expired. Please log in again.
                  </AlertDescription>
                </Alert>
              )}

              {message && (
                <Alert className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}

              {initialError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{initialError}</AlertDescription>
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

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link
                        href="/reset-password"
                        className="text-sm underline-offset-4 hover:underline"
                      >
                        Forgot your password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>

              <div className="text-center text-sm">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="underline underline-offset-4">
                  Sign up
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
