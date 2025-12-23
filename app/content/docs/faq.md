# Frequently Asked Questions

Common questions about using Contextor, organized by topic.

## Account and Authentication

### How do I reset my password?

1. Go to the [login page](https://contextor.co/login)
2. Click **Forgot password?**
3. Enter your email address
4. Check your email for a reset link
5. Click the link and enter a new password

Password reset links expire after 1 hour. If yours has expired, request a new one.

### How do I change my email address?

Currently, email changes require contacting support. This is to prevent account takeover. We are working on a self-service email change feature.

### Can I use multiple authentication methods?

If you signed up with email/password, you can also link your Google account for faster login. Go to **Account Settings** to manage your authentication methods.

### Why am I being asked to verify my email again?

Email verification is required after:
- Initial signup
- Changing your email address
- Account recovery

If you did not request this, check your account security and consider changing your password.

## CLI and Installation

### How do I update the CLI?

Run the init command with `@latest`:

```bash
npx @contextor/cli@latest init <your-token>
```

This updates the capture script while preserving your configuration.

### How do I uninstall Contextor from a project?

Run the uninstall command:

```bash
npx @contextor/cli uninstall
```

This removes your personal configuration. Shared project config is preserved for other team members. See [CLI Installation](/docs/cli-installation) for complete removal instructions.

### Can I use Contextor with multiple projects?

Yes. Run the CLI in each project directory with the appropriate install token:

```bash
cd ~/project-a && npx @contextor/cli init <token-a>
cd ~/project-b && npx @contextor/cli init <token-b>
```

Each project captures prompts independently.

### Why are my prompts not appearing in the dashboard?

Common causes:

1. **Hook not installed** - Run `npx @contextor/cli status` to verify
2. **Claude Code not restarted** - Hooks load at startup; restart Claude Code
3. **Missing dependencies** - Ensure `jq` and `curl` are installed
4. **Network issues** - Check firewall/VPN settings

Enable debug mode for detailed logs:

```bash
export DEBUG_CONTEXTOR=1
```

Then check `.contextor/.debug.log` for errors.

### Does the CLI work offline?

No. Prompts are sent to the Contextor API for storage and analysis. If you are offline, prompts will fail silently (to avoid disrupting your workflow) and will not be captured.

## Prompt Capture and Privacy

### What exactly gets captured?

Only the text of your prompts is captured. Specifically:

| Captured | Not Captured |
|----------|--------------|
| Your prompt text | AI responses |
| Timestamp | File contents |
| Project/user IDs | System information |
| | Credentials or secrets |

### Are secrets in my prompts protected?

Yes. Contextor includes automatic secret detection that redacts:

- API keys and tokens (AWS, GitHub, Stripe, etc.)
- SSH private keys
- Passwords in connection strings
- Common secret patterns

However, you should still avoid including sensitive information in prompts.

### Who can see my prompts?

Access depends on your team settings:

| Role | Can View |
|------|----------|
| You | All your own prompts |
| Team Members | Team prompts (depending on settings) |
| Team Admins | All team prompts and analytics |
| Contextor Staff | Only with explicit permission for support |

### How long is my data retained?

Prompt data is retained for the lifetime of your account. You can:

- **Delete individual prompts** from the dashboard
- **Delete your account** to remove all your data
- **Delete a team** to remove all team data

### Can I export my data?

Data export is on our roadmap. Contact support if you need to export your data before this feature is available.

## Scoring and Analysis

### How often are prompts analyzed?

Prompts are queued for analysis immediately after capture. Analysis typically completes within 10-30 seconds, depending on system load.

### Can I dispute or correct a score?

Currently, scores cannot be manually adjusted. The AI analysis is deterministic based on the prompt text. If you believe a score is consistently unfair, contact support with examples.

### Why did my prompt get a low score?

Common reasons for low scores:

- **Low Clarity** - Ambiguous pronouns, undefined terms
- **Low Context** - Missing tech stack, no background
- **Low Specificity** - Vague requirements, no examples
- **Low Goal** - Unclear success criteria
- **Low Constraints** - No boundaries or preferences

See [Understanding Scores](/docs/understanding-scores) for detailed guidance on improving each dimension.

### Can I disable scoring and just use prompt journaling?

Currently, all prompts are analyzed. We are considering an option to disable scoring for users who want journaling only.

### Are very short prompts penalized?

Short prompts often score lower because they typically lack context, specificity, and constraints. However, a well-crafted short prompt can still score well if it is clear, goal-oriented, and appropriate for the context.

## Teams and Collaboration

### How many team members can I have?

There is no limit on team members in the current version.

### How do I leave a team?

1. Go to **Team Settings** > **Members**
2. Find your name in the list
3. Click **Leave Team**

Note: You cannot leave if you are the only admin. Promote someone else first.

### Can I be on multiple teams?

Yes. You can belong to multiple teams and switch between them using the team selector in the navigation bar.

### What happens to my prompts if I leave a team?

Your historical prompts remain in the team's data for analytics purposes. You lose access to view them, but team admins can still see the aggregated data.

### How do I transfer team ownership?

1. Promote the new owner to admin role
2. Have them access Team Settings
3. You can then demote yourself or leave

There is no explicit "ownership transfer" - any admin has full permissions.

## Billing and Plans

### Is there a free tier?

Yes. The current version of Contextor is free to use during our beta period. Pricing plans will be announced before the beta ends.

### Will I lose my data when pricing is introduced?

No. Your captured prompts and analytics will be preserved. You will have the option to continue on a free tier (with limitations) or upgrade to a paid plan.

### How do I cancel my subscription?

During the free beta, there is nothing to cancel. Once paid plans are available, you will be able to manage your subscription from Account Settings.

## Technical Questions

### What AI model is used for analysis?

Contextor uses GPT-4o-mini for prompt analysis. The model configuration can be customized by super admins.

### Is there an API I can use?

The capture API is documented for CLI integration. A public API for querying prompts and analytics is on our roadmap.

### What browsers are supported?

Contextor supports modern browsers:

- Chrome 90+
- Firefox 90+
- Safari 15+
- Edge 90+

### Is there a mobile app?

Not currently. The web dashboard is responsive and works on mobile browsers, but there is no native app.

## Getting Help

### How do I report a bug?

Contact support with:

1. Steps to reproduce the issue
2. Expected vs actual behavior
3. Browser and OS information
4. Screenshots if applicable

### How do I request a feature?

We welcome feature requests! Contact support with a description of what you would like to see and why it would be valuable.

### Where can I find the latest updates?

Check the dashboard for in-app announcements, or follow our blog for product updates.
