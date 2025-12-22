-- Add user status columns for admin management
-- Story 7.3: User Management

-- Add is_disabled column
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false;

-- Add deleted_at for soft delete tracking
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add last_active_at for tracking
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_users_is_disabled ON public.users(is_disabled);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_not_deleted ON public.users(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_last_active ON public.users(last_active_at DESC NULLS LAST);

-- Comments for documentation
COMMENT ON COLUMN public.users.is_disabled IS 'Whether the user account is disabled by admin';
COMMENT ON COLUMN public.users.deleted_at IS 'Timestamp when user was soft deleted (anonymized)';
COMMENT ON COLUMN public.users.last_active_at IS 'Last activity timestamp for the user';
