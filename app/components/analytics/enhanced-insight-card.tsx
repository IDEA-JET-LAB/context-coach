'use client';

import { cn } from '@/lib/utils';
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  ChevronRight,
  ExternalLink,
  X,
  Eye,
  LucideIcon,
  Zap,
  Target,
  Brain,
  Clock,
} from 'lucide-react';

export type EnhancedInsightType =
  | 'suggestion'
  | 'achievement'
  | 'warning'
  | 'insight'
  | 'discovery';

export type InsightCategory =
  | 'prompting'
  | 'workflow'
  | 'learning'
  | 'context'
  | 'general';

export interface InsightData {
  metric?: string;
  value?: string | number;
  change?: number;
  changeDirection?: 'up' | 'down' | 'stable';
}

export interface InsightAction {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}

export interface EnhancedInsightCardProps {
  /** Unique identifier for the insight */
  id: string;
  /** Insight type determines icon and styling */
  type: EnhancedInsightType;
  /** Category for filtering */
  category?: InsightCategory;
  /** Main insight message */
  message: string;
  /** Optional detailed explanation */
  details?: string;
  /** Structured data for the insight */
  data?: InsightData;
  /** Available actions */
  actions?: InsightAction[];
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Whether the insight is dismissible */
  dismissible?: boolean;
  /** Mark as read handler */
  onMarkRead?: () => void;
  /** Whether the insight has been read */
  isRead?: boolean;
  /** Whether to show the expand/drill-down indicator */
  expandable?: boolean;
  /** Click handler for drill-down */
  onExpand?: () => void;
  /** AI-generated flag */
  isAiGenerated?: boolean;
  /** Timestamp of insight generation */
  timestamp?: string;
  /** Confidence score (0-1) for AI insights */
  confidence?: number;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
}

const typeConfig: Record<
  EnhancedInsightType,
  { icon: LucideIcon; color: string; bgColor: string; label: string }
> = {
  suggestion: {
    icon: Lightbulb,
    color: 'text-info',
    bgColor: 'bg-info/10 border-info/20',
    label: 'Suggestion',
  },
  achievement: {
    icon: CheckCircle,
    color: 'text-score-high',
    bgColor: 'bg-score-high/10 border-score-high/20',
    label: 'Achievement',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-score-growth',
    bgColor: 'bg-score-growth/10 border-score-growth/20',
    label: 'Heads Up',
  },
  insight: {
    icon: Sparkles,
    color: 'text-primary',
    bgColor: 'bg-primary/10 border-primary/20',
    label: 'Insight',
  },
  discovery: {
    icon: Eye,
    color: 'text-chart-5',
    bgColor: 'bg-chart-5/10 border-chart-5/20',
    label: 'Discovery',
  },
};

const categoryIcons: Record<InsightCategory, LucideIcon> = {
  prompting: Target,
  workflow: Zap,
  learning: Brain,
  context: Clock,
  general: Sparkles,
};

