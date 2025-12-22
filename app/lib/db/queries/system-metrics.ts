'use server';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Analysis queue status counts
 */
export interface AnalysisQueueStatus {
  counts: {
    pending: number;
    processing: number;
    complete: number;
    failed: number;
  };
  total: number;
  successRate: number;
  errorRate: number;
}

/**
 * Failed prompt item for dead letter queue
 */
export interface FailedPrompt {
  id: string;
  text: string;
  created_at: string;
  updated_at: string;
  analysis_attempts: number;
  last_analysis_error: string | null;
  user_id: string;
  team_id: string;
  project_id: string;
}

/**
 * Dead letter queue paginated response
 */
export interface DeadLetterQueueResponse {
  items: FailedPrompt[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * System metrics for the health dashboard
 */
export interface SystemMetrics {
  apiResponseTime: number; // ms - simulated for now
  databaseStatus: 'connected' | 'disconnected' | 'degraded';
  edgeFunctionStatus: 'operational' | 'degraded' | 'down';
  lastChecked: string;
}

/**
 * Gets the analysis queue status counts for the last 24 hours.
 * Uses service role client to bypass RLS.
 */
export async function getAnalysisQueueStatus(): Promise<AnalysisQueueStatus> {
  const supabase = createAdminClient();
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('prompts')
    .select('analysis_status')
    .gte('created_at', last24h);

  if (error) {
    console.error('[SystemMetrics] Error fetching queue status:', error);
    throw error;
  }

  const counts = { pending: 0, processing: 0, complete: 0, failed: 0 };

  data?.forEach((row) => {
    const status = row.analysis_status as keyof typeof counts;
    if (status in counts) {
      counts[status]++;
    }
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    counts,
    total,
    successRate: total > 0 ? Math.round((counts.complete / total) * 100) : 100,
    errorRate: total > 0 ? Math.round((counts.failed / total) * 100) : 0,
  };
}

/**
 * Gets the dead letter queue (failed analyses) with pagination.
 * Uses service role client to bypass RLS.
 */
export async function getDeadLetterQueue(
  page = 1,
  pageSize = 20
): Promise<DeadLetterQueueResponse> {
  const supabase = createAdminClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await supabase
    .from('prompts')
    .select('id, text, created_at, updated_at, analysis_attempts, last_analysis_error, user_id, team_id, project_id', { count: 'exact' })
    .eq('analysis_status', 'failed')
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[SystemMetrics] Error fetching dead letter queue:', error);
    throw error;
  }

  return {
    items: (data ?? []) as FailedPrompt[],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

/**
 * Gets system health metrics.
 * Some metrics are simulated as they require external monitoring tools.
 */
export async function getSystemMetrics(): Promise<SystemMetrics> {
  const supabase = createAdminClient();

  // Check database connectivity by running a simple query
  const startTime = Date.now();
  let databaseStatus: 'connected' | 'disconnected' | 'degraded' = 'connected';
  let responseTime = 0;

  try {
    const { error } = await supabase.from('prompts').select('id').limit(1);
    responseTime = Date.now() - startTime;

    if (error) {
      databaseStatus = 'degraded';
    } else if (responseTime > 2000) {
      databaseStatus = 'degraded';
    }
  } catch {
    databaseStatus = 'disconnected';
    responseTime = Date.now() - startTime;
  }

  /**
   * M44 Fix: Edge function status approximation documentation.
   *
   * IMPORTANT: This is an APPROXIMATION of the edge function status.
   * We cannot directly check the edge function health from within the Next.js app
   * because:
   * 1. Edge functions run in a separate Deno runtime managed by Supabase
   * 2. There's no direct health check endpoint exposed for edge functions
   * 3. Calling the edge function just to check status would consume resources
   *
   * Current approximation logic:
   * - If database is disconnected -> edge function is likely down
   * - If database is degraded (slow) -> edge function may be degraded
   * - Otherwise -> assume operational
   *
   * For accurate edge function monitoring, consider:
   * 1. Supabase Dashboard -> Edge Functions -> Logs
   * 2. Setting up external monitoring (e.g., Checkly, Pingdom)
   * 3. Implementing a dedicated /health edge function with Supabase's pg_net
   * 4. Checking the recent analysis success/failure ratio as a proxy
   */
  let edgeFunctionStatus: 'operational' | 'degraded' | 'down' = 'operational';
  if (databaseStatus === 'disconnected') {
    edgeFunctionStatus = 'down';
  } else if (databaseStatus === 'degraded') {
    edgeFunctionStatus = 'degraded';
  }

  return {
    apiResponseTime: responseTime,
    databaseStatus,
    edgeFunctionStatus,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Gets the total count of failed analyses (for badge display).
 */
export async function getFailedAnalysisCount(): Promise<number> {
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from('prompts')
    .select('id', { count: 'exact', head: true })
    .eq('analysis_status', 'failed');

  if (error) {
    console.error('[SystemMetrics] Error counting failed analyses:', error);
    return 0;
  }

  return count ?? 0;
}
