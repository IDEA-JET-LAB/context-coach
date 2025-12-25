---
stepsCompleted: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]
status: complete
prdScope: 'cloud-first-evolution'
inputDocuments:
  - '_bmad-output/brainstorming/2025-12-18-initial-vision.md'
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

## Table of Contents

### Phase 1: MVP

- [Executive Summary](#executive-summary) (Line 92)
  - [What Makes This Special](#what-makes-this-special) (Line 111)
- [Project Classification](#project-classification) (Line 121)
  - [Architecture Direction](#architecture-direction) (Line 128)
- [Success Criteria](#success-criteria) (Line 138)
  - [User Success](#user-success) (Line 140)
  - [Business Success](#business-success) (Line 161)
  - [Technical Success](#technical-success) (Line 170)
  - [Measurable Outcomes](#measurable-outcomes) (Line 178)
- [Product Scope](#product-scope) (Line 188)
  - [MVP - Minimum Viable Product](#mvp---minimum-viable-product) (Line 190)
  - [Growth Features (Post-MVP)](#growth-features-post-mvp) (Line 250)
  - [Vision (Future)](#vision-future) (Line 280)
- [User Journeys](#user-journeys) (Line 291)
  - [Journey 1: Edgars — The Team Lead Who Can Finally Help](#journey-1-edgars--the-team-lead-who-can-finally-help) (Line 293)
  - [Journey 2: Mārtiņš — The Junior Dev Who Stops Getting Stuck](#journey-2-mārtiņš--the-junior-dev-who-stops-getting-stuck) (Line 315)
  - [Journey 3: Sofia — The Solo Developer Seeking Self-Improvement](#journey-3-sofia--the-solo-developer-seeking-self-improvement) (Line 337)
  - [Journey 4: Platform Admin — Keeping the System Running](#journey-4-platform-admin--keeping-the-system-running) (Line 358)
  - [Journey Requirements Summary](#journey-requirements-summary) (Line 380)
- [Innovation & Novel Patterns](#innovation--novel-patterns) (Line 397)
  - [Detected Innovation Areas](#detected-innovation-areas) (Line 399)
  - [Market Context](#market-context) (Line 420)
  - [Validation Approach](#validation-approach) (Line 428)
  - [Risk Mitigation](#risk-mitigation) (Line 436)
- [SaaS B2B Specific Requirements](#saas-b2b-specific-requirements) (Line 446)
  - [Multi-Tenancy Model](#multi-tenancy-model) (Line 448)
  - [Role-Based Access Control (RBAC) Matrix](#role-based-access-control-rbac-matrix) (Line 467)
  - [Subscription Tiers (MVP - Freemium Launch)](#subscription-tiers-mvp---freemium-launch) (Line 475)
  - [Integration Architecture](#integration-architecture) (Line 485)
  - [Compliance & Security Requirements](#compliance--security-requirements) (Line 505)
  - [Implementation Considerations](#implementation-considerations) (Line 517)
- [Project Scoping & Phased Development](#project-scoping--phased-development) (Line 540)
  - [MVP Strategy & Philosophy](#mvp-strategy--philosophy) (Line 542)
  - [MVP Feature Set (Phase 1)](#mvp-feature-set-phase-1) (Line 558)
  - [Post-MVP Roadmap](#post-mvp-roadmap) (Line 592)
  - [Risk Mitigation Strategy](#risk-mitigation-strategy) (Line 618)
  - [Minimum Viable Scope](#minimum-viable-scope) (Line 641)
- [Functional Requirements](#functional-requirements) (Line 653)
  - [User & Authentication](#user--authentication) (Line 655)
  - [Team Management](#team-management) (Line 664)
  - [Project Management](#project-management) (Line 674)
  - [Project Installation (Developer-Side Setup)](#project-installation-developer-side-setup) (Line 683)
  - [Prompt Capture](#prompt-capture) (Line 754)
  - [AI Analysis Engine](#ai-analysis-engine) (Line 764)
  - [Dashboard & Visualization](#dashboard--visualization) (Line 776)
  - [Platform Administration](#platform-administration) (Line 789)
  - [Security & Data Privacy](#security--data-privacy) (Line 797)
  - [User Experience & Reliability](#user-experience--reliability) (Line 804)
- [Non-Functional Requirements](#non-functional-requirements) (Line 818)
  - [Performance](#performance) (Line 820)
  - [Security](#security) (Line 830)
  - [Scalability](#scalability) (Line 842)
  - [Reliability](#reliability) (Line 857)
  - [Integration](#integration) (Line 872)
  - [Accessibility (Basic)](#accessibility-basic) (Line 882)
- [Infrastructure & DevOps Requirements](#infrastructure--devops-requirements) (Line 895)
  - [Domain & DNS Management](#domain--dns-management) (Line 897)
  - [npm Package Publishing](#npm-package-publishing) (Line 911)
  - [CI/CD Pipeline](#cicd-pipeline) (Line 948)
  - [Environment Management](#environment-management) (Line 968)
  - [Monitoring & Observability (Post-MVP)](#monitoring--observability-post-mvp) (Line 981)
- [Epic/Story Suggestions for Infrastructure Setup](#epicstory-suggestions-for-infrastructure-setup) (Line 992)

### Phase 2: Enhanced Analysis Platform

- [Phase 2 Vision & Objectives](#phase-2-vision--objectives) (Line 1039)
  - [The Problem with Phase 1](#the-problem-with-phase-1) (Line 1041)
  - [Phase 2 Vision](#phase-2-vision) (Line 1051)
  - [Key Insight: Claude Code Has 10 Hooks](#key-insight-claude-code-has-10-hooks) (Line 1062)
- [Phase 2 Success Criteria](#phase-2-success-criteria) (Line 1080)
  - [User Success (Enhanced)](#user-success-enhanced) (Line 1082)
  - [Technical Success](#technical-success-1) (Line 1095)
- [Phase 2 Epic Overview](#phase-2-epic-overview) (Line 1107)
  - [Dependency Graph](#dependency-graph) (Line 1134)
- [Epic 14.5: Privacy & Data Protection](#epic-145-privacy--data-protection) (Line 1170)
  - [Story 14.5.1: Enhanced Secret Redaction for Responses](#story-1451-enhanced-secret-redaction-for-responses) (Line 1186)
  - [Story 14.5.2: User Transparency UI](#story-1452-user-transparency-ui) (Line 1208)
  - [Story 14.5.3: Privacy Controls (Delete, Export, Pause)](#story-1453-privacy-controls-delete-export-pause) (Line 1236)
  - [Story 14.5.4: Column Encryption for Sensitive Data](#story-1454-column-encryption-for-sensitive-data) (Line 1256)
  - [Story 14.5.5: Privacy Levels Implementation](#story-1455-privacy-levels-implementation) (Line 1277)
  - [Story 14.5.6: Data Retention Policy](#story-1456-data-retention-policy) (Line 1300)
- [Epic 15: Response Context Capture](#epic-15-response-context-capture) (Line 1320)
  - [Story 15.1: Stop Hook Integration](#story-151-stop-hook-integration) (Line 1331)
  - [Story 15.2: Transcript Mining Implementation](#story-152-transcript-mining-implementation) (Line 1360)
  - [Story 15.3: Prompt-Response Pairing](#story-153-prompt-response-pairing) (Line 1385)
  - [Story 15.4: Enhanced Analysis with Response Context](#story-154-enhanced-analysis-with-response-context) (Line 1412)
- [Epic 16: Session & Conversation Tracking](#epic-16-session--conversation-tracking) (Line 1434)
  - [Story 16.1: Session Model and Database Schema](#story-161-session-model-and-database-schema) (Line 1445)
  - [Story 16.2: Hook Updates for Session Tracking](#story-162-hook-updates-for-session-tracking) (Line 1479)
  - [Story 16.3: Conversation Grouping in UI](#story-163-conversation-grouping-in-ui) (Line 1494)
  - [Story 16.4: Multi-Terminal Session Visualization](#story-164-multi-terminal-session-visualization) (Line 1509)
- [Epic 17: Historical Import](#epic-17-historical-import) (Line 1523)
  - [Story 17.1: Transcript Discovery and Scanning](#story-171-transcript-discovery-and-scanning) (Line 1534)
  - [Story 17.2: Import Consent and Project Selection UI](#story-172-import-consent-and-project-selection-ui) (Line 1564)
  - [Story 17.3: Batch Processing and Analysis](#story-173-batch-processing-and-analysis) (Line 1580)
  - [Story 17.4: Onboarding Integration](#story-174-onboarding-integration) (Line 1598)
- [Epic 18: Smart Crash Recovery](#epic-18-smart-crash-recovery) (Line 1613)
  - [Story 18.1: Interrupted Session Detection](#story-181-interrupted-session-detection) (Line 1624)
  - [Story 18.2: AI-Powered Context Summarization](#story-182-ai-powered-context-summarization) (Line 1638)
  - [Story 18.3: Recovery Prompt Generation](#story-183-recovery-prompt-generation) (Line 1659)
  - [Story 18.4: VS Code Notification Integration](#story-184-vs-code-notification-integration) (Line 1684)
- [Epic 19: VS Code Extension](#epic-19-vs-code-extension) (Line 1698)
  - [Story 19.1: Extension Scaffolding and Architecture](#story-191-extension-scaffolding-and-architecture) (Line 1709)
  - [Story 19.2: Analytics Dashboard Panel](#story-192-analytics-dashboard-panel) (Line 1729)
  - [Story 19.3: Session Browser and History View](#story-193-session-browser-and-history-view) (Line 1744)
  - [Story 19.4: Contextor Cloud API Integration](#story-194-contextor-cloud-api-integration) (Line 1758)
- [Epic 20: Pre-Submission Coaching](#epic-20-pre-submission-coaching) (Line 1772)
  - [Story 20.1: Fast Local Analysis Heuristics](#story-201-fast-local-analysis-heuristics) (Line 1783)
  - [Story 20.2: Hook Blocking and Suggestion Flow](#story-202-hook-blocking-and-suggestion-flow) (Line 1804)
  - [Story 20.3: Extension Suggestion UI](#story-203-extension-suggestion-ui) (Line 1819)
  - [Story 20.4: Improvement Tracking and Metrics](#story-204-improvement-tracking-and-metrics) (Line 1835)
- [Phase 2 Functional Requirements (Additions)](#phase-2-functional-requirements-additions) (Line 1849)
- [Phase 2 Non-Functional Requirements (Additions)](#phase-2-non-functional-requirements-additions) (Line 1905)
- [Phase 2 Infrastructure Requirements](#phase-2-infrastructure-requirements) (Line 1935)
- [Phase 2 Timeline Considerations](#phase-2-timeline-considerations) (Line 1955)
- [Epic 21: Enhanced Analysis Framework](#epic-21-enhanced-analysis-framework) (Line 2050)
- [Epic 22: Configurable Analysis Engine](#epic-22-configurable-analysis-engine) (Line 2593)
- [Phase 2 Functional Requirements (Configuration Additions)](#functional-requirements-configuration-additions) (Line 3004)

### Phase 3: Conversation Intelligence Platform

- [Phase 3 Vision & Objectives](#phase-3-vision--objectives) (Line 3047)
  - [The Paradigm Shift](#the-paradigm-shift) (Line 3049)
  - [Phase 3 Vision](#phase-3-vision-1) (Line 3063)
  - [Key Research Insights](#key-research-insights) (Line 3075)
- [Phase 3 Success Criteria](#phase-3-success-criteria) (Line 3096)
  - [User Success](#user-success-2) (Line 3098)
  - [Technical Success](#technical-success-2) (Line 3112)
- [Phase 3 Scope](#phase-3-scope) (Line 3125)
  - [In Scope](#in-scope) (Line 3127)
  - [Out of Scope (Future Features)](#out-of-scope-future-features) (Line 3163)
- [Phase 3 Epic Overview](#phase-3-epic-overview) (Line 3177)
  - [Dependency Graph](#dependency-graph-1) (Line 3201)
- [Epic 23: Conversation Data Architecture](#epic-23-conversation-data-architecture) (Line 3235)
  - [Story 23.1: Conversations Table & Schema](#story-231-conversations-table--schema) (Line 3250)
  - [Story 23.2: Project Mapping Table](#story-232-project-mapping-table) (Line 3310)
  - [Story 23.3: Conversation Aggregation Functions](#story-233-conversation-aggregation-functions) (Line 3345)
  - [Story 23.4: Backfill Existing Prompts](#story-234-backfill-existing-prompts-to-conversations) (Line 3384)
- [Epic 24: Enhanced Capture Pipeline](#epic-24-enhanced-capture-pipeline) (Line 3399)
  - [Story 24.1: Response Completion Detection](#story-241-response-completion-detection) (Line 3414)
  - [Story 24.2: Full Response Storage](#story-242-full-response-storage) (Line 3434)
  - [Story 24.3: Thinking Summary Compression](#story-243-thinking-summary-compression) (Line 3449)
  - [Story 24.4: Tool Execution Metadata](#story-244-tool-execution-metadata) (Line 3464)
  - [Story 24.5: Enhanced VS Code Extension Capture](#story-245-enhanced-vs-code-extension-capture) (Line 3479)
- [Epic 25: Conversations UI](#epic-25-conversations-ui) (Line 3494)
  - [Story 25.1: Conversation List View](#story-251-conversation-list-view) (Line 3509)
  - [Story 25.2: Conversation Thread View](#story-252-conversation-thread-view) (Line 3532)
  - [Story 25.3: Message Detail Expansion](#story-253-message-detail-expansion) (Line 3554)
  - [Story 25.4: Conversation Header & Metadata](#story-254-conversation-header--metadata) (Line 3576)
  - [Story 25.5: Time & Effort Visualization](#story-255-time--effort-visualization) (Line 3591)
  - [Story 25.6: Navigation Integration](#story-256-navigation-integration) (Line 3612)
- [Epic 26: Context-Aware Analysis Engine](#epic-26-context-aware-analysis-engine) (Line 3627)
  - [Story 26.1: Prompt Type Classification](#story-261-prompt-type-classification) (Line 3643)
  - [Story 26.2: Conversation Context Retrieval](#story-262-conversation-context-retrieval) (Line 3669)
  - [Story 26.3: Context-Aware Scoring](#story-263-context-aware-scoring) (Line 3684)
  - [Story 26.4: Debugging Loop Detection](#story-264-debugging-loop-detection) (Line 3710)
  - [Story 26.5: Project Stage Detection](#story-265-project-stage-detection) (Line 3730)
  - [Story 26.6: Conversation-Level Scoring](#story-266-conversation-level-scoring) (Line 3755)
  - [Story 26.7: Real-time VS Code Alerts](#story-267-real-time-vs-code-alerts) (Line 3770)
  - [Story 26.8: Background Analysis Queue](#story-268-background-analysis-queue) (Line 3785)
- [Epic 27: Project Mapping & Import Enhancement](#epic-27-project-mapping--import-enhancement) (Line 3800)
  - [Story 27.1: Auto-Match Algorithm](#story-271-auto-match-algorithm) (Line 3815)
  - [Story 27.2: Project Mapping UI](#story-272-project-mapping-ui) (Line 3838)
  - [Story 27.3: Selective Import UI](#story-273-selective-import-ui) (Line 3861)
  - [Story 27.4: Import as Onboarding Flow](#story-274-import-as-onboarding-flow) (Line 3877)
  - [Story 27.5: Import Progress & History Enhancement](#story-275-import-progress--history-enhancement) (Line 3892)
- [Epic 28: Team Analytics & Mentorship](#epic-28-team-analytics--mentorship) (Line 3907)
  - [Story 28.1: Team Conversation Visibility](#story-281-team-conversation-visibility) (Line 3922)
  - [Story 28.2: Team Aggregate Metrics Dashboard](#story-282-team-aggregate-metrics-dashboard) (Line 3936)
  - [Story 28.3: Individual vs Team Comparison](#story-283-individual-vs-team-comparison) (Line 3951)
  - [Story 28.4: Project Stage Analysis](#story-284-project-stage-analysis) (Line 3965)
  - [Story 28.5: Mentorship Insights](#story-285-mentorship-insights) (Line 3979)
- [Phase 3 Functional Requirements](#phase-3-functional-requirements) (Line 3993)
- [Phase 3 Non-Functional Requirements](#phase-3-non-functional-requirements) (Line 4044)
- [Phase 3 Risks & Mitigations](#phase-3-risks--mitigations) (Line 4068)
- [Phase 3 Dependencies](#phase-3-dependencies) (Line 4080)

---

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

---

# Phase 2: Enhanced Analysis Platform

**Status:** Planning
**Date:** 2025-12-22
**Reference:** `_bmad-output/research/enhanced-prompt-analysis-brainstorm.md`

---

## Phase 2 Vision & Objectives

### The Problem with Phase 1

Phase 1 analyzes prompts **in isolation**. Without knowing:
- What Claude responded with
- Whether the response was helpful
- The conversation context
- Session patterns across multiple terminals

...we're essentially grading questions without knowing the answers. This limits analysis accuracy and actionable feedback.

### Phase 2 Vision

Transform Contextor from a **prompt logger with scoring** into a **full conversation intelligence platform** that:

1. **Captures complete context** — prompt + response pairs for accurate analysis
2. **Tracks conversations** — group prompts into sessions, support multi-terminal workflows
3. **Provides day-one value** — import 30 days of historical data on first install
4. **Recovers from crashes** — smart session recovery with context summaries
5. **Coaches in real-time** — suggest prompt improvements before submission
6. **Meets users where they are** — VS Code extension for seamless integration

### Key Insight: Claude Code Has 10 Hooks

Phase 1 uses only `UserPromptSubmit`. Claude Code provides:

| Hook | Data Available | Phase 2 Use |
|------|----------------|-------------|
| SessionStart | session_id, source | Track session begins |
| **UserPromptSubmit** | prompt | ✅ Already using |
| PreToolUse | tool_name, tool_input | Audit intent |
| **PostToolUse** | tool_name, tool_response | 🆕 Response capture |
| **Stop** | session_id | 🆕 Signal turn complete |
| **SessionEnd** | session_id, reason | 🆕 Track session ends |
| PreCompact | trigger | Future: track compaction |

Additionally, every hook receives `transcript_path` pointing to full conversation JSONL files stored locally for 30 days.

---

## Phase 2 Success Criteria

### User Success (Enhanced)

**For All Users:**
- See prompt AND response together for context
- Understand conversation flow, not just individual prompts
- Get day-one insights from historical data
- Recover seamlessly from crashes

**For VS Code Users:**
- Access analytics without leaving IDE
- Receive crash recovery notifications
- Get real-time prompt coaching (opt-in)

### Technical Success

| Metric | Target | Measurement |
|--------|--------|-------------|
| Analysis accuracy improvement | +40% | A/B test with response context |
| Historical import completion | 80%+ | Users who accept import |
| Crash recovery adoption | 60%+ | Users who use recovery prompts |
| VS Code extension installs | 1,000+ | Marketplace metrics |
| Pre-submission improvement rate | 30%+ | Accepted / offered suggestions |

---

## Phase 2 Epic Overview

```
PHASE 2: Enhanced Analysis Platform

├── Epic 14.5: Privacy & Data Protection (P0)
│   └── Foundation for trust — must come first
│
├── Epic 15: Response Context Capture (P0)
│   └── Transcript mining for prompt+response pairs
│
├── Epic 16: Session & Conversation Tracking (P0)
│   └── Group prompts by session_id
│
├── Epic 17: Historical Import (P1)
│   └── Import 30 days of history on first install
│
├── Epic 18: Smart Crash Recovery (P2)
│   └── Detect interrupted sessions, generate recovery prompts
│
├── Epic 19: VS Code Extension (P1)
│   └── Analytics dashboard, notifications, coaching UI
│
├── Epic 20: Pre-Submission Coaching (P3)
│   └── Analyze and improve prompts before sending
│
├── Epic 21: Enhanced Analysis Framework (P0) ⭐ RESEARCH-VALIDATED
│   └── 25+ feedback dimensions from real transcript analysis
│   └── Work style, sentiment, session health, tool usage, learning progression
│
└── Epic 22: Configurable Analysis Engine (P0)
    └── All analysis logic as configuration, not code
    └── Admin UI for prompts, rules, templates, A/B testing
```

### Dependency Graph

```
                    ┌─────────────────┐
                    │ Epic 14.5:      │
                    │ Privacy         │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Epic 15:        │
                    │ Response Context│
                    └────────┬────────┘
                             │
    ┌────────────────────────┼────────────────────────┐
    ▼                        ▼                        ▼
┌─────────────┐      ┌─────────────┐          ┌─────────────┐
│ Epic 16:    │      │ Epic 17:    │          │ Epic 19:    │
│ Sessions    │      │ Historical  │          │ VS Code Ext │
└──────┬──────┘      └──────┬──────┘          └──────┬──────┘
       │                    │                        │
       ▼                    └───────┬────────────────┘
┌─────────────────┐                 ▼
│ Epic 21:        │       ┌─────────────────┐
│ Enhanced        │       │ Epic 18:        │
│ Analysis ⭐     │       │ Crash Recovery  │
└──────┬──────────┘       └────────┬────────┘
       │                           │
       ▼                           ▼
┌─────────────────┐       ┌─────────────────┐
│ Epic 22:        │       │ Epic 20:        │
│ Configurable    │       │ Pre-Submission  │
│ Analysis Engine │       └─────────────────┘
└─────────────────┘
```

**New Dependencies:**
- **Epic 21** (Enhanced Analysis) depends on Epic 16 (Sessions) for session-level metrics
- **Epic 22** (Configurable Engine) depends on Epic 21 (needs analysis to configure)

---

## Epic 14.5: Privacy & Data Protection

**Priority:** P0 (Must be first)
**Rationale:** Phase 2 significantly expands data collection. Privacy infrastructure must exist before capturing responses.

### Objective

Build a privacy-first architecture with 5 layers of protection:
1. Local redaction before upload
2. User transparency (clear communication)
3. User control (delete, export, pause)
4. Encryption at rest
5. Data minimization options

### Stories

#### Story 14.5.1: Enhanced Secret Redaction for Responses

**As a** user capturing conversation data
**I want** secrets automatically removed from responses
**So that** sensitive information never leaves my machine

**Acceptance Criteria:**
- [ ] Extend `redact-secrets.ts` to handle response text
- [ ] Add patterns: database URLs (`postgres://`, `mongodb://`)
- [ ] Add patterns: private IP addresses (optional, user-configurable)
- [ ] Add patterns: email addresses (optional, user-configurable)
- [ ] Support user-defined custom regex patterns
- [ ] Redaction runs locally in hook/CLI before any network call
- [ ] Unit tests for all new patterns

**Technical Notes:**
- File: `lib/capture/redact-secrets.ts` (extend existing)
- New file: `lib/capture/redact-response.ts` (response-specific logic)
- Pattern config stored in `.contextor/privacy.json`

---

#### Story 14.5.2: User Transparency UI

**As a** new user
**I want** to clearly understand what data is collected
**So that** I can make an informed decision about using Contextor

**Acceptance Criteria:**
- [ ] First-run modal explains data collection
- [ ] Lists: prompts, responses, tool usage, session timing
- [ ] Lists: what is automatically redacted
- [ ] Shows configurable exclusions
- [ ] Link to full privacy policy
- [ ] User must acknowledge before capture begins
- [ ] No surveillance language (use "coaching", "feedback", "improve")

**UX Copy Guidelines:**
```
✅ "Help you become a better prompter"
✅ "Provide feedback on your prompts"
✅ "Learn from your patterns"

❌ "Track your activity"
❌ "Monitor your prompts"
❌ "Log your sessions"
```

---

#### Story 14.5.3: Privacy Controls (Delete, Export, Pause)

**As a** user
**I want** control over my data
**So that** I can manage my privacy

**Acceptance Criteria:**
- [ ] "Delete My Data" button in settings → wipes all user's prompts
- [ ] "Export My Data" button → downloads JSON of all prompts
- [ ] "Pause Capture" toggle → temporarily disables without uninstalling
- [ ] Confirmation dialogs for destructive actions
- [ ] Data deletion is immediate and irreversible (with clear warning)

**API Endpoints:**
- `DELETE /api/user/data` — delete all user data
- `GET /api/user/data/export` — export user data as JSON
- `PATCH /api/user/capture-status` — pause/resume capture

---

#### Story 14.5.4: Column Encryption for Sensitive Data

**As a** platform operator
**I want** sensitive data encrypted at rest
**So that** database breaches don't expose prompt content

**Acceptance Criteria:**
- [ ] Encrypt `prompts.text` column using Supabase Vault
- [ ] Encrypt `prompt_responses.response_text` column
- [ ] Encryption transparent to application code
- [ ] Key management via Supabase Vault
- [ ] Document key rotation procedure
- [ ] Performance impact < 50ms per read/write

**Technical Notes:**
- Use `pgcrypto` extension
- Vault for key storage
- Consider per-team keys for isolation

---

#### Story 14.5.5: Privacy Levels Implementation

**As a** user
**I want** to choose my privacy level
**So that** I control how much data is stored

**Acceptance Criteria:**
- [ ] Settings page shows privacy level selector
- [ ] Levels: Full, Standard, Minimal, Local Only
- [ ] Level changes apply to future captures (not retroactive)
- [ ] Clear explanation of each level

**Privacy Levels:**

| Level | Stored | Use Case |
|-------|--------|----------|
| **Full** | Prompts + responses + analysis | Teams wanting full history |
| **Standard** | Prompts + analysis (no responses) | Individual developers |
| **Minimal** | Analysis results only | Privacy-conscious users |
| **Local Only** | Nothing uploaded | Air-gapped environments |

---

#### Story 14.5.6: Data Retention Policy

**As a** user
**I want** to set how long my data is kept
**So that** old data is automatically deleted

**Acceptance Criteria:**
- [ ] Settings page shows retention selector
- [ ] Options: 30 days, 90 days, 1 year, Forever
- [ ] Background job deletes expired data daily
- [ ] User notified before data deletion (optional)
- [ ] Team admins can set minimum retention for team

**Database:**
- Add `retention_days` to user settings
- Add `expires_at` column to prompts table
- Cron job for deletion

---

## Epic 15: Response Context Capture

**Priority:** P0
**Depends on:** Epic 14.5

### Objective

Capture Claude's responses alongside prompts using transcript mining, enabling analysis with full conversation context.

### Stories

#### Story 15.1: Stop Hook Integration

**As a** system
**I want** to know when Claude finishes responding
**So that** I can read the complete response from the transcript

**Acceptance Criteria:**
- [ ] Add `Stop` hook to `.claude/settings.json`
- [ ] Hook receives session_id and transcript_path
- [ ] Hook triggers response capture process
- [ ] Works for both CLI and VS Code extension users

**Hook Configuration:**
```json
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/contextor-capture-response.sh"
      }]
    }]
  }
}
```

---

#### Story 15.2: Transcript Mining Implementation

**As a** system
**I want** to parse transcript JSONL files
**So that** I can extract prompt-response pairs

**Acceptance Criteria:**
- [ ] Read transcript file from path provided by hook
- [ ] Parse JSONL format correctly
- [ ] Extract last user message (prompt)
- [ ] Extract last assistant message (response)
- [ ] Handle tool_use and tool_result entries
- [ ] Apply redaction to extracted content
- [ ] Handle large files efficiently (stream parsing)

**JSONL Structure:**
```jsonl
{"type": "user", "message": "...", "timestamp": "..."}
{"type": "assistant", "message": "...", "timestamp": "..."}
{"type": "tool_use", "name": "Edit", "input": {...}}
{"type": "tool_result", "output": "..."}
```

---

#### Story 15.3: Prompt-Response Pairing

**As a** system
**I want** to link responses to their prompts
**So that** analysis has full context

**Acceptance Criteria:**
- [ ] Generate correlation ID on UserPromptSubmit
- [ ] Pass correlation ID through to Stop hook
- [ ] Match response to prompt using correlation ID
- [ ] Store pairing in database
- [ ] Handle edge cases: multiple prompts, no response

**Database Schema:**
```sql
CREATE TABLE prompt_responses (
  id UUID PRIMARY KEY,
  prompt_id UUID REFERENCES prompts(id),
  response_text TEXT,  -- Encrypted
  tool_calls JSONB,    -- [{name, input_summary}]
  tool_count INTEGER,
  created_at TIMESTAMPTZ
);
```

---

#### Story 15.4: Enhanced Analysis with Response Context

**As a** analysis engine
**I want** response context for scoring
**So that** analysis is more accurate

**Acceptance Criteria:**
- [ ] Update analysis prompt to include response summary
- [ ] New dimension: "Prompt Effectiveness" (did it get good results?)
- [ ] New dimension: "Iteration Efficiency" (follow-ups needed?)
- [ ] A/B test: analysis with vs without response context
- [ ] Measure accuracy improvement

**New Analysis Dimensions:**

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Prompt Effectiveness | 20% | Did the prompt lead to useful output? |
| Iteration Efficiency | 10% | Were follow-ups needed? |

---

## Epic 16: Session & Conversation Tracking

**Priority:** P0
**Depends on:** Epic 15

### Objective

Group prompts into conversations using session_id, enabling conversation-level analytics and multi-terminal tracking.

### Stories

#### Story 16.1: Session Model and Database Schema

**As a** system
**I want** to track sessions
**So that** prompts can be grouped into conversations

**Acceptance Criteria:**
- [ ] Create sessions table
- [ ] Link prompts to sessions
- [ ] Store session start/end times
- [ ] Store session end reason (if available)
- [ ] Calculate session duration

**Database Schema:**
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  claude_session_id TEXT UNIQUE,  -- From Claude Code
  user_id UUID REFERENCES auth.users(id),
  team_id UUID REFERENCES teams(id),
  project_id UUID REFERENCES projects(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  end_reason TEXT,  -- 'clear', 'logout', 'crash', 'unknown'
  prompt_count INTEGER DEFAULT 0,
  metadata JSONB
);

ALTER TABLE prompts ADD COLUMN session_id UUID REFERENCES sessions(id);
ALTER TABLE prompts ADD COLUMN sequence_number INTEGER;
```

---

#### Story 16.2: Hook Updates for Session Tracking

**As a** system
**I want** to capture session lifecycle events
**So that** sessions are properly tracked

**Acceptance Criteria:**
- [ ] Add SessionStart hook → create/resume session record
- [ ] Add SessionEnd hook → close session record
- [ ] Extract session_id from all hooks
- [ ] Pass session_id to capture API
- [ ] Handle session resume (same session_id, new start)

---

#### Story 16.3: Conversation Grouping in UI

**As a** user
**I want** to see prompts grouped by conversation
**So that** I can understand context

**Acceptance Criteria:**
- [ ] Prompt feed can toggle: flat list vs conversation view
- [ ] Conversation view shows session header (start time, duration, prompt count)
- [ ] Expand/collapse conversations
- [ ] Filter by session
- [ ] Show session timeline visualization

---

#### Story 16.4: Multi-Terminal Session Visualization

**As a** user running multiple terminals
**I want** to see which prompts came from which session
**So that** I can track parallel work

**Acceptance Criteria:**
- [ ] Dashboard shows active sessions indicator
- [ ] Each session has unique visual identifier (color/icon)
- [ ] Session switcher in prompt feed
- [ ] Analytics breakdown by session

---

## Epic 17: Historical Import

**Priority:** P1
**Depends on:** Epic 15, Epic 16

### Objective

Import 30 days of historical transcripts on first install, providing immediate value without cold start.

### Stories

#### Story 17.1: Transcript Discovery and Scanning

**As a** system
**I want** to find all local transcripts
**So that** I can offer import to users

**Acceptance Criteria:**
- [ ] Scan `~/.claude/projects/` directory
- [ ] Find all `.jsonl` files
- [ ] Count prompts per project
- [ ] Calculate total importable prompts
- [ ] Respect file modification dates (30-day window)

**Discovery Output:**
```json
{
  "projects": [
    {
      "path": "-Users-edgars-project-a",
      "prompt_count": 234,
      "oldest": "2025-11-22",
      "newest": "2025-12-22"
    }
  ],
  "total_prompts": 847
}
```

---

#### Story 17.2: Import Consent and Project Selection UI

**As a** new user
**I want** to choose what to import
**So that** I control my data

**Acceptance Criteria:**
- [ ] First-run modal shows import opportunity
- [ ] Display: project list with prompt counts
- [ ] Checkboxes for project selection
- [ ] "Import All" / "Select Projects" / "Skip" options
- [ ] Progress indicator during import
- [ ] Clear privacy messaging

---

#### Story 17.3: Batch Processing and Analysis

**As a** system
**I want** to process historical imports efficiently
**So that** imports complete in reasonable time

**Acceptance Criteria:**
- [ ] Stream-parse large JSONL files
- [ ] Batch insert prompts (100 at a time)
- [ ] Queue analysis jobs (don't block UI)
- [ ] Show import progress: X of Y prompts
- [ ] Handle errors gracefully (skip bad entries)
- [ ] Resume interrupted imports

**Performance Target:** 1000 prompts imported and queued in < 60 seconds

---

#### Story 17.4: Onboarding Integration

**As a** new user
**I want** import integrated into onboarding
**So that** I get value immediately

**Acceptance Criteria:**
- [ ] Import step added to onboarding checklist
- [ ] Skip option clearly visible
- [ ] Post-import: redirect to analytics with data
- [ ] Show "X prompts imported" success message
- [ ] First insight highlighted: "Your average score is X"

---

## Epic 18: Smart Crash Recovery

**Priority:** P2
**Depends on:** Epic 17, Epic 19

### Objective

Detect interrupted sessions and help users recover with AI-generated context summaries.

### Stories

#### Story 18.1: Interrupted Session Detection

**As a** system
**I want** to detect crashed/interrupted sessions
**So that** I can offer recovery

**Acceptance Criteria:**
- [ ] On SessionStart: check for recent unclosed sessions
- [ ] Criteria: session with no SessionEnd, last activity < 24h ago
- [ ] Flag session as "interrupted"
- [ ] Trigger recovery flow

---

#### Story 18.2: AI-Powered Context Summarization

**As a** system
**I want** to summarize interrupted sessions
**So that** users understand where they left off

**Acceptance Criteria:**
- [ ] Send last N messages to AI for summarization
- [ ] Extract: task being worked on, last action, pending items
- [ ] Generate human-readable summary (2-3 sentences)
- [ ] Cache summary to avoid re-processing

**Summary Format:**
```
You were implementing OAuth callback handling in auth/callback/route.ts.
Last action: Claude suggested adding try/catch for code exchange.
Pending: You asked to proceed but the session ended before response.
```

---

#### Story 18.3: Recovery Prompt Generation

**As a** user
**I want** a ready-to-use recovery prompt
**So that** I can continue without re-explaining

**Acceptance Criteria:**
- [ ] Generate recovery prompt from summary
- [ ] Include: context, last action, what to continue
- [ ] Copy-to-clipboard button
- [ ] "Paste and send" instruction

**Recovery Prompt Template:**
```
Continue from where we left off. Here's the context:
- We were implementing OAuth callback handling
- Last edit was to auth/callback/route.ts
- You suggested adding try/catch for the code exchange
- I asked you to proceed with that change

Please continue from there.
```

---

#### Story 18.4: VS Code Notification Integration

**As a** VS Code user
**I want** crash recovery notification
**So that** I'm aware of interrupted sessions

**Acceptance Criteria:**
- [ ] Extension detects interrupted sessions on startup
- [ ] Shows notification: "Interrupted session detected"
- [ ] Notification links to recovery panel
- [ ] Can dismiss or snooze notification

---

## Epic 19: VS Code Extension

**Priority:** P1
**Depends on:** Epic 15, Epic 16

### Objective

Build a VS Code extension for analytics, notifications, and coaching UI.

### Stories

#### Story 19.1: Extension Scaffolding and Architecture

**As a** developer
**I want** extension foundation
**So that** features can be built

**Acceptance Criteria:**
- [ ] VS Code extension project initialized
- [ ] TypeScript + React webview setup
- [ ] Contextor API client integrated
- [ ] Authentication flow (login via browser)
- [ ] Settings sync with cloud

**Tech Stack:**
- VS Code Extension API
- React for webview panels
- Contextor API client

---

#### Story 19.2: Analytics Dashboard Panel

**As a** VS Code user
**I want** analytics in my IDE
**So that** I don't need to switch to browser

**Acceptance Criteria:**
- [ ] Sidebar panel showing recent prompts
- [ ] Score badges on each prompt
- [ ] Click to expand analysis details
- [ ] Time range selector
- [ ] Personal vs team toggle

---

#### Story 19.3: Session Browser and History View

**As a** VS Code user
**I want** to browse my sessions
**So that** I can review past conversations

**Acceptance Criteria:**
- [ ] List of sessions with metadata
- [ ] Expand session to see prompts
- [ ] Search within sessions
- [ ] Filter by project, date, score

---

#### Story 19.4: Contextor Cloud API Integration

**As a** extension
**I want** seamless cloud sync
**So that** data is always current

**Acceptance Criteria:**
- [ ] Real-time updates via WebSocket/polling
- [ ] Offline mode with cached data
- [ ] Sync status indicator
- [ ] Error handling with retry

---

## Epic 20: Pre-Submission Coaching

**Priority:** P3
**Depends on:** Epic 19

### Objective

Analyze prompts before submission and suggest improvements.

### Stories

#### Story 20.1: Fast Local Analysis Heuristics

**As a** system
**I want** fast local prompt checks
**So that** feedback is instant

**Acceptance Criteria:**
- [ ] Local heuristic rules (no API call)
- [ ] Check: prompt length, file references, question marks
- [ ] Check: vague words ("fix", "help", "something")
- [ ] Return quick score estimate
- [ ] < 100ms execution time

**Heuristics:**
- Length < 20 chars → likely too short
- No file references → might need context
- Contains "fix the bug" without specifics → vague
- All caps → might be frustration prompt

---

#### Story 20.2: Hook Blocking and Suggestion Flow

**As a** user (opt-in)
**I want** prompts intercepted for coaching
**So that** I can improve before sending

**Acceptance Criteria:**
- [ ] UserPromptSubmit hook can block (exit code 2)
- [ ] Hook writes suggestion to temp file
- [ ] Hook shows message: "See VS Code panel"
- [ ] User can bypass: resubmit to send anyway
- [ ] Configurable: always ask, only on low scores, never

---

#### Story 20.3: Extension Suggestion UI

**As a** VS Code user
**I want** to see improvement suggestions
**So that** I can accept or modify

**Acceptance Criteria:**
- [ ] Panel shows original prompt
- [ ] Panel shows suggested improvements
- [ ] Side-by-side diff view
- [ ] "Accept" copies improved prompt to clipboard
- [ ] "Edit" opens prompt in editor
- [ ] "Skip" lets user resubmit original

---

#### Story 20.4: Improvement Tracking and Metrics

**As a** user
**I want** to see my improvement patterns
**So that** I know coaching is working

**Acceptance Criteria:**
- [ ] Track: suggestions offered vs accepted
- [ ] Track: score before vs after improvement
- [ ] Dashboard widget: "Coaching effectiveness"
- [ ] Show: "You've improved X prompts this week"

---

## Phase 2 Functional Requirements (Additions)

### Response Capture

- **FR77:** System captures Claude's response text via transcript mining
- **FR78:** System links responses to their originating prompts
- **FR79:** System applies redaction to response text before storage
- **FR80:** System extracts tool call summary from responses

### Session Tracking

- **FR81:** System tracks session start and end events
- **FR82:** System groups prompts by session_id
- **FR83:** Users can view prompts grouped by conversation
- **FR84:** Users can filter prompts by session

### Historical Import

- **FR85:** System can scan local transcript files for import
- **FR86:** Users can select which projects to import
- **FR87:** System imports historical prompts with batch processing
- **FR88:** Import respects user's privacy settings

### Crash Recovery

- **FR89:** System detects interrupted sessions
- **FR90:** System generates context summaries for crashed sessions
- **FR91:** System generates recovery prompts
- **FR92:** VS Code extension shows crash recovery notifications

### VS Code Extension

- **FR93:** Users can view analytics dashboard in VS Code
- **FR94:** Users can browse sessions and history in VS Code
- **FR95:** Extension syncs with Contextor cloud in real-time
- **FR96:** Extension shows crash recovery notifications

### Pre-Submission Coaching

- **FR97:** System can intercept prompts before submission (opt-in)
- **FR98:** System runs fast local heuristics on prompts
- **FR99:** System suggests prompt improvements
- **FR100:** Users can accept, modify, or skip suggestions
- **FR101:** System tracks improvement acceptance rates

### Privacy Controls

- **FR102:** Users can delete all their data
- **FR103:** Users can export all their data
- **FR104:** Users can pause/resume capture
- **FR105:** Users can set data retention period
- **FR106:** Users can choose privacy level (Full/Standard/Minimal/Local)
- **FR107:** System encrypts sensitive columns at rest

---

## Phase 2 Non-Functional Requirements (Additions)

### Performance

| Requirement | Target |
|-------------|--------|
| **NFR-P6:** Transcript parsing | < 1 second for 1000-line file |
| **NFR-P7:** Historical import | 1000 prompts in < 60 seconds |
| **NFR-P8:** Recovery prompt generation | < 5 seconds |
| **NFR-P9:** Local heuristics | < 100ms |

### Privacy & Security

| Requirement | Target |
|-------------|--------|
| **NFR-S8:** Local redaction | All sensitive data removed before network |
| **NFR-S9:** Column encryption | AES-256 for text and response_text |
| **NFR-S10:** Data deletion | Complete removal within 24 hours |
| **NFR-S11:** Export completeness | All user data included |

### Scalability

| Requirement | Target |
|-------------|--------|
| **NFR-SC6:** Sessions per user | 1000+ |
| **NFR-SC7:** Responses per month | 500,000 |
| **NFR-SC8:** Historical import size | 10,000+ prompts |

---

## Phase 2 Infrastructure Requirements

### VS Code Marketplace

| Requirement | Specification |
|-------------|---------------|
| **INF-V1:** Publisher account | Create Contextor publisher |
| **INF-V2:** Extension packaging | vsce for packaging |
| **INF-V3:** Auto-publish | GitHub Actions on release |
| **INF-V4:** Extension signing | Required for marketplace |

### Additional Secrets

| Secret | Purpose |
|--------|---------|
| `VSCE_PAT` | VS Code Marketplace publishing |
| `ENCRYPTION_KEY` | Column encryption (or use Vault) |

---

## Phase 2 Timeline Considerations

**Note:** No time estimates per project guidelines. Implementation order based on dependencies:

1. **Epic 14.5** (Privacy) — Must be first
2. **Epic 15** (Response Context) — Foundation
3. **Epic 16** (Sessions) — Requires response capture
4. **Epic 17** (Historical) + **Epic 19** (VS Code) — Can parallelize
5. **Epic 18** (Crash Recovery) — Requires extension
6. **Epic 20** (Pre-Submission) — Last, most complex
7. **Epic 21** (Enhanced Analysis) — Can parallelize after Epic 16

---

## Epic 21: Enhanced Analysis Framework (Research-Validated)

**Priority:** P0
**Depends on:** Epic 16 (Sessions)
**Reference:** `_bmad-output/research/transcript-analysis-findings.md`

### Research Foundation

This epic is based on **real-world analysis of 366 transcript files** (376MB, 2,498 user prompts, 40,689 assistant messages). The research revealed **25+ dimensions of feedback** beyond Phase 1's basic scoring (clarity, context, constraints), which captures only ~15% of potential insights.

### Objective

Transform Contextor from basic prompt scoring into a **comprehensive behavioral intelligence platform** that provides:

1. **Per-Prompt Analysis** — Enhanced clarity scoring + intent classification
2. **Per-Session Analysis** — Session health, efficiency, flow quality
3. **Per-User Profiling** — Work style, collaboration patterns, learning progression
4. **Team Intelligence** — Best practice sharing, common struggles, style distribution

---

### Story 21.1: Context Window Management Analytics

**As a** user
**I want** to see my context exhaustion patterns
**So that** I can optimize session length and avoid quality degradation

**Research Finding:** 32% of long sessions exhaust context window. Average threshold: ~90 minutes.

**Acceptance Criteria:**
- [ ] Detect "continued from a previous conversation that ran out of context" in prompts
- [ ] Track context exhaustion events per user/team
- [ ] Calculate exhaustion rate: exhaustions / total sessions
- [ ] Show average session duration before exhaustion
- [ ] Generate feedback: "You hit context limits in 32% of long sessions"

**Database Schema Addition:**
```sql
ALTER TABLE sessions ADD COLUMN context_exhausted BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN exhaustion_detected_at TIMESTAMPTZ;
```

**Sample Feedback:**
- "You've used 75% of context window. Consider starting a fresh session."
- "Your sessions typically exhaust context after 90 minutes of continuous work."
- "Tip: Breaking large tasks into sub-sessions improves quality."

---

### Story 21.2: Work Style Categorization

**As a** user
**I want** to see my prompting work style profile
**So that** I understand my strengths and areas for growth

**Research Finding:** 10 distinct work style categories identified.

| Category | Detection | Example Patterns |
|----------|-----------|------------------|
| Architecture Questions | 16.3% | "How should...", "What approach..." |
| File Operations | 13.9% | Direct file references (.tsx, .ts) |
| Debugging | 13.5% | "Not working", "error", "fix" |
| Agent Delegation | 12.6% | "You are a...", task assignments |
| Testing | 10.3% | "test", "playwright", "e2e" |
| Deployment | 5.6% | "deploy", "build", "production" |
| Design Iteration | 4.7% | "Make larger", "change color" |
| Context Recovery | 4.6% | Resuming after exhaustion |
| Quick Commands | 4.0% | "yes", "continue", "1" |
| Business Discussion | 1.8% | Strategy, pricing, users |

**Acceptance Criteria:**
- [ ] Classify each prompt into work style category
- [ ] Store category as `prompts.work_style_category`
- [ ] Calculate distribution per user/team
- [ ] Generate work style profile: "Architect", "Firefighter", "Craftsman", "Explorer"
- [ ] Show radar chart of work style distribution

**Classification Logic:**
```typescript
interface WorkStyleClassification {
  architecture_questions: RegExp[];  // "how should", "approach"
  debugging: RegExp[];               // "not working", "error"
  testing: RegExp[];                 // "test", "e2e"
  // ... other categories
}
```

**Sample Feedback:**
- "Your prompting style is heavily architecture-focused (16%). Consider more concrete implementation prompts."
- "30% of your prompts are debugging-related. This might indicate unclear initial requirements."
- "You use agent delegation effectively (12.6%). Keep leveraging this pattern."

---

### Story 21.3: Sentiment & Communication Style Analysis

**As a** user
**I want** to see my communication patterns with AI
**So that** I can improve collaboration quality

**Research Finding:** 24.2% polite expressions, 3.0% frustrated expressions. 8:1 politeness ratio.

| Indicator | Detection Patterns |
|-----------|-------------------|
| **Polite** | "please", "thank you", "thanks", "great", "awesome" |
| **Frustrated** | "why not working", "still wrong", "can't", "this cannot be" |
| **Directive** | Command-style prompts without context |
| **Collaborative** | Questions, discussions, "let's" |

**Acceptance Criteria:**
- [ ] Detect polite expressions per prompt
- [ ] Detect frustrated expressions per prompt
- [ ] Calculate politeness ratio: polite / frustrated
- [ ] Track sentiment trend over session (frustration increases?)
- [ ] Generate communication style profile
- [ ] Flag sessions with rising frustration

**Database Schema Addition:**
```sql
ALTER TABLE prompts ADD COLUMN sentiment VARCHAR(20);  -- 'polite', 'frustrated', 'neutral'
ALTER TABLE prompts ADD COLUMN sentiment_confidence DECIMAL(3,2);
```

**Sample Feedback:**
- "Your communication style is highly collaborative (24% polite expressions)."
- "We noticed 3% frustrated expressions - often around debugging sessions."
- "Frustration peaks after 60+ minutes in a single session."

---

### Story 21.4: Prompt Complexity Analysis

**As a** user
**I want** to understand my prompt complexity patterns
**So that** I can optimize prompt structure

**Research Finding:**

| Metric | Value |
|--------|-------|
| Average prompt length | 994 characters |
| Single-sentence prompts | 42% |
| Multi-sentence prompts | 52% |
| Prompts with code | 8% |
| Prompts with file refs | 15% |
| Short prompts (<20 chars) | 11% |
| Long prompts (>500 chars) | 21% |

**Acceptance Criteria:**
- [ ] Measure prompt length (chars, words)
- [ ] Detect sentence count
- [ ] Detect code presence (```, function, const)
- [ ] Detect file references (.ts, .tsx, /Users/)
- [ ] Calculate complexity distribution
- [ ] Track complexity trend over time

**Database Schema Addition:**
```sql
ALTER TABLE prompts ADD COLUMN char_count INTEGER;
ALTER TABLE prompts ADD COLUMN word_count INTEGER;
ALTER TABLE prompts ADD COLUMN sentence_count INTEGER;
ALTER TABLE prompts ADD COLUMN has_code BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN has_file_refs BOOLEAN DEFAULT false;
```

**Sample Feedback:**
- "42% of your prompts are single-sentence. Adding context often improves results."
- "You include code in 8% of prompts - consider using file references instead."
- "Your average prompt is ~1000 chars - well-detailed requests!"

---

### Story 21.5: Interaction Timing Analysis

**As a** user
**I want** to see my prompting rhythm patterns
**So that** I can optimize my workflow

**Research Finding:**

| Pattern | Occurrence | Description |
|---------|------------|-------------|
| Rapid-fire prompts | 8% | <30 seconds between prompts |
| Long pauses | 29% | >5 minutes between prompts |
| Follow-up patterns | 6% | "also", "and", "now", "next" |
| Average gap | 28 min | Between consecutive prompts |
| Median gap | 3.5 min | More representative |

**Acceptance Criteria:**
- [ ] Calculate time between consecutive prompts
- [ ] Detect rapid-fire sequences (<30s gaps)
- [ ] Detect follow-up prompts ("also", "now", "next")
- [ ] Track average/median prompt intervals
- [ ] Identify productivity patterns (morning vs evening)

**Sample Feedback:**
- "You send rapid-fire prompts 8% of the time. Consider batching requests."
- "Long pauses (>5 min) appear 29% of the time - good thinking breaks!"
- "6% of prompts are follow-ups. Try combining related requests."

---

### Story 21.6: Tool Usage Profiling

**As a** user
**I want** to see my Claude Code tool usage patterns
**So that** I can leverage tools more effectively

**Research Finding:**

| Tool | Usage | Percentage |
|------|-------|------------|
| Bash | 6,101 | 30.6% |
| Read | 5,177 | 26.0% |
| Edit | 3,582 | 18.0% |
| TodoWrite | 1,677 | 8.4% |
| Write | 1,370 | 6.9% |
| Glob | 1,233 | 6.2% |
| Grep | 490 | 2.5% |
| Task (subagent) | 224 | 1.1% |
| WebFetch | 116 | 0.6% |
| WebSearch | 101 | 0.5% |

**Acceptance Criteria:**
- [ ] Track tool usage per session
- [ ] Calculate tool distribution per user/team
- [ ] Identify underutilized tools
- [ ] Generate tool mastery profile
- [ ] Compare to team/community averages

**Database Schema Addition:**
```sql
CREATE TABLE session_tool_usage (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  tool_name VARCHAR(50),
  usage_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Sample Feedback:**
- "You're a power terminal user (30% Bash commands)."
- "Consider using more Grep/Glob for targeted searches vs broad Read operations."
- "Your TodoWrite usage (8%) shows good task management discipline."

---

### Story 21.7: Session Health Score

**As a** user
**I want** to see real-time session health indicators
**So that** I can optimize session quality

**Research Finding:** Session quality degrades over time. Average 147 min session, but quality drops after 90 min.

**Session Health Formula:**
```
Health = f(duration, context_usage, frustration_signals, tool_errors)
```

**Acceptance Criteria:**
- [ ] Calculate session health score (0-100)
- [ ] Track: duration impact
- [ ] Track: context window usage
- [ ] Track: frustration expression frequency
- [ ] Track: repeated similar prompts (retries)
- [ ] Track: tool error rate
- [ ] Show health trend over session
- [ ] Alert when health drops below threshold

**Health Scoring:**

| Factor | Weight | Good | Warning | Critical |
|--------|--------|------|---------|----------|
| Duration | 25% | <60 min | 60-120 min | >120 min |
| Context | 25% | <50% used | 50-80% used | >80% used |
| Frustration | 25% | <2% | 2-5% | >5% |
| Retries | 25% | <5% | 5-15% | >15% |

**Sample Feedback:**
- "Your average session is 2.5 hours. Consider periodic fresh starts for complex tasks."
- "Session health dropped 20% after hour 2 - frustration signals increased."
- "26% of your sessions exceed 1 hour. Long sessions often benefit from sub-task delegation."

---

### Story 21.8: Technical Depth Profiling

**As a** user
**I want** to see my technical vs business orientation
**So that** I understand my prompting focus areas

**Technical Depth Profile:**
```json
{
  "coding_focus": "file_ops / total_prompts",
  "architecture_focus": "design_questions / total_prompts",
  "debugging_ratio": "debug_prompts / total_prompts",
  "testing_discipline": "test_prompts / total_prompts"
}
```

**User Personas:**

| Persona | Characteristics |
|---------|-----------------|
| **Architect** | High architecture, low debugging |
| **Firefighter** | High debugging, low testing |
| **Craftsman** | Balanced across all categories |
| **Explorer** | High questions, experimental |

**Acceptance Criteria:**
- [ ] Calculate technical focus ratio
- [ ] Calculate business/UX focus ratio
- [ ] Determine primary persona
- [ ] Track persona evolution over time
- [ ] Compare to team distribution

**Sample Feedback:**
- "Your profile: Architect (42% architecture, 35% implementation)"
- "Debugging ratio: 15% (healthy range)"
- "Testing discipline: 8% - consider adding more test-related prompts"

---

### Story 21.9: Learning Progression Tracking

**As a** user
**I want** to see my improvement over time
**So that** I know my prompting skills are growing

**Learning Metrics:**
```json
{
  "prompt_quality_trend": "average_score_per_week",
  "frustration_trend": "frustrated_rate_per_week",
  "efficiency_trend": "prompts_per_goal_per_week",
  "context_management": "exhaustion_rate_per_week"
}
```

**Acceptance Criteria:**
- [ ] Track weekly averages for all metrics
- [ ] Calculate week-over-week changes
- [ ] Identify improvement areas
- [ ] Generate progress report
- [ ] Show achievement badges

**Sample Feedback:**
- "Your prompt clarity improved 15% this month!"
- "Debugging prompts decreased 20% - your specs are getting better."
- "Context resets: -40% this month - You're mastering context management!"

---

### Story 21.10: Workflow Efficiency Score

**As a** user
**I want** to see how efficiently I achieve goals
**So that** I can improve my workflow

**Efficiency Formula:**
```
Efficiency = Goals_Achieved / (Prompts + Context_Resets + Debugging_Loops)
```

**Acceptance Criteria:**
- [ ] Track prompts per completed feature
- [ ] Track context resets per session
- [ ] Track debugging loop iterations
- [ ] Calculate time to resolution
- [ ] Compare to team/community benchmarks

**Sample Feedback:**
- "Prompts per completed task: 4.2 (team avg: 5.8) - Excellent!"
- "Context resets: 3 (down from 5 last week!)"
- "Debugging loops: 2.1 per issue (improving)"

---

### Story 21.11: Interactive Insights Dashboard

**As a** user
**I want** an interactive visualization of all insights
**So that** I can explore my data engagingly

**Acceptance Criteria:**
- [ ] Weekly insights report (interactive, not PDF)
- [ ] Activity summary: sessions, prompts, duration
- [ ] Prompt quality scores with breakdown
- [ ] Work style radar chart
- [ ] Sentiment timeline
- [ ] Session health trend
- [ ] Tool usage breakdown
- [ ] Learning progression chart
- [ ] Comparison: this week vs last week
- [ ] Team comparison (where applicable)
- [ ] Personalized tips based on data

**UI Components:**

| Component | Purpose |
|-----------|---------|
| Summary Cards | Key metrics at a glance |
| Radar Chart | Work style distribution |
| Line Charts | Trends over time |
| Bar Charts | Category comparisons |
| Heat Map | Activity timing patterns |
| Progress Bars | Learning progression |

---

### Story 21.12: Team Intelligence Dashboard

**As a** team admin
**I want** team-level insights
**So that** I can identify best practices and common struggles

**Team Metrics:**

| Dimension | Description |
|-----------|-------------|
| Style Distribution | Team's prompt style breakdown |
| Best Practices | High-performer patterns to share |
| Common Struggles | Team-wide debugging hotspots |
| Collaboration Health | Team sentiment trends |

**Acceptance Criteria:**
- [ ] Aggregate individual metrics to team level
- [ ] Identify top performers (anonymized patterns)
- [ ] Identify common struggle areas
- [ ] Show team sentiment trends
- [ ] Generate team coaching recommendations

**Sample Team Insights:**
- "Team average clarity score: 7.8 (up from 7.2 last month)"
- "Best practice: Sarah's prompts have 15% higher specificity - here's her pattern..."
- "Common struggle: 40% of debugging prompts lack error context"

---

## Phase 2 Functional Requirements (Analysis Additions)

### Enhanced Analysis

- **FR108:** System classifies prompts by work style category
- **FR109:** System detects sentiment (polite/frustrated/neutral) in prompts
- **FR110:** System measures prompt complexity (length, sentences, code, file refs)
- **FR111:** System tracks interaction timing patterns
- **FR112:** System profiles tool usage per session/user
- **FR113:** System calculates session health score
- **FR114:** System determines user technical depth profile
- **FR115:** System tracks learning progression over time
- **FR116:** System calculates workflow efficiency score
- **FR117:** System detects context exhaustion events
- **FR118:** Users can view interactive insights dashboard
- **FR119:** Team admins can view team intelligence dashboard
- **FR120:** System generates personalized improvement tips

---

## Phase 2 Database Schema Summary (Analysis)

```sql
-- Prompt enhancements
ALTER TABLE prompts ADD COLUMN work_style_category VARCHAR(30);
ALTER TABLE prompts ADD COLUMN sentiment VARCHAR(20);
ALTER TABLE prompts ADD COLUMN sentiment_confidence DECIMAL(3,2);
ALTER TABLE prompts ADD COLUMN char_count INTEGER;
ALTER TABLE prompts ADD COLUMN word_count INTEGER;
ALTER TABLE prompts ADD COLUMN sentence_count INTEGER;
ALTER TABLE prompts ADD COLUMN has_code BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN has_file_refs BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN is_follow_up BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN is_rapid_fire BOOLEAN DEFAULT false;

-- Session enhancements
ALTER TABLE sessions ADD COLUMN context_exhausted BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN exhaustion_detected_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN health_score INTEGER;
ALTER TABLE sessions ADD COLUMN frustration_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN polite_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN retry_count INTEGER DEFAULT 0;

-- Tool usage tracking
CREATE TABLE session_tool_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  tool_name VARCHAR(50) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User analytics (daily aggregation)
CREATE TABLE user_daily_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  prompt_count INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,
  avg_clarity_score DECIMAL(3,1),
  avg_context_score DECIMAL(3,1),
  avg_overall_score DECIMAL(3,1),
  work_style_distribution JSONB,  -- {"architecture": 10, "debugging": 5, ...}
  sentiment_distribution JSONB,   -- {"polite": 20, "frustrated": 2, ...}
  tool_usage JSONB,               -- {"Bash": 50, "Read": 30, ...}
  context_exhaustions INTEGER DEFAULT 0,
  total_session_minutes INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

-- Team analytics (daily aggregation)
CREATE TABLE team_daily_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  active_users INTEGER DEFAULT 0,
  total_prompts INTEGER DEFAULT 0,
  avg_clarity_score DECIMAL(3,1),
  avg_overall_score DECIMAL(3,1),
  work_style_distribution JSONB,
  sentiment_distribution JSONB,
  common_struggles JSONB,  -- [{category, count, example_patterns}]
  top_patterns JSONB,      -- [{pattern, score, frequency}]
  UNIQUE(team_id, date)
);
```

---

## Phase 2 Non-Functional Requirements (Analysis Additions)

### Performance

| Requirement | Target |
|-------------|--------|
| **NFR-P10:** Work style classification | < 50ms per prompt |
| **NFR-P11:** Sentiment detection | < 50ms per prompt |
| **NFR-P12:** Daily analytics aggregation | < 5 minutes for 10k prompts |
| **NFR-P13:** Dashboard load time | < 2 seconds |

### Accuracy

| Requirement | Target |
|-------------|--------|
| **NFR-A1:** Work style classification accuracy | 85%+ |
| **NFR-A2:** Sentiment detection accuracy | 90%+ |
| **NFR-A3:** Context exhaustion detection | 99%+ |

---

## Epic 22: Configurable Analysis Engine

**Priority:** P0
**Depends on:** Epic 21

### The Problem

Hardcoded analysis logic means:
- Every change requires code deployment
- A/B testing different approaches is impossible
- Teams can't customize scoring for their needs
- Iterating on prompts is slow and risky

### The Solution: Analysis as Configuration

All analysis logic is defined as **configurable templates and rules** stored in the database, not hardcoded. Administrators can modify analysis behavior through a UI without deployments.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANALYSIS CONFIGURATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   PROMPTS    │    │    RULES     │    │  TEMPLATES   │      │
│  │  (LLM-based) │    │ (Regex/Code) │    │  (Feedback)  │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              ANALYSIS CONFIGURATION DB               │       │
│  │  • analysis_prompts (LLM prompt templates)          │       │
│  │  • classification_rules (regex patterns)            │       │
│  │  • feedback_templates (output messages)             │       │
│  │  • scoring_weights (dimension weights)              │       │
│  │  • thresholds (warning/critical levels)             │       │
│  └─────────────────────────────────────────────────────┘       │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                  ANALYSIS ENGINE                     │       │
│  │  1. Load active config version                      │       │
│  │  2. Apply rules (fast, local)                       │       │
│  │  3. Call LLM with prompt template (if needed)       │       │
│  │  4. Generate feedback from templates                │       │
│  │  5. Return structured results                       │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Story 22.1: Analysis Prompts Configuration

**As an** administrator
**I want** to configure LLM prompts for analysis
**So that** I can iterate on analysis quality without code changes

**Acceptance Criteria:**
- [ ] Store analysis prompts in database table
- [ ] Support versioning (v1, v2, v3...)
- [ ] Support A/B testing (assign % traffic to versions)
- [ ] Admin UI to create/edit/preview prompts
- [ ] Rollback to previous version with one click
- [ ] Prompt variables with substitution ({{prompt_text}}, {{context}})

**Database Schema:**
```sql
CREATE TABLE analysis_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,          -- 'clarity_analysis', 'sentiment_detection'
  version INTEGER NOT NULL,
  prompt_template TEXT NOT NULL,        -- The actual LLM prompt with {{variables}}
  model VARCHAR(50) DEFAULT 'gpt-4o-mini',
  temperature DECIMAL(2,1) DEFAULT 0.3,
  max_tokens INTEGER DEFAULT 500,
  is_active BOOLEAN DEFAULT false,
  traffic_percentage INTEGER DEFAULT 100,  -- For A/B testing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(name, version)
);

-- Example prompt configuration
INSERT INTO analysis_prompts (name, version, prompt_template, is_active) VALUES
('clarity_analysis', 1,
'Analyze this prompt for clarity on a 1-10 scale.

PROMPT:
{{prompt_text}}

Consider:
1. Specificity of request
2. Clear action words
3. Unambiguous requirements

Return JSON: {"score": N, "reasoning": "...", "improvements": ["..."]}',
true);
```

**Prompt Variables:**

| Variable | Description |
|----------|-------------|
| `{{prompt_text}}` | The user's prompt text |
| `{{response_text}}` | Claude's response (if available) |
| `{{session_context}}` | Recent session history |
| `{{user_profile}}` | User's historical patterns |
| `{{team_context}}` | Team norms and patterns |

---

### Story 22.2: Classification Rules Engine

**As an** administrator
**I want** to configure classification rules
**So that** I can add/modify categories without code changes

**Acceptance Criteria:**
- [ ] Store classification patterns in database
- [ ] Support regex patterns with named groups
- [ ] Support priority ordering (first match wins OR weighted)
- [ ] Admin UI to test patterns against sample prompts
- [ ] Import/export rules as JSON

**Database Schema:**
```sql
CREATE TABLE classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,       -- 'work_style', 'sentiment', 'complexity'
  subcategory VARCHAR(50) NOT NULL,    -- 'architecture', 'debugging', 'polite'
  patterns JSONB NOT NULL,             -- ["regex1", "regex2"]
  priority INTEGER DEFAULT 100,        -- Lower = higher priority
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  examples JSONB,                       -- Sample matching prompts
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example rules
INSERT INTO classification_rules (category, subcategory, patterns, priority, examples) VALUES
('work_style', 'architecture',
 ['\\bhow\\b.*\\bwork\\b', '\\bshould\\b.*\\bbe\\b', '\\barchitecture\\b', '\\bapproach\\b'],
 10,
 '["How should we structure this?", "What approach would work best?"]'
),
('sentiment', 'frustrated',
 ['\\bwhy\\b.*\\bnot\\b', '\\bstill\\b.*\\b(wrong|error)', '\\bthis cannot be\\b'],
 20,
 '["Why is this not working?", "Still getting the same error"]'
);
```

**Admin UI Features:**
- Pattern tester: enter sample prompt, see which rules match
- Bulk import/export
- Rule preview with match highlighting
- Conflict detection (overlapping patterns)

---

### Story 22.3: Feedback Templates

**As an** administrator
**I want** to configure feedback message templates
**So that** I can personalize and improve feedback without code changes

**Acceptance Criteria:**
- [ ] Store feedback templates in database
- [ ] Support conditional logic (if score < 5, show X)
- [ ] Support personalization variables
- [ ] Support multiple languages (future)
- [ ] Admin UI to preview generated feedback
- [ ] A/B test different feedback styles

**Database Schema:**
```sql
CREATE TABLE feedback_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,       -- 'clarity', 'context_exhaustion', 'sentiment'
  condition JSONB,                      -- {"score_range": [0, 5], "category": "debugging"}
  template TEXT NOT NULL,               -- "Your {{metric}} is {{value}}. {{suggestion}}"
  tone VARCHAR(20) DEFAULT 'friendly',  -- 'friendly', 'professional', 'motivational'
  priority INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example templates
INSERT INTO feedback_templates (category, condition, template, tone) VALUES
('context_exhaustion',
 '{"exhaustion_rate": {"gte": 0.3}}',
 'You hit context limits in {{exhaustion_rate}}% of long sessions. Consider breaking large tasks into smaller sub-sessions.',
 'friendly'
),
('sentiment',
 '{"frustrated_rate": {"gte": 0.05}}',
 'We noticed {{frustrated_count}} frustrated expressions this week. Frustration often peaks after 60+ minutes - try shorter sessions!',
 'motivational'
);
```

**Template Variables:**

| Variable | Description |
|----------|-------------|
| `{{user_name}}` | User's display name |
| `{{metric_name}}` | Name of the metric |
| `{{value}}` | Current value |
| `{{previous_value}}` | Last period's value |
| `{{change}}` | Difference (+/-) |
| `{{team_avg}}` | Team average for comparison |
| `{{suggestion}}` | Generated improvement tip |

---

### Story 22.4: Scoring Weights Configuration

**As an** administrator
**I want** to configure how scores are weighted
**So that** I can adjust importance of different dimensions

**Acceptance Criteria:**
- [ ] Store scoring weights in database
- [ ] Support per-team customization
- [ ] Admin UI for weight adjustment with preview
- [ ] Weights must sum to 100%
- [ ] History of weight changes

**Database Schema:**
```sql
CREATE TABLE scoring_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(20) NOT NULL,          -- 'global', 'team'
  scope_id UUID,                        -- NULL for global, team_id for team
  dimension VARCHAR(50) NOT NULL,       -- 'clarity', 'context', 'specificity'
  weight DECIMAL(5,2) NOT NULL,         -- 0.00 to 1.00
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scope, scope_id, dimension)
);

-- Global defaults
INSERT INTO scoring_weights (scope, scope_id, dimension, weight) VALUES
('global', NULL, 'clarity', 0.30),
('global', NULL, 'context', 0.25),
('global', NULL, 'specificity', 0.20),
('global', NULL, 'constraints', 0.15),
('global', NULL, 'effectiveness', 0.10);

-- Team override example
INSERT INTO scoring_weights (scope, scope_id, dimension, weight) VALUES
('team', '22222222-2222-2222-2222-222222222222', 'testing', 0.20),
('team', '22222222-2222-2222-2222-222222222222', 'clarity', 0.25);
```

---

### Story 22.5: Thresholds Configuration

**As an** administrator
**I want** to configure warning/critical thresholds
**So that** alerts trigger at appropriate levels for our context

**Acceptance Criteria:**
- [ ] Store thresholds in database
- [ ] Support per-team customization
- [ ] Admin UI for threshold adjustment
- [ ] Preview which users would trigger alerts at new thresholds

**Database Schema:**
```sql
CREATE TABLE analysis_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(20) NOT NULL,          -- 'global', 'team'
  scope_id UUID,
  metric VARCHAR(50) NOT NULL,          -- 'session_duration', 'frustration_rate'
  warning_threshold DECIMAL(10,2),
  critical_threshold DECIMAL(10,2),
  comparison VARCHAR(10) NOT NULL,      -- 'gt', 'lt', 'gte', 'lte'
  is_active BOOLEAN DEFAULT true,
  UNIQUE(scope, scope_id, metric)
);

-- Default thresholds
INSERT INTO analysis_thresholds (scope, scope_id, metric, warning_threshold, critical_threshold, comparison) VALUES
('global', NULL, 'session_duration_minutes', 60, 120, 'gt'),
('global', NULL, 'context_usage_percent', 50, 80, 'gt'),
('global', NULL, 'frustration_rate', 0.02, 0.05, 'gt'),
('global', NULL, 'clarity_score', 5, 3, 'lt');
```

---

### Story 22.6: Analysis Configuration Admin UI

**As an** administrator
**I want** a comprehensive UI to manage all analysis configuration
**So that** I can iterate quickly without developer involvement

**Acceptance Criteria:**
- [ ] Dashboard showing all active configurations
- [ ] Prompt editor with syntax highlighting and variable autocomplete
- [ ] Rule tester with live feedback
- [ ] Template previewer with sample data
- [ ] Weight adjuster with visual representation
- [ ] Threshold editor with impact preview
- [ ] Version history with diff view
- [ ] One-click rollback
- [ ] Audit log of all changes

**UI Sections:**

| Section | Purpose |
|---------|---------|
| **Prompts** | Edit LLM prompts, test against samples |
| **Rules** | Configure classification patterns |
| **Templates** | Edit feedback messages |
| **Weights** | Adjust scoring importance |
| **Thresholds** | Set warning/critical levels |
| **Versions** | View history, rollback |
| **A/B Tests** | Configure and monitor experiments |

---

### Story 22.7: Configuration Versioning and Rollback

**As an** administrator
**I want** full version control of all configurations
**So that** I can safely experiment and recover from mistakes

**Acceptance Criteria:**
- [ ] Every config change creates a new version
- [ ] View diff between versions
- [ ] One-click rollback to any previous version
- [ ] Audit log with who changed what when
- [ ] "Draft" mode to preview changes before activating

**Database Schema:**
```sql
CREATE TABLE config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type VARCHAR(50) NOT NULL,    -- 'prompt', 'rule', 'template', 'weight', 'threshold'
  config_id UUID NOT NULL,
  version INTEGER NOT NULL,
  config_data JSONB NOT NULL,           -- Full config snapshot
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  is_active BOOLEAN DEFAULT false
);

CREATE TABLE config_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type VARCHAR(50) NOT NULL,
  config_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL,          -- 'create', 'update', 'activate', 'rollback'
  old_version INTEGER,
  new_version INTEGER,
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);
```

---

### Story 22.8: A/B Testing Framework

**As an** administrator
**I want** to A/B test different analysis configurations
**So that** I can measure which approaches work best

**Acceptance Criteria:**
- [ ] Split traffic between config versions
- [ ] Track metrics per variant
- [ ] Statistical significance calculator
- [ ] Auto-promote winner (optional)
- [ ] Dashboard showing experiment results

**Database Schema:**
```sql
CREATE TABLE ab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  config_type VARCHAR(50) NOT NULL,
  control_version_id UUID NOT NULL,
  treatment_version_id UUID NOT NULL,
  traffic_split INTEGER DEFAULT 50,     -- % to treatment
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'draft',   -- 'draft', 'running', 'completed', 'cancelled'
  success_metric VARCHAR(50) NOT NULL,  -- 'user_satisfaction', 'improvement_rate'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ab_experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES ab_experiments(id),
  variant VARCHAR(20) NOT NULL,         -- 'control', 'treatment'
  sample_size INTEGER,
  metric_value DECIMAL(10,4),
  confidence_interval JSONB,            -- {"lower": 0.45, "upper": 0.55}
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Functional Requirements (Configuration Additions)

- **FR121:** Administrators can configure LLM prompts without code changes
- **FR122:** Administrators can configure classification rules without code changes
- **FR123:** Administrators can configure feedback templates without code changes
- **FR124:** Administrators can configure scoring weights per team
- **FR125:** Administrators can configure thresholds per team
- **FR126:** All configuration changes are versioned with rollback capability
- **FR127:** Administrators can A/B test different configurations
- **FR128:** System loads active configuration at runtime (no restart required)
- **FR129:** Teams can customize analysis configuration within admin-set bounds

---

# Phase 3: Conversation Intelligence Platform

**Status:** Planning
**Date:** 2025-12-25
**Reference:** Phase 3 requirements elicitation session with Product Owner

---

## Phase 3 Vision & Objectives

### The Paradigm Shift

Phase 2 transformed Contextor from a prompt logger into a conversation capture system. However, **analysis still happens prompt-by-prompt**. This creates fundamental limitations:

| Phase 2 Limitation | User Impact |
|--------------------|-------------|
| Prompts analyzed in isolation | "Yes, proceed" scores poorly despite being appropriate |
| No conversation threading | Can't see how dialogue flows |
| No project stage detection | Can't track architectural vs debugging time |
| No debugging loop detection | User stuck in cycles without awareness |
| Prompt-centric UI | List of prompts, not conversations |

**The Core Problem:** Without conversation context, we can't evaluate whether a prompt is good or bad. A one-word response is terrible as an opening prompt but perfect when selecting from options.

### Phase 3 Vision

Transform Contextor from **prompt analysis** to **context engineering coaching**:

1. **Conversation-First Data Model** — Every prompt belongs to a conversation (session)
2. **Context-Aware Analysis** — Evaluate prompts within their conversation context
3. **Prompt Classification** — Categorize prompts (initiating, continuation, selection, correction)
4. **Pattern Detection** — Identify debugging loops, project stages, effort distribution
5. **Rich Capture** — Full LLM responses, thinking summaries, tool metadata
6. **Chat-Like UI** — Navigate by conversation, not prompt list
7. **Team Insights** — Seniors gain visibility into team patterns for mentorship

### Key Research Insights

Based on research from [Anthropic's Context Engineering Guide](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) and [Prompting Guide](https://www.promptingguide.ai/guides/context-engineering-guide):

**The Four Pillars of Context Engineering:**

| Pillar | Description | What We Can Detect |
|--------|-------------|-------------------|
| **Writing Context** | Capturing relevant information for later | Does user provide enough context upfront? |
| **Selecting Context** | Just-in-time retrieval of what's needed | Does user overwhelm with irrelevant info? |
| **Compressing Context** | Summarizing to preserve signal | Could user consolidate multiple prompts? |
| **Isolating Context** | Compartmentalized workflows | Does user mix unrelated tasks? |

**Context Rot Warning:** Studies show LLM performance degrades as token count increases. More words ≠ better prompt. Goal: *"Find the smallest set of high-signal tokens that maximize likelihood of desired outcome."*

**Debugging Loop Pattern** (from [AI Doom Loops Research](https://natesnewsletter.substack.com/p/how-to-escape-ai-doom-loops-a-practical)):
- Prompt → "Fixed!" → Still broken → Prompt again → Fixes new, resurrects old
- Escape strategies: Switch modes, start fresh context, smaller prompts, provide architectural context

---

## Phase 3 Success Criteria

### User Success

**For Individual Developers:**
- Navigate conversations chronologically, not prompt lists
- See how their prompting evolved through a session
- Identify when they got stuck in debugging loops
- Understand time/effort distribution across project stages

**For Team Leads & Seniors:**
- View team members' conversation patterns
- Identify who needs coaching on context engineering
- See aggregate metrics across projects and stages
- Provide targeted mentorship based on actual patterns

### Technical Success

| Metric | Target | Measurement |
|--------|--------|-------------|
| Conversation grouping accuracy | 99%+ | sessionId matching |
| Context-aware analysis improvement | +50% vs isolated | User satisfaction surveys |
| Debugging loop detection precision | 80%+ | Manual review sample |
| Project stage classification accuracy | 75%+ | User confirmation rate |
| Conversation UI adoption | 70%+ | Users who switch from prompts list |
| Import with project mapping | 90%+ | Successful project associations |

---

## Phase 3 Scope

### In Scope

1. **Conversation Data Architecture**
   - `conversations` table linked to prompts
   - parentUuid threading for message chains
   - Project path → Contextor project mapping

2. **Enhanced Capture Pipeline**
   - Full LLM response storage
   - Extended thinking summary (configurable length)
   - Tool execution metadata
   - Response completion detection

3. **Conversations UI**
   - Conversation list view (projects → conversations → messages)
   - Chat-like message thread display
   - Expandable metadata (git branch, tools, thinking)
   - Time/effort visualization

4. **Context-Aware Analysis Engine**
   - Prompt classification (initiating, continuation, selection, etc.)
   - Conversation-context scoring
   - Debugging loop detection
   - Project stage detection

5. **Project Mapping & Import Enhancement**
   - Auto-match confident mappings
   - User-assisted mapping for ambiguous
   - Create Contextor projects from import
   - Selective project/conversation import

6. **Team Analytics**
   - Full prompt visibility within team
   - Aggregate conversation metrics
   - Stage-based effort analysis

### Out of Scope (Future Features)

**Deferred to Phase 4: Suggested Prompts**

| Feature | Description | Rationale for Deferral |
|---------|-------------|----------------------|
| Proactive Next Prompt | Suggest next prompt based on conversation context | Requires stable conversation analysis first |
| Retrospective Improvement | "A better prompt would be..." with explanation | Complex UX, depends on accurate classification |
| VS Code Floating Widget | Real-time suggestions during typing | Performance concerns, user preference research needed |

These features are documented in `_bmad-output/future-features/suggested-prompts.md`

---

## Phase 3 Epic Overview

```
PHASE 3: Conversation Intelligence Platform

├── Epic 23: Conversation Data Architecture (P0)
│   └── Database schema, threading, project mapping tables
│
├── Epic 24: Enhanced Capture Pipeline (P0)
│   └── Full response capture, thinking summary, response detection
│
├── Epic 25: Conversations UI (P0)
│   └── New navigation paradigm, chat view, metadata display
│
├── Epic 26: Context-Aware Analysis Engine (P1)
│   └── Prompt classification, contextual scoring, loop detection
│
├── Epic 27: Project Mapping & Import Enhancement (P1)
│   └── Auto-match, user-assisted, import as onboarding
│
└── Epic 28: Team Analytics & Mentorship (P2)
    └── Team visibility, aggregate metrics, stage analysis
```

### Dependency Graph

```
                    ┌─────────────────┐
                    │ Epic 23:        │
                    │ Data            │
                    │ Architecture    │
                    └────────┬────────┘
                             │
    ┌────────────────────────┼────────────────────────┐
    ▼                        ▼                        ▼
┌─────────────┐      ┌─────────────┐          ┌─────────────┐
│ Epic 24:    │      │ Epic 25:    │          │ Epic 27:    │
│ Enhanced    │      │ Conversations│          │ Project     │
│ Capture     │      │ UI          │          │ Mapping     │
└──────┬──────┘      └──────┬──────┘          └──────┬──────┘
       │                    │                        │
       └────────────────────┼────────────────────────┘
                            ▼
                    ┌─────────────────┐
                    │ Epic 26:        │
                    │ Context-Aware   │
                    │ Analysis Engine │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Epic 28:        │
                    │ Team Analytics  │
                    └─────────────────┘
```

---

## Epic 23: Conversation Data Architecture

**Priority:** P0 (Foundation)
**Rationale:** All Phase 3 features depend on conversation-centric data model

### Objective

Create database schema that:
- Groups prompts into conversations via sessionId
- Preserves message threading via parentUuid
- Links Claude Code projects to Contextor projects
- Stores full response data with configurable thinking compression

### Stories

#### Story 23.1: Conversations Table & Schema

**As a** system architect
**I want** a normalized conversation data model
**So that** prompts are properly grouped and threaded

**Acceptance Criteria:**
- [ ] `conversations` table with sessionId as natural key
- [ ] `prompts` table gains `conversation_id` foreign key
- [ ] `prompts` table gains `parent_uuid` for threading
- [ ] `prompt_responses` table gains `thinking_summary` column
- [ ] Migration preserves existing prompt data
- [ ] Indexes on sessionId, conversation_id, parent_uuid

**Database Schema:**
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL UNIQUE,
  project_id UUID REFERENCES projects(id),
  team_id UUID REFERENCES teams(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,

  -- Metadata from Claude Code
  claude_project_path TEXT,                    -- Original cwd
  git_branch VARCHAR(255),
  claude_code_version VARCHAR(20),
  session_slug VARCHAR(100),                   -- Human-readable slug

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,

  -- Aggregates (updated on prompt insert)
  message_count INTEGER DEFAULT 0,
  user_message_count INTEGER DEFAULT 0,

  -- Classification (updated by analysis)
  primary_stage VARCHAR(50),                   -- 'architecture', 'development', 'debugging', etc.
  has_debugging_loop BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add to prompts table
ALTER TABLE prompts ADD COLUMN conversation_id UUID REFERENCES conversations(id);
ALTER TABLE prompts ADD COLUMN parent_uuid VARCHAR(100);
ALTER TABLE prompts ADD COLUMN message_uuid VARCHAR(100);
ALTER TABLE prompts ADD COLUMN prompt_type VARCHAR(50);  -- 'initiating', 'continuation', 'selection', etc.

-- Add to prompt_responses table
ALTER TABLE prompt_responses ADD COLUMN thinking_summary TEXT;
ALTER TABLE prompt_responses ADD COLUMN thinking_word_count INTEGER;
ALTER TABLE prompt_responses ADD COLUMN model_name VARCHAR(100);
ALTER TABLE prompt_responses ADD COLUMN tool_executions JSONB;
```

---

#### Story 23.2: Project Mapping Table

**As a** user importing historical data
**I want** Claude Code project paths mapped to Contextor projects
**So that** imported conversations belong to correct projects

**Acceptance Criteria:**
- [ ] `project_mappings` table links paths to projects
- [ ] Support multiple paths per Contextor project
- [ ] Confidence score for auto-matches
- [ ] User confirmation status tracking

**Database Schema:**
```sql
CREATE TABLE project_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) NOT NULL,
  project_id UUID REFERENCES projects(id),    -- NULL if not yet mapped

  claude_project_path TEXT NOT NULL,          -- e.g., "/Users/edgars/my-project"
  normalized_path TEXT NOT NULL,              -- e.g., "-Users-edgars-my-project"

  match_confidence DECIMAL(3,2),              -- 0.00-1.00
  match_method VARCHAR(50),                   -- 'exact', 'suffix', 'user_selected'
  user_confirmed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, claude_project_path)
);
```

---

#### Story 23.3: Conversation Aggregation Functions

**As a** developer querying conversations
**I want** efficient aggregation queries
**So that** conversation lists load quickly

**Acceptance Criteria:**
- [ ] Trigger updates message_count on prompt insert
- [ ] Function to recalculate conversation aggregates
- [ ] View for conversation list with computed fields
- [ ] Performance: < 100ms for 1000 conversations

**Database Functions:**
```sql
-- Trigger to update conversation aggregates
CREATE OR REPLACE FUNCTION update_conversation_aggregates()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET
    message_count = message_count + 1,
    user_message_count = CASE
      WHEN NEW.prompt_type IS NOT NULL THEN user_message_count + 1
      ELSE user_message_count
    END,
    ended_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompt_insert_trigger
AFTER INSERT ON prompts
FOR EACH ROW
EXECUTE FUNCTION update_conversation_aggregates();
```

---

#### Story 23.4: Backfill Existing Prompts to Conversations

**As a** system administrator
**I want** existing prompts migrated to conversation structure
**So that** historical data works with new UI

**Acceptance Criteria:**
- [ ] Migration script groups prompts by session_id
- [ ] Creates conversation records for existing sessions
- [ ] Populates conversation_id on all prompts
- [ ] Handles prompts without session_id (legacy)
- [ ] Reversible migration

---

## Epic 24: Enhanced Capture Pipeline

**Priority:** P0 (Foundation)
**Rationale:** Rich data capture enables context-aware analysis

### Objective

Enhance the capture pipeline to:
- Capture full LLM responses
- Compress extended thinking to configurable summary
- Detect response completion before analysis trigger
- Store tool execution metadata

### Stories

#### Story 24.1: Response Completion Detection

**As a** real-time capture system
**I want** to detect when LLM finishes responding
**So that** analysis can consider the full response

**Acceptance Criteria:**
- [ ] Hook monitors transcript file for response completion
- [ ] Detection based on `stop_reason` field in assistant message
- [ ] Timeout fallback (30 seconds no new content)
- [ ] Event emitted when response complete
- [ ] Works for streaming and non-streaming responses

**Technical Notes:**
- Use file watcher on session JSONL
- Parse last assistant message for completion signals
- Emit `response:complete` event to trigger analysis

---

#### Story 24.2: Full Response Storage

**As a** conversation system
**I want** complete LLM responses stored
**So that** users can review full conversation context

**Acceptance Criteria:**
- [ ] Store full response text (visible content only, not thinking)
- [ ] Store model name used for response
- [ ] Store token usage (input, output, cache)
- [ ] Link response to parent prompt via prompt_id
- [ ] Handle multi-part responses (text + tool_use)

---

#### Story 24.3: Thinking Summary Compression

**As a** storage-conscious system
**I want** extended thinking compressed to summary
**So that** we capture gist without excessive storage

**Acceptance Criteria:**
- [ ] Extract thinking content from assistant messages
- [ ] Summarize to first N characters (configurable, default 500)
- [ ] Store word count for full thinking
- [ ] Admin-configurable summary length
- [ ] Handle empty/missing thinking gracefully

---

#### Story 24.4: Tool Execution Metadata

**As a** conversation analyst
**I want** tool usage tracked per response
**So that** we understand what actions LLM took

**Acceptance Criteria:**
- [ ] Extract tool_use blocks from responses
- [ ] Store as JSONB: [{name, id, input_summary}]
- [ ] Limit input_summary to 200 chars per tool
- [ ] Track tool count per response
- [ ] Support all Claude Code tools (Read, Write, Edit, Bash, etc.)

---

#### Story 24.5: Enhanced VS Code Extension Capture

**As a** VS Code extension
**I want** to capture full conversation context
**So that** analytics reflect complete picture

**Acceptance Criteria:**
- [ ] Extension captures response after prompt
- [ ] Waits for response completion (with timeout)
- [ ] Sends prompt + response pair to backend
- [ ] Handles interrupted sessions gracefully
- [ ] Status indicator shows capture progress

---

## Epic 25: Conversations UI

**Priority:** P0 (Core User Experience)
**Rationale:** New navigation paradigm is central to Phase 3 value

### Objective

Create conversation-centric interface:
- Project → Conversations → Messages hierarchy
- Chat-like message thread display
- Expandable metadata panels
- Time/effort visualization

### Stories

#### Story 25.1: Conversation List View

**As a** user
**I want** to see all my conversations organized by project
**So that** I can find and review past sessions

**Acceptance Criteria:**
- [ ] List conversations grouped by project
- [ ] Show: session slug, date, message count, duration
- [ ] Filter by project, date range, stage
- [ ] Sort by date (default), duration, message count
- [ ] Search by conversation content
- [ ] Pagination for large lists

**UI Elements:**
- Project filter dropdown (includes "All Projects")
- Date range picker
- Stage filter (Architecture, Development, Debugging, etc.)
- Conversation cards with summary info
- "No conversations yet" empty state

---

#### Story 25.2: Conversation Thread View

**As a** user
**I want** to view a conversation as a chat thread
**So that** I can see the dialogue flow

**Acceptance Criteria:**
- [ ] Messages displayed chronologically
- [ ] User messages on right (or distinct styling)
- [ ] Assistant responses on left
- [ ] Timestamps on each message
- [ ] Smooth scrolling through long conversations
- [ ] Jump to top/bottom buttons

**UI Elements:**
- Message bubbles with role indicator
- Timestamp display (relative or absolute)
- Scroll position indicator for long threads
- Thread header with conversation metadata

---

#### Story 25.3: Message Detail Expansion

**As a** user
**I want** to expand message details
**So that** I can see metadata like tools used, git branch, etc.

**Acceptance Criteria:**
- [ ] Expandable section per message
- [ ] Show: git branch, working directory, Claude version
- [ ] Show: tool executions (name, summary)
- [ ] Show: thinking summary (if available)
- [ ] Show: token usage
- [ ] Show: prompt score and dimensions (if analyzed)

**UI Elements:**
- Expand/collapse chevron
- Metadata in organized sections
- Tool execution list with icons
- Score visualization (mini dimension chart)

---

#### Story 25.4: Conversation Header & Metadata

**As a** user viewing a conversation
**I want** summary information in the header
**So that** I understand the session context at a glance

**Acceptance Criteria:**
- [ ] Header shows: project name, session date, duration
- [ ] Header shows: message count, primary stage
- [ ] Header shows: debugging loop indicator (if detected)
- [ ] Link to project settings
- [ ] Breadcrumb navigation (Projects > Project > Conversation)

---

#### Story 25.5: Time & Effort Visualization

**As a** user
**I want** to visualize my prompting activity
**So that** I understand my work patterns

**Acceptance Criteria:**
- [ ] Calendar heatmap showing daily prompt activity
- [ ] Stage breakdown pie/bar chart per project
- [ ] Timeline view of conversations
- [ ] Prompt frequency graph (prompts per hour)
- [ ] Filter by date range

**Visualization Types:**
- Calendar heatmap (GitHub-style)
- Stage distribution chart
- Activity timeline
- Prompt frequency over time

---

#### Story 25.6: Navigation Integration

**As a** user
**I want** conversations in the main navigation
**So that** I can easily switch between views

**Acceptance Criteria:**
- [ ] "Conversations" link in sidebar/header
- [ ] Conversations is prominent (not buried)
- [ ] Quick switch between Conversations and Analytics
- [ ] Deep linking to specific conversation
- [ ] Back button works correctly

---

## Epic 26: Context-Aware Analysis Engine

**Priority:** P1 (Core Value Proposition)
**Rationale:** This is the "context engineering coaching" differentiator

### Objective

Transform analysis from prompt-level to conversation-level:
- Classify prompt types
- Evaluate prompts in conversation context
- Detect debugging loops
- Identify project stages
- Generate conversation-level insights

### Stories

#### Story 26.1: Prompt Type Classification

**As an** analysis engine
**I want** to classify each prompt by type
**So that** scoring is appropriate for the prompt's role

**Acceptance Criteria:**
- [ ] Classification categories defined
- [ ] LLM-based classifier with fallback heuristics
- [ ] Store classification on prompt record
- [ ] Classification runs on prompt capture
- [ ] Admin can add/modify categories

**Prompt Types:**

| Type | Description | Scoring Approach |
|------|-------------|------------------|
| `initiating` | Starts a new task/topic | Full scoring |
| `continuation` | Provides requested information | Reduced weight on context |
| `selection` | Chooses from presented options | Minimal scoring or skip |
| `correction` | Redirects or corrects LLM | Score on clarity of correction |
| `confirmation` | Approves to proceed | Skip scoring |
| `clarification` | Asks LLM to explain | Score on question quality |

---

#### Story 26.2: Conversation Context Retrieval

**As an** analysis engine
**I want** to retrieve conversation context for analysis
**So that** prompts are evaluated in context

**Acceptance Criteria:**
- [ ] Fetch last N messages before current prompt
- [ ] Include response summaries in context
- [ ] Configurable context depth (default: full conversation)
- [ ] Token budget awareness (truncate if needed)
- [ ] Cache conversation context for repeated analysis

---

#### Story 26.3: Context-Aware Scoring

**As an** analysis engine
**I want** to score prompts considering conversation context
**So that** scores reflect true prompt quality

**Acceptance Criteria:**
- [ ] Analysis prompt includes conversation history
- [ ] Scoring considers prompt type
- [ ] "Yes, proceed" in selection context doesn't score low
- [ ] First prompt in conversation scored as initiating
- [ ] Recovery prompts scored for recovery quality

**New Scoring Dimensions:**

| Dimension | Description |
|-----------|-------------|
| Context Density | Signal-to-noise ratio |
| Task Clarity | Single, unambiguous goal |
| Constraint Specification | Boundaries defined |
| Context Freshness | Not repeating known info |
| Recovery Quality | New info when stuck |
| Conversation Fit | Appropriate for context |

---

#### Story 26.4: Debugging Loop Detection

**As a** user
**I want** to know when I'm stuck in a debugging loop
**So that** I can try a different approach

**Acceptance Criteria:**
- [ ] Detect 3+ semantically similar fix attempts
- [ ] Detect error → "fixed" → same error pattern
- [ ] Flag conversation as `has_debugging_loop`
- [ ] Real-time VS Code notification when detected
- [ ] Store loop instances for retrospective analysis

**Detection Signals:**
- Semantic similarity > 0.8 across 3+ prompts
- Keywords: "still", "again", "same error", "not working"
- Pattern: error message → fix attempt → similar error message

---

#### Story 26.5: Project Stage Detection

**As a** user
**I want** conversations classified by project stage
**So that** I understand time distribution

**Acceptance Criteria:**
- [ ] Classification: Architecture, Specification, Development, Debugging, Enhancement
- [ ] Classification based on conversation content
- [ ] Store primary_stage on conversation
- [ ] Auto-suggested, user can override
- [ ] Aggregate stage time per project

**Stage Indicators:**

| Stage | Indicators |
|-------|------------|
| Architecture | "design", "structure", "pattern", "approach" |
| Specification | "requirements", "should", "feature", "user story" |
| Development | "implement", "create", "add", "build" |
| Debugging | "error", "fix", "bug", "not working", "issue" |
| Enhancement | "improve", "refactor", "optimize", "better" |

---

#### Story 26.6: Conversation-Level Scoring

**As a** user
**I want** overall conversation scores
**So that** I understand session quality at a glance

**Acceptance Criteria:**
- [ ] Aggregate score = average of prompt scores
- [ ] Exclude selection/confirmation prompts from average
- [ ] Store aggregate on conversation record
- [ ] Update on new prompt analysis
- [ ] Show in conversation list and header

---

#### Story 26.7: Real-time VS Code Alerts

**As a** VS Code user
**I want** real-time alerts for detected issues
**So that** I can adjust my approach during the session

**Acceptance Criteria:**
- [ ] Debugging loop detection triggers notification
- [ ] Notification shows count and suggestion
- [ ] Dismissible, with "don't show again" option
- [ ] Configurable: enable/disable in extension settings
- [ ] Badge on extension icon when issues detected

---

#### Story 26.8: Background Analysis Queue

**As a** system
**I want** historical imports analyzed in background
**So that** import completes quickly with analysis following

**Acceptance Criteria:**
- [ ] Import stores prompts immediately
- [ ] Analysis jobs queued for background processing
- [ ] Priority: recent prompts first
- [ ] Progress indicator in import history
- [ ] Rate limiting to avoid API overload

---

## Epic 27: Project Mapping & Import Enhancement

**Priority:** P1 (Onboarding Experience)
**Rationale:** Import flow is primary onboarding path for many users

### Objective

Enhance import to:
- Auto-match confident project mappings
- User-assisted mapping for ambiguous cases
- Create Contextor projects from import
- Selective project/conversation import

### Stories

#### Story 27.1: Auto-Match Algorithm

**As a** import system
**I want** to auto-match Claude Code projects to Contextor projects
**So that** confident matches require no user action

**Acceptance Criteria:**
- [ ] Exact path suffix match = 100% confidence
- [ ] Project name similarity > 90% = 80% confidence
- [ ] Auto-accept matches > 90% confidence
- [ ] Flag matches 50-90% for user confirmation
- [ ] Below 50% = no match, user must select

**Match Logic:**
```
1. Exact path match → 100% confidence
2. Path suffix match (last 2 folders) → 90% confidence
3. Project name fuzzy match → 70-90% confidence
4. No match → 0% confidence, suggest "Create New"
```

---

#### Story 27.2: Project Mapping UI

**As a** user importing data
**I want** to map unmatched projects to Contextor projects
**So that** all imported data has a home

**Acceptance Criteria:**
- [ ] List of unmatched Claude Code projects
- [ ] Dropdown to select existing Contextor project
- [ ] "Create New Project" option in dropdown
- [ ] Inline project creation form
- [ ] Bulk actions (map multiple at once)
- [ ] Skip option (don't import this project)

**UI Flow:**
1. Import discovers 5 projects
2. 3 auto-matched with high confidence
3. 2 shown in mapping UI
4. User selects existing or creates new
5. Confirm to proceed with import

---

#### Story 27.3: Selective Import UI

**As a** user
**I want** to choose which projects and conversations to import
**So that** I don't import irrelevant data

**Acceptance Criteria:**
- [ ] Project list with checkboxes
- [ ] Expand project to see conversations
- [ ] Conversation checkboxes
- [ ] Select all / deselect all
- [ ] Show estimated import size/time
- [ ] Date range filter option

---

#### Story 27.4: Import as Onboarding Flow

**As a** new user
**I want** import to create projects and provide immediate value
**So that** my first experience shows Contextor's value

**Acceptance Criteria:**
- [ ] New user prompt: "Import your Claude Code history?"
- [ ] Discovery shows projects with conversation counts
- [ ] Projects created during import get analyzed
- [ ] After import, user lands on populated conversations view
- [ ] "First insights" summary after import completes

---

#### Story 27.5: Import Progress & History Enhancement

**As a** user
**I want** detailed import progress and history
**So that** I know what was imported and can manage it

**Acceptance Criteria:**
- [ ] Real-time progress: projects → conversations → prompts
- [ ] Per-project status in progress view
- [ ] Import history shows project breakdown
- [ ] Rollback available per project (not just entire import)
- [ ] Re-import option for failed projects

---

## Epic 28: Team Analytics & Mentorship

**Priority:** P2 (Team Value)
**Rationale:** Team visibility enables mentorship use case

### Objective

Provide team-level insights:
- Aggregate metrics across team
- Stage-based effort analysis
- Pattern comparison (individual vs team average)
- Debugging loop frequency tracking

### Stories

#### Story 28.1: Team Conversation Visibility

**As a** team member
**I want** to view teammates' conversations
**So that** I can learn from their approaches

**Acceptance Criteria:**
- [ ] Team members can view each other's conversations
- [ ] Filter by team member
- [ ] Respect any future privacy settings
- [ ] Activity feed of recent team conversations

---

#### Story 28.2: Team Aggregate Metrics Dashboard

**As a** team lead
**I want** aggregate metrics for my team
**So that** I understand team prompting patterns

**Acceptance Criteria:**
- [ ] Total prompts, conversations, projects
- [ ] Average scores by dimension
- [ ] Stage distribution across team
- [ ] Debugging loop frequency by member
- [ ] Trend over time (week/month)

---

#### Story 28.3: Individual vs Team Comparison

**As a** team member
**I want** to compare my metrics to team average
**So that** I know where I can improve

**Acceptance Criteria:**
- [ ] Dimension scores: individual vs team average
- [ ] Stage distribution: individual vs team
- [ ] Debugging loop rate: individual vs team
- [ ] Visualization: radar chart or bar comparison

---

#### Story 28.4: Project Stage Analysis

**As a** team lead
**I want** to see time/effort by project stage
**So that** I understand where the team spends time

**Acceptance Criteria:**
- [ ] Per-project stage breakdown
- [ ] Compare stages across projects
- [ ] Identify debugging-heavy projects
- [ ] Historical trend of stage distribution

---

#### Story 28.5: Mentorship Insights

**As a** senior developer
**I want** to identify team members who need coaching
**So that** I can provide targeted help

**Acceptance Criteria:**
- [ ] Low-scoring members highlighted
- [ ] High debugging loop frequency flagged
- [ ] Improvement trend tracking
- [ ] Exportable report for 1:1 discussions

---

## Phase 3 Functional Requirements

### Conversation Management

- **FR201:** System groups prompts into conversations by sessionId
- **FR202:** System maintains message threading via parentUuid
- **FR203:** Users can navigate from project → conversation → messages
- **FR204:** Users can view conversations in chat-like interface
- **FR205:** Users can expand message details (tools, thinking, scores)

### Enhanced Capture

- **FR206:** System captures full LLM response text
- **FR207:** System summarizes extended thinking to configurable length
- **FR208:** System captures tool execution metadata as JSONB
- **FR209:** System detects response completion before triggering analysis
- **FR210:** VS Code extension captures prompt + response pairs

### Context-Aware Analysis

- **FR211:** System classifies prompts by type (initiating, continuation, selection, etc.)
- **FR212:** Analysis considers conversation context, not just isolated prompt
- **FR213:** System detects debugging loops (3+ similar fix attempts)
- **FR214:** System classifies conversations by project stage
- **FR215:** Conversation-level aggregate scores calculated

### Project Mapping

- **FR216:** System auto-matches Claude Code paths to Contextor projects
- **FR217:** Users can manually map unmatched projects
- **FR218:** Users can create Contextor projects during import
- **FR219:** Users can selectively import projects/conversations
- **FR220:** Project mappings persist server-side, shared across devices

### Team Analytics

- **FR221:** Team members can view each other's conversations
- **FR222:** Team leads see aggregate metrics dashboard
- **FR223:** Individual vs team comparison available
- **FR224:** Stage-based effort analysis per project
- **FR225:** Debugging loop frequency tracked per member

### Real-time Features

- **FR226:** VS Code alerts on debugging loop detection
- **FR227:** Alerts are dismissible with "don't show again" option
- **FR228:** Historical analysis runs in background queue (recent first)
- **FR229:** Import progress shows real-time status

---

## Phase 3 Non-Functional Requirements

### Performance

- **NFR201:** Conversation list loads in < 500ms for 1000 conversations
- **NFR202:** Conversation thread loads in < 300ms for 500 messages
- **NFR203:** Context-aware analysis completes in < 5 seconds
- **NFR204:** Background analysis processes 100 prompts/minute
- **NFR205:** Import discovery completes in < 10 seconds for 30 days of history

### Scalability

- **NFR206:** Support 100,000 conversations per team
- **NFR207:** Support 10,000 messages per conversation
- **NFR208:** Analysis queue handles 10,000 pending jobs

### Data

- **NFR209:** Full conversation data exportable as JSON
- **NFR210:** Thinking summary length configurable (100-2000 chars)
- **NFR211:** Response storage uses appropriate compression

---

## Phase 3 Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Context-aware analysis is expensive | High cost per analysis | Medium | Start with full context, measure, optimize |
| Prompt classification accuracy | Poor UX if misclassified | Medium | Allow user override, iterate on classifier |
| Debugging loop false positives | Annoying alerts | Medium | Conservative threshold, easy dismissal |
| Large conversation storage | Database growth | Low | Thinking summarization, retention policies |
| Import overwhelms system | API overload | Medium | Rate limiting, background queue |

---

## Phase 3 Dependencies

### On Phase 2

- Epic 15 (Response Context Capture) — extended for full storage
- Epic 16 (Session Tracking) — foundation for conversations
- Epic 17 (Historical Import) — extended for project mapping
- Epic 19 (VS Code Extension) — extended for alerts and capture
- Epic 21 (Enhanced Analysis) — extended for context-awareness
- Epic 22 (Configurable Analysis) — used for prompt classification config

### External

- Claude API — for context-aware analysis
- Supabase — database schema extensions
- VS Code Marketplace — extension updates
