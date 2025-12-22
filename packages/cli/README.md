# @contextor/cli

The official CLI for installing [Contextor](https://contextor.co) in your development projects.

Contextor is a prompt coaching system that helps development teams improve their AI prompting skills through automated capture, analysis, and feedback.

## Installation

No global installation required! Use `npx` to run directly:

```bash
npx @contextor/cli init <install-token>
```

## Requirements

- Node.js 18.0.0 or higher
- Claude Code installed (for hook integration)

## Usage

### Initialize Contextor

Get your install token from the [Contextor dashboard](https://contextor.co/projects), then run:

```bash
npx @contextor/cli init <your-install-token>
```

This will:
- Create `.contextor/config.json` (shared project config, committed to git)
- Create `.contextor/.user` (your personal API key, gitignored)
- Configure Claude Code hooks for automatic prompt capture
- Test the connection to Contextor cloud

### Check Status

Verify your installation is working:

```bash
npx @contextor/cli status
```

### Uninstall

Remove your personal Contextor configuration from the project:

```bash
npx @contextor/cli uninstall
```

## Getting Your Install Token

1. Log in to [contextor.co](https://contextor.co)
2. Navigate to your project settings
3. Copy the install token (starts with `ctx_`)
4. Run `npx @contextor/cli init <token>`

## What Gets Created

| File | Purpose | Git Status |
|------|---------|------------|
| `.contextor/config.json` | Shared project configuration | Committed |
| `.contextor/.user` | Personal API key | Gitignored |
| `.claude/settings.json` | Claude Code hook configuration | Committed |
| `.claude/hooks/contextor-capture.sh` | Capture script | Committed |

## How It Works

Once installed, Contextor automatically captures your prompts when using Claude Code. Each prompt is:

1. **Captured** - Sent securely to Contextor cloud
2. **Redacted** - Secrets and sensitive data are removed
3. **Analyzed** - AI scores your prompt on 5 dimensions
4. **Stored** - Available in your dashboard with improvement suggestions

## Documentation

Full documentation at [contextor.co/docs](https://contextor.co/docs)

## Support

- [Report an issue](https://github.com/contextor/contextor/issues)
- [Contact us](mailto:hello@contextor.co)

## License

MIT
