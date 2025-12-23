# CLI Installation

The Contextor CLI installs a capture hook into your development environment. This guide covers installation, configuration, verification, troubleshooting, and uninstallation.

## Prerequisites

Before installing, ensure you have:

| Requirement | Details |
|-------------|---------|
| **Node.js** | Version 18.0 or later |
| **Claude Code** | Installed and configured in your project |
| **Contextor Account** | With at least one team and project created |
| **jq** | JSON processor (usually pre-installed on macOS/Linux) |
| **curl** | HTTP client (usually pre-installed on macOS/Linux) |

To check your Node.js version:

```bash
node --version
# Should output v18.x.x or higher
```

## Getting Your Install Token

The install token connects your local environment to your Contextor project. Each team member needs their own token.

1. Log in to [contextor.co](https://contextor.co)
2. Navigate to your project (or create one if you have not already)
3. Click **Settings** in the project header
4. Select the **Installation** tab
5. Click **Copy Token** to copy your personal install token

**Important:** Install tokens are tied to your user account. Do not share your token with other team members - each person should generate their own.

## Installation

Navigate to your project directory (where your code lives) and run:

```bash
npx @contextor/cli init <your-install-token>
```

Replace `<your-install-token>` with the token you copied from the dashboard.

### What the CLI Creates

The CLI creates the following files in your project:

| File | Purpose |
|------|---------|
| `.contextor/config.json` | Shared project configuration (team/project IDs, API endpoint) |
| `.contextor/.user` | Your personal configuration (API key, user ID) - gitignored |
| `.claude/settings.json` | Claude Code settings with capture hook registered |
| `.claude/hooks/contextor-capture.sh` | The capture script that runs on each prompt |

### Git Configuration

The CLI automatically updates your `.gitignore` to exclude personal configuration:

```gitignore
# Added by Contextor CLI
.contextor/.user
.contextor/.debug.log
```

The shared configuration (`.contextor/config.json`) is safe to commit. This allows other team members to install with just their token - they will inherit the project settings.

## Verification

After installation, verify that everything is working:

```bash
npx @contextor/cli status
```

You should see output similar to:

```
Contextor Status
────────────────────────────────────────

Project: My Project
Team: Engineering Team
User: john@example.com
Configured: Dec 22, 2025 at 3:45 PM

Connection: Connected
Last capture: No prompts captured yet

Dashboard: https://contextor.co/projects/xxxx-xxxx
```

### Testing the Capture

To test that prompts are being captured:

1. Open Claude Code in your project
2. Submit any prompt (e.g., "Hello, can you help me?")
3. Check your Contextor dashboard - the prompt should appear within seconds

## Troubleshooting

### Token Invalid or Expired

**Symptoms:**
- `Invalid token` error during installation
- `Connection: Disconnected` in status output

**Solutions:**

1. **Generate a new token** from the dashboard (Settings > Installation > Regenerate)
2. **Check token expiry** - tokens expire after 7 days if unused
3. **Verify the token** is complete - it should be a long alphanumeric string

Re-run the init command with a fresh token:

```bash
npx @contextor/cli init <new-token>
```

### Hook Not Triggering

**Symptoms:**
- Status shows `Connected` but no prompts appear in dashboard
- No errors in Claude Code

**Solutions:**

1. **Verify Claude Code settings** - check that `.claude/settings.json` contains the hook:

```bash
cat .claude/settings.json | jq '.hooks.UserPromptSubmit'
```

You should see an array containing a contextor-capture entry.

2. **Check script permissions:**

```bash
ls -la .claude/hooks/contextor-capture.sh
# Should show -rwxr-xr-x (executable)
```

If not executable:

```bash
chmod +x .claude/hooks/contextor-capture.sh
```

3. **Test the capture script manually:**

```bash
echo '{"prompt":"test prompt"}' | DEBUG_CONTEXTOR=1 bash .claude/hooks/contextor-capture.sh
cat .contextor/.debug.log
```

4. **Restart Claude Code** - hooks are loaded at startup

### Connection Refused

**Symptoms:**
- `Connection: Disconnected` in status
- Capture script shows connection errors in debug log

**Solutions:**

1. **Check internet connectivity:**

```bash
curl -I https://contextor.co/api/health
# Should return HTTP 200
```

2. **Verify API endpoint** in config:

```bash
cat .contextor/config.json | jq '.api_endpoint'
# Should be https://contextor.co/api
```

3. **Check firewall/VPN settings** - some corporate networks block outbound connections

### Debug Mode

Enable detailed logging to diagnose issues:

```bash
export DEBUG_CONTEXTOR=1
```

With debug mode enabled, the capture script writes logs to `.contextor/.debug.log`:

```bash
tail -f .contextor/.debug.log
```

### Missing Dependencies

If you see errors about missing `jq` or `curl`:

**macOS:**

```bash
brew install jq
```

**Ubuntu/Debian:**

```bash
sudo apt-get install jq
```

## Updating the CLI

To update to the latest version:

```bash
npx @contextor/cli@latest init <your-token>
```

This will update the capture script while preserving your configuration.

## Uninstalling

To remove your personal Contextor configuration:

```bash
npx @contextor/cli uninstall
```

This removes:
- Your personal configuration (`.contextor/.user`)
- The capture hook from `.claude/settings.json`

This preserves:
- Shared project configuration (`.contextor/config.json`)
- The capture script (`.claude/hooks/contextor-capture.sh`)

This allows you to reinstall later or enables other team members to continue using Contextor.

### Complete Removal

To completely remove Contextor from a project (including shared configuration), manually delete:

```bash
rm -rf .contextor
rm .claude/hooks/contextor-capture.sh
# Then manually remove the hook entry from .claude/settings.json
```

## Multi-Project Setup

If you work on multiple projects, run the CLI in each project directory with the appropriate token:

```bash
cd ~/projects/frontend
npx @contextor/cli init <frontend-token>

cd ~/projects/backend
npx @contextor/cli init <backend-token>
```

Each project maintains its own configuration and captures prompts to its own Contextor project.

## Next Steps

- **[Understanding Scores](/docs/understanding-scores)** - Learn how your prompts are analyzed
- **[Team Management](/docs/team-management)** - Invite team members to your project
- **[FAQ](/docs/faq)** - Common questions and answers
