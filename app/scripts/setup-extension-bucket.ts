/**
 * Setup Extension Storage Bucket
 *
 * Creates the 'extensions' storage bucket in Supabase and uploads the latest VSIX file.
 *
 * Usage: npx tsx scripts/setup-extension-bucket.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

async function main() {
  console.log('🔧 Setting up extension storage bucket...\n');

  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Check if bucket exists
  console.log('📦 Checking if "extensions" bucket exists...');
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('Failed to list buckets:', listError.message);
    process.exit(1);
  }

  const bucketExists = buckets?.some(b => b.name === 'extensions');

  if (bucketExists) {
    console.log('✅ Bucket "extensions" already exists\n');
  } else {
    console.log('📦 Creating "extensions" bucket...');
    const { error: createError } = await supabase.storage.createBucket('extensions', {
      public: false, // Use signed URLs for downloads
      fileSizeLimit: 10 * 1024 * 1024, // 10MB limit
      allowedMimeTypes: ['application/octet-stream', 'application/zip', 'application/x-zip-compressed'],
    });

    if (createError) {
      console.error('Failed to create bucket:', createError.message);
      process.exit(1);
    }
    console.log('✅ Bucket "extensions" created\n');
  }

  // Find the latest VSIX file
  const vsixDir = path.resolve(__dirname, '../../packages/vscode-extension');
  const files = fs.readdirSync(vsixDir);
  const vsixFiles = files
    .filter(f => f.match(/^contextor-vscode-\d+\.\d+\.\d+\.vsix$/))
    .sort((a, b) => {
      const versionA = a.match(/(\d+\.\d+\.\d+)/)?.[1] || '0.0.0';
      const versionB = b.match(/(\d+\.\d+\.\d+)/)?.[1] || '0.0.0';
      const partsA = versionA.split('.').map(Number);
      const partsB = versionB.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        const partA = partsA[i] ?? 0;
        const partB = partsB[i] ?? 0;
        if (partA > partB) return -1;
        if (partA < partB) return 1;
      }
      return 0;
    });

  const latestVsix = vsixFiles[0];
  if (!latestVsix) {
    console.log('⚠️  No VSIX files found in packages/vscode-extension/');
    console.log('   Run "npm run package" in the extension directory first.');
    process.exit(1);
  }

  const vsixPath = path.join(vsixDir, latestVsix);
  console.log(`📁 Found latest VSIX: ${latestVsix}`);

  // Read file
  const fileBuffer = fs.readFileSync(vsixPath);
  console.log(`   Size: ${(fileBuffer.length / 1024).toFixed(2)} KB\n`);

  // Check if file already exists in bucket
  console.log('📤 Checking existing files in bucket...');
  const { data: existingFiles } = await supabase.storage
    .from('extensions')
    .list('', { limit: 100 });

  const fileExists = existingFiles?.some(f => f.name === latestVsix);

  if (fileExists) {
    console.log(`⚠️  File ${latestVsix} already exists in bucket`);
    console.log('   Replacing with new upload...\n');

    // Remove existing file
    await supabase.storage.from('extensions').remove([latestVsix]);
  }

  // Upload file
  console.log(`📤 Uploading ${latestVsix}...`);
  const { error: uploadError } = await supabase.storage
    .from('extensions')
    .upload(latestVsix, fileBuffer, {
      contentType: 'application/octet-stream',
      upsert: true,
    });

  if (uploadError) {
    console.error('Failed to upload file:', uploadError.message);
    process.exit(1);
  }

  console.log('✅ File uploaded successfully!\n');

  // Verify upload
  const { data: verifyFiles } = await supabase.storage
    .from('extensions')
    .list('', { limit: 100 });

  console.log('📋 Files in "extensions" bucket:');
  for (const file of verifyFiles || []) {
    const version = file.name.match(/(\d+\.\d+\.\d+)/)?.[1] || 'unknown';
    console.log(`   - ${file.name} (v${version})`);
  }

  console.log('\n✅ Setup complete! Extension download is now available.');
}

main().catch(console.error);
