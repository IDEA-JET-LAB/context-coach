---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - '_bmad-output/prd.md'
  - '_bmad-output/architecture.md'
  - '_bmad-output/ux-design-specification.md'
  - '_bmad-output/project-context.md'
project_name: 'contextor'
user_name: 'Edgars'
date: '2025-12-22'
status: 'complete'
validation_results:
  fr_coverage: '75/75 (100%)'
  architecture_compliance: 'PASS'
  story_quality: 'PASS'
  dependency_validation: 'PASS'
total_epics: 14
total_stories: 76
---

# Contextor - Epic Breakdown

> **⚠️ OUTDATED DOCUMENTATION:** This epic breakdown references "local Supabase" in several acceptance criteria. As of December 2025, **this project uses Cloud Supabase only** for all development. Do NOT follow local Supabase instructions. See `CLAUDE.md` for current setup.

## Overview

This document provides the complete epic and story breakdown for Contextor, decomposing the requirements from the PRD, Architecture, and UX Design into implementable stories.

---

## Requirements Inventory

### Functional Requirements (75 Total)

#### User & Authentication (FR1-FR6)
- **FR1:** User can register with email/password
- **FR2:** User can register/login with Gmail OAuth
- **FR3:** User can reset password via email link
- **FR4:** User can update profile information (name, avatar)
- **FR5:** User can belong to multiple teams with different roles
- **FR6:** System maintains user session with JWT (24-hour expiry, refresh tokens)

#### Team Management (FR7-FR13)
- **FR7:** User can create a new team
- **FR8:** Team admin can invite members via email
- **FR9:** Team admin can assign/change member roles (Member, Admin)
- **FR10:** Team admin can remove members from team
- **FR11:** Team member can leave a team
- **FR12:** Team admin can update team settings (name, description)
- **FR13:** User can switch between teams (updates JWT claims)

#### Project Management (FR14-FR19)
- **FR14:** Team admin can create a new project
- **FR15:** System generates unique API key per project
- **FR16:** Team admin can regenerate project API key
- **FR17:** Team admin can update project settings (name, description)
- **FR18:** Team admin can archive/delete a project
- **FR19:** Team members can view all projects in current team

#### Prompt Capture (FR20-FR26)
- **FR20:** System captures prompts via Claude Code UserPromptSubmit hook
- **FR21:** System validates API key before accepting prompt
- **FR22:** System redacts secrets/sensitive data before storage
- **FR23:** System stores prompt with metadata (timestamp, user_id, project_id)
- **FR24:** System queues prompt for AI analysis after capture
- **FR25:** Capture endpoint returns success/failure response to hook
- **FR26:** System handles capture failures with retry queue

#### AI Analysis Engine (FR27-FR35)
- **FR27:** System analyzes prompt using configured AI model
- **FR28:** System scores prompt on 5 dimensions (Clarity, Context, Specificity, Goal, Constraints)
- **FR29:** System calculates overall score as weighted average
- **FR30:** System generates dimension-specific improvement suggestions
- **FR31:** System stores analysis linked to specific config version
- **FR32:** Platform admin can configure dimension definitions
- **FR33:** Platform admin can configure dimension weights
- **FR34:** Platform admin can configure AI prompts/templates
- **FR35:** System maintains analysis config version history

#### Dashboard & Visualization (FR36-FR45)
- **FR36:** User can view prompt feed with real-time updates
- **FR37:** Dashboard updates via Supabase Realtime (no refresh needed)
- **FR38:** User can filter prompts by user, project, date range, score range
- **FR39:** User can search prompts by text content
- **FR40:** User can view prompt detail with full analysis breakdown
- **FR41:** User can view dimension scores with visual bars
- **FR42:** User can view improvement suggestions per dimension
- **FR43:** User can view personal score trends over time
- **FR44:** User can view team analytics (averages, distributions)
- **FR45:** User can compare their scores against team average

#### Platform Administration (FR46-FR50)
- **FR46:** Platform super admin can view all teams and users
- **FR47:** Platform super admin can view system-wide analytics
- **FR48:** Platform super admin can manage user accounts (disable, delete)
- **FR49:** Platform super admin can view and manage analysis configurations
- **FR50:** Platform super admin can monitor system health metrics

