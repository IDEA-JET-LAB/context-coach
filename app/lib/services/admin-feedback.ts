'use server';

import { createAdminClient } from '@/lib/supabase/admin';

// ============================================
// TYPES
// ============================================

export interface FeedbackItem {
  id: string;
  user_id: string;
  user_email: string;
  category: 'suggestion' | 'question' | 'bug' | 'feature-request' | 'other';
  message: string;
  extension_version: string | null;
  created_at: string;
  status: 'new' | 'reviewed' | 'in-progress' | 'resolved' | 'archived';
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface GetFeedbackParams {
  page: number;
  pageSize: number;
  category?: string;
  status?: string;
}

interface GetFeedbackResult {
  feedback: FeedbackItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGINATION_LIMITS = {
  MAX_PAGE_SIZE: 50,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE: 1000,
} as const;

// ============================================
// FEEDBACK LISTING (Admin Only)
// ============================================

export async function getFeedback({
  page,
  pageSize,
  category,
  status,
}: GetFeedbackParams): Promise<GetFeedbackResult> {
  const supabase = await createAdminClient();

  // Validate pagination params
  const validPage = Math.max(1, Math.min(page, PAGINATION_LIMITS.MAX_PAGE));
  const validPageSize = Math.max(1, Math.min(pageSize, PAGINATION_LIMITS.MAX_PAGE_SIZE));

  // Build query - join with users table to get email
  let query = supabase
    .from('feedback')
    .select('*, users!feedback_user_id_fkey(email)', { count: 'exact' });

  // Apply filters
  if (category && category !== 'all') {
    query = query.eq('category', category);
  }
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  // Get total count
  const { count } = await query;
  const total = count || 0;
  const totalPages = Math.ceil(total / validPageSize);

  // Get paginated results
  const offset = (validPage - 1) * validPageSize;
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + validPageSize - 1);

  if (error) {
    console.error('[ADMIN_FEEDBACK] Error fetching feedback:', error);
    return {
      feedback: [],
      total: 0,
      page: validPage,
      pageSize: validPageSize,
      totalPages: 0,
    };
  }

  // Transform results
  const feedback: FeedbackItem[] = (data || []).map((item) => ({
    id: item.id,
    user_id: item.user_id,
    user_email: (item.users as { email?: string })?.email || 'Unknown',
    category: item.category,
    message: item.message,
    extension_version: item.extension_version,
    created_at: item.created_at,
    status: item.status,
    admin_notes: item.admin_notes,
    reviewed_at: item.reviewed_at,
    reviewed_by: item.reviewed_by,
  }));

  return {
    feedback,
    total,
    page: validPage,
    pageSize: validPageSize,
    totalPages,
  };
}

// ============================================
// UPDATE FEEDBACK STATUS
// ============================================

export async function updateFeedbackStatus(
  feedbackId: string,
  status: 'new' | 'reviewed' | 'in-progress' | 'resolved' | 'archived',
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from('feedback')
    .update({
      status,
      admin_notes: adminNotes || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', feedbackId);

  if (error) {
    console.error('[ADMIN_FEEDBACK] Error updating feedback:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
