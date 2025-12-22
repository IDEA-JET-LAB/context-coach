'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'contextor-onboarding-dismissed';

export function useOnboardingDismissed() {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only access localStorage after hydration
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    setDismissed(stored === 'true');
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setDismissed(false);
  }, []);

  // Return not dismissed during SSR to avoid hydration mismatch
  return {
    dismissed: mounted ? dismissed : false,
    dismiss,
    reset,
    loaded: mounted,
  };
}
