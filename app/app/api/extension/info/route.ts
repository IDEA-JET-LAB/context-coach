/**
 * Extension Info API
 *
 * GET /api/extension/info
 *
 * Returns information about the latest VS Code extension version.
 * PUBLIC endpoint - no authentication required.
 * This allows the extension to check for updates even before user logs in.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createScopedLogger } from '@/lib/utils/logger';

const logger = createScopedLogger('API_EXTENSION_INFO');

interface ExtensionInfo {
  version: string;
  filename: string;
  releaseNotes?: string;
  minVSCodeVersion: string;
  publishedAt: string;
}

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

export async function GET() {
  try {
    // Use admin client since this is a public endpoint
    const adminClient = createAdminClient();

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

    const extensionInfo: ExtensionInfo = {
      version: latestFile.version!,
      filename: latestFile.name,
      releaseNotes: 'Bug fixes and performance improvements.',
      minVSCodeVersion: '1.85.0',
      publishedAt: latestFile.updated_at || latestFile.created_at || new Date().toISOString(),
    };

    logger.log('Extension info retrieved (public)', {
      version: extensionInfo.version,
      filename: extensionInfo.filename,
    });

    return NextResponse.json({
      success: true,
      data: extensionInfo,
    });
  } catch (error) {
    logger.error('Failed to get extension info', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