export function EnhancedInsightCard({
  id,
  type,
  category,
  message,
  details,
  data,
  actions = [],
  onDismiss,
  dismissible = true,
  onMarkRead,
  isRead = false,
  expandable = false,
  onExpand,
  isAiGenerated = false,
  timestamp,
  confidence,
  loading = false,
  className,
}: EnhancedInsightCardProps) {
  const config = typeConfig[type];
  const Icon = config.icon;
  const CategoryIcon = category ? categoryIcons[category] : null;

  if (loading) {
    return (
      <div
        className={cn(
          'relative rounded-lg border p-4 bg-card border-border',
          className
        )}
        data-testid="insight-card-loading"
      >
        <div className="flex gap-3">
          <div className="h-5 w-5 animate-pulse rounded bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const handleExpand = () => {
    if (onMarkRead && !isRead) {
      onMarkRead();
    }
    onExpand?.();
  };

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        config.bgColor,
        !isRead && 'ring-1 ring-primary/20',
        expandable && 'cursor-pointer hover:shadow-md',
        className
      )}
      onClick={expandable ? handleExpand : undefined}
      data-testid="enhanced-insight-card"
      data-type={type}
      data-category={category}
      data-id={id}
      role={expandable ? 'button' : undefined}
      tabIndex={expandable ? 0 : undefined}
      onKeyDown={
        expandable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleExpand();
              }
            }
          : undefined
      }
    >
      {/* Unread indicator */}
      {!isRead && (
        <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary" />
      )}

      <div className="flex gap-3">
        <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', config.color)} />
        <div className="flex-1 min-w-0">
          {/* Header with type and category */}
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-xs font-medium', config.color)}>
              {config.label}
            </span>
            {CategoryIcon && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CategoryIcon className="h-3 w-3" />
                <span className="capitalize">{category}</span>
              </span>
            )}
            {isAiGenerated && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>AI</span>
              </span>
            )}
          </div>

          {/* Main message */}
          <p className="text-sm font-medium text-foreground">{message}</p>

          {/* Details */}
          {details && (
            <p className="mt-1 text-sm text-muted-foreground">{details}</p>
          )}

          {/* Data display */}
          {data && (
            <div className="mt-2 flex items-center gap-4 text-sm">
              {data.metric && (
                <span className="text-muted-foreground">{data.metric}:</span>
              )}
              {data.value !== undefined && (
                <span className="font-medium text-foreground">{data.value}</span>
              )}
              {data.change !== undefined && (
                <span
                  className={cn(
                    'flex items-center gap-0.5 text-xs',
                    data.changeDirection === 'up'
                      ? 'text-score-high'
                      : data.changeDirection === 'down'
                        ? 'text-score-growth'
                        : 'text-muted-foreground'
                  )}
                >
                  {data.changeDirection === 'up' && (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  {data.changeDirection === 'down' && (
                    <TrendingUp className="h-3 w-3 rotate-180" />
                  )}
                  {data.change > 0 ? '+' : ''}
                  {data.change}%
                </span>
              )}
            </div>
          )}

          {/* Confidence indicator */}
          {confidence !== undefined && isAiGenerated && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden max-w-[100px]">
                <div
                  className="h-full rounded-full bg-primary/50 transition-all"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(confidence * 100)}% confidence
              </span>
            </div>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick?.();
                  }}
                  className={cn(
                    'inline-flex items-center gap-1 text-sm font-medium transition-colors',
                    action.primary
                      ? cn('hover:underline', config.color)
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {action.label}
                  {action.href && <ExternalLink className="h-3 w-3" />}
                  {action.primary && !action.href && (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Timestamp */}
          {timestamp && (
            <p className="mt-2 text-xs text-muted-foreground/70">{timestamp}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col items-end gap-2">
          {dismissible && onDismiss && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted/50"
              aria-label="Dismiss insight"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {expandable && (
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-auto" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Container for multiple insight cards with filtering
 */
export interface InsightsListProps {
  insights: EnhancedInsightCardProps[];
  filter?: EnhancedInsightType | InsightCategory | 'all';
  onDismissAll?: () => void;
  onMarkAllRead?: () => void;
  emptyMessage?: string;
  maxVisible?: number;
  className?: string;
}

export function InsightsList({
  insights,
  filter = 'all',
  onDismissAll,
  onMarkAllRead,
  emptyMessage = 'No insights available',
  maxVisible = 5,
  className,
}: InsightsListProps) {
  // Filter insights
  const filteredInsights =
    filter === 'all'
      ? insights
      : insights.filter(
          (i) => i.type === filter || i.category === filter
        );

  const visibleInsights = filteredInsights.slice(0, maxVisible);
  const unreadCount = filteredInsights.filter((i) => !i.isRead).length;

  if (filteredInsights.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-card p-6 text-center',
          className
        )}
        data-testid="insights-list-empty"
      >
        <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)} data-testid="insights-list">
      {/* Header with actions */}
      {(onDismissAll || onMarkAllRead) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              Insights
            </span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {onMarkAllRead && unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Mark all read
              </button>
            )}
            {onDismissAll && (
              <button
                onClick={onDismissAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="space-y-2">
        {visibleInsights.map((insight) => (
          <EnhancedInsightCard key={insight.id} {...insight} />
        ))}
      </div>

      {/* Show more indicator */}
      {filteredInsights.length > maxVisible && (
        <p className="text-xs text-muted-foreground text-center">
          + {filteredInsights.length - maxVisible} more insights
        </p>
      )}
    </div>
  );
}
