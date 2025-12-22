'use client';

export function PromptFeedSkeleton() {
  return (
    <div className="space-y-3" data-testid="prompt-feed-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4"
        >
          <div className="h-10 w-10 rounded-full bg-[#2a2a2a] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-[#2a2a2a] animate-pulse" />
            <div className="h-3 w-1/4 rounded bg-[#2a2a2a] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
