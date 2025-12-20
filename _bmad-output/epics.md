---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - '_bmad-output/prd.md'
  - '_bmad-output/architecture.md'
  - '_bmad-output/ux-design-specification.md'
  - '_bmad-output/project-context.md'
project_name: 'contextor'
user_name: 'Edgars'
date: '2025-12-20'
status: 'complete'
validation_results:
  fr_coverage: '75/75 (100%)'
  architecture_compliance: 'PASS'
  story_quality: 'PASS'
  dependency_validation: 'PASS'
total_epics: 7
total_stories: 48
---

# Contextor - Epic Breakdown

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

### Epic 1: Project Foundation & Authentication
Users can register, login, and access the Contextor platform securely.
**FRs covered:** FR1-FR6, FR51-FR54

### Epic 2: Team & Project Management
Users can create teams, invite members, set roles, and register projects for tracking.
**FRs covered:** FR7-FR19

### Epic 3: CLI Installation Experience
Developers can install Contextor in their projects with a single command.
**FRs covered:** FR55-FR65, FR76

### Epic 4: Prompt Capture Pipeline
System captures prompts from Claude Code securely and queues them for analysis.
**FRs covered:** FR20-FR26, FR72

### Epic 5: AI Analysis Engine
System analyzes every prompt with 5-dimension scoring and actionable suggestions.
**FRs covered:** FR27-FR35, FR73-FR74

### Epic 6: Dashboard, Feed & Analytics
Users can view prompts with scores in a real-time dashboard and track improvement over time.
**FRs covered:** FR36-FR45, FR66-FR71

### Epic 7: Platform Administration
Super admins can manage users, teams, analysis configs, and monitor system health.
**FRs covered:** FR46-FR50

---

## Epic 1: Project Foundation & Authentication

Users can register, login, and access the Contextor platform securely.

**FRs Covered:** FR1-FR6, FR51-FR54

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

## Epic 2: Team & Project Management

Users can create teams, invite members, set roles, and register projects for tracking.

**FRs Covered:** FR7-FR19

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

## Epic 3: CLI Installation Experience

Developers can install Contextor in their projects with a single command.

**FRs Covered:** FR55-FR65, FR76

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

## Epic 7: Platform Administration

Super admins can manage users, teams, analysis configs, and monitor system health.

**FRs Covered:** FR46-FR50

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

