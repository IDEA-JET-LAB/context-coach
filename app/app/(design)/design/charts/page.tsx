'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, BarChart, Gauge, Sparkline, Heatmap } from '@/components/charts';

// Sample data for demonstrations
const lineChartData = [
  { date: '2024-01-01', score: 6.2, team: 5.8 },
  { date: '2024-01-02', score: 7.1, team: 6.0 },
  { date: '2024-01-03', score: 6.8, team: 6.2 },
  { date: '2024-01-04', score: 7.5, team: 6.5 },
  { date: '2024-01-05', score: 8.2, team: 6.8 },
  { date: '2024-01-06', score: 7.9, team: 7.0 },
  { date: '2024-01-07', score: 8.5, team: 7.2 },
];

const barChartData = [
  { name: 'Clarity', value: 8.2 },
  { name: 'Specificity', value: 7.5 },
  { name: 'Context', value: 6.8 },
  { name: 'Complexity', value: 7.1 },
  { name: 'Communication', value: 8.8 },
];

const sparklineData = [
  { value: 5 }, { value: 7 }, { value: 6 }, { value: 8 },
  { value: 7 }, { value: 9 }, { value: 8 }, { value: 10 },
];

const sparklineDownData = [
  { value: 8 }, { value: 7 }, { value: 8 }, { value: 6 },
  { value: 5 }, { value: 4 }, { value: 5 }, { value: 3 },
];

// Generate sample heatmap data
const heatmapData = Array.from({ length: 7 }, (_, day) =>
  Array.from({ length: 24 }, (_, hour) => ({
    day,
    hour,
    value: Math.random() > 0.6 ? Math.floor(Math.random() * 10) : 0,
  }))
).flat();

export default function ChartsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Charts</h1>
        <p className="mt-2 text-muted-foreground">
          Data visualization components built with recharts. All components use semantic
          design tokens for consistent theming.
        </p>
      </div>

      {/* Line Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">LineChart</CardTitle>
          <CardDescription>
            Display trends over time with multiple series support.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LineChart
            data={lineChartData}
            series={[
              { dataKey: 'score', name: 'Your Score', color: 'hsl(var(--primary))' },
              { dataKey: 'team', name: 'Team Average', color: 'hsl(var(--secondary))' },
            ]}
            height={250}
            yAxisDomain={[0, 10]}
          />
          <div className="mt-4 rounded-lg bg-muted p-4">
            <h4 className="text-sm font-medium text-foreground">Props</h4>
            <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto">
{`interface LineChartProps {
  data: LineChartDataPoint[];
  series: LineChartSeries[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  xAxisKey?: string;
  yAxisDomain?: [number, number];
  dateFormat?: (value: string) => string;
  className?: string;
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Bar Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">BarChart</CardTitle>
          <CardDescription>
            Compare values across categories. Supports horizontal and vertical layouts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Vertical Layout</h4>
              <BarChart data={barChartData} height={200} layout="vertical" />
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Horizontal Layout</h4>
              <BarChart data={barChartData} height={200} layout="horizontal" />
            </div>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <h4 className="text-sm font-medium text-foreground">Props</h4>
            <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto">
{`interface BarChartProps {
  data: BarChartDataPoint[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  layout?: 'horizontal' | 'vertical';
  barColor?: string;
  useDataColors?: boolean;
  className?: string;
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Gauge */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Gauge</CardTitle>
          <CardDescription>
            Display score values (0-10) with color-coded feedback. Uses semantic score colors.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-8 items-end">
            <Gauge value={8.5} label="Excellent" size="lg" />
            <Gauge value={6.2} label="Good" size="md" />
            <Gauge value={3.1} label="Needs Work" size="sm" />
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-score-high" />
              <span className="text-sm text-muted-foreground">7-10 (High)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-score-medium" />
              <span className="text-sm text-muted-foreground">4-6.9 (Medium)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-score-growth" />
              <span className="text-sm text-muted-foreground">0-3.9 (Growth)</span>
            </div>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <h4 className="text-sm font-medium text-foreground">Props</h4>
            <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto">
{`interface GaugeProps {
  value: number;       // 0-10
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Sparkline */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Sparkline</CardTitle>
          <CardDescription>
            Inline mini charts for showing trends. Auto-colors based on trend direction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Improving:</span>
              <Sparkline data={sparklineData} width={80} height={24} />
              <span className="text-sm font-medium text-score-high">+25%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Declining:</span>
              <Sparkline data={sparklineDownData} width={80} height={24} />
              <span className="text-sm font-medium text-score-growth">-40%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Custom color:</span>
              <Sparkline
                data={sparklineData}
                width={80}
                height={24}
                color="hsl(var(--secondary))"
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <h4 className="text-sm font-medium text-foreground">Props</h4>
            <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto">
{`interface SparklineProps {
  data: SparklineDataPoint[];
  width?: number;
  height?: number;
  color?: string;        // Auto-colors if not set
  showFill?: boolean;
  className?: string;
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Heatmap</CardTitle>
          <CardDescription>
            Visualize activity patterns across days and hours. Perfect for showing usage patterns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Heatmap data={heatmapData} />
          <div className="rounded-lg bg-muted p-4">
            <h4 className="text-sm font-medium text-foreground">Props</h4>
            <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto">
{`interface HeatmapProps {
  data: HeatmapDataPoint[];
  maxValue?: number;       // For color scaling
  showDayLabels?: boolean;
  showHourLabels?: boolean;
  className?: string;
}

interface HeatmapDataPoint {
  day: number;   // 0-6 (Sun-Sat)
  hour: number;  // 0-23
  value: number;
  label?: string;
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
