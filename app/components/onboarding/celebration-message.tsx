'use client';

import { useEffect } from 'react';
import { PartyPopper, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CelebrationMessageProps {
  onDismiss: () => void;
}

export function CelebrationMessage({ onDismiss }: CelebrationMessageProps) {
  // Auto-dismiss after 10 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 10000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="rounded-lg border border-teal-500/30 bg-teal-500/10 p-4"
      role="alert"
      aria-live="polite"
      data-testid="celebration-message"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-teal-500" aria-hidden="true" />
          <h3 className="font-medium text-teal-500">You&apos;re all set!</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          aria-label="Dismiss celebration message"
        >
          <X className="h-4 w-4 text-teal-500" />
        </Button>
      </div>
      <p className="text-sm text-teal-100">
        Your prompts will now be captured and analyzed automatically. Check your
        feed to see your scores and improve your prompting skills!
      </p>
    </div>
  );
}
