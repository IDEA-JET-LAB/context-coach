# Story 14.1: Documentation Page Structure

Status: ✅ COMPLETED (2025-12-23)
Priority: P2

## Story

**As a** user,
**I want** an in-app documentation section,
**So that** I can learn how to use Contextor without leaving the app.

## Acceptance Criteria

1. **Given** I am logged in
   **When** I click the Help/Docs icon in the sidebar
   **Then** I navigate to `/docs`
   **And** I see a documentation landing page

2. **Given** the docs landing page
   **When** I view it
   **Then** I see a table of contents with sections:
   - Getting Started
   - CLI Installation
   - Understanding Scores
   - Team Management
   - FAQ

3. **Given** I click a section
   **When** the content loads
   **Then** I see markdown-rendered documentation
   **And** navigation shows my current position

4. **Given** I am NOT logged in
   **When** I try to access `/docs` or `/docs/[slug]`
   **Then** I am redirected to `/login`
   **And** after login I am returned to the requested docs page

5. **Given** I navigate to `/docs/invalid-slug`
   **When** the slug does not match any known documentation section
   **Then** I see a 404 page with a link back to `/docs`

6. **Given** I view the docs on a mobile device (viewport < 768px)
   **When** the page loads
   **Then** the docs sidebar is collapsed by default
   **And** I can toggle it open via a hamburger/menu button
   **And** clicking a section closes the sidebar and navigates

7. **Given** markdown content is rendered
   **When** it contains potentially malicious HTML/scripts
   **Then** all HTML is sanitized to prevent XSS attacks

## Tasks / Subtasks

- [ ] **Task 0: Install dependencies**
  - [ ] Install markdown parsing: `npm install react-markdown` (preferred) or `marked`
  - [ ] Install sanitization: `npm install rehype-sanitize` (for react-markdown) or `dompurify @types/dompurify` (for marked)
  - [ ] Install typography plugin: `npm install -D @tailwindcss/typography`
  - [ ] Add `require('@tailwindcss/typography')` to `tailwind.config.ts` plugins array

- [ ] **Task 1: Add Docs link to sidebar**
  - [ ] Open `components/dashboard/sidebar.tsx`
  - [ ] Add Help/Docs icon and link
  - [ ] Link to `/docs`
  - [ ] Use `HelpCircle` or `BookOpen` icon from Lucide

- [ ] **Task 2: Create docs landing page**
  - [ ] Create `app/(dashboard)/docs/page.tsx`
  - [ ] Display welcome message
  - [ ] Show table of contents with links
  - [ ] Use Card components for section preview

- [ ] **Task 3: Create docs layout with sidebar**
  - [ ] Create `app/(dashboard)/docs/layout.tsx`
  - [ ] Add docs-specific sidebar for navigation
  - [ ] Highlight current section
  - [ ] Responsive design (collapsible on mobile)

- [ ] **Task 4: Create dynamic doc page route**
  - [ ] Create `app/(dashboard)/docs/[slug]/page.tsx`
  - [ ] Load content based on slug
  - [ ] Render markdown content
  - [ ] Handle 404 for invalid slugs

- [ ] **Task 5: Set up content structure**
  - [ ] Create `content/docs/` directory
  - [ ] Create placeholder files for each section
  - [ ] Define content loading mechanism (MDX or JSON)

- [ ] **Task 6: Create docs sidebar component**
  - [ ] Create `components/docs/docs-sidebar.tsx`
  - [ ] List all documentation sections
  - [ ] Show active section
  - [ ] Collapsible for mobile

- [ ] **Task 7: Style documentation pages**
  - [ ] Apply consistent typography
  - [ ] Style code blocks
  - [ ] Add proper spacing
  - [ ] Ensure readability

## Dev Notes

### Project Structure

```
app/
├── (dashboard)/
│   └── docs/
│       ├── layout.tsx      # Docs layout with sidebar
│       ├── page.tsx        # Docs landing page
│       └── [slug]/
│           └── page.tsx    # Individual doc pages

components/
└── docs/
    ├── docs-sidebar.tsx    # Navigation sidebar
    └── doc-content.tsx     # Content renderer

content/
└── docs/
    ├── getting-started.md
    ├── cli-installation.md
    ├── understanding-scores.md
    ├── team-management.md
    └── faq.md
```

### Docs Configuration

```typescript
// lib/docs/config.ts
export const docsConfig = {
  sections: [
    {
      slug: 'getting-started',
      title: 'Getting Started',
      description: 'Learn the basics of Contextor',
    },
    {
      slug: 'cli-installation',
      title: 'CLI Installation',
      description: 'Install Contextor in your project',
    },
    {
      slug: 'understanding-scores',
      title: 'Understanding Scores',
      description: 'How prompt analysis works',
    },
    {
      slug: 'team-management',
      title: 'Team Management',
      description: 'Manage teams and members',
    },
    {
      slug: 'faq',
      title: 'FAQ',
      description: 'Frequently asked questions',
    },
  ],
};
```

