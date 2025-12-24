'use server';

/**
 * Configuration Audit Log Service
 * Story 22-10: Configuration Audit Trail
 *
 * Provides functions for logging and querying configuration changes.
 * All logging is non-blocking to avoid impacting main operations.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/utils/request-context';
import { verifySuperAdmin, SuperAdminError } from '@/lib/auth/admin';
import type {
  CreateAuditLogInput,
  AuditLogEntry,
  AuditLogFilters,
  AuditLogResponse,
  AuditAction,
  AuditEntityType,
} from '@/lib/types/audit';
import { getActionVerb, getEntityLabel } from '@/lib/types/audit';

/**
 * Action result type for consistent error handling
 */
export type AuditActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

/**
 * Generate a human-readable summary of the change
 */
function generateChangeSummary(input: CreateAuditLogInput): string {
  const verb = getActionVerb(input.action);
  const entityLabel = getEntityLabel(input.entity_type);
  const entityName = input.entity_name ? `: "${input.entity_name}"` : '';

  return `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${entityLabel}${entityName}`;
}

/**
 * Create an audit log entry for a configuration change.
 * This function is non-blocking - it logs errors but doesn't throw.
 *
 * @param input - Audit log data
 */
export async function logConfigChange(input: CreateAuditLogInput): Promise<void> {
  try {
    const supabase = createAdminClient();

    // Get current user
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();

    // Get request context (IP, user agent)
    const context = await getRequestContext();

    // Generate change summary if not provided
    const changeSummary = input.change_summary || generateChangeSummary(input);

    const { error } = await supabase
      .from('config_audit_logs')
      .insert({
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        entity_name: input.entity_name,
        before_state: input.before_state,
        after_state: input.after_state,
        change_summary: changeSummary,
        changed_by: user?.id,
        changed_by_email: user?.email,
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
        correlation_id: input.correlation_id,
      });

    if (error) {
      // Log but don't throw - audit failures shouldn't block main operations
      console.error('[Audit] Failed to create audit log:', error.message);
    } else {
      console.log(`[Audit] Logged ${input.action} for ${input.entity_type}:${input.entity_id}`);
    }
  } catch (err) {
    // Log but don't throw - audit failures shouldn't block main operations
    console.error('[Audit] Unexpected error creating audit log:', err);
  }
}

/**
 * Log a config change without awaiting - fire and forget pattern.
 * Use this when you don't want to delay the main operation.
 *
 * Note: This function is async to satisfy Server Actions requirements,
 * but it doesn't await the logging - it fires and forgets.
 *
 * @param input - Audit log data
 */
export async function logConfigChangeAsync(input: CreateAuditLogInput): Promise<void> {
  // Fire and forget - don't await the actual logging
  logConfigChange(input).catch((err) => {
    console.error('[Audit] Async audit log failed:', err);
  });
}

/**
 * Query audit logs with filters and pagination.
 * Requires super admin access.
 *
 * @param filters - Filter criteria
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of entries per page
 */
export async function getAuditLogs(
  filters: AuditLogFilters = {},
  page: number = 1,
  pageSize: number = 20
): Promise<AuditActionResult<AuditLogResponse>> {
  try {
    // Verify super admin access
    await verifySuperAdmin();

    const supabase = createAdminClient();

    // Build query
    let query = supabase
      .from('config_audit_logs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.action?.length) {
      query = query.in('action', filters.action);
    }
    if (filters.entity_type?.length) {
      query = query.in('entity_type', filters.entity_type);
    }
    if (filters.changed_by) {
      query = query.eq('changed_by', filters.changed_by);
    }
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }
    if (filters.search) {
      // Use OR for searching across multiple fields
      query = query.or(
        `entity_name.ilike.%${filters.search}%,change_summary.ilike.%${filters.search}%,changed_by_email.ilike.%${filters.search}%`
      );
    }

    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Execute query with ordering and pagination
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[Audit] Query error:', error.message);
      return {
        success: false,
        error: { code: 'QUERY_ERROR', message: error.message },
      };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      success: true,
      data: {
        entries: (data as AuditLogEntry[]) || [],
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (err) {
    if (err instanceof SuperAdminError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    console.error('[Audit] Unexpected query error:', err);
    return {
      success: false,
      error: { code: 'UNEXPECTED_ERROR', message: 'Failed to query audit logs' },
    };
  }
}

/**
 * Get a single audit entry by ID.
 * Requires super admin access.
 *
 * @param id - Audit entry ID
 */
export async function getAuditEntry(id: string): Promise<AuditActionResult<AuditLogEntry>> {
  try {
    // Verify super admin access
    await verifySuperAdmin();

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('config_audit_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Audit entry not found' },
        };
      }
      console.error('[Audit] Get entry error:', error.message);
      return {
        success: false,
        error: { code: 'QUERY_ERROR', message: error.message },
      };
    }

    return { success: true, data: data as AuditLogEntry };
  } catch (err) {
    if (err instanceof SuperAdminError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    console.error('[Audit] Unexpected get entry error:', err);
    return {
      success: false,
      error: { code: 'UNEXPECTED_ERROR', message: 'Failed to get audit entry' },
    };
  }
}

/**
 * Get archived audit logs (entries older than 2 years).
 * Requires super admin access.
 *
 * @param filters - Filter criteria
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of entries per page
 */
