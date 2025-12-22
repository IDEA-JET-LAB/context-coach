'use client';

import { useState, useCallback } from 'react';
import { X, Users, FolderOpen, Terminal, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboardingStatus } from '@/lib/hooks/use-onboarding-status';
import { StepItem } from './step-item';
import { ProgressIndicator } from './progress-indicator';
import { OnboardingChecklistSkeleton } from './onboarding-checklist-skeleton';
import { CelebrationMessage } from './celebration-message';
import { InstallCliModal } from './install-cli-modal';
import type { OnboardingStatus } from '@/lib/utils/onboarding-steps';

interface OnboardingChecklistProps {
  onDismiss: () => void;
  installToken?: string;
}

const STEPS = [
  {
    id: 'create-team' as const,
    label: 'Create your team',
    icon: Users,
    href: '/teams/new',
  },
  {
    id: 'create-project' as const,
    label: 'Create a project',
    icon: FolderOpen,
    href: '/projects/new',
  },
  {
    id: 'install-cli' as const,
    label: 'Install CLI in your project',
    icon: Terminal,
    action: 'showInstall' as const,
  },
  {
    id: 'capture-prompt' as const,
    label: 'Capture your first prompt',
    icon: MessageSquare,
    passive: true,
  },
];

export function OnboardingChecklist({
  onDismiss,
  installToken,
}: OnboardingChecklistProps) {
  const { data: status, isPending } = useOnboardingStatus();
  const [showInstallModal, setShowInstallModal] = useState(false);

  const handleStepClick = useCallback((action?: string) => {
    if (action === 'showInstall') {
      setShowInstallModal(true);
    }
  }, []);

  if (isPending) {
    return <OnboardingChecklistSkeleton />;
  }

  const completedCount = status
    ? Object.values(status).filter(Boolean).length
    : 0;

  const allComplete = completedCount === STEPS.length;

  if (allComplete) {
    return <CelebrationMessage onDismiss={onDismiss} />;
  }

  return (
    <>
      <div
        className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4"
        role="region"
        aria-label="Setup checklist"
        data-testid="onboarding-checklist"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-[#fafafa]">Get Started</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            aria-label="Dismiss checklist"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ProgressIndicator completed={completedCount} total={STEPS.length} />

        <div className="mt-4 space-y-2" role="list">
          {STEPS.map((step) => (
            <StepItem
              key={step.id}
              icon={step.icon}
              label={step.label}
              completed={status?.[step.id as keyof OnboardingStatus] ?? false}
              href={step.href}
              onClick={
                step.action ? () => handleStepClick(step.action) : undefined
              }
            />
          ))}
        </div>
      </div>

      <InstallCliModal
        open={showInstallModal}
        onOpenChange={setShowInstallModal}
        installToken={installToken}
      />
    </>
  );
}
