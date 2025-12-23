import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import {
  BarChart3,
  FormInput,
  Bell,
  Import,
  LineChart,
  Gauge,
  FileCode2,
} from 'lucide-react';

const componentCategories = [
  {
    title: 'Charts',
    description: 'Line charts, bar charts, sparklines, and heatmaps for data visualization',
    href: '/design/charts',
    icon: LineChart,
    components: ['LineChart', 'BarChart', 'Sparkline', 'Heatmap'],
    status: 'new',
  },
  {
    title: 'Analytics',
    description: 'Metric cards, trend indicators, comparison bars, and insight displays',
    href: '/design/analytics',
    icon: BarChart3,
    components: ['MetricCard', 'TrendIndicator', 'ComparisonBar', 'InsightCard', 'SessionTimeline', 'DimensionRadar'],
    status: 'new',
  },
  {
    title: 'Gauges & Scores',
    description: 'Score gauges, progress indicators, and score displays',
    href: '/design/gauges',
    icon: Gauge,
    components: ['ScoreGauge', 'ProgressRing', 'ScoreBadge'],
    status: 'new',
  },
  {
    title: 'Forms',
    description: 'Multi-step forms, rule editors, weight sliders, and input components',
    href: '/design/forms',
    icon: FormInput,
    components: ['MultiStepForm', 'RuleEditor', 'JsonEditor', 'WeightSlider', 'TagInput'],
    status: 'new',
  },
  {
    title: 'Import/Recovery',
    description: 'File browsers, import previews, progress tracking, and recovery prompts',
    href: '/design/import',
    icon: Import,
    components: ['SessionPreviewCard', 'ImportProgressBar', 'FileTree', 'RecoveryBanner', 'SessionSnapshot'],
    status: 'new',
  },
  {
    title: 'Feedback',
    description: 'Toasts, alerts, confirmation modals, and empty states',
    href: '/design/feedback',
    icon: Bell,
    components: ['ToastVariants', 'InlineAlert', 'ConfirmationModal', 'EmptyStateVariants'],
    status: 'new',
  },
  {
    title: 'Code Display',
    description: 'Code blocks, syntax highlighting, and diff views',
    href: '/design/code',
    icon: FileCode2,
    components: ['CodeBlock', 'SyntaxHighlight', 'DiffView'],
    status: 'new',
  },
];

export default function DesignOverviewPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Component Library</h1>
        <p className="mt-2 text-muted-foreground">
          A comprehensive library of styled, reusable components for Phase 2 features.
          Browse by category to see component examples, usage patterns, and props documentation.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {componentCategories.map((category) => (
          <Link key={category.href} href={category.href}>
            <Card className="h-full bg-card border-border hover:border-primary/50 hover:bg-surface-hover transition-colors cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <category.icon className="h-6 w-6 text-primary" />
                  {category.status === 'new' && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      New
                    </span>
                  )}
                </div>
                <CardTitle className="text-foreground">{category.title}</CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {category.components.slice(0, 4).map((comp) => (
                    <span
                      key={comp}
                      className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {comp}
                    </span>
                  ))}
                  {category.components.length > 4 && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      +{category.components.length - 4} more
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Design Tokens</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          All components use semantic design tokens for consistent theming.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ColorSwatch name="Primary" className="bg-primary" />
          <ColorSwatch name="Secondary" className="bg-secondary" />
          <ColorSwatch name="Muted" className="bg-muted" />
          <ColorSwatch name="Accent" className="bg-accent" />
          <ColorSwatch name="Score High" className="bg-score-high" />
          <ColorSwatch name="Score Medium" className="bg-score-medium" />
          <ColorSwatch name="Score Growth" className="bg-score-growth" />
          <ColorSwatch name="Destructive" className="bg-destructive" />
        </div>
      </div>
    </div>
  );
}

function ColorSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-8 w-8 rounded border border-border ${className}`} />
      <span className="text-sm text-foreground">{name}</span>
    </div>
  );
}
