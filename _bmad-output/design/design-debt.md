# Design Debt Registry

**Date:** 2025-12-23
**Status:** Active Tracking

---

## Summary

| Priority | Count | Estimated Effort |
|----------|-------|------------------|
| Critical | 3 | 6-10 hours |
| High | 4 | 6-8 hours |
| Medium | 5 | 4-5 hours |
| Low | 4 | 2-3 hours |
| **Total** | **16** | **18-26 hours** |

---

## Critical Priority

### DEBT-001: Missing Score Color Tokens

**Status:** Open
**Effort:** 1 hour
**Files:** `tailwind.config.ts`, `globals.css`

**Description:**
UX specification defines semantic score colors (teal/amber/coral) that are not present in the Tailwind configuration. Components use Tailwind utility classes (`bg-teal-500`) or hardcoded hex values.

**Required Tokens:**
```javascript
colors: {
  score: {
    high: '#14b8a6',    // teal-500, scores 7-10
    medium: '#f59e0b',  // amber-500, scores 4-6
    growth: '#f87171',  // red-400, scores 1-3
  }
}
```

**Acceptance Criteria:**
- [ ] Tokens added to `tailwind.config.ts`
- [ ] CSS variables added to `globals.css`
- [ ] ScoreBadge component uses new tokens

---

### DEBT-002: 240 Hardcoded Color Values

**Status:** Open
**Effort:** 4-8 hours
**Files:** 62 component files

**Description:**
Components use hardcoded hex colors instead of theme tokens, breaking theming capability and creating maintenance burden.

**Common Hardcoded Values:**
| Hex | Should Be | Occurrences |
|-----|-----------|-------------|
| `#0a0a0a` | `bg-background` | ~30 |
| `#1a1a1a` | `bg-card` or `bg-surface` | ~80 |
| `#2a2a2a` | `border-border` | ~70 |
| `#fafafa` | `text-foreground` | ~40 |
| `#a1a1aa` | `text-muted-foreground` | ~20 |

**Top Offending Files:**
1. `analytics/team-admin-analytics.tsx` (18)
2. `analytics/team-summary.tsx` (13)
3. `analytics/member-detail.tsx` (13)
4. `analytics/analytics-dashboard.tsx` (11)

**Acceptance Criteria:**
- [ ] All `bg-[#` replaced with theme tokens
- [ ] All `text-[#` replaced with theme tokens
- [ ] All `border-[#` replaced with theme tokens
- [ ] Visual appearance unchanged

---

### DEBT-003: Primary Color Mismatch

**Status:** Open
**Effort:** 30 minutes
**Files:** `globals.css`

**Description:**
UX specification defines primary as teal (`#14b8a6`), but current config uses white (`0 0% 98%` / `#fafafa`). This inverts the expected primary button appearance.

**Current:**
```css
--primary: 0 0% 98%; /* white */
```

**Required:**
```css
--primary: 173 58% 39%; /* #14b8a6 teal */
--primary-foreground: 0 0% 100%; /* white text on teal */
```

**Acceptance Criteria:**
- [ ] Primary color updated to teal
- [ ] Primary buttons display correctly
- [ ] All primary text/accents use new color

---

## High Priority

### DEBT-004: Missing Focus States on Custom Components

**Status:** Open
**Effort:** 3-4 hours
**Files:** 48 component files

**Description:**
UI primitives (shadcn/ui) have proper `focus-visible:ring-*` states, but custom components lack keyboard accessibility indicators.

**Components Missing Focus States:**
- All `stat-card.tsx` variants
- `prompt-row.tsx` (clickable)
- Most analytics chart containers
- Admin table rows
- Filter chips

**Pattern to Apply:**
```tsx
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
```

**Acceptance Criteria:**
- [ ] All interactive custom components have visible focus states
- [ ] Tab navigation shows current focus clearly
- [ ] Focus ring uses primary color

---

### DEBT-005: Card Border Radius Mismatch

**Status:** Open
**Effort:** 30 minutes
**Files:** `globals.css`, `tailwind.config.ts`

**Description:**
UX specification requires 16px border radius for cards. Current implementation uses 8px (`--radius: 0.5rem`).

**Current:**
```css
--radius: 0.5rem; /* 8px */
```

**Required:**
```css
--radius: 1rem; /* 16px */
```

**Note:** This will affect all components using `rounded-lg`, `rounded-md`, `rounded-sm`.

**Acceptance Criteria:**
- [ ] Card components have 16px border radius
- [ ] Visual appearance matches UX prototypes

---

### DEBT-006: Chart Accessibility

**Status:** Open
**Effort:** 2 hours
**Files:** 4 chart components

**Description:**
Recharts/D3 visualizations are not accessible to screen readers. No text alternatives or ARIA descriptions provided.

**Affected Components:**
- `analytics/score-trend-chart.tsx`
- `analytics/team-trend-chart.tsx`
- `analytics/dimension-breakdown.tsx`
- `analytics/member-dimension-breakdown.tsx`

**Required:**
- Add `aria-hidden="true"` to decorative chart elements
- Provide text summary of chart data
- Consider data table alternative

