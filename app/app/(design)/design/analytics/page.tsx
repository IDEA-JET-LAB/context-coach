'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/analytics/metric-card';
import { TrendIndicator } from '@/components/analytics/trend-indicator';
import { ComparisonBar } from '@/components/analytics/comparison-bar';
import { InsightCard } from '@/components/analytics/insight-card';
import { SessionTimeline, SessionEvent } from '@/components/analytics/session-timeline';
import { DimensionRadar } from '@/components/analytics/dimension-radar';
import { Activity, Users, FileText, Zap } from 'lucide-react';

// Sample data
const dimensionData = [
  { dimension: 'Clarity', score: 8.2 },
  { dimension: 'Specificity', score: 7.5 },
  { dimension: 'Context', score: 6.8 },
  { dimension: 'Complexity', score: 7.1 },
  { dimension: 'Communication', score: 8.8 },
];

const teamDimensionData = [
  { dimension: 'Clarity', score: 7.0 },
  { dimension: 'Specificity', score: 6.8 },
  { dimension: 'Context', score: 7.2 },
  { dimension: 'Complexity', score: 6.5 },
  { dimension: 'Communication', score: 7.5 },
];

const sessionEvents: SessionEvent[] = [
  { id: '1', timestamp: new Date('2024-01-15T10:05:00'), type: 'prompt', label: 'First prompt' },
  { id: '2', timestamp: new Date('2024-01-15T10:08:00'), type: 'analysis', label: 'Analysis complete', score: 7.5 },
  { id: '3', timestamp: new Date('2024-01-15T10:15:00'), type: 'prompt', label: 'Follow-up prompt' },
  { id: '4', timestamp: new Date('2024-01-15T10:18:00'), type: 'analysis', label: 'Analysis complete', score: 8.2 },
];

export default function AnalyticsPage() {
  const [dismissedInsight, setDismissedInsight] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics Components</h1>
        <p className="mt-2 text-muted-foreground">
          Components for displaying metrics, trends, comparisons, and AI-generated insights.
        </p>
      </div>

      {/* MetricCard */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">MetricCard</CardTitle>
          <CardDescription>Display KPIs with optional trends and icons.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Prompts"
              value="1,234"
              change="+12%"
              trend="up"
              subtitle="This month"
              icon={FileText}
            />
            <MetricCard
              title="Average Score"
              value="7.8"
              change="+0.5"
              trend="up"
              subtitle="vs last week"
              icon={Activity}
            />
            <MetricCard
              title="Active Users"
              value="48"
              change="-3%"
              trend="down"
              subtitle="Last 7 days"
              icon={Users}
            />
            <MetricCard
              title="Analysis Rate"
              value="98.5%"
              trend="stable"
              subtitle="System health"
              icon={Zap}
            />
          </div>
          <MetricCard title="Loading State" value="" loading />
        </CardContent>
      </Card>

      {/* TrendIndicator */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">TrendIndicator</CardTitle>
          <CardDescription>Show trend direction with various visual styles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Default Variant</h4>
            <div className="flex flex-wrap gap-6">
              <TrendIndicator direction="up" value="+15%" label="vs last week" />
              <TrendIndicator direction="down" value="-8%" label="vs last week" />
              <TrendIndicator direction="stable" label="No change" />
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Pill Variant</h4>
            <div className="flex flex-wrap gap-4">
              <TrendIndicator direction="up" value="+15%" variant="pill" />
              <TrendIndicator direction="down" value="-8%" variant="pill" />
              <TrendIndicator direction="stable" label="Stable" variant="pill" />
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Inline Variant (for tables)</h4>
            <div className="flex flex-wrap gap-6">
              <span className="text-sm">Score: 7.8 <TrendIndicator direction="up" value="+0.5" variant="inline" /></span>
              <span className="text-sm">Users: 48 <TrendIndicator direction="down" value="-3" variant="inline" /></span>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Sizes</h4>
            <div className="flex items-center gap-6">
              <TrendIndicator direction="up" value="+15%" size="sm" />
              <TrendIndicator direction="up" value="+15%" size="md" />
              <TrendIndicator direction="up" value="+15%" size="lg" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ComparisonBar */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">ComparisonBar</CardTitle>
          <CardDescription>Compare user values against team averages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-xl space-y-6">
            <ComparisonBar
              label="Clarity"
              userValue={8.2}
              compareValue={7.0}
              userLabel="You"
              compareLabel="Team Avg"
            />
            <ComparisonBar
              label="Specificity"
              userValue={6.5}
              compareValue={7.2}
              userLabel="You"
              compareLabel="Team Avg"
            />
            <ComparisonBar
              label="Context"
              userValue={7.5}
              compareValue={7.5}
              userLabel="You"
              compareLabel="Team Avg"
            />
          </div>
        </CardContent>
      </Card>

      {/* InsightCard */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">InsightCard</CardTitle>
          <CardDescription>Display AI-generated insights and suggestions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <InsightCard
              type="suggestion"
              message="Try adding more context to your prompts"
              details="Your context scores are 15% below team average. Including more background information helps Claude understand your intent."
              action="View examples"
              onAction={() => {}}
              dismissible={false}
            />
            <InsightCard
              type="achievement"
              message="Great week! Your scores improved by 12%"
              details="You submitted 23 prompts with an average score of 8.1, up from 7.2 last week."
            />
            <InsightCard
              type="warning"
              message="Prompt quality declining this week"
              details="Your average score dropped from 7.8 to 6.9. Consider reviewing our prompting best practices."
              action="Review tips"
              onAction={() => {}}
            />
            <InsightCard
              type="insight"
              message="You're most productive on Tuesday mornings"
              details="Your highest-scoring prompts tend to be submitted between 9-11 AM on Tuesdays."
            />
          </div>
        </CardContent>
      </Card>

      {/* SessionTimeline */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">SessionTimeline</CardTitle>
          <CardDescription>Visualize coding session events and progress.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h4 className="mb-4 text-sm font-medium text-foreground">Completed Session</h4>
              <SessionTimeline
                startTime={new Date('2024-01-15T10:00:00')}
                endTime={new Date('2024-01-15T10:30:00')}
                status="completed"
                events={sessionEvents}
              />
            </div>
            <div>
              <h4 className="mb-4 text-sm font-medium text-foreground">In Progress</h4>
              <SessionTimeline
                startTime={new Date('2024-01-15T10:00:00')}
                status="in_progress"
                events={sessionEvents.slice(0, 2)}
              />
            </div>
            <div>
              <h4 className="mb-4 text-sm font-medium text-foreground">Interrupted (Compact)</h4>
              <SessionTimeline
                startTime={new Date('2024-01-15T10:00:00')}
                endTime={new Date('2024-01-15T10:20:00')}
                status="interrupted"
                events={sessionEvents.slice(0, 2)}
                compact
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DimensionRadar */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">DimensionRadar</CardTitle>
          <CardDescription>Spider/radar chart for displaying multi-dimensional scores.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h4 className="mb-4 text-sm font-medium text-foreground">User Scores Only</h4>
              <DimensionRadar data={dimensionData} height={250} />
            </div>
            <div>
              <h4 className="mb-4 text-sm font-medium text-foreground">With Team Comparison</h4>
              <DimensionRadar
                data={dimensionData}
                compareData={teamDimensionData}
                height={250}
                userLabel="Your Scores"
                compareLabel="Team Average"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
