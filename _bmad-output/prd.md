---
stepsCompleted: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]
status: complete
prdScope: 'cloud-first-evolution'
inputDocuments:
  - 'docs/brainstorming/2025-12-18-initial-vision.md'
  - '_bmad-output/research/approach-evaluation.md'
  - '_bmad-output/specs/mvp-specification.md'
documentCounts:
  briefs: 0
  research: 1
  brainstorming: 1
  projectDocs: 0
  specs: 1
workflowType: 'prd'
lastStep: 4
project_name: 'contextor'
user_name: 'Edgars'
date: '2025-12-19'
---

# Product Requirements Document - Contextor

**Author:** Edgars
**Date:** 2025-12-19

---

## Executive Summary

Contextor transforms how development teams learn and improve their AI prompting skills. By capturing, analyzing, and providing feedback on prompts across the entire team, it creates a continuous learning loop that makes every developer better at AI-assisted development.

**The Problem:**
- Developers vary wildly in AI prompting effectiveness
- No visibility into how team members construct prompts
- Mistakes (poor context, security leaks) repeat across the team
- No systematic way to learn from the best prompters

**The Solution:**
A cloud-first SaaS platform that captures prompts from development tools, provides real-time security scanning, and delivers AI-powered coaching to improve prompt quality over time.

**The "Aha" Moments:**
1. "I can finally see how my team actually prompts AI" (visibility)
2. "It caught a leaked API key before it was committed" (safety)
3. "The AI coaching actually made me a better prompter" (improvement)
4. "I learned that technique from watching how Sarah prompts" (team learning)

### What Makes This Special

Contextor is the first tool that treats prompting as a **team skill to be developed**, not just an individual activity. By combining:
- **Automatic capture** from development tools (starting with Claude Code)
- **Security-first design** with secret redaction before storage
- **Encrypted cloud storage** for team collaboration
- **AI-powered analysis** for continuous improvement

It creates a feedback loop that has never existed in AI-assisted development.

## Project Classification

**Technical Type:** SaaS B2B Platform
**Domain:** Developer Productivity / AI Tooling
**Complexity:** Medium-High
**Project Context:** Greenfield - new cloud platform (building on working local MVP)

### Architecture Direction

- **Cloud-only storage** (Supabase) - no local SQLite needed
- **Multi-tenant** with Teams → Projects → Members hierarchy
- **Encryption at rest** for prompt data
- **Phase 1:** Claude Code + BMAD integration
- **Future:** Generic capture for any AI dev tool (Cursor, Lovable, Bolt.new, Chrome extension)

---

## Success Criteria

### User Success

**For Team Leads/Senior Devs:**
- Can see team members' prompts in real-time via dashboard
- Identify specific prompting issues causing junior devs to get stuck
- View AI-powered analysis breakdown for each prompt
- Track team's prompt quality scores over time
- Provide targeted feedback based on actual prompt data and analysis

**For Junior Devs:**
- Receive instant, actionable feedback on prompt quality
- Understand WHY their prompts aren't getting good results
- See specific improvement suggestions per dimension (context, clarity, etc.)
- Learn from the analysis to build better prompting habits
- Reduce "stuck" moments through better context engineering

**For Solo Devs:**
- Self-reflection on prompting patterns with objective scoring
- Identify personal blind spots via dimension breakdowns
- Track improvement over time with versioned analysis

### Business Success

| Milestone | Target | Validation |
|-----------|--------|------------|
| **Internal validation** | Works for own agency | Junior dev shows measurable improvement in prompt scores |
| **Reddit launch** | 50-100 active users | First month after public launch |
| **Organic growth** | Word-of-mouth signups | Users inviting teammates |
| **Paid tier validation** | Users willing to pay | Conversion when tier introduced |

### Technical Success

- **Real-time:** Prompts analyzed and scored within seconds of capture
- **Security:** Zero secrets stored (redaction working before cloud storage)
- **Flexibility:** Analysis dimensions editable without code deployment
- **Reliability:** 95%+ prompt capture rate without workflow disruption
- **Performance:** Dashboard loads in < 2 seconds, real-time updates

### Measurable Outcomes

1. **Prompt capture rate:** 95%+ of prompts successfully logged
2. **Analysis completion:** 99%+ prompts analyzed within 30 seconds
3. **Time to first insight:** < 5 minutes after install
4. **User retention:** 40%+ return after 7 days
5. **Prompt quality improvement:** Users show score improvement over 30 days

---

## Product Scope

### MVP - Minimum Viable Product

**1. User System**
- Email/password + Gmail OAuth (Supabase Auth)
- Teams with Admin/Member roles
- User can belong to multiple teams (seamless switching)
- Platform Super Admins for system administration

**2. Project Management**
- Register projects on Contextor install
- Link projects to teams
- Project-level access control
- User selects which team to associate project with

**3. Prompt Capture & Storage**
- Claude Code hook with cloud integration
- BMAD agent capture with cloud integration
- Secret redaction BEFORE cloud storage (done)
- Encrypted storage in Supabase
- Real-time sync to dashboard

