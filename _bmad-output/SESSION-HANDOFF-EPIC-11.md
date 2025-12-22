# Session Handoff: Epic 11+ Story Development

**Date:** 2025-12-22
**From:** PM Agent (John)
**To:** Next Agent (Story Writer)
**Status:** Ready for story development

---

## Context Summary

Edgars (product owner) conducted a review of the Contextor application and identified several issues and missing features. A thorough investigation was performed to separate bugs from missing implementations.

---

## Epic Structure (Confirmed)

| Epic | Name | Priority | Status |
|------|------|----------|--------|
| Epic 1-9 | Various | - | COMPLETE |
| Epic 10 | Dev Environment & DB Branching | Medium | NOT STARTED (exists in epics.md) |
| **Epic 11** | **Bug Fixes & UX Polish** | **P0** | **NEEDS STORIES** |
| Epic 12 | UX/UI Rework | P1 | NEEDS DISCUSSION (major effort) |
| Epic 13 | Account Management | P2 | NEEDS STORIES |
| Epic 14 | Documentation Section | P2 | NEEDS STORIES |

---

## Epic 11: Bug Fixes & UX Polish (PRIORITY)

### Story 11.1: Fix Team Analysis Page Error

**Problem:** Team Analysis page shows "Failed to load team data" error.

**Root Cause Investigation:**
- Page location: `app/(dashboard)/team/page.tsx`
- Error comes from `useTeamMembers` hook calling `/api/teams/${teamId}/members`
- The API route at `app/api/teams/[teamId]/members/route.ts` joins `team_members` with `users` table
- Possible issues:
  1. RLS policy blocking access to `users` table
  2. Missing user records in `public.users` for some `auth.users`
  3. Team ID being undefined/null when passed

**Files to Check:**
- `app/app/(dashboard)/team/page.tsx:27` - where hook is called
- `app/lib/hooks/use-team-members.ts:21-30` - fetch function
- `app/app/api/teams/[teamId]/members/route.ts` - API route

**Action:** Debug the actual error, check browser console and server logs.

---

### Story 11.2: Debug Analytics Cards

**Problem:** User reports analytics cards show no data (only Total Prompts works).

**Investigation Finding:** Code IS fully implemented for all cards:
- Average Score: `use-personal-analytics.ts:149-152`
- Improvement %: `use-personal-analytics.ts:154-174`
- Score Trend: Chart component working

**Possible Causes (to verify):**
1. No prompts with `analysis_status = 'complete'` in database
2. No `prompt_analyses` records with `overall_score`
3. User ID mismatch between prompts and current user
4. `prompt_type = 'command'` filtering out all prompts

**Files:**
- `app/lib/hooks/use-personal-analytics.ts` - data fetching
- `app/components/analytics/summary-stats.tsx` - card display
- `app/components/analytics/analytics-dashboard.tsx` - main component

**Action:** Query database to verify data exists, then trace through if data is present.

---

### Story 11.3: Improve Team Invitations Discoverability

**Problem:** User cannot find where to invite team members.

**Investigation Finding:** Feature IS fully implemented but poorly discoverable:
- Invite UI at: `/teams/[teamId]/settings` -> "Invitations" tab
- Link only visible to admins in "Quick Actions" card on home page
- No dedicated nav item for team settings

**Current Access Path:**
1. Be on home page
2. Be an admin (card hidden otherwise)
3. See "Quick Actions" card
4. Click "Team Settings"
5. Navigate to "Invitations" tab

**User Request:** Simple URL-based invite (copy/paste shareable link) as alternative to email.

**Options:**
1. Add "Team Settings" link to sidebar navigation
2. Add URL-copy invite option (generate shareable join link)
3. Both

**Files:**
- `app/app/(dashboard)/home/page.tsx:130-145` - Quick Actions card
- `app/app/(dashboard)/teams/[teamId]/settings/page.tsx` - Settings page with invitations
- `app/components/team-settings/invite-member-form.tsx` - Invite form

---

### Story 11.4: Add Google Analytics to Marketing Pages

**Requirement:** Add Google Tag Manager / Analytics to public marketing pages.

**Tracking ID:** `G-PPFJMVVMGD`

**Implementation:**
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-PPFJMVVMGD"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-PPFJMVVMGD');
</script>
```

**Best Practice:**
- Use `NEXT_PUBLIC_GA_MEASUREMENT_ID` env var
- Only load in production (not localhost)
- Add to public layout or root layout with conditional
- Consider using `next/script` with `strategy="afterInteractive"`

**Files:**
- `app/app/layout.tsx` or `app/app/(public)/layout.tsx`

**Effort:** Tiny (15-30 minutes)

---

## Epic 13: Account Management (P2)

### Missing Features Identified:

| Feature | Status | Notes |
|---------|--------|-------|
| Display Name Edit | IMPLEMENTED | Works in `/settings` |
| Avatar Upload | IMPLEMENTED | Works in `/settings` |
| Delete Account | NOT IMPLEMENTED | User self-service deletion |
| Email Change | NOT IMPLEMENTED | Currently only in auth, not editable |
| Password Change | NOT IMPLEMENTED | Only via reset link, no in-app change |

**Files:**
- `app/app/(dashboard)/settings/page.tsx`
- `app/components/settings/profile-form.tsx`
- `app/lib/validations/profile.ts`

---

## Epic 14: Documentation Section (P2)

**Requirement:** New in-app documentation section for authenticated users.

**Scope:**
- New nav icon/section in sidebar
- Route: `/docs` or `/help`
- MVP: Basic text instructions, no screenshots
- Content: How to set up Contextor, CLI installation, usage guide
- Future: Screenshots, video, search

**Implementation Approach:**
- MDX-based content system OR
- Simple React components with documentation content
- Start minimal, iterate

---

## Epic 12: UX/UI Rework (P1 - NEEDS DETAILED DISCUSSION)

**Problem:** During development, the HTML mockup design was largely ignored. Current UI doesn't follow the design guidelines.

**Status:** Edgars wants to discuss this in detail separately. Major effort expected.

**Reference:** Check for HTML mockups in project (likely in `_bmad-output/` or design folder).

---

## Files Modified in Recent Security Review

Note: CLAUDE.md was updated with security improvements documentation. Key changes:
- Super admin verification added to admin actions
- Prompt injection sanitization
- Rate limiting improvements
- Password requirements updated (12 chars minimum)
- CSP headers added

---

## Next Steps for Story Writer

1. **Write formal story documents** for Epic 11 (4 stories)
2. Add to `_bmad-output/stories/` following existing story format
3. Update `sprint-status.yaml` with new stories
4. Stories should be implementation-ready with clear acceptance criteria

**Story Format Reference:** See existing stories in `_bmad-output/stories/` (e.g., `2-2-team-member-invitation.md`)

---

## Questions to Clarify with Edgars

1. **Epic 11.3:** Preference for URL-copy invite vs improving nav discoverability vs both?
2. **Epic 12:** When to schedule detailed UX/UI rework discussion?
3. **Priority:** Start with Epic 11 or Epic 10 (dev environment) first?

---

*Session handoff complete. PM Agent signing off.*
