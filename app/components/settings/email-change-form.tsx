"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  emailChangeSchema,
  type EmailChangeInput,
} from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { showToast } from "@/components/feedback";
import { Loader2, AlertCircle, Mail, Pencil, CheckCircle2 } from "lucide-react";

interface EmailChangeFormProps {
  currentEmail: string;
  hasEmailProvider: boolean;
}

export function EmailChangeForm({
  currentEmail,
  hasEmailProvider,
}: EmailChangeFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const form = useForm<EmailChangeInput>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: {
      newEmail: "",
      currentPassword: "",
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: EmailChangeInput) {
    const supabase = createClient();

    // Step 1: Re-authenticate the user with current password
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: data.currentPassword,
    });

    if (authError) {
      form.setError("currentPassword", {
        message: "Incorrect password",
      });
      return;
    }

    // Step 2: Request email change
    const { error: updateError } = await supabase.auth.updateUser({
      email: data.newEmail,
    });

    if (updateError) {
      // Handle "email already in use" error
      if (
        updateError.message.toLowerCase().includes("already registered") ||
        updateError.message.toLowerCase().includes("already in use") ||
        updateError.message.toLowerCase().includes("email address has already been registered")
      ) {
        form.setError("newEmail", {
          message: "This email is already registered to another account",
        });
        return;
      }

      // Handle email sending errors (common in local development)
      if (
        updateError.message.toLowerCase().includes("error sending") ||
        updateError.message.toLowerCase().includes("email change")
      ) {
        form.setError("root", {
          message: "Unable to send confirmation email. Please try again later.",
        });
        return;
      }

      form.setError("root", {
        message: updateError.message || "Failed to update email. Please try again.",
      });
      return;
    }

    // Success - show confirmation message
    setShowSuccess(true);
    showToast.success("Check your new email for a confirmation link");
  }

  function handleClose() {
    setIsOpen(false);
    setShowSuccess(false);
    form.reset();
    if (showSuccess) {
      router.refresh();
    }
  }

  // OAuth-only users need to set a password first
  if (!hasEmailProvider) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Address
          </CardTitle>
          <CardDescription>
            Your email address associated with this account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{currentEmail}</span>
            <Button variant="outline" size="sm" disabled>
              <Pencil className="mr-2 h-4 w-4" />
              Set password first
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            You signed up with a social login. To change your email, you must first set a password in your account settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="email-change-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Address
        </CardTitle>
        <CardDescription>
          Your email address associated with this account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{currentEmail}</span>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Email Address</DialogTitle>
                <DialogDescription>
                  Enter your new email address and current password. We will send
                  a confirmation link to your new email.
                </DialogDescription>
              </DialogHeader>

              {showSuccess ? (
                <div className="space-y-4 py-4">
                  <Alert className="border-green-200 bg-green-50 text-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                      We have sent a confirmation link to your new email address.
                      Please check your inbox and click the link to complete the
                      email change.
                    </AlertDescription>
                  </Alert>
                  <Button onClick={handleClose} className="w-full">
                    Close
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
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
                      name="newEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Email Address</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="newemail@example.com"
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
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter your current password"
                              autoComplete="current-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        className="flex-1"
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Send Confirmation"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
