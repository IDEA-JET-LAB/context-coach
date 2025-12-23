'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { showToast } from '@/components/feedback';

/**
 * Handles the ?account_deleted=true query parameter and shows a success toast.
 * This component should be placed on the landing page.
 */
export function AccountDeletedHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasShownToast = useRef(false);

  useEffect(() => {
    const accountDeleted = searchParams.get('account_deleted');

    if (accountDeleted === 'true' && !hasShownToast.current) {
      hasShownToast.current = true;
      showToast.success('Your account has been successfully deleted.', {
        duration: 5000,
      });

      // Clean up the URL without triggering a navigation
      const url = new URL(window.location.href);
      url.searchParams.delete('account_deleted');
      router.replace(url.pathname, { scroll: false });
    }
  }, [searchParams, router]);

  return null;
}
