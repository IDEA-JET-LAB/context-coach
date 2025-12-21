/**
 * Onboarding steps detection logic
 * Provides helper functions to check completion status of each onboarding step
 */

export interface OnboardingStatus {
  'create-team': boolean;
  'create-project': boolean;
  'install-cli': boolean;
  'capture-prompt': boolean;
}

export interface OnboardingStepDefinition {
  id: keyof OnboardingStatus;
  label: string;
  description: string;
  href?: string;
  action?: 'showInstall';
  passive?: boolean;
}

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  {
    id: 'create-team',
    label: 'Create your team',
    description: 'Set up your team to collaborate with others',
    href: '/teams/new',
  },
  {
    id: 'create-project',
    label: 'Create a project',
    description: 'Create a project to organize your prompts',
    href: '/projects/new',
  },
  {
    id: 'install-cli',
    label: 'Install CLI in your project',
    description: 'Set up the CLI to capture prompts automatically',
    action: 'showInstall',
  },
  {
    id: 'capture-prompt',
    label: 'Capture your first prompt',
    description: 'Use the CLI and your first prompt will appear here',
    passive: true,
  },
] as const;

/**
 * Calculate the number of completed steps
 */
export function getCompletedCount(status: OnboardingStatus): number {
  return Object.values(status).filter(Boolean).length;
}

/**
 * Check if all onboarding steps are complete
 */
export function isOnboardingComplete(status: OnboardingStatus): boolean {
  return getCompletedCount(status) === ONBOARDING_STEPS.length;
}

/**
 * Get the next incomplete step
 */
export function getNextIncompleteStep(
  status: OnboardingStatus
): OnboardingStepDefinition | null {
  for (const step of ONBOARDING_STEPS) {
    if (!status[step.id]) {
      return step;
    }
  }
  return null;
}

/**
 * Create an initial (all incomplete) onboarding status
 */
export function createInitialStatus(): OnboardingStatus {
  return {
    'create-team': false,
    'create-project': false,
    'install-cli': false,
    'capture-prompt': false,
  };
}