### Docs Landing Page

```tsx
// app/(dashboard)/docs/page.tsx
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { docsConfig } from '@/lib/docs/config';

export default function DocsPage() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Documentation</h1>
        <p className="text-muted-foreground mt-2">
          Learn how to use Contextor to improve your AI prompting skills.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {docsConfig.sections.map((section) => (
          <Link key={section.slug} href={`/docs/${section.slug}`}>
            <Card className="hover:border-primary transition-colors">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

### Docs Layout with Sidebar

```tsx
// app/(dashboard)/docs/layout.tsx
import { DocsSidebar } from '@/components/docs/docs-sidebar';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <DocsSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

### Docs Sidebar Component

```tsx
// components/docs/docs-sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { docsConfig } from '@/lib/docs/config';
import { BookOpen } from 'lucide-react';

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-muted/30 p-4 hidden md:block">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="h-5 w-5" />
        <span className="font-semibold">Documentation</span>
      </div>

      <nav className="space-y-1">
        {docsConfig.sections.map((section) => {
          const href = `/docs/${section.slug}`;
          const isActive = pathname === href;

          return (
            <Link
              key={section.slug}
              href={href}
              className={cn(
                'block px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              {section.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

### Content Loading (Secure Approach)

```tsx
// app/(dashboard)/docs/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { docsConfig } from '@/lib/docs/config';
import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

interface Props {
  params: { slug: string };
}

export default async function DocPage({ params }: Props) {
  const section = docsConfig.sections.find(s => s.slug === params.slug);

  if (!section) {
    notFound();
  }

  // Load markdown content
  const filePath = path.join(process.cwd(), 'content/docs', `${params.slug}.md`);

  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    notFound();
  }

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="text-3xl font-bold mb-6">{section.title}</h1>
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return docsConfig.sections.map((section) => ({
    slug: section.slug,
  }));
}
```

### Files to Create

| File | Purpose |
|------|---------|
| `app/(dashboard)/docs/page.tsx` | Landing page |
| `app/(dashboard)/docs/layout.tsx` | Docs layout |
| `app/(dashboard)/docs/[slug]/page.tsx` | Dynamic doc page |
| `components/docs/docs-sidebar.tsx` | Navigation |
| `lib/docs/config.ts` | Section configuration |
| `content/docs/*.md` | Markdown content files |

### Dependencies

**Required packages:**

```bash
# Option A: react-markdown with rehype-sanitize (RECOMMENDED)
npm install react-markdown rehype-sanitize

# Option B: marked with DOMPurify
npm install marked dompurify @types/dompurify

# Typography plugin for prose styling
npm install -D @tailwindcss/typography
```

### Security: XSS Prevention

**CRITICAL:** User-provided or file-based markdown content MUST be sanitized before rendering to prevent XSS attacks.

**With react-markdown (recommended):**
```tsx
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

<ReactMarkdown rehypePlugins={[rehypeSanitize]}>
  {markdownContent}
</ReactMarkdown>
```

**With marked + DOMPurify:**
```tsx
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const unsafeHtml = marked(markdownContent);
const safeHtml = DOMPurify.sanitize(unsafeHtml);

<div dangerouslySetInnerHTML={{ __html: safeHtml }} />
```

**Never use `dangerouslySetInnerHTML` with unsanitized content!**

### Tailwind Typography Plugin

```js
// tailwind.config.ts
plugins: [
  require('@tailwindcss/typography'),
],
```

### References

- [Next.js Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Tailwind Typography](https://tailwindcss.com/docs/typography-plugin)
- [Source: _bmad-output/epics.md#Story-14.1]

## Verification Checklist

### Core Functionality
- [ ] Help/Docs link visible in sidebar with appropriate icon
- [ ] Docs landing page (`/docs`) displays all sections as clickable cards
- [ ] Individual doc pages (`/docs/[slug]`) load markdown content correctly
- [ ] Docs sidebar navigation shows all sections
- [ ] Current/active section is visually highlighted in sidebar

### Authentication & Access
- [ ] Unauthenticated users are redirected to `/login` when accessing `/docs`
- [ ] After login, user is returned to the originally requested docs page

### Error Handling
- [ ] Invalid slug (e.g., `/docs/nonexistent`) shows 404 page
- [ ] 404 page includes link back to `/docs`
- [ ] Missing markdown file is handled gracefully (404, not server error)

### Mobile Responsiveness
- [ ] Docs sidebar is hidden by default on viewports < 768px
- [ ] Mobile menu toggle button is visible on small screens
- [ ] Clicking a section in mobile menu closes the sidebar
- [ ] Content is readable on mobile without horizontal scroll

### Styling & Security
- [ ] Prose styling (`@tailwindcss/typography`) applied to markdown content
- [ ] Code blocks are properly styled
- [ ] XSS sanitization is in place (test with `<script>alert('xss')</script>` in markdown)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

*To be filled by dev agent - list all files created/modified*
