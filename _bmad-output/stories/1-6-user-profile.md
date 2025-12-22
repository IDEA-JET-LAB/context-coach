# Story 1.6: User Profile Management

Status: ✅ Done

## Story

**As a** logged-in user,
**I want** to update my profile information,
**So that** my name and avatar reflect my identity in the platform.

## Acceptance Criteria

1. **Given** I am logged in and on the settings page (`/settings`)
   **When** I view my profile section
   **Then** I see my current name and avatar

2. **Given** I update my display name
   **When** I save the changes
   **Then** the `users.name` field is updated
   **And** I see a success toast "Profile updated"
   **And** my new name appears in the dashboard header

3. **Given** I upload a new avatar image
   **When** the image is valid (JPG/PNG, < 2MB)
   **Then** it is uploaded to Supabase Storage
   **And** `users.avatar_url` is updated with the new URL
   **And** my new avatar appears throughout the app

4. **Given** I upload an invalid file (wrong format or too large)
   **When** I try to save
   **Then** I see an error "Please upload a JPG or PNG image under 2MB"

## Tasks / Subtasks

- [ ] **Task 1: Create Supabase Storage bucket for avatars** (AC: #3)
  - [ ] Create `avatars` bucket in Supabase Storage
  - [ ] Configure bucket as public (avatars need to be viewable)
  - [ ] Set up storage policies for authenticated uploads
  - [ ] Add RLS policy: users can only upload to their own folder (`user_id/`)
  - [ ] Configure allowed MIME types (image/jpeg, image/png)
  - [ ] Set file size limit to 2MB in storage policy

- [ ] **Task 2: Create settings page route structure** (AC: #1)
  - [ ] Create `app/(dashboard)/settings/page.tsx`
  - [ ] Create `app/(dashboard)/settings/layout.tsx` (if needed for tabs)
  - [ ] Add settings link to dashboard sidebar navigation
  - [ ] Ensure page is protected by auth middleware

- [ ] **Task 3: Create profile form component** (AC: #1, #2)
  - [ ] Create `components/settings/profile-form.tsx`
  - [ ] Add form fields: display name (text input)
  - [ ] Add current avatar display with placeholder fallback
  - [ ] Use shadcn/ui form components (Input, Button, Label)
  - [ ] Add form validation using zod schema
  - [ ] Implement loading state during submission

- [ ] **Task 4: Create avatar upload component** (AC: #3, #4)
  - [ ] Create `components/settings/avatar-upload.tsx`
  - [ ] Add file input with drag-and-drop support
  - [ ] Add image preview before upload
  - [ ] Validate file type (JPG/PNG only) on client
  - [ ] Validate file size (< 2MB) on client
  - [ ] Show validation errors inline
  - [ ] Show upload progress indicator

- [ ] **Task 5: Implement avatar upload logic** (AC: #3)
  - [ ] Create `lib/storage/upload-avatar.ts` utility
  - [ ] Generate unique filename: `{user_id}/{timestamp}-{random}.{ext}`
  - [ ] Upload to Supabase Storage `avatars` bucket
  - [ ] Delete old avatar file if exists (cleanup)
  - [ ] Return public URL after successful upload

- [ ] **Task 6: Implement profile update API/action** (AC: #2, #3)
  - [ ] Create Server Action in `app/(dashboard)/settings/actions.ts`
  - [ ] Update `users.name` in database
  - [ ] Update `users.avatar_url` with new URL
  - [ ] Update `users.updated_at` timestamp
  - [ ] Return success/error response
  - [ ] Invalidate user profile cache (if using React Query)

- [ ] **Task 7: Add toast notifications** (AC: #2, #4)
  - [ ] Install/configure shadcn/ui toast component (if not present)
  - [ ] Show success toast on profile update
  - [ ] Show error toast for validation failures
  - [ ] Show error toast for upload failures

- [ ] **Task 8: Update dashboard header with user info** (AC: #2, #3)
  - [ ] Create/update `components/layout/user-nav.tsx`
  - [ ] Display user avatar with fallback initials
  - [ ] Display user name
  - [ ] Ensure component refetches/updates when profile changes
  - [ ] Add dropdown menu with settings link and logout

## Dev Notes

### Story Dependencies

- **Requires Story 1.1 complete:** This story depends on the `users` table created in Story 1.1 with columns: `id`, `name`, `avatar_url`, `updated_at`
- Verify the `users` table exists before starting Task 6

### Critical Architecture Constraints

**Technology Stack (From Architecture):**
- Supabase Storage for avatar files
- Supabase client for database updates
- shadcn/ui components (Input, Button, Avatar, Toast)
- Server Actions for form submission (Next.js 15)
- TanStack Query v5 for data fetching/caching (use `isPending`, not `isLoading`)

**File Naming Conventions:**
| Context | Convention | Example |
|---------|------------|---------|
| Component files | kebab-case.tsx | `profile-form.tsx` |
| Utility files | kebab-case.ts | `upload-avatar.ts` |
| React components | PascalCase | `ProfileForm`, `AvatarUpload` |

### Supabase Client Usage

| Location | Client | Import |
|----------|--------|--------|
| Server Actions | `createClient()` from server | `@/lib/supabase/server` |
| Client Components (avatar upload) | `createClient()` from client | `@/lib/supabase/client` |

### Auth Protection Verification

The `/settings` route is automatically protected because it lives under `app/(dashboard)/`. Verify by:
1. Checking `middleware.ts` redirects unauthenticated users from `/(dashboard)/*` routes
2. No additional protection needed if route is under the correct route group

### Supabase Storage Configuration

```sql
-- Avatars bucket: public read, authenticated write to own folder
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT
TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE
TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE
TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public avatar access" ON storage.objects FOR SELECT
TO public USING (bucket_id = 'avatars');
```

### Avatar Upload Utility

```typescript
// lib/storage/upload-avatar.ts
import { createClient } from '@/lib/supabase/client';

const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export interface UploadAvatarResult {
  success: boolean;
  url?: string;
  error?: {
    code: 'UPLOAD_FAILED' | 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE';
    message: string;
  };
}

export async function validateAvatarFile(file: File): Promise<string | null> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Please upload a JPG or PNG image';
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'Please upload an image under 2MB';
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
  const ext = file.name.split('.').pop();
  const filename = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Upload new avatar
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: { code: 'UPLOAD_FAILED', message: uploadError.message } };
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filename);

  // Delete old avatar if exists
  if (oldAvatarUrl) {
    const oldPath = extractPathFromUrl(oldAvatarUrl);
    if (oldPath) {
      await supabase.storage.from('avatars').remove([oldPath]);
    }
  }

  return { success: true, url: publicUrl };
}

function extractPathFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/avatars\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
```

### Profile Form Schema

```typescript
// lib/validations/profile.ts
import { z } from 'zod';

export const profileFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
```

### Form Component Integration

```tsx
// Profile form with shadcn/ui Form component
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { profileFormSchema, ProfileFormValues } from '@/lib/validations/profile';

const form = useForm<ProfileFormValues>({
  resolver: zodResolver(profileFormSchema),
  defaultValues: { name: user?.name ?? '' },
});
```

### Server Action for Profile Update

```typescript
// app/(dashboard)/settings/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateProfile(formData: {
  name: string;
  avatarUrl?: string;
}): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };
  }

  const updateData: { name: string; avatar_url?: string; updated_at: string } = {
    name: formData.name,
    updated_at: new Date().toISOString(),
  };

  if (formData.avatarUrl) {
    updateData.avatar_url = formData.avatarUrl;
  }

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', user.id);

  if (error) {
    return { success: false, error: { code: 'UPDATE_FAILED', message: error.message } };
  }

  revalidatePath('/settings');
  revalidatePath('/', 'layout'); // Revalidate header

  return { success: true };
}
```

### TanStack Query v5 Integration

```typescript
// Use isPending, NOT isLoading (v5 change)
const { data: user, isPending } = useQuery({
  queryKey: ['user', 'profile'],
  queryFn: () => fetchUserProfile(),
});

// Invalidate on mutation success
const mutation = useMutation({
  mutationFn: updateProfile,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
  },
});
```

### New Files Created

- `components/settings/profile-form.tsx`
- `components/settings/avatar-upload.tsx`
- `components/layout/user-nav.tsx`
- `lib/storage/upload-avatar.ts`
- `lib/validations/profile.ts`
- `app/(dashboard)/settings/page.tsx`
- `app/(dashboard)/settings/actions.ts`

### Avatar Display Component Pattern

```tsx
// Use shadcn/ui Avatar with fallback
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const initials = name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <Avatar>
      <AvatarImage src={avatarUrl} alt={name} />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
```

### Toast Setup

Ensure `<Toaster />` is added to the root layout:

```tsx
// app/layout.tsx
import { Toaster } from '@/components/ui/toaster';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

### Dependencies

**Required shadcn/ui components (install if not present):**
```bash
npx shadcn@latest add avatar toast input button label form
```

### References

- [Source: _bmad-output/architecture.md#Data-Architecture]
- [Source: _bmad-output/architecture.md#Project-Structure-Boundaries]
- [Source: _bmad-output/architecture.md#Implementation-Patterns-Consistency-Rules]
- [Source: _bmad-output/epics.md#Story-1.6-User-Profile-Management]

### Common Pitfalls to Avoid

1. **DO NOT** store avatar files in the database - use Supabase Storage
2. **DO NOT** allow users to upload files larger than 2MB - validate on both client and server
3. **DO NOT** skip file type validation - only allow JPG/PNG
4. **DO NOT** forget to clean up old avatar files when uploading new ones
5. **DO NOT** expose user_id folder structure in error messages
6. **DO NOT** use `any` type for file handling - properly type File objects
7. **DO NOT** skip the public URL generation after upload
8. **DO NOT** forget to update `updated_at` timestamp on profile changes

### Verification Checklist

After completing this story, verify:
- [ ] Settings page loads at `/settings` when logged in
- [ ] Current user name is displayed in the form
- [ ] Current avatar is displayed (or fallback initials if none)
- [ ] Can update display name successfully
- [ ] Success toast appears after saving name
- [ ] Name updates in dashboard header without page refresh
- [ ] Can upload JPG avatar image under 2MB
- [ ] Can upload PNG avatar image under 2MB
- [ ] Avatar preview shows before final save
- [ ] Uploaded avatar appears in header and settings
- [ ] Error appears when uploading non-image file
- [ ] Error appears when uploading file over 2MB
- [ ] Old avatar is deleted when new one is uploaded
- [ ] Supabase Storage bucket has correct RLS policies
- [ ] Unauthenticated users cannot access `/settings`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### File List

*To be filled by dev agent - list all files created/modified*
