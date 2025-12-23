-- Migration: Create VS Code authentication tables
-- Purpose: Store OAuth authorization codes and tokens for VS Code extension
-- Story: 19-2 Authentication Flow

-- Table: vscode_auth_codes
-- Stores temporary authorization codes for the OAuth flow
-- These are one-time use codes that expire after 5 minutes
CREATE TABLE IF NOT EXISTS vscode_auth_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    state TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast code lookup
CREATE INDEX IF NOT EXISTS idx_vscode_auth_codes_code ON vscode_auth_codes(code);

-- Index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_vscode_auth_codes_expires_at ON vscode_auth_codes(expires_at);

-- Table: vscode_tokens
-- Stores access and refresh tokens for authenticated VS Code sessions
CREATE TABLE IF NOT EXISTS vscode_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token UUID NOT NULL UNIQUE,
    refresh_token UUID NOT NULL UNIQUE,
    access_token_expires_at TIMESTAMPTZ NOT NULL,
    refresh_token_expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for access token lookup
CREATE INDEX IF NOT EXISTS idx_vscode_tokens_access_token ON vscode_tokens(access_token);

-- Index for refresh token lookup
CREATE INDEX IF NOT EXISTS idx_vscode_tokens_refresh_token ON vscode_tokens(refresh_token);

-- Index for user's tokens (for listing/revoking all user tokens)
CREATE INDEX IF NOT EXISTS idx_vscode_tokens_user_id ON vscode_tokens(user_id);

-- Function to clean up expired auth codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_vscode_auth_codes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM vscode_auth_codes
    WHERE expires_at < NOW() - INTERVAL '1 hour';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old revoked tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_vscode_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM vscode_tokens
    WHERE revoked_at < NOW() - INTERVAL '7 days'
       OR refresh_token_expires_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
-- Note: These tables are accessed by admin client (service role) only
-- Regular users should not have direct access

ALTER TABLE vscode_auth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vscode_tokens ENABLE ROW LEVEL SECURITY;

-- No RLS policies for regular users - only service role can access
-- This is intentional as these tables are managed by the API only

-- Comments for documentation
COMMENT ON TABLE vscode_auth_codes IS 'Temporary OAuth authorization codes for VS Code extension authentication';
COMMENT ON TABLE vscode_tokens IS 'Access and refresh tokens for authenticated VS Code extension sessions';
COMMENT ON COLUMN vscode_auth_codes.code IS 'One-time use authorization code (UUID)';
COMMENT ON COLUMN vscode_auth_codes.state IS 'CSRF protection token from the extension';
COMMENT ON COLUMN vscode_auth_codes.used_at IS 'When the code was exchanged for tokens (null if not used)';
COMMENT ON COLUMN vscode_tokens.revoked_at IS 'When the token was revoked (null if active)';
