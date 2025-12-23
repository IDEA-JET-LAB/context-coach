'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  FormInput,
  Bell,
  Import,
  LineChart,
  LayoutGrid,
  Gauge,
  FileCode2,
  PanelTop,
} from 'lucide-react';

const categories = [
  { name: 'Overview', href: '/design', icon: LayoutGrid },
  { name: 'Charts', href: '/design/charts', icon: LineChart },
  { name: 'Analytics', href: '/design/analytics', icon: BarChart3 },
  { name: 'Forms', href: '/design/forms', icon: FormInput },
  { name: 'Tabs & Navigation', href: '/design/tabs', icon: PanelTop },
  { name: 'Import/Recovery', href: '/design/import', icon: Import },
  { name: 'Feedback', href: '/design/feedback', icon: Bell },
  { name: 'Gauges & Scores', href: '/design/gauges', icon: Gauge },
  { name: 'Code Display', href: '/design/code', icon: FileCode2 },
];

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card p-4">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Component Library</h1>
          <p className="text-sm text-muted-foreground">Contextor Design System</p>
        </div>
        <nav className="space-y-1">
          {categories.map((category) => {
            const isActive =
              pathname === category.href ||
              (category.href !== '/design' && pathname.startsWith(category.href));
            return (
              <Link
                key={category.href}
                href={category.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <category.icon className="h-4 w-4" />
                {category.name}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 border-t border-border pt-4">
          <Link
            href="/home"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
