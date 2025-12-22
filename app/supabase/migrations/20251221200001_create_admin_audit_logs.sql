-- Create admin audit logs table
-- Story 7.3: User Management - Audit logging for all admin actions

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.users(id),
  action VARCHAR(50) NOT NULL,  -- 'disable_user', 'enable_user', 'delete_user'
  target_user_id UUID REFERENCES public.users(id),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for querying by admin or target user
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON public.admin_audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.admin_audit_logs(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.admin_audit_logs(action, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only super admins can read audit logs
CREATE POLICY admin_audit_read ON public.admin_audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = TRUE)
  );

-- RLS Policy: Only super admins can insert audit logs (via service role)
-- Note: Inserts are done via service role client which bypasses RLS
CREATE POLICY admin_audit_insert ON public.admin_audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = TRUE)
  );

-- Comments for documentation
COMMENT ON TABLE public.admin_audit_logs IS 'Audit trail for all admin actions on user accounts';
COMMENT ON COLUMN public.admin_audit_logs.admin_id IS 'ID of the admin who performed the action';
COMMENT ON COLUMN public.admin_audit_logs.action IS 'Type of action: disable_user, enable_user, delete_user';
COMMENT ON COLUMN public.admin_audit_logs.target_user_id IS 'ID of the user affected by the action';
COMMENT ON COLUMN public.admin_audit_logs.details IS 'Additional details about the action (e.g., original email for deletions)';
