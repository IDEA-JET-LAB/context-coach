'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from '@/components/charts';

export default function GaugesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gauges & Scores</h1>
        <p className="mt-2 text-muted-foreground">
          Components for displaying score values and progress indicators with color-coded feedback.
        </p>
      </div>

      {/* Gauge Component */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Gauge</CardTitle>
          <CardDescription>
            Semi-circle gauge for displaying scores from 0-10. Colors automatically adjust based on score range.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">Score Ranges</h4>
            <div className="flex flex-wrap gap-8 items-end">
              <Gauge value={9.2} label="Excellent (7-10)" size="lg" />
              <Gauge value={5.8} label="Good (4-6.9)" size="lg" />
              <Gauge value={2.5} label="Needs Work (0-3.9)" size="lg" />
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">Size Variants</h4>
            <div className="flex flex-wrap gap-8 items-end">
              <Gauge value={7.5} label="Small" size="sm" />
              <Gauge value={7.5} label="Medium" size="md" />
              <Gauge value={7.5} label="Large" size="lg" />
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">Without Value Display</h4>
            <div className="flex flex-wrap gap-8 items-end">
              <Gauge value={8.0} label="Score Hidden" size="md" showValue={false} />
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">Edge Cases</h4>
            <div className="flex flex-wrap gap-8 items-end">
              <Gauge value={0} label="Zero" size="md" />
              <Gauge value={10} label="Perfect" size="md" />
              <Gauge value={5} label="Middle" size="md" />
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <h4 className="text-sm font-medium text-foreground">Props</h4>
            <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto">
{`interface GaugeProps {
  value: number;       // 0-10 (clamped if outside range)
  label?: string;      // Label below the gauge
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean; // Show numeric value (default: true)
  className?: string;
}

// Color thresholds:
// 7-10: score-high (green)
// 4-6.9: score-medium (yellow)
// 0-3.9: score-growth (red)`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Color Reference */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Score Color Reference</CardTitle>
          <CardDescription>
            Semantic colors used for score visualization across all components.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-score-high/10 border border-score-high/20">
              <div className="h-8 w-8 rounded-full bg-score-high" />
              <div>
                <p className="font-medium text-score-high">Score High</p>
                <p className="text-sm text-muted-foreground">7.0 - 10.0</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-score-medium/10 border border-score-medium/20">
              <div className="h-8 w-8 rounded-full bg-score-medium" />
              <div>
                <p className="font-medium text-score-medium">Score Medium</p>
                <p className="text-sm text-muted-foreground">4.0 - 6.9</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-score-growth/10 border border-score-growth/20">
              <div className="h-8 w-8 rounded-full bg-score-growth" />
              <div>
                <p className="font-medium text-score-growth">Score Growth</p>
                <p className="text-sm text-muted-foreground">0.0 - 3.9</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
