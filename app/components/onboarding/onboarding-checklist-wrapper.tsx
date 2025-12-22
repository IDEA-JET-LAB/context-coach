'use client';

import { useOnboardingDismissed } from '@/lib/hooks/use-onboarding-dismissed';
import { OnboardingChecklist } from './onboarding-checklist';

interface OnboardingChecklistWrapperProps {
  installToken?: string;
}

export function OnboardingChecklistWrapper({
  installToken,
}: OnboardingChecklistWrapperProps) {
  const { dismissed, dismiss, loaded } = useOnboardingDismissed();

  // Don't render anything until hydration is complete to avoid mismatch
  if (!loaded) {
    return null;
  }

  // Don't render if already dismissed
  if (dismissed) {
    return null;
  }

  return <OnboardingChecklist onDismiss={dismiss} installToken={installToken} />;
}
