# Story 31-5: Project Stage Analytics API

## Story Info
- **Epic:** 31 - Project Stage Analytics
- **Priority:** P1
- **Points:** 3
- **Status:** Done

## Description

Create API endpoints for project-level stage analytics, providing aggregated stage data across all conversations in a project.

## Acceptance Criteria

- [x] `GET /api/projects/{id}/stage-analytics` - Get aggregated stage data
- [x] `GET /api/projects/{id}/stage-analytics/timeline` - Timeline data for visualization
- [x] Include time range filtering (last 7 days, 30 days, all time)
- [x] Return processing status for in-progress analysis
- [x] Proper authentication and authorization
- [x] Rate limiting on expensive queries

## Technical Details

### File Structure

```
app/app/api/projects/[id]/stage-analytics/
├── route.ts                    # GET aggregated data
└── timeline/
    └── route.ts                # GET timeline data
```

### Response Types

```typescript
// lib/types/stage-analytics.ts

import type { ProjectStage } from '@/lib/types/conversations';

export interface ProjectStageAnalytics {
  projectId: string;
  projectName: string;

  analysisStatus: {
    totalSessions: number;
    analyzedSessions: number;
    pendingSessions: number;
    errorSessions: number;
    lastAnalyzedAt: string | null;
  };

  summary: {
    totalActiveMinutes: number;
    totalPrompts: number;
    sessionsAnalyzed: number;
    dateRange: {
      start: string;
      end: string;
    };
    stageBreakdown: Array<{
      stage: ProjectStage;
      activeMinutes: number;
      promptCount: number;
      percentage: number;
      sessionCount: number;  // How many sessions had this stage
    }>;
  };

  primaryStage: ProjectStage;
  averageSessionMinutes: number;
}

export interface StageTimelineData {
  projectId: string;
  granularity: 'day' | 'week';
  dataPoints: Array<{
    date: string;
    stages: Record<ProjectStage, {
      activeMinutes: number;
      promptCount: number;
      sessionCount: number;
    }>;
    totalMinutes: number;
  }>;
}
```

### API Implementation

```typescript
// app/api/projects/[id]/stage-analytics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { ProjectStageAnalytics, ProjectStage } from '@/lib/types/stage-analytics';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const timeRange = searchParams.get('range') || 'all'; // '7d', '30d', 'all'

  // Get project with team check
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, team_id')
    .eq('id', params.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Build date filter
  let dateFilter = {};
  if (timeRange === '7d') {
    dateFilter = { started_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() } };
  } else if (timeRange === '30d') {
    dateFilter = { started_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() } };
  }

  // Get sessions with stage data
  let query = supabase
    .from('sessions')
    .select('id, stage_breakdown, primary_stage, stage_analysis_status, started_at')
    .eq('project_id', params.id);

  if (timeRange !== 'all') {
    const since = timeRange === '7d'
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    query = query.gte('started_at', since.toISOString());
  }

  const { data: sessions, error: sessionsError } = await query;

  if (sessionsError) {
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }

  // Calculate analysis status
  const analysisStatus = {
    totalSessions: sessions?.length || 0,
    analyzedSessions: sessions?.filter(s => s.stage_analysis_status === 'complete').length || 0,
    pendingSessions: sessions?.filter(s => s.stage_analysis_status === 'pending').length || 0,
    errorSessions: sessions?.filter(s => s.stage_analysis_status === 'error').length || 0,
    lastAnalyzedAt: null as string | null,
  };

  // Aggregate stage data from analyzed sessions
  const stageAccumulator: Map<ProjectStage, {
    minutes: number;
    prompts: number;
    sessions: Set<string>;
  }> = new Map();

  let totalMinutes = 0;
  let totalPrompts = 0;
  let dateStart: string | null = null;
  let dateEnd: string | null = null;

  for (const session of sessions || []) {
    if (session.stage_breakdown && session.stage_analysis_status === 'complete') {
      const breakdown = session.stage_breakdown as any;

      for (const [stage, data] of Object.entries(breakdown.stages || {})) {
        const stageData = data as any;
        const existing = stageAccumulator.get(stage as ProjectStage) || {
          minutes: 0,
          prompts: 0,
          sessions: new Set<string>(),
        };
        existing.minutes += stageData.activeMinutes || 0;
        existing.prompts += stageData.promptCount || 0;
        existing.sessions.add(session.id);
        stageAccumulator.set(stage as ProjectStage, existing);
      }

      totalMinutes += breakdown.totalActiveMinutes || 0;
      totalPrompts += breakdown.totalPrompts || 0;

      // Track date range
      if (!dateStart || session.started_at < dateStart) {
        dateStart = session.started_at;
      }
      if (!dateEnd || session.started_at > dateEnd) {
        dateEnd = session.started_at;
      }
    }
  }

  // Build stage breakdown array
  const stageBreakdown = Array.from(stageAccumulator.entries())
    .map(([stage, data]) => ({
      stage,
      activeMinutes: Math.round(data.minutes * 10) / 10,
      promptCount: data.prompts,
      percentage: totalMinutes > 0
        ? Math.round((data.minutes / totalMinutes) * 100)
        : 0,
      sessionCount: data.sessions.size,
    }))
    .sort((a, b) => b.activeMinutes - a.activeMinutes);

  // Determine primary stage
  const primaryStage = stageBreakdown.length > 0
    ? stageBreakdown[0].stage
    : 'unknown';

  const response: ProjectStageAnalytics = {
    projectId: project.id,
    projectName: project.name,
    analysisStatus,
    summary: {
      totalActiveMinutes: Math.round(totalMinutes * 10) / 10,
      totalPrompts,
      sessionsAnalyzed: analysisStatus.analyzedSessions,
      dateRange: {
        start: dateStart || new Date().toISOString(),
        end: dateEnd || new Date().toISOString(),
      },
      stageBreakdown,
    },
    primaryStage,
    averageSessionMinutes: analysisStatus.analyzedSessions > 0
      ? Math.round((totalMinutes / analysisStatus.analyzedSessions) * 10) / 10
      : 0,
  };

  return NextResponse.json({ data: response });
}
```