export async function getArchivedAuditLogs(
  filters: AuditLogFilters = {},
  page: number = 1,
  pageSize: number = 20
): Promise<AuditActionResult<AuditLogResponse>> {
  try {
    // Verify super admin access
    await verifySuperAdmin();

    const supabase = createAdminClient();

    // Build query against archive table
    let query = supabase
      .from('config_audit_logs_archive')
      .select('*', { count: 'exact' });

    // Apply same filters as main table
    if (filters.action?.length) {
      query = query.in('action', filters.action);
    }
    if (filters.entity_type?.length) {
      query = query.in('entity_type', filters.entity_type);
    }
    if (filters.changed_by) {
      query = query.eq('changed_by', filters.changed_by);
    }
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }
    if (filters.search) {
      query = query.or(
        `entity_name.ilike.%${filters.search}%,change_summary.ilike.%${filters.search}%,changed_by_email.ilike.%${filters.search}%`
      );
    }

    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Execute query
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[Audit] Archive query error:', error.message);
      return {
        success: false,
        error: { code: 'QUERY_ERROR', message: error.message },
      };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      success: true,
      data: {
        entries: (data as AuditLogEntry[]) || [],
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (err) {
    if (err instanceof SuperAdminError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    console.error('[Audit] Unexpected archive query error:', err);
    return {
      success: false,
      error: { code: 'UNEXPECTED_ERROR', message: 'Failed to query archived audit logs' },
    };
  }
}

/**
 * Get unique users who have made changes (for filter dropdown).
 * Requires super admin access.
 */
export async function getAuditUsers(): Promise<AuditActionResult<{ id: string; email: string }[]>> {
  try {
    // Verify super admin access
    await verifySuperAdmin();

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('config_audit_logs')
      .select('changed_by, changed_by_email')
      .not('changed_by', 'is', null)
      .order('changed_by_email');

    if (error) {
      console.error('[Audit] Get users error:', error.message);
      return {
        success: false,
        error: { code: 'QUERY_ERROR', message: error.message },
      };
    }

    // Deduplicate users
    const usersMap = new Map<string, string>();
    for (const row of data || []) {
      if (row.changed_by && row.changed_by_email) {
        usersMap.set(row.changed_by, row.changed_by_email);
      }
    }

    const users = Array.from(usersMap.entries()).map(([id, email]) => ({
      id,
      email,
    }));

    return { success: true, data: users };
  } catch (err) {
    if (err instanceof SuperAdminError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    console.error('[Audit] Unexpected get users error:', err);
    return {
      success: false,
      error: { code: 'UNEXPECTED_ERROR', message: 'Failed to get audit users' },
    };
  }
}

/**
 * Trigger archival of old audit logs (manual trigger).
 * Requires super admin access.
 */
export async function archiveOldAuditLogs(): Promise<AuditActionResult<{ archivedCount: number }>> {
  try {
    // Verify super admin access
    await verifySuperAdmin();

    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc('archive_old_audit_logs');

    if (error) {
      console.error('[Audit] Archive error:', error.message);
      return {
        success: false,
        error: { code: 'ARCHIVE_ERROR', message: error.message },
      };
    }

    const archivedCount = typeof data === 'number' ? data : 0;
    console.log(`[Audit] Archived ${archivedCount} audit log entries`);

    return { success: true, data: { archivedCount } };
  } catch (err) {
    if (err instanceof SuperAdminError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    console.error('[Audit] Unexpected archive error:', err);
    return {
      success: false,
      error: { code: 'UNEXPECTED_ERROR', message: 'Failed to archive audit logs' },
    };
  }
}

/**
 * Export audit logs to CSV format.
 * Requires super admin access.
 *
 * @param filters - Filter criteria
 * @returns CSV string of audit logs
 */
export async function exportAuditLogsCsv(
  filters: AuditLogFilters = {}
): Promise<AuditActionResult<string>> {
  try {
    // Verify super admin access
    await verifySuperAdmin();

    const supabase = createAdminClient();

    // Build query without pagination for full export
    let query = supabase
      .from('config_audit_logs')
      .select('*');

    // Apply filters
    if (filters.action?.length) {
      query = query.in('action', filters.action);
    }
    if (filters.entity_type?.length) {
      query = query.in('entity_type', filters.entity_type);
    }
    if (filters.changed_by) {
      query = query.eq('changed_by', filters.changed_by);
    }
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }
    if (filters.search) {
      query = query.or(
        `entity_name.ilike.%${filters.search}%,change_summary.ilike.%${filters.search}%,changed_by_email.ilike.%${filters.search}%`
      );
    }

    // Limit export to 10,000 entries for performance
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) {
      console.error('[Audit] Export error:', error.message);
      return {
        success: false,
        error: { code: 'EXPORT_ERROR', message: error.message },
      };
    }

    // Generate CSV
    const entries = (data as AuditLogEntry[]) || [];

    if (entries.length === 0) {
      return {
        success: true,
        data: 'No audit entries found matching the filter criteria.',
      };
    }

    // CSV header
    const headers = [
      'ID',
      'Timestamp',
      'Action',
      'Entity Type',
      'Entity ID',
      'Entity Name',
      'Change Summary',
      'Changed By Email',
      'IP Address',
      'User Agent',
    ];

    // CSV rows
    const rows = entries.map((entry) => [
      entry.id,
      entry.created_at,
      entry.action,
      entry.entity_type,
      entry.entity_id,
      entry.entity_name || '',
      entry.change_summary || '',
      entry.changed_by_email || '',
      entry.ip_address || '',
      entry.user_agent || '',
    ]);

    // Escape CSV values
    const escapeCSV = (val: string): string => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    // Build CSV string
    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => escapeCSV(String(cell))).join(',')),
    ].join('\n');

    console.log(`[Audit] Exported ${entries.length} audit log entries to CSV`);

    return { success: true, data: csv };
  } catch (err) {
    if (err instanceof SuperAdminError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    console.error('[Audit] Unexpected export error:', err);
    return {
      success: false,
      error: { code: 'UNEXPECTED_ERROR', message: 'Failed to export audit logs' },
    };
  }
}
