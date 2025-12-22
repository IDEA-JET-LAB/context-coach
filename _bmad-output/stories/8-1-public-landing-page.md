# Story 8.1: Public Landing Page

Status: ✅ Done

## Story

**As a** visitor,
**I want** to see an attractive marketing landing page,
**So that** I understand what Contextor does and can sign up.

## Acceptance Criteria

1. **Given** I visit the root URL (`/`)
   **When** I am not logged in
   **Then** I see the marketing landing page
   **And** it loads within 2 seconds (Core Web Vitals)

2. **Given** I am on the landing page
   **When** the page renders
   **Then** I see a navigation bar with:
   - Contextor logo and brand name (left)
   - Navigation links: Features, Pricing, Docs (center, hidden on mobile)
   - Login and Sign Up buttons (right)

3. **Given** the hero section
   **When** I view the page
   **Then** I see:
   - Headline: "Your Context Tutor"
   - Subheadline describing the value proposition
   - "Get Started Free" CTA button (primary, teal)
   - "See Demo" button (secondary, outlined)
   - Dashboard mockup preview image below CTAs

4. **Given** the features section
   **When** I scroll down
   **Then** I see 3 feature cards in a grid:
   - "Automatic Capture" with zap icon
   - "AI-Powered Analysis" with brain-circuit icon
   - "Team Insights" with users icon
   **And** each card has an icon, title, and description

5. **Given** the footer
   **When** I view the bottom of the page
   **Then** I see copyright text: "© 2025 Contextor. All rights reserved."

6. **Given** I click "Login" or "Sign Up" in the navigation
   **When** the click event fires
   **Then** I am navigated to `/login` or `/signup` respectively

7. **Given** I click "Get Started Free" CTA
   **When** the click event fires
   **Then** I am navigated to `/signup`

8. **Given** I am already logged in
   **When** I visit the root URL (`/`)
   **Then** I am redirected to `/prompts` (dashboard feed)

## Technical Notes

### Route Structure
- Create `app/(public)/` route group for marketing pages
- Add `app/(public)/page.tsx` as the landing page
- Middleware should NOT protect `(public)` routes

### Design System
- Use existing Tailwind CSS + shadcn/ui setup
- Dark mode: background `#0a0a0a`, text `#fafafa`
- Primary teal: `#14b8a6` (same as mockup)
- Use Inter font (already configured in layout)
- Border color: `#27272a`
- Muted text: `#a1a1aa`

### Icons
- Use Lucide React icons (already in project):
  - `Sparkles` for logo
  - `Zap` for Automatic Capture
  - `BrainCircuit` for AI-Powered Analysis
  - `Users` for Team Insights

### Components to Create
- `components/marketing/navbar.tsx`
- `components/marketing/hero.tsx`
- `components/marketing/features.tsx`
- `components/marketing/footer.tsx`

### Dashboard Preview Image
- Use placeholder image for MVP: `https://placehold.co/1200x600/141414/333333?text=Contextor+Dashboard+Preview`
- Future: Replace with actual screenshot

## Tasks / Subtasks

- [ ] **Task 1: Create public route group** (AC: #1, #8)
  - [ ] Create `app/(public)/` directory
  - [ ] Create `app/(public)/layout.tsx` with minimal layout (no dashboard sidebar)
  - [ ] Update middleware to skip auth checks for `(public)` routes
  - [ ] Verify logged-in users are redirected to dashboard from `/`

- [ ] **Task 2: Create marketing navbar component** (AC: #2, #6)
  - [ ] Create `components/marketing/navbar.tsx`
  - [ ] Add logo with Sparkles icon and "Contextor" text
  - [ ] Add desktop navigation links (Features, Pricing, Docs)
  - [ ] Hide nav links on mobile (md:flex)
  - [ ] Add Login button (text style)
  - [ ] Add Sign Up button (primary teal background)
  - [ ] Make navbar sticky with backdrop blur

- [ ] **Task 3: Create hero section component** (AC: #3, #7)
  - [ ] Create `components/marketing/hero.tsx`
  - [ ] Add headline with gradient text effect (white to gray)
  - [ ] Add subheadline with muted text color
  - [ ] Add "Get Started Free" button linking to `/signup`
  - [ ] Add "See Demo" outlined button
  - [ ] Add dashboard mockup preview with border and shadow
  - [ ] Apply hover scale effect to CTA buttons

- [ ] **Task 4: Create features section component** (AC: #4)
  - [ ] Create `components/marketing/features.tsx`
  - [ ] Create 3-column grid (responsive: 1 col mobile, 3 col desktop)
  - [ ] Add feature cards with:
    - Icon container (colored background, rounded)
    - Title (white, semibold)
    - Description (muted text)
  - [ ] Use correct icons: Zap (teal), BrainCircuit (purple), Users (blue)

- [ ] **Task 5: Create footer component** (AC: #5)
  - [ ] Create `components/marketing/footer.tsx`
  - [ ] Add copyright text centered
  - [ ] Add top border separator

- [ ] **Task 6: Assemble landing page** (AC: #1-5)
  - [ ] Create `app/(public)/page.tsx`
  - [ ] Import and compose all marketing components
  - [ ] Ensure proper spacing between sections
  - [ ] Test responsive behavior at different breakpoints

- [ ] **Task 7: Write E2E tests** (AC: #1-8)
  - [ ] Create `e2e/landing-page.spec.ts`
  - [ ] Test page loads within acceptable time
  - [ ] Test navigation links work
  - [ ] Test CTA buttons navigate correctly
  - [ ] Test logged-in redirect to dashboard
  - [ ] Test all sections render correctly

## Dev Notes

The mockup HTML uses CDN Tailwind and Iconify. We should:
1. Use the project's existing Tailwind setup (not CDN)
2. Use Lucide React icons (already installed) instead of Iconify
3. Clean up the excessive font imports from the mockup (we only need Inter)

The login page in the mockup should NOT be implemented here - we already have auth pages in `app/(auth)/`.
