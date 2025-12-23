'use client';

import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Circle, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export type SessionStatus = 'completed' | 'in_progress' | 'interrupted';

export interface SessionEvent {
  id: string;
  timestamp: Date;
  type: 'start' | 'prompt' | 'analysis' | 'end' | 'interruption';
  label?: string;
  score?: number;
}

export interface SessionTimelineProps {
  /** Session start time */
  startTime: Date;
  /** Session end time (null if in progress) */
  endTime?: Date | null;
  /** Session status */
  status: SessionStatus;
  /** Events in the session */
  events: SessionEvent[];
  /** Whether to show timestamps */
  showTimestamps?: boolean;
  /** Whether to show the timeline in compact mode */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

function getEventIcon(type: SessionEvent['type'], status?: SessionStatus) {
  switch (type) {
    case 'start':
      return Circle;
    case 'end':
      return status === 'completed' ? CheckCircle : status === 'interrupted' ? AlertCircle : Clock;
    case 'prompt':
      return Circle;
    case 'analysis':
      return CheckCircle;
    case 'interruption':
      return AlertCircle;
    default:
      return Circle;
  }
}

function getEventColor(type: SessionEvent['type'], status?: SessionStatus) {
  switch (type) {
    case 'start':
      return 'text-primary bg-primary';
    case 'end':
      return status === 'completed'
        ? 'text-score-high bg-score-high'
        : status === 'interrupted'
          ? 'text-score-growth bg-score-growth'
          : 'text-info bg-info';
    case 'analysis':
      return 'text-score-high bg-score-high';
    case 'interruption':
      return 'text-score-growth bg-score-growth';
    default:
      return 'text-muted-foreground bg-muted-foreground';
  }
}

export function SessionTimeline({
  startTime,
  endTime,
  status,
  events,
  showTimestamps = true,
  compact = false,
  className,
}: SessionTimelineProps) {
  const allEvents: SessionEvent[] = [
    { id: 'start', timestamp: startTime, type: 'start', label: 'Session Started' },
    ...events,
    ...(endTime || status !== 'in_progress'
      ? [{
          id: 'end',
          timestamp: endTime || new Date(),
          type: 'end' as const,
          label: status === 'completed' ? 'Session Completed' : 'Session Interrupted',
        }]
      : []),
  ];

  return (
    <div
      className={cn('relative', className)}
      data-testid="session-timeline"
      data-status={status}
    >
      {/* Timeline line */}
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

      {/* Events */}
      <div className={cn('space-y-4', compact && 'space-y-2')}>
        {allEvents.map((event, index) => {
          const Icon = getEventIcon(event.type, status);
          const colors = getEventColor(event.type, status);
          const [textColor, bgColor] = colors.split(' ');

          return (
            <div
              key={event.id}
              className="relative flex items-start gap-3 pl-0"
              data-testid={`timeline-event-${event.type}`}
            >
              {/* Icon */}
              <div
                className={cn(
                  'relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background',
                  bgColor
                )}
              >
                <Icon className={cn('h-3 w-3 text-background')} />
              </div>

              {/* Content */}
              <div className={cn('flex-1 min-w-0', compact ? 'py-0' : 'py-0.5')}>
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-medium', textColor)}>
                    {event.label || event.type}
                  </span>
                  {event.score !== undefined && (
                    <span className="text-xs font-medium text-score-high">
                      Score: {event.score.toFixed(1)}
                    </span>
                  )}
                </div>
                {showTimestamps && (
                  <p className="text-xs text-muted-foreground">
                    {format(event.timestamp, 'HH:mm:ss')}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* In progress indicator */}
        {status === 'in_progress' && (
          <div className="relative flex items-start gap-3 pl-0">
            <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-info animate-pulse">
              <Clock className="h-3 w-3 text-background" />
            </div>
            <div className="flex-1 py-0.5">
              <span className="text-sm font-medium text-info">In Progress...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
