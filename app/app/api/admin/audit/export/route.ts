import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdminApi } from '@/lib/auth/admin';
import { exportAuditLogsCsv } from '@/lib/services/audit-log';
import type { AuditAction, AuditEntityType, AuditLogFilters } from '@/lib/types/audit';

/**
 * GET /api/admin/audit/export
 *
 * Export audit logs as CSV file.
 * Requires super admin access.
 *
 * Query parameters:
 * - action: comma-separated action types
 * - entity_type: comma-separated entity types
 * - changed_by: user ID
 * - date_from: ISO date string
 * - date_to: ISO date string
 * - search: text search
 */
export async function GET(request: NextRequest) {
  // Verify super admin access
  const auth = await requireSuperAdminApi();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;

    const filters: AuditLogFilters = {};

    // Parse action filter
    const actionParam = searchParams.get('action');
    if (actionParam) {
      filters.action = actionParam.split(',') as AuditAction[];
    }

    // Parse entity type filter
    const entityTypeParam = searchParams.get('entity_type');
    if (entityTypeParam) {
      filters.entity_type = entityTypeParam.split(',') as AuditEntityType[];
    }

    // Parse other filters
    const changedBy = searchParams.get('changed_by');
    if (changedBy) {
      filters.changed_by = changedBy;
    }

    const dateFrom = searchParams.get('date_from');
    if (dateFrom) {
      filters.date_from = dateFrom;
    }

    const dateTo = searchParams.get('date_to');
    if (dateTo) {
      filters.date_to = dateTo;
    }

    const search = searchParams.get('search');
    if (search) {
      filters.search = search;
    }

    // Export audit logs
    const result = await exportAuditLogsCsv(filters);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: result.error.code, message: result.error.message } },
        { status: 500 }
      );
    }

    // Return CSV file
    const headers = new Headers();
    headers.set('Content-Type', 'text/csv; charset=utf-8');
    headers.set(
      'Content-Disposition',
      `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.csv"`
    );

    return new NextResponse(result.data, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[Audit Export] Unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to export audit logs' } },
      { status: 500 }
    );
  }
}
