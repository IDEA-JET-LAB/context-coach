-- Add email column to users table for easier querying
-- Story 7.3: User Management

-- Add email column
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for email searches
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Update existing users to have email from auth.users
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE u.id = a.id AND u.email IS NULL;

-- Update the trigger to also copy email on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'user_name'
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON COLUMN public.users.email IS 'User email, synced from auth.users on creation';
