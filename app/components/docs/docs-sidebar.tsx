'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { docSections } from '@/lib/docs/config';
import { Button } from '@/components/ui/button';

export function DocsSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const currentSlug = pathname.split('/docs/')[1] || '';

  return (
    <>
      {/* Mobile toggle button */}
      <div className="flex items-center justify-between border-b border-border p-4 md:hidden">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4" />
          <span>Documentation</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar navigation */}
      <nav
        className={cn(
          'border-r border-border bg-background',
          // Mobile: full width overlay, hidden by default
          'fixed inset-x-0 top-[57px] z-40 h-[calc(100vh-57px)] md:static md:h-auto',
          // Mobile visibility
          isOpen ? 'block' : 'hidden md:block',
          // Desktop: fixed width
          'md:w-64 md:shrink-0'
        )}
        aria-label="Documentation navigation"
      >
        <div className="flex flex-col gap-1 p-4">
          <Link
            href="/docs"
            onClick={() => setIsOpen(false)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
              pathname === '/docs'
                ? 'bg-surface text-primary font-medium'
                : 'text-muted-foreground hover:bg-surface hover:text-foreground'
            )}
          >
            <BookOpen className="h-4 w-4" />
            Overview
          </Link>

          <div className="my-2 border-t border-border" />

          {docSections.map((section) => {
            const isActive = currentSlug === section.slug;
            const Icon = section.icon;

            return (
              <Link
                key={section.slug}
                href={`/docs/${section.slug}`}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-surface text-primary font-medium'
                    : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                {section.title}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 top-[57px] z-30 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
