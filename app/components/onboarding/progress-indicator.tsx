'use client';

interface ProgressIndicatorProps {
  completed: number;
  total: number;
}

export function ProgressIndicator({ completed, total }: ProgressIndicatorProps) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="text-teal-500 font-medium" aria-live="polite">
          {completed} of {total}
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-[#2a2a2a] overflow-hidden"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Setup progress: ${completed} of ${total} steps complete`}
      >
        <div
          className="h-full rounded-full bg-teal-500 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