### Timeline API

```typescript
// app/api/projects/[id]/stage-analytics/timeline/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const granularity = searchParams.get('granularity') || 'day'; // 'day' or 'week'
  const range = searchParams.get('range') || '30d';

  // Get sessions with stage data
  const since = range === '7d'
    ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, stage_breakdown, started_at')
    .eq('project_id', params.id)
    .eq('stage_analysis_status', 'complete')
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: true });

  // Group by date
  const dateGroups: Map<string, any> = new Map();

  for (const session of sessions || []) {
    const date = session.started_at.split('T')[0]; // YYYY-MM-DD
    const dateKey = granularity === 'week'
      ? getWeekStart(date)
      : date;

    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, { stages: {}, totalMinutes: 0 });
    }

    const group = dateGroups.get(dateKey);
    const breakdown = session.stage_breakdown as any;

    for (const [stage, data] of Object.entries(breakdown?.stages || {})) {
      const stageData = data as any;
      if (!group.stages[stage]) {
        group.stages[stage] = { activeMinutes: 0, promptCount: 0, sessionCount: 0 };
      }
      group.stages[stage].activeMinutes += stageData.activeMinutes || 0;
      group.stages[stage].promptCount += stageData.promptCount || 0;
      group.stages[stage].sessionCount++;
    }

    group.totalMinutes += breakdown?.totalActiveMinutes || 0;
  }

  const dataPoints = Array.from(dateGroups.entries())
    .map(([date, data]) => ({
      date,
      stages: data.stages,
      totalMinutes: Math.round(data.totalMinutes * 10) / 10,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    data: {
      projectId: params.id,
      granularity,
      dataPoints,
    },
  });
}

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}
```

## Tests

### Unit Tests

```typescript
describe('Stage Analytics API', () => {
  describe('GET /api/projects/{id}/stage-analytics', () => {
    it('should return aggregated stage data');
    it('should filter by time range');
    it('should require authentication');
    it('should return 404 for unknown project');
    it('should handle projects with no analyzed sessions');
  });

  describe('GET /api/projects/{id}/stage-analytics/timeline', () => {
    it('should return daily data points');
    it('should support weekly granularity');
    it('should filter by date range');
  });
});
```

## Dependencies

- Story 31-2: Stage Persistence (populates stage_breakdown)
- Story 31-4: Session Summary (stores summary data)

## Definition of Done

- [x] Both API endpoints implemented
- [x] Time range filtering working
- [x] Proper aggregation of stage data
- [x] Authentication and authorization
- [x] Unit tests passing
- [x] E2E tests for API endpoints
