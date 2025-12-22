'use client';

export function OnboardingChecklistSkeleton() {
  return (
    <div
      className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4 animate-pulse"
      data-testid="onboarding-skeleton"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-24 bg-[#2a2a2a] rounded" />
        <div className="h-6 w-6 bg-[#2a2a2a] rounded" />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <div className="h-4 w-16 bg-[#2a2a2a] rounded" />
          <div className="h-4 w-12 bg-[#2a2a2a] rounded" />
        </div>
        <div className="h-2 bg-[#2a2a2a] rounded-full" />
      </div>

      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <div className="h-6 w-6 bg-[#2a2a2a] rounded-full" />
            <div className="h-4 flex-1 bg-[#2a2a2a] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
