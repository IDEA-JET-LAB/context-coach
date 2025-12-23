# Story 14.2: Core Documentation Content

Status: ✅ COMPLETED (2025-12-23)
Priority: P2
Depends On: Story 14.1 (Documentation Page Structure)

## Story

**As a** new user,
**I want** documentation covering essential features,
**So that** I can get started quickly and understand the platform.

## Acceptance Criteria

1. **Given** the Getting Started section
   **When** I read it
   **Then** I understand the basic flow: signup → create team → create project → install CLI → capture prompts

2. **Given** the CLI Installation section
   **When** I read it
   **Then** I see step-by-step instructions with code snippets
   **And** I understand the install token flow
   **And** I see troubleshooting tips

3. **Given** the Understanding Scores section
   **When** I read it
   **Then** I understand the 5 dimensions (Clarity, Context, Specificity, Goal, Constraints)
   **And** I understand the scoring scale (1-10)
   **And** I see examples of good vs. improvable prompts

4. **Given** the Team Management section
   **When** I read it
   **Then** I understand roles (admin vs. member)
   **And** I understand how to invite members
   **And** I understand team switching

5. **Given** the FAQ section
   **When** I read it
   **Then** I find at least 8 FAQ entries covering:
   - Account and authentication questions (signup, login, password reset)
   - CLI installation and troubleshooting
   - Prompt capture and analysis
   - Team and project management
   - Privacy and data handling
   - Scoring methodology

6. **Given** an empty documentation section (no content)
   **When** the page renders
   **Then** a helpful placeholder message is shown instead of a blank page
   **And** the placeholder suggests contacting support or checking back later

7. **Given** a broken internal link in documentation
   **When** I click the link
   **Then** I see a user-friendly 404 page
   **And** the 404 page suggests navigating to the docs home or using search

## Tasks / Subtasks

- [ ] **Task 1: Write Getting Started guide**
  - [ ] Create `content/docs/getting-started.md`
  - [ ] Overview of Contextor
  - [ ] Step-by-step first-time setup
  - [ ] What to expect after installation

- [ ] **Task 2: Write CLI Installation guide**
  - [ ] Create `content/docs/cli-installation.md`
  - [ ] Prerequisites (Node.js, Claude Code)
  - [ ] Getting install token from dashboard
  - [ ] Running the install command
  - [ ] Verifying installation
  - [ ] Troubleshooting common issues

- [ ] **Task 3: Write Understanding Scores guide**
  - [ ] Create `content/docs/understanding-scores.md`
  - [ ] Explain the 5 dimensions
  - [ ] Explain scoring scale (1-10)
  - [ ] Good vs. improvable prompt examples
  - [ ] How to improve each dimension

- [ ] **Task 4: Write Team Management guide**
  - [ ] Create `content/docs/team-management.md`
  - [ ] Creating a team
  - [ ] Inviting members
  - [ ] Roles and permissions
  - [ ] Switching between teams
  - [ ] Team settings

- [ ] **Task 5: Write FAQ**
  - [ ] Create `content/docs/faq.md`
  - [ ] Common questions about the product
  - [ ] Technical questions
  - [ ] Billing/pricing questions (if applicable)

- [ ] **Task 6: Review and polish**
  - [ ] Proofread all content
  - [ ] Ensure consistent formatting
  - [ ] Add internal links between docs
  - [ ] Verify code snippets are accurate

## Dev Notes

### File Extension Choice: `.md` (Plain Markdown)

This story uses plain Markdown (`.md`) files rather than MDX (`.mdx`) for the following reasons:

1. **Simplicity** - Documentation content is primarily prose and code blocks; no interactive components are needed
2. **Portability** - Plain Markdown can be easily migrated to other documentation platforms if needed
3. **Faster builds** - No MDX compilation overhead
4. **Broader tooling support** - Works with any Markdown editor or renderer

If interactive components are needed in the future (e.g., live code playgrounds, interactive diagrams), individual files can be converted to `.mdx` on a case-by-case basis. The documentation page structure (Story 14.1) should support both formats.

### Content Templates

#### Getting Started (`content/docs/getting-started.md`)

```markdown
# Getting Started with Contextor

Welcome to Contextor! This guide will help you get up and running in minutes.

## What is Contextor?

Contextor is a prompt journaling system that helps AI-assisted development teams
improve their prompting skills. It automatically captures your Claude Code prompts,
analyzes them, and provides actionable feedback.

## Quick Start (5 minutes)

### Step 1: Create Your Account

1. Go to [contextor.co](https://contextor.co)
2. Click "Get Started"
3. Sign up with email or Google

### Step 2: Create a Team

After signing up, you'll be guided to create your first team:

1. Enter a team name (e.g., "My Dev Team")
2. Click "Create Team"

### Step 3: Create a Project

Projects are how Contextor organizes prompts:

1. Click "Create Project"
2. Enter a project name (e.g., "my-app")
3. Copy the install token shown

### Step 4: Install the CLI

In your project directory, run:

\`\`\`bash
npx @contextor/cli init <YOUR_INSTALL_TOKEN>
\`\`\`

### Step 5: Start Prompting!

That's it! Now when you use Claude Code in your project, your prompts will be
automatically captured and analyzed.

## What's Next?

- [CLI Installation](/docs/cli-installation) - Detailed installation guide
- [Understanding Scores](/docs/understanding-scores) - Learn about prompt analysis
- [Team Management](/docs/team-management) - Invite your team
```

