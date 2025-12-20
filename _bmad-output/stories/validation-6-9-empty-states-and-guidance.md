# Validation Report: Story 6.9 - Empty States & Guidance

**Validation Date:** 2025-12-20
**Validator:** Claude Opus 4.5
**Story Status:** RESOLVED - Ready for Development

---

## Executive Summary

Story 6.9 has been validated and enhanced to ensure complete implementation guidance for the dev agent. All identified issues have been resolved directly in the story file.

**Final Counts:**
- Critical Issues Identified: 4 (all fixed)
- Enhancements Applied: 6
- Optimizations Applied: 3

---

## Issues Identified and Resolved

### Critical Issues (Must Fix)

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Missing `Loader2` import in `analysis-failed.tsx` - component used but not imported | Fixed: Added `Loader2` to imports in the code snippet |
| 2 | `useInstallToken` hook referenced but no implementation provided | Fixed: Added complete hook implementation with TanStack Query |
| 3 | Token generation mentioned but no server action implementation | Fixed: Added complete `generate-install-token.ts` server action with 24-hour expiry |
| 4 | Missing FR references in story header | Fixed: Added "FRs: FR67, FR68, FR74" and Epic reference |

### Enhancements Applied (Should Add)

| # | Enhancement | Resolution |
|---|-------------|------------|
| 1 | Missing Epic reference in metadata | Added "Epic: 6 - Dashboard, Feed & Analytics" |
| 2 | Task 5 lacked clarity on server action vs API route | Clarified: renamed to "Create install token generation server action" with specific file location |
| 3 | Missing accessibility guidance for WCAG AA compliance | Added: Accessibility Requirements section with ARIA labels, roles, and contrast requirements |
| 4 | Code snippets missing aria-hidden and role attributes | Fixed: Added proper ARIA attributes to all code snippets |
| 5 | Missing responsive design guidance | Added: Responsive Design Notes section with breakpoint specifications |
| 6 | Technology stack table was informal | Formalized: Created Technology Stack Requirements table with versions |

### Optimizations Applied (Nice to Have)

| # | Optimization | Resolution |
|---|--------------|------------|
| 1 | Dev notes had some redundancy | Consolidated: Removed duplicate architecture constraint mentions |
| 2 | Verification checklist incomplete | Expanded: Added accessibility and responsive verification items |
| 3 | Common pitfalls missing Loader2 warning | Added: "DO NOT forget Loader2 import when using spinner" |

---

## Validation Checklist Results

### Story Structure

- [x] Story has clear Epic reference
- [x] Status is set correctly (ready-for-dev)
- [x] FR references are included (FR67, FR68, FR74)
- [x] User story format is correct (As a/I want/So that)

### Acceptance Criteria

- [x] All ACs use Given/When/Then format
- [x] ACs are testable and specific
- [x] ACs cover all user scenarios (empty states, analyzing, failed)

### Tasks

- [x] Tasks are linked to ACs
- [x] Tasks include specific file paths
- [x] Tasks have checkboxes for subtasks
- [x] Server actions use correct pattern (`lib/actions/*.ts`)

### Dev Notes

- [x] Technology stack with versions specified
- [x] All code snippets are complete and correct
- [x] Import statements are complete
- [x] File locations table is comprehensive
- [x] Accessibility requirements documented
- [x] Responsive design guidance included
- [x] Common pitfalls documented

### Architecture Compliance

- [x] Uses Next.js 15 App Router patterns
- [x] Uses TanStack Query v5 (`isPending`)
- [x] Uses Server Actions for mutations
- [x] Uses `createClient` from `@/lib/supabase/server`
- [x] Uses `revalidatePath` for cache invalidation
- [x] Uses shadcn/ui Button component
- [x] Uses sonner for toasts
- [x] Dark mode styling (#0a0a0a background)

---

## FR Coverage Verification

| FR | Description | Covered By |
|----|-------------|------------|
| FR67 | Empty state shows installation instructions with copy-paste commands | Task 3, Task 4, Task 5 - EmptyFeed with CliInstructions |
| FR68 | Prompt analysis shows "Analyzing..." state with spinner | Task 6 - AnalyzingState component |
| FR74 | Prompts have visible analysis_status field | Task 6, Task 7 - AnalyzingState and AnalysisFailed components |

---

## Files to be Created

| File | Type | Purpose |
|------|------|---------|
| `components/ui/empty-state.tsx` | Component | Reusable empty state wrapper |
| `components/projects/empty-projects.tsx` | Component | Empty projects page state |
| `components/feed/empty-feed.tsx` | Component | Empty feed state |
| `components/feed/analyzing-state.tsx` | Component | Analysis in-progress state |
| `components/feed/analysis-failed.tsx` | Component | Analysis failed with retry |
| `components/onboarding/cli-instructions.tsx` | Component | CLI install command display |
| `components/team/empty-team.tsx` | Component | Empty team members state |
| `components/analytics/empty-analytics.tsx` | Component | Empty analytics state |
| `lib/actions/retry-analysis.ts` | Server Action | Retry failed analysis |
| `lib/actions/generate-install-token.ts` | Server Action | Generate install tokens |
| `lib/hooks/use-install-token.ts` | Hook | TanStack Query hook for tokens |

---

## Pre-Implementation Checklist for Dev Agent

Before starting implementation, verify:

1. [ ] `sonner` package is installed for toasts
2. [ ] `lucide-react` package is installed for icons
3. [ ] `@tanstack/react-query` v5.x is configured
4. [ ] `lib/supabase/server.ts` exists with `createClient`
5. [ ] `lib/utils.ts` exists with `cn` function
6. [ ] shadcn/ui Button component is installed
7. [ ] `prompts` table has `analysis_status` and `retry_count` columns

---

## Validation Conclusion

**Status: PASSED**

Story 6.9 is now fully validated and ready for implementation. All critical issues have been resolved, enhancements have been applied, and the story provides comprehensive guidance for the dev agent to implement empty states and guidance components without ambiguity.

**Key Improvements Made:**
1. Complete server action for install token generation
2. Complete TanStack Query hook implementation
3. All code snippets have proper imports
4. Accessibility requirements documented
5. Responsive design guidance added
6. FR coverage explicitly mapped

The dev agent should be able to implement this story without encountering missing information or ambiguous requirements.
