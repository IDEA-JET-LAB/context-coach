import { createClient } from "@/lib/supabase/client";

const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export interface UploadAvatarResult {
  success: boolean;
  url?: string;
  error?: {
    code: "UPLOAD_FAILED" | "INVALID_FILE_TYPE" | "FILE_TOO_LARGE";
    message: string;
  };
}

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Please upload a JPG or PNG image";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "Please upload an image under 2MB";
  }
  return null;
}

export async function uploadAvatar(
  userId: string,
  file: File,
  oldAvatarUrl?: string | null
): Promise<UploadAvatarResult> {
  const supabase = createClient();

  // Generate unique filename
  const ext = file.name.split(".").pop();
  const filename = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Upload new avatar
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filename, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return {
      success: false,
      error: { code: "UPLOAD_FAILED", message: uploadError.message },
    };
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(filename);

  // Delete old avatar if exists
  if (oldAvatarUrl) {
    const oldPath = extractPathFromUrl(oldAvatarUrl);
    if (oldPath) {
      await supabase.storage.from("avatars").remove([oldPath]);
    }
  }

  return { success: true, url: publicUrl };
}

function extractPathFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/avatars\/(.+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
