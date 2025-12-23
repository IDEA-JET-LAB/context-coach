# Contextor Design System

**Author:** Dev Agent (Amelia)
**Date:** 2025-12-23
**Version:** 1.0.0
**Status:** Baseline Audit Complete

---

## Table of Contents

- [Executive Summary](#executive-summary) (Line 20)
- [Color System](#color-system) (Line 45)
  - [Current Implementation](#current-implementation) (Line 47)
  - [UX Spec Requirements](#ux-spec-requirements) (Line 95)
  - [Gap Analysis](#gap-analysis) (Line 130)
- [Typography](#typography) (Line 155)
- [Spacing & Layout](#spacing--layout) (Line 190)
- [Border Radius](#border-radius) (Line 220)
- [Component Inventory](#component-inventory) (Line 245)
  - [UI Primitives (shadcn/ui)](#ui-primitives-shadcnui) (Line 247)
  - [Custom Components](#custom-components) (Line 280)
- [Accessibility Audit](#accessibility-audit) (Line 340)
- [Design Debt Summary](#design-debt-summary) (Line 380)
- [Improvement Recommendations](#improvement-recommendations) (Line 430)

---

## Executive Summary

### Current State

Contextor uses **shadcn/ui + Tailwind CSS + Radix UI** as its design foundation. The base configuration follows shadcn/ui conventions with CSS custom properties for theming. However, significant **design debt** exists:

| Metric | Count |
|--------|-------|
| Hardcoded color values | **240 instances** across 62 files |
| Focus-visible implementations | 18 (mostly in UI primitives) |
| ARIA accessibility attributes | 110 across 50 files |
| Missing UX spec tokens | 8 semantic colors |

### Key Findings

1. **Color System Mismatch**: UX specification defines semantic score colors (teal/amber/coral) that are NOT in Tailwind config
2. **Extensive Hardcoding**: Components bypass theme tokens with direct hex values (`#1a1a1a`, `#2a2a2a`, etc.)
3. **Incomplete Dark Mode**: CSS variables exist but many components use hardcoded dark colors
4. **Good Accessibility Foundation**: UI primitives have focus states; custom components need improvement

### Priority Actions

1. **High**: Add missing semantic color tokens to Tailwind config
2. **High**: Replace 240 hardcoded color values with theme tokens
3. **Medium**: Standardize border radius (current: 8px, spec: 16px for cards)
4. **Medium**: Add focus-visible states to custom components

---

## Color System

### Current Implementation

**Source:** `app/tailwind.config.ts` + `app/app/globals.css`

The project uses HSL-based CSS custom properties (standard shadcn/ui pattern):

#### Base Tokens (Dark Mode)

| Token | HSL Value | Hex Equivalent | Usage |
|-------|-----------|----------------|-------|
| `--background` | `0 0% 3.9%` | `#0a0a0a` | Page background |
| `--foreground` | `0 0% 98%` | `#fafafa` | Primary text |
| `--card` | `0 0% 3.9%` | `#0a0a0a` | Card backgrounds |
| `--card-foreground` | `0 0% 98%` | `#fafafa` | Card text |
| `--popover` | `0 0% 3.9%` | `#0a0a0a` | Popover backgrounds |
| `--primary` | `0 0% 98%` | `#fafafa` | Primary buttons (inverted) |
| `--primary-foreground` | `0 0% 9%` | `#171717` | Primary button text |
| `--secondary` | `0 0% 14.9%` | `#262626` | Secondary backgrounds |
| `--muted` | `0 0% 14.9%` | `#262626` | Muted backgrounds |
| `--muted-foreground` | `0 0% 63.9%` | `#a3a3a3` | Secondary text |
| `--accent` | `0 0% 14.9%` | `#262626` | Accent backgrounds |
| `--destructive` | `0 62.8% 30.6%` | `#7f1d1d` | Destructive actions |
| `--border` | `0 0% 14.9%` | `#262626` | Borders |
| `--input` | `0 0% 14.9%` | `#262626` | Input borders |
| `--ring` | `0 0% 83.1%` | `#d4d4d4` | Focus rings |
| `--radius` | `0.5rem` | `8px` | Default border radius |

#### Chart Colors

| Token | HSL Value | Purpose |
|-------|-----------|---------|
| `--chart-1` | `220 70% 50%` | Blue |
| `--chart-2` | `160 60% 45%` | Green |
| `--chart-3` | `30 80% 55%` | Orange |
| `--chart-4` | `280 65% 60%` | Purple |
| `--chart-5` | `340 75% 55%` | Pink |

### UX Spec Requirements

**Source:** `_bmad-output/ux-design-specification.md` (Lines 438-467)

The UX specification defines tokens that are **NOT currently implemented**:

#### Required Base Palette

| Token | Hex | Purpose |
|-------|-----|---------|
| `--background` | `#0a0a0a` | Page background |
| `--surface` | `#141414` | Card default background |
| `--muted` | `#27272a` | Borders, dividers |
| `--foreground` | `#fafafa` | Primary text |
| `--muted-foreground` | `#a1a1aa` | Secondary text |

#### Required Score Colors (Growth-Oriented)

| Score Range | Token | Hex | Current Status |
|-------------|-------|-----|----------------|
| High (7-10) | `--score-high` | `#14b8a6` (teal-500) | **MISSING** |
| Medium (4-6) | `--score-medium` | `#f59e0b` (amber-500) | **MISSING** |
| Growth (1-3) | `--score-growth` | `#f87171` (coral/red-400) | **MISSING** |

#### Required Semantic Colors

| Token | Hex | Purpose | Current Status |
|-------|-----|---------|----------------|
| `--primary` | `#14b8a6` | CTAs, links, active | Different (white) |
| `--secondary` | `#8b5cf6` | Highlights, badges | **MISSING** |
| `--info` | `#38bdf8` | Informational | **MISSING** |

### Gap Analysis

| Issue | Severity | Impact |
|-------|----------|--------|
| No `--score-high/medium/growth` tokens | **High** | Score colors hardcoded in components |
| `--primary` is white, not teal | **High** | Primary accent doesn't match spec |
| No `--surface` token (distinct from card) | Medium | Card/surface distinction unclear |
| `--secondary` is gray, not purple | Medium | Highlights don't match spec |
| Missing `--info` token | Low | Blue informational elements inconsistent |

#### Hardcoded Color Locations

Top offenders (by file):

| File | Hardcoded Count | Colors Used |
|------|-----------------|-------------|
| `analytics/team-summary.tsx` | 13 | `#1a1a1a`, `#2a2a2a`, `#fafafa` |
| `analytics/analytics-dashboard.tsx` | 11 | `#1a1a1a`, `#2a2a2a`, `#fafafa` |
| `analytics/team-admin-analytics.tsx` | 18 | `#1a1a1a`, `#2a2a2a`, `#fafafa` |
| `analytics/member-detail.tsx` | 13 | `#1a1a1a`, `#2a2a2a`, `#fafafa` |
| `admin/teams-table.tsx` | 9 | `#1a1a1a`, `#2a2a2a`, `#fafafa` |
| `marketing/*.tsx` | 23 | Various |
| `onboarding/*.tsx` | 20+ | `#1a1a1a`, `#2a2a2a`, `#3a3a3a` |

---

## Typography

### Current Implementation

**Source:** Tailwind defaults + Next.js font configuration

| Property | Value | Source |
|----------|-------|--------|
| Font Family | System (Geist Sans) | `app/layout.tsx` |
| Base Size | 14px | Tailwind default |
| Scale | Tailwind default (xs-9xl) | `tailwind.config.ts` |

### UX Spec Requirements

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-display` | 48px | 700 | 1.1 | Hero only |
| `--text-h1` | 32px | 600 | 1.2 | Page titles |
| `--text-h2` | 24px | 600 | 1.3 | Sections |
| `--text-h3` | 18px | 500 | 1.4 | Card titles |
| `--text-body` | 14px | 400 | 1.5 | Default |
| `--text-small` | 12px | 400 | 1.4 | Captions |
| `--text-metric` | 32px | 700 | 1.0 | Scores |

#### Font Stack Requirement

```css
--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;
```

### Gap Analysis

| Issue | Severity |
|-------|----------|
| Using Geist Sans, not Inter | Low (acceptable alternative) |
| No `--text-metric` token for scores | Medium |
| Typography scale not customized | Low |

---

## Spacing & Layout

### Current Implementation

Uses Tailwind default spacing scale (4px base unit):

| Class | Value |
|-------|-------|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-6` | 24px |
| `space-8` | 32px |

### UX Spec Requirements

Matches current implementation (8px base grid with 4px subdivisions).

| Token | Value | Status |
|-------|-------|--------|
| `--space-1` | 4px | Matches |
| `--space-2` | 8px | Matches |
| `--space-3` | 12px | Matches |
| `--space-4` | 16px | Matches |
| `--space-6` | 24px | Matches |
| `--space-8` | 32px | Matches |
| `--space-12` | 48px | Matches |

### Layout Grid

| Element | Current | Spec | Status |
|---------|---------|------|--------|
| Sidebar width | 64px | 64px | **Matches** |
| Content max-width | None set | 1200px | **Missing** |
| Card grid min | Not defined | 320px | **Missing** |

---

## Border Radius

### Current Implementation

**Source:** `globals.css` line 31

```css
--radius: 0.5rem; /* 8px */
```

Tailwind config derives:
- `lg`: 8px (`var(--radius)`)
- `md`: 6px (`calc(var(--radius) - 2px)`)
- `sm`: 4px (`calc(var(--radius) - 4px)`)

### UX Spec Requirements

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Buttons, inputs |
| `--radius-md` | 12px | Small cards |
| `--radius-lg` | 16px | Prompt cards |
| `--radius-full` | 9999px | Avatars |

### Gap Analysis

| Issue | Severity |
|-------|----------|
| Card radius is 8px, spec says 16px | **High** - Visual identity mismatch |
| No `--radius-full` token defined | Low |

---

## Component Inventory

### UI Primitives (shadcn/ui)

**Location:** `app/components/ui/`

| Component | Status | Customization Level | Notes |
|-----------|--------|---------------------|-------|
| `alert.tsx` | Standard | Minimal | Uses theme tokens |
| `alert-dialog.tsx` | Standard | Minimal | Uses theme tokens |
| `avatar.tsx` | Standard | Minimal | Uses theme tokens |
| `badge.tsx` | Standard | Minimal | Uses theme tokens |
| `breadcrumb.tsx` | Standard | Minimal | Uses theme tokens |
| `button.tsx` | Standard | Moderate | 6 variants, good focus states |
| `card.tsx` | Standard | Minimal | Uses `rounded-xl` (12px) |
| `checkbox.tsx` | Standard | Minimal | Good focus states |
| `dialog.tsx` | Standard | Minimal | Uses theme tokens |
| `dropdown-menu.tsx` | Standard | Minimal | Uses theme tokens |
| `empty-state.tsx` | Custom | High | Has hardcoded colors |
| `form.tsx` | Standard | Minimal | Uses theme tokens |
| `input.tsx` | Standard | Minimal | Good focus states |
| `label.tsx` | Standard | Minimal | Uses theme tokens |
| `popover.tsx` | Standard | Minimal | Uses theme tokens |
| `progress.tsx` | Standard | Minimal | Uses theme tokens |
| `select.tsx` | Standard | Minimal | Good focus states |
| `separator.tsx` | Standard | Minimal | Uses theme tokens |
| `sheet.tsx` | Standard | Minimal | Uses theme tokens |
| `skeleton.tsx` | Standard | Minimal | Uses theme tokens |
| `slider.tsx` | Standard | Minimal | Good focus states |
| `sonner.tsx` | Standard | Minimal | Toast notifications |
| `switch.tsx` | Standard | Minimal | Good focus states |
| `table.tsx` | Standard | Minimal | Uses theme tokens |
| `tabs.tsx` | Standard | Minimal | Good focus states |
| `textarea.tsx` | Standard | Minimal | Good focus states |
| `tooltip.tsx` | Standard | Minimal | Uses theme tokens |

**Total:** 27 UI components (mostly shadcn/ui standard)

### Custom Components

**Organized by feature area:**

#### Dashboard Components (`components/dashboard/`)

| Component | Theme Tokens | Hardcoded Colors | Focus States | ARIA |
|-----------|--------------|------------------|--------------|------|
| `sidebar.tsx` | Partial | 7 instances | Yes | Yes (8) |
| `header.tsx` | Partial | 3 instances | No | Yes (1) |
| `stat-card.tsx` | No | 5 instances | No | No |

#### Feed Components (`components/feed/`)

| Component | Theme Tokens | Hardcoded Colors | Focus States | ARIA |
|-----------|--------------|------------------|--------------|------|
| `score-badge.tsx` | Partial | 2 instances | No | Yes (4) |
| `prompt-row.tsx` | Partial | 5 instances | No | No |
| `filter-bar.tsx` | Partial | 2 instances | No | Yes (4) |
| `comparison-indicator.tsx` | Yes | 0 | No | Yes (2) |
| `score-comparison.tsx` | Partial | 1 instance | No | No |

#### Analytics Components (`components/analytics/`)

| Component | Theme Tokens | Hardcoded Colors | Focus States | ARIA |
|-----------|--------------|------------------|--------------|------|
| `team-trend-chart.tsx` | No | 10+ instances | N/A | No |
| `score-trend-chart.tsx` | No | 6+ instances | N/A | No |
| `dimension-breakdown.tsx` | No | 3 instances | No | No |
| `team-summary.tsx` | No | 13 instances | No | No |
| `summary-stats.tsx` | Partial | N/A | No | Yes (1) |

#### Admin Components (`components/admin/`)

| Component | Theme Tokens | Hardcoded Colors | Focus States | ARIA |
|-----------|--------------|------------------|--------------|------|
| `admin-sidebar.tsx` | Partial | 4 instances | Yes (2) | Yes (4) |
| `teams-table.tsx` | Partial | 9 instances | No | Yes (4) |
| `user-table.tsx` | Partial | 3 instances | No | No |
| `dashboard-content.tsx` | Partial | 4 instances | No | No |

---

## Accessibility Audit

### Positive Findings

| Feature | Implementation | Coverage |
|---------|----------------|----------|
| ARIA labels | `aria-label` on interactive elements | 110 instances / 50 files |
| Focus indicators | `focus-visible:ring-*` | 18 instances / 14 files |
| Screen reader support | `aria-current="page"` on nav | Sidebar, admin nav |
| Keyboard navigation | Tab order, Enter/Space | UI primitives only |

### Gaps Identified

| Issue | Files Affected | Severity |
|-------|----------------|----------|
| Custom components lack focus states | 48+ files | **High** |
| Charts not accessible (no text alternative) | 4 chart components | **High** |
| Interactive cards missing keyboard support | prompt-row, stat-card | Medium |
| Color-only score indication | score-badge (has ARIA, but visual relies on color) | Medium |

### WCAG 2.1 AA Compliance

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.4.3 Contrast | Likely compliant | Dark theme, high contrast text |
| 2.1.1 Keyboard | Partial | UI primitives yes, custom no |
| 2.4.7 Focus Visible | Partial | 18/62 component files |
| 4.1.2 Name, Role, Value | Partial | 50 files have ARIA |

---

## Design Debt Summary

### Critical (Must Fix)

| Issue | Impact | Files | Effort |
|-------|--------|-------|--------|
| Add score color tokens to Tailwind | Score colors inconsistent | `tailwind.config.ts` | 1 hour |
| Replace 240 hardcoded colors | Theme switching broken | 62 files | 4-8 hours |
| Update primary color to teal | Primary accent doesn't match brand | `globals.css` | 30 min |

### High Priority

| Issue | Impact | Files | Effort |
|-------|--------|-------|--------|
| Add focus states to custom components | Keyboard users can't see focus | 48 files | 3-4 hours |
| Increase card border-radius to 16px | Visual identity mismatch | 1 config file | 30 min |
| Add chart accessibility | Screen reader users excluded | 4 files | 2 hours |

### Medium Priority

| Issue | Impact | Files | Effort |
|-------|--------|-------|--------|
| Add `--surface` token | Card/background distinction | 1 config file | 15 min |
| Add `--secondary` (purple) token | Highlight inconsistency | 1 config file | 15 min |
| Standardize loading skeleton colors | Inconsistent loading states | 10+ files | 1 hour |

### Low Priority

| Issue | Impact | Files | Effort |
|-------|--------|-------|--------|
| Switch to Inter font | Minor visual preference | 1 file | 30 min |
| Add `--text-metric` token | Score typography inconsistent | 1 file | 15 min |
| Define max-width for content | Wide screens lack containment | Layout files | 1 hour |

---

## Improvement Recommendations

### Phase 1: Token Foundation (Story D-2)

**Goal:** Establish complete design token set in Tailwind config

1. Add semantic score colors:
   ```javascript
   colors: {
     score: {
       high: '#14b8a6',    // teal-500
       medium: '#f59e0b',  // amber-500
       growth: '#f87171',  // red-400
     }
   }
   ```

2. Update primary to teal:
   ```css
   --primary: 173 58% 39%; /* #14b8a6 */
   ```

3. Add surface and secondary tokens:
   ```css
   --surface: 0 0% 8%;     /* #141414 */
   --secondary: 263 70% 58%; /* #8b5cf6 */
   ```

4. Update border-radius:
   ```css
   --radius: 1rem; /* 16px for cards */
   ```

### Phase 2: Component Refactoring (Stories D-2, D-3)

**Goal:** Replace hardcoded values with theme tokens

Priority order:
1. `analytics/` components (highest hardcoding count)
2. `dashboard/` components (core user experience)
3. `feed/` components (primary interaction)
4. `admin/` components (secondary priority)
5. `onboarding/` components
6. `marketing/` components

### Phase 3: Accessibility Enhancement (Story D-2)

**Goal:** WCAG 2.1 AA compliance

1. Add `focus-visible:ring-2 focus-visible:ring-primary` to all interactive custom components
2. Add text alternatives to chart components
3. Ensure color is never the only means of conveying information
4. Add keyboard support to card interactions

### Phase 4: New Component Development (Stories D-3 to D-7)

Use established tokens for all new components:
- VS Code Extension UI (D-4)
- Import/Recovery UI (D-5)
- Advanced Analytics (D-6)
- Admin Config UI (D-7)

---

## Appendix: File Reference

### Primary Configuration Files

| File | Purpose |
|------|---------|
| `app/tailwind.config.ts` | Tailwind theme extensions |
| `app/app/globals.css` | CSS custom properties |
| `app/app/layout.tsx` | Font configuration |

### Component Directories

| Directory | Component Count | Purpose |
|-----------|-----------------|---------|
| `app/components/ui/` | 27 | shadcn/ui primitives |
| `app/components/feed/` | 15 | Prompt feed features |
| `app/components/analytics/` | 12 | Analytics dashboards |
| `app/components/dashboard/` | 4 | Dashboard layout |
| `app/components/admin/` | 18 | Admin panel |
| `app/components/onboarding/` | 9 | Onboarding flow |
| `app/components/projects/` | 7 | Project management |
| `app/components/team/` | 5 | Team management |
| `app/components/marketing/` | 4 | Marketing pages |

---

*Generated by Dev Agent as part of Story D-1: Design System Audit*
