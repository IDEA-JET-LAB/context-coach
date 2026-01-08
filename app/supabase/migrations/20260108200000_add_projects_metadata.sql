-- Add metadata column to projects table
-- This allows storing import source path and other flexible metadata

ALTER TABLE projects ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add index for metadata queries (used by import to find existing projects)
CREATE INDEX IF NOT EXISTS idx_projects_metadata ON projects USING gin(metadata);

-- Add index specifically for import_source_path lookups
CREATE INDEX IF NOT EXISTS idx_projects_import_source_path ON projects ((metadata->>'import_source_path'))
WHERE metadata->>'import_source_path' IS NOT NULL;

COMMENT ON COLUMN projects.metadata IS 'Flexible metadata storage for projects. Used by import to store import_source_path.';