**4. AI-Powered Analysis Engine (Core Feature)**
- Real-time analysis triggered on prompt capture
- Flexible dimension-based scoring:
  - Context Completeness (30%)
  - Clarity of Intent (25%)
  - Specificity (25%)
  - Security Awareness (10%)
  - Structure (10%)
- Full detailed breakdown per prompt
- Improvement suggestions per dimension
- Overall quality score (1-10)
- Versioned analysis (track which config produced which scores)
- Prompt templates for each dimension (editable)

**5. Dashboard**
- Real-time prompt feed (auto-updates via Supabase Realtime)
- View team's prompts with full analysis breakdown
- Filter by user, project, date, score
- Prompt quality trends over time
- Individual and team analytics

**6. Admin Panel**
- Platform Super Admin:
  - User/team management
  - System-wide analytics
  - Analysis configuration management
- Analysis Customization:
  - Add/edit/disable analysis dimensions
  - Edit prompt templates for analysis
  - Adjust dimension weights
  - Create new analysis versions
  - A/B test analysis configurations

**7. Security**
- Encryption at rest (Supabase)
- Secret redaction (10+ pattern types)
- HTTPS only
- Row-level security (users see only their team's data)

### Growth Features (Post-MVP)

**User Privacy & Control:**
- Privacy toggle: Users can hide exact prompt text from team, showing only analysis scores
- Privacy mode persists per-user across sessions

**Email Communications:**
- Welcome/milestone email after first 10 prompts captured
- Configurable weekly digest email with prompt activity summary
- Email preferences management (enable/disable notifications)

**Analysis Configuration:**
- Admin LLM model selection (choose between supported models)
- A/B testing for analysis config versions with traffic splitting
- A/B test results with score distributions and comparisons
- Token consumption tracking per user with cost estimates
- Admin dashboard for usage monitoring and cost projections

**Integrations & Extensions:**
- Chrome extension for web-based AI tools (Lovable, Bolt.new)
- Support for Cursor, Aider, other CLIs
- Export/API access to prompt data
- MCP server for prompt access via external LLMs

**Team Learning:**
- Learning from team patterns (show "how seniors prompt")
- Prompt templates/best practices library
- Comparison: "Your prompt vs high-scoring examples"
- Slack/Discord notifications for low-scoring prompts

### Vision (Future)

- Auto-improve prompts before sending to AI
- Prompt coaching AI agent (interactive improvement)
- Integration with more AI coding tools
- Enterprise features (SSO, audit logs, compliance)
- ML-based scoring (trained on outcome data)
- Team benchmarking and leaderboards

---

## User Journeys

### Journey 1: Edgars — The Team Lead Who Can Finally Help

Edgars runs a development agency where AI-assisted development is becoming essential. He's brought on a junior developer, Mārtiņš, who's eager but struggles with the BMAD method and context engineering. Every few days, Mārtiņš gets stuck — the AI gives him nonsensical code, or goes in circles, or misses obvious requirements. Edgars wants to help, but when Mārtiņš describes his problems, Edgars can only guess at what went wrong. "Show me your prompts" isn't practical when they're scattered across sessions.

One evening, frustrated after another derailed sprint, Edgars decides to build what he wishes existed — a way to see his team's prompts and understand where they're going wrong. He creates Contextor, installs it in the agency's projects, and invites Mārtiņš to his workspace.

The next morning, Edgars opens the Contextor dashboard before standup. He sees Mārtiņš's prompts from yesterday — and immediately spots the pattern. Mārtiņš keeps asking for "the whole feature" in single prompts, with no file references and vague requirements. The analysis scores confirm it: Context Completeness 3/10, Clarity 4/10. The AI suggestions are specific: "Consider referencing the existing auth.ts file" and "Break this into smaller steps: first the API endpoint, then the UI."

At standup, instead of vague advice like "give more context," Edgars can show Mārtiņš exactly what he means. He pulls up a high-scoring prompt from his own history: "See how I referenced three files and specified the error handling approach? That's why the AI gave me working code on the first try."

Within two weeks, Mārtiņš's average prompt score has climbed from 4.2 to 7.1. He's getting stuck less often. And Edgars has reclaimed the hours he used to spend debugging AI-generated confusion. He thinks: "Every agency using AI-assisted development needs this."

**Revealed Requirements:**
- Workspace creation and user invitation
- Real-time prompt visibility across workspace members
- AI analysis with specific, actionable feedback
- Historical prompt comparison (high-scoring vs low-scoring)
- Prompt score tracking over time
- Per-user analytics

---

### Journey 2: Mārtiņš — The Junior Dev Who Stops Getting Stuck

Mārtiņš joined Edgars' agency excited about AI-assisted development — it seemed like magic. But after a month, he's frustrated. The AI keeps giving him code that doesn't work, or misses obvious things, or contradicts itself. He feels like he's doing something wrong but doesn't know what.

When Edgars invites him to Contextor, Mārtiņš is initially nervous — does this mean he's being watched? But the first time he submits a prompt and sees the analysis appear, something clicks. The system scores his prompt 4/10 for Context Completeness and explains: "You asked to 'fix the bug' but didn't specify which bug, which file, or what the expected behavior should be."

He tries again, this time referencing the specific file, describing the bug, and stating what should happen instead. Score: 7/10. And the AI's response is... actually useful. For the first time, he understands the connection between prompt quality and result quality.

Over the next few weeks, Mārtiņš develops a new habit. Before sending any prompt, he mentally runs through the dimensions: "Did I give context? Is my intent clear? Am I being specific?" His scores climb steadily. When he gets stuck now, he checks his prompt score first — often, the analysis tells him exactly what's missing.

The breakthrough moment comes when Edgars shows him a comparison: "Look, your prompts last month versus now. You've gone from averaging 4.2 to 7.8. That's why you're shipping faster." Mārtiņš realizes he's not just getting better at using AI — he's developing a skill that will matter for his entire career.

**Revealed Requirements:**
- Non-threatening UX (not surveillance, but coaching)
- Instant feedback after each prompt
- Clear explanation of scores with improvement suggestions
- Before/after comparison for motivation
- Habit formation through consistent feedback loop
- **Privacy option:** Ability to hide exact prompt text from team while still sharing analysis scores (for learning without exposure anxiety)

---

### Journey 3: Sofia — The Solo Developer Seeking Self-Improvement

Sofia is a freelance developer who's been using Claude Code for six months. She's productive, but she suspects she could be better. Sometimes the AI nails it first try; other times she's in a frustrating back-and-forth for an hour. She doesn't know what makes the difference.

She discovers Contextor through a Reddit post about "prompt quality analysis" and signs up. She creates a workspace called "Freelance" — just for herself. After installing the hook in her current project, she works normally for a day.

That evening, she opens the dashboard and sees her prompts laid out with scores. A pattern jumps out immediately: her morning prompts score 7-8/10, but her late-night prompts drop to 4-5/10. The analysis shows she gets vaguer and more impatient as she gets tired — skipping file references, asking for "just fix it" instead of specifying the problem.

She sets a personal rule: no AI prompting after 9 PM unless she's above 6/10 on the score. She also notices another pattern — she rarely mentions her tech stack constraints, so the AI keeps suggesting solutions that don't fit her architecture. She starts a mental checklist: files, constraints, expected outcome.

A month later, her average prompt score has improved from 5.8 to 8.2, and her AI success rate (first-try solutions) has nearly doubled. She writes a blog post: "How I became a better developer by watching my own prompts."

**Revealed Requirements:**
- Solo workspace (single user)
- Pattern recognition across time/context
- Personal insights and trends
- Minimal friction (just install and forget, review when curious)
- Exportable data for personal analysis

---

### Journey 4: Platform Admin — Keeping the System Running

Alex is the technical co-founder of Contextor (working with Edgars). As the platform grows beyond internal use, Alex needs to manage the expanding user base and continuously improve the analysis quality.

Every morning, Alex checks the admin dashboard. Today there are 47 active workspaces with 156 users. Prompt volume has tripled since the Reddit launch. Alex looks at the analysis performance: 99.2% of prompts analyzed within 30 seconds, average analysis cost $0.003 per prompt — sustainable for now.

Alex notices that users in the "web development" projects consistently score lower on the "Security Awareness" dimension. This suggests an opportunity: maybe the security analysis prompt template needs web-specific patterns. Alex opens the analysis configuration, clones the current version to "1.1.0", and edits the security dimension's prompt template to include common web security antipatterns.

Before deploying globally, Alex enables A/B testing — 20% of new prompts will use v1.1.0. After a week, Alex reviews the results: the new version catches 40% more security issues without increasing false positives. Alex promotes v1.1.0 to 100% and archives v1.0.0.

Later that day, a user reports that their prompts aren't being captured. Alex checks the system logs, identifies a webhook timeout issue, and deploys a fix. The user is back online within an hour.

**Revealed Requirements:**
- Platform-wide analytics (users, workspaces, prompt volume)
- Analysis cost monitoring
- Analysis configuration versioning and editing
- A/B testing for analysis improvements
- System health monitoring
- User support tools (logs, debugging)

---

### Journey Requirements Summary

| Capability Area | Revealed By |
|-----------------|-------------|
| **Workspace & User Management** | All journeys |
| **Real-time Prompt Capture** | Edgars, Mārtiņš, Sofia |
| **AI Analysis Engine** | All journeys |
| **Dashboard & Analytics** | Edgars, Sofia, Alex |
| **Prompt Score Tracking Over Time** | Edgars, Mārtiņš, Sofia |
| **Analysis Configuration & Versioning** | Alex |
| **A/B Testing for Analysis** | Alex |
| **Platform Admin Tools** | Alex |
| **User Invitation & Roles** | Edgars |
| **Cross-user Prompt Visibility** | Edgars |

---

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Prompting as Team Skill Development**
Contextor pioneers the concept of treating AI prompting as a *team-level competency* rather than an individual activity. While prompt engineering resources exist, no current tool:
- Captures prompts across team members automatically
- Provides comparative visibility into prompting patterns
- Creates a feedback loop for collective improvement

**2. AI-Powered Prompt Coaching**
The analysis engine represents applied AI agents in developer tooling:
- Real-time scoring with actionable feedback
- Dimension-based analysis (Context, Clarity, Specificity, Security, Structure)
- Versioned analysis configurations for continuous improvement
- Learning from high-performing prompt patterns

**3. Development Tool Observability**
Extends the observability concept from infrastructure monitoring to AI-assisted development:
- Prompt capture as "development telemetry"
- Quality metrics tracking over time
- Pattern detection across sessions

### Market Context

Current landscape gaps:
- **Prompt libraries** (static, not personalized)
- **AI coding tools** (Claude Code, Cursor) have no prompt visibility
- **Team analytics tools** don't capture AI interaction quality
- **No existing solution** combines capture + analysis + team learning

### Validation Approach

| Innovation Aspect | Validation Method |
|-------------------|-------------------|
| Team skill development | Before/after prompt scores over 30 days |
| AI coaching effectiveness | User retention and improvement curves |
| Development observability | Capture rate (target: 95%+) |

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Privacy concerns (prompts are sensitive) | Secret redaction before storage, encryption at rest, clear data policies |
| Analysis quality | Versioned configs, A/B testing, user feedback loop |
| Adoption friction | Silent capture (no workflow change), value visible in minutes |

---

## SaaS B2B Specific Requirements

### Multi-Tenancy Model

**Hierarchy Structure:**
```
Platform
├── Super Admins (platform-wide access)
└── Teams (isolation boundary)
    ├── Team Admins
    ├── Team Members
    └── Projects (linked to team)
        └── Prompts (captured from projects)
```

**Tenant Isolation:**
- **Data isolation:** Row-Level Security (RLS) in Supabase
- **Users belong to multiple teams:** Seamless switching in dashboard
- **Projects scoped to teams:** Project registered on install, linked to selected team
- **Prompts inherit project's team:** No cross-team visibility unless explicitly shared

### Role-Based Access Control (RBAC) Matrix

| Role | View Own Prompts | View Team Prompts | Invite Members | Manage Team | Admin Panel | System Config |
|------|------------------|-------------------|----------------|-------------|-------------|---------------|
| **Member** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Team Admin** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Platform Super Admin** | ✅ | ✅ (all teams) | ✅ | ✅ | ✅ | ✅ |

### Subscription Tiers (MVP - Freemium Launch)

| Tier | Price | Limits | Features |
|------|-------|--------|----------|
| **Free** | $0 | 1 team, 3 members, 500 prompts/month | Basic analysis, 7-day history |
| **Team** | TBD | 10 members, 5000 prompts/month | Full analysis, 90-day history, export |
| **Enterprise** | TBD | Unlimited | SSO, audit logs, custom analysis, API access |

*Note: MVP launches with Free tier only. Paid tiers introduced after user validation.*

### Integration Architecture

**Phase 1 (MVP):**
| Integration | Method | Status |
|-------------|--------|--------|
| Claude Code | Shell hook (`UserPromptSubmit`) | ✅ Working |
| BMAD Agents | Native capture in agent rules | ✅ Working |

**Phase 2 (Growth):**
| Integration | Method | Priority |
|-------------|--------|----------|
| Cursor | Extension or config hook | High |
| Aider | CLI wrapper or hook | Medium |
| Chrome Extension | Content script for Lovable, Bolt.new | High |

**Integration Protocol:**
- All integrations call cloud endpoint: `POST /api/prompts/capture`
- Authentication via project API key (generated on install)
- Payload: `{ project_key, user_id, prompt_text, source, metadata }`

### Compliance & Security Requirements

| Requirement | Implementation | Priority |
|-------------|----------------|----------|
| **Data Encryption** | Supabase encryption at rest | MVP |
| **Secret Redaction** | Pre-storage regex patterns (10+ types) | ✅ Done |
| **HTTPS Only** | Enforce TLS for all endpoints | MVP |
| **Data Retention** | Configurable per tier (7/90/∞ days) | MVP |
| **Data Export** | GDPR-style export (Growth tier) | Post-MVP |
| **Audit Logs** | Admin action logging (Enterprise) | Post-MVP |
| **SOC 2** | Future consideration | Enterprise |

### Implementation Considerations

**Database Schema (Supabase):**
```
users → teams (many-to-many via team_members)
teams → projects (one-to-many)
projects → prompts (one-to-many)
prompts → analyses (one-to-many, versioned)
analysis_configs → versions (for A/B testing)
```

**Real-Time Features:**
- Supabase Realtime subscriptions for dashboard updates
- Prompt feed auto-updates when new prompts captured
- Analysis results pushed to connected clients

**API Key Management:**
- Project-level API keys generated on installation
- Keys stored hashed, displayed once at generation
- Revocation and rotation supported

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-Solving + Experience MVP
- Solve the core visibility problem (teams can't see each other's prompts)
- Deliver the key "aha moment" (instant feedback on prompt quality)
- Validate the hypothesis: "Teams that see prompt analysis improve faster"

**MVP Validation Goal:**
- Internal use first (Edgars' agency with Mārtiņš)
- Reddit launch for 50-100 external users
- Measure: User retention at 7 days, prompt score improvement over 30 days

**Resource Requirements:**
- Solo developer (Edgars) with AI assistance (Claude Code + BMAD)
- Supabase managed infrastructure (no ops overhead)

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
| Journey | MVP Support | Notes |
|---------|-------------|-------|
| Edgars (Team Lead) | ✅ Full | Primary validation journey |
| Mārtiņš (Junior Dev) | ✅ Full | Coaching feedback loop |
| Sofia (Solo Dev) | ✅ Partial | Personal analytics, no export |
| Alex (Platform Admin) | ⚠️ Basic | Essential admin only |

**Must-Have Capabilities:**
1. ✅ User registration (email + Gmail OAuth)
2. ✅ Team creation and member invitation
3. ✅ Project registration with API key
4. ✅ Claude Code hook with cloud sync
5. ✅ Secret redaction before storage
6. ✅ Real-time AI analysis (5 dimensions)
7. ✅ Dashboard with prompt feed and scores
8. ✅ Filter by user, project, date, score
9. ✅ Basic trend visualization
10. ⚠️ Basic admin panel (user management only)

**Explicitly Deferred from MVP:**
- ❌ Privacy toggle (prompt text hiding)
- ❌ Email infrastructure (milestones, weekly digest)
- ❌ Admin LLM model selection
- ❌ A/B testing for analysis configs
- ❌ Token/cost tracking
- ❌ Chrome extension
- ❌ Cursor/Aider integrations
- ❌ Export functionality
- ❌ Slack/Discord notifications
- ❌ Subscription/billing system

### Post-MVP Roadmap

**Phase 2: Growth**
| Feature | Priority | Driver |
|---------|----------|--------|
| Privacy toggle (hide prompt text, show analysis) | High | User trust |
| Email infrastructure (milestones, weekly digest) | High | Engagement |
| Admin LLM model selection | High | Cost optimization |
| A/B testing for analysis configs | High | Analysis quality |
| Token/cost tracking per user | High | Monetization prep |
| Chrome extension (Lovable, Bolt.new) | Medium | User requests |
| Cursor integration | Medium | Market demand |
| Data export (CSV, JSON) | Medium | Enterprise interest |

**Phase 3: Expansion**
| Feature | Priority | Driver |
|---------|----------|--------|
| Auto-improve prompts | High | AI capability |
| Interactive coaching agent | High | User engagement |
| "How seniors prompt" learning | Medium | Team feedback |
| SSO (Enterprise) | Medium | Enterprise deals |
| Audit logs | Medium | Compliance |
| ML-based scoring | Low | Outcome data |
| Team benchmarking | Low | Multi-team adoption |
| Slack/Discord notifications | Low | Team requests |

### Risk Mitigation Strategy

**Technical Risks:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Analysis latency | Medium | High | Queue + async processing, show "analyzing" state |
| Hook reliability | Low | High | Fallback capture methods, retry logic |
| Supabase limits | Low | Medium | Monitor usage, upgrade tier if needed |

**Market Risks:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users don't share prompts | Medium | High | Start with teams who already trust each other |
| Privacy concerns | Medium | Medium | Clear data policy, secret redaction, encryption |
| No behavior change | Medium | High | Gamification, weekly email summaries |

**Resource Risks:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Solo dev bandwidth | High | Medium | AI-assisted development, MVP focus |
| Scope creep | Medium | High | Strict MVP boundaries, user-driven prioritization |
| Technical debt | Medium | Medium | Accept some debt, document for future cleanup |

### Minimum Viable Scope

**Absolute Minimum (if resources constrained):**
1. Capture hook → Supabase → Dashboard
2. Basic AI analysis (no dimensions, just overall score)
3. Single team (no multi-tenancy)
4. Manual user creation (no self-signup)

**This would validate:** Core hypothesis that prompt visibility helps teams improve.

---

## Functional Requirements

### User & Authentication

- **FR1:** Users can register using email/password credentials
- **FR2:** Users can register and sign in using Gmail OAuth
- **FR3:** Users can reset their password via email
- **FR4:** Users can view and edit their profile information
- **FR5:** Users can switch between teams they belong to
- **FR6:** Users can log out from all sessions

### Team Management

- **FR7:** Users can create a new team
- **FR8:** Team Admins can invite users to their team via email
- **FR9:** Team Admins can assign or change member roles (Admin/Member)
- **FR10:** Team Admins can remove members from the team
- **FR11:** Team Admins can rename or update team settings
- **FR12:** Users can leave a team they belong to
- **FR13:** Users can belong to multiple teams simultaneously

### Project Management

- **FR14:** Team members can register a new project with Contextor
- **FR15:** System generates a unique API key for each registered project
- **FR16:** Users can associate a project with a specific team
- **FR17:** Team Admins can view all projects linked to their team
- **FR18:** Team Admins can revoke and regenerate project API keys
- **FR19:** Team Admins can remove a project from the team

### Project Installation (Developer-Side Setup)

- **FR55:** System provides a CLI tool (`npx @contextor/cli`) for local project setup
- **FR56:** CLI accepts Install Token obtained from the dashboard (contains project ID, user ID, API key)
- **FR57:** CLI validates token with api.contextor.co before proceeding
- **FR58:** CLI auto-detects installation state (fresh install vs. joining existing project)
- **FR59:** CLI creates shared project configuration (`.contextor/config.json`) - committed to git
- **FR60:** CLI creates personal user configuration (`.contextor/.user`) - gitignored
- **FR61:** CLI auto-configures Claude Code hook in `.claude/settings.json`
- **FR62:** CLI adds `.contextor/.user` to `.gitignore` if not already present
- **FR63:** CLI tests connection to cloud API and confirms capture is working
- **FR64:** CLI displays success message with dashboard URL
- **FR65:** CLI handles re-runs gracefully (idempotent operation)
- **FR76:** CLI and onboarding messaging uses coaching-positive framing, avoiding surveillance language

**Onboarding UX Guidelines (Anti-Surveillance Framing):**
- Use positive language: "coaching", "skill development", "feedback", "improve", "learn", "grow"
- Avoid surveillance language: "tracking", "monitoring", "watching", "logging"
- Emphasize user benefit: "See how your prompting skills improve over time"
- For team context: "Learn from each other" not "See what others are doing"
- First-run message example: "Contextor helps you become a better AI prompter by providing instant feedback on your prompts."

**Single Installation Command:**
```bash
# One command for all scenarios - CLI auto-detects the situation
npx @contextor/cli init <INSTALL_TOKEN>
```

**Token Generation:**
- User obtains Install Token from project settings page at app.contextor.co
- Token is a secure encoded string containing: project_id, user_id, api_key, team_id
- Each user gets their own unique token for the same project
- Tokens can be revoked from the dashboard

**Auto-Detection Logic:**

| Situation | CLI Behavior |
|-----------|--------------|
| Fresh project (no `.contextor/`) | Full setup: creates all config files and hooks |
| Project exists, new user (no `.user`) | Creates personal `.user` file, verifies hooks |
| Already configured for this user | Shows status confirmation, no changes |

**Local Structure Created:**
```
.contextor/
├── config.json          # Shared: project_id, team_id, api_endpoint (COMMITTED)
└── .user                # Personal: user_id, api_key (GITIGNORED)

.claude/
├── settings.json        # Hook configuration (COMMITTED)
└── hooks/
    └── contextor-capture.sh  # Capture script (COMMITTED)

.gitignore               # Updated to include .contextor/.user
```

**Multi-User Repository Support:**
- First developer runs `init` → creates shared config + their personal `.user`
- Second developer clones repo → runs `init` with THEIR token → creates only their `.user`
- Each developer's prompts are attributed to their user_id
- Shared config ensures all team members capture to the same project

**Onboarding Flow:**
1. User signs up at contextor.co
2. User creates or joins a team
3. User creates a new project in dashboard (or is invited to existing one)
4. User copies Install Token from project settings
5. User runs `npx @contextor/cli init <TOKEN>` in their local project (once)
6. CLI auto-detects situation, configures appropriately, tests connection
7. User's prompts start appearing in the dashboard immediately

### Prompt Capture

- **FR20:** System captures prompts from Claude Code via shell hook
- **FR21:** System captures prompts from BMAD agents via native integration
- **FR22:** System redacts secrets from prompts before storage
- **FR23:** Captured prompts sync to cloud storage in real-time
- **FR24:** System extracts file references from prompt text
- **FR25:** System detects image references in prompts
- **FR26:** System records prompt metadata (timestamp, source, project, user)

### AI Analysis Engine

- **FR27:** System analyzes each captured prompt automatically
- **FR28:** System scores prompts across configurable dimensions
- **FR29:** System calculates overall quality score (1-10) per prompt
- **FR30:** System generates improvement suggestions per dimension
- **FR31:** Analysis results associate with the specific analysis config version used
- **FR32:** Platform Admins can add, edit, or disable analysis dimensions
- **FR33:** Platform Admins can modify prompt templates for analysis
- **FR34:** Platform Admins can adjust dimension weight percentages
- **FR35:** Platform Admins can create new analysis configuration versions

### Dashboard & Visualization

- **FR36:** Users can view a real-time feed of their team's prompts
- **FR37:** Dashboard auto-updates when new prompts are captured
- **FR38:** Users can filter prompts by team member
- **FR39:** Users can filter prompts by project
- **FR40:** Users can filter prompts by date range
- **FR41:** Users can filter prompts by score range
- **FR42:** Users can view full analysis breakdown for any prompt
- **FR43:** Users can view their personal prompt quality trend over time
- **FR44:** Users can view team-level prompt quality trends
- **FR45:** Users can compare high-scoring and low-scoring prompts

### Platform Administration

- **FR46:** Platform Super Admins can view all teams and users
- **FR47:** Platform Super Admins can access system-wide analytics
- **FR48:** Platform Super Admins can manage user accounts (disable, delete)
- **FR49:** Platform Super Admins can view and manage analysis configurations
- **FR50:** Platform Super Admins can monitor system health metrics

### Security & Data Privacy

- **FR51:** System encrypts prompt data at rest
- **FR52:** System enforces row-level security (users see only their team's data)
- **FR53:** System enforces HTTPS for all communications
- **FR54:** System retains data according to tier-based retention policies

### User Experience & Reliability

- **FR66:** Dashboard shows onboarding checklist until user completes: signup, install, first prompt captured
- **FR67:** Empty state for prompt feed shows installation instructions with copy-paste commands
- **FR68:** Prompt analysis shows "Analyzing..." state with estimated time indication
- **FR69:** Dashboard header clearly indicates current team context with easy switching
- **FR70:** Prompt scores display team average alongside personal score for context
- **FR71:** New team members see privacy choice modal on first join (defaulting to full sharing)
- **FR72:** System validates prompt length before analysis (reject prompts > 100K characters)
- **FR73:** Analysis has retry logic with maximum 3 attempts before marking as failed
- **FR74:** Prompts have visible analysis_status field (pending, processing, complete, failed)

---

## Non-Functional Requirements

### Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| **NFR-P1:** Dashboard initial load time | < 2 seconds | Time to interactive |
| **NFR-P2:** Prompt feed update latency | < 500ms | Time from capture to display |
| **NFR-P3:** AI analysis completion | < 30 seconds | 99th percentile |
| **NFR-P4:** Filter/search response | < 1 second | P95 response time |
| **NFR-P5:** Concurrent users per team | 20+ simultaneous | No degradation |

### Security

| Requirement | Specification |
|-------------|---------------|
| **NFR-S1:** Data encryption at rest | AES-256 via Supabase |
| **NFR-S2:** Data encryption in transit | TLS 1.3 (HTTPS only) |
| **NFR-S3:** Secret redaction | 10+ pattern types before storage |
| **NFR-S4:** Authentication tokens | JWT with 24-hour expiry, refresh tokens |
| **NFR-S5:** Row-level security | Users access only their team's data |
| **NFR-S6:** API key storage | Hashed, never stored in plaintext |
| **NFR-S7:** Session management | Secure cookies, CSRF protection |

### Scalability

| Requirement | MVP Target | Growth Target |
|-------------|------------|---------------|
| **NFR-SC1:** Total users | 500 | 5,000 |
| **NFR-SC2:** Teams | 100 | 1,000 |
| **NFR-SC3:** Prompts per month | 50,000 | 500,000 |
| **NFR-SC4:** Concurrent analysis jobs | 10 | 100 |
| **NFR-SC5:** Data retention | 90 days | Tier-based (7/90/∞) |

**Scaling Strategy:**
- Supabase managed infrastructure handles horizontal scaling
- Queue-based analysis processing for burst capacity
- Database indexing on frequently-queried fields

### Reliability

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| **NFR-R1:** Prompt capture success rate | 95%+ | Captured / Expected |
| **NFR-R2:** Analysis completion rate | 99%+ | Analyzed / Captured |
| **NFR-R3:** Dashboard uptime | 99.5% | Monthly availability |
| **NFR-R4:** Data durability | 99.99% | No data loss |
| **NFR-R5:** Error recovery | < 1 hour | Mean time to recovery |

**Reliability Mechanisms:**
- Retry logic for failed captures
- Dead letter queue for failed analyses
- Automatic backup via Supabase

### Integration

| Requirement | Specification |
|-------------|---------------|
| **NFR-I1:** Claude Code hook compatibility | v1.0+ of Claude Code |
| **NFR-I2:** BMAD agent compatibility | v1.0+ of BMAD framework |
| **NFR-I3:** API response format | JSON, consistent error schema |
| **NFR-I4:** Webhook reliability | 3 retries with exponential backoff |
| **NFR-I5:** API versioning | URL-based (v1, v2) with deprecation notices |

### Accessibility (Basic)

| Requirement | Specification |
|-------------|---------------|
| **NFR-A1:** Keyboard navigation | All primary actions accessible via keyboard |
| **NFR-A2:** Color contrast | WCAG AA minimum (4.5:1 for text) |
| **NFR-A3:** Screen reader support | Semantic HTML, ARIA labels on interactive elements |
| **NFR-A4:** Responsive design | Functional on 1024px+ screens (desktop-first) |

*Note: Accessibility requirements are basic level appropriate for a developer-focused B2B tool. Full WCAG compliance would be a Growth phase consideration if enterprise customers require it.*

---

## Infrastructure & DevOps Requirements

### Domain & DNS Management

| Requirement | Specification |
|-------------|---------------|
| **INF-D1:** Primary domain | contextor.co (registered with Namecheap) |
| **INF-D2:** Subdomains required | `app.contextor.co` (web app), `api.contextor.co` (API) |
| **INF-D3:** DNS management | Programmatic access via Namecheap API |
| **INF-D4:** SSL certificates | Auto-provisioned (via Vercel/Cloud Run or Let's Encrypt) |

**Setup Tasks:**
- Configure Namecheap API access (API key + whitelisted IP)
- Set up DNS records for subdomains
- Document DNS configuration for disaster recovery

### npm Package Publishing

| Requirement | Specification |
|-------------|---------------|
| **INF-N1:** Package name | `@contextor/cli` (scoped under @contextor org) |
| **INF-N2:** npm organization | Create `contextor` org on npmjs.com |
| **INF-N3:** Publish automation | GitHub Actions workflow on release/tag |
| **INF-N4:** Access tokens | npm automation token (not user token) |
| **INF-N5:** Version management | Semantic versioning (semver) |

**Setup Tasks:**
- Create npm account and `@contextor` organization
- Generate npm automation token for CI/CD
- Store token as GitHub repository secret (`NPM_TOKEN`)
- Create GitHub Actions workflow for automated publishing
- Configure branch protection (require PR review before publish)

**Publish Workflow (Automated):**
```
Developer merges PR to main
        │
        ▼
Create GitHub Release (tag: v1.0.1)
        │
        ▼
GitHub Actions triggers
        │
        ▼
Build & test CLI package
        │
        ▼
npm publish --access public
        │
        ▼
New version available via npx
```

### CI/CD Pipeline

| Requirement | Specification |
|-------------|---------------|
| **INF-C1:** CI platform | GitHub Actions |
| **INF-C2:** Web app deployment | Vercel (auto-deploy on push to main) |
| **INF-C3:** API deployment | Google Cloud Run (via GitHub Actions) |
| **INF-C4:** CLI publishing | npm (via GitHub Actions on release) |
| **INF-C5:** Database migrations | Supabase CLI in GitHub Actions |

**Required Secrets (GitHub Repository):**
| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | Publish @contextor/cli to npm |
| `NAMECHEAP_API_KEY` | DNS management (if automated) |
| `NAMECHEAP_API_USER` | Namecheap API username |
| `SUPABASE_ACCESS_TOKEN` | Database migrations |
| `SUPABASE_PROJECT_ID` | Target Supabase project |
| `GCP_SERVICE_ACCOUNT` | Cloud Run deployment |

### Environment Management

| Environment | Purpose | URL |
|-------------|---------|-----|
| **Development** | Local development | localhost:3000 |
| **Staging** | Pre-production testing | staging.contextor.co |
| **Production** | Live application | app.contextor.co |

**Environment Variables:**
- Managed via Vercel/Cloud Run environment settings
- Secrets never committed to repository
- `.env.example` provided for local development

### Monitoring & Observability (Post-MVP)

| Requirement | Specification |
|-------------|---------------|
| **INF-M1:** Error tracking | Sentry (recommended) |
| **INF-M2:** Uptime monitoring | UptimeRobot or similar |
| **INF-M3:** Analytics | Plausible or PostHog (privacy-focused) |
| **INF-M4:** Logging | Cloud Run/Vercel built-in logs |

---

## Epic/Story Suggestions for Infrastructure Setup

The following infrastructure tasks should be planned as stories in an early sprint (Sprint 0 or Sprint 1):

### Story: npm Organization & Publishing Setup
**As a** developer
**I want** automated npm publishing configured
**So that** CLI updates are deployed automatically when we create releases

**Acceptance Criteria:**
- [ ] `@contextor` npm organization created
- [ ] npm automation token generated and stored in GitHub secrets
- [ ] GitHub Actions workflow publishes on release tag
- [ ] Test publish works with v0.0.1-alpha

### Story: Domain & DNS Configuration
**As a** developer
**I want** contextor.co subdomains configured
**So that** app.contextor.co and api.contextor.co resolve correctly

**Acceptance Criteria:**
- [ ] Namecheap API access enabled
- [ ] DNS records created for app and api subdomains
- [ ] SSL certificates provisioned
- [ ] DNS configuration documented

### Story: CI/CD Pipeline Setup
**As a** developer
**I want** automated deployment pipelines
**So that** code changes deploy automatically after merge

**Acceptance Criteria:**
- [ ] GitHub Actions workflows for web app, API, and CLI
- [ ] All required secrets configured
- [ ] Staging environment accessible
- [ ] Production deployment requires manual approval
