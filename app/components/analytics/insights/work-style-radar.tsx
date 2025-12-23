'use client';

import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';
import type { InsightsWorkStyle, InsightsTechnicalProfile } from '@/lib/types/insights';
import type { WorkStyleCategory } from '@/lib/analysis/work-style-classifier';

export interface WorkStyleRadarProps {
  workStyle: InsightsWorkStyle;
  technicalProfile: InsightsTechnicalProfile;
  loading?: boolean;
  className?: string;
}

const WORK_STYLE_LABELS: Record<WorkStyleCategory, string> = {
  architecture_questions: 'Architecture',
  file_operations: 'File Ops',
  debugging: 'Debugging',
  agent_delegation: 'Delegation',
  testing: 'Testing',
  deployment: 'Deployment',
  design_iteration: 'Design',
  context_recovery: 'Context',
  quick_commands: 'Quick Cmds',
  business_discussion: 'Business',
};

const PERSONA_LABELS: Record<string, string> = {
  architect: 'System Architect',
  firefighter: 'Firefighter',
  craftsman: 'Craftsman',
  explorer: 'Explorer',
};

const PERSONA_DESCRIPTIONS: Record<string, string> = {
  architect: 'Focused on system design and planning',
  firefighter: 'Skilled at debugging and problem-solving',
  craftsman: 'Dedicated to implementation and quality',
  explorer: 'Well-rounded across all areas',
};

export function WorkStyleRadar({
  workStyle,
  technicalProfile,
  loading = false,
  className,
}: WorkStyleRadarProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="work-style-radar-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="h-[200px] animate-pulse rounded bg-muted mb-4" />
        <div className="flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded bg-muted" />
          <div className="h-6 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  // Prepare data for radar chart
  const total = Object.values(workStyle.distribution).reduce((a, b) => a + b, 0) || 1;
  const radarData = Object.entries(WORK_STYLE_LABELS).map(([key, label]) => ({
    style: label,
    value: ((workStyle.distribution[key as WorkStyleCategory] || 0) / total) * 100,
    fullMark: 100,
  }));

  const hasData = total > 0;

  // Get persona info
  const persona = technicalProfile.persona || 'generalist';
  const personaLabel = PERSONA_LABELS[persona] || 'Unknown';
  const personaDescription = PERSONA_DESCRIPTIONS[persona] || '';

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      data-testid="work-style-radar"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Work Style</h3>
        {technicalProfile.persona && (
          <span
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            data-testid="persona-badge"
          >
            {personaLabel}
          </span>
        )}
      </div>

      {/* Radar Chart */}
      {hasData ? (
        <div className="h-[220px]" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="style"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value) => value !== undefined ? [`${Number(value).toFixed(1)}%`, 'Distribution'] : ['', '']}
              />
              <Radar
                name="Work Style"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          className="h-[220px] flex items-center justify-center text-muted-foreground"
          data-testid="work-style-radar-empty"
        >
          <p className="text-sm">No work style data available</p>
        </div>
      )}

      {/* Primary and Secondary Styles */}
      {hasData && (workStyle.primaryStyle || workStyle.secondaryStyle) && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
          {workStyle.primaryStyle && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
              <span className="font-medium">Primary:</span>
              {WORK_STYLE_LABELS[workStyle.primaryStyle]}
            </span>
          )}
          {workStyle.secondaryStyle && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">
              <span className="font-medium">Secondary:</span>
              {WORK_STYLE_LABELS[workStyle.secondaryStyle]}
            </span>
          )}
        </div>
      )}

      {/* Technical Profile Breakdown */}
      {technicalProfile.persona && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Technical Profile</p>
          <p className="text-sm text-foreground mb-2">{personaDescription}</p>
          <div className="grid grid-cols-5 gap-1">
            {Object.entries(technicalProfile.breakdown).map(([key, value]) => (
              <div key={key} className="text-center">
                <div
                  className="h-1 rounded-full bg-muted overflow-hidden mb-1"
                >
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${value}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {key.slice(0, 4)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accessible description */}
      <span className="sr-only">
        Work style radar chart showing distribution across 10 categories.
        {workStyle.primaryStyle && ` Primary style: ${WORK_STYLE_LABELS[workStyle.primaryStyle]}.`}
        {technicalProfile.persona && ` Technical persona: ${personaLabel}.`}
      </span>
    </div>
  );
}
