# Story D-1: Design System Audit & Documentation

Status: Complete

## Story

**As a** design lead,
**I want** a comprehensive audit of the existing design system and component patterns,
**So that** I have a documented baseline to improve upon and ensure consistency across all Phase 2 development.

## Acceptance Criteria

1. **Given** the existing codebase
   **When** this story is complete
   **Then** a design-system.md document exists in `_bmad-output/design/`
   **And** it catalogs all existing color tokens, typography, spacing, and shadow values
   **And** it identifies inconsistencies and improvement opportunities

2. **Given** the existing Tailwind configuration
   **When** audited
   **Then** all custom colors are documented with their usage context
   **And** the dark mode implementation is verified and documented
   **And** any hardcoded values in components are identified for extraction

3. **Given** the existing shadcn/ui components
   **When** audited
   **Then** all installed components are listed with their customization status
   **And** missing components needed for Phase 2 are identified
   **And** component theming consistency is verified

4. **Given** the UX Design Specification
   **When** compared to implementation
   **Then** gaps between spec and reality are documented
   **And** visual mockups in `user-uploads/` are reviewed for alignment
   **And** recommendations for improvement are prioritized

## Tasks / Subtasks

- [x] **Task 1: Audit Tailwind Configuration** (AC: #2)
  - [x] Review `tailwind.config.ts` for custom theme extensions
  - [x] Document all color tokens (`#0a0a0a`, `#1a1a1a`, `#2a2a2a`, etc.)
  - [x] Document typography scale (font sizes, weights, line heights)
  - [x] Document spacing scale and any custom values
  - [x] Document border radius, shadow, and animation tokens
  - [x] Identify any CSS variables in `globals.css`

- [x] **Task 2: Audit Existing Components** (AC: #3)
  - [x] List all components in `app/components/`
  - [x] Categorize by type: UI primitives, layout, feature-specific
  - [x] Note which are shadcn/ui vs custom
  - [x] Identify components with hardcoded styles vs theme tokens
  - [x] Flag components with accessibility gaps

- [x] **Task 3: Review UX Specification Compliance** (AC: #4)
  - [x] Compare `_bmad-output/ux-design-specification.md` to live implementation
  - [x] Review mockups in `_bmad-output/user-uploads/`
  - [x] Document deviations from intended design
  - [x] Note areas where implementation improved on spec

- [x] **Task 4: Identify Design Debt** (AC: #1, #4)
  - [x] List inconsistent spacing patterns
  - [x] List inconsistent color usage
  - [x] List accessibility issues (contrast, focus states, ARIA)
  - [x] Prioritize fixes by impact and effort

- [x] **Task 5: Create Design System Documentation** (AC: #1)
  - [x] Create `_bmad-output/design/design-system.md`
  - [x] Include color palette with hex values and semantic names
  - [x] Include typography scale
  - [x] Include spacing and layout patterns
  - [x] Include component inventory
  - [x] Include improvement recommendations

## Dev Notes

### Files to Audit

| Category | Files |
|----------|-------|
| Tailwind Config | `app/tailwind.config.ts` |
| Global Styles | `app/app/globals.css` |
| UI Components | `app/components/ui/*.tsx` |
| Feature Components | `app/components/**/*.tsx` |
| UX Spec | `_bmad-output/ux-design-specification.md` |
| Visual Mockups | `_bmad-output/user-uploads/*.html` |

### Expected Design System Tokens

From UX Specification:

```
Colors:
- Background: #0a0a0a
- Surface/Card: #1a1a1a
- Border: #2a2a2a
- Text Primary: #fafafa
- Text Muted: #a1a1aa
- Primary/Accent: (to be verified)
- Success: (to be verified)
- Warning: (to be verified)
- Error: (to be verified)

Typography:
- Font Family: (to be verified - likely Inter or system)
- Scale: xs, sm, base, lg, xl, 2xl, 3xl, 4xl

Spacing:
- Based on 4px grid (verify)
- Common values: 4, 8, 12, 16, 24, 32, 48, 64
```

### Output Structure

```
_bmad-output/design/
├── design-system.md          # This story's primary output
├── component-inventory.md    # List of all existing components
├── design-debt.md            # Prioritized improvement list
└── phase1-screenshots/       # Screenshots of current state
```

### Quality Checklist

- [x] All color values extracted and named semantically
- [x] Typography scale documented with use cases
- [x] Spacing patterns identified
- [x] Component inventory complete
- [x] Accessibility gaps identified
- [x] UX spec compliance reviewed
- [x] Improvement recommendations prioritized

## Recommended Tools & Agents

### Pixel Agent (Visual Asset Generator)

Use the **Pixel agent** (`/bmad:custom:agents:pixel`) to automatically extract the project's visual style profile:

```
Pixel Commands:
- *analyze-project  → Scans CSS, Tailwind config, extracts colors, typography, patterns
- *style-profile    → View/edit the generated style profile
```

**Workflow:**
1. Invoke Pixel agent
2. Run `*analyze-project` to auto-generate `project-style-profile.yaml`
3. Use this profile as input for the design system documentation
4. Pixel's analysis complements manual audit with automated extraction

**Output Location:** `./pixel-sidecar/project-style-profile.yaml`

### Frontend-Design Skill

Use `/frontend-design` for creating React component mockups during later stories (D-3+).

## Dependencies

- **Depends on:** None (first story in Epic D)
- **Blocks:** Stories D-2, D-3 (need baseline before refactoring)

## References

- Epic: Epic D: Phase 2 Design Foundation
- UX Spec: `_bmad-output/ux-design-specification.md`
- Architecture: `_bmad-output/architecture.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101) via Dev Agent (Amelia)

### Completion Notes List

1. **Tailwind Configuration Audit**: HSL-based CSS custom properties following shadcn/ui conventions. Dark mode uses class-based switching. Missing semantic score colors (teal/amber/coral).

2. **Component Audit**: 101 components total across 10 directories. 27 shadcn/ui primitives (good accessibility). 74 custom components with varying levels of theme token usage.

3. **Critical Finding**: 240 hardcoded color values across 62 files. Primary offenders are analytics and admin components.

4. **UX Spec Gaps**:
   - Primary color is white, not teal as specified
   - Border radius is 8px, spec requires 16px for cards
   - Missing score color tokens (--score-high, --score-medium, --score-growth)
   - Missing --surface and --secondary tokens

5. **Accessibility Findings**: UI primitives have good focus states (18 files). Custom components largely lack focus-visible implementations. 110 ARIA attributes found across 50 files.

6. **Design Debt Registry**: Created prioritized list of 16 items (3 critical, 4 high, 5 medium, 4 low). Estimated 18-26 hours to resolve all.

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-23 | Initial audit complete, documentation created | Dev Agent (Amelia) |

### File List

**Created:**
- `_bmad-output/design/design-system.md` - Main design system documentation (500+ lines)
- `_bmad-output/design/component-inventory.md` - Complete component inventory
- `_bmad-output/design/design-debt.md` - Prioritized debt registry

**Read/Analyzed:**
- `app/tailwind.config.ts`
- `app/app/globals.css`
- `app/components/ui/*.tsx` (27 files)
- `app/components/**/*.tsx` (74 custom components)
- `_bmad-output/ux-design-specification.md`
