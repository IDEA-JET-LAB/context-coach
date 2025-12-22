'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * Handles the access-denied error query parameter.
 * Shows a toast notification and cleans up the URL.
 */
export function AccessDeniedHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('error') === 'access-denied') {
      toast.error('Access denied - Admin privileges required');

      // Remove the query param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      router.replace(url.pathname + url.search);
    }
  }, [searchParams, router]);

  return null;
}
