"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  profileFormSchema,
  type ProfileFormValues,
} from "@/lib/validations/profile";
import {
  uploadAvatar,
  validateAvatarFile,
} from "@/lib/storage/upload-avatar";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, AlertCircle } from "lucide-react";

interface ProfileFormProps {
  user: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatar_url
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user.name ?? "",
    },
  });

  const { isSubmitting } = form.formState;

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }

    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function onSubmit(data: ProfileFormValues) {
    const supabase = createClient();
    let avatarUrl = user.avatar_url;

    // Upload avatar if changed
    if (avatarFile) {
      setIsUploading(true);
      const result = await uploadAvatar(user.id, avatarFile, user.avatar_url);
      setIsUploading(false);

      if (!result.success) {
        form.setError("root", {
          message: result.error?.message ?? "Failed to upload avatar",
        });
        return;
      }
      avatarUrl = result.url ?? null;
    }

    // Update profile
    const { error } = await supabase
      .from("users")
      .update({
        name: data.name,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      form.setError("root", {
        message: "Failed to update profile. Please try again.",
      });
      return;
    }

    toast.success("Profile updated successfully");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Update your display name and avatar
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

            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarPreview ?? undefined} alt={user.name ?? "Avatar"} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleAvatarChange}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting || isUploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                Change Avatar
              </Button>

              {avatarError && (
                <p className="text-sm text-destructive">{avatarError}</p>
              )}
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting || isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUploading ? "Uploading..." : "Saving..."}
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
