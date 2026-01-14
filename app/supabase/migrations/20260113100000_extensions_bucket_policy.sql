-- Extensions Storage Bucket Policy
-- Allows authenticated users to download VS Code extension files

-- First, ensure the bucket exists (idempotent - bucket may already exist from script)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'extensions',
  'extensions',
  false,
  10485760, -- 10MB
  ARRAY['application/octet-stream', 'application/zip', 'application/x-zip-compressed']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to download extension files
CREATE POLICY "Authenticated users can download extensions" ON storage.objects FOR SELECT
TO authenticated USING (bucket_id = 'extensions');