#### Security & Data Privacy (FR51-FR54)
- **FR51:** System encrypts prompt data at rest (AES-256)
- **FR52:** System enforces row-level security (users see only their team's data)
- **FR53:** System enforces HTTPS/TLS 1.3 for all communications
- **FR54:** System retains data according to tier-based retention policies

#### Project Installation / CLI (FR55-FR65, FR76)
- **FR55:** System provides CLI tool (`npx @contextor/cli`) for local project setup
- **FR56:** CLI accepts Install Token from dashboard
- **FR57:** CLI validates token with api.contextor.co before proceeding
- **FR58:** CLI auto-detects installation state (fresh vs. joining)
- **FR59:** CLI creates shared project configuration (.contextor/config.json)
- **FR60:** CLI creates personal user configuration (.contextor/.user)
- **FR61:** CLI auto-configures Claude Code hook in .claude/settings.json
- **FR62:** CLI adds .contextor/.user to .gitignore
- **FR63:** CLI tests connection to cloud API
- **FR64:** CLI displays success message with dashboard URL
- **FR65:** CLI handles re-runs gracefully (idempotent)
- **FR76:** CLI uses coaching-positive framing, avoiding surveillance language

#### User Experience & Reliability (FR66-FR74)
- **FR66:** Dashboard shows onboarding checklist until user completes setup
- **FR67:** Empty state shows installation instructions with copy-paste commands
- **FR68:** Prompt analysis shows "Analyzing..." state with spinner
- **FR69:** Dashboard header indicates current team context with easy switching
- **FR70:** Prompt scores display team average alongside personal score
- **FR71:** New team members see privacy choice modal on first join
- **FR72:** System validates prompt length before analysis (10-100K chars)
- **FR73:** Analysis has retry logic with max 3 attempts
- **FR74:** Prompts have visible analysis_status field (pending/processing/complete/failed)

**Note:** FR75 is missing from PRD (numbering skips FR74 → FR76).

---

### Non-Functional Requirements (31 Total)

#### Performance (NFR-P1 to NFR-P5)
- **NFR-P1:** Dashboard initial load < 2 seconds
- **NFR-P2:** Prompt feed update latency < 500ms
- **NFR-P3:** AI analysis completion < 30 seconds (99th percentile)
- **NFR-P4:** Filter/search response < 1 second (P95)
- **NFR-P5:** Support 20+ concurrent users per team

#### Security (NFR-S1 to NFR-S7)
- **NFR-S1:** AES-256 encryption at rest
- **NFR-S2:** TLS 1.3 for all communications
- **NFR-S3:** JWT tokens with 24-hour expiry
- **NFR-S4:** Row-level security on all data tables
- **NFR-S5:** API key hashing (never store plaintext)
- **NFR-S6:** Secret redaction before cloud storage
- **NFR-S7:** Rate limiting on capture endpoint

#### Scalability (NFR-SC1 to NFR-SC5)
- **NFR-SC1:** MVP: 500 users, 50K prompts/month
- **NFR-SC2:** Growth: 5K users, 500K prompts/month
- **NFR-SC3:** Queue-based analysis for burst capacity
- **NFR-SC4:** Stateless application tier (Cloud Run)
- **NFR-SC5:** Database connection pooling

#### Reliability (NFR-R1 to NFR-R5)
- **NFR-R1:** 95%+ prompt capture rate
- **NFR-R2:** 99%+ analysis completion rate
- **NFR-R3:** 99.5% uptime target
- **NFR-R4:** Graceful degradation on component failures
- **NFR-R5:** Retry logic for transient failures

#### Integration (NFR-I1 to NFR-I5)
- **NFR-I1:** Claude Code UserPromptSubmit hook compatibility
- **NFR-I2:** Supabase Realtime for live updates
- **NFR-I3:** JSON API response format with consistent error schema
- **NFR-I4:** Webhook reliability (3 retries with exponential backoff)
- **NFR-I5:** API versioning with deprecation notices

#### Accessibility (NFR-A1 to NFR-A4)
- **NFR-A1:** Keyboard navigation for all primary actions
- **NFR-A2:** WCAG AA color contrast (4.5:1 for text)
- **NFR-A3:** Screen reader support (semantic HTML, ARIA labels)
- **NFR-A4:** Responsive design (functional on 1024px+)

---

### Infrastructure Requirements (18 Total)

#### Domain & DNS (INF-D1 to INF-D4)
- **INF-D1:** contextor.co domain registration
- **INF-D2:** app.contextor.co for web application
- **INF-D3:** api.contextor.co for API endpoints
- **INF-D4:** SSL certificates for all domains

#### npm Package Publishing (INF-N1 to INF-N5)
- **INF-N1:** @contextor/cli package name reserved
- **INF-N2:** npm organization setup
- **INF-N3:** Automated publish on release
- **INF-N4:** Semantic versioning
- **INF-N5:** README with installation instructions

#### CI/CD Pipeline (INF-C1 to INF-C5)
- **INF-C1:** GitHub Actions workflow
- **INF-C2:** Automated testing on PR
- **INF-C3:** Docker build and push
- **INF-C4:** Cloud Run deployment
- **INF-C5:** Environment-specific configurations

#### Monitoring & Observability (INF-M1 to INF-M4)
- **INF-M1:** Cloud Run metrics (CPU, memory, requests)
- **INF-M2:** Supabase dashboard monitoring
- **INF-M3:** Application logging via Cloud Logging
- **INF-M4:** Error alerting (post-MVP)

---

### Additional Requirements from Architecture

#### Starter Template
- Initialize project with: `npx create-next-app@latest contextor -e with-supabase`
- This provides: TypeScript strict, Tailwind CSS, shadcn/ui, Supabase Auth with supabase-ssr

#### Technology Stack Specifics
- Next.js 15 App Router (no Pages Router)
- Drizzle ORM 0.45.1 for complex queries only
- TanStack Query 5.90.x (`isPending` not `isLoading`)
- Supabase Edge Functions for analysis processing
- Upstash Redis for rate limiting

#### Multi-Tenancy
- All tables include `team_id` column
- JWT claims include current `team_id`
- RLS policies: `auth.jwt() ->> 'team_id' = team_id`

#### Platform Admin
- `is_super_admin` flag on users table
- Service role client for cross-team queries
- Admin routes under `app/(dashboard)/admin/`

---

### Additional Requirements from UX Design

#### Visual Design
- Dark mode default (#0a0a0a background)
- Score colors: Teal (7-10), Amber (4-6), Coral (1-3)
- 64px icon-only sidebar navigation
- 16px border radius on cards
- Inter font family

#### Component Patterns
- PromptRow with score accent bar
- ScoreBadge (circular, color-coded)
- DimensionBar (horizontal progress)
- StatCard with trend indicator
- DateGroupHeader (sticky in feed)

#### Interaction Patterns
- Progressive disclosure (card → detail on click)
- Real-time updates without refresh
- Filter persistence across sessions
- Keyboard shortcuts for power users

#### Responsive Design
- Desktop-first (1024px+)
- Mobile bottom nav at <768px
- Single column layout on mobile

---

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1-FR6 | Epic 1 | User registration, login, profiles, sessions |
| FR7-FR13 | Epic 2 | Team creation, invites, roles, switching |
| FR14-FR19 | Epic 2 | Project creation, API keys, settings |
| FR20-FR26 | Epic 4 | Prompt capture, validation, redaction, queuing |
| FR27-FR35 | Epic 5 | AI analysis, scoring, suggestions, config |
| FR36-FR45 | Epic 6 | Dashboard, feed, filters, detail, analytics |
| FR46-FR50 | Epic 7 | Platform admin, user management, health |
| FR51-FR54 | Epic 1 | Security, encryption, RLS, retention |
| FR55-FR65 | Epic 3 | CLI package, token flow, hook setup |
| FR66-FR71 | Epic 6 | Onboarding, empty states, team context |
| FR72 | Epic 4 | Input validation (prompt length) |
| FR73-FR74 | Epic 5 | Analysis retry logic, status tracking |
| FR76 | Epic 3 | Coaching-positive CLI messaging |

**Coverage:** 75/75 FRs mapped (100%)

---

## Epic List

### Epic 1: Project Foundation & Authentication ✅ COMPLETE
Users can register, login, and access the Contextor platform securely.
**FRs covered:** FR1-FR6, FR51-FR54

### Epic 2: Team & Project Management ✅ COMPLETE
Users can create teams, invite members, set roles, and register projects for tracking.
**FRs covered:** FR7-FR19

### Epic 3: CLI Installation Experience ✅ COMPLETE
Developers can install Contextor in their projects with a single command.
**FRs covered:** FR55-FR65, FR76

### Epic 4: Prompt Capture Pipeline ✅ COMPLETE
System captures prompts from Claude Code securely and queues them for analysis.
**FRs covered:** FR20-FR26, FR72

### Epic 5: AI Analysis Engine ✅ COMPLETE
System analyzes every prompt with 5-dimension scoring and actionable suggestions.
**FRs covered:** FR27-FR35, FR73-FR74

### Epic 6: Dashboard, Feed & Analytics ✅ COMPLETE
Users can view prompts with scores in a real-time dashboard and track improvement over time.
**FRs covered:** FR36-FR45, FR66-FR71

### Epic 7: Platform Administration ✅ COMPLETE
Super admins can manage users, teams, analysis configs, and monitor system health.
**FRs covered:** FR46-FR50

### Epic 8: Marketing Landing Page ✅ COMPLETE
Public-facing landing page that introduces Contextor and drives signups.
**FRs covered:** N/A (Marketing requirement, not in original FR list)

### Epic 9: Production Deployment & Infrastructure ✅ COMPLETE
Deploy Contextor to production with domain setup, CI/CD, npm publishing, and zero-downtime strategy.
**INFs covered:** INF-D1 to INF-D4, INF-N1 to INF-N5, INF-C1 to INF-C5, INF-M1 to INF-M4

### Epic 10: Development Environment & Database Branching
Enable safe development workflow using Supabase branching with developer prompt mirroring for testing.
**Priority:** Medium | **Status:** BACKLOG

### Epic 11: Bug Fixes & UX Polish ✅ COMPLETE
Fix critical bugs and UX issues discovered during production usage.
**Priority:** P0 (Critical) | **Status:** COMPLETE (2025-12-22)

### Epic 12: UX/UI Rework
Major UX/UI overhaul to align with original HTML mockup design guidelines.
**Priority:** P1 | **Status:** DEFERRED (needs detailed discussion)

### Epic 13: Account Management
User self-service account features: delete account, change email, change password.
**Priority:** P2 | **Status:** NEEDS STORIES

### Epic 14: Documentation Section
In-app documentation and help section for authenticated users.
**Priority:** P2 | **Status:** NEEDS STORIES

---

## Epic 1: Project Foundation & Authentication ✅ COMPLETE

Users can register, login, and access the Contextor platform securely.

**FRs Covered:** FR1-FR6, FR51-FR54

**Status:** Complete (2025-12-20)
**Implementation:** `app/` - Auth flows, password reset, session management
**Tests:** 21 E2E tests passing
**Agent:** Claude Opus 4.5

---

### Story 1.1: Project Initialization

**As a** developer,
**I want** to initialize the Contextor project with the official Supabase starter template,
**So that** I have a properly configured foundation with authentication, database, and deployment ready.

**Acceptance Criteria:**

**Given** a new project directory
**When** I run `npx create-next-app@latest contextor -e with-supabase`
**Then** the project is created with Next.js 15, TypeScript strict mode, and Tailwind CSS
**And** Supabase client configuration is in place (`lib/supabase/`)
**And** the `middleware.ts` handles auth redirects
**And** the `app/(auth)/` and `app/(dashboard)/` route groups exist

**Given** a local Supabase instance
**When** I run `supabase init` and `supabase start`
**Then** local development environment is ready
**And** `.env.local` contains Supabase connection strings

**Given** the initial database setup
**When** I apply the first migration
**Then** the `users` table extends `auth.users` with profile fields (`name`, `avatar_url`, `is_super_admin`)
**And** RLS is enabled on all tables
**And** basic RLS policies are in place

---

### Story 1.2: User Registration with Email

**As a** new user,
**I want** to register for Contextor using my email and password,
**So that** I can create an account and access the platform.

**Acceptance Criteria:**

**Given** I am on the registration page (`/signup`)
**When** I enter a valid email and password (min 8 chars)
**Then** a new account is created in Supabase Auth
**And** a corresponding row is created in the `users` table
**And** I receive a confirmation email
**And** I am redirected to the email verification pending page

**Given** I enter an email that already exists
**When** I submit the registration form
**Then** I see an error message "An account with this email already exists"
**And** no duplicate account is created

**Given** I enter an invalid email format
**When** I submit the form
**Then** I see inline validation "Please enter a valid email address"

**Given** I enter a password shorter than 8 characters
**When** I submit the form
**Then** I see inline validation "Password must be at least 8 characters"

---

### Story 1.3: User Login with Email

**As a** registered user,
**I want** to log in with my email and password,
**So that** I can access my dashboard and team data.

**Acceptance Criteria:**

**Given** I am on the login page (`/login`)
**When** I enter valid credentials
**Then** I am authenticated via Supabase Auth
**And** a JWT session is created (24-hour expiry)
**And** I am redirected to the dashboard (`/prompts`)

**Given** I enter incorrect credentials
**When** I submit the login form
**Then** I see an error "Invalid email or password"
**And** no session is created

**Given** I am already logged in
**When** I navigate to `/login`
**Then** I am redirected to the dashboard

**Given** my session has expired
**When** I try to access a protected route
**Then** I am redirected to `/login`
**And** I see a message "Your session has expired. Please log in again."

---

### Story 1.4: OAuth Registration/Login with Gmail

**As a** user,
**I want** to register or log in using my Google account,
**So that** I can access Contextor without creating a separate password.

**Acceptance Criteria:**

**Given** I am on the login or signup page
**When** I click "Continue with Google"
**Then** I am redirected to Google's OAuth consent screen
**And** after approval, I am redirected back to `/auth/callback`

**Given** I complete Google OAuth for the first time
**When** the callback processes
**Then** a new account is created in Supabase Auth with my Google email
**And** a corresponding `users` row is created with name from Google profile
**And** I am redirected to the dashboard

**Given** I have an existing account with my Google email
**When** I complete Google OAuth
**Then** I am logged into my existing account
**And** no duplicate account is created

**Given** I deny the Google OAuth consent
**When** the callback processes
**Then** I am redirected to `/login` with message "Google sign-in was cancelled"

---

### Story 1.5: Password Reset Flow

**As a** user who forgot my password,
**I want** to reset my password via email,
**So that** I can regain access to my account.

**Acceptance Criteria:**

**Given** I am on the login page
**When** I click "Forgot password?"
**Then** I am taken to the password reset request page (`/reset-password`)

**Given** I enter my registered email on the reset page
**When** I submit the form
**Then** a password reset email is sent via Supabase Auth
**And** I see "Check your email for a reset link"

**Given** I enter an email that doesn't exist
**When** I submit the form
**Then** I see the same success message (to prevent email enumeration)
**And** no email is sent

**Given** I click the reset link in my email
**When** the link is valid and not expired
**Then** I am taken to the new password form
**And** I can enter a new password (min 8 chars)
**And** upon submission, my password is updated
**And** I am redirected to login with "Password updated successfully"

**Given** I click an expired or invalid reset link
**When** the page loads
**Then** I see "This reset link has expired. Please request a new one."

---

### Story 1.6: User Profile Management

**As a** logged-in user,
**I want** to update my profile information,
**So that** my name and avatar reflect my identity in the platform.

**Acceptance Criteria:**

**Given** I am logged in and on the settings page (`/settings`)
**When** I view my profile section
**Then** I see my current name and avatar

**Given** I update my display name
**When** I save the changes
**Then** the `users.name` field is updated
**And** I see a success toast "Profile updated"
**And** my new name appears in the dashboard header

**Given** I upload a new avatar image
**When** the image is valid (JPG/PNG, < 2MB)
**Then** it is uploaded to Supabase Storage
**And** `users.avatar_url` is updated with the new URL
**And** my new avatar appears throughout the app

**Given** I upload an invalid file (wrong format or too large)
**When** I try to save
**Then** I see an error "Please upload a JPG or PNG image under 2MB"

---

### Story 1.7: Session & Security Foundation

**As a** platform operator,
**I want** secure session management and data protection,
**So that** user data is protected and access is properly controlled.

**Acceptance Criteria:**

**Given** a user logs in
**When** their session is created
**Then** JWT tokens are issued with 24-hour expiry
**And** refresh tokens are stored securely (httpOnly cookies)
**And** `middleware.ts` refreshes sessions on each request

**Given** the `users` table
**When** RLS is evaluated
**Then** users can only read/update their own profile
**And** the `is_super_admin` field is read-only (cannot be self-modified)

**Given** data at rest in Supabase
**When** encryption is configured
**Then** all data is encrypted with AES-256 (Supabase default)

**Given** API communications
**When** requests are made
**Then** all traffic uses HTTPS/TLS 1.3

**Given** the foundation for future tables
**When** new tables are created in subsequent stories
**Then** they inherit the RLS-first approach with `team_id` scoping

---

## Epic 2: Team & Project Management ✅ COMPLETE

Users can create teams, invite members, set roles, and register projects for tracking.

**FRs Covered:** FR7-FR19

**Status:** Complete (2025-12-21)
**Implementation:** `app/` - Team management, project CRUD, invitations, settings
**Tests:** 114 E2E tests passing
**Agent:** Claude Opus 4.5

---

### Story 2.1: Team Creation & Schema

**As a** logged-in user,
**I want** to create a new team,
**So that** I can organize my projects and invite collaborators.

**Acceptance Criteria:**

**Given** I am logged in and have no teams
**When** I access the dashboard
**Then** I am prompted to create my first team

**Given** I am on the create team page
**When** I enter a team name and submit
**Then** a new row is created in the `teams` table
**And** a `team_members` row is created with my user_id, the team_id, and role = 'admin'
**And** my JWT is updated with `team_id` claim
**And** I am redirected to the team dashboard

**Given** the database schema
**When** this story is complete
**Then** the `teams` table exists with columns: `id`, `name`, `description`, `created_at`, `created_by`
**And** the `team_members` table exists with: `id`, `team_id`, `user_id`, `role`, `joined_at`
**And** RLS policies enforce team-scoped access
**And** role enum includes: `member`, `admin`

---

### Story 2.2: Team Member Invitation

**As a** team admin,
**I want** to invite new members to my team via email,
**So that** my colleagues can access our shared projects.

**Acceptance Criteria:**

**Given** I am a team admin on the team settings page
**When** I enter an email address and click "Invite"
**Then** an invitation email is sent to that address
**And** a pending invitation record is created
**And** I see the pending invitation in the members list

**Given** the invitee clicks the invitation link
**When** they are already a Contextor user
**Then** they are added to the team as a `member`
**And** they see the team in their team switcher

**Given** the invitee clicks the invitation link
**When** they are NOT a Contextor user
**Then** they are directed to register
**And** after registration, they are added to the team

**Given** I try to invite an email already in the team
**When** I submit the form
**Then** I see "This user is already a team member"

**Given** an invitation is pending
**When** the admin clicks "Revoke"
**Then** the invitation is cancelled
**And** the link no longer works

---

### Story 2.3: Role Management & Member Removal

**As a** team admin,
**I want** to manage member roles and remove members,
**So that** I can control access to our team's data.

**Acceptance Criteria:**

**Given** I am a team admin viewing the members list
**When** I click on a member's role dropdown
**Then** I can change their role between `member` and `admin`
**And** the change takes effect immediately
**And** their permissions update on next request

**Given** I am a team admin
**When** I click "Remove" on a team member
**Then** I see a confirmation dialog
**And** upon confirmation, their `team_members` row is deleted
**And** they lose access to the team's data immediately

**Given** I am a team member (not admin)
**When** I click "Leave Team"
**Then** I see a confirmation dialog
**And** upon confirmation, my `team_members` row is deleted
**And** I am redirected to my next available team (or team creation)

**Given** I am the last admin in a team
**When** I try to leave or change my role
**Then** I see "You must assign another admin before leaving"

---

### Story 2.4: Team Settings

**As a** team admin,
**I want** to update my team's settings,
**So that** the team name and description are accurate.

**Acceptance Criteria:**

**Given** I am a team admin on the team settings page
**When** I update the team name
**Then** the `teams.name` field is updated
**And** the new name appears in the header and team switcher

**Given** I update the team description
**When** I save changes
**Then** the `teams.description` field is updated
**And** I see a success toast

**Given** I am a regular team member
**When** I view team settings
**Then** I can see settings but cannot edit them

---

### Story 2.5: Team Switching

**As a** user belonging to multiple teams,
**I want** to switch between my teams,
**So that** I can access different projects and data contexts.

**Acceptance Criteria:**

**Given** I belong to multiple teams
**When** I click the team switcher in the header
**Then** I see a dropdown list of all my teams
**And** my current team is highlighted

**Given** I select a different team from the switcher
**When** the selection is made
**Then** my JWT `team_id` claim is updated
**And** all RLS-filtered queries now return data for the new team
**And** the dashboard refreshes to show the new team's data
**And** the team name in the header updates

**Given** I have only one team
**When** I view the header
**Then** the team switcher shows my team name but no dropdown

---

### Story 2.6: Project Creation

**As a** team admin,
**I want** to create a new project with an API key,
**So that** developers can install Contextor in their repositories.

**Acceptance Criteria:**

**Given** I am a team admin on the projects page
**When** I click "New Project"
**Then** I see a form with project name and description fields

**Given** I submit a valid project name
**When** the project is created
**Then** a new `projects` row is created with `team_id`
**And** a unique API key is generated (format: `ctx_live_xxxx`)
**And** the API key hash is stored (never plaintext)
**And** an Install Token is generated for the CLI
**And** I see the project page with installation instructions

**Given** the database schema
**When** this story is complete
**Then** the `projects` table exists with: `id`, `team_id`, `name`, `description`, `api_key_hash`, `created_at`, `created_by`
**And** RLS policies enforce team-scoped access

---

### Story 2.7: Project Management

**As a** team admin,
**I want** to manage project settings and API keys,
**So that** I can maintain security and update project information.

**Acceptance Criteria:**

**Given** I am a team admin viewing a project
**When** I click "Regenerate API Key"
**Then** I see a warning "This will invalidate the current key"
**And** upon confirmation, a new API key is generated
**And** the old key immediately stops working
**And** I see the new key (displayed once)

**Given** I update the project name or description
**When** I save changes
**Then** the `projects` row is updated
**And** I see a success toast

**Given** I click "Archive Project"
**When** I confirm the action
**Then** the project is soft-deleted (archived flag)
**And** it no longer appears in the active projects list
**And** its API key stops working
**And** historical data remains accessible (read-only)

**Given** I am a regular team member
**When** I view a project
**Then** I can see project details and installation instructions
**And** I cannot regenerate keys or archive the project

---

## Epic 3: CLI Installation Experience ✅ COMPLETE

Developers can install Contextor in their projects with a single command.

**FRs Covered:** FR55-FR65, FR76

**Status:** Complete (2025-12-21)
**Implementation:** `packages/cli/` + `app/api/cli/` - 112 unit tests, E2E verified
**Agent:** Claude Opus 4.5
**Notes:** Fixed Claude Code hooks format, capture script payload, and API URL path during E2E testing

---

### Story 3.1: CLI Package Foundation

**As a** developer,
**I want** to install Contextor using npx,
**So that** I don't need to globally install anything.

**Acceptance Criteria:**

**Given** I have Node.js installed
**When** I run `npx @contextor/cli --version`
**Then** I see the CLI version number
**And** no global installation is required

**Given** the CLI package structure
**When** this story is complete
**Then** `packages/cli/` exists with proper npm package configuration
**And** the `bin/contextor.js` entry point is configured
**And** the package can be published to npm
**And** TypeScript compilation produces valid JavaScript

---

### Story 3.2: Install Token Parsing

**As a** developer,
**I want** the CLI to accept and validate my Install Token,
**So that** my project is securely linked to my Contextor account.

**Acceptance Criteria:**

**Given** I have an Install Token from the dashboard
**When** I run `npx @contextor/cli init <TOKEN>`
**Then** the CLI parses the base64-encoded token
**And** extracts: project_id, team_id, user_id, api_key, api_endpoint

**Given** I provide an invalid or malformed token
**When** the CLI attempts to parse it
**Then** I see "Invalid install token. Please copy it again from the dashboard."
**And** the CLI exits with error code 1

**Given** I provide an expired token
**When** the CLI validates with the API
**Then** I see "This install token has expired. Please generate a new one."

---

### Story 3.3: Installation State Detection

**As a** developer joining an existing project,
**I want** the CLI to detect if Contextor is already installed,
**So that** I don't accidentally overwrite team configuration.

**Acceptance Criteria:**

**Given** no `.contextor/` directory exists
**When** I run `npx @contextor/cli init <TOKEN>`
**Then** the CLI detects "fresh install" state
**And** creates both shared and personal configuration

**Given** `.contextor/config.json` exists but `.contextor/.user` does not
**When** I run `npx @contextor/cli init <TOKEN>`
**Then** the CLI detects "joining project" state
**And** validates the token matches the existing project_id
**And** creates only the personal `.user` configuration

**Given** both config files exist for a different project
**When** I run `npx @contextor/cli init <TOKEN>`
**Then** I see "This project is configured for a different Contextor project. Use --force to override."

---

### Story 3.4: Configuration File Creation

**As a** developer,
**I want** the CLI to create the necessary configuration files,
**So that** prompt capture works automatically.

**Acceptance Criteria:**

**Given** a fresh install
**When** the CLI completes successfully
**Then** `.contextor/config.json` is created with: project_id, project_name, team_id, team_name, api_endpoint, created_at, created_by
**And** `.contextor/.user` is created with: user_id, user_name, api_key, configured_at
**And** `.gitignore` is updated to include `.contextor/.user`

**Given** `.gitignore` doesn't exist
**When** the CLI runs
**Then** `.gitignore` is created with `.contextor/.user`

**Given** `.gitignore` already contains `.contextor/.user`
**When** the CLI runs
**Then** no duplicate entry is added

---

### Story 3.5: Claude Code Hook Configuration

**As a** developer,
**I want** the CLI to configure the Claude Code hook,
**So that** my prompts are automatically captured.

**Acceptance Criteria:**

**Given** a fresh install
**When** the CLI completes
**Then** `.claude/settings.json` is created or updated with the UserPromptSubmit hook
**And** `.claude/hooks/contextor-capture.sh` is created with the capture script
**And** the capture script is executable (chmod +x)

**Given** `.claude/settings.json` already has other hooks
**When** the CLI runs
**Then** the Contextor hook is added without removing existing hooks

**Given** the capture script
**When** it receives a prompt via stdin
**Then** it sends the prompt to the capture API with the API key from `.contextor/.user`

---

### Story 3.6: Connection Testing & Success

**As a** developer,
**I want** the CLI to verify the installation works,
**So that** I know prompts will be captured correctly.

**Acceptance Criteria:**

**Given** the installation is complete
**When** the CLI runs the connection test
**Then** a test request is sent to `api.contextor.co/cli/test-capture`
**And** the API validates the API key
**And** success or failure is reported

**Given** the connection test succeeds
**When** the CLI finishes
**Then** I see a success message with coaching-positive framing
**And** the dashboard URL is displayed: `https://app.contextor.co/projects/<project_id>`
**And** the message says "Your prompts will appear there as you work"

**Given** the connection test fails
**When** the CLI reports the error
**Then** I see specific troubleshooting steps
**And** a link to documentation

---

### Story 3.7: CLI Status & Uninstall Commands

**As a** developer,
**I want** to check my installation status or remove Contextor,
**So that** I can troubleshoot or clean up as needed.

**Acceptance Criteria:**

**Given** I run `npx @contextor/cli status`
**When** Contextor is properly installed
**Then** I see: project name, team name, user name, connection status
**And** the last successful capture timestamp (if any)

**Given** I run `npx @contextor/cli status`
**When** Contextor is not installed
**Then** I see "Contextor is not installed in this project"
**And** instructions to run `init`

**Given** I run `npx @contextor/cli uninstall`
**When** I confirm the action
**Then** `.contextor/.user` is deleted
**And** the hook is removed from `.claude/settings.json`
**And** `.contextor/config.json` is preserved (team shared)
**And** I see "Personal configuration removed. Shared project config preserved."

---

## Epic 4: Prompt Capture Pipeline

System captures prompts from Claude Code securely and queues them for analysis.

**FRs Covered:** FR20-FR26, FR72

---

### Story 4.1: Capture API Endpoint

**As a** system,
**I want** to receive prompts from the CLI hook,
**So that** they can be stored and analyzed.

**Acceptance Criteria:**

**Given** the capture endpoint at `POST /api/prompts/capture`
**When** a valid request arrives with API key header
**Then** the API key is validated against `projects.api_key_hash`
**And** the project_id and team_id are extracted
**And** the request proceeds to processing

**Given** an invalid or missing API key
**When** the request arrives
**Then** HTTP 401 is returned with `{ error: { code: 'INVALID_API_KEY' } }`

**Given** a valid request body
**When** the prompt is received
**Then** the body contains: `prompt` (text), `user_id`, `timestamp`, `metadata` (optional)

---

### Story 4.2: Rate Limiting

**As a** platform operator,
**I want** to rate limit the capture endpoint,
**So that** the system isn't overwhelmed by excessive requests.

**Acceptance Criteria:**

**Given** the rate limiting configuration
**When** requests arrive
**Then** Upstash Redis tracks request counts
**And** limits are: 100/min per project, 20/min per user

**Given** a request exceeds the rate limit
**When** the limit is hit
**Then** HTTP 429 is returned with `{ error: { code: 'RATE_LIMITED' } }`
**And** `Retry-After` header indicates when to retry

**Given** rate limit state
**When** the window expires
**Then** the counter resets and requests succeed again

---

### Story 4.3: Input Validation

**As a** system,
**I want** to validate prompt content before processing,
**So that** invalid or malicious input is rejected.

**Acceptance Criteria:**

**Given** a prompt shorter than 10 characters
**When** it arrives at the capture endpoint
**Then** HTTP 400 is returned with `{ error: { code: 'PROMPT_TOO_SHORT' } }`

**Given** a prompt longer than 100,000 characters
**When** it arrives at the capture endpoint
**Then** HTTP 400 is returned with `{ error: { code: 'PROMPT_TOO_LONG' } }`

**Given** a valid prompt length (10-100K chars)
**When** validation passes
**Then** processing continues

---

### Story 4.4: Secret Redaction

**As a** platform operator,
**I want** secrets redacted from prompts before storage,
**So that** sensitive data is never persisted.

**Acceptance Criteria:**

**Given** a prompt containing common secret patterns
**When** the redaction pipeline runs
**Then** API keys (e.g., `sk_live_xxx`, `AKIA...`) are replaced with `[REDACTED]`
**And** passwords in URLs are replaced
**And** JWT tokens are replaced
**And** environment variable values are replaced

**Given** the `lib/capture/redact-secrets.ts` module
**When** processing a prompt
**Then** regex patterns match common secret formats
**And** redaction happens BEFORE any database write

**Given** a prompt with no secrets
**When** redaction runs
**Then** the prompt is unchanged

---

### Story 4.5: Prompt Storage & Queue

**As a** system,
**I want** to store prompts and queue them for analysis,
**So that** they can be processed asynchronously.

**Acceptance Criteria:**

**Given** a validated, redacted prompt
**When** it is stored
**Then** a new `prompts` row is created with: id, team_id, project_id, user_id, text, char_count, word_count, created_at, analysis_status='pending'
**And** RLS policies are applied

**Given** the database schema
**When** this story is complete
**Then** the `prompts` table exists with all required columns
**And** indexes exist on: team_id, user_id, created_at, analysis_status

**Given** a prompt is inserted
**When** the insert succeeds
**Then** a database trigger or webhook notifies the analysis Edge Function
**And** HTTP 201 is returned to the CLI with `{ data: { id, status: 'pending' } }`

---

### Story 4.6: Capture Error Handling

**As a** system,
**I want** to handle capture failures gracefully,
**So that** prompts aren't lost due to transient errors.

**Acceptance Criteria:**

**Given** a database write fails
**When** the error is transient (connection, timeout)
**Then** the request is retried up to 3 times with backoff
**And** if all retries fail, HTTP 503 is returned

**Given** the CLI receives a 5xx error
**When** the capture fails
**Then** the CLI logs the error locally
**And** a retry can be attempted later

**Given** the capture succeeds
**When** HTTP 201 is returned
**Then** the CLI silently continues (no user interruption)

---

## Epic 5: AI Analysis Engine

System analyzes every prompt with 5-dimension scoring and actionable suggestions.

**FRs Covered:** FR27-FR35, FR73-FR74

---

### Story 5.1: Analysis Edge Function

**As a** system,
**I want** an Edge Function to process prompts,
**So that** analysis runs asynchronously without blocking capture.

**Acceptance Criteria:**

**Given** a new prompt is inserted
**When** the database trigger fires
**Then** the `analyze-prompt` Edge Function is invoked
**And** it receives the prompt_id

**Given** the Edge Function
**When** it starts processing
**Then** it updates `prompts.analysis_status` to 'processing'
**And** it loads the active `analysis_config`

**Given** the Edge Function structure
**When** this story is complete
**Then** `supabase/functions/analyze-prompt/index.ts` exists
**And** it can be deployed to Supabase

---

### Story 5.2: 5-Dimension Scoring

**As a** system,
**I want** to score prompts on 5 dimensions,
**So that** users get detailed feedback on prompt quality.

**Acceptance Criteria:**

**Given** a prompt to analyze
**When** the AI model is called
**Then** scores are returned for: Clarity, Context, Specificity, Goal, Constraints
**And** each dimension score is 1-10

**Given** dimension scores
**When** the overall score is calculated
**Then** it is a weighted average based on config weights
**And** weights sum to 100%

**Given** the AI response
**When** parsing completes
**Then** structured scores are extracted
**And** invalid responses trigger retry logic

---

### Story 5.3: Improvement Suggestions

**As a** system,
**I want** to generate improvement suggestions per dimension,
**So that** users know exactly how to improve.

**Acceptance Criteria:**

**Given** a dimension with score < 8
**When** analysis completes
**Then** a specific suggestion is generated for that dimension
**And** the suggestion references the actual prompt text

**Given** a dimension with score >= 8
**When** analysis completes
**Then** a positive reinforcement message is included
**And** optional "next level" suggestions may be provided

**Given** all suggestions
**When** they are formatted
**Then** they use coaching-positive language
**And** they are actionable (not vague)

---

### Story 5.4: Analysis Storage

**As a** system,
**I want** to store analysis results,
**So that** they can be displayed in the dashboard.

**Acceptance Criteria:**

**Given** analysis completes successfully
**When** results are stored
**Then** a `prompt_analyses` row is created with: id, prompt_id, config_id, overall_score, dimension_scores (JSONB), suggestions (JSONB), created_at
**And** `prompts.analysis_status` is updated to 'complete'

**Given** the database schema
**When** this story is complete
**Then** the `prompt_analyses` table exists
**And** RLS policies allow reading via prompt's team_id
**And** `config_id` references the analysis config version used

---

### Story 5.5: Retry Logic & Error Handling

**As a** system,
**I want** analysis to retry on failure,
**So that** transient errors don't cause missing analyses.

**Acceptance Criteria:**

**Given** an analysis attempt fails
**When** the error is transient (API timeout, rate limit)
**Then** `prompts.analysis_attempts` is incremented
**And** retry is scheduled with delay: [1s, 5s, 15s]

**Given** analysis fails 3 times
**When** max retries exceeded
**Then** `prompts.analysis_status` is set to 'failed'
**And** `prompts.last_analysis_error` stores the error message
**And** the prompt appears in dead letter queue for review

**Given** analysis succeeds after retry
**When** results are stored
**Then** status is 'complete'
**And** retry count is preserved for metrics

---

### Story 5.6: Analysis Configuration Management

**As a** platform admin,
**I want** to configure analysis dimensions and weights,
**So that** the scoring can be tuned over time.

**Acceptance Criteria:**

**Given** the analysis config schema
**When** this story is complete
**Then** `analysis_configs` table exists with: id, version, name, system_prompt, model, is_active, created_by, created_at
**And** `analysis_dimensions` table exists with: id, config_id, name, description, weight, prompt_template, scoring_criteria, enabled, sort_order
**And** only one config can have `is_active = true`

**Given** a new analysis is triggered
**When** the Edge Function loads config
**Then** it uses the config where `is_active = true`
**And** the config_id is recorded with the analysis

**Given** default seed data
**When** the database is initialized
**Then** a default analysis config exists with 5 dimensions
**And** weights are: Clarity 25%, Context 25%, Specificity 20%, Goal 15%, Constraints 15%

### Story 5.7: Command Prompt Classification

**As a** system,
**I want** to identify and classify slash command prompts,
**So that** they are stored but not analyzed, saving AI costs and keeping analytics focused on actual prompts.

**Acceptance Criteria:**

**Given** a prompt starting with `/`
**When** it is captured via the API
**Then** it is stored with `prompt_type = 'command'`
**And** `analysis_status` is set to `'skipped'` (not 'pending')

**Given** a prompt NOT starting with `/`
**When** it is captured
**Then** it is stored with `prompt_type = 'prompt'`
**And** normal analysis flow continues

**Given** the prompt feed in the dashboard
**When** displaying command prompts
**Then** they appear with a distinct visual style (muted, command icon)
**And** show "Command - not analyzed" instead of scores

**Given** analytics calculations
**When** computing averages and trends
**Then** command prompts are excluded from all calculations

---

## Epic 6: Dashboard, Feed & Analytics

Users can view prompts with scores in a real-time dashboard and track improvement over time.

**FRs Covered:** FR36-FR45, FR66-FR71

---

### Story 6.1: Dashboard Layout & Navigation

**As a** logged-in user,
**I want** a clear dashboard layout,
**So that** I can easily navigate between sections.

**Acceptance Criteria:**

**Given** I am logged in
**When** I access the dashboard
**Then** I see a 64px icon-only sidebar on the left
**And** the main content area displays the prompt feed
**And** the header shows my name, avatar, and team switcher

**Given** the sidebar navigation
**When** I click icons
**Then** I can navigate to: Feed, Analytics, Team, Projects, Settings
**And** the current section is highlighted

**Given** the UX design specs
**When** the dashboard is styled
**Then** it uses dark mode (#0a0a0a background)
**And** follows the shadcn/ui + Tailwind patterns

---

### Story 6.2: Prompt Feed with Real-time Updates

**As a** user,
**I want** to see my prompts in a real-time feed,
**So that** new prompts appear without refreshing.

**Acceptance Criteria:**

**Given** I am on the feed page
**When** the page loads
**Then** I see my team's prompts sorted by newest first
**And** each prompt shows: timestamp, score badge, truncated text, analysis status

**Given** a new prompt is captured
**When** it's inserted in the database
**Then** Supabase Realtime pushes the update
**And** the new prompt appears at the top of my feed
**And** no page refresh is needed

**Given** an analysis completes
**When** the status updates
**Then** the prompt card updates from "Analyzing..." to showing the score
**And** the transition is smooth

---

### Story 6.3: Feed Filtering & Search

**As a** user,
**I want** to filter and search my prompts,
**So that** I can find specific prompts quickly.

**Acceptance Criteria:**

**Given** filter controls above the feed
**When** I select filters
**Then** I can filter by: user (team leads), project, date range, score range

**Given** I apply a filter
**When** the filter is active
**Then** the feed updates instantly (client-side with TanStack Query)
**And** filter chips show active filters
**And** I can clear individual filters or all filters

**Given** I type in the search box
**When** I press Enter or wait 500ms
**Then** prompts are filtered by text content
**And** search highlights matching text

**Given** I close and reopen the dashboard
**When** I return
**Then** my last-used filters are preserved (localStorage)

---

### Story 6.4: Prompt Detail View

**As a** user,
**I want** to see detailed analysis for a prompt,
**So that** I understand my scores and how to improve.

**Acceptance Criteria:**

**Given** I click on a prompt in the feed
**When** the detail view opens
**Then** I see the full prompt text
**And** the overall score prominently displayed
**And** a breakdown of all 5 dimension scores with bars

**Given** the dimension breakdown
**When** I view each dimension
**Then** I see: dimension name, score (1-10), visual bar, specific suggestion

**Given** the suggestions
**When** they are displayed
**Then** they use coaching-positive language
**And** they reference specific parts of my prompt

**Given** I want to return to the feed
**When** I click back or press Escape
**Then** I return to the feed at my previous scroll position

---

### Story 6.5: Score Display & Team Comparison

**As a** user,
**I want** to see how my scores compare to the team,
**So that** I understand my relative performance.

**Acceptance Criteria:**

**Given** a prompt's score display
**When** I view it
**Then** I see my score and the team average for that time period
**And** an indicator shows if I'm above/below/at average

**Given** the score badge component
**When** displaying scores
**Then** colors indicate quality: Teal (7-10), Amber (4-6), Coral (1-3)
**And** the badge is circular with the score number

**Given** team average calculation
**When** computed
**Then** it's calculated from all team prompts in the same time window
**And** it updates as new prompts come in

---

### Story 6.6: Personal Analytics & Trends

**As a** user,
**I want** to track my prompting improvement over time,
**So that** I can see my progress.

**Acceptance Criteria:**

**Given** I navigate to the Analytics section
**When** the page loads
**Then** I see my score trend chart (last 30 days)
**And** summary stats: total prompts, average score, improvement

**Given** the trend chart
**When** displayed
**Then** it shows daily average scores as a line chart
**And** trend direction is indicated (up/down/stable)
**And** I can hover for daily details

**Given** dimension-level analytics
**When** I view them
**Then** I see which dimensions I score highest/lowest
**And** specific improvement suggestions for weak areas

---

### Story 6.7: Team Analytics (Team Leads)

**As a** team lead,
**I want** to see team-wide analytics,
**So that** I can identify coaching opportunities.

**Acceptance Criteria:**

**Given** I am a team admin
**When** I view Team Analytics
**Then** I see team-wide score distribution
**And** trends over time for the whole team
**And** per-member breakdown (average scores)

**Given** the per-member view
**When** I click on a team member
**Then** I see their recent prompts and patterns
**And** I can identify specific coaching opportunities

**Given** I am a regular team member
**When** I try to access Team Analytics
**Then** I see only aggregated team stats (not individual member data)

---

### Story 6.8: Onboarding Checklist

**As a** new user,
**I want** to see a setup checklist,
**So that** I know what steps remain to start using Contextor.

**Acceptance Criteria:**

**Given** I am a new user
**When** I first access the dashboard
**Then** I see an onboarding checklist with steps: Create Team, Create Project, Install CLI, Capture First Prompt

**Given** a checklist step is completed
**When** the system detects completion
**Then** the step is marked with a checkmark
**And** progress indicator updates

**Given** all steps are complete
**When** I dismiss the checklist
**Then** it disappears and doesn't return
**And** a congratulatory message is shown

---

### Story 6.9: Empty States & Guidance

**As a** user with no data,
**I want** helpful empty states,
**So that** I know how to get started.

**Acceptance Criteria:**

**Given** I have no projects
**When** I view the Projects page
**Then** I see "No projects yet" with a "Create Project" button

**Given** I have no prompts
**When** I view the Feed
**Then** I see "Waiting for your first prompt"
**And** installation instructions with copy-paste CLI command

**Given** an analysis is pending
**When** I view the prompt
**Then** I see "Analyzing..." with a spinner
**And** estimated time if available

**Given** an analysis failed
**When** I view the prompt
**Then** I see "Analysis failed" with option to retry

---

## Epic 7: Platform Administration ✅ COMPLETE

Super admins can manage users, teams, analysis configs, and monitor system health.

**FRs Covered:** FR46-FR50

**Status:** Complete (2025-12-21)
**Implementation:** `app/(dashboard)/admin/` - Admin dashboard, user management, team overview, config editor, system health
**Tests:** 122 E2E tests (admin-access, admin-dashboard, admin-users, admin-teams, admin-config, admin-system)
**Agent:** Claude Opus 4.5
**Notes:** Uses service role Supabase client for cross-team queries, `is_super_admin` flag for access control

**Design Refinement (2025-12-21):** Fixed navigation to use unified sidebar per UX spec. Admin items now appear below a divider in the main dashboard sidebar when user is super admin, rather than a separate AdminSidebar. This follows the UX principle "keep it flat and fast" and maintains the single 64px icon-only sidebar pattern.

---

### Story 7.1: Admin Access Control

**As a** platform operator,
**I want** restricted admin access,
**So that** only authorized users can manage the platform.

**Acceptance Criteria:**

**Given** a user with `is_super_admin = true`
**When** they access `/admin`
**Then** they see the admin dashboard

**Given** a user with `is_super_admin = false`
**When** they try to access `/admin`
**Then** they are redirected to `/dashboard`
**And** see "Access denied"

**Given** the middleware
**When** checking admin access
**Then** it queries `users.is_super_admin`
**And** caches the result for the session

---

### Story 7.2: Admin Dashboard Overview

**As a** super admin,
**I want** a dashboard with key metrics,
**So that** I can monitor platform health at a glance.

**Acceptance Criteria:**

**Given** I am on the admin dashboard
**When** the page loads
**Then** I see: total users, total teams, total prompts, prompts today

**Given** the metrics display
**When** viewing stats
**Then** I see trends compared to previous period
**And** real-time updates for active counts

**Given** system health indicators
**When** displayed
**Then** I see: analysis success rate, average analysis time, API error rate

---

### Story 7.3: User Management

**As a** super admin,
**I want** to manage user accounts,
**So that** I can handle support issues and enforce policies.

**Acceptance Criteria:**

**Given** I navigate to Admin > Users
**When** the page loads
**Then** I see a paginated list of all users
**And** search/filter by email, name, status

**Given** I click on a user
**When** viewing their details
**Then** I see: email, teams, prompts count, last active, account status

**Given** I click "Disable Account"
**When** I confirm the action
**Then** the user can no longer log in
**And** their data is preserved but inaccessible

**Given** I click "Delete Account"
**When** I confirm with extra verification
**Then** the user account is deleted
**And** their data is anonymized or deleted per retention policy

---

### Story 7.4: Team Overview

**As a** super admin,
**I want** to see all teams,
**So that** I can understand platform usage.

**Acceptance Criteria:**

**Given** I navigate to Admin > Teams
**When** the page loads
**Then** I see all teams with: name, member count, project count, prompts count

**Given** I click on a team
**When** viewing details
**Then** I see team members and their roles
**And** I can view (but not modify) team settings

---

### Story 7.5: Analysis Config Editor

**As a** super admin,
**I want** to edit analysis configurations,
**So that** I can tune the AI scoring system.

**Acceptance Criteria:**

**Given** I navigate to Admin > Analysis Config
**When** the page loads
**Then** I see all config versions with status (active/inactive)

**Given** I click "Create New Version"
**When** the form opens
**Then** I can set: version name, system prompt, AI model
**And** I can add/edit/remove dimensions with: name, weight, prompt template, scoring criteria

**Given** I save a new config
**When** it's created
**Then** it's saved as inactive
**And** I can preview it on sample prompts

**Given** I click "Activate" on a config
**When** I confirm
**Then** the previous active config is deactivated
**And** new analyses use the new config
**And** existing analyses retain their original config_id

---

### Story 7.6: System Health Monitoring

**As a** super admin,
**I want** to monitor system health,
**So that** I can respond to issues quickly.

**Acceptance Criteria:**

**Given** I navigate to Admin > System
**When** the page loads
**Then** I see: API response times, database connections, Edge Function status

**Given** the analysis queue
**When** viewing status
**Then** I see: pending count, processing count, failed count (last 24h)

**Given** the dead letter queue
**When** viewing failed analyses
**Then** I see prompts that failed analysis after all retries
**And** I can trigger manual retry or dismiss

**Given** an alert condition
**When** thresholds are exceeded (e.g., >100 pending, >5% error rate)
**Then** the metric is highlighted in red
**And** details show recent error messages

---

## Epic 8: Marketing Landing Page ✅ COMPLETE

Public-facing landing page that introduces Contextor and drives signups.

**FRs Covered:** N/A (Marketing requirement added post-PRD)

**Status:** Complete (2025-12-21)
**Implementation:** `app/page.tsx` + `components/marketing/` - Navbar, Hero, Features, Footer
**Tests:** 14 E2E tests (landing-page.spec.ts)
**Agent:** Claude Opus 4.5
**Notes:** Root page serves landing for unauthenticated users, redirects to /prompts for authenticated users

---

### Story 8.1: Public Landing Page

**As a** visitor,
**I want** to see an attractive marketing landing page,
**So that** I understand what Contextor does and can sign up.

**Acceptance Criteria:**

**Given** I visit the root URL (`/`)
**When** I am not logged in
**Then** I see the marketing landing page with navigation, hero section, features, and footer

**Given** I am on the landing page
**When** I click "Login" or "Sign Up"
**Then** I am navigated to `/login` or `/signup` respectively

**Given** I click "Get Started Free" CTA
**When** the click event fires
**Then** I am navigated to `/signup`

**Given** I am already logged in
**When** I visit the root URL (`/`)
**Then** I am redirected to `/prompts` (dashboard feed)

**Given** the hero section
**When** I view the page
**Then** I see headline "Your Context Tutor", subheadline, CTAs, and dashboard mockup preview

**Given** the features section
**When** I scroll down
**Then** I see 3 feature cards: Automatic Capture, AI-Powered Analysis, Team Insights

**Implementation Notes:**
- Create `app/(public)/` route group for marketing pages
- Use existing dark theme (#0a0a0a background)
- Use Lucide React icons (Sparkles, Zap, BrainCircuit, Users)
- Components: `components/marketing/{navbar,hero,features,footer}.tsx`

---

## Epic 9: Production Deployment & Infrastructure

Deploy Contextor to production with domain setup, CI/CD pipeline, and zero-downtime deployment strategy.

**INFs Covered:** INF-D1 to INF-D4, INF-C1 to INF-C5, INF-M1 to INF-M4

**Dependencies:** Epic 1-8 complete (all application features implemented)

**Infrastructure Targets:**
- **Hosting:** Google Cloud Run (containerized Next.js)
- **Database:** Supabase Cloud (Production project)
- **Domain:** contextor.co via Namecheap
- **CI/CD:** GitHub Actions

---

### Story 9.1: Supabase Production Project Setup

**As a** platform operator,
**I want** to set up a production Supabase project,
**So that** user data is stored securely in a managed cloud database.

**Acceptance Criteria:**

**Given** access to Supabase dashboard
**When** I create a new project
**Then** a new production project is created with a unique `project-ref`
**And** the project is in a production-suitable region (e.g., `us-east-1`)
**And** database connection strings are generated

**Given** the local migrations in `supabase/migrations/`
**When** I run `supabase link --project-ref <ref>` and `supabase db push`
**Then** all migrations are applied to production
**And** RLS policies are active
**And** all tables match local schema

**Given** the production database
**When** I configure Auth providers
**Then** Email/password auth is enabled
**And** Google OAuth is configured with production credentials
**And** Redirect URLs point to `https://contextor.co/*`

**Given** Edge Functions in `supabase/functions/`
**When** I run `supabase functions deploy`
**Then** the `analyze-prompt` function is deployed
**And** it can access production environment variables

**Technical Notes:**
- Create project at https://supabase.com/dashboard
- Store `SUPABASE_URL` and `SUPABASE_ANON_KEY` for Next.js
- Store `SUPABASE_SERVICE_ROLE_KEY` for admin operations (never expose to client)
- Configure email templates in Supabase Auth settings

---

### Story 9.2: Google Cloud Run Setup

**As a** platform operator,
**I want** to deploy the Next.js app to Google Cloud Run,
**So that** the application scales automatically and costs are usage-based.

**Acceptance Criteria:**

**Given** a Google Cloud project
**When** I enable required APIs
**Then** Cloud Run, Container Registry, and Cloud Build APIs are enabled

**Given** the Dockerfile in the project root
**When** I build and push the container
**Then** the image is stored in Google Container Registry (or Artifact Registry)
**And** the image tag follows semantic versioning

**Given** a Cloud Run service
**When** I create/deploy the service
**Then** it runs the Next.js container
**And** minimum instances = 0 (scale to zero for cost savings)
**And** maximum instances = 10 (MVP limit)
**And** memory = 512MB, CPU = 1

**Given** the service is deployed
**When** I test the default Cloud Run URL
**Then** the application loads correctly
**And** all API routes respond

**Dockerfile Requirements:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**Technical Notes:**
- Enable `output: 'standalone'` in next.config.ts
- Cloud Run service name: `contextor-web`
- Region: `us-central1` (or closest to users)

---

### Story 9.3: Domain & DNS Configuration (Namecheap)

**As a** platform operator,
**I want** to configure contextor.co to point to Cloud Run,
**So that** users access the app via a branded domain with SSL.

**Acceptance Criteria:**

**Given** the contextor.co domain in Namecheap
**When** I configure DNS records
**Then** the following records are set:
- `A` record for `@` → Cloud Run IP (or CNAME to Cloud Run domain)
- `CNAME` record for `www` → Cloud Run domain
- `CNAME` record for `api` → Cloud Run domain (if separate service)

**Given** Cloud Run domain mapping
**When** I map `contextor.co` to the Cloud Run service
**Then** Cloud Run provisions an SSL certificate automatically
**And** HTTPS is enforced for all traffic
**And** HTTP redirects to HTTPS

**Given** DNS propagation
**When** I verify the setup
**Then** `https://contextor.co` loads the application
**And** `https://www.contextor.co` redirects to `https://contextor.co`
**And** SSL certificate shows valid

**Namecheap API Setup (Programmatic Management):**

**Given** Namecheap API credentials
**When** I configure API access
**Then** I have: API User, API Key, Whitelisted IP
**And** credentials are stored securely in GitHub Secrets

**Given** the need to update DNS programmatically
**When** I use the Namecheap API
**Then** I can create/update/delete DNS records via API
**And** this enables automated subdomain management

**Technical Notes:**
- Namecheap API: https://www.namecheap.com/support/api/
- Cloud Run custom domain: `gcloud run domain-mappings create`
- SSL is automatic with Cloud Run managed certificates
- Consider using Cloudflare as DNS for faster propagation (optional)

---

### Story 9.4: CI/CD Pipeline (GitHub Actions)

**As a** developer,
**I want** automated deployments on push to main,
**So that** code changes are deployed consistently and quickly.

**Acceptance Criteria:**

**Given** a push to the `main` branch
**When** the GitHub Action triggers
**Then** the following steps run:
1. Checkout code
2. Run linting and type checking
3. Run tests (unit + E2E)
4. Build Docker image
5. Push to Container Registry
6. Deploy to Cloud Run

**Given** a pull request
**When** the PR is opened or updated
**Then** only steps 1-3 run (no deployment)
**And** status checks report pass/fail

**Given** deployment to Cloud Run
**When** the new revision is deployed
**Then** traffic shifts gradually (canary deployment)
**And** health checks pass before full traffic shift
**And** old revision is kept for rollback

**Given** a deployment failure
**When** health checks fail
**Then** the deployment is rolled back automatically
**And** the team is notified via GitHub notification

**GitHub Actions Workflow:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker
      - run: docker build -t gcr.io/$PROJECT_ID/contextor:$GITHUB_SHA .
      - run: docker push gcr.io/$PROJECT_ID/contextor:$GITHUB_SHA
      - run: |
          gcloud run deploy contextor-web \
            --image gcr.io/$PROJECT_ID/contextor:$GITHUB_SHA \
            --region us-central1 \
            --platform managed
```

**Technical Notes:**
- Create GCP service account with Cloud Run Admin role
- Store service account JSON as `GCP_SA_KEY` secret
- Add deployment status badge to README

---

### Story 9.5: Environment & Secrets Management

**As a** platform operator,
**I want** secure environment variable management,
**So that** secrets are never exposed in code or logs.

**Acceptance Criteria:**

**Given** production secrets
**When** they are configured
**Then** the following are stored in Cloud Run secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`
- `OPENAI_API_KEY` (for analysis)
- `RESEND_API_KEY` (for emails, post-MVP)

**Given** Cloud Run service
**When** secrets are attached
**Then** they are injected as environment variables at runtime
**And** they are not visible in container image
**And** they can be rotated without redeployment

**Given** build-time variables
**When** the Docker build runs
**Then** `NEXT_PUBLIC_*` variables are set via build args
**And** they are baked into the client bundle
**And** they do NOT contain secrets

**Given** local development
**When** `.env.local` is used
**Then** it contains local Supabase credentials
**And** it is in `.gitignore`
**And** `.env.example` documents required variables

**Environment Variable Documentation:**
```
# .env.example
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Rate Limiting (Upstash)
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=xxx

# AI Analysis
OPENAI_API_KEY=sk-...

# Email (optional, post-MVP)
RESEND_API_KEY=re_...
```

**Technical Notes:**
- Use `gcloud run services update --set-secrets` for secret management
- Never log environment variables
- Rotate keys periodically (quarterly minimum)

---

### Story 9.6: Zero-Downtime Deployment Strategy

**As a** platform operator,
**I want** deployments with zero downtime,
**So that** users aren't disrupted during updates.

**Acceptance Criteria:**

**Given** a new deployment
**When** Cloud Run deploys a new revision
**Then** traffic is gradually shifted (canary pattern)
**And** the old revision continues serving requests
**And** new revision must pass health checks before receiving traffic

**Given** the `/api/health` endpoint
**When** Cloud Run performs health checks
**Then** the endpoint returns HTTP 200 with `{ status: 'ok' }`
**And** checks include: database connectivity, basic app functionality

**Given** a database migration
**When** schema changes are needed
**Then** migrations are applied BEFORE deployment
**And** only additive changes are made (new columns, new tables)
**And** destructive changes (drops, renames) are deferred

**Given** a breaking migration is required
**When** the change cannot be additive
**Then** the multi-phase migration pattern is used:
1. Add new structure (deploy code that writes to both)
2. Migrate data
3. Deploy code that reads from new structure
4. Remove old structure (much later)

**Given** a deployment failure
**When** health checks fail for the new revision
**Then** traffic remains on the old revision
**And** the failed revision is marked unhealthy
**And** rollback is automatic (no manual intervention)

**Rollback Procedure:**
```bash
# List revisions
gcloud run revisions list --service contextor-web

# Rollback to previous revision
gcloud run services update-traffic contextor-web \
  --to-revisions=contextor-web-xxxxx=100
```

**Health Check Endpoint:**
```typescript
// app/api/health/route.ts
export async function GET() {
  try {
    // Check database connectivity
    const supabase = createClient();
    await supabase.from('users').select('count').limit(1);

    return Response.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({
      status: 'error',
      error: 'Database connection failed'
    }, { status: 503 });
  }
}
```

**Technical Notes:**
- Cloud Run automatically handles rolling deployments
- Set `--min-instances=1` in production to avoid cold starts
- Consider maintenance window for major migrations

---

### Story 9.7: Monitoring & Health Checks

**As a** platform operator,
**I want** visibility into production health,
**So that** I can detect and respond to issues quickly.

**Acceptance Criteria:**

**Given** the production deployment
**When** I access Google Cloud Console
**Then** I can see Cloud Run metrics: request count, latency, error rate, CPU, memory

**Given** Supabase dashboard
**When** I access it
**Then** I can see: database connections, query performance, auth events, realtime connections

**Given** application logs
**When** errors occur
**Then** they are captured in Cloud Logging
**And** logs include: request ID, user ID (if authenticated), error stack trace
**And** logs follow the format: `[CONTEXT] action: details`

**Given** the need for uptime monitoring
**When** I configure external monitoring
**Then** a service (e.g., UptimeRobot, Checkly) pings `/api/health` every 5 minutes
**And** alerts are sent on failure via email/Slack

**Given** post-MVP observability needs
**When** traffic grows
**Then** consider adding:
- Sentry for error tracking (client + server)
- Cloud Monitoring alerts for latency/error thresholds
- Log-based metrics for business events

**Cloud Run Logging Integration:**
```typescript
// lib/utils/logger.ts
export function log(context: string, action: string, details?: object) {
  const entry = {
    severity: 'INFO',
    message: `[${context}] ${action}`,
    ...details,
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(entry));
}

export function error(context: string, action: string, err: Error) {
  const entry = {
    severity: 'ERROR',
    message: `[${context}] ${action}: ${err.message}`,
    stack: err.stack,
    timestamp: new Date().toISOString()
  };
  console.error(JSON.stringify(entry));
}
```

**Technical Notes:**
- Cloud Run logs are automatically sent to Cloud Logging
- Create log-based metrics for key events (signups, captures, analyses)
- Set up alerts for: error rate > 5%, latency P95 > 5s, 5xx responses

---

### Story 9.8: npm Package Publishing (@contextor/cli)

**As a** solo developer,
**I want** to publish the CLI package to npm,
**So that** users can install Contextor with `npx @contextor/cli init`.

**Acceptance Criteria:**

**Given** an npm account
**When** I set up the @contextor organization
**Then** the organization is created
**And** I can publish packages under @contextor scope

**Given** the CLI package in `packages/cli/`
**When** I publish to npm
**Then** the package is available as `@contextor/cli`
**And** users can run `npx @contextor/cli --version`

**Given** a new version is ready
**When** I create a GitHub release with a version tag
**Then** GitHub Actions automatically publishes to npm
**And** the version follows semantic versioning (e.g., 1.0.0)

**Given** the published package
**When** users view it on npm
**Then** they see a README with installation instructions
**And** the package has appropriate keywords and metadata

**Technical Notes:**
- Create npm organization: `contextor`
- Package name: `@contextor/cli`
- Trigger publish on GitHub release with tag `cli-vX.Y.Z`
- Use `NPM_TOKEN` secret in GitHub Actions

---

### Deployment Checklist

Before going live, verify:

**Infrastructure:**
- [ ] Supabase production project created and linked
- [ ] All migrations applied to production
- [ ] Edge Functions deployed
- [ ] Cloud Run service deployed and healthy
- [ ] Custom domain mapped with SSL
- [ ] DNS propagation complete

**Security:**
- [ ] All secrets stored in Cloud Run secrets (not env vars)
- [ ] Service account has minimal required permissions
- [ ] RLS policies verified in production
- [ ] No debug/development flags in production

**Monitoring:**
- [ ] Health check endpoint responding
- [ ] External uptime monitor configured
- [ ] Cloud Logging accessible
- [ ] Error notification channel configured

**Testing:**
- [ ] Smoke test: signup → create team → create project → capture prompt
- [ ] Load test: verify performance under expected traffic
- [ ] Failover test: verify rollback procedure works

**npm Package:**
- [ ] npm organization @contextor created
- [ ] @contextor/cli published and accessible
- [ ] `npx @contextor/cli --version` works
- [ ] Publish workflow tested

---

## Epic 10: Development Environment & Database Branching

Enable safe development workflow using Supabase branching with developer prompt mirroring for testing.

**Status:** Not Started (Created 2025-12-22)
**Priority:** High - Required for safe development and testing
**Automation:** All tasks achievable via CLI/API

**Approach:**
Instead of a full staging environment (separate Supabase project + Cloud Run service), use Supabase Branching:
- **Dev Branch:** Database branch from production for schema testing
- **Developer Mirroring:** Flagged developers' prompts auto-replicate to dev branch
- **Local Dev:** localhost:3050 connects to dev branch database
- **Deploy:** Merge branch + deploy container when ready

**Benefits:**
- Test migrations safely on branch before production
- Real prompt data flows to dev branch for testing
- No duplicate infrastructure costs
- Simpler workflow: local dev → deploy → merge branch

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│  PRODUCTION DATABASE                                             │
│                                                                  │
│  prompts table                                                   │
│       │                                                          │
│       ├── INSERT → Check: Is user.is_developer = true?          │
│       │       │                                                  │
│       │       ├── NO → Normal flow only                         │
│       │       │                                                  │
│       │       └── YES → Also replicate to dev branch            │
│       │                                                          │
└──────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
┌───────────────────┐                    ┌───────────────────────┐
│ Production DB     │                    │ Dev Branch DB         │
│ (all prompts)     │                    │ (developer prompts    │
│                   │                    │  mirrored here)       │
└───────────────────┘                    └───────────────────────┘
```

---

### Story 10.1: Supabase Branch Creation

**As a** developer,
**I want** a Supabase development branch,
**So that** I can test schema changes before production.

**Acceptance Criteria:**

**Given** the production Supabase project `ddskanjiobrjphscskog`
**When** I create a development branch
**Then** a new branch `dev` is created via CLI or dashboard
**And** it has its own connection string
**And** the schema matches production at creation time

**Given** the dev branch exists
**When** I make schema changes
**Then** they only affect the branch, not production
**And** I can merge changes to production when ready

**Given** Edge Functions
**When** deployed to the branch
**Then** they run against the branch database
**And** analysis works independently from production

**CLI Commands:**
```bash
# Create branch (requires Supabase Pro plan)
supabase branches create dev --project-ref ddskanjiobrjphscskog

# List branches
supabase branches list --project-ref ddskanjiobrjphscskog

# Get branch connection info
supabase branches get dev --project-ref ddskanjiobrjphscskog
```

**Note:** Supabase branching requires Pro plan (~$25/month). Branches cost ~$0.32/day when active.

---

### Story 10.2: Developer Flag on Users Table

**As a** superadmin,
**I want** a developer flag on user accounts,
**So that** I can identify which users' prompts should be mirrored to dev.

**Acceptance Criteria:**

**Given** the users table
**When** this story is complete
**Then** `is_developer` boolean column exists (default: false)
**And** only superadmins can modify this field (RLS policy)

**Given** the admin user management page
**When** a superadmin views a user
**Then** they see a "Developer Mode" toggle
**And** toggling it updates `is_developer` field

**Given** a user with `is_developer = true`
**When** they submit prompts
**Then** those prompts are marked for replication

**Migration:**
```sql
ALTER TABLE users ADD COLUMN is_developer BOOLEAN DEFAULT false;

-- RLS: Only superadmins can update is_developer
CREATE POLICY "Superadmins can update developer flag"
  ON users FOR UPDATE
  USING (is_super_admin = true)
  WITH CHECK (is_super_admin = true);
```

---

### Story 10.3: Prompt Replication to Dev Branch

**As a** developer,
**I want** my prompts replicated to the dev branch,
**So that** I can test the capture flow with real data.

**Acceptance Criteria:**

**Given** a prompt is captured from a developer user
**When** stored in production
**Then** it is also copied to the dev branch database
**And** analysis is triggered on the dev branch

**Given** the capture API route
**When** a prompt is stored
**Then** it checks if user `is_developer = true`
**And** if so, calls `replicateToDevBranch(promptId)`

**Given** the replication call
**When** it runs
**Then** it's fire-and-forget (doesn't block capture)
**And** failures are logged but don't fail the main request

**Implementation (API-level, more reliable than triggers):**
```typescript
// In app/api/prompts/capture/route.ts

// After successful storage
if (result.analysis_status === "pending") {
  void triggerAnalysis(result.id);
}

// Replicate for developers
if (await isUserDeveloper(userId)) {
  void replicateToDevBranch(result);
}

async function replicateToDevBranch(prompt: PromptRow): Promise<void> {
  const devBranchUrl = process.env.DEV_BRANCH_SUPABASE_URL;
  const devBranchKey = process.env.DEV_BRANCH_SERVICE_ROLE_KEY;

  if (!devBranchUrl || !devBranchKey) return;

  // Insert into dev branch
  await fetch(`${devBranchUrl}/rest/v1/prompts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${devBranchKey}`,
      "apikey": devBranchKey,
    },
    body: JSON.stringify(prompt),
  });
}
```

---

### Story 10.4: Admin UI for Developer Management

**As a** superadmin,
**I want** to toggle developer mode in the admin panel,
**So that** I can manage which users get prompt mirroring.

**Acceptance Criteria:**

**Given** I'm on Admin > Users page
**When** I view the user list
**Then** I see a "Dev" badge on developer users
**And** I can filter by "Developers only"

**Given** I click on a user
**When** viewing their details
**Then** I see a "Developer Mode" toggle switch
**And** it shows the current `is_developer` value

**Given** I toggle developer mode ON
**When** I save
**Then** `is_developer = true` for that user
**And** a toast confirms "Developer mode enabled"
**And** their future prompts will be mirrored

**Given** I toggle developer mode OFF
**When** I save
**Then** `is_developer = false`
**And** mirroring stops for future prompts

**UI Components:**
- Add `Switch` component to user detail view
- Add "Dev" badge to UserRow component
- Add filter option in user list header

---

### Story 10.5: Local Development Configuration

**As a** developer,
**I want** easy switching between production and dev branch,
**So that** I can test locally against the dev database.

**Acceptance Criteria:**

**Given** the `.env.local` file
**When** I want to use dev branch
**Then** I update `NEXT_PUBLIC_SUPABASE_URL` to dev branch URL
**And** I update `SUPABASE_SERVICE_ROLE_KEY` to dev branch key

**Given** the dev branch is active
**When** I run `npm run dev`
**Then** localhost:3050 connects to dev branch database
**And** I see prompts mirrored from production

**Given** I want to switch back to local Supabase
**When** I update env vars to local values
**Then** `npm run dev` uses local database again

**Environment Variables:**
```bash
# .env.local for dev branch
NEXT_PUBLIC_SUPABASE_URL=https://ddskanjiobrjphscskog-dev.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<dev-branch-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<dev-branch-service-role-key>

# Production environment variables (for reference)
# DEV_BRANCH_SUPABASE_URL=https://ddskanjiobrjphscskog-dev.supabase.co
# DEV_BRANCH_SERVICE_ROLE_KEY=<dev-branch-service-role-key>
```

---

### Story 10.6: Branch Merge and Deployment Workflow

**As a** developer,
**I want** a clear process to merge schema changes and deploy,
**So that** I can safely promote changes to production.

**Acceptance Criteria:**

**Given** schema changes tested on dev branch
**When** ready for production
**Then** I merge the branch to production via CLI/dashboard
**And** migrations are applied automatically

**Given** app code changes tested locally
**When** ready for production
**Then** I deploy the Docker image to Cloud Run
**And** verify health check passes

**Given** both schema and code are deployed
**When** complete
**Then** production uses new schema + new code
**And** dev branch can be reset or deleted

**Deployment Flow:**
```bash
# 1. Merge Supabase branch to production
supabase branches merge dev --project-ref ddskanjiobrjphscskog

# 2. Build and deploy app
docker build --platform linux/amd64 -t gcr.io/ideajetlab-website/contextor:vX.Y.Z .
docker push gcr.io/ideajetlab-website/contextor:vX.Y.Z
gcloud run deploy contextor-web --image gcr.io/ideajetlab-website/contextor:vX.Y.Z --region us-central1

# 3. Verify
curl https://contextor.co/api/health
```

---

### Implementation Checklist

**Supabase Branch:**
- [ ] Upgrade to Pro plan if needed
- [ ] Create `dev` branch from production
- [ ] Note branch connection strings
- [ ] Deploy Edge Functions to branch

**Database:**
- [ ] Add `is_developer` column to users table
- [ ] Add RLS policy for superadmin-only updates
- [ ] Test migration on dev branch first

**API:**
- [ ] Add `isUserDeveloper()` helper function
- [ ] Add `replicateToDevBranch()` function
- [ ] Add env vars: `DEV_BRANCH_SUPABASE_URL`, `DEV_BRANCH_SERVICE_ROLE_KEY`
- [ ] Update capture route to call replication

**Admin UI:**
- [ ] Add developer toggle to user detail page
- [ ] Add "Dev" badge to user list
- [ ] Add "Developers only" filter

**Testing:**
- [ ] Mark yourself as developer in admin panel
- [ ] Capture a prompt
- [ ] Verify prompt appears in dev branch
- [ ] Verify analysis runs on dev branch
- [ ] Test local dev against dev branch

---

## Epic 11: Bug Fixes & UX Polish ✅ COMPLETE

Fix critical bugs and UX issues discovered during production usage.

**Priority:** P0 (Critical)
**Status:** COMPLETE (2025-12-22)
**FRs Covered:** N/A (Post-MVP bug fixes and UX improvements)
**Agent:** Claude Opus 4.5 (4 parallel subagents)

**Context:** During production testing, several issues were discovered that affect core user experience. These need to be addressed before adding new features.

---

### Story 11.1: Fix Team Analysis Page Error

**As a** user viewing team analytics,
**I want** the Team Analysis page to load correctly,
**So that** I can see team-level insights without errors.

**Problem:** Team Analysis page shows "Failed to load team data" error.

**Root Cause Investigation:**
- Page location: `app/(dashboard)/team/page.tsx`
- Error comes from `useTeamMembers` hook calling `/api/teams/${teamId}/members`
- The API route at `app/api/teams/[teamId]/members/route.ts` joins `team_members` with `users` table
- Possible issues:
  1. RLS policy blocking access to `users` table
  2. Missing user records in `public.users` for some `auth.users`
  3. Team ID being undefined/null when passed

**Acceptance Criteria:**

**Given** I am logged in and have a team
**When** I navigate to the Team Analysis page
**Then** the page loads without errors
**And** I see team member data correctly

**Given** the API route
**When** debugging the error
**Then** check browser console and server logs for specific error
**And** fix the root cause (RLS, missing users, or team ID)

**Files to Check:**
- `app/app/(dashboard)/team/page.tsx:27` - where hook is called
- `app/lib/hooks/use-team-members.ts:21-30` - fetch function
- `app/app/api/teams/[teamId]/members/route.ts` - API route

**Effort:** Small (1-2 hours debugging + fix)

---

### Story 11.2: Debug Analytics Cards Data Display

**As a** user viewing my analytics dashboard,
**I want** all analytics cards to display data correctly,
**So that** I can see my average score, improvement percentage, and trends.

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

**Acceptance Criteria:**

**Given** I have captured prompts that were analyzed
**When** I view the Analytics dashboard
**Then** Average Score card shows my mean score
**And** Improvement % shows change from previous period
**And** Score Trend chart displays correctly

**Given** I have no analyzed prompts
**When** I view the Analytics dashboard
**Then** Cards show appropriate empty states or "No data yet" messages

**Files:**
- `app/lib/hooks/use-personal-analytics.ts` - data fetching
- `app/components/analytics/summary-stats.tsx` - card display
- `app/components/analytics/analytics-dashboard.tsx` - main component

**Debug Steps:**
1. Query database to verify data exists
2. Check if prompts have `analysis_status = 'complete'`
3. Verify `prompt_analyses` records exist with `overall_score`
4. Trace data flow from API to component

**Effort:** Small-Medium (2-4 hours debugging + fix)

---

### Story 11.3: Improve Team Invitations Discoverability

**As a** team admin,
**I want** to easily find and share team invitations,
**So that** I can onboard new team members quickly.

**Problem:** Team invitations feature exists but is poorly discoverable:
- Invite UI at: `/teams/[teamId]/settings` -> "Invitations" tab
- Link only visible to admins in "Quick Actions" card on home page
- No dedicated nav item for team settings

**Current Access Path (too hidden):**
1. Be on home page
2. Be an admin (card hidden otherwise)
3. See "Quick Actions" card
4. Click "Team Settings"
5. Navigate to "Invitations" tab

**Solution:** Implement BOTH improvements:

**Acceptance Criteria:**

**Part A: Add Team Settings to Navigation**

**Given** I am a team admin
**When** I view the sidebar navigation
**Then** I see a "Team Settings" or gear icon in the sidebar
**And** clicking it takes me to `/teams/[teamId]/settings`

**Given** I am a regular team member
**When** I view the sidebar
**Then** I see "Team Settings" but with limited access (view only, no invite)

**Part B: Add URL-Copy Invite Option**

**Given** I am a team admin on the Invitations tab
**When** I view the invite options
**Then** I see a "Copy Invite Link" button alongside email invite
**And** clicking it generates a shareable URL

**Given** I copy the invite link
**When** I share it with a colleague
**Then** they can click the link to join the team
**And** if not registered, they're prompted to sign up first
**And** link has configurable expiry (default 7 days)

**Given** the invite link database
**When** URL invites are stored
**Then** `team_invitations` table has `invite_type` column ('email' | 'link')
**And** `invite_token` is used for URL-based joins
**And** `max_uses` field allows multi-use links (optional)

**Files:**
- `app/app/(dashboard)/home/page.tsx:130-145` - Quick Actions card
- `app/app/(dashboard)/teams/[teamId]/settings/page.tsx` - Settings page
- `app/components/team-settings/invite-member-form.tsx` - Invite form
- `app/components/dashboard/sidebar.tsx` - Navigation sidebar

**Effort:** Medium (4-6 hours)

---

### Story 11.4: Add Google Analytics to Marketing Pages

**As a** product owner,
**I want** Google Analytics tracking on public marketing pages,
**So that** I can understand visitor behavior and marketing effectiveness.

**Requirement:** Add Google Tag Manager / Analytics to public marketing pages.

**Tracking ID:** `G-PPFJMVVMGD`

**Acceptance Criteria:**

**Given** the public landing page at `/`
**When** a visitor loads the page in production
**Then** Google Analytics script is loaded
**And** pageview is tracked

**Given** local development environment
**When** running `npm run dev`
**Then** GA script is NOT loaded (prevent test data)

**Given** the implementation
**When** reviewing code
**Then** tracking ID is stored in `NEXT_PUBLIC_GA_MEASUREMENT_ID` env var
**And** `next/script` is used with `strategy="afterInteractive"`
**And** script is added to public layout or root layout with environment check

**Implementation:**

```typescript
// app/components/analytics/google-analytics.tsx
'use client';

import Script from 'next/script';

export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (!gaId || process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
```

**Files:**
- `app/app/layout.tsx` or `app/app/(public)/layout.tsx`
- New: `app/components/analytics/google-analytics.tsx`

**Environment Variable:**
- Add `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-PPFJMVVMGD` to production env

**Effort:** Tiny (30 minutes)

---

## Epic 12: UX/UI Rework

**Status:** DEFERRED (needs detailed planning discussion)
**Priority:** P1

Major UX/UI overhaul to align with original HTML mockup design guidelines. During development, the HTML mockup design was largely ignored.

**Scope:** To be determined in dedicated planning session.

**Reference:** Check for HTML mockups in project (likely in `_bmad-output/` or design folder).

---

## Epic 13: Account Management

User self-service account management features.

**Priority:** P2
**Status:** Not Started (Created 2025-12-22)
**FRs Covered:** Extensions to FR4 (User profile management)

**Current State:**
- Display Name Edit: ✅ IMPLEMENTED (works in `/settings`)
- Avatar Upload: ✅ IMPLEMENTED (works in `/settings`)
- Delete Account: ❌ NOT IMPLEMENTED
- Email Change: ❌ NOT IMPLEMENTED
- Password Change: ❌ NOT IMPLEMENTED (only via reset link)

---

### Story 13.1: Account Deletion (Self-Service)

**As a** user,
**I want** to delete my account,
**So that** I can remove my data from the platform if I no longer use it.

**Acceptance Criteria:**

**Given** I am on the Settings page
**When** I scroll to the "Danger Zone" section
**Then** I see a "Delete Account" button with warning text

**Given** I click "Delete Account"
**When** the confirmation modal appears
**Then** I must type my email to confirm
**And** I see a warning about data deletion being permanent

**Given** I confirm account deletion
**When** the deletion processes
**Then** my `auth.users` entry is deleted
**And** my `public.users` entry is deleted
**And** my `team_members` entries are deleted
**And** my prompts are either anonymized or deleted (configurable)
**And** I am logged out and redirected to landing page

**Given** I am the last admin of a team
**When** I try to delete my account
**Then** I see "You must transfer admin role or delete the team first"
**And** deletion is blocked until resolved

**Files:**
- `app/app/(dashboard)/settings/page.tsx`
- New: `app/lib/api/account.ts` - account deletion server action
- `app/app/api/account/delete/route.ts` - API route (if needed)

**Database Considerations:**
- Use Supabase Auth `admin.deleteUser()` via service role
- Cascade delete or anonymize related records

**Effort:** Medium (3-4 hours)

---

### Story 13.2: Email Change

**As a** user,
**I want** to change my email address,
**So that** I can update my account if my email changes.

**Acceptance Criteria:**

**Given** I am on the Settings page
**When** I view my profile section
**Then** I see my current email with an "Edit" button

**Given** I click edit on my email
**When** the email change form appears
**Then** I enter my new email address
**And** I must enter my current password to confirm

**Given** I submit a valid new email
**When** Supabase processes the request
**Then** a confirmation email is sent to the new address
**And** I see "Check your new email to confirm the change"

**Given** I click the confirmation link
**When** the email is verified
**Then** my email is updated in Supabase Auth
**And** my `users.email` is synced (if stored separately)
**And** I can log in with my new email

**Given** the new email is already in use
**When** I try to submit
**Then** I see "This email is already associated with another account"

**Files:**
- `app/app/(dashboard)/settings/page.tsx`
- `app/components/settings/profile-form.tsx`
- `app/lib/validations/profile.ts`

**Implementation:**
- Use Supabase `auth.updateUser({ email: newEmail })`
- Requires email confirmation by default

**Effort:** Small-Medium (2-3 hours)

---

### Story 13.3: Password Change (In-App)

**As a** user,
**I want** to change my password from settings,
**So that** I don't have to go through the reset flow to update my password.

**Acceptance Criteria:**

**Given** I am on the Settings page
**When** I view the Security section
**Then** I see a "Change Password" option

**Given** I click "Change Password"
**When** the password change form appears
**Then** I enter my current password
**And** I enter my new password (twice for confirmation)

**Given** I submit with correct current password
**When** the new password meets requirements (12+ chars, mixed case, number)
**Then** my password is updated
**And** I see "Password updated successfully"
**And** I remain logged in

**Given** I enter incorrect current password
**When** I submit the form
**Then** I see "Current password is incorrect"
**And** the password is not changed

**Given** my new password doesn't meet requirements
**When** I submit the form
**Then** I see specific validation errors
**And** the password is not changed

**Given** I registered via Google OAuth only
**When** I view the Security section
**Then** I see "Set Password" instead of "Change Password"
**And** I can set an initial password to enable email login

**Files:**
- `app/app/(dashboard)/settings/page.tsx`
- New: `app/components/settings/password-change-form.tsx`
- `app/lib/validations/password.ts` (update requirements)

**Implementation:**
- Use Supabase `auth.updateUser({ password: newPassword })`
- For OAuth-only users, this sets their first password

**Effort:** Small-Medium (2-3 hours)

---

## Epic 14: Documentation Section

In-app documentation and help section for authenticated users.

**Priority:** P2
**Status:** Not Started (Created 2025-12-22)
**FRs Covered:** N/A (Post-MVP enhancement)

---

### Story 14.1: Documentation Page Structure

**As a** user,
**I want** an in-app documentation section,
**So that** I can learn how to use Contextor without leaving the app.

**Acceptance Criteria:**

**Given** I am logged in
**When** I click the Help/Docs icon in the sidebar
**Then** I navigate to `/docs`
**And** I see a documentation landing page

**Given** the docs landing page
**When** I view it
**Then** I see a table of contents with sections:
  - Getting Started
  - CLI Installation
  - Understanding Scores
  - Team Management
  - FAQ

**Given** I click a section
**When** the content loads
**Then** I see markdown-rendered documentation
**And** navigation shows my current position

**Files:**
- New: `app/app/(dashboard)/docs/page.tsx`
- New: `app/app/(dashboard)/docs/[slug]/page.tsx`
- New: `app/components/docs/docs-sidebar.tsx`
- New: `app/content/docs/` (MDX files or content)

**Implementation Approach:**
- Use MDX or simple React components for content
- Start minimal with basic text, no screenshots
- Use existing shadcn/ui components for styling

**Effort:** Medium (4-6 hours for structure + initial content)

---

### Story 14.2: Core Documentation Content

**As a** new user,
**I want** documentation covering essential features,
**So that** I can get started quickly and understand the platform.

**Acceptance Criteria:**

**Given** the Getting Started section
**When** I read it
**Then** I understand the basic flow: signup → create team → create project → install CLI → capture prompts

**Given** the CLI Installation section
**When** I read it
**Then** I see step-by-step instructions with code snippets
**And** I understand the install token flow
**And** I see troubleshooting tips

**Given** the Understanding Scores section
**When** I read it
**Then** I understand the 5 dimensions (Clarity, Context, Specificity, Goal, Constraints)
**And** I understand the scoring scale (1-10)
**And** I see examples of good vs. improvable prompts

**Given** the Team Management section
**When** I read it
**Then** I understand roles (admin vs. member)
**And** I understand how to invite members
**And** I understand team switching

**Content Files:**
- `docs/getting-started.mdx`
- `docs/cli-installation.mdx`
- `docs/understanding-scores.mdx`
- `docs/team-management.mdx`
- `docs/faq.mdx`

**Effort:** Medium (3-4 hours for writing content)

---

### Story 14.3: Documentation Search (Future)

**As a** user,
**I want** to search the documentation,
**So that** I can quickly find answers to specific questions.

**Status:** Future enhancement (not MVP)

**Notes:**
- Can use simple client-side search (Fuse.js)
- Or integrate with Algolia DocSearch
- Low priority until docs content grows

---

### Implementation Checklist for Epic 11-14

**Epic 11 (P0 - Do First):**
- [ ] 11.1: Debug and fix Team Analysis page
- [ ] 11.2: Debug and fix Analytics cards data
- [ ] 11.3: Add Team Settings to sidebar + URL invite links
- [ ] 11.4: Add Google Analytics to marketing pages

**Epic 13 (P2):**
- [ ] 13.1: Account deletion with confirmation
- [ ] 13.2: Email change with verification
- [ ] 13.3: In-app password change

**Epic 14 (P2):**
- [ ] 14.1: Documentation page structure and navigation
- [ ] 14.2: Write core documentation content

**Epic 12 (Deferred):**
- [ ] Schedule detailed UX/UI planning session with Edgars

---

# Phase 2 Epics (Advanced Features)

The following epics extend Contextor with advanced capabilities including response capture, session intelligence, real-time coaching, and a VS Code extension.

---

## Epic 14.5: Privacy & Security Enhancements

**Goal:** Provide robust privacy controls and local data protection before prompts leave the user's machine.

**Business Value:** Enterprise customers require confidence that sensitive data (API keys, credentials, personal info) never leaves their environment unredacted. This epic establishes trust and enables adoption in security-conscious organizations.

**FRs Covered:** Enhanced security beyond MVP requirements

**Stories:**
- **14.5-1:** Local Redaction Engine - Enhanced pattern matching for secrets, credentials, file paths
- **14.5-2:** Privacy Consent Dialog - First-run consent flow explaining data handling
- **14.5-3:** User Privacy Controls - Settings page for redaction preferences
- **14.5-4:** Column-Level Encryption - Encrypt sensitive fields in database
- **14.5-5:** Data Minimization Pipeline - Automatic data retention and cleanup
- **14.5-6:** Privacy Preferences Database - Store user preferences and consent records

---

## Epic 15: Response Capture & Context Extraction

**Goal:** Capture Claude's responses alongside prompts to enable full conversation analysis.

**Business Value:** Understanding prompt quality requires seeing the responses. This enables "before/after" coaching, response quality metrics, and understanding which prompts lead to successful outcomes.

**FRs Covered:** Response context for enhanced analytics

**Stories:**
- **15-1:** Transcript File Discovery - Locate Claude Code JSONL transcript files
- **15-2:** JSONL Parser Implementation - Parse Claude Code transcript format
- **15-3:** User Message Extraction - Extract user prompts from transcripts
- **15-4:** Assistant Response Extraction - Extract Claude's responses
- **15-5:** Prompt-Response Pairing - Match prompts with their corresponding responses
- **15-6:** Response Storage Schema - Database schema for storing responses
- **15-7:** Tool Execution Capture - Capture tool usage patterns from transcripts

---

## Epic 16: Session Management

**Goal:** Group prompts into sessions for conversation-level analytics.

**Business Value:** Developers work in sessions, not individual prompts. Session tracking enables workflow analysis, context exhaustion detection, and understanding how developers interact with Claude over time.

**FRs Covered:** Session-level analytics and tracking

**Stories:**
- **16-1:** Sessions Database Schema - Tables and relationships for session tracking
- **16-2:** Session Detection Logic - Identify session boundaries from transcripts
- **16-3:** Session Metadata Capture - Git branch, Claude version, working directory
- **16-4:** Conversation Threading - Link related prompts within sessions
- **16-5:** Multi-Terminal Awareness - Handle multiple simultaneous Claude instances
- **16-6:** Session Duration Calculation - Track active time vs wall clock time

---

## Epic 17: Transcript Import Experience

**Goal:** Allow users to import historical Claude Code transcripts into Contextor.

**Business Value:** Users have existing conversation history. Import allows retroactive analysis and immediate value from day one, rather than starting from zero.

**FRs Covered:** Historical data import and analysis

**Stories:**
- **17-1:** Transcript Discovery Service - Find all Claude Code transcripts
- **17-2:** Import Preview UI - Show what will be imported with estimates
- **17-3:** Batch Import Processing - Process large transcript sets efficiently
- **17-4:** Deduplication Logic - Avoid importing already-captured prompts
- **17-5:** Import Progress Tracking - Show import status in real-time
- **17-6:** Import History & Rollback - Track imports and allow reverting

---

## Epic 18: Session Recovery ✅ COMPLETED (2025-12-24)

**Goal:** Detect interrupted Claude Code sessions and help users resume their work.

**Business Value:** Sessions crash, contexts get lost. Offering "pick up where you left off" functionality reduces friction and demonstrates intelligent awareness of the developer's workflow.

**FRs Covered:** Session continuity and recovery assistance

**Stories:**
- **18-1:** ✅ Interrupted Session Detection - CrashDetector service with streaming JSONL parsing, 34 tests
- **18-2:** ✅ Session State Snapshot - SnapshotBuilder + SnapshotStore with 88 tests
- **18-3:** ✅ Recovery Prompt Generator - AI-powered prompts with fallback, API endpoint, 58 tests
- **18-4:** ✅ Recovery Notification UI - Toast notifications, dismissal tracking, recovery panel, 70 tests
- **18-5:** ✅ One-Click Resume - Clipboard copy, fallback modal, analytics, 100 tests

**Total: 350+ unit tests**

---

## Epic 19: VS Code Extension

**Goal:** Bring Contextor analytics directly into the developer's IDE.

**Business Value:** Developers live in VS Code. An extension provides immediate, in-context feedback without leaving their workflow. This is the primary interface for real-time coaching features.

**FRs Covered:** IDE integration for developer experience

**Stories:**
- **19-1:** Extension Scaffold - TypeScript VS Code extension project setup
- **19-2:** Authentication Flow - Securely connect extension to Contextor account
- **19-3:** Sidebar Panel - Dedicated view for Contextor analytics
- **19-4:** Real-time Analytics Display - Live session and prompt metrics
- **19-5:** Quick Coaching Tips - Contextual suggestions in sidebar
- **19-6:** Extension Settings - Configure coaching preferences
- **19-7:** Marketplace Publishing - Publish to VS Code marketplace

---

## Epic 20: Real-time Coaching

**Goal:** Provide instant feedback on prompts before they're sent to Claude.

**Business Value:** The most impactful coaching happens in the moment. Catching a vague prompt before it wastes tokens is more valuable than analyzing it after the fact.

**FRs Covered:** Proactive prompt improvement

**Stories:**
- **20-1:** Blocking Hook Implementation - Intercept prompts before submission
- **20-2:** Fast Heuristics Engine - Sub-100ms analysis for common issues
- **20-3:** Improvement Suggestions Display - Show suggestions in VS Code
- **20-4:** User Override Flow - Allow proceeding despite suggestions
- **20-5:** Coaching Preferences - Configure sensitivity and categories

---

## Epic 21: Advanced Analytics

**Goal:** Provide deep insights into developer-AI interaction patterns.

**Business Value:** Beyond basic scoring, teams want to understand work styles, sentiment, learning progression, and workflow efficiency. This enables data-driven coaching and team improvement.

**FRs Covered:** Advanced metrics and intelligence

**Stories:**
- **21-1:** Context Window Management - Detect and warn about context exhaustion
- **21-2:** Work Style Categorization - Classify interaction patterns
- **21-3:** Sentiment Analysis - Detect frustration, confusion, satisfaction
- **21-4:** Prompt Complexity Metrics - Measure prompt sophistication
- **21-5:** Interaction Timing Analysis - Analyze response time patterns
- **21-6:** Tool Usage Profiling - Track which tools developers leverage
- **21-7:** Session Health Score - Overall session quality metric
- **21-8:** Technical Depth Profile - Measure technical sophistication
- **21-9:** Learning Progression Tracking - Track improvement over time
- **21-10:** Workflow Efficiency Metrics - Measure productivity patterns
- **21-11:** Interactive Insights Dashboard - Visualize advanced metrics
- **21-12:** Team Intelligence Analytics - Team-level pattern analysis

---

## Epic 22: Analysis Configuration & A/B Testing

**Goal:** Give admins control over analysis prompts, scoring weights, and enable experimentation.

**Business Value:** Different teams have different needs. Configurable analysis and A/B testing allows optimizing the coaching engine for specific contexts and validating improvements with data.

**FRs Covered:** Admin configurability and experimentation

**Stories:**
- **22-1:** Analysis Prompt Templates - Create/edit LLM prompt templates
- **22-2:** Classification Rule Editor - Define prompt categorization rules
- **22-3:** Scoring Weight Configuration - Adjust dimension weights
- **22-4:** Team-Level Weight Overrides - Per-team scoring customization
- **22-5:** Configuration Version Control - Track config changes over time
- **22-6:** A/B Experiment Creation - Define experiments with variants
- **22-7:** A/B Traffic Splitting - Route users to experiment variants
- **22-8:** Statistical Significance Calculation - Determine experiment winners
- **22-9:** Experiment Results Dashboard - Visualize experiment outcomes
- **22-10:** Configuration Audit Trail - Full audit log for all changes

---

## Epic 23: VS Code Extension Improvements ✅ COMPLETED (2025-12-25)

**Goal:** Enhance the VS Code extension with better navigation, workspace detection, and BMAD integration.

**Business Value:** Improved developer experience within the IDE, reducing context switches to web dashboard. Better onboarding flow for new projects and seamless BMAD document access.

**FRs Covered:** FR55-FR65 (CLI/Installation), IDE integration

**Stories:**
- **23-1:** Two-Level Navigation - Primary tabs (Contextor | BMAD) with secondary tab pages
- **23-2:** Tab Memory Per Section - Remember last active tab within each primary section
- **23-3:** Collapsible Status Panel - Expandable categories for epic/story grouping
- **23-4:** Workspace Installation Detection - Check for Contextor and BMAD installation state
- **23-5:** Register Project Flow - Register project with team selection via QuickPick
- **23-6:** Install BMAD Button - Terminal automation for BMAD installation
- **23-7:** BMAD Documents Panel - File tree viewer for project documentation
- **23-8:** Smart Project Documents - Sub-tabs (All/Workflow/Project) with missing doc detection and one-click creation

---

### Phase 2 Implementation Checklist

**Epic 14.5 (P1 - Security First):**
- [ ] 14.5-1: Local Redaction Engine
- [ ] 14.5-2: Privacy Consent Dialog
- [ ] 14.5-3: User Privacy Controls
- [ ] 14.5-4: Column-Level Encryption
- [ ] 14.5-5: Data Minimization Pipeline
- [ ] 14.5-6: Privacy Preferences Database

**Epic 15 (P1 - Response Capture):**
- [ ] 15-1: Transcript File Discovery
- [ ] 15-2: JSONL Parser Implementation
- [ ] 15-3: User Message Extraction
- [ ] 15-4: Assistant Response Extraction
- [ ] 15-5: Prompt-Response Pairing
- [ ] 15-6: Response Storage Schema
- [ ] 15-7: Tool Execution Capture

**Epic 16 (P1 - Sessions):**
- [ ] 16-1: Sessions Database Schema
- [ ] 16-2: Session Detection Logic
- [ ] 16-3: Session Metadata Capture
- [ ] 16-4: Conversation Threading
- [ ] 16-5: Multi-Terminal Awareness
- [ ] 16-6: Session Duration Calculation

**Epic 17 (P2 - Import):**
- [ ] 17-1: Transcript Discovery Service
- [ ] 17-2: Import Preview UI
- [ ] 17-3: Batch Import Processing
- [ ] 17-4: Deduplication Logic
- [ ] 17-5: Import Progress Tracking
- [ ] 17-6: Import History & Rollback

**Epic 18 (P2 - Recovery):** ✅ COMPLETED
- [x] 18-1: Interrupted Session Detection
- [x] 18-2: Session State Snapshot
- [x] 18-3: Recovery Prompt Generator
- [x] 18-4: Recovery Notification UI
- [x] 18-5: One-Click Resume

**Epic 19 (P1 - VS Code Extension):**
- [ ] 19-1: Extension Scaffold
- [ ] 19-2: Authentication Flow
- [ ] 19-3: Sidebar Panel
- [ ] 19-4: Real-time Analytics Display
- [ ] 19-5: Quick Coaching Tips
- [ ] 19-6: Extension Settings
- [ ] 19-7: Marketplace Publishing

**Epic 20 (P1 - Real-time Coaching):**
- [ ] 20-1: Blocking Hook Implementation
- [ ] 20-2: Fast Heuristics Engine
- [ ] 20-3: Improvement Suggestions Display
- [ ] 20-4: User Override Flow
- [ ] 20-5: Coaching Preferences

**Epic 21 (P2 - Advanced Analytics):**
- [ ] 21-1: Context Window Management
- [ ] 21-2: Work Style Categorization
- [ ] 21-3: Sentiment Analysis
- [ ] 21-4: Prompt Complexity Metrics
- [ ] 21-5: Interaction Timing Analysis
- [ ] 21-6: Tool Usage Profiling
- [ ] 21-7: Session Health Score
- [ ] 21-8: Technical Depth Profile
- [ ] 21-9: Learning Progression Tracking
- [ ] 21-10: Workflow Efficiency Metrics
- [ ] 21-11: Interactive Insights Dashboard
- [ ] 21-12: Team Intelligence Analytics

**Epic 22 (P3 - Config & A/B Testing):**
- [ ] 22-1: Analysis Prompt Templates
- [ ] 22-2: Classification Rule Editor
- [ ] 22-3: Scoring Weight Configuration
- [ ] 22-4: Team-Level Weight Overrides
- [ ] 22-5: Configuration Version Control
- [ ] 22-6: A/B Experiment Creation
- [ ] 22-7: A/B Traffic Splitting
- [ ] 22-8: Statistical Significance Calculation
- [ ] 22-9: Experiment Results Dashboard
- [ ] 22-10: Configuration Audit Trail

---

## Epic D: Phase 2 Design Foundation

**Goal:** Complete all UX/UI design work BEFORE implementation begins for Phase 2 features.

**Business Value:** Design-first development ensures consistent, polished user experience across all new features. By creating styled React components with mock data first, implementation becomes "filling in the logic" rather than "inventing UI on the fly." This prevents the UX debt accumulated in Phase 1.

**Scope:**
- Audit and document existing design system
- Polish and refactor existing Phase 1 UI
- Create styled component library for Phase 2 features
- Design all new screens for VS Code Extension, Advanced Analytics, Import/Recovery, and Admin Config

**Execution Model:** This epic MUST complete before any Phase 2 implementation epics begin. The deliverables are working React components with mock/placeholder data, not Figma files.

**Stories:**

- **D-1:** Design System Audit & Documentation
  - Audit existing Tailwind config, color tokens, typography
  - Document component inventory
  - Identify design debt and inconsistencies
  - Create `_bmad-output/design/design-system.md`

- **D-2:** Existing UI Refactoring & Polish
  - Apply design tokens consistently across Phase 1 UI
  - Polish dashboard, forms, cards, tables
  - Fix accessibility issues (contrast, focus states, ARIA)
  - Ensure responsive behavior on tablet/mobile

- **D-3:** Component Library Expansion
  - Create chart components (line, bar, gauge, sparkline, heatmap)
  - Create advanced form components (rule editor, weight slider, JSON editor)
  - Create import/recovery components (file tree, progress bar, recovery banner)
  - Create VS Code webview components
  - Set up component documentation (Storybook or /design route)

- **D-4:** VS Code Extension UI Design
  - Design sidebar panel layout with tabs
  - Design analytics panel (session health, recent prompts)
  - Design coaching panel (suggestions, dismiss/apply)
  - Design settings panel (auth, preferences)
  - Support dark and light VS Code themes

- **D-5:** Import & Recovery UI Design
  - Design transcript browser and file tree
  - Design import preview and progress
  - Design recovery banner and session snapshot
  - Design import history with rollback

- **D-6:** Advanced Analytics Dashboard Design
  - Design analytics page layout with filters
  - Design all 12 metric visualizations (Epic 21)
  - Design personal and team views
  - Design interactive drill-down patterns

- **D-7:** Admin Configuration & A/B Testing UI Design
  - Design prompt template editor with syntax highlighting
  - Design weight configuration sliders
  - Design A/B experiment creator and results dashboard
  - Design audit trail and version history

---

### Epic D Implementation Checklist

**Epic D (P0 - Design First):**
- [ ] D-1: Design System Audit & Documentation
- [ ] D-2: Existing UI Refactoring & Polish
- [ ] D-3: Component Library Expansion
- [ ] D-4: VS Code Extension UI Design
- [ ] D-5: Import & Recovery UI Design
- [ ] D-6: Advanced Analytics Dashboard Design
- [ ] D-7: Admin Configuration & A/B Testing UI Design

---

### Phase 2 Execution Order

**Important:** Epic D must complete before implementation epics begin.

```
┌─────────────────────────────────────────────────────────────────┐
│                    DESIGN PHASE (Epic D)                        │
│  D-1 → D-2 → D-3 ─┬─→ D-4 (VS Code)                            │
│                   ├─→ D-5 (Import/Recovery)                     │
│                   ├─→ D-6 (Analytics)                           │
│                   └─→ D-7 (Admin Config)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 IMPLEMENTATION PHASE                             │
│  Backend (14.5, 15, 16) can start in parallel with late design  │
│  UI epics (17, 18, 19, 20, 21, 22) wait for relevant D-x story  │
└─────────────────────────────────────────────────────────────────┘
```

**Parallel Work During Design Phase:**
- Epic 14.5 (Privacy/Security) - backend-only, can proceed
- Epic 15 (Response Capture) - backend-only, can proceed
- Epic 16 (Session Management) - backend-only, can proceed

**Blocked Until Design Complete:**
- Epic 17 (Import) - blocked by D-5
- Epic 18 (Recovery) - blocked by D-5
- Epic 19 (VS Code Extension) - blocked by D-4
- Epic 20 (Real-time Coaching) - blocked by D-4
- Epic 21 (Advanced Analytics) - blocked by D-6
- Epic 22 (Config & A/B) - blocked by D-7