#### CLI Installation (`content/docs/cli-installation.md`)

```markdown
# CLI Installation

This guide covers installing Contextor in your development projects.

## Prerequisites

- Node.js 18 or later
- Claude Code installed and configured
- A Contextor account with a project created

## Getting Your Install Token

1. Log in to [contextor.co](https://contextor.co)
2. Navigate to your project settings
3. Click "Installation" tab
4. Copy the install token (starts with `ctx_`)

## Installing

Run this command in your project's root directory:

\`\`\`bash
npx @contextor/cli init <YOUR_TOKEN>
\`\`\`

### What the CLI Does

The CLI creates these files in your project:

| File | Purpose |
|------|---------|
| \`.contextor/config.json\` | Shared project config (commit this) |
| \`.contextor/.user\` | Your personal API key (gitignored) |
| \`.claude/hooks/contextor-capture.sh\` | Capture script |
| \`.claude/settings.json\` | Claude Code hook config |

## Verifying Installation

Check the installation status:

\`\`\`bash
npx @contextor/cli status
\`\`\`

You should see:
- ✓ Config found
- ✓ API connection working
- ✓ Hooks installed

## Troubleshooting

### "Token invalid" error

- Ensure you copied the full token including `ctx_` prefix
- Check that the project hasn't been deleted
- Generate a new token from project settings

### "Hook not triggering"

- Restart Claude Code after installation
- Check that `.claude/settings.json` exists
- Verify the hook path in settings.json

### "Connection refused"

- Check your internet connection
- Verify contextor.co is accessible
- Check if you're behind a corporate firewall

## Uninstalling

To remove Contextor from a project:

\`\`\`bash
npx @contextor/cli uninstall
\`\`\`

This removes all Contextor files but preserves your prompts in the cloud.
```

#### Understanding Scores (`content/docs/understanding-scores.md`)

```markdown
# Understanding Scores

Contextor analyzes your prompts across 5 dimensions, giving each a score from 1-10.

## The 5 Dimensions

### 1. Clarity (Is it clear?)

How well-structured and unambiguous is your prompt?

**High Score (8-10):**
> "Create a React component called UserCard that displays a user's name,
> email, and avatar. Use TypeScript and accept props for the user data."

**Low Score (1-4):**
> "make a component for users"

### 2. Context (Does it provide background?)

How much relevant background information is included?

**High Score:**
> "In our Next.js 14 app using the App Router, we have a `/dashboard` route
> that needs to fetch user data. We're using Supabase for the database."

**Low Score:**
> "how do I get data"

### 3. Specificity (Is it detailed?)

How specific are the requirements and constraints?

**High Score:**
> "The button should be 40px tall, have 16px horizontal padding, use our
> primary blue (#3B82F6), and show a loading spinner when clicked."

**Low Score:**
> "style the button nicely"

### 4. Goal (Is the objective clear?)

Is the desired outcome explicitly stated?

**High Score:**
> "The goal is to reduce the initial page load time from 3s to under 1s
> by implementing code splitting and lazy loading."

**Low Score:**
> "make it faster"

### 5. Constraints (Are limitations defined?)

Are technical or business constraints specified?

**High Score:**
> "Must work in Chrome, Firefox, and Safari. Cannot use any npm packages
> over 50KB. Should be accessible (WCAG 2.1 AA)."

**Low Score:**
> (no constraints mentioned)

## Score Ranges

| Score | Meaning |
|-------|---------|
| 9-10 | Excellent - Near perfect prompt |
| 7-8 | Good - Minor improvements possible |
| 5-6 | Average - Room for improvement |
| 3-4 | Below Average - Needs work |
| 1-2 | Poor - Significant issues |

## Tips for Improvement

1. **Start with context** - What project? What tech stack?
2. **State your goal** - What are you trying to achieve?
3. **Be specific** - Include details, examples, constraints
4. **Review before sending** - Would someone else understand this?
```

### Files to Create

| File | Content |
|------|---------|
| `content/docs/getting-started.md` | Quick start guide |
| `content/docs/cli-installation.md` | Installation details |
| `content/docs/understanding-scores.md` | Score explanation |
| `content/docs/team-management.md` | Team features |
| `content/docs/faq.md` | Common questions |

### Writing Guidelines

- Use second person ("you") for instructions
- Include code examples where relevant
- Use tables for structured information
- Keep paragraphs short (3-4 sentences max)
- Add links to related sections
- Include troubleshooting tips

### References

- [Source: _bmad-output/epics.md#Story-14.2]
- [Source: _bmad-output/prd.md] - For feature accuracy

## Verification Checklist

- [ ] Getting Started guide complete
- [ ] CLI Installation guide complete
- [ ] Understanding Scores guide complete
- [ ] Team Management guide complete
- [ ] FAQ complete
- [ ] All code snippets tested
- [ ] Internal links working
- [ ] Consistent formatting across docs
- [ ] No spelling/grammar errors

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

*To be filled by dev agent - list all files created/modified*
