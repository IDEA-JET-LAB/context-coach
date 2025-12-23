-- Migration: Add encrypted API key column to projects table
-- Purpose: Allow any team member to generate install tokens by storing API key in reversible format
-- Security Note: This is a UX-first approach. The encryption key should be stored securely.

-- Add column for encrypted API key (nullable for existing projects)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN projects.api_key_encrypted IS 'AES-256-GCM encrypted API key for install token generation. Format: iv:authTag:ciphertext (all base64)';

-- Note: Existing projects will have NULL api_key_encrypted
-- They will need to regenerate their API key to enable team member token generation
