# Story 6.1: Dashboard Layout & Navigation

Status: ready-for-dev

## Story

**As a** logged-in user,
**I want** a clear dashboard layout,
**So that** I can easily navigate between sections.

## Acceptance Criteria

1. **Given** I am logged in
   **When** I access the dashboard
   **Then** I see a 64px icon-only sidebar on the left
   **And** the main content area displays the prompt feed
   **And** the header shows my name, avatar, and team switcher

2. **Given** the sidebar navigation
   **When** I click icons
   **Then** I can navigate to: Feed, Analytics, Team, Projects, Settings
   **And** the current section is highlighted
   **And** I can navigate using keyboard (Tab + Enter)

3. **Given** the UX design specs
   **When** the dashboard is styled
   **Then** it uses dark mode (#0a0a0a background)
   **And** follows the shadcn/ui + Tailwind patterns
   **And** meets WCAG AA color contrast (4.5:1 for text)

4. **Given** I am not authenticated
   **When** I try to access any `/dashboard/*` route
   **Then** I am redirected to `/login`

## Tasks / Subtasks

- [ ] **Task 1: Create dashboard layout structure** (AC: #1, #3, #4)
  - [ ] Create `app/(dashboard)/layout.tsx` with sidebar + main content structure
  - [ ] Verify `middleware.ts` protects all `(dashboard)` routes (redirect unauthenticated to `/login`)
  - [ ] Set up dark mode as default with `#0a0a0a` background
  - [ ] Configure layout for full viewport height (`h-screen`)
  - [ ] Add flex container with sidebar (fixed width) and content (flex-grow)

- [ ] **Task 2: Build 64px icon-only sidebar component** (AC: #1, #2)
  - [ ] Create `components/dashboard/sidebar.tsx` component
  - [ ] Mark as `'use client'` (uses `usePathname` hook)
  - [ ] Set fixed width to 64px with centered icons
  - [ ] Add navigation icons using Lucide React:
    - [ ] Feed icon (MessageSquare or Inbox)
    - [ ] Analytics icon (BarChart2 or TrendingUp)
    - [ ] Team icon (Users)
    - [ ] Projects icon (FolderOpen)
    - [ ] Settings icon (Settings)
  - [ ] Style icons with `text-muted-foreground` default, `text-primary` when active
  - [ ] Add hover states with subtle background highlight
  - [ ] Include tooltips on hover showing section names (accessibility requirement)
  - [ ] Ensure keyboard focus states are visible (`focus-visible:ring-2`)

- [ ] **Task 3: Implement sidebar navigation with active state** (AC: #2)
  - [ ] Use Next.js `usePathname()` hook to detect current route
  - [ ] Apply active styling when route matches section
  - [ ] Wrap icons in `Link` components pointing to correct routes:
    - `/dashboard` (Feed)
    - `/dashboard/analytics` (Analytics)
    - `/dashboard/team` (Team)
    - `/dashboard/projects` (Projects)
    - `/dashboard/settings` (Settings)
  - [ ] Add subtle animation on hover/active transitions
  - [ ] Ensure all navigation items are focusable via Tab key

- [ ] **Task 4: Create dashboard header component** (AC: #1)
  - [ ] Create `components/dashboard/header.tsx` component
  - [ ] Add user avatar (use initials or placeholder if no image)
  - [ ] Display user name next to avatar
  - [ ] Style header with bottom border (`border-[#2a2a2a]`) for separation
  - [ ] Position header at top of main content area
  - [ ] Fetch user data via Server Component or pass from layout

- [ ] **Task 5: Implement team switcher dropdown** (AC: #1)
  - [ ] Create `components/dashboard/team-switcher.tsx` component
  - [ ] Mark as `'use client'` (uses hooks and interactivity)
  - [ ] Use shadcn/ui `DropdownMenu` component
  - [ ] Fetch user's teams from `team_members` table using TanStack Query
  - [ ] Display current team name in trigger button
  - [ ] Show team list in dropdown with checkmark for current
  - [ ] Handle team switch: call Supabase function to update JWT `team_id` claim
  - [ ] After team switch, invalidate all queries and refresh page data
  - [ ] Use `isPending` (not `isLoading`) for loading state (TanStack Query v5)

- [ ] **Task 6: Set up dashboard route pages** (AC: #2)
  - [ ] Create `app/(dashboard)/dashboard/page.tsx` (Feed - default)
  - [ ] Create `app/(dashboard)/dashboard/analytics/page.tsx` (placeholder)
  - [ ] Create `app/(dashboard)/dashboard/team/page.tsx` (placeholder)
  - [ ] Create `app/(dashboard)/dashboard/projects/page.tsx` (placeholder)
  - [ ] Create `app/(dashboard)/dashboard/settings/page.tsx` (placeholder)
  - [ ] Each placeholder should show section title and "Coming soon" message
  - [ ] Use Server Components for pages (no `'use client'` unless needed)

- [ ] **Task 7: Apply dark mode styling and accessibility** (AC: #3)
  - [ ] Ensure Tailwind dark mode is configured in `tailwind.config.ts`
  - [ ] Set `dark` class on root HTML element or use CSS variables
  - [ ] Apply consistent dark color palette:
    - Background: `#0a0a0a`
    - Card/Surface: `#1a1a1a`
    - Border: `#2a2a2a`
    - Text: `#fafafa`
    - Muted text: `#a1a1aa`
  - [ ] Verify WCAG AA contrast (4.5:1) for all text colors
  - [ ] Test all components render correctly in dark mode
  - [ ] Add appropriate ARIA labels to navigation icons

## Dev Notes

### Architecture Constraints (from architecture.md)

**Technology Stack:**
- Next.js 15 with App Router
- TypeScript in strict mode
- Tailwind CSS + shadcn/ui
- TanStack Query 5.x (`isPending` not `isLoading`)
- Supabase for auth and data

**Route Groups:**
- `(auth)` for public routes (login, signup)
- `(dashboard)` for protected routes
- All dashboard routes under `app/(dashboard)/`

**Authentication:**
- `middleware.ts` handles redirect of unauthenticated users
- Supabase session stored in cookies via `supabase-ssr`
- JWT contains `team_id` claim for current team context

**Multi-Tenancy:**
- Current team stored in JWT `team_id` claim
- All RLS policies filter by `auth.jwt() ->> 'team_id'`
- Team switch updates JWT and requires session refresh

### Layout Structure

```typescript
// app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### Sidebar Component Pattern

```typescript
// components/dashboard/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, BarChart2, Users, FolderOpen, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems = [
  { icon: MessageSquare, label: 'Feed', href: '/dashboard' },
  { icon: BarChart2, label: 'Analytics', href: '/dashboard/analytics' },
  { icon: Users, label: 'Team', href: '/dashboard/team' },
  { icon: FolderOpen, label: 'Projects', href: '/dashboard/projects' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-16 flex-col items-center border-r border-[#2a2a2a] bg-[#0a0a0a] py-4">
      <TooltipProvider>
        <nav role="navigation" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isActive
                        ? 'bg-[#1a1a1a] text-primary'
                        : 'text-muted-foreground hover:bg-[#1a1a1a] hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </TooltipProvider>
    </aside>
  );
}
```

### Team Switcher with TanStack Query

```typescript
// components/dashboard/team-switcher.tsx
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function TeamSwitcher() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: teams, isPending } = useQuery({
    queryKey: ['user-teams'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('team_members')
        .select('team:teams(id, name)')
        .eq('user_id', user.id);

      if (error) throw error;
      return data?.map(tm => tm.team) ?? [];
    },
  });

  const handleTeamSwitch = async (teamId: string) => {
    // Update JWT claims with new team_id
    // This requires a Supabase function or session refresh
    await supabase.rpc('set_current_team', { team_id: teamId });

    // Invalidate all cached queries (data is now different team)
    await queryClient.invalidateQueries();

    // Refresh to get new session
    router.refresh();
  };

  if (isPending) {
    return <div className="h-8 w-24 animate-pulse rounded bg-[#1a1a1a]" />;
  }

  // ... render dropdown with teams list
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Dashboard Layout | `app/(dashboard)/layout.tsx` |
| Sidebar | `components/dashboard/sidebar.tsx` |
| Header | `components/dashboard/header.tsx` |
| Team Switcher | `components/dashboard/team-switcher.tsx` |
| Feed Page | `app/(dashboard)/dashboard/page.tsx` |
| Analytics Page | `app/(dashboard)/dashboard/analytics/page.tsx` |
| Team Page | `app/(dashboard)/dashboard/team/page.tsx` |
| Projects Page | `app/(dashboard)/dashboard/projects/page.tsx` |
| Settings Page | `app/(dashboard)/dashboard/settings/page.tsx` |

### shadcn/ui Components Needed

```bash
npx shadcn@latest add dropdown-menu tooltip avatar
```

### Dark Mode Color Tokens

| Purpose | Hex Value | Tailwind Class |
|---------|-----------|----------------|
| Background | #0a0a0a | `bg-[#0a0a0a]` |
| Surface/Card | #1a1a1a | `bg-[#1a1a1a]` |
| Border | #2a2a2a | `border-[#2a2a2a]` |
| Text Primary | #fafafa | `text-[#fafafa]` |
| Text Muted | #a1a1aa | `text-muted-foreground` |

### Navigation Route Mapping

| Section | Route | Icon |
|---------|-------|------|
| Feed | `/dashboard` | MessageSquare |
| Analytics | `/dashboard/analytics` | BarChart2 |
| Team | `/dashboard/team` | Users |
| Projects | `/dashboard/projects` | FolderOpen |
| Settings | `/dashboard/settings` | Settings |

### Common Pitfalls to Avoid

1. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
2. **DO NOT** forget to mark client components with `'use client'`
3. **DO NOT** hardcode colors - use CSS variables or Tailwind classes
4. **DO NOT** skip the tooltip on sidebar icons - accessibility requirement
5. **DO NOT** forget to handle loading states in team switcher
6. **DO NOT** use inline styles - use Tailwind classes
7. **DO NOT** skip ARIA labels on icon-only navigation items
8. **DO NOT** forget keyboard focus states (`focus-visible:ring-2`)
9. **DO NOT** call Supabase admin client from client components

### Verification Checklist

After completing this story, verify:
- [ ] Dashboard layout renders with sidebar and main content
- [ ] Sidebar is exactly 64px wide with centered icons
- [ ] All 5 navigation sections are accessible via sidebar
- [ ] Current section is highlighted in sidebar
- [ ] Tooltips appear on hover over sidebar icons
- [ ] Header displays user name and avatar
- [ ] Team switcher shows user's teams
- [ ] Team switching updates the context and refreshes data
- [ ] Dark mode styling is applied consistently
- [ ] Layout is responsive and fills viewport
- [ ] Unauthenticated users are redirected to /login
- [ ] Keyboard navigation works (Tab through nav items, Enter to select)
- [ ] Focus states are visible on all interactive elements
- [ ] Screen readers can navigate using ARIA labels

## Dependencies

- **Depends on:** Story 1.1 (Project Initialization), Story 1.7 (Session & Security Foundation), Story 2.5 (Team Switching)
- **Blocks:** Story 6.2 (Prompt Feed with Real-time Updates)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|
| | | |

### File List

*To be filled by dev agent - list all files created/modified*