**Acceptance Criteria:**
- [ ] Charts have ARIA labels or hidden from AT
- [ ] Text summary available for screen readers
- [ ] Passes automated accessibility tests

---

### DEBT-007: Loading Skeleton Inconsistency

**Status:** Open
**Effort:** 1 hour
**Files:** 10+ files

**Description:**
Loading skeletons use different background colors across components, some hardcoded (`bg-[#2a2a2a]`), some using tokens (`bg-muted`).

**Files with Hardcoded Skeleton Colors:**
- `onboarding/onboarding-checklist-skeleton.tsx` (8 instances)
- `feed/prompt-feed-skeleton.tsx` (4 instances)
- `dashboard/stat-card.tsx` (2 instances)
- `analytics/team-summary.tsx` (4 instances)

**Acceptance Criteria:**
- [ ] All skeletons use `bg-muted` or `bg-card`
- [ ] Consistent pulse animation
- [ ] Visual appearance uniform across app

---

## Medium Priority

### DEBT-008: Missing Surface Token

**Status:** Open
**Effort:** 15 minutes
**Files:** `globals.css`

**Description:**
UX spec differentiates between `--surface` (`#141414`) and `--card` (`#0a0a0a`), but current config only has `--card`.

**Acceptance Criteria:**
- [ ] `--surface` token added
- [ ] Card components reviewed for correct usage

---

### DEBT-009: Secondary Color Mismatch

**Status:** Open
**Effort:** 15 minutes
**Files:** `globals.css`

**Description:**
UX spec defines secondary as purple (`#8b5cf6`), current is gray (`0 0% 14.9%`).

**Acceptance Criteria:**
- [ ] Secondary color updated to purple
- [ ] Badge highlights use new color

---

### DEBT-010: Missing Info Token

**Status:** Open
**Effort:** 15 minutes
**Files:** `globals.css`, `tailwind.config.ts`

**Description:**
No `--info` token for informational elements. Currently using various blues inconsistently.

**Required:**
```css
--info: 199 89% 62%; /* #38bdf8 sky-400 */
```

**Acceptance Criteria:**
- [ ] Info token added
- [ ] Informational UI uses consistent blue

---

### DEBT-011: Content Max-Width Missing

**Status:** Open
**Effort:** 1 hour
**Files:** Layout components

**Description:**
UX spec requires 1200px max-width for content area. Currently content stretches full width on large screens.

**Acceptance Criteria:**
- [ ] Main content area has max-width
- [ ] Content is centered on wide screens

---

### DEBT-012: Metric Typography Token

**Status:** Open
**Effort:** 15 minutes
**Files:** `tailwind.config.ts`

**Description:**
UX spec defines `--text-metric` (32px, 700 weight) for score displays. Not currently in config.

**Acceptance Criteria:**
- [ ] Metric typography class available
- [ ] Score displays use consistent typography

---

## Low Priority

### DEBT-013: Font Stack (Inter)

**Status:** Open
**Effort:** 30 minutes
**Files:** `app/layout.tsx`

**Description:**
UX spec specifies Inter font. Current implementation uses Geist Sans (acceptable alternative).

**Acceptance Criteria:**
- [ ] Decision documented (keep Geist or switch to Inter)
- [ ] If switching, Inter loaded via Google Fonts

---

### DEBT-014: Card Grid Definition

**Status:** Open
**Effort:** 30 minutes
**Files:** Layout components

**Description:**
UX spec defines card grid with 320px minimum. Not explicitly configured.

**Acceptance Criteria:**
- [ ] Grid system documented
- [ ] Cards have consistent sizing behavior

---

### DEBT-015: Mobile Bottom Navigation

**Status:** Open
**Effort:** 1 hour
**Files:** `dashboard/sidebar.tsx`

**Description:**
UX spec shows bottom navigation for mobile. Current sidebar is hidden on mobile (assumed hamburger menu).

**Acceptance Criteria:**
- [ ] Mobile navigation pattern documented
- [ ] Implementation plan for responsive nav

---

### DEBT-016: Chart Color Hardcoding

**Status:** Open
**Effort:** 1 hour
**Files:** Chart components

**Description:**
Recharts configurations use hardcoded hex colors for chart elements (grid, axis, lines).

**Example from `score-trend-chart.tsx`:**
```javascript
const COLORS = {
  line: '#14b8a6',
  grid: '#2a2a2a',
  axisText: '#a1a1aa',
  tooltipBg: '#1a1a1a',
  dot: '#14b8a6',
};
```

**Acceptance Criteria:**
- [ ] Chart colors reference theme tokens
- [ ] Charts respond to theme changes

---

## Completed

*No items completed yet*

---

## Tracking Notes

### How to Address Debt

1. **Create Issue:** Reference debt ID in issue title
2. **Branch:** `fix/debt-XXX-description`
3. **Test:** Visual regression + accessibility
4. **Update:** Mark as completed with date

### Review Schedule

- Weekly: Review critical items
- Sprint: Include 1-2 debt items
- Release: All critical resolved

---

*Registry maintained as part of Design Phase*
