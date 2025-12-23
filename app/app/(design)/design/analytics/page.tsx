'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/analytics/metric-card';
import { TrendIndicator } from '@/components/analytics/trend-indicator';
import { ComparisonBar } from '@/components/analytics/comparison-bar';
import { InsightCard } from '@/components/analytics/insight-card';
import { SessionTimeline, SessionEvent } from '@/components/analytics/session-timeline';
import { DimensionRadar } from '@/components/analytics/dimension-radar';
// D-6 Advanced Analytics Components (simplified demos)
import { ContextGauge } from '@/components/analytics/context-gauge';
import { WorkStyleBadge } from '@/components/analytics/work-style-badge';
import { ComplexityCard } from '@/components/analytics/complexity-card';
import { TimingHeatmap } from '@/components/analytics/timing-heatmap';
import { ToolUsageChart } from '@/components/analytics/tool-usage-chart';
import { SessionHealth } from '@/components/analytics/session-health';
import { EfficiencyCard } from '@/components/analytics/efficiency-card';
import { Activity, Users, FileText, Zap } from 'lucide-react';

// Sample data for existing components
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

// D-6 Sample Data
const contextHistory = [
  { timestamp: '10:00', usage: 15 },
  { timestamp: '10:15', usage: 28 },
  { timestamp: '10:30', usage: 45 },
  { timestamp: '10:45', usage: 62 },
  { timestamp: '11:00', usage: 78 },
];

const workStyleDistribution = [
  { style: 'focused' as const, percentage: 35, promptCount: 42 },
  { style: 'explorer' as const, percentage: 25, promptCount: 30 },
  { style: 'iterative' as const, percentage: 20, promptCount: 24 },
  { style: 'architect' as const, percentage: 12, promptCount: 14 },
  { style: 'rapid' as const, percentage: 8, promptCount: 10 },
];

const complexityBreakdown = {
  length: 7.2,
  structure: 6.5,
  specificity: 7.0,
  context: 6.4,
};

const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  promptCount: Math.floor(Math.random() * 20) + (i >= 9 && i <= 17 ? 15 : 2),
  avgScore: 6 + Math.random() * 3,
}));

const toolUsageData = [
  { toolId: 'read', name: 'Read', usageCount: 156, percentage: 32, effectiveness: 8.2 },
  { toolId: 'edit', name: 'Edit', usageCount: 98, percentage: 20, effectiveness: 7.8 },
  { toolId: 'bash', name: 'Bash', usageCount: 87, percentage: 18, effectiveness: 7.5 },
  { toolId: 'grep', name: 'Grep', usageCount: 65, percentage: 13, effectiveness: 8.0 },
  { toolId: 'write', name: 'Write', usageCount: 45, percentage: 9, effectiveness: 7.2 },
  { toolId: 'glob', name: 'Glob', usageCount: 38, percentage: 8, effectiveness: 7.9 },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics Components</h1>
        <p className="mt-2 text-muted-foreground">
          Components for displaying metrics, trends, comparisons, and AI-generated insights.
          <span className="ml-2 text-primary">(Includes D-6 Advanced Analytics)</span>
        </p>
      </div>

      {/* Context Gauge */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">ContextGauge <span className="text-xs font-normal text-primary ml-2">D-6</span></CardTitle>
          <CardDescription>Visualize context window usage with timeline history.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <ContextGauge
              usage={45}
              history={contextHistory}
              maxTokens={200000}
              currentTokens={90000}
            />
            <ContextGauge
              usage={78}
              warningThreshold={70}
              criticalThreshold={90}
              maxTokens={200000}
              currentTokens={156000}
            />
            <ContextGauge
              usage={92}
              warningThreshold={70}
              criticalThreshold={90}
              maxTokens={200000}
              currentTokens={184000}
            />
          </div>
        </CardContent>
      </Card>

      {/* Work Style Badge */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">WorkStyleBadge <span className="text-xs font-normal text-primary ml-2">D-6</span></CardTitle>
          <CardDescription>Categorize and display user work patterns.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <WorkStyleBadge
              primaryStyle="focused"
              distribution={workStyleDistribution}
              showDistribution
              chartType="pie"
            />
            <WorkStyleBadge
              primaryStyle="explorer"
              distribution={workStyleDistribution}
              showDistribution
              chartType="bar"
            />
          </div>
        </CardContent>
      </Card>

      {/* Complexity Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">ComplexityCard <span className="text-xs font-normal text-primary ml-2">D-6</span></CardTitle>
          <CardDescription>Display prompt complexity metrics with breakdown.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <ComplexityCard
              score={6.8}
              breakdown={complexityBreakdown}
              trendDirection="up"
              change={0.5}
              recommendation="Your prompt complexity is well-balanced. Continue using structured formatting."
            />
          </div>
        </CardContent>
      </Card>

      {/* Timing Heatmap */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">TimingHeatmap <span className="text-xs font-normal text-primary ml-2">D-6</span></CardTitle>
          <CardDescription>Visualize activity patterns by time of day.</CardDescription>
        </CardHeader>
        <CardContent>
          <TimingHeatmap
            hourlyData={hourlyActivity}
            peakHours={[10, 14, 15]}
            avgResponseTime={2.3}
          />
        </CardContent>
      </Card>

      {/* Tool Usage Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">ToolUsageChart <span className="text-xs font-normal text-primary ml-2">D-6</span></CardTitle>
          <CardDescription>Breakdown of tool usage with effectiveness indicators.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <ToolUsageChart data={toolUsageData} displayMode="bar" showEffectiveness />
            <ToolUsageChart data={toolUsageData} displayMode="pie" />
          </div>
        </CardContent>
      </Card>

      {/* Session Health */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">SessionHealth <span className="text-xs font-normal text-primary ml-2">D-6</span></CardTitle>
          <CardDescription>Overall session health gauge with contributing factors.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <SessionHealth
              score={72}
              status="healthy"
              trendDirection="up"
              change={5}
              sessionDuration={45}
              promptCount={23}
            />
          </div>
        </CardContent>
      </Card>

      {/* Efficiency Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">EfficiencyCard <span className="text-xs font-normal text-primary ml-2">D-6</span></CardTitle>
          <CardDescription>Workflow efficiency metrics with bottleneck detection.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-lg">
            <EfficiencyCard
              score={78}
              trend="up"
              change={8}
              avgPromptTime={45}
              avgIterations={2.3}
              successRate={0.85}
            />
          </div>
        </CardContent>
      </Card>

      {/* Divider for existing components */}
      <div className="border-t border-border pt-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Core Analytics Components</h2>
        <p className="text-muted-foreground mb-6">Original analytics components from D-3.</p>
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
              details="Your context scores are 15% below team average."
              action="View examples"
              onAction={() => {}}
              dismissible={false}
            />
            <InsightCard
              type="achievement"
              message="Great week! Your scores improved by 12%"
              details="You submitted 23 prompts with an average score of 8.1."
            />
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
