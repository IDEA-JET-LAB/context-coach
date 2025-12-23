# Getting Started

Welcome to Contextor! This guide will help you get started with improving your AI prompting skills as an individual or team.

## What is Contextor?

Contextor is a prompt journaling and coaching platform designed for AI-assisted development teams. It helps you capture, analyze, and improve the prompts you send to AI coding assistants like Claude Code.

**Core capabilities:**

- **Automatic Capture** - Prompts are captured silently in the background as you work with Claude Code
- **AI-Powered Analysis** - Each prompt is scored across five quality dimensions with actionable feedback
- **Team Insights** - View team-wide patterns to learn from colleagues and identify improvement areas
- **Personal Growth** - Track your prompting skills over time with detailed analytics

## Quick Start

Follow these five steps to start capturing and analyzing your prompts.

### Step 1: Create an Account

1. Navigate to [contextor.co](https://contextor.co) and click **Get Started**
2. Sign up with your email or continue with Google
3. Verify your email if you signed up with email/password

### Step 2: Create Your Team

After signing in, you will be guided through creating your first team:

1. Enter a team name (e.g., "Engineering Team" or your company name)
2. Click **Create Team**

You can invite team members later from the Team Settings page.

### Step 3: Create a Project

Projects help organize prompts by codebase or initiative. Each project gets its own install token and analytics.

1. After creating a team, you will be prompted to create a project
2. Enter a project name (e.g., "Backend API" or "Mobile App")
3. Optionally add a description
4. Click **Create Project**

### Step 4: Install the CLI

The Contextor CLI installs a capture hook in your development environment. When you send a prompt to Claude Code, it is automatically captured in the background.

1. Navigate to your project in the dashboard
2. Go to **Settings** > **Installation** tab
3. Copy your install token
4. In your terminal, navigate to your project directory and run:

```bash
npx @contextor/cli init <your-token>
```

For detailed installation instructions, see [CLI Installation](/docs/cli-installation).

### Step 5: Start Prompting

Once installed, prompts are captured automatically. There is nothing else you need to do.

1. Open Claude Code in your project
2. Start working as you normally would
3. Every prompt you submit will be captured and analyzed

## What to Expect After Installation

### Immediate Results

- Prompts appear in your dashboard within seconds of submission
- Each prompt is queued for AI analysis (typically 10-30 seconds)

### Analysis Feedback

Once analyzed, each prompt displays:

| Element | Description |
|---------|-------------|
| **Overall Score** | A weighted average score from 1-10 |
| **Dimension Scores** | Individual scores for Clarity, Context, Specificity, Goal, and Constraints |
| **Coaching Suggestions** | Actionable tips to improve future prompts |
| **Examples** | Specific examples of how to rephrase for better results |

### Dashboard Features

- **Feed** - Chronological view of all captured prompts with scores
- **Analytics** - Charts showing score trends, dimension breakdowns, and activity patterns
- **Team View** - Compare team averages and identify learning opportunities

## Next Steps

- **[CLI Installation](/docs/cli-installation)** - Detailed installation and troubleshooting guide
- **[Understanding Scores](/docs/understanding-scores)** - Learn what each dimension measures and how to improve
- **[Team Management](/docs/team-management)** - Invite colleagues and configure team settings
- **[FAQ](/docs/faq)** - Common questions and answers

## Need Help?

If you encounter issues during setup:

1. Check the [FAQ](/docs/faq) for common problems
2. Run `npx @contextor/cli status` to verify your installation
3. Enable debug mode by setting `DEBUG_CONTEXTOR=1` in your environment
