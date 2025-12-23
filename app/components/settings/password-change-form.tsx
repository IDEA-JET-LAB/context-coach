"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  passwordChangeSchema,
  setPasswordSchema,
  validatePassword,
  PASSWORD_RULES,
  type PasswordChangeInput,
  type SetPasswordInput,
} from "@/lib/validations/password";
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
import { Progress } from "@/components/ui/progress";
import { showToast } from "@/components/feedback";
import { Loader2, AlertCircle, Check, X, Eye, EyeOff, Shield, Lock } from "lucide-react";

interface PasswordChangeFormProps {
  /** Whether the user has an email/password identity (vs OAuth-only) */
  hasEmailIdentity: boolean;
}

type FormValues = PasswordChangeInput | SetPasswordInput;

export function PasswordChangeForm({ hasEmailIdentity }: PasswordChangeFormProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState("");

  // Choose schema based on whether user has email identity
  const schema = hasEmailIdentity ? passwordChangeSchema : setPasswordSchema;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: hasEmailIdentity
      ? { currentPassword: "", newPassword: "", confirmNewPassword: "" }
      : { newPassword: "", confirmNewPassword: "" },
    mode: "onChange",
  });

  const { isSubmitting } = form.formState;

  // Real-time password validation
  const passwordValidation = useMemo(
    () => validatePassword(newPasswordValue),
    [newPasswordValue]
  );

  // Calculate strength percentage
  const strengthPercentage = (passwordValidation.passedCount / passwordValidation.totalCount) * 100;

  // Determine strength label and color
  const getStrengthInfo = () => {
    if (passwordValidation.passedCount === 0) return { label: "", color: "bg-muted" };
    if (passwordValidation.passedCount === 1) return { label: "Weak", color: "bg-destructive" };
    if (passwordValidation.passedCount === 2) return { label: "Fair", color: "bg-orange-500" };
    if (passwordValidation.passedCount === 3) return { label: "Good", color: "bg-yellow-500" };
    return { label: "Strong", color: "bg-green-500" };
  };

  const strengthInfo = getStrengthInfo();

  async function onSubmit(data: FormValues) {
    const supabase = createClient();

    // If user has email identity, verify current password first
    if (hasEmailIdentity) {
      const changeData = data as PasswordChangeInput;

      // Get current user email
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) {
        form.setError("root", {
          message: "Unable to verify your identity. Please try logging in again.",
        });
        return;
      }

      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: changeData.currentPassword,
      });

      if (signInError) {
        form.setError("currentPassword", {
          message: "Current password is incorrect",
        });
        return;
      }
    }

    // Update password
    const newPassword = "newPassword" in data ? data.newPassword : "";
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      form.setError("root", {
        message: updateError.message || "Failed to update password. Please try again.",
      });
      return;
    }

    // Success
    showToast.success(
      hasEmailIdentity
        ? "Password changed successfully"
        : "Password set successfully. You can now log in with email and password."
    );
    form.reset();
    setNewPasswordValue("");
  }

  const title = hasEmailIdentity ? "Change Password" : "Set Password";
  const description = hasEmailIdentity
    ? "Update your account password"
    : "Add a password to log in with email and password";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {form.formState.errors.root && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {form.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Current Password (only for email users) */}
            {hasEmailIdentity && (
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="Enter your current password"
                          autoComplete="current-password"
                          className="pr-10"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* New Password */}
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter your new password"
                        autoComplete="new-password"
                        className="pr-10"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setNewPasswordValue(e.target.value);
                        }}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <FormMessage />

                  {/* Password Strength Indicator */}
                  {newPasswordValue.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Password strength</span>
                        <span className={`font-medium ${
                          passwordValidation.isValid ? "text-green-600" : "text-muted-foreground"
                        }`}>
                          {strengthInfo.label}
                        </span>
                      </div>
                      <Progress
                        value={strengthPercentage}
                        className="h-2"
                        aria-label="Password strength"
                      />

                      {/* Requirements Checklist */}
                      <ul className="mt-2 space-y-1">
                        {PASSWORD_RULES.map((rule) => {
                          const passed = passwordValidation.checks[rule.key];
                          return (
                            <li
                              key={rule.key}
                              className={`flex items-center gap-2 text-sm ${
                                passed ? "text-green-600" : "text-muted-foreground"
                              }`}
                            >
                              {passed ? (
                                <Check className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <X className="h-4 w-4" aria-hidden="true" />
                              )}
                              <span>{rule.message}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </FormItem>
              )}
            />

            {/* Confirm New Password */}
            <FormField
              control={form.control}
              name="confirmNewPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your new password"
                        autoComplete="new-password"
                        className="pr-10"
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {hasEmailIdentity ? "Changing Password..." : "Setting Password..."}
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  {title}
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
