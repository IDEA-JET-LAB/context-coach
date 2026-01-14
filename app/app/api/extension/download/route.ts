/**
 * Extension Download API
 *
 * GET /api/extension/download
 *
 * Returns a signed download URL for the latest VS Code extension.
 * Accepts both browser session auth and VS Code token auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createScopedLogger } from '@/lib/utils/logger';

const logger = createScopedLogger('API_EXTENSION_DOWNLOAD');

/**
 * Extract version from VSIX filename.
 * Pattern: contextor-vscode-X.Y.Z.vsix
 */
function extractVersion(filename: string): string | null {
  const match = filename.match(/contextor-vscode-(\d+\.\d+\.\d+)\.vsix$/);
  return match?.[1] ?? null;
}

/**
 * Compare semver versions (returns positive if a > b, negative if a < b, 0 if equal)
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const partA = partsA[i] ?? 0;
    const partB = partsB[i] ?? 0;
    if (partA > partB) return 1;
    if (partA < partB) return -1;
  }
  return 0;
}

/**
 * Verify VS Code access token and return user ID.
 */
async function verifyVSCodeToken(
  accessToken: string,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  const { data: tokenRecord, error } = await adminClient
    .from('vscode_tokens')
    .select('user_id, access_token_expires_at, revoked_at')
    .eq('access_token', accessToken)
    .single();

  if (error || !tokenRecord) return null;
  if (tokenRecord.revoked_at) return null;
  if (new Date(tokenRecord.access_token_expires_at) < new Date()) return null;

  return tokenRecord.user_id;
}

export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    let userId: string | null = null;
    let authMethod = 'none';

    // Try VS Code token auth first (from Authorization header)
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7);
      userId = await verifyVSCodeToken(accessToken, adminClient);
      if (userId) {
        authMethod = 'vscode_token';
      }
    }

    // Fall back to browser session auth
    if (!userId) {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!authError && user) {
        userId = user.id;
        authMethod = 'browser_session';
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' } },
        { status: 401 }
      );
    }

    // List files in the extensions bucket
    const { data: files, error: listError } = await adminClient.storage
      .from('extensions')
      .list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (listError) {
      logger.error('Failed to list extension files', listError);
      return NextResponse.json(
        { error: { code: 'STORAGE_ERROR', message: 'Failed to access extension storage' } },
        { status: 500 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'No extension files available' } },
        { status: 404 }
      );
    }

    // Find VSIX files and get the latest version
    const vsixFiles = files
      .filter(f => f.name.endsWith('.vsix'))
      .map(f => ({
        ...f,
        version: extractVersion(f.name),
      }))
      .filter(f => f.version !== null)
      .sort((a, b) => compareVersions(b.version!, a.version!));

    const latestFile = vsixFiles[0];
    if (!latestFile) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'No valid extension files found' } },
        { status: 404 }
      );
    }

    // Generate signed download URL (valid for 10 minutes)
    const { data: signedUrl, error: signError } = await adminClient.storage
      .from('extensions')
      .createSignedUrl(latestFile.name, 600);

    if (signError || !signedUrl) {
      logger.error('Failed to create signed URL', signError);
      return NextResponse.json(
        { error: { code: 'STORAGE_ERROR', message: 'Failed to generate download URL' } },
        { status: 500 }
      );
    }

    logger.log('Extension download URL generated', {
      version: latestFile.version,
      filename: latestFile.name,
      userId,
      authMethod,
    });

    // Return JSON with download URL (instead of redirect, for extension compatibility)
    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: signedUrl.signedUrl,
        version: latestFile.version,
        filename: latestFile.name,
      },
    });
  } catch (error) {
    logger.error('Failed to get extension download', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
